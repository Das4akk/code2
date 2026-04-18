import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    updateProfile, 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    get, 
    onValue, 
    onChildAdded, 
    onDisconnect, 
    remove, 
    off, 
    update 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

// ==========================================
// --- КОНФИГУРАЦИЯ FIREBASE ---
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const appId = "cow-v2-main"; // Из adds.txt

// ==========================================
// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И СОСТОЯНИЯ ---
// ==========================================
window.$ = window.$ || ((id) => document.getElementById(id));

// Кэши комнат и UI
let roomsCache = {};
let roomEnteredAt = 0;
let currentRoomId = null;
let editingRoomId = null; 
let isHost = false;
let pendingJoin = null;

// Кэши пользователей и присутствия
let currentPresenceCache = {};
let latestRoomPresenceData = {};
let onlineUsersCache = {};
let latestVoicePeers = {};

// Состояния синхронизации и чата
let processedMsgs = new Set();
let isRemoteAction = false;
let lastSyncTs = 0;
let currentDirectChat = null;

// WebRTC (Native)
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
let myStream = null;
let voiceSessionId = null;
let voicePeerConnections = new Map();
let voiceParticipantsCache = {};
const remoteAudioAnalyzers = new Map();

// Подписки (teardowns)
let roomListenerUnsubscribe = null;
let voiceSignalCleanup = null;
let directChatUnsubscribe = null;
let dmIndexUnsubscribe = null;
let lobbyFriendsListenerBound = false;
let roomProfileSubscriptions = new Map();
let friendProfileSubscriptions = new Map();
let roomPreviewObserver = null;
let presenceRef = null;

// Переменные из adds.txt
let friendsListeners = [];
let roomsListListener = null;
let ytPlayer = null; // Для YouTube Player
let activeCalls = new Set(); // Peer connections для legacy WebRTC
let dmUnsub = null;
let voiceRef = null;

// Глобальные плееры
const nativePlayer = $('native-player');
// Алиас player для обратной совместимости логики
let player = nativePlayer;

// Форма для репортов
const REPORT_FORM_URL = '';

// ==========================================
// --- УТИЛИТЫ ---
// ==========================================

/**
 * Безопасное экранирование текста для вставки в innerHTML
 */
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[s]);
}

/**
 * Показывает Toast-уведомление
 */
function showToast(message) {
    const container = $('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

/**
 * Переключатель экранов UI
 */
function showScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
    if ($(id)) {
        $(id).classList.add('active'); 
    }
}
// Алиас для adds.txt
function switchScreen(id) {
    showScreen(id);
    if (id === 'lobby-screen') {
        if (typeof initRoomsSystem === 'function') initRoomsSystem();
        if (typeof initFriendsSystem === 'function') initFriendsSystem();
    }
}

/**
 * Получить отображаемое имя
 */
function getDisplayName() {
    return auth.currentUser?.displayName || auth.currentUser?.email || 'User';
}

/**
 * Проверка статуса друга
 */
function isAcceptedFriendRecord(record) {
    return record === true || (record && record.status === 'accepted');
}

/**
 * Расширение лейаута лобби
 */
function widenLobbyLayout() {
    const layout = document.querySelector('.lobby-layout');
    if (layout) {
        layout.style.maxWidth = '95vw';
        layout.style.width = '95vw';
    }
}

/**
 * Фикс фокуса инпутов на мобильных устройствах
 */
function fixMobileInput() {
    window.addEventListener('resize', () => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            setTimeout(() => { 
                document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            }, 100);
        }
    });
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    window.addEventListener('resize', () => { 
        doc.style.setProperty('--app-height', `${window.innerHeight}px`); 
    });
}

/**
 * Получить права по умолчанию
 */
function getDefaultRoomPerms(host = false) {
    return { chat: true, voice: true, player: !!host, reactions: true };
}

/**
 * Получить эффективные права пользователя
 */
function getEffectiveRoomPerms(node, host = false) {
    return host ? { chat: true, voice: true, player: true, reactions: true } : { ...getDefaultRoomPerms(false), ...(node?.perms || {}) };
}

// ==========================================
// --- КРИПТОГРАФИЧЕСКИЕ УТИЛИТЫ ---
// ==========================================

function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuf(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function genSalt(len = 16) {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return bufToBase64(a.buffer);
}

async function deriveKey(password, saltBase64, iterations = 10000) {
    const enc = new TextEncoder();
    const salt = base64ToBuf(saltBase64);
    const keyMaterial = await crypto.subtle.importKey(
        'raw', 
        enc.encode(password), 
        { name: 'PBKDF2' }, 
        false, 
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, 
        keyMaterial, 
        256
    );
    return bufToBase64(derivedBits);
}

// ==========================================
// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
// ==========================================

setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, (user) => {
    if (user) {
        if ($('user-display-name')) {
            $('user-display-name').innerText = user.displayName || user.email;
        }
        if (!currentRoomId) {
            showScreen('lobby-screen');
            setupLobbyNotificationsFinal(); // Используем финальную версию
            loadFriendsSidebar();
        }
        syncRooms();
        bindSelfPresence();
        subscribeToOwnProfile();
        startDirectMessageNotifications();
        widenLobbyLayout();
        fixMobileInput();
    } else {
        showScreen('auth-screen');
        cleanupAllConnections();
    }
});

// Переключение табов авторизации
if ($('tab-login')) {
    $('tab-login').onclick = () => { 
        $('form-login').classList.add('active-form'); 
        $('form-login').classList.remove('hidden-form', 'left'); 
        $('form-register').classList.add('hidden-form', 'right'); 
        $('form-register').classList.remove('active-form'); 
        $('tab-login').classList.add('active'); 
        $('tab-register').classList.remove('active'); 
    };
}

if ($('tab-register')) {
    $('tab-register').onclick = () => { 
        $('form-register').classList.add('active-form'); 
        $('form-register').classList.remove('hidden-form', 'right'); 
        $('form-login').classList.add('hidden-form', 'left'); 
        $('form-login').classList.remove('active-form'); 
        $('tab-register').classList.add('active'); 
        $('tab-login').classList.remove('active'); 
    };
}

// Кнопки входа
if ($('btn-login-email')) {
    $('btn-login-email').onclick = async () => { 
        try { 
            await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); 
        } catch(e) { 
            showToast("Ошибка: " + e.message); 
        } 
    };
}

// Из adds.txt: bindAuth (Legacy)
function bindAuth() {
    if ($('btn-login')) {
        $('btn-login').onclick = async () => {
            const email = $('login-email').value;
            const pass = $('login-password').value;
            try {
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (e) { 
                showToast("Ошибка входа: " + e.message); 
            }
        };
    }
    if ($('btn-register')) {
        $('btn-register').onclick = async () => {
            const email = $('reg-email').value;
            const pass = $('reg-password').value;
            const name = $('reg-name').value;
            try {
                const res = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(res.user, { displayName: name });
                await set(ref(db, `users/${res.user.uid}`), { name, email, createdAt: Date.now() });
            } catch (e) { 
                showToast("Ошибка регистрации: " + e.message); 
            }
        };
    }
}

if ($('btn-register-email')) {
    $('btn-register-email').onclick = async () => { 
        try { 
            const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); 
            await updateProfile(res.user, { displayName: $('reg-name').value }); 
            if ($('user-display-name')) {
                $('user-display-name').innerText = $('reg-name').value; 
            }
        } catch(e) { 
            showToast("Ошибка: " + e.message); 
        } 
    };
}

if ($('btn-google-auth')) {
    $('btn-google-auth').onclick = async () => { 
        try { 
            await signInWithPopup(auth, new GoogleAuthProvider()); 
        } catch(e) { 
            showToast("Ошибка Google"); 
        } 
    };
}

if ($('btn-logout')) {
    $('btn-logout').onclick = () => signOut(auth);
}

async function saveProfileEnhanced() {
    if (!auth.currentUser) return showToast('Нужно войти');
    const name = $('profile-name')?.value.trim() || '';
    const status = $('profile-status')?.value.trim() || '';
    const bio = $('profile-bio')?.value.trim() || '';
    const color = $('profile-color')?.value || '#f5f7fa';
    const volume = Math.max(0, Math.min(100, parseInt($('profile-volume')?.value || 100))) / 100;
    
    try {
        await updateProfile(auth.currentUser, { displayName: name });
        await set(ref(db, `users/${auth.currentUser.uid}/profile`), {
            name,
            status,
            bio,
            color,
            defaultVolume: volume,
            updatedAt: Date.now()
        });
        
        if ($('user-display-name')) {
            $('user-display-name').innerText = name || auth.currentUser.email;
        }
        const av = $('my-avatar');
        if (av) {
            av.style.background = `linear-gradient(135deg, ${color}, rgba(255,255,255,0.08))`;
        }
        
        if ($('modal-profile')) {
            $('modal-profile').classList.remove('active');
        }
        showToast('Профиль сохранён');
    } catch (e) { 
        showToast('Ошибка сохранения'); 
    }
}

if ($('btn-profile-save')) {
    $('btn-profile-save').onclick = saveProfileEnhanced;
}

if ($('btn-edit-profile')) {
    $('btn-edit-profile').onclick = () => {
        if (!auth.currentUser) return showToast('Нужно войти');
        if ($('profile-name')) $('profile-name').value = auth.currentUser.displayName || '';
        if ($('profile-status')) $('profile-status').value = '';
        if ($('profile-bio')) $('profile-bio').value = '';
        if ($('profile-color')) $('profile-color').value = '#f5f7fa';
        if ($('profile-volume')) $('profile-volume').value = '100';
        if ($('modal-profile')) $('modal-profile').classList.add('active');
    };
}

if ($('btn-profile-cancel')) {
    $('btn-profile-cancel').onclick = () => $('modal-profile')?.classList.remove('active');
}

// ==========================================
// --- СИСТЕМА ПРИСУТСТВИЯ (PRESENCE) ---
// ==========================================

function bindSelfPresence() {
    if (!auth.currentUser) return;
    
    const connectedRef = ref(db, '.info/connected');
    const statusRef = ref(db, `users/${auth.currentUser.uid}/status`);

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            onDisconnect(statusRef).set({ online: false, lastSeen: Date.now() }).then(() => {
                set(statusRef, { online: true, lastSeen: Date.now() });
            });
        }
    });
}

