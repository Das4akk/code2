import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove, off, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

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

const $ = (id) => document.getElementById(id);
// Безопасное экранирование текста для вставки в innerHTML
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}

// Кэш комнат (используется для поиска/фильтрации)
let roomsCache = {};
// Временная метка входа в комнату — чтобы не показывать старые тосты
let roomEnteredAt = 0;
// --- Криптографические утилиты для приватных комнат ---
function bufToBase64(buf){
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function base64ToBuf(b64){
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
function genSalt(len=16){
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return bufToBase64(a.buffer);
}
async function deriveKey(password, saltBase64, iterations=10000){
    const enc = new TextEncoder();
    const salt = base64ToBuf(saltBase64);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations, hash:'SHA-256'}, keyMaterial, 256);
    return bufToBase64(derivedBits);
}
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); if($(id)) $(id).classList.add('active'); }

// --- УЛУЧШЕННЫЕ ТОСТЫ ---
function showToast(message) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- WebRTC Инициализация ---
const peer = new Peer(undefined, { host: '0.peerjs.com', port: 443, secure: true });
let currentRoomId = null;
let isHost = false;
let myStream = null;
let activeCalls = new Set();
let roomListenerUnsubscribe = null;
let isRemoteAction = false;
let lastSyncTs = 0;
let processedMsgs = new Set(); // Защита от дублей сообщений
let editingRoomId = null; // Если установлено - модал создания используется для редактирования
// URL для репорт-формы (оставьте пустым, чтобы отключить кнопку Report)
const REPORT_FORM_URL = '';

setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) {
            showScreen('lobby-screen');
            // Загрузка уведомлений о друзьях и инвайтах в лобби
            setupLobbyNotifications();
        }
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
});