function getOnlineLabel(status) {
    if (status?.online) return 'Онлайн';
    if (status?.lastSeen) {
        const mins = Math.max(1, Math.round((Date.now() - status.lastSeen) / 60000));
        return `Был ${mins} мин назад`;
    }
    return 'Не в сети';
}

async function updatePresenceWithOnlineStatus(statusText = 'Онлайн') {
    if (!currentRoomId || !auth.currentUser) return;
    
    try {
        const now = Date.now();
        const path = `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`;
        await set(ref(db, path), {
            name: auth.currentUser.displayName || 'User',
            perms: { chat: true, voice: true, player: isHost, reactions: true },
            online: true,
            status: statusText,
            lastSeen: now,
            connectedAt: now
        });
        
        onDisconnect(ref(db, path)).update({
            online: false,
            lastSeen: Date.now()
        });
    } catch (e) {
        console.error(e);
    }
}

function setupOnlineTracking() {
    if (!currentRoomId) return;
    
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        onlineUsersCache = data;
        updateOnlineCounter();
        
        Object.entries(data).forEach(([uid, userData]) => {
            const indicator = document.querySelector(`.user-item[data-uid="${uid}"] .indicator`);
            if (indicator && userData.online) {
                indicator.classList.add('online');
            } else if (indicator) {
                indicator.classList.remove('online');
            }
        });
    });
}

function updateOnlineCounter() {
    const count = Object.keys(onlineUsersCache || {}).length;
    const counter = $('online-counter');
    if (counter) {
        $('online-count').innerText = count || 1;
        counter.style.display = count > 0 ? 'flex' : 'none';
    }
}

function subscribeToOwnProfile() {
    if (!auth.currentUser) return;
    const profileRef = ref(db, `users/${auth.currentUser.uid}/profile`);
    onValue(profileRef, (snap) => {
        const profile = snap.val() || {};
        const displayName = profile.name || auth.currentUser.displayName || auth.currentUser.email || 'User';
        if ($('user-display-name')) {
            $('user-display-name').innerText = displayName;
        }
        const avatar = $('my-avatar');
        if (avatar) {
            avatar.style.background = `linear-gradient(45deg, ${profile.color || '#f5f7fa'}, rgba(255,255,255,0.08))`;
        }
        if (currentRoomId && presenceRef) {
            update(presenceRef, { name: displayName }).catch(() => {});
        }
        Object.entries(roomsCache || {}).forEach(([roomId, room]) => {
            if (room?.admin === auth.currentUser.uid && room.adminName !== displayName) {
                update(ref(db, `rooms/${roomId}`), { adminName: displayName }).catch(() => {});
            }
        });
    });
}

// ==========================================
// --- ЛОББИ: КОМНАТЫ И ПРЕВЬЮ ---
// ==========================================

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        roomsCache = snap.val() || {};
        const si = $('search-rooms');
        renderRoomsFinal(si ? si.value : '');
    });

    const search = $('search-rooms');
    if (search) {
        let t = null;
        search.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => renderRoomsFinal(e.target.value), 120);
        });
    }

    const rp = $('room-private');
    const rpwd = $('room-password');
    if (rp && rpwd) {
        rp.addEventListener('change', () => { 
            rpwd.style.display = rp.checked ? 'block' : 'none'; 
            if (rp.checked) {
                rpwd.focus();
            }
        });
    }
}

function getRoomPreviewTime(syncState) {
    const baseTime = Number(syncState?.time) || 0;
    if (syncState?.type === 'play' && syncState?.ts) {
        return Math.max(0, baseTime + ((Date.now() - Number(syncState.ts)) / 1000));
    }
    return Math.max(0, baseTime);
}

function applyRoomCardFrame(video) {
    if (!video) return;
    const targetTime = Math.max(0.05, Number(video.dataset.seekTime) || 0.05);
    const seekToFrame = () => {
        const rawDuration = Number(video.duration);
        const hasDuration = Number.isFinite(rawDuration) && rawDuration > 0;
        const safeTime = hasDuration ? Math.min(targetTime, Math.max(rawDuration - 0.15, 0.05)) : targetTime;
        try { 
            video.currentTime = safeTime; 
        } catch (e) {}
        video.pause();
        video.classList.add('ready');
    };

    if (video.readyState >= 1) {
        seekToFrame();
        return;
    }
    video.addEventListener('loadedmetadata', seekToFrame, { once: true });
    video.addEventListener('error', () => video.closest('.room-thumb')?.classList.add('room-thumb-error'), { once: true });
}

function bindRoomPreviewLazyLoad() {
    if (roomPreviewObserver) {
        roomPreviewObserver.disconnect();
    }
    roomPreviewObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const video = entry.target;
            if (!video.src && video.dataset.src) {
                video.src = video.dataset.src;
                applyRoomCardFrame(video);
            }
            roomPreviewObserver.unobserve(video);
        });
    }, { rootMargin: '180px 0px' });

    document.querySelectorAll('.room-thumb-video').forEach((video) => {
        if (video.dataset.src) {
            roomPreviewObserver.observe(video);
        }
    });
}

function refreshRoomCardPreviews() {
    document.querySelectorAll('.room-thumb-video').forEach((video) => applyRoomCardFrame(video));
}

// --- ИСТОРИЧЕСКИЕ ВЕРСИИ РЕНДЕРА (СОХРАНЕНЫ ПО ТРЕБОВАНИЮ) ---
function renderRooms(filter = '') {
    const grid = $('rooms-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const data = roomsCache || {};
    const q = String(filter || '').trim().toLowerCase();
    const keys = Object.keys(data);
    
    if (!keys.length) {
        grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>';
        return;
    }
    
    let htmlBuilder = '';
    keys.forEach(id => {
        const room = data[id];
        const name = room.name || '';
        const host = room.adminName || '';
        if (q) {
            const hay = (name + ' ' + host).toLowerCase();
            if (!hay.includes(q)) return;
        }
        const lock = room.private ? '🔒 ' : '';
        const previewTime = getRoomPreviewTime(room.sync || {});
        const roomLink = room.link || '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
        const previewContent = roomLink
            ? `<video class="room-thumb-video" muted playsinline preload="metadata" src="${escapeHtml(roomLink)}" data-seek-time="${previewTime}"></video><div class="room-thumb-label">Сейчас в плеере</div>`
            : `<div class="room-thumb-placeholder">Видео не задано</div>`;
        htmlBuilder += `
            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(room.link || '')}, ${JSON.stringify(room.admin || '')})'>
                ${colorDot}
                <div class="room-thumb">${previewContent}</div>
                <h4>${lock + escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${escapeHtml(host)}</p>
            </div>`;
    });
    grid.innerHTML = htmlBuilder;
}

function renderRoomsV2(filter = '') {
    renderRooms(filter);
    refreshRoomCardPreviews();
}

function renderRoomsV4(filter = '') {
    renderRoomsFinal(filter);
}

// Финальная версия рендера
function renderRoomsFinal(filter = '') {
    const grid = $('rooms-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const data = roomsCache || {};
    const q = String(filter || '').trim().toLowerCase();
    const keys = Object.keys(data);
    
    if (!keys.length) {
        grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>';
        return;
    }

    let htmlBuilder = '';
    keys.forEach((id) => {
        const room = data[id] || {};
        const name = room.name || '';
        const host = room.adminName || '';
        if (q && !`${name} ${host}`.toLowerCase().includes(q)) return;

        const roomLink = room.link || '';
        const previewTime = getRoomPreviewTime(room.sync || {});
        const lock = room.private ? '🔒 ' : '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
        
        const previewContent = roomLink
            ? `<video class="room-thumb-video" muted playsinline preload="none" data-src="${escapeHtml(roomLink)}" data-seek-time="${previewTime}"></video><div class="room-thumb-label">Сейчас в плеере</div>`
            : `<div class="room-thumb-placeholder">Видео не задано</div>`;

        htmlBuilder += `
            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(roomLink)}, ${JSON.stringify(room.admin || '')})'>
                ${colorDot}
                <div class="room-thumb">${previewContent}</div>
                <h4>${lock + escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${escapeHtml(host)}</p>
            </div>`;
    });

    grid.innerHTML = htmlBuilder || '<div style="padding:20px; color:#888">Ничего не найдено</div>';
    bindRoomPreviewLazyLoad();
}

// Из adds.txt: initRoomsSystem
function initRoomsSystem() {
    const container = $('rooms-list');
    if (!container) return;

    if (roomsListListener) {
        off(ref(db, 'rooms'));
    }

    roomsListListener = onValue(ref(db, 'rooms'), (snapshot) => {
        container.innerHTML = '';
        const rooms = snapshot.val();
        if (!rooms) {
            container.innerHTML = '<div class="empty-state">Нет активных комнат. Создайте первую!</div>';
            return;
        }

        Object.keys(rooms).forEach(id => {
            const room = rooms[id];
            const div = document.createElement('div');
            div.className = 'room-card glass-panel';
            div.innerHTML = `
                <div class="room-info">
                    <h3>${escapeHtml(room.name)}</h3>
                    <p>${room.isPrivate ? '🔒 Приватная' : '🌍 Открытая'}</p>
                    <small>Участников: ${room.members ? Object.keys(room.members).length : 0}</small>
                </div>
                <div class="room-actions">
                    ${room.hostId === auth.currentUser?.uid ? `<button class="edit-btn" onclick="openEditRoom('${id}')">⚙️</button>` : ''}
                    <button class="join-btn" onclick="enterRoom('${id}')">Войти</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// ==========================================
// --- СОЗДАНИЕ И РЕДАКТИРОВАНИЕ КОМНАТ ---
// ==========================================

function setCreateModalMode(mode = 'create') {
    const modal = $('modal-create');
    const title = modal?.querySelector('h2');
    if (title) {
        title.textContent = mode === 'edit' ? 'Изменить комнату' : 'Создать комнату';
    }
}

function bindCreateModalOverrides() {
    if ($('btn-open-modal')) {
        $('btn-open-modal').onclick = () => {
            editingRoomId = null;
            setCreateModalMode('create');
            if ($('room-name')) $('room-name').value = '';
            if ($('room-link')) $('room-link').value = '';
            $('modal-create')?.classList.add('active');
        };
    }
    if ($('btn-close-modal')) {
        $('btn-close-modal').onclick = () => {
            editingRoomId = null;
            setCreateModalMode('create');
            $('modal-create')?.classList.remove('active');
            if ($('room-password')) $('room-password').value = '';
            if ($('room-private')) $('room-private').checked = false;
        };
    }
}
bindCreateModalOverrides();

if ($('btn-delete-all-rooms')) {
    $('btn-delete-all-rooms').onclick = async () => {
        if(confirm("ВНИМАНИЕ! Вы удалите ВСЕ комнаты. Продолжить?")) {
            await remove(ref(db, 'rooms'));
            showToast("Все комнаты удалены.");
        }
    };
}

if ($('btn-create-finish')) {
    $('btn-create-finish').onclick = async () => {
        const name = $('room-name').value;
        const link = $('room-link').value;
        if(!name || !link) return showToast("Заполни поля!");
        
        const isPrivate = $('room-private') ? $('room-private').checked : false;
        const password = $('room-password') ? $('room-password').value : '';
        const buttonColor = $('room-button-color') ? $('room-button-color').value : '';

        if (editingRoomId) {
            const prev = roomsCache[editingRoomId] || {};
            const updateData = { name, link, buttonColor };
            if (isPrivate) {
                if (password && password.length >= 4) {
                    try {
                        const salt = genSalt(16);
                        const pwHash = await deriveKey(password, salt);
                        updateData.private = true;
                        updateData.pwSalt = salt;
                        updateData.pwHash = pwHash;
                    } catch (e) { 
                        return showToast('Ошибка при установке пароля'); 
                    }
                } else if (prev.private) {
                    updateData.private = true;
                    updateData.pwSalt = prev.pwSalt;
                    updateData.pwHash = prev.pwHash;
                } else {
                    return showToast('Укажите пароль для приватной комнаты (мин 4 символа)');
                }
            } else {
                updateData.private = null;
                updateData.pwSalt = null;
                updateData.pwHash = null;
            }

            try {
                await update(ref(db, `rooms/${editingRoomId}`), updateData);
                showToast('Комната обновлена');
                editingRoomId = null;
                $('modal-create').classList.remove('active');
            } catch (e) { 
                showToast('Ошибка при обновлении комнаты'); 
            }
            return;
        }

        const newRoomRef = push(ref(db, 'rooms'));
        const roomData = { 
            name, 
            link, 
            admin: auth.currentUser.uid, 
            adminName: auth.currentUser.displayName || "User", 
            buttonColor 
        };
        
        if (isPrivate) {
            if (!password || password.length < 4) {
                return showToast('Пароль должен быть минимум 4 символа');
            }
            try {
                const salt = genSalt(16);
                roomData.private = true;
                roomData.pwSalt = salt;
                roomData.pwHash = await deriveKey(password, salt);
            } catch (e) {
                return showToast('Ошибка при установке пароля');
            }
        }
        await set(newRoomRef, roomData);
        $('modal-create').classList.remove('active');
        if ($('room-password')) $('room-password').value = '';
        if ($('room-private')) $('room-private').checked = false;
        
        // Используем финальную версию входа
        enterRoomFinal(newRoomRef.key, name, link, auth.currentUser.uid);
    };
}

// ==========================================
// --- ВХОД В КОМНАТУ И МОДАЛ ПАРОЛЯ ---
// ==========================================

window.joinRoom = (id, name, link, admin) => {
    const room = roomsCache[id] || null;
    if (room && room.private) {
        pendingJoin = { id, name, link, admin };
        const m = $('modal-join');
        const inp = $('join-password');
        if (inp) inp.value = '';
        if (m) { 
            m.classList.add('active'); 
            setTimeout(() => inp && inp.focus(), 120); 
        }
        return;
    }
    return enterRoomFinal(id, name, link, admin);
};

if ($('btn-join-confirm')) {
    $('btn-join-confirm').onclick = async () => {
        if (!pendingJoin) return;
        const room = roomsCache[pendingJoin.id];
        if (!room) { 
            showToast('Комната недоступна'); 
            pendingJoin = null; 
            $('modal-join')?.classList.remove('active'); 
            return; 
        }
        
        const pw = $('join-password')?.value || '';
        try {
            const derived = await deriveKey(pw, room.pwSalt);
            if (derived === room.pwHash) {
                $('modal-join')?.classList.remove('active');
                const { id, name, link, admin } = pendingJoin;
                pendingJoin = null;
                enterRoomFinal(id, name, link, admin);
            } else {
                showToast('Неверный пароль');
            }
        } catch (e) { 
            showToast('Ошибка проверки пароля'); 
        }
    };
}

if ($('btn-join-cancel')) {
    $('btn-join-cancel').onclick = () => { 
        pendingJoin = null; 
        $('modal-join')?.classList.remove('active'); 
    };
}

if ($('join-password')) {
    $('join-password').onkeydown = (e) => { 
        if (e.key === 'Enter') $('btn-join-confirm')?.click(); 
    };
}

// ==========================================
// --- СИСТЕМА ДРУЗЕЙ (САЙДБАР И ИНВАЙТЫ) ---
// ==========================================

function clearFriendProfileSubscriptions() {
    friendProfileSubscriptions.forEach((unsubscribe) => { 
        try { unsubscribe(); } catch (e) {} 
    });
    friendProfileSubscriptions.clear();
}

function renderFriendsPanelLive(friendIds = []) {
    const panel = $('friends-list-panel');
    if (!panel) return;
    panel.innerHTML = '<h3>👥 Друзья</h3>';
    if (!friendIds.length) {
        panel.innerHTML += '<div class="room-invite-empty">Нет друзей</div>';
        return;
    }

    friendIds.forEach((uid) => {
        const card = document.createElement('div');
        card.className = 'friend-card';
        card.dataset.fuid = uid;
        card.innerHTML = `
            <div class="friend-online-dot"></div>
            <div class="friend-live-avatar"></div>
            <div class="friend-card-meta">
                <strong>...</strong>
                <span class="friend-status-text">Загрузка...</span>
            </div>
            <button type="button" class="friend-dm-btn" data-fuid="${uid}">💬</button>
        `;
        panel.appendChild(card);

        const profileRef = ref(db, `users/${uid}/profile`);
        const statusRef = ref(db, `users/${uid}/status`);
        
        const applyData = () => {
            const profile = card._profile || {};
            const status = card._status || {};
            const nameEl = card.querySelector('strong');
            const avatarEl = card.querySelector('.friend-live-avatar');
            const statusTextEl = card.querySelector('.friend-status-text');
            const dotEl = card.querySelector('.friend-online-dot');
            
            if (nameEl) nameEl.textContent = profile.name || 'User';
            if (avatarEl) avatarEl.style.background = `linear-gradient(45deg, ${profile.color || '#f5f7fa'}, rgba(255,255,255,0.08))`;
            if (statusTextEl) statusTextEl.textContent = getOnlineLabel(status);
            if (dotEl) dotEl.classList.toggle('online', !!status.online);
        };
        
        const profileListener = (snap) => { card._profile = snap.val() || {}; applyData(); };
        const statusListener = (snap) => { card._status = snap.val() || {}; applyData(); };
        
        onValue(profileRef, profileListener);
        onValue(statusRef, statusListener);
        
        friendProfileSubscriptions.set(`profile:${uid}`, () => off(profileRef, 'value', profileListener));
        friendProfileSubscriptions.set(`status:${uid}`, () => off(statusRef, 'value', statusListener));
    });

    panel.querySelectorAll('.friend-dm-btn').forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            const card = button.closest('.friend-card');
            const name = card?.querySelector('strong')?.textContent?.trim() || 'Друг';
            openDirectChatModalFinal(button.dataset.fuid, name);
        };
    });
}

function renderFriendsSidebar(friendsList = []) {
    const container = $('sidebar-friends');
    if (!container) return;
    
    if (!friendsList.length) {
        container.innerHTML = '<div style="padding:12px; font-size:12px; color:rgba(255,255,255,0.5); text-align:center;">Нет друзей</div>';
        return;
    }
    
    container.innerHTML = friendsList.map(f => `
        <div class="friend-card" data-fuid="${f.uid}" style="margin-bottom:8px;">
            <div class="friend-live-avatar" style="background:linear-gradient(45deg, ${escapeHtml(f.color || '#f5f7fa')}, rgba(255,255,255,0.08));"></div>
            <div class="friend-card-meta">
                <strong>${escapeHtml(f.name || 'User')}</strong>
                <span class="friend-status-text">${f.online ? '● Онлайн' : 'Был: ' + (f.lastSeen ? new Date(f.lastSeen).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '—')}</span>
            </div>
            <div class="friend-online-dot${f.online ? ' online' : ''}"></div>
            <button type="button" class="friend-dm-btn" data-fuid="${f.uid}" onclick="openDirectChatModalFinal('${f.uid}', '${escapeHtml(f.name || 'User')}')">💬</button>
        </div>
    `).join('');
}

function loadFriendsSidebar() {
    if (!auth.currentUser) return;
    get(ref(db, `users/${auth.currentUser.uid}/friends`)).then(snap => {
        const friends = snap.val() || {};
        const accepted = Object.entries(friends)
            .filter(([uid, record]) => isAcceptedFriendRecord(record))
            .map(([uid, _]) => uid);
        
        Promise.all(accepted.map(uid => 
            get(ref(db, `users/${uid}/profile`)).then(s => ({ uid, ...s.val() || {} }))
        )).then(profiles => {
            renderFriendsSidebar(profiles);
        });
    });
}

if ($('btn-friends-sidebar')) {
    $('btn-friends-sidebar').onclick = () => {
        const sidebar = $('sidebar-friends');
        if (sidebar) {
            const hidden = sidebar.style.display === 'none';
            sidebar.style.display = hidden ? 'block' : 'none';
            if (hidden) loadFriendsSidebar();
        }
    };
}

if ($('btn-all-rooms')) {
    $('btn-all-rooms').onclick = () => {
        if ($('sidebar-friends')) $('sidebar-friends').style.display = 'none';
        $('btn-all-rooms').classList.add('active');
        $('btn-friends-sidebar').classList.remove('active');
        $('rooms-grid').style.display = 'grid';
        renderRoomsFinal();
    };
}

function ensureRoomInviteUi() {
    const headerActions = $('btn-leave-room')?.parentElement;
    if (headerActions && !$('btn-open-room-invite')) {
        const inviteBtn = document.createElement('button');
        inviteBtn.id = 'btn-open-room-invite';
        inviteBtn.type = 'button';
        inviteBtn.className = 'google-btn';
        inviteBtn.textContent = 'Пригласить друга';
        headerActions.insertBefore(inviteBtn, $('btn-edit-room') || null);
    }

    if (!$('modal-room-invite')) {
        const modal = document.createElement('div');
        modal.id = 'modal-room-invite';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content glass-panel">
                <h2>Пригласить друга</h2>
                <div id="room-invite-list" class="room-invite-list"></div>
                <div class="modal-buttons">
                    <button id="btn-room-invite-close" type="button" class="google-btn">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

async function openRoomInviteModalFinal() {
    if (!auth.currentUser || !currentRoomId) return;
    ensureRoomInviteUi();

    const modal = $('modal-room-invite');
    const list = $('room-invite-list');
    if (!modal || !list) return;

    modal.classList.add('active');
    list.innerHTML = '<div class="room-invite-empty">Загружаю...</div>';

    try {
        const friendsSnap = await get(ref(db, `users/${auth.currentUser.uid}/friends`));
        const friendsData = friendsSnap.val() || {};
        const acceptedIds = Object.keys(friendsData).filter(uid => uid !== auth.currentUser.uid && isAcceptedFriendRecord(friendsData[uid]));
        const presentIds = new Set(Object.keys(onlineUsersCache || {}));
        const inviteableIds = acceptedIds.filter(uid => !presentIds.has(uid));

        if (!inviteableIds.length) {
            list.innerHTML = '<div class="room-invite-empty">Некого приглашать (друзей нет, или они уже здесь)</div>';
            return;
        }

        const friends = await Promise.all(inviteableIds.map(async (uid) => {
            try {
                const snap = await get(ref(db, `users/${uid}/profile`));
                const profile = snap.val() || {};
                return { uid, name: profile.name || 'User', color: profile.color || '#f5f7fa' };
            } catch (e) { 
                return { uid, name: 'User', color: '#f5f7fa' }; 
            }
        }));

        list.innerHTML = friends.map(f => `
            <div class="room-invite-card">
                <div class="room-invite-user">
                    <div class="room-invite-avatar" style="background:linear-gradient(135deg, ${escapeHtml(f.color)}, rgba(255,255,255,0.08));"></div>
                    <strong>${escapeHtml(f.name)}</strong>
                </div>
                <button type="button" class="invite-friend-btn google-btn" data-uid="${f.uid}">Позвать</button>
            </div>
        `).join('');

        list.querySelectorAll('.invite-friend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                const uid = btn.dataset.uid;
                const roomMeta = roomsCache[currentRoomId] || {};
                btn.disabled = true;
                try {
                    await push(ref(db, `users/${uid}/room-invites`), {
                        roomId: currentRoomId,
                        roomName: roomMeta.name || 'Комната',
                        roomLink: roomMeta.link || '',
                        roomAdminId: roomMeta.admin || '',
                        invitedBy: auth.currentUser.displayName || 'User',
                        ts: Date.now()
                    });
                    btn.textContent = 'Отправлено';
                    btn.classList.add('sent');
                    showToast('Инвайт отправлен');
                } catch (e) { 
                    btn.disabled = false; 
                    showToast('Ошибка'); 
                }
            });
        });
    } catch (e) {
        list.innerHTML = '<div class="room-invite-empty">Ошибка загрузки</div>';
    }
}

function closeRoomInviteModal() {
    $('modal-room-invite')?.classList.remove('active');
}

// Из adds.txt: initFriendsSystem
function initFriendsSystem() {
    const container = $('friends-list');
    if (!container) return;

    onAuthStateChanged(auth, (user) => {
        if (!user) return;
        friendsListeners.forEach(r => off(r));
        friendsListeners = [];

        const friendsRef = ref(db, `users/${user.uid}/friends`);
        onValue(friendsRef, (snapshot) => {
            container.innerHTML = '';
            const friends = snapshot.val();
            if (!friends) {
                container.innerHTML = '<p class="empty-hint">Список друзей пуст</p>';
                return;
            }

            Object.keys(friends).forEach(uid => {
                const data = friends[uid];
                const statusRef = ref(db, `users/${uid}/status`);
                onValue(statusRef, (s) => {
                    const status = s.val();
                    renderFriendItemLegacy(uid, data.name || 'User', status?.online);
                });
                friendsListeners.push(statusRef);
            });
        });
    });
}

function renderFriendItemLegacy(uid, name, isOnline) {
    let el = $(`friend-node-${uid}`);
    if (!el) {
        el = document.createElement('div');
        el.id = `friend-node-${uid}`;
        el.className = 'friend-item glass-panel';
        if ($('friends-list')) $('friends-list').appendChild(el);
    }
    if (el) {
        el.innerHTML = `
            <div class="friend-info">
                <div class="avatar-circle">${name[0]}</div>
                <div class="friend-text">
                    <span class="friend-name">${escapeHtml(name)}</span>
                    <span class="friend-status ${isOnline ? 'online' : ''}">
                        ${isOnline ? 'В сети' : 'Офлайн'}
                    </span>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="openDirectChatModalFinal('${uid}', '${escapeHtml(name)}')">💬</button>
                <button onclick="removeFriend('${uid}')">×</button>
            </div>
        `;
    }
}

// --- УВЕДОМЛЕНИЯ ЛОББИ ---
// Исторические функции сохранены для избежания поломок
function setupLobbyNotifications() { /* Legacy */ }
function setupLobbyNotificationsV2() { /* Legacy */ }
function setupLobbyNotificationsV3() { /* Legacy */ }

function setupLobbyNotificationsFinal() {
    if (setupLobbyNotificationsFinal.didInit || !auth.currentUser) return;
    setupLobbyNotificationsFinal.didInit = true;
    
    startDirectMessageNotifications();

    const btnToggleFriends = $('btn-toggle-friends');
    const panel = $('friends-list-panel');
    if (btnToggleFriends && panel && !lobbyFriendsListenerBound) {
        lobbyFriendsListenerBound = true;
        btnToggleFriends.onclick = async () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            if (!isHidden) return;
            
            clearFriendProfileSubscriptions();
            panel.innerHTML = '<h3>👥 Друзья</h3><div class="room-invite-empty">Загружаю...</div>';
            try {
                const friendsSnap = await get(ref(db, `users/${auth.currentUser.uid}/friends`));
                const data = friendsSnap.val() || {};
                const acceptedIds = Object.keys(data).filter((uid) => isAcceptedFriendRecord(data[uid]));
                renderFriendsPanelLive(acceptedIds);
            } catch (e) {
                panel.innerHTML = '<h3>👥 Друзья</h3><div class="room-invite-empty">Не удалось загрузить друзей</div>';
            }
        };
    }

    // Приглашения в комнату
    onChildAdded(ref(db, `users/${auth.currentUser.uid}/room-invites`), (snap) => {
        const invite = snap.val();
        const inviteId = snap.key;
        if (!invite || Date.now() - invite.ts > 3600000) return;

        const notif = document.createElement('div');
        notif.className = 'toast interactive-toast';
        notif.innerHTML = `
            <div style="padding:12px; background:rgba(46,213,115,0.1); border:1px solid #2ed573; border-radius:8px;">
                ${escapeHtml(invite.invitedBy || 'Друг')} приглашает в <strong>${escapeHtml(invite.roomName || 'комнату')}</strong>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button type="button" class="invite-accept-btn google-btn" data-room-id="${escapeHtml(invite.roomId || '')}" data-invite-id="${escapeHtml(inviteId)}">Зайти</button>
                </div>
            </div>
        `;
        $('toast-container')?.appendChild(notif);

        const btn = notif.querySelector('.invite-accept-btn');
        btn?.addEventListener('click', async () => {
            const roomId = btn.dataset.roomId;
            try {
                const roomSnap = await get(ref(db, `rooms/${roomId}`));
                if (!roomSnap.exists()) {
                    await remove(ref(db, `users/${auth.currentUser.uid}/room-invites/${inviteId}`));
                    notif.remove();
                    showToast('Комната больше недоступна');
                    return;
                }
                const room = roomSnap.val() || {};
                await remove(ref(db, `users/${auth.currentUser.uid}/room-invites/${inviteId}`));
                notif.remove();
                enterRoomFinal(roomId, room.name || invite.roomName || 'Комната', room.link || invite.roomLink || '', room.admin || invite.roomAdminId || '');
            } catch (e) { 
                showToast('Ошибка при принятии инвайта'); 
            }
        });

        setTimeout(() => notif.remove(), 8000);
    });

    // Запросы в друзья
    onChildAdded(ref(db, `users/${auth.currentUser.uid}/friend-requests`), (snap) => {
        const req = snap.val();
        const fromUid = snap.key;
        if (!req) return;

        const notif = document.createElement('div');
        notif.className = 'toast interactive-toast';
        notif.innerHTML = `
            <div style="padding:12px; background:rgba(46,213,115,0.1); border:1px solid #2ed573; border-radius:8px;">
                <strong>${escapeHtml(req.from || 'Пользователь')}</strong> хочет в друзья
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button type="button" class="friend-req-accept google-btn" data-from-uid="${escapeHtml(fromUid)}">Принять</button>
                    <button type="button" class="friend-req-decline danger-btn" data-from-uid="${escapeHtml(fromUid)}">Отклонить</button>
                </div>
            </div>
        `;
        $('toast-container')?.appendChild(notif);

        notif.querySelector('.friend-req-accept')?.addEventListener('click', async () => {
            try {
                await set(ref(db, `users/${auth.currentUser.uid}/friends/${fromUid}`), { status: 'accepted', ts: Date.now() });
                await set(ref(db, `users/${fromUid}/friends/${auth.currentUser.uid}`), { status: 'accepted', ts: Date.now() });
                await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                notif.remove();
                showToast('Друг добавлен');
            } catch (e) { showToast('Ошибка'); }
        });

        notif.querySelector('.friend-req-decline')?.addEventListener('click', async () => {
            try {
                await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                notif.remove();
            } catch (e) { showToast('Ошибка'); }
        });

        setTimeout(() => notif.remove(), 8000);
    });
}

// ==========================================
// --- ЛИЧНЫЕ СООБЩЕНИЯ (DIRECT MESSAGES) ---
// ==========================================

function getDirectChatId(uidA, uidB) {
    return [uidA, uidB].sort().join('__');
}

function closeDirectChatModal() {
    if (directChatUnsubscribe) { 
        try { directChatUnsubscribe(); } catch (e) {} 
        directChatUnsubscribe = null; 
    }
    currentDirectChat = null;
    if ($('modal-dm-chat')) $('modal-dm-chat').classList.remove('active');
    if ($('dm-messages')) $('dm-messages').innerHTML = '';
    if ($('dm-input')) $('dm-input').value = '';
}

function renderDirectMessagesFinal(messages = [], pinnedMessage = null) {
    const list = $('dm-messages');
    if (!list) return;
    
    const pinnedHtml = pinnedMessage ? `<div class="dm-pinned"><strong>Закреп:</strong> ${escapeHtml(pinnedMessage.text || '')}</div>` : '';
    
    if (!messages.length) {
        list.innerHTML = `${pinnedHtml}<div class="dm-empty">Сообщений пока нет</div>`;
        return;
    }

    list.innerHTML = `${pinnedHtml}${messages.map((message) => {
        const isSelf = message.fromUid === auth.currentUser.uid;
        return `
            <div class="dm-line ${isSelf ? 'self' : ''}">
                <div class="dm-bubble" data-mid="${message.id}">
                    <strong>${escapeHtml(isSelf ? 'Вы' : (message.fromName || 'Друг'))}</strong>
                    <div>${escapeHtml(message.text || '')}</div>
                    <div class="dm-message-actions">
                        ${isSelf ? `<button type="button" class="dm-action-btn" data-action="edit" data-mid="${message.id}">Изм.</button>` : ''}
                        ${isSelf ? `<button type="button" class="dm-action-btn" data-action="delete" data-mid="${message.id}">Удал.</button>` : ''}
                        <button type="button" class="dm-action-btn" data-action="pin" data-mid="${message.id}">${pinnedMessage?.id === message.id ? 'Откреп.' : 'Закреп.'}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('')}`;
    list.scrollTop = list.scrollHeight;
}

function bindDirectMessageActions(messages, pinnedMessage) {
    const dmMessagesContainer = $('dm-messages');
    if (!dmMessagesContainer) return;
    
    dmMessagesContainer.querySelectorAll('.dm-action-btn').forEach((button) => {
        button.onclick = async () => {
            if (!currentDirectChat) return;
            const message = messages.find((item) => item.id === button.dataset.mid);
            if (!message) return;
            const chatBaseRef = ref(db, `direct-messages/${currentDirectChat.id}`);

            if (button.dataset.action === 'delete' && message.fromUid === auth.currentUser.uid) {
                await remove(ref(db, `direct-messages/${currentDirectChat.id}/messages/${message.id}`));
                if (pinnedMessage?.id === message.id) {
                    await remove(ref(db, `direct-messages/${currentDirectChat.id}/pinned`));
                }
            }
            if (button.dataset.action === 'edit' && message.fromUid === auth.currentUser.uid) {
                const nextText = prompt('Изменить сообщение', message.text || '');
                if (nextText && nextText.trim()) {
                    await update(ref(db, `direct-messages/${currentDirectChat.id}/messages/${message.id}`), { 
                        text: nextText.trim(), 
                        editedAt: Date.now() 
                    });
                    if (pinnedMessage?.id === message.id) {
                        await update(ref(db, `direct-messages/${currentDirectChat.id}/pinned`), { 
                            text: nextText.trim(), 
                            updatedAt: Date.now() 
                        });
                    }
                }
            }
            if (button.dataset.action === 'pin') {
                if (pinnedMessage?.id === message.id) {
                    await remove(ref(db, `direct-messages/${currentDirectChat.id}/pinned`));
                } else {
                    await set(ref(db, `direct-messages/${currentDirectChat.id}/pinned`), {
                        id: message.id,
                        text: message.text || '',
                        fromUid: message.fromUid,
                        fromName: message.fromName || 'User',
                        updatedAt: Date.now()
                    });
                }
            }
            await update(chatBaseRef, { updatedAt: Date.now() });
        };
    });
}

// Экспорт для HTML и старых кнопок
window.openDM = openDirectChatModalFinal;

function openDirectChatModalFinal(targetUid, targetName) {
    if (!targetUid || !auth.currentUser) return;
    closeDirectChatModal();
    
    currentDirectChat = { 
        uid: targetUid, 
        name: targetName || 'Друг', 
        id: getDirectChatId(auth.currentUser.uid, targetUid) 
    };
    
    if ($('dm-chat-title')) $('dm-chat-title').textContent = `Чат с ${currentDirectChat.name}`;
    if ($('dm-chat-status')) $('dm-chat-status').textContent = 'Редактирование, удаление и закреп доступны прямо в чате';
    
    const modal = $('modal-dm-chat');
    if (modal) modal.classList.add('active');

    const chatRef = ref(db, `direct-messages/${currentDirectChat.id}`);
    const listener = (snap) => {
        const data = snap.val() || {};
        const messages = Object.entries(data.messages || {})
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => (a.ts || 0) - (b.ts || 0));
        renderDirectMessagesFinal(messages, data.pinned || null);
        bindDirectMessageActions(messages, data.pinned || null);
        if (data.lastMessage?.ts) {
            sessionStorage.setItem(`dmSeen:${currentDirectChat.id}`, String(data.lastMessage.ts));
        }
    };
    onValue(chatRef, listener);
    directChatUnsubscribe = () => off(chatRef, 'value', listener);
}

async function sendDirectMessageFinal() {
    const input = $('dm-input');
    if (!input || !currentDirectChat || !input.value.trim() || !auth.currentUser) return;
    
    const text = input.value.trim();
    input.value = '';
    const payload = { 
        fromUid: auth.currentUser.uid, 
        fromName: getDisplayName(), 
        text, 
        ts: Date.now() 
    };
    
    await update(ref(db, `direct-messages/${currentDirectChat.id}`), {
        participants: { [auth.currentUser.uid]: true, [currentDirectChat.uid]: true },
        updatedAt: payload.ts,
        lastMessage: payload
    });
    
    await push(ref(db, `direct-messages/${currentDirectChat.id}/messages`), payload);
    sessionStorage.setItem(`dmSeen:${currentDirectChat.id}`, String(payload.ts));
}

function startDirectMessageNotifications() {
    if (dmIndexUnsubscribe || !auth.currentUser) return;
    const dmRoot = ref(db, 'direct-messages');
    
    const listener = (snap) => {
        const chats = snap.val() || {};
        Object.entries(chats).forEach(([chatId, chat]) => {
            if (!chat?.participants?.[auth.currentUser.uid] || !chat.lastMessage) return;
            
            const marker = `dmSeen:${chatId}`;
            const seenTs = Number(sessionStorage.getItem(marker) || '0');
            const lastTs = Number(chat.lastMessage.ts || 0);
            
            if (lastTs <= seenTs || chat.lastMessage.fromUid === auth.currentUser.uid) return;
            
            sessionStorage.setItem(marker, String(lastTs));
            showToast(`ЛС от ${chat.lastMessage.fromName || 'друга'}: ${chat.lastMessage.text || 'Новое сообщение'}`);
        });
    };
    onValue(dmRoot, listener);
    dmIndexUnsubscribe = () => off(dmRoot, 'value', listener);
}

function bindDirectChatUiFinal() {
    if ($('btn-dm-close')) {
        $('btn-dm-close').onclick = closeDirectChatModal;
    }
    if ($('btn-dm-send')) {
        $('btn-dm-send').onclick = sendDirectMessageFinal;
    }
    if ($('dm-input')) {
        $('dm-input').onkeydown = (event) => { 
            if (event.key === 'Enter') sendDirectMessageFinal(); 
        };
    }
    const modal = $('modal-dm-chat');
    if (modal) {
        modal.addEventListener('click', (event) => { 
            if (event.target.id === 'modal-dm-chat') closeDirectChatModal(); 
        });
    }
}
bindDirectChatUiFinal();


// ==========================================
// --- КОМНАТА: ЛОГИКА И СЕРВИСЫ ---
// ==========================================

// Исторические функции сохранены
function enterRoom() { /* Legacy */ }
function enterRoomV2() { /* Legacy */ }
function enterRoomV3() { /* Legacy */ }
function enterRoomV4() { /* Legacy */ }

function subscribeRoomProfiles(uids = [], rerender) {
    const needed = new Set(uids);
    Array.from(roomProfileSubscriptions.keys()).forEach((uid) => {
        if (!needed.has(uid)) {
            roomProfileSubscriptions.get(uid)?.();
            roomProfileSubscriptions.delete(uid);
        }
    });
    needed.forEach((uid) => {
        if (roomProfileSubscriptions.has(uid)) return;
        
        const profileRef = ref(db, `users/${uid}/profile`);
        const statusRef = ref(db, `users/${uid}/status`);
        
        const profileListener = (snap) => {
            latestRoomPresenceData[uid] = { ...(latestRoomPresenceData[uid] || {}), _profile: snap.val() || {} };
            rerender();
        };
        const statusListener = (snap) => {
            latestRoomPresenceData[uid] = { ...(latestRoomPresenceData[uid] || {}), _status: snap.val() || {} };
            rerender();
        };
        
        onValue(profileRef, profileListener);
        onValue(statusRef, statusListener);
        
        roomProfileSubscriptions.set(uid, () => {
            off(profileRef, 'value', profileListener);
            off(statusRef, 'value', statusListener);
        });
    });
}

function clearRoomProfileSubscriptions() {
    roomProfileSubscriptions.forEach((unsubscribe) => { 
        try { unsubscribe(); } catch (e) {} 
    });
    roomProfileSubscriptions.clear();
}

function renderPermissionControls(uid, perms) {
    return `
        <div class="perm-controls">
            <label><span>Чат</span><input class="perm-toggle" type="checkbox" data-uid="${uid}" data-perm="chat" ${perms.chat ? 'checked' : ''}></label>
            <label><span>Voice</span><input class="perm-toggle" type="checkbox" data-uid="${uid}" data-perm="voice" ${perms.voice ? 'checked' : ''}></label>
            <label><span>Плеер</span><input class="perm-toggle" type="checkbox" data-uid="${uid}" data-perm="player" ${perms.player ? 'checked' : ''}></label>
            <label><span>Реакции</span><input class="perm-toggle" type="checkbox" data-uid="${uid}" data-perm="reactions" ${perms.reactions ? 'checked' : ''}></label>
        </div>
    `;
}

window.enterRoomFinal = function(roomId, name, link, adminId) {
    closeDirectChatModal();
    currentRoomId = roomId;
    lastSyncTs = 0;
    processedMsgs.clear();
    currentPresenceCache = {};
    latestRoomPresenceData = {};
    isHost = (auth.currentUser.uid === adminId);
    roomEnteredAt = Date.now();

    if ($('room-title-text')) $('room-title-text').innerText = name;
    
    if (player) {
        player.src = link;
        player.controls = isHost;
        player.style.pointerEvents = isHost ? 'auto' : 'none';
    }
    
    const playerWrapper = $('player-wrapper');
    if (playerWrapper) {
        playerWrapper.style.backgroundImage = '';
        playerWrapper.style.backgroundSize = '';
        playerWrapper.style.backgroundPosition = '';
    }

    if ($('chat-messages')) $('chat-messages').innerHTML = '';
    if ($('users-list')) $('users-list').innerHTML = '';
    
    showScreen('room-screen');
    closeRoomInviteModal();

    const delBtn = $('btn-delete-room');
    const editBtn = $('btn-edit-room');
    
    if (delBtn) {
        delBtn.style.display = isHost ? 'inline-block' : 'none';
        delBtn.onclick = async () => {
            if (!isHost || !confirm('ВНИМАНИЕ! Удалить эту комнату навсегда?')) return;
            await remove(ref(db, `rooms/${currentRoomId}`)).catch(() => showToast('Ошибка удаления комнаты'));
        };
    }
    
    if (editBtn) {
        editBtn.style.display = isHost ? 'inline-block' : 'none';
        editBtn.onclick = () => {
            editingRoomId = currentRoomId;
            setCreateModalMode('edit');
            const meta = roomsCache[currentRoomId] || {};
            if ($('room-name')) $('room-name').value = meta.name || '';
            if ($('room-link')) $('room-link').value = meta.link || '';
            if ($('room-button-color')) $('room-button-color').value = meta.buttonColor || '#ffffff';
            if ($('room-private')) {
                $('room-private').checked = !!meta.private;
                if ($('room-password')) {
                    $('room-password').style.display = $('room-private').checked ? 'block' : 'none';
                }
            }
            if ($('room-password')) $('room-password').value = '';
            const modal = $('modal-create');
            if (modal) modal.classList.add('active');
        };
    }

    initRoomServicesFinal();
    showToast(isHost ? 'Вы зашли как Хост' : 'Вы зашли как Зритель');
}

async function leaveRoomFinal() {
    closeDirectChatModal();
    closeVoiceSignalLayer();
    await disableMicrophoneNative({ notify: false });
    clearRoomProfileSubscriptions();
    
    if (presenceRef) { 
        try { await remove(presenceRef); } catch (e) {} 
    }
    if (roomListenerUnsubscribe) { 
        try { roomListenerUnsubscribe(); } catch (e) {} 
        roomListenerUnsubscribe = null; 
    }
    
    if (player) {
        player.pause();
        player.src = '';
    }
    
    presenceRef = null;
    currentRoomId = null;
    currentPresenceCache = {};
    latestRoomPresenceData = {};
    
    const modalJoin = $('modal-join');
    if (modalJoin) modalJoin.classList.remove('active');
    
    if ($('btn-delete-room')) $('btn-delete-room').style.display = 'none';
    if ($('btn-edit-room')) $('btn-edit-room').style.display = 'none';
    
    showScreen('lobby-screen');
}

if ($('btn-leave-room')) {
    $('btn-leave-room').onclick = leaveRoomFinal;
}

// Из adds.txt: Глобальные экспорты
window.enterRoom = window.enterRoomFinal;
window.leaveRoom = leaveRoomFinal;

function initRoomServicesFinal() {
    const roomId = currentRoomId;
    const roomRef = ref(db, `rooms/${roomId}`);
    const videoRef = ref(db, `rooms/${roomId}/sync`);
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const presenceDbRef = ref(db, `rooms/${roomId}/presence`);
    const reactionsRef = ref(db, `rooms/${roomId}/reactions`);
    const adminId = roomsCache[roomId]?.admin || null;
    
    const teardown = [];
    
    const bindValue = (dbRef, handler) => { 
        onValue(dbRef, handler); 
        teardown.push(() => { try { off(dbRef, 'value', handler); } catch (e) {} });
    };
    const bindChild = (dbRef, handler) => { 
        onChildAdded(dbRef, handler);
        teardown.push(() => { try { off(dbRef, 'child_added', handler); } catch (e) {} }); 
    };

    presenceRef = ref(db, `rooms/${roomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: getDisplayName(), perms: getDefaultRoomPerms(isHost) });
    onDisconnect(presenceRef).remove();

    // --- Рендер пользователей ---
    const rerenderUsers = () => {
        const usersListEl = $('users-list');
        if (!usersListEl) return;
        
        usersListEl.innerHTML = '';
        const ids = Object.keys(currentPresenceCache);
        if ($('users-count')) $('users-count').innerText = ids.length;
        
        subscribeRoomProfiles(ids, rerenderUsers);
        
        ids.forEach((uid) => {
            const presenceNode = currentPresenceCache[uid] || {};
            const profile = latestRoomPresenceData[uid]?._profile || {};
            const perms = getEffectiveRoomPerms(presenceNode, uid === adminId);
            const isLocal = uid === auth.currentUser.uid;
            const isUserHost = uid === adminId;
            const name = escapeHtml(profile.name || presenceNode.name || 'User');

            let html = `<div class="user-item" data-uid="${uid}">`;
            html += `<div class="indicator online"></div>`; 
            html += `<div class="user-main"><span class="user-name">${name}</span>`;
            if (isUserHost) html += `<span class="host-label">Host</span>`;
            if (isLocal) html += `<span class="you-label">(Вы)</span>`;
            html += `</div>`;

            html += `<div class="user-card-actions">`;
            if (!isLocal) {
                html += `<button type="button" class="report-btn" data-uid="${uid}">Report</button>`;
                html += `<button type="button" class="dm-btn" data-uid="${uid}">💬</button>`;
                html += `<button type="button" class="add-friend-btn" data-uid="${uid}">+Доб</button>`;
            }
            html += `</div>`;
            if (isHost && !isLocal) {
                html += renderPermissionControls(uid, perms);
            }
            html += `</div>`;
            usersListEl.innerHTML += html;
        });

        // События кнопок списка
        usersListEl.querySelectorAll('.dm-btn').forEach((button) => {
            button.onclick = () => {
                const item = button.closest('.user-item');
                const name = item?.querySelector('.user-name')?.textContent?.trim() || 'Друг';
                openDirectChatModalFinal(button.dataset.uid, name);
            };
        });

        usersListEl.querySelectorAll('.add-friend-btn').forEach((button) => {
            button.onclick = async (event) => {
                const targetUid = event.currentTarget.dataset.uid;
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${targetUid}`), { status: 'pending', ts: Date.now() });
                    await set(ref(db, `users/${targetUid}/friend-requests/${auth.currentUser.uid}`), { from: auth.currentUser.displayName, ts: Date.now() });
                    showToast('Запрос отправлен');
                } catch (e) {
                    showToast('Ошибка при отправке запроса');
                }
            };
        });

        usersListEl.querySelectorAll('.perm-toggle').forEach((toggle) => {
            toggle.onchange = async (event) => {
                if (!isHost) return;
                const uid = event.currentTarget.dataset.uid;
                const perm = event.currentTarget.dataset.perm;
                const checked = event.currentTarget.checked;
                try {
                    await set(ref(db, `rooms/${roomId}/presence/${uid}/perms/${perm}`), checked);
                    if (perm === 'voice' && !checked) {
                        await remove(ref(db, `rooms/${roomId}/rtc/participants/${uid}`));
                    }
                } catch (e) {
                    showToast('Ошибка при обновлении прав');
                }
            };
        });

        // Применение локальных прав
        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        
        if ($('chat-input')) $('chat-input').disabled = !localPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !localPerms.chat;
        if ($('mic-btn')) $('mic-btn').disabled = !localPerms.voice;
        
        if (!localPerms.voice && myStream) {
            disableMicrophoneNative({ notify: false }).then(() => showToast('Вам отключили голос'));
        }
        
        if (player) {
            player.controls = !!localPerms.player || isHost;
            player.style.pointerEvents = (localPerms.player || isHost) ? 'auto' : 'none';
        }
        
        document.querySelectorAll('.react-btn').forEach((btn) => { 
            btn.disabled = !localPerms.reactions; 
        });
    };

    bindValue(roomRef, (snap) => {
        if (!snap.exists() && currentRoomId) {
            showToast('Комната удалена');
            leaveRoomFinal();
        }
    });

    bindValue(presenceDbRef, (snap) => {
        currentPresenceCache = snap.val() || {};
        rerenderUsers();
    });

    // --- ПЛЕЕР И СИНХРОНИЗАЦИЯ ---
    const canControlPlayer = () => {
        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        return localPerms.player || isHost;
    };

    const broadcastVideoState = (type) => {
        if (isRemoteAction || !canControlPlayer() || !player) return;
        set(videoRef, {
            type,
            time: player.currentTime,
            ts: Date.now(),
            by: auth.currentUser.uid,
            state: (type === 'play' || !player.paused) ? 'playing' : 'paused'
        });
    };

    if (player) {
        player.onplay = () => broadcastVideoState('play');
        player.onpause = () => broadcastVideoState('pause');
        player.onseeked = () => broadcastVideoState('seek');
    }

    bindValue(videoRef, (snap) => {
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs || !player) return;
        if (d.by === auth.currentUser.uid && (Date.now() - d.ts < 800)) return;

        lastSyncTs = d.ts;
        isRemoteAction = true;
        
        if (Math.abs(player.currentTime - d.time) > 0.5) {
            player.currentTime = d.time;
        }
        
        if (d.state === 'playing' || d.type === 'play') {
            player.play().catch(() => {});
        } else {
            player.pause();
        }
        
        setTimeout(() => { isRemoteAction = false; }, 300);
    });

    // --- ЧАТ И ТАЙМКОДЫ ---
    const parseTimecodes = (text) => {
        const escaped = escapeHtml(text);
        return canControlPlayer()
            ? escaped.replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>')
            : escaped.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn disabled">$1</span>');
    };

    function sendRoomMessage() {
        const input = $('chat-input');
        if (!input || !input.value.trim() || !auth.currentUser || !currentRoomId) return;
        
        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        if (!localPerms.chat) return showToast('Чат отключен для вас');
        
        push(chatRef, {
            user: getDisplayName(),
            fromUid: auth.currentUser.uid,
            content: input.value.trim(),
            ts: Date.now()
        });
        input.value = '';
    }

    if ($('send-btn')) {
        $('send-btn').onclick = sendRoomMessage;
    }
    if ($('chat-input')) {
        $('chat-input').onkeydown = (event) => { 
            if (event.key === 'Enter') sendRoomMessage(); 
        };
    }
    
    if ($('chat-messages')) {
        $('chat-messages').onclick = (event) => {
            if (!event.target.classList.contains('timecode-btn') || !canControlPlayer() || !player) return;
            
            const parts = event.target.dataset.time.split(':');
            const mm = parseInt(parts[0], 10);
            const ss = parseInt(parts[1], 10);
            const seconds = (mm * 60) + ss;

            isRemoteAction = true;
            player.currentTime = seconds;
            player.play().catch(() => {});
            setTimeout(() => { isRemoteAction = false; }, 300);

            set(videoRef, {
                type: 'seek',
                time: seconds,
                ts: Date.now(),
                by: auth.currentUser.uid,
                state: 'playing'
            });
        };
    }

    bindChild(chatRef, (snap) => {
        const msg = snap.val();
        const id = snap.key;
        if (!msg || processedMsgs.has(id)) return;
        processedMsgs.add(id);
        
        const isMe = msg.fromUid === auth.currentUser.uid;
        const line = document.createElement('div');
        line.className = isMe ? 'm-line self' : (msg.isSystem ? 'm-line system' : 'm-line');
        line.innerHTML = `<div class="bubble"><strong>${escapeHtml(msg.user || 'User')}</strong><p>${parseTimecodes(msg.content || '')}</p></div>`;
        
        const chatMessages = $('chat-messages');
        if (chatMessages) {
            chatMessages.appendChild(line);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (!isMe && !msg.isSystem && msg.ts >= (roomEnteredAt - 2000)) {
                if (chatMessages.style.display === 'none') {
                    showToast(`💬 ${msg.user}: ${msg.content.substring(0, 20)}...`);
                }
            }
        }
    });

    document.querySelectorAll('.react-btn').forEach((btn) => {
        btn.onclick = () => {
            const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
            if (!localPerms.reactions) return;
            push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
        };
    });

    bindChild(reactionsRef, (snap) => {
        const reaction = snap.val();
        if (!reaction || Date.now() - reaction.ts > 5000) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = reaction.emoji;
        el.style.left = `${Math.random() * 80 + 10}%`;
        const layer = $('reaction-layer');
        if (layer) {
            layer.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
    });

    // --- ГОЛОСОВЫЕ ФУНКЦИИ (Native WebRTC Signal) ---
    const voiceRefs = getVoiceRefs(roomId);
    
    bindValue(voiceRefs.participants, async (snap) => {
        voiceParticipantsCache = snap.val() || {};
        for (const remoteUid of Array.from(voicePeerConnections.keys())) {
            if (!voiceParticipantsCache[remoteUid]) destroyVoiceConnection(remoteUid);
        }
        if (myStream && voiceSessionId) {
            for (const remoteUid of Object.keys(voiceParticipantsCache)) {
                await createVoiceOfferFor(remoteUid);
            }
        }
    });

    bindValue(voiceRefs.offersForMe, (snap) => handleIncomingOffers(snap.val() || {}));
    bindValue(voiceRefs.answersForMe, (snap) => handleIncomingAnswers(snap.val() || {}));
    bindValue(voiceRefs.candidatesForMe, (snap) => handleIncomingCandidates(snap.val() || {}));

    if ($('mic-btn')) {
        $('mic-btn').onclick = async function() {
            const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
            if (!localPerms.voice) return;
            if (myStream) return disableMicrophoneNative();
            try { 
                await enableMicrophoneNative(this); 
            } catch (e) { 
                this.classList.remove('active'); 
                showToast('Ошибка доступа к микрофону'); 
            }
        };
    }

    if ($('voice-volume')) {
        $('voice-volume').oninput = (event) => {
            document.querySelectorAll('#remote-audio-container audio').forEach((audio) => { 
                audio.volume = event.target.value; 
            });
        };
    }

    if ($('btn-fullscreen')) $('btn-fullscreen').onclick = () => $('player-wrapper')?.requestFullscreen();
    if ($('tab-chat-btn')) {
        $('tab-chat-btn').onclick = () => { 
            $('chat-messages').style.display = 'flex'; 
            $('users-list').style.display = 'none'; 
            $('tab-chat-btn').classList.add('active'); 
            $('tab-users-btn').classList.remove('active'); 
        };
    }
    if ($('tab-users-btn')) {
        $('tab-users-btn').onclick = () => { 
            $('users-list').style.display = 'flex'; 
            $('chat-messages').style.display = 'none'; 
            $('tab-users-btn').classList.add('active'); 
            $('tab-chat-btn').classList.remove('active'); 
        };
    }
    
    roomListenerUnsubscribe = () => {
        teardown.forEach((fn) => fn());
        closeVoiceSignalLayer();
        clearRoomProfileSubscriptions();
    };
}

// ==========================================
// --- YOUTUBE СИНХРОНИЗАЦИЯ (ADDS.TXT) ---
// ==========================================

window.onYouTubeIframeAPIReady = () => {
    if (typeof YT !== 'undefined' && YT.Player) {
        ytPlayer = new YT.Player('video-placeholder', {
            height: '100%',
            width: '100%',
            videoId: 'dQw4w9WgXcQ',
            playerVars: { 'autoplay': 0, 'controls': 1, 'rel': 0 },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    }
};

function onPlayerStateChange(event) {
    if (isHost && currentRoomId) {
        const syncRef = ref(db, `rooms/${currentRoomId}/sync`);
        update(syncRef, {
            state: event.data,
            time: ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0,
            lastUpdated: Date.now()
        });
    }
}

function syncPlayer(data) {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    const localTime = ytPlayer.getCurrentTime();
    const diff = Math.abs(localTime - data.time);

    if (diff > 2) {
        ytPlayer.seekTo(data.time, true);
    }
    
    if (data.state === 1 && ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo();
    if (data.state === 2 && ytPlayer.getPlayerState() !== 2) ytPlayer.pauseVideo();
}


// ==========================================
// --- NATIVE WEBRTC ---
// ==========================================

function getVoiceRefs(roomId) {
    return {
        root: ref(db, `rooms/${roomId}/rtc`),
        participants: ref(db, `rooms/${roomId}/rtc/participants`),
        offersForMe: ref(db, `rooms/${roomId}/rtc/offers/${auth.currentUser.uid}`),
        answersForMe: ref(db, `rooms/${roomId}/rtc/answers/${auth.currentUser.uid}`),
        candidatesForMe: ref(db, `rooms/${roomId}/rtc/candidates/${auth.currentUser.uid}`)
    };
}

function createRemoteAudioAnalyzerNative(audio, uid) {
    const userItem = document.querySelector(`.user-item[data-uid="${uid}"]`);
    if (!userItem) return;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementAudioSource(audio);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        audioCtx.resume().catch(() => {});

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animId = null;

        const animate = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            const vol = avg / 256;
            const indicator = userItem.querySelector('.indicator');

            if (indicator && vol > 0.05) {
                const scale = 1 + (vol * 0.4);
                indicator.style.transform = `scale(${scale})`;
                indicator.style.boxShadow = `0 0 ${vol * 20}px #2ed573`;
            } else if (indicator) {
                indicator.style.transform = 'scale(1)';
                indicator.style.boxShadow = '0 0 8px #2ed573';
            }
            animId = requestAnimationFrame(animate);
        };
        animate();
        remoteAudioAnalyzers.set(uid, { analyser, animationId: animId });
    } catch (e) {
        console.warn('Audio analyzer failed to initialize', e);
    }
}

function cleanupRemoteAudioIndicator(uid) {
    const entry = remoteAudioAnalyzers.get(uid);
    if (entry?.animationId) {
        cancelAnimationFrame(entry.animationId);
    }
    remoteAudioAnalyzers.delete(uid);
    const indicator = document.querySelector(`.user-item[data-uid="${uid}"] .indicator`);
    if (indicator) {
        indicator.style.transform = 'scale(1)';
        indicator.style.boxShadow = '0 0 8px #2ed573';
    }
}

function attachRemoteAudioV3(stream, uid) {
    if (!stream) return;
    const container = $('remote-audio-container');
    if (!container) return;

    const audioId = `rtc-audio-${uid}`;
    document.getElementById(audioId)?.remove();
    cleanupRemoteAudioIndicator(uid);

    const audio = document.createElement('audio');
    audio.id = audioId;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = stream;
    audio.volume = parseFloat($('voice-volume')?.value || '1');
    container.appendChild(audio);

    audio.oncanplay = () => {
        createRemoteAudioAnalyzerNative(audio, uid);
        audio.play().catch(() => {
            document.addEventListener('click', () => audio.play().catch(() => {}), { once: true });
        });
    };
}

function destroyVoiceConnection(remoteUid) {
    const entry = voicePeerConnections.get(remoteUid);
    if (entry?.pc) {
        try { entry.pc.onicecandidate = null; } catch (e) {}
        try { entry.pc.ontrack = null; } catch (e) {}
        try { entry.pc.close(); } catch (e) {}
    }
    voicePeerConnections.delete(remoteUid);
    document.getElementById(`rtc-audio-${remoteUid}`)?.remove();
    cleanupRemoteAudioIndicator(remoteUid);
}

function destroyAllVoiceConnections() {
    Array.from(voicePeerConnections.keys()).forEach((uid) => destroyVoiceConnection(uid));
}

function ensureVoicePeerConnection(remoteUid) {
    const existing = voicePeerConnections.get(remoteUid);
    if (existing?.pc && existing.pc.connectionState !== 'closed') return existing.pc;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteParticipant = voiceParticipantsCache[remoteUid] || {};

    if (myStream) {
        myStream.getTracks().forEach((track) => pc.addTrack(track, myStream));
    }

    pc.onicecandidate = ({ candidate }) => {
        if (!candidate || !currentRoomId || !voiceSessionId) return;
        const targetSessionId = voiceParticipantsCache[remoteUid]?.sessionId;
        if (!targetSessionId) return;
        
        push(ref(db, `rooms/${currentRoomId}/rtc/candidates/${remoteUid}/${auth.currentUser.uid}`), {
            candidate: candidate.toJSON(),
            fromSessionId: voiceSessionId,
            toSessionId: targetSessionId,
            ts: Date.now()
        });
    };

    pc.ontrack = (event) => {
        const [stream] = event.streams || [];
        if (stream) attachRemoteAudioV3(stream, remoteUid);
    };

    pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
            destroyVoiceConnection(remoteUid);
        }
    };

    voicePeerConnections.set(remoteUid, { pc, remoteSessionId: remoteParticipant.sessionId || null });
    return pc;
}

async function publishVoiceParticipant() {
    if (!currentRoomId || !voiceSessionId || !auth.currentUser) return;
    await set(ref(db, `rooms/${currentRoomId}/rtc/participants/${auth.currentUser.uid}`), { 
        sessionId: voiceSessionId, 
        ts: Date.now() 
    });
}

async function createVoiceOfferFor(remoteUid) {
    if (!myStream || !voiceSessionId || !currentRoomId || remoteUid === auth.currentUser.uid) return;
    if (auth.currentUser.uid.localeCompare(remoteUid) >= 0) return;

    const remoteSessionId = voiceParticipantsCache[remoteUid]?.sessionId;
    if (!remoteSessionId) return;

    const pc = ensureVoicePeerConnection(remoteUid);
    if (pc.signalingState !== 'stable') return;

    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    await set(ref(db, `rooms/${currentRoomId}/rtc/offers/${remoteUid}/${auth.currentUser.uid}`), {
        description: pc.localDescription.toJSON(),
        fromSessionId: voiceSessionId,
        toSessionId: remoteSessionId,
        ts: Date.now()
    });
}

async function handleIncomingOffers(offers = {}) {
    const localSessionId = voiceSessionId;
    if (!localSessionId || !myStream || !currentRoomId) return;

    for (const [fromUid, payload] of Object.entries(offers)) {
        if (!payload?.description) continue;
        const remoteParticipant = voiceParticipantsCache[fromUid];
        if (!remoteParticipant?.sessionId) continue;
        if (payload.toSessionId !== localSessionId || payload.fromSessionId !== remoteParticipant.sessionId) continue;

        const pc = ensureVoicePeerConnection(fromUid);
        try {
            if (pc.signalingState !== 'stable') { 
                try { await pc.setLocalDescription({ type: 'rollback' }); } catch (e) {} 
            }
            await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await set(ref(db, `rooms/${currentRoomId}/rtc/answers/${fromUid}/${auth.currentUser.uid}`), {
                description: pc.localDescription.toJSON(),
                fromSessionId: localSessionId,
                toSessionId: remoteParticipant.sessionId,
                ts: Date.now()
            });
            await remove(ref(db, `rooms/${currentRoomId}/rtc/offers/${auth.currentUser.uid}/${fromUid}`));
        } catch (e) { 
            console.error('offer handling failed', e); 
        }
    }
}

async function handleIncomingAnswers(answers = {}) {
    const localSessionId = voiceSessionId;
    if (!localSessionId || !currentRoomId) return;

    for (const [fromUid, payload] of Object.entries(answers)) {
        if (!payload?.description) continue;
        const remoteParticipant = voiceParticipantsCache[fromUid];
        const pc = voicePeerConnections.get(fromUid)?.pc;
        if (!pc || !remoteParticipant?.sessionId) continue;
        if (payload.toSessionId !== localSessionId || payload.fromSessionId !== remoteParticipant.sessionId) continue;

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            await remove(ref(db, `rooms/${currentRoomId}/rtc/answers/${auth.currentUser.uid}/${fromUid}`));
        } catch (e) { 
            console.error('answer handling failed', e); 
        }
    }
}