// Авторизация
$('tab-login').onclick = () => { $('form-login').classList.add('active-form'); $('form-login').classList.remove('hidden-form', 'left'); $('form-register').classList.add('hidden-form', 'right'); $('form-register').classList.remove('active-form'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
$('tab-register').onclick = () => { $('form-register').classList.add('active-form'); $('form-register').classList.remove('hidden-form', 'right'); $('form-login').classList.add('hidden-form', 'left'); $('form-login').classList.remove('active-form'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };

$('btn-login-email').onclick = async () => { try { await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-register-email').onclick = async () => { try { const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); await updateProfile(res.user, { displayName: $('reg-name').value }); $('user-display-name').innerText = $('reg-name').value; } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-google-auth').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { showToast("Ошибка Google"); } };
$('btn-logout').onclick = () => signOut(auth);

// Лобби
$('btn-open-modal').onclick = () => { editingRoomId = null; $('modal-create').classList.add('active'); };
$('btn-close-modal').onclick = () => { editingRoomId = null; $('modal-create').classList.remove('active'); if ($('room-password')) $('room-password').value = ''; if ($('room-private')) $('room-private').checked = false; };

$('btn-delete-all-rooms').onclick = async () => {
    if(confirm("ВНИМАНИЕ! Вы удалите ВСЕ комнаты. Продолжить?")) {
        await remove(ref(db, 'rooms'));
        showToast("Все комнаты удалены.");
    }
};

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return showToast("Заполни поля!");
    const isPrivate = $('room-private') ? $('room-private').checked : false;
    const password = $('room-password') ? $('room-password').value : '';
    const preview = $('room-preview') ? $('room-preview').value : '';
    const buttonColor = $('room-button-color') ? $('room-button-color').value : '';

    // Если редактирование существующей комнаты
    if (editingRoomId) {
        const prev = roomsCache[editingRoomId] || {};
        const updateData = { name, link, preview, buttonColor };
        if (isPrivate) {
            if (password && password.length >= 4) {
                try {
                    const salt = genSalt(16);
                    const pwHash = await deriveKey(password, salt);
                    updateData.private = true;
                    updateData.pwSalt = salt;
                    updateData.pwHash = pwHash;
                } catch (e) { return showToast('Ошибка при установке пароля'); }
            } else if (prev.private) {
                // сохраняем старый хеш если пароль не поменяли
                updateData.private = true;
                updateData.pwSalt = prev.pwSalt;
                updateData.pwHash = prev.pwHash;
            } else {
                // поставить приватность, но без пароля — не позволяем
                return showToast('Укажите пароль для приватной комнаты (мин 4 символа)');
            }
        } else {
            // Снимаем приватность — удаляем поля
            updateData.private = null;
            updateData.pwSalt = null;
            updateData.pwHash = null;
        }

        try {
            await update(ref(db, `rooms/${editingRoomId}`), updateData);
            showToast('Комната обновлена');
            editingRoomId = null;
            $('modal-create').classList.remove('active');
        } catch (e) { showToast('Ошибка при обновлении комнаты'); }

        return;
    }

    // Создание новой комнаты
    const newRoomRef = push(ref(db, 'rooms'));
    const roomData = { name, link, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User", preview, buttonColor };
    if (isPrivate) {
        if (!password || password.length < 4) return showToast('Пароль должен быть минимум 4 символа');
        try {
            const salt = genSalt(16);
            const pwHash = await deriveKey(password, salt);
            roomData.private = true;
            roomData.pwSalt = salt;
            roomData.pwHash = pwHash;
        } catch (e) {
            return showToast('Ошибка при установке пароля');
        }
    }
    await set(newRoomRef, roomData);
    $('modal-create').classList.remove('active');
    // очистим поля
    if ($('room-password')) $('room-password').value = '';
    if ($('room-private')) $('room-private').checked = false;
    enterRoom(newRoomRef.key, name, link, auth.currentUser.uid);
};

function renderRooms(filter = '') {
    const grid = $('rooms-grid');
    grid.innerHTML = '';
    const data = roomsCache || {};
    const q = String(filter || '').trim().toLowerCase();
    const keys = Object.keys(data);
    if (!keys.length) {
        grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>';
        return;
    }
    keys.forEach(id => {
        const room = data[id];
        const name = room.name || '';
        const host = room.adminName || '';
        if (q) {
            const hay = (name + ' ' + host).toLowerCase();
            if (!hay.includes(q)) return;
        }
        // Используем JSON.stringify чтобы корректно экранировать аргументы для onclick
        const lock = room.private ? '🔒 ' : '';
        const previewStyle = room.preview ? `background-image: url(${JSON.stringify(room.preview)});` : '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
        grid.innerHTML += `\n            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(room.link || '')}, ${JSON.stringify(room.admin || '')})'>\n                ${colorDot}\n                <div class="room-thumb" style="${previewStyle}"></div>\n                <h4>${lock + escapeHtml(name)}</h4>\n                <p style=\"font-size:12px; opacity:0.6; margin-top:5px;\">Хост: ${escapeHtml(host)}</p>\n            </div>`;
    });
}

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        roomsCache = snap.val() || {};
        // сразу отрендерим с учётом текущего поиска
        const si = $('search-rooms');
        renderRooms(si ? si.value : '');
    });
    // Подписка на ввод поиска (легкий debounce)
    const search = $('search-rooms');
    if (search) {
        let t = null;
        search.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => renderRooms(e.target.value), 120);
        });
    }
    // Управление видимостью поля пароля в модалке
    const rp = $('room-private');
    const rpwd = $('room-password');
    if (rp && rpwd) {
        rp.addEventListener('change', () => { rpwd.style.display = rp.checked ? 'block' : 'none'; });
    }
}