async function handleIncomingCandidates(candidateGroups = {}) {
    const localSessionId = voiceSessionId;
    if (!localSessionId || !currentRoomId) return;

    for (const [fromUid, candidates] of Object.entries(candidateGroups)) {
        const remoteParticipant = voiceParticipantsCache[fromUid];
        if (!remoteParticipant?.sessionId) continue;
        const pc = ensureVoicePeerConnection(fromUid);

        for (const [candidateId, payload] of Object.entries(candidates || {})) {
            if (!payload?.candidate) continue;
            if (payload.toSessionId !== localSessionId || payload.fromSessionId !== remoteParticipant.sessionId) continue;

            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) { 
                console.error('candidate handling failed', e); 
            }
            await remove(ref(db, `rooms/${currentRoomId}/rtc/candidates/${auth.currentUser.uid}/${fromUid}/${candidateId}`));
        }
    }
}

function closeVoiceSignalLayer() {
    if (voiceSignalCleanup) { 
        try { voiceSignalCleanup(); } catch (e) {} 
        voiceSignalCleanup = null; 
    }
}

function cleanupAllConnections() {
    destroyAllVoiceConnections();
    if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
        myStream = null;
    }
    voiceSessionId = null;
    voiceParticipantsCache = {};
}

async function enableMicrophoneNative(button) {
    cleanupAllConnections();
    myStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    voiceSessionId = crypto.randomUUID();
    button?.classList.add('active');
    await publishVoiceParticipant();
    for (const remoteUid of Object.keys(voiceParticipantsCache)) {
        await createVoiceOfferFor(remoteUid);
    }
    showToast('Микрофон включен');
}

async function disableMicrophoneNative({ notify = true } = {}) {
    cleanupAllConnections();
    if (currentRoomId && auth.currentUser) {
        try { await remove(ref(db, `rooms/${currentRoomId}/rtc/participants/${auth.currentUser.uid}`)); } catch (e) {}
    }
    $('mic-btn')?.classList.remove('active');
    if (notify) showToast('Микрофон выключен');
}

// ==========================================
// --- AMBILIGHT И ВИЗУАЛ ---
// ==========================================

const ambiCanvas = $('ambilight-canvas');
const ambiCtx = ambiCanvas?.getContext('2d', { willReadFrequently: true });

function drawAmbilight() {
    if (currentRoomId && player && !player.paused && !player.ended && ambiCanvas && ambiCtx) {
        ambiCanvas.width = player.clientWidth / 10 || 1;
        ambiCanvas.height = player.clientHeight / 10 || 1;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
}

if (player) {
    player.addEventListener('play', () => drawAmbilight());
}

// Нейросетевой фон
const particleCanvas = $('particle-canvas');
if (particleCanvas) {
    const ctx = particleCanvas.getContext('2d');
    let dots = [];
    
    function resizeCanvas() { 
        particleCanvas.width = window.innerWidth; 
        particleCanvas.height = window.innerHeight; 
    }
    window.onresize = resizeCanvas; 
    resizeCanvas();
    
    class Dot {
        constructor() { 
            this.x = Math.random() * particleCanvas.width; 
            this.y = Math.random() * particleCanvas.height; 
            this.vx = (Math.random() - 0.5) * 0.5; 
            this.vy = (Math.random() - 0.5) * 0.5; 
        }
        draw() {
            this.x += this.vx; 
            this.y += this.vy;
            if (this.x < 0 || this.x > particleCanvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > particleCanvas.height) this.vy *= -1;
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.beginPath(); 
            ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2); 
            ctx.fill();
        }
    }
    
    for (let i = 0; i < 80; i++) {
        dots.push(new Dot());
    }
    
    function animateParticles() {
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        dots.forEach(d => {
            d.draw();
            dots.forEach(d2 => {
                let dist = Math.sqrt((d.x - d2.x)**2 + (d.y - d2.y)**2);
                if (dist < 120) {
                    ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist / 600})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath(); 
                    ctx.moveTo(d.x, d.y); 
                    ctx.lineTo(d2.x, d2.y); 
                    ctx.stroke();
                }
            });
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

// ==========================================
// --- ИНИЦИАЛИЗАЦИЯ (ONLOAD) ---
// ==========================================

window.onload = () => {
    bindAuth(); // Для legacy кнопок
};

if ($('btn-open-room-invite')) {
    $('btn-open-room-invite').onclick = openRoomInviteModalFinal;
}

if ($('btn-room-invite-close')) {
    $('btn-room-invite-close').onclick = closeRoomInviteModal;
}

if ($('modal-room-invite')) {
    $('modal-room-invite').addEventListener('click', (event) => {
        if (event.target.id === 'modal-room-invite') closeRoomInviteModal();
    });
}