// --- УВЕДОМЛЕНИЯ В ЛОББИ: приглашения друзей и в комнаты ---
function setupLobbyNotifications() {
    // Загрузка и отображение списка друзей
    const btnToggleFriends = $('btn-toggle-friends');
    const friendsPanel = $('friends-list-panel');
    
    if (btnToggleFriends && friendsPanel) {
        btnToggleFriends.onclick = () => {
            const isHidden = friendsPanel.style.display === 'none';
            friendsPanel.style.display = isHidden ? 'block' : 'none';
            
            if (isHidden) {
                // Загружаем друзей
                let friendsList = new Set();
                onValue(ref(db, `users/${auth.currentUser.uid}/friends`), (snap) => {
                    friendsList.clear();
                    friendsPanel.innerHTML = '<h3>👥 Друзья</h3>';
                    
                    if (!snap.val()) {
                        friendsPanel.innerHTML += '<div style="padding:12px; opacity:0.6; font-size:12px;">Нет друзей</div>';
                        return;
                    }
                    
                    Object.keys(snap.val()).forEach(fuid => {
                        const fdata = snap.val()[fuid];
                        if (fdata === true || (fdata && fdata.status === 'accepted')) {
                            friendsList.add(fuid);
                            // Загружаем информацию о друге из профиля
                            onValue(ref(db, `users/${fuid}/profile`), (psnap) => {
                                const profile = psnap.val() || {};
                                const friendName = profile.name || 'User';
                                const friendColor = profile.color || '#f5f7fa';
                                
                                let html = `<div class="friend-card" data-fuid="${fuid}">`;
                                html += `<div style="width:24px; height:24px; border-radius:50%; background: linear-gradient(45deg, ${escapeHtml(friendColor)}, rgba(255,255,255,0.1)); border: 1px solid rgba(255,255,255,0.1);"></div>`;
                                html += `<strong>${escapeHtml(friendName)}</strong>`;
                                html += `<button class="friend-dm-btn" data-fuid="${fuid}">💬</button>`;
                                html += `</div>`;
                                
                                let existing = friendsPanel.querySelector(`[data-fuid="${fuid}"]`);
                                if (!existing) {
                                    // Вставляем новую карточку после заголовка
                                    const h3 = friendsPanel.querySelector('h3');
                                    if (h3) {
                                        const div = document.createElement('div');
                                        div.innerHTML = html;
                                        h3.parentNode.insertBefore(div.firstElementChild, h3.nextSibling);
                                    }
                                }
                            }, { onlyOnce: true });
                        }
                    });
                }, { onlyOnce: true });
                
                // Обработчики DM кнопок
                setTimeout(() => {
                    document.querySelectorAll('.friend-dm-btn').forEach(b => {
                        b.onclick = (e) => {
                            e.stopPropagation();
                            const fuid = b.dataset.fuid;
                            showToast('💬 Открываю чат...');
                        };
                    });
                }, 100);
            }
        };
    }
    
    // Приглашения в комнату
    onChildAdded(ref(db, `users/${auth.currentUser.uid}/room-invites`), (snap) => {
        const invite = snap.val();
        const inviteId = snap.key;
        if (!invite || Date.now() - invite.ts > 3600000) return; // Игнорируем старые инвайты (>1ч)
        
        const link = `<button class="invite-accept-btn" data-room-id="${invite.roomId}" data-invite-id="${inviteId}" style="background:linear-gradient(135deg,#2ed573,#22c55e); border:none; padding:8px 16px; border-radius:8px; color:#fff; font-weight:600; cursor:pointer; margin:5px 0;">Зайти в комнату</button>`;
        const Toast_html = `<div style="padding:12px; background:rgba(46,213,115,0.1); border: 1px solid #2ed573; border-radius:8px; margin:5px 0;">${escapeHtml(invite.invitedBy)} приглашает: <strong>${escapeHtml(invite.roomName)}</strong><br>${link}</div>`;
        
        const container = $('toast-container');
        const notif = document.createElement('div');
        notif.innerHTML = Toast_html;
        container.appendChild(notif);
        
        // Обработчик кнопки
        const btn = notif.querySelector('.invite-accept-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const roomId = btn.dataset.roomId;
                const iid = btn.dataset.inviteId;
                // Удаляем инвайт и заходим в комнату
                try {
                    await remove(ref(db, `users/${auth.currentUser.uid}/room-invites/${iid}`));
                    if (roomsCache[roomId]) {
                        window.joinRoom(roomId, roomsCache[roomId].name, roomsCache[roomId].link, roomsCache[roomId].admin);
                    }
                } catch (e) { showToast('Ошибка'); }
            });
        }
        
        setTimeout(() => notif.remove(), 5000);
    });
    
    // Запросы друзей
    onChildAdded(ref(db, `users/${auth.currentUser.uid}/friend-requests`), (snap) => {
        const req = snap.val();
        const fromUid = snap.key;
        if (!req) return;
        
        const acceptBtn = `<button class="friend-req-accept" data-from-uid="${fromUid}" style="background:#2ed573; border:none; padding:6px 12px; border-radius:6px; color:#000; font-weight:600; cursor:pointer; margin-right:5px;">Принять</button>`;
        const declineBtn = `<button class="friend-req-decline" data-from-uid="${fromUid}" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding:6px 12px; border-radius:6px; color:#fff; cursor:pointer;">Отклонить</button>`;
        const Toast_html = `<div style="padding:12px; background:rgba(46,213,115,0.1); border: 1px solid #2ed573; border-radius:8px; margin:5px 0;"><strong>${escapeHtml(req.from)}</strong> хочет быть твоим другом<br>${acceptBtn}${declineBtn}</div>`;
        
        const container = $('toast-container');
        const notif = document.createElement('div');
        notif.innerHTML = Toast_html;
        container.appendChild(notif);
        
        // Обработчики кнопок
        const acceptB = notif.querySelector('.friend-req-accept');
        const declineB = notif.querySelector('.friend-req-decline');
        if (acceptB) {
            acceptB.addEventListener('click', async () => {
                const uid = acceptB.dataset.fromUid;
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${uid}`), { status: 'accepted', ts: Date.now() });
                    await set(ref(db, `users/${uid}/friends/${auth.currentUser.uid}`), { status: 'accepted', ts: Date.now() });
                    await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${uid}`));
                    showToast('Друг добавлен!');
                    notif.remove();
                } catch (e) { showToast('Ошибка'); }
            });
        }
        if (declineB) {
            declineB.addEventListener('click', async () => {
                const uid = declineB.dataset.fromUid;
                try {
                    await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${uid}`));
                    notif.remove();
                } catch (e) { showToast('Ошибка'); }
            });
        }
        
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 8000);
    });
}
let pendingJoin = null;
window.joinRoom = (id, name, link, admin) => {
    const room = roomsCache[id] || null;
    if (room && room.private) {
        // Открываем модал ввода пароля
        pendingJoin = { id, name, link, admin };
        const m = $('modal-join');
        const inp = $('join-password');
        if (inp) inp.value = '';
        if (m) { m.classList.add('active'); setTimeout(() => inp && inp.focus(), 120); }
        return;
    }
    return enterRoom(id, name, link, admin);
};

const player = $('native-player');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    processedMsgs.clear(); // Очистка при входе в новую комнату
    isHost = (auth.currentUser.uid === adminId);
    $('room-title-text').innerText = name;
    player.src = link;
    // Устанавливаем превью комнаты как фон плеера, если есть
    const roomMeta = roomsCache[roomId] || {};
    const pw = $('player-wrapper');
    if (pw) {
        if (roomMeta.preview) {
            pw.style.backgroundImage = `url(${roomMeta.preview})`;
            pw.style.backgroundSize = 'cover';
            pw.style.backgroundPosition = 'center';
        } else {
            pw.style.backgroundImage = '';
        }
    }
    $('chat-messages').innerHTML = ''; 
    
    // ПРАВА ДОСТУПА: Хост управляет, зритель только смотрит
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";
    
    showScreen('room-screen');
    // Фикс: помечаем время входа, чтобы не показывать старые уведомления
    roomEnteredAt = Date.now();
    initRoomServices();
    // Показ/логика кнопки удаления комнаты (только для хоста)
    const delBtn = $('btn-delete-room');
    const editBtn = $('btn-edit-room');
    if (delBtn) {
        delBtn.style.display = isHost ? 'inline-block' : 'none';
        delBtn.onclick = async () => {
            if (!isHost) return;
            if (!confirm('ВНИМАНИЕ! Удалить эту комнату навсегда?')) return;
            try {
                await remove(ref(db, `rooms/${currentRoomId}`));
                showToast('Комната удалена');
                leaveRoom();
            } catch (e) {
                showToast('Ошибка удаления комнаты');
            }
        };
    }
    if (editBtn) {
        editBtn.style.display = isHost ? 'inline-block' : 'none';
        editBtn.onclick = () => {
            if (!isHost) return;
            editingRoomId = currentRoomId;
            const meta = roomsCache[currentRoomId] || {};
            if ($('room-name')) $('room-name').value = meta.name || '';
            if ($('room-link')) $('room-link').value = meta.link || '';
            if ($('room-preview')) $('room-preview').value = meta.preview || '';
            if ($('room-button-color')) $('room-button-color').value = meta.buttonColor || '#ffffff';
            if ($('room-private')) {
                $('room-private').checked = !!meta.private;
                $('room-password').style.display = $('room-private').checked ? 'block' : 'none';
            }
            if ($('room-password')) $('room-password').value = '';
            $('modal-create').classList.add('active');
        };
    }
    showToast(isHost ? "Вы зашли как Хост" : "Вы зашли как Зритель");
}

function leaveRoom() {
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) { try { roomListenerUnsubscribe(); } catch(e) {} roomListenerUnsubscribe = null; }
    player.pause(); player.src = '';
    if (myStream) { myStream.getTracks().forEach(t => t.stop()); myStream = null; $('mic-btn').classList.remove('active'); }
    $('remote-audio-container').innerHTML = '';
    activeCalls.clear();
    const delBtn = $('btn-delete-room'); if (delBtn) delBtn.style.display = 'none';
    const editBtn = $('btn-edit-room'); if (editBtn) editBtn.style.display = 'none';
    // Скрываем модалки на случай открытых
    const jm = $('modal-join'); if (jm) jm.classList.remove('active');
    presenceRef = null;
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = leaveRoom;

// --- AMBILIGHT ---
const ambiCanvas = $('ambilight-canvas');
const ambiCtx = ambiCanvas.getContext('2d', { willReadFrequently: true });
function drawAmbilight() {
    if (currentRoomId && !player.paused && !player.ended) {
        ambiCanvas.width = player.clientWidth / 10;
        ambiCanvas.height = player.clientHeight / 10;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
}
player.addEventListener('play', () => drawAmbilight());

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    const reactionsRef = ref(db, `rooms/${currentRoomId}/reactions`);

    // Слушатель комнаты — проверяем существование и сохраняем функцию отписки
    const _roomRef = ref(db, `rooms/${currentRoomId}`);
    const _roomListener = (snap) => { if (!snap.exists() && currentRoomId) { showToast("Комната удалена"); leaveRoom(); } };
    onValue(_roomRef, _roomListener);
    roomListenerUnsubscribe = () => { try { off(_roomRef, 'value', _roomListener); } catch(e) {} };

    $('btn-fullscreen').onclick = () => $('player-wrapper').requestFullscreen();

    // Присутствие
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    // Значения прав по умолчанию (хост получает контроль плеера)
    const defaultPerms = { chat: true, voice: true, player: isHost, reactions: true };
    set(presenceRef, { name: auth.currentUser.displayName || "User", perms: defaultPerms });
    onDisconnect(presenceRef).remove(); 

    // Загрузка списка друзей (синхронно через onValue)
    let friends = new Set();
    onValue(ref(db, `users/${auth.currentUser.uid}/friends`), (snap) => {
        friends.clear();
        if (snap.val()) {
            Object.keys(snap.val()).forEach(fuid => {
                const fdata = snap.val()[fuid];
                if (fdata === true || (fdata && fdata.status === 'accepted')) friends.add(fuid);
            });
        }
    }, { onlyOnce: true });

    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        const usersListEl = $('users-list');
        usersListEl.innerHTML = '';
        const ids = Object.keys(data);
        $('users-count').innerText = ids.length;

        const adminId = (roomsCache[currentRoomId] && roomsCache[currentRoomId].admin) ? roomsCache[currentRoomId].admin : null;

        ids.forEach(uid => {
            const u = data[uid] || {};
            const name = escapeHtml(u.name || 'User');
            const perms = u.perms || defaultPerms;
            const isLocal = uid === auth.currentUser.uid;
            const isUserHost = uid === adminId;
            const isFriend = friends.has(uid);

            let itemHtml = `<div class="user-item" data-uid="${uid}">`;
            itemHtml += `<div class="indicator"></div>`;
            itemHtml += `<div class="user-main"><span class="user-name">${isFriend ? '👥 ' : ''}${name}</span>`;
            if (isUserHost) itemHtml += `<span class="host-label">Host</span>`;
            if (isFriend && !isLocal) itemHtml += `<span class="friend-label">Друг</span>`;
            if (isLocal) itemHtml += `<span class="you-label">(Вы)</span>`;
            itemHtml += `</div>`;

            // Кнопка личных сообщений (для друзей)
            if (!isLocal && isFriend) {
                itemHtml += `<button class="dm-btn" data-uid="${uid}" title="Direct Message">💬</button>`;
            }
            // Кнопка репорта (для всех, кроме себя)
            if (!isLocal) {
                itemHtml += `<button class="report-btn" data-uid="${uid}" title="Report">Report</button>`;
            }
            // Кнопка добавления в друзья (для всех, кроме себя и уже друзей)
            if (!isLocal && !isFriend) {
                itemHtml += `<button class="add-friend-btn" data-uid="${uid}" title="Add Friend">+Доб</button>`;
            }
            // Кнопка инвайта в комнату (для всех, кроме себя)
            if (!isLocal) {
                itemHtml += `<button class="invite-btn" data-uid="${uid}" title="Invite to room">Инв</button>`;
            }

            itemHtml += `</div>`;
            usersListEl.innerHTML += itemHtml;
        });

        // Подписываемся на переключатели прав (если хост)
        if (isHost) {
            document.querySelectorAll('.perm-toggle').forEach(el => {
                el.addEventListener('change', async (e) => {
                    const uid = e.target.dataset.uid;
                    const perm = e.target.dataset.perm;
                    const val = e.target.checked;
                    try {
                        await set(ref(db, `rooms/${currentRoomId}/presence/${uid}/perms/${perm}`), val);
                        showToast('Права обновлены');
                    } catch (err) { showToast('Ошибка при обновлении прав'); }
                });
            });
        }

        // Кнопки репорта
        document.querySelectorAll('.report-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const uid = e.target.dataset.uid;
                if (!REPORT_FORM_URL) { showToast('Форма для репортов не настроена'); return; }
                window.open(REPORT_FORM_URL + '?reported=' + encodeURIComponent(uid), '_blank');
            });
        });

        // Кнопки добавления в друзья
        document.querySelectorAll('.add-friend-btn').forEach(b => {
            b.addEventListener('click', async (e) => {
                const uid = e.target.dataset.uid;
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${uid}`), { status: 'pending', ts: Date.now() });
                    await set(ref(db, `users/${uid}/friend-requests/${auth.currentUser.uid}`), { from: auth.currentUser.displayName, ts: Date.now() });
                    showToast('Запрос отправлен');
                } catch (err) { showToast('Ошибка при отправке запроса'); }
            });
        });

        // Кнопки инвайта в комнату
        document.querySelectorAll('.invite-btn').forEach(b => {
            b.addEventListener('click', async (e) => {
                const uid = e.target.dataset.uid;
                try {
                    await push(ref(db, `users/${uid}/room-invites`), {
                        roomId: currentRoomId,
                        roomName: roomsCache[currentRoomId]?.name || 'Комната',
                        invitedBy: auth.currentUser.displayName,
                        message: `Привет! Заходи к нам в комнату!`,
                        ts: Date.now()
                    });
                    showToast('Инвайт отправлен');
                } catch (err) { showToast('Ошибка при отправке инвайта'); }
            });
        });

        // Кнопки личных сообщений
        document.querySelectorAll('.dm-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const uid = e.target.dataset.uid;
                const userData = data[uid] || {};
                const friendName = escapeHtml(userData.name || 'User');
                showToast(`💬 ДМ с ${friendName}...`);
                // TODO: Реализовать полный UI для ДМ чата
            });
        });

        // Применяем локальные права (для текущего пользователя)
        const localNode = data[auth.currentUser.uid] || {};
        const effectiveLocalPerms = isHost ? { chat: true, voice: true, player: true, reactions: true } : (localNode.perms || defaultPerms);

        // Чат
        if ($('chat-input')) $('chat-input').disabled = !effectiveLocalPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !effectiveLocalPerms.chat;

        // Голос
        if (!effectiveLocalPerms.voice) {
            if (myStream) { myStream.getTracks().forEach(t => t.stop()); myStream = null; $('mic-btn').classList.remove('active'); try { remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`)); } catch(e){} activeCalls.clear(); $('remote-audio-container').innerHTML = ''; showToast('Вам отключили голос'); }
        }
        if ($('mic-btn')) $('mic-btn').disabled = !effectiveLocalPerms.voice;

        // Плеер
        if (effectiveLocalPerms.player || isHost) { player.style.pointerEvents = 'auto'; player.controls = true; } else { player.style.pointerEvents = 'none'; player.controls = isHost; }

        // Реакции
        document.querySelectorAll('.react-btn').forEach(b => b.disabled = !effectiveLocalPerms.reactions);
    });

    // --- ХИРУРГИЧЕСКАЯ СИНХРОНИЗАЦИЯ (Только хост отправляет данные) ---
    if (isHost) {
        player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
        player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
        player.onseeked = () => { if(!isRemoteAction) set(videoRef, { type: 'seek', time: player.currentTime, ts: Date.now() }); };
    }

    onValue(videoRef, (snap) => {
        if (isHost) return; // Хост никогда не принимает синхронизацию от других
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        
        if (Math.abs(player.currentTime - d.time) > 2) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        
        setTimeout(() => isRemoteAction = false, 500);
    });

    // --- ЧАТ И ТАЙМКОДЫ ---
    // Экранируем текст перед вставкой и затем подменяем паттерны таймкодов
    const parseTimecodes = (text) => escapeHtml(text).replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    
    const sendMsg = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { push(chatRef, { user: auth.currentUser.displayName, content: inp.value.trim(), ts: Date.now() }); inp.value = ''; }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };
    
    $('chat-messages').onclick = (e) => {
        if(e.target.classList.contains('timecode-btn')) {
            const parts = e.target.dataset.time.split(':');
            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            player.currentTime = seconds;
            // Если нажал хост - мотаем у всех
            if(isHost) {
                player.play();
                set(videoRef, { type: 'seek', time: seconds, ts: Date.now() });
            }
        }
    };

    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const id = snap.key;
        if (processedMsgs.has(id)) return; // Защита от дублей
        processedMsgs.add(id);

        const isMe = m.user === auth.currentUser.displayName;
        const div = document.createElement('div');
        div.className = isMe ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${escapeHtml(m.user || 'User')}</strong><p>${parseTimecodes(m.content || '')}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
        // Показываем тост только для новых сообщений (после входа в комнату)
        if (!isMe && m.ts && m.ts >= (roomEnteredAt - 2000)) {
            showToast(`Сообщение от ${escapeHtml(m.user || 'User')}`);
        }
    });

    // Табы чата
    $('tab-chat-btn').onclick = () => { $('chat-messages').style.display='flex'; $('users-list').style.display='none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); };
    $('tab-users-btn').onclick = () => { $('users-list').style.display='flex'; $('chat-messages').style.display='none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); };

    // Реакции
    document.querySelectorAll('.react-btn').forEach(btn => {
        btn.onclick = () => push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
    });
    onChildAdded(reactionsRef, (snap) => {
        const data = snap.val();
        if(Date.now() - data.ts > 5000) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = data.emoji;
        el.style.left = Math.random() * 80 + 10 + '%';
        $('reaction-layer').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    });

    // --- ГОЛОС (WebRTC) с визуализацией входящего звука ---
    const remoteAudioAnalyzers = new Map(); // uid -> { analyser, dataArray, animationId }
    
    function createRemoteAudioAnalyzer(audio, uid) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementAudioSource(audio);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animId = null;
        
        const userItem = document.querySelector(`.user-item[data-uid="${uid}"]`);
        if (!userItem) return;
        
        const animate = () => {
            analyser.getByteFrequencyData(dataArray);
            let avg = 0;
            for (let i = 0; i < dataArray.length; i++) avg += dataArray[i];
            avg /= dataArray.length;
            
            const vol = avg / 256;
            const scale = 1 + (vol * 0.4);
            const glow = vol * 20;
            
            const indicator = userItem.querySelector('.indicator');
            if (indicator && vol > 0.05) {
                indicator.style.transform = `scale(${scale})`;
                indicator.style.boxShadow = `0 0 ${glow}px #2ed573`;
            } else if (indicator) {
                indicator.style.transform = 'scale(1)';
                indicator.style.boxShadow = '0 0 8px #2ed573';
            }
            
            animId = requestAnimationFrame(animate);
        };
        
        animate();
        remoteAudioAnalyzers.set(uid, { analyser, dataArray, animationId: animId });
    }
    
    function attachRemoteAudio(stream, peerId, uid) {
        if (activeCalls.has(peerId)) return;
        activeCalls.add(peerId);
        const audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.autoplay = true;
        audio.srcObject = stream;
        audio.volume = $('voice-volume').value;
        $('remote-audio-container').appendChild(audio);
        
        // Создаём анализатор входящего звука для этого пользователя
        audio.oncanplay = () => createRemoteAudioAnalyzer(audio, uid);
    }

    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, call.peer, call.peer));
    });

    $('mic-btn').onclick = async function() {
        const isActive = this.classList.toggle('active');
        if (isActive) {
            try {
                myStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                if (peer.id) set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
                showToast("Микрофон включен");
                // НЕ запускаем визуализацию для собственного микрофона
            } catch (e) { showToast("Ошибка доступа к микрофону"); this.classList.remove('active'); }
        } else {
            if (myStream) myStream.getTracks().forEach(t => t.stop());
            myStream = null;
            remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
            activeCalls.clear();
            $('remote-audio-container').innerHTML = '';
            remoteAudioAnalyzers.forEach(a => { if (a.animationId) cancelAnimationFrame(a.animationId); });
            remoteAudioAnalyzers.clear();
            showToast("Микрофон выключен");
        }
    };

    onValue(voiceRef, (snap) => {
        const data = snap.val() || {};
        for (let uid in data) {
            const targetPeerId = data[uid];
            if (uid !== auth.currentUser.uid && myStream && !activeCalls.has(targetPeerId)) {
                const call = peer.call(targetPeerId, myStream);
                call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, targetPeerId, uid));
            }
        }
    });

    const voiceEl = $('voice-volume');
    const setRangeFill = (el) => {
        if (!el) return;
        const v = parseFloat(el.value) || 0;
        const p = Math.round(v * 100);
        const accent = (typeof getComputedStyle !== 'undefined') ? getComputedStyle(document.documentElement).getPropertyValue('--accent') : '#f5f7fa';
        el.style.background = `linear-gradient(90deg, ${accent.trim()} ${p}%, rgba(255,255,255,0.12) ${p}%)`;
    };
    if (voiceEl) {
        voiceEl.addEventListener('input', (e) => {
            document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = e.target.value);
            setRangeFill(e.target);
        });
        setRangeFill(voiceEl);
    }
    // ... (начало кода без изменений до момента с микрофоном)

    // --- НЕЙРОСЕТЕВОЙ ФОН ---
}
// --- МОДАЛЫ: вход в приватную комнату и поведение поля пароля при создании ---
(function setupModals(){
    const joinConfirm = $('btn-join-confirm');
    const joinCancel = $('btn-join-cancel');
    const joinModal = $('modal-join');
    const joinPwdInput = $('join-password');

    if (joinConfirm) {
        joinConfirm.onclick = async () => {
            if (!pendingJoin) return;
            const room = roomsCache[pendingJoin.id];
            if (!room) { showToast('Комната недоступна'); pendingJoin = null; joinModal.classList.remove('active'); return; }
            const pw = (joinPwdInput && joinPwdInput.value) ? joinPwdInput.value : '';
            try {
                const derived = await deriveKey(pw, room.pwSalt);
                if (derived === room.pwHash) {
                    joinModal.classList.remove('active');
                    const { id, name, link, admin } = pendingJoin;
                    pendingJoin = null;
                    enterRoom(id, name, link, admin);
                } else {
                    showToast('Неверный пароль');
                }
            } catch (e) { showToast('Ошибка проверки пароля'); }
        };
    }
    if (joinCancel) {
        joinCancel.onclick = () => { pendingJoin = null; if (joinModal) joinModal.classList.remove('active'); };
    }
    if (joinPwdInput) {
        joinPwdInput.onkeydown = (e) => { if (e.key === 'Enter') { const c = $('btn-join-confirm'); c && c.click(); } };
    }

    // Тоггл для поля пароля при создании комнаты — добавляем здесь тоже, чтобы поле точно работало
    const rp = $('room-private');
    const rpwd = $('room-password');
    if (rp && rpwd) {
        // начально скрываем если не отмечено
        rpwd.style.display = rp.checked ? 'block' : 'none';
        rp.addEventListener('change', () => { rpwd.style.display = rp.checked ? 'block' : 'none'; if (rp.checked) rpwd.focus(); });
    }
})();

// --- МОДАЛКА: профиль пользователя ---
(function setupProfile(){
    const btnOpen = $('btn-edit-profile');
    const modal = $('modal-profile');
    const inpName = $('profile-name');
    const inpColor = $('profile-color');
    const btnSave = $('btn-profile-save');
    const btnCancel = $('btn-profile-cancel');

    if (btnOpen) {
        btnOpen.onclick = () => {
            if (!auth.currentUser) return showToast('Нужно войти');
            if (inpName) inpName.value = auth.currentUser.displayName || '';
            if (inpColor) inpColor.value = '#f5f7fa';
            if (modal) modal.classList.add('active');
        };
    }
    if (btnCancel) btnCancel.onclick = () => { if (modal) modal.classList.remove('active'); };
    if (btnSave) btnSave.onclick = async () => {
        if (!auth.currentUser) return showToast('Нужно войти');
        const name = inpName ? inpName.value.trim() : '';
        const color = inpColor ? inpColor.value : '#f5f7fa';
        try {
            await updateProfile(auth.currentUser, { displayName: name });
            await set(ref(db, `users/${auth.currentUser.uid}/profile`), { name, color });
            if ($('user-display-name')) $('user-display-name').innerText = name || auth.currentUser.email;
            const av = $('my-avatar'); if (av) av.style.background = `linear-gradient(45deg, ${color}, rgba(255,255,255,0.06))`;
            if (modal) modal.classList.remove('active');
            showToast('Профиль сохранён');
        } catch (e) { showToast('Ошибка сохранения профиля'); }
    };
})();

// --- НЕЙРОСЕТЕВОЙ ФОН ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let dots = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();
class Dot {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0 || this.x>canvas.width) this.vx *= -1;
        if(this.y<0 || this.y>canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<80; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.draw();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 120) {
                ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/600})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();