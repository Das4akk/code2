import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, onChildAdded, onDisconnect, remove, off, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

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
// Debug: confirm module load and capture global errors/rejections
console.log('app.js loaded');
window.addEventListener('error', (e) => { try { console.error('Global error:', e && e.message, e && e.error); } catch (er) {} });
window.addEventListener('unhandledrejection', (e) => { try { console.error('Unhandled rejection:', e && e.reason); } catch (er) {} });
const createNoopPeerCall = () => ({ on: () => {}, close: () => {}, answer: () => {} });
const peer = (typeof window !== 'undefined' && typeof window.Peer === 'function')
    ? new window.Peer()
    : { id: null, on: () => {}, call: () => createNoopPeerCall() };

const $ = (id) => document.getElementById(id);
const player = $('native-player');
let roomsCache = {};
let currentRoomId = null;
let presenceRef = null;
let roomListenerUnsubscribe = null;
let myStream = null;
let isHost = false;
let isRemoteAction = false;
let lastSyncTs = 0;
let editingRoomId = null;
let pendingJoin = null;
let roomEnteredAt = 0;
let latestVoicePeers = {};
let currentPresenceCache = {};
let latestRoomPresenceData = {};
const activeCalls = new Map();
const processedMsgs = new Set();
const roomProfileSubscriptions = new Map();
const friendProfileSubscriptions = new Map();
const voicePeerConnections = new Map();
const REPORT_FORM_URL = '';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[char]));

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
        const previewTime = getRoomPreviewTime(room.sync || {});
        const roomLink = room.link || '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
        const previewContent = roomLink
            ? `<video class="room-thumb-video" muted playsinline preload="metadata" src="${escapeHtml(roomLink)}" data-seek-time="${previewTime}"></video><div class="room-thumb-label">Сейчас в плеере</div>`
            : `<div class="room-thumb-placeholder">Видео не задано</div>`;
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
            acceptB.onclick = async () => {
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${fromUid}`), { status: 'accepted', ts: Date.now() });
                    await set(ref(db, `users/${fromUid}/friends/${auth.currentUser.uid}`), { status: 'accepted', ts: Date.now() });
                    await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                    showToast('Друг добавлен');
                    notif.remove();
                } catch (e) { showToast('Ошибка'); }
            };
        }
        if (declineB) {
            declineB.onclick = async () => {
                try {
                    await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                    notif.remove();
                } catch (e) { showToast('Ошибка'); }
            };
        }
        setTimeout(() => notif.remove(), 8000);
    });
}
function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = auth.currentUser?.uid === adminId;
    lastSyncTs = 0;
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
    // Cleanup any previous room listeners to avoid duplicate handlers
    if (typeof roomListenerUnsubscribe === 'function') {
        try { roomListenerUnsubscribe(); } catch(e) {}
        roomListenerUnsubscribe = null;
    }
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
        if (!usersListEl) return;

        usersListEl.innerHTML = '';
        const ids = Object.keys(data);
        if ($('users-count')) $('users-count').innerText = ids.length;

        const adminId = (roomsCache[currentRoomId] && roomsCache[currentRoomId].admin) ? roomsCache[currentRoomId].admin : null;
        const frag = document.createDocumentFragment();

        ids.forEach(uid => {
            const u = data[uid] || {};
            const name = escapeHtml(u.name || 'User');
            const perms = u.perms || defaultPerms;
            const isLocal = uid === auth.currentUser.uid;
            const isUserHost = uid === adminId;
            const isFriend = friends.has(uid);

            const item = document.createElement('div');
            item.className = 'user-item';
            item.dataset.uid = uid;
            let inner = `<div class="indicator"></div>`;
            inner += `<div class="user-main"><span class="user-name">${isFriend ? '👥 ' : ''}${name}</span>`;
            if (isUserHost) inner += `<span class="host-label">Host</span>`;
            if (isFriend && !isLocal) inner += `<span class="friend-label">Друг</span>`;
            if (isLocal) inner += `<span class="you-label">(Вы)</span>`;
            inner += `</div>`;
            if (!isLocal && isFriend) inner += `<button class="dm-btn" data-uid="${uid}" title="Direct Message">💬</button>`;
            if (!isLocal) inner += `<button class="report-btn" data-uid="${uid}" title="Report">Report</button>`;
            if (!isLocal && !isFriend) inner += `<button class="add-friend-btn" data-uid="${uid}" title="Add Friend">+Доб</button>`;
            if (!isLocal) inner += `<button class="invite-btn" data-uid="${uid}" title="Invite to room">Инв</button>`;
            item.innerHTML = inner;
            if (!perms.voice) {
                const indicator = item.querySelector('.indicator');
                if (indicator) indicator.style.opacity = '0.35';
            }
            frag.appendChild(item);
        });

        usersListEl.appendChild(frag);

        // Delegated handlers
        usersListEl.onclick = async (e) => {
            const target = e.target;
            if (!target) return;
            if (target.classList.contains('report-btn')) {
                const uid = target.dataset.uid;
                if (!REPORT_FORM_URL) { showToast('Форма для репортов не настроена'); return; }
                window.open(REPORT_FORM_URL + '?reported=' + encodeURIComponent(uid), '_blank');
                return;
            }
            if (target.classList.contains('add-friend-btn')) {
                const uid = target.dataset.uid;
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${uid}`), { status: 'pending', ts: Date.now() });
                    await set(ref(db, `users/${uid}/friend-requests/${auth.currentUser.uid}`), { from: auth.currentUser.displayName, ts: Date.now() });
                    showToast('Запрос отправлен');
                } catch (err) { showToast('Ошибка при отправке запроса'); }
                return;
            }
            if (target.classList.contains('invite-btn')) {
                const uid = target.dataset.uid;
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
                return;
            }
            if (target.classList.contains('dm-btn')) {
                const uid = target.dataset.uid;
                const userData = data[uid] || {};
                const friendName = escapeHtml(userData.name || 'User');
                showToast(`💬 ДМ с ${friendName}...`);
                return;
            }
        };

        // Apply local permissions and UI state
        const localNode = data[auth.currentUser.uid] || {};
        const effectiveLocalPerms = isHost ? { chat: true, voice: true, player: true, reactions: true } : (localNode.perms || defaultPerms);

        if ($('chat-input')) $('chat-input').disabled = !effectiveLocalPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !effectiveLocalPerms.chat;

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

    onChildAdded(chatRef, (data) => {
    const msg = data.val();
    const isMe = msg.senderId === auth.currentUser.uid;
    const div = document.createElement('div');
    
    if (msg.isSystem) {
        div.className = 'chat-message system-log';
        div.innerHTML = `<span class="sys-text">${escapeHtml(msg.text)}</span>`;
    } else {
        div.className = `chat-message ${isMe ? 'self' : 'other'}`;
        div.innerHTML = `<div class="msg-author">${escapeHtml(msg.senderName)}</div>
                         <div class="msg-text">${escapeHtml(msg.text)}</div>`;
    }
    
    $('chat-messages').appendChild(div);
    $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
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

    const avColorBtn = $('avatar-type-color');
    const avSilBtn = $('avatar-type-silhouette');
    let avatarChoice = 'color';
    if (avColorBtn && avSilBtn) {
        avColorBtn.onclick = () => { avatarChoice = 'color'; avColorBtn.classList.add('active'); avSilBtn.classList.remove('active'); };
        avSilBtn.onclick = () => { avatarChoice = 'silhouette'; avSilBtn.classList.add('active'); avColorBtn.classList.remove('active'); };
    }

    if (btnOpen) {
        btnOpen.onclick = () => {
            if (!auth.currentUser) return showToast('Нужно войти');
            if (inpName) inpName.value = auth.currentUser.displayName || '';
            if (inpColor) inpColor.value = '#f5f7fa';
            // Попробуем загрузить текущий профиль, чтобы выставить аватар
            try {
                get(ref(db, `users/${auth.currentUser.uid}/profile`)).then((snap) => {
                    const profile = snap.val() || {};
                    if (profile.avatar === 'silhouette') { avatarChoice = 'silhouette'; avSilBtn?.classList.add('active'); avColorBtn?.classList.remove('active'); }
                    else { avatarChoice = 'color'; avColorBtn?.classList.add('active'); avSilBtn?.classList.remove('active'); }
                }).catch(() => {});
            } catch (e) {}
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
            await set(ref(db, `users/${auth.currentUser.uid}/profile`), { name, color, avatar: avatarChoice });
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
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.18; this.vy = (Math.random()-0.5)*0.18; }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0 || this.x>canvas.width) this.vx *= -1;
        if(this.y<0 || this.y>canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
}

for(let i=0; i<60; i++) dots.push(new Dot());
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

function renderRoomsV2(filter = '') {
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

    keys.forEach((id) => {
        const room = data[id] || {};
        const name = room.name || '';
        const host = room.adminName || '';
        if (q) {
            const hay = `${name} ${host}`.toLowerCase();
            if (!hay.includes(q)) return;
        }

        const roomLink = room.link || '';
        const previewTime = getRoomPreviewTime(room.sync || {});
        const lock = room.private ? '🔒 ' : '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
        const previewContent = roomLink
            ? `<video class="room-thumb-video" muted playsinline preload="metadata" src="${escapeHtml(roomLink)}" data-seek-time="${previewTime}"></video><div class="room-thumb-label">Сейчас в плеере</div>`
            : `<div class="room-thumb-placeholder">Видео не задано</div>`;

        grid.innerHTML += `
            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(roomLink)}, ${JSON.stringify(room.admin || '')})'>
                ${colorDot}
                <div class="room-thumb">${previewContent}</div>
                <h4>${lock + escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${escapeHtml(host)}</p>
            </div>`;
    });

    refreshRoomCardPreviews();
}

async function openRoomInviteModal() {
    if (!auth.currentUser || !currentRoomId) return;
    ensureRoomInviteUi();

    const modal = $('modal-room-invite');
    const list = $('room-invite-list');
    if (!modal || !list) return;

    modal.classList.add('active');
    list.innerHTML = '<div class="room-invite-empty">Загружаю друзей...</div>';

    try {
        const friendsSnap = await get(ref(db, `users/${auth.currentUser.uid}/friends`));
        const friendsData = friendsSnap.val() || {};
        const acceptedIds = Object.keys(friendsData).filter((uid) => uid !== auth.currentUser.uid && isAcceptedFriendRecord(friendsData[uid]));
        const presentIds = new Set(Object.keys(currentPresenceCache || {}));
        const inviteableIds = acceptedIds.filter((uid) => !presentIds.has(uid));

        if (!inviteableIds.length) {
            list.innerHTML = '<div class="room-invite-empty">Сейчас некого приглашать: либо друзей нет, либо они уже в комнате.</div>';
            return;
        }

        const friends = await Promise.all(inviteableIds.map(async (uid) => {
            try {
                const profileSnap = await get(ref(db, `users/${uid}/profile`));
                const profile = profileSnap.val() || {};
                return {
                    uid,
                    name: profile.name || 'User',
                    color: profile.color || '#f5f7fa'
                };
            } catch (e) {
                return { uid, name: 'User', color: '#f5f7fa' };
            }
        }));

        list.innerHTML = friends.map((friend) => `
            <div class="room-invite-card" data-uid="${friend.uid}">
                <div class="room-invite-user">
                    <div class="room-invite-avatar" style="background:linear-gradient(45deg, ${escapeHtml(friend.color)}, rgba(255,255,255,0.08));"></div>
                    <strong>${escapeHtml(friend.name)}</strong>
                </div>
                <button type="button" class="invite-friend-btn" data-uid="${friend.uid}">Позвать</button>
            </div>
        `).join('');

        list.querySelectorAll('.invite-friend-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                if (button.disabled) return;
                const uid = button.dataset.uid;
                const roomMeta = roomsCache[currentRoomId] || {};

                button.disabled = true;
                try {
                    await push(ref(db, `users/${uid}/room-invites`), {
                        roomId: currentRoomId,
                        roomName: roomMeta.name || 'Комната',
                        roomLink: roomMeta.link || '',
                        roomAdminId: roomMeta.admin || '',
                        invitedBy: auth.currentUser.displayName || auth.currentUser.email || 'User',
                        ts: Date.now()
                    });
                    button.textContent = 'Отправлено';
                    button.classList.add('sent');
                    showToast('Инвайт отправлен');
                } catch (e) {
                    button.disabled = false;
                    showToast('Ошибка при отправке инвайта');
                }
            });
        });
    } catch (e) {
        list.innerHTML = '<div class="room-invite-empty">Не удалось загрузить друзей.</div>';
    }
}

function closeRoomInviteModal() {
    $('modal-room-invite')?.classList.remove('active');
}

function setupLobbyNotificationsV2() {
    if (setupLobbyNotificationsV2.didInit || !auth.currentUser) return;
    setupLobbyNotificationsV2.didInit = true;

    const btnToggleFriends = $('btn-toggle-friends');
    const friendsPanel = $('friends-list-panel');

    if (btnToggleFriends && friendsPanel) {
        btnToggleFriends.onclick = async () => {
            const isHidden = friendsPanel.style.display === 'none';
            friendsPanel.style.display = isHidden ? 'block' : 'none';
            if (!isHidden) return;

            friendsPanel.innerHTML = '<h3>👥 Друзья</h3><div class="room-invite-empty">Загружаю...</div>';

            try {
                const friendsSnap = await get(ref(db, `users/${auth.currentUser.uid}/friends`));
                const friendsData = friendsSnap.val() || {};
                const acceptedIds = Object.keys(friendsData).filter((uid) => isAcceptedFriendRecord(friendsData[uid]));

                if (!acceptedIds.length) {
                    friendsPanel.innerHTML = '<h3>👥 Друзья</h3><div class="room-invite-empty">Нет друзей</div>';
                    return;
                }

                const friends = await Promise.all(acceptedIds.map(async (uid) => {
                    try {
                        const profileSnap = await get(ref(db, `users/${uid}/profile`));
                        const profile = profileSnap.val() || {};
                        return { uid, name: profile.name || 'User', color: profile.color || '#f5f7fa' };
                    } catch (e) {
                        return { uid, name: 'User', color: '#f5f7fa' };
                    }
                }));

                friendsPanel.innerHTML = `<h3>👥 Друзья</h3>${friends.map((friend) => `
                    <div class="friend-card" data-fuid="${friend.uid}">
                        <div style="width:24px; height:24px; border-radius:50%; background:linear-gradient(45deg, ${escapeHtml(friend.color)}, rgba(255,255,255,0.1)); border:1px solid rgba(255,255,255,0.1);"></div>
                        <strong>${escapeHtml(friend.name)}</strong>
                        <button type="button" class="friend-dm-btn" data-fuid="${friend.uid}">💬</button>
                    </div>
                `).join('')}`;

                friendsPanel.querySelectorAll('.friend-dm-btn').forEach((button) => {
                    button.onclick = (event) => {
                        event.stopPropagation();
                        showToast('💬 Чат с другом пока в разработке');
                    };
                });
            } catch (e) {
                friendsPanel.innerHTML = '<h3>👥 Друзья</h3><div class="room-invite-empty">Не удалось загрузить друзей</div>';
            }
        };
    }

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
                    <button type="button" class="invite-accept-btn" data-room-id="${escapeHtml(invite.roomId || '')}" data-invite-id="${escapeHtml(inviteId)}">Зайти</button>
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
                window.joinRoom(roomId, room.name || invite.roomName || 'Комната', room.link || invite.roomLink || '', room.admin || invite.roomAdminId || '');
            } catch (e) {
                showToast('Ошибка при принятии инвайта');
            }
        });

        setTimeout(() => notif.remove(), 8000);
    });

    onChildAdded(ref(db, `users/${auth.currentUser.uid}/friend-requests`), (snap) => {
        const req = snap.val();
        const fromUid = snap.key;
        if (!req) return;

        const notif = document.createElement('div');
        notif.className = 'toast interactive-toast';
        notif.innerHTML = `
            <div style="padding:12px; background:rgba(46,213,115,0.1); border:1px solid #2ed573; border-radius:8px;">
                <strong>${escapeHtml(req.from || 'Пользователь')}</strong> хочет быть твоим другом
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button type="button" class="friend-req-accept" data-from-uid="${escapeHtml(fromUid)}">Принять</button>
                    <button type="button" class="friend-req-decline" data-from-uid="${escapeHtml(fromUid)}">Отклонить</button>
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
            } catch (e) {
                showToast('Ошибка');
            }
        });

        notif.querySelector('.friend-req-decline')?.addEventListener('click', async () => {
            try {
                await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                notif.remove();
            } catch (e) {
                showToast('Ошибка');
            }
        });

        setTimeout(() => notif.remove(), 8000);
    });
}

function findUidByPeerId(peerId) {
    return Object.keys(latestVoicePeers || {}).find((uid) => latestVoicePeers[uid] === peerId) || peerId;
}

function clearRemoteAudioState() {
    activeCalls.clear();
    const container = $('remote-audio-container');
    if (container) container.innerHTML = '';
    remoteAudioAnalyzers.forEach((entry) => {
        if (entry?.animationId) cancelAnimationFrame(entry.animationId);
    });
    remoteAudioAnalyzers.clear();
}

function createRemoteAudioAnalyzer(audio, uid) {
    const userItem = document.querySelector(`.user-item[data-uid="${uid}"]`);
    if (!userItem) return;

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
}

function attachRemoteAudio(stream, peerId, uid) {
    if (!stream || activeCalls.has(peerId)) return;
    activeCalls.add(peerId);

    const container = $('remote-audio-container');
    if (!container) return;

    document.getElementById(`audio-${peerId}`)?.remove();

    const audio = document.createElement('audio');
    audio.id = `audio-${peerId}`;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = stream;
    audio.volume = parseFloat($('voice-volume')?.value || '1');
    container.appendChild(audio);

    const startPlayback = () => {
        audio.play().catch(() => {
            document.addEventListener('click', () => audio.play().catch(() => {}), { once: true });
        });
    };

    audio.oncanplay = () => {
        createRemoteAudioAnalyzer(audio, uid);
        startPlayback();
    };
    audio.onended = () => activeCalls.delete(peerId);
}

async function publishLocalVoiceState() {
    if (!currentRoomId || !auth.currentUser || !myStream || !peer.id) return;
    await set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
}

function connectToVoicePeers() {
    if (!myStream || !peer.id) return;

    Object.entries(latestVoicePeers || {}).forEach(([uid, targetPeerId]) => {
        if (!targetPeerId || uid === auth.currentUser.uid || activeCalls.has(targetPeerId)) return;
        const call = peer.call(targetPeerId, myStream);
        if (!call) return;

        call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, targetPeerId, uid));
        call.on('close', () => activeCalls.delete(targetPeerId));
        call.on('error', () => activeCalls.delete(targetPeerId));
    });
}

async function enableMicrophone(button) {
    myStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
    });

    button?.classList.add('active');
    await publishLocalVoiceState();
    connectToVoicePeers();
    showToast('Микрофон включен');
}

async function disableMicrophone({ notify = true } = {}) {
    if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
    }
    myStream = null;

    if (currentRoomId && auth.currentUser) {
        try { await remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`)); } catch (e) { /* ignore */ }
    }

    $('mic-btn')?.classList.remove('active');
    clearRemoteAudioState();

    if (notify) showToast('Микрофон выключен');
}

peer.on('open', () => {
    if (myStream) {
        publishLocalVoiceState().catch(() => {});
        connectToVoicePeers();
    }
});

peer.on('call', (call) => {
    if (!myStream) {
        try { call.close(); } catch (e) { /* ignore */ }
        return;
    }

    const uid = findUidByPeerId(call.peer);
    call.answer(myStream);
    call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, call.peer, uid));
    call.on('close', () => activeCalls.delete(call.peer));
    call.on('error', () => activeCalls.delete(call.peer));
});

function enterRoomV2(roomId, name, link, adminId) {
    currentRoomId = roomId;
    lastSyncTs = 0;
    processedMsgs.clear();
    currentPresenceCache = {};
    latestVoicePeers = {};
    isHost = auth.currentUser.uid === adminId;

    if ($('room-title-text')) $('room-title-text').innerText = name;
    player.src = link;
    player.controls = isHost;
    player.style.pointerEvents = isHost ? 'auto' : 'none';

    const playerWrapper = $('player-wrapper');
    if (playerWrapper) {
        playerWrapper.style.backgroundImage = '';
        playerWrapper.style.backgroundSize = '';
        playerWrapper.style.backgroundPosition = '';
    }

    if ($('chat-messages')) $('chat-messages').innerHTML = '';
    if ($('users-list')) $('users-list').innerHTML = '';

    showScreen('room-screen');
    try { update(ref(db, `rooms/${currentRoomId}`), { lastActive: Date.now() }); } catch(e) { /* ignore */ }
    closeRoomInviteModal();
    roomEnteredAt = Date.now();
    initRoomServicesV2();

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
                leaveRoomV2();
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
            if ($('room-button-color')) $('room-button-color').value = meta.buttonColor || '#ffffff';
            if ($('room-private')) {
                $('room-private').checked = !!meta.private;
                if ($('room-password')) $('room-password').style.display = $('room-private').checked ? 'block' : 'none';
            }
            if ($('room-password')) $('room-password').value = '';
            $('modal-create')?.classList.add('active');
        };
    }

    showToast(isHost ? 'Вы зашли как Хост' : 'Вы зашли как Зритель');
}

async function leaveRoomV2() {
    closeRoomInviteModal();
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) {
        try { roomListenerUnsubscribe(); } catch (e) { /* ignore */ }
        roomListenerUnsubscribe = null;
    }

    player.pause();
    player.src = '';

    await disableMicrophone({ notify: false });

    currentPresenceCache = {};
    latestVoicePeers = {};
    const delBtn = $('btn-delete-room');
    const editBtn = $('btn-edit-room');
    if (delBtn) delBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    $('modal-join')?.classList.remove('active');
    presenceRef = null;
    currentRoomId = null;
    showScreen('lobby-screen');
}

function initRoomServicesV2() {
    // Cleanup any previous room listeners to avoid duplicate handlers
    if (typeof roomListenerUnsubscribe === 'function') {
        try { roomListenerUnsubscribe(); } catch(e) {}
        roomListenerUnsubscribe = null;
    }
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    const reactionsRef = ref(db, `rooms/${currentRoomId}/reactions`);
    const roomRef = ref(db, `rooms/${currentRoomId}`);

    const roomListener = (snap) => {
        if (!snap.exists() && currentRoomId) {
            showToast('Комната удалена');
            leaveRoomV2();
        }
    };
    onValue(roomRef, roomListener);
    roomListenerUnsubscribe = () => { try { off(roomRef, 'value', roomListener); } catch (e) { /* ignore */ } };

    $('btn-fullscreen').onclick = () => $('player-wrapper')?.requestFullscreen();

    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    const defaultPerms = { chat: true, voice: true, player: isHost, reactions: true };
    set(presenceRef, { name: auth.currentUser.displayName || 'User', perms: defaultPerms });
    onDisconnect(presenceRef).remove();

    const friends = new Set();
    const renderUsers = (data = {}) => {
        currentPresenceCache = data;
        const usersListEl = $('users-list');
        if (!usersListEl) return;

        usersListEl.innerHTML = '';
        const ids = Object.keys(data);
        if ($('users-count')) $('users-count').innerText = ids.length;

        const adminId = roomsCache[currentRoomId]?.admin || null;
        const frag = document.createDocumentFragment();

        ids.forEach((uid) => {
            const userData = data[uid] || {};
            const name = escapeHtml(userData.name || 'User');
            const perms = userData.perms || defaultPerms;
            const isLocal = uid === auth.currentUser.uid;
            const isFriend = friends.has(uid);
            const isUserHost = uid === adminId;

            const item = document.createElement('div');
            item.className = 'user-item';
            item.dataset.uid = uid;
            let inner = `<div class="indicator"></div>`;
            inner += `<div class="user-main"><span class="user-name">${isFriend ? '👥 ' : ''}${name}</span>`;
            if (isUserHost) inner += `<span class="host-label">Host</span>`;
            if (isFriend && !isLocal) inner += `<span class="friend-label">Друг</span>`;
            if (isLocal) inner += `<span class="you-label">(Вы)</span>`;
            inner += `</div>`;
            if (!isLocal && isFriend) inner += `<button type="button" class="dm-btn" data-uid="${uid}" title="Direct Message">💬</button>`;
            if (!isLocal) inner += `<button type="button" class="report-btn" data-uid="${uid}" title="Report">Report</button>`;
            if (!isLocal && !isFriend) inner += `<button type="button" class="add-friend-btn" data-uid="${uid}" title="Add Friend">+Доб</button>`;
            item.innerHTML = inner;
            if (!perms.voice) {
                const indicator = item.querySelector('.indicator');
                if (indicator) indicator.style.opacity = '0.35';
            }
            frag.appendChild(item);
        });

        usersListEl.appendChild(frag);

        // Delegated event handling for the users list
        usersListEl.onclick = async (event) => {
            const target = event.target;
            if (!target) return;
            if (target.classList.contains('report-btn')) {
                const uid = target.dataset.uid;
                if (!REPORT_FORM_URL) { showToast('Форма для репортов не настроена'); return; }
                window.open(`${REPORT_FORM_URL}?reported=${encodeURIComponent(uid)}`, '_blank');
                return;
            }
            if (target.classList.contains('add-friend-btn')) {
                const uid = target.dataset.uid;
                try {
                    await set(ref(db, `users/${auth.currentUser.uid}/friends/${uid}`), { status: 'pending', ts: Date.now() });
                    await set(ref(db, `users/${uid}/friend-requests/${auth.currentUser.uid}`), { from: auth.currentUser.displayName, ts: Date.now() });
                    showToast('Запрос отправлен');
                } catch (e) { showToast('Ошибка при отправке запроса'); }
                return;
            }
            if (target.classList.contains('dm-btn')) {
                showToast('💬 Личные сообщения пока в разработке');
                return;
            }
        };

        const localNode = data[auth.currentUser.uid] || {};
        const effectiveLocalPerms = isHost ? { chat: true, voice: true, player: true, reactions: true } : (localNode.perms || defaultPerms);

        if ($('chat-input')) $('chat-input').disabled = !effectiveLocalPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !effectiveLocalPerms.chat;

        if (!effectiveLocalPerms.voice && myStream) {
            disableMicrophone({ notify: false }).then(() => showToast('Вам отключили голос'));
        }
        if ($('mic-btn')) $('mic-btn').disabled = !effectiveLocalPerms.voice;

        if (effectiveLocalPerms.player || isHost) {
            player.style.pointerEvents = 'auto';
            player.controls = true;
        } else {
            player.style.pointerEvents = 'none';
            player.controls = isHost;
        }

        document.querySelectorAll('.react-btn').forEach((button) => {
            button.disabled = !effectiveLocalPerms.reactions;
        });
    };

    get(ref(db, `users/${auth.currentUser.uid}/friends`)).then((snap) => {
        const friendData = snap.val() || {};
        Object.keys(friendData).forEach((uid) => {
            if (isAcceptedFriendRecord(friendData[uid])) friends.add(uid);
        });
        renderUsers(currentPresenceCache);
    }).catch(() => {});

    const presenceListener = (snap) => renderUsers(snap.val() || {});
    onValue(presenceDbRef, presenceListener);

    const handleVideoSync = (type) => {
    const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
    if (!(localPerms.player || isHost)) return; // Блокируем, если нет прав
    if (!isRemoteAction) set(videoRef, { type: type, time: player.currentTime, ts: Date.now() });
    };

    player.onplay = () => handleVideoSync('play');
    player.onpause = () => handleVideoSync('pause');
    player.onseeked = () => handleVideoSync('seek');

    const videoListener = (snap) => {
        if (isHost) return;
        const syncState = snap.val();
        if (!syncState || syncState.ts <= lastSyncTs) return;

        lastSyncTs = syncState.ts;
        isRemoteAction = true;
        if (Math.abs(player.currentTime - syncState.time) > 2) player.currentTime = syncState.time;
        syncState.type === 'play' ? player.play() : player.pause();
        setTimeout(() => { isRemoteAction = false; }, 500);
    };
    onValue(videoRef, videoListener);

    const parseTimecodes = (text) => escapeHtml(text).replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    const sendMsg = () => {
        const input = $('chat-input');
        if (input && input.value.trim()) {
            push(chatRef, { user: auth.currentUser.displayName, content: input.value.trim(), ts: Date.now() });
            input.value = '';
        }
    };

    if ($('send-btn')) $('send-btn').onclick = sendMsg;
    if ($('chat-input')) {
        $('chat-input').onkeydown = (event) => {
            if (event.key === 'Enter') sendMsg();
        };
    }

    if ($('chat-messages')) {
        $('chat-messages').onclick = (event) => {
            if (!event.target.classList.contains('timecode-btn')) return;
            const parts = event.target.dataset.time.split(':');
            const seconds = (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
            player.currentTime = seconds;
            if (isHost) {
                player.play();
                set(videoRef, { type: 'seek', time: seconds, ts: Date.now() });
            }
        };
    }

    const chatListener = (snap) => {
        const message = snap.val();
        const id = snap.key;
        if (processedMsgs.has(id)) return;
        processedMsgs.add(id);

        const isMe = message.user === auth.currentUser.displayName;
        const div = document.createElement('div');
        div.className = isMe ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${escapeHtml(message.user || 'User')}</strong><p>${parseTimecodes(message.content || '')}</p></div>`;
        $('chat-messages')?.appendChild(div);
        if ($('chat-messages')) $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
        if (!isMe && message.ts && message.ts >= (roomEnteredAt - 2000)) {
            showToast(`Сообщение от ${escapeHtml(message.user || 'User')}`);
        }
    };
    onChildAdded(chatRef, chatListener);

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

    document.querySelectorAll('.react-btn').forEach((button) => {
        button.onclick = () => push(reactionsRef, { emoji: button.dataset.emoji, ts: Date.now() });
    });

    const reactionListener = (snap) => {
        const reaction = snap.val();
        if (Date.now() - reaction.ts > 5000) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = reaction.emoji;
        el.style.left = `${Math.random() * 80 + 10}%`;
        $('reaction-layer')?.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    };
    onChildAdded(reactionsRef, reactionListener);

    if ($('mic-btn')) {
        $('mic-btn').onclick = async function() {
            if (this.classList.contains('active')) {
                await disableMicrophone();
                return;
            }

            try {
                await enableMicrophone(this);
            } catch (e) {
                this.classList.remove('active');
                showToast('Ошибка доступа к микрофону');
            }
        };
    }

    const voiceListener = (snap) => {
        latestVoicePeers = snap.val() || {};
        connectToVoicePeers();
    };
    onValue(voiceRef, voiceListener);
    roomListenerUnsubscribe = () => {
        try { off(roomRef, 'value', roomListener); } catch (e) { /* ignore */ }
        try { off(presenceDbRef, 'value', presenceListener); } catch (e) { /* ignore */ }
        try { off(videoRef, 'value', videoListener); } catch (e) { /* ignore */ }
        try { off(chatRef, 'child_added', chatListener); } catch (e) { /* ignore */ }
        try { off(reactionsRef, 'child_added', reactionListener); } catch (e) { /* ignore */ }
        try { off(voiceRef, 'value', voiceListener); } catch (e) { /* ignore */ }
    };

    const voiceEl = $('voice-volume');
    const setRangeFill = (el) => {
        if (!el) return;
        const v = parseFloat(el.value) || 0;
        const p = Math.round(v * 100);
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f5f7fa';
        el.style.background = `linear-gradient(90deg, ${accent.trim()} ${p}%, rgba(255,255,255,0.12) ${p}%)`;
    };
    if (voiceEl) {
        voiceEl.oninput = (event) => {
            document.querySelectorAll('#remote-audio-container audio').forEach((audio) => {
                audio.volume = event.target.value;
            });
            setRangeFill(event.target);
        };
        setRangeFill(voiceEl);
    }
}

if ($('btn-open-room-invite')) $('btn-open-room-invite').onclick = openRoomInviteModal;
if ($('btn-room-invite-close')) $('btn-room-invite-close').onclick = closeRoomInviteModal;
if ($('modal-room-invite')) {
    $('modal-room-invite').addEventListener('click', (event) => {
        if (event.target.id === 'modal-room-invite') closeRoomInviteModal();
    });
}

renderRooms = renderRoomsV2;
setupLobbyNotifications = setupLobbyNotificationsV2;
enterRoom = enterRoomV2;
leaveRoom = leaveRoomV2;
initRoomServices = initRoomServicesV2;

if ($('btn-leave-room')) $('btn-leave-room').onclick = leaveRoomV2;

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function getDisplayName() {
    return auth.currentUser?.displayName || auth.currentUser?.email || 'User';
}

function getDirectChatId(uidA, uidB) {
    return [uidA, uidB].sort().join('__');
}

function getVoiceRefs(roomId) {
    return {
        root: ref(db, `rooms/${roomId}/rtc`),
        participants: ref(db, `rooms/${roomId}/rtc/participants`),
        offersForMe: ref(db, `rooms/${roomId}/rtc/offers/${auth.currentUser.uid}`),
        answersForMe: ref(db, `rooms/${roomId}/rtc/answers/${auth.currentUser.uid}`),
        candidatesForMe: ref(db, `rooms/${roomId}/rtc/candidates/${auth.currentUser.uid}`)
    };
}

function cleanupRemoteAudioIndicator(uid) {
    const entry = remoteAudioAnalyzers.get(uid);
    if (entry?.animationId) cancelAnimationFrame(entry.animationId);
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

    const ensurePlay = () => {
        audio.play().catch(() => {
            document.addEventListener('click', () => audio.play().catch(() => {}), { once: true });
        });
    };

    audio.oncanplay = () => {
        createRemoteAudioAnalyzer(audio, uid);
        ensurePlay();
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

    voicePeerConnections.set(remoteUid, {
        pc,
        remoteSessionId: remoteParticipant.sessionId || null
    });
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
    destroyAllVoiceConnections();
    voiceParticipantsCache = {};
}

async function enableMicrophoneNative(button) {
    myStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
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
    if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
    }
    myStream = null;

    if (currentRoomId && auth.currentUser) {
        try { await remove(ref(db, `rooms/${currentRoomId}/rtc/participants/${auth.currentUser.uid}`)); } catch (e) {}
    }

    voiceSessionId = null;
    $('mic-btn')?.classList.remove('active');
    destroyAllVoiceConnections();

    if (notify) showToast('Микрофон выключен');
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

function closeDirectChatModal() {
    if (directChatUnsubscribe) {
        try { directChatUnsubscribe(); } catch (e) {}
        directChatUnsubscribe = null;
    }
    currentDirectChat = null;
    $('modal-dm-chat')?.classList.remove('active');
    if ($('dm-messages')) $('dm-messages').innerHTML = '';
    if ($('dm-input')) $('dm-input').value = '';
}

function renderDirectMessages(messages = []) {
    const list = $('dm-messages');
    if (!list) return;
    if (!messages.length) {
        list.innerHTML = '<div class="dm-empty">Сообщений пока нет</div>';
        return;
    }

    list.innerHTML = messages.map((message) => {
        const isSelf = message.fromUid === auth.currentUser.uid;
        return `
            <div class="dm-line ${isSelf ? 'self' : ''}">
                <div class="dm-bubble">
                    <strong>${escapeHtml(isSelf ? 'Вы' : (message.fromName || 'Друг'))}</strong>
                    <div>${escapeHtml(message.text || '')}</div>
                </div>
            </div>
        `;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

function openDirectChatModal(targetUid, targetName) {
    if (!targetUid || !auth.currentUser) return;
    closeDirectChatModal();

    currentDirectChat = {
        uid: targetUid,
        name: targetName || 'Друг',
        id: getDirectChatId(auth.currentUser.uid, targetUid)
    };

    if ($('dm-chat-title')) $('dm-chat-title').textContent = `Чат с ${currentDirectChat.name}`;
    if ($('dm-chat-status')) $('dm-chat-status').textContent = 'Сообщения видны только вам двоим';
    $('modal-dm-chat')?.classList.add('active');

    const messagesRef = ref(db, `direct-messages/${currentDirectChat.id}/messages`);
    const listener = (snap) => {
        const raw = snap.val() || {};
        const messages = Object.values(raw).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        renderDirectMessages(messages);
    };
    onValue(messagesRef, listener);
    directChatUnsubscribe = () => off(messagesRef, 'value', listener);
}

async function sendDirectMessage() {
    const input = $('dm-input');
    if (!input || !currentDirectChat || !input.value.trim() || !auth.currentUser) return;

    const text = input.value.trim();
    input.value = '';

    const baseRef = ref(db, `direct-messages/${currentDirectChat.id}`);
    await update(baseRef, {
        participants: {
            [auth.currentUser.uid]: true,
            [currentDirectChat.uid]: true
        },
        updatedAt: Date.now()
    });
    await push(ref(db, `direct-messages/${currentDirectChat.id}/messages`), {
        fromUid: auth.currentUser.uid,
        fromName: getDisplayName(),
        text,
        ts: Date.now()
    });
}

function bindDirectChatUi() {
    if ($('btn-dm-close')) $('btn-dm-close').onclick = closeDirectChatModal;
    if ($('btn-dm-send')) $('btn-dm-send').onclick = sendDirectMessage;
    if ($('dm-input')) {
        $('dm-input').onkeydown = (event) => {
            if (event.key === 'Enter') sendDirectMessage();
        };
    }
    if ($('modal-dm-chat')) {
        $('modal-dm-chat').addEventListener('click', (event) => {
            if (event.target.id === 'modal-dm-chat') closeDirectChatModal();
        });
    }
}

bindDirectChatUi();

function setupLobbyNotificationsV3() {
    setupLobbyNotificationsV2();

    const toggleButton = $('btn-toggle-friends');
    const panel = $('friends-list-panel');
    if (!toggleButton || !panel) return;

    const baseHandler = toggleButton.onclick;
    toggleButton.onclick = async () => {
        if (typeof baseHandler === 'function') await baseHandler();
        panel.querySelectorAll('.friend-dm-btn').forEach((button) => {
            button.onclick = (event) => {
                event.stopPropagation();
                const card = button.closest('.friend-card');
                const name = card?.querySelector('strong')?.textContent?.trim() || 'Друг';
                openDirectChatModal(button.dataset.fuid, name);
            };
        });
    };
}

function enterRoomV3(roomId, name, link, adminId) {
    closeDirectChatModal();
    enterRoomV2(roomId, name, link, adminId);
}

async function leaveRoomV3() {
    closeVoiceSignalLayer();
    await disableMicrophoneNative({ notify: false });
    closeDirectChatModal();
    await leaveRoomV2();
}

function initRoomServicesV3() {
    // Cleanup any previous room listeners to avoid duplicate handlers
    if (typeof roomListenerUnsubscribe === 'function') {
        try { roomListenerUnsubscribe(); } catch(e) {}
        roomListenerUnsubscribe = null;
    }
    initRoomServicesV2();

    const roomId = currentRoomId;
    const voiceRefs = getVoiceRefs(roomId);

    const participantsListener = async (snap) => {
        voiceParticipantsCache = snap.val() || {};
        for (const remoteUid of Array.from(voicePeerConnections.keys())) {
            if (!voiceParticipantsCache[remoteUid]) destroyVoiceConnection(remoteUid);
        }
        if (myStream && voiceSessionId) {
            for (const remoteUid of Object.keys(voiceParticipantsCache)) {
                await createVoiceOfferFor(remoteUid);
            }
        }
    };
    const offersListener = (snap) => handleIncomingOffers(snap.val() || {});
    const answersListener = (snap) => handleIncomingAnswers(snap.val() || {});
    const candidatesListener = (snap) => handleIncomingCandidates(snap.val() || {});

    onValue(voiceRefs.participants, participantsListener);
    onValue(voiceRefs.offersForMe, offersListener);
    onValue(voiceRefs.answersForMe, answersListener);
    onValue(voiceRefs.candidatesForMe, candidatesListener);

    const previousVoiceCleanup = voiceSignalCleanup;
    voiceSignalCleanup = () => {
        try { off(voiceRefs.participants, 'value', participantsListener); } catch (e) {}
        try { off(voiceRefs.offersForMe, 'value', offersListener); } catch (e) {}
        try { off(voiceRefs.answersForMe, 'value', answersListener); } catch (e) {}
        try { off(voiceRefs.candidatesForMe, 'value', candidatesListener); } catch (e) {}
        if (typeof previousVoiceCleanup === 'function') previousVoiceCleanup();
    };

    const usersListEl = $('users-list');
    const baseObserver = new MutationObserver(() => {
        usersListEl.querySelectorAll('.dm-btn').forEach((button) => {
            button.onclick = () => {
                const card = button.closest('.user-item');
                const name = card?.querySelector('.user-name')?.textContent?.replace(/^👥\s*/, '')?.trim() || 'Друг';
                openDirectChatModal(button.dataset.uid, name);
            };
        });

        usersListEl.querySelectorAll('.perm-toggle').forEach((toggle) => {
            toggle.onchange = async (event) => {
                if (!isHost) return;
                const uid = event.currentTarget.dataset.uid;
                const perm = event.currentTarget.dataset.perm;
                const checked = event.currentTarget.checked;
                try {
                    await set(ref(db, `rooms/${currentRoomId}/presence/${uid}/perms/${perm}`), checked);
                    if (perm === 'voice' && !checked) {
                        await remove(ref(db, `rooms/${currentRoomId}/rtc/participants/${uid}`)).catch(() => {});
                    }
                } catch (e) {
                    showToast('Ошибка при обновлении прав');
                }
            };
        });
    });
    if (usersListEl) {
        baseObserver.observe(usersListEl, { childList: true, subtree: true });
        const prevRoomCleanup = roomListenerUnsubscribe;
        roomListenerUnsubscribe = () => {
            try { baseObserver.disconnect(); } catch (e) {}
            if (typeof prevRoomCleanup === 'function') prevRoomCleanup();
            if (typeof voiceSignalCleanup === 'function') voiceSignalCleanup();
            voiceSignalCleanup = null;
        };
    }

    const usersPresenceRef = ref(db, `rooms/${currentRoomId}/presence`);
    const enhanceUsersListener = (snap) => {
        const data = snap.val() || {};
        const defaultPerms = { chat: true, voice: true, player: false, reactions: true };
        const adminId = roomsCache[currentRoomId]?.admin || null;
        const list = $('users-list');
        if (!list) return;

        list.querySelectorAll('.user-item').forEach((item) => {
            const uid = item.dataset.uid;
            if (!uid || uid === auth.currentUser.uid || !isHost) return;
            if (item.querySelector('.perm-controls')) return;

            const perms = { ...defaultPerms, ...(data[uid]?.perms || {}) };
            item.insertAdjacentHTML('beforeend', renderPermissionControls(uid, perms));
        });

        const localNode = data[auth.currentUser.uid] || {};
        const effectiveLocalPerms = isHost ? { chat: true, voice: true, player: true, reactions: true } : ({ chat: true, voice: true, player: false, reactions: true, ...(localNode.perms || {}) });
        if (!effectiveLocalPerms.voice && myStream) {
            disableMicrophoneNative({ notify: false }).then(() => showToast('Вам отключили голос'));
        }
        if ($('mic-btn')) $('mic-btn').disabled = !effectiveLocalPerms.voice;
        if (effectiveLocalPerms.player || auth.currentUser.uid === adminId) {
            player.style.pointerEvents = 'auto';
            player.controls = true;
        } else {
            player.style.pointerEvents = 'none';
            player.controls = false;
        }
        if ($('chat-input')) $('chat-input').disabled = !effectiveLocalPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !effectiveLocalPerms.chat;
        document.querySelectorAll('.react-btn').forEach((button) => {
            button.disabled = !effectiveLocalPerms.reactions;
        });
    };
    onValue(usersPresenceRef, enhanceUsersListener);
    const prevCleanup = roomListenerUnsubscribe;
    roomListenerUnsubscribe = () => {
        try { off(usersPresenceRef, 'value', enhanceUsersListener); } catch (e) {}
        if (typeof prevCleanup === 'function') prevCleanup();
    };

    if ($('mic-btn')) {
        $('mic-btn').onclick = async function() {
            const localNode = currentPresenceCache[auth.currentUser.uid] || {};
            const effectivePerms = isHost ? { chat: true, voice: true, player: true, reactions: true } : ({ chat: true, voice: true, player: false, reactions: true, ...(localNode.perms || {}) });
            if (!effectivePerms.voice) return;

            if (myStream) {
                await disableMicrophoneNative();
                return;
            }

            try {
                await enableMicrophoneNative(this);
            } catch (e) {
                this.classList.remove('active');
                showToast('Ошибка доступа к микрофону');
            }
        };
    }
}

setupLobbyNotifications = setupLobbyNotificationsV3;
enterRoom = enterRoomV3;
leaveRoom = leaveRoomV3;
initRoomServices = initRoomServicesV3;

if ($('btn-leave-room')) $('btn-leave-room').onclick = leaveRoomV3;

function getDefaultRoomPerms(host = false) {
    return { chat: true, voice: true, player: !!host, reactions: true };
}

function getEffectiveRoomPerms(node, host = false) {
    return host ? { chat: true, voice: true, player: true, reactions: true } : { ...getDefaultRoomPerms(false), ...(node?.perms || {}) };
}

function setCreateModalMode(mode = 'create') {
    const modal = $('modal-create');
    const title = modal?.querySelector('h2');
    if (title) title.textContent = mode === 'edit' ? 'Изменить комнату' : 'Создать комнату';
}

function getOnlineLabel(status) {
    if (status?.online) return 'Онлайн';
    if (status?.lastSeen) {
        const mins = Math.max(1, Math.round((Date.now() - status.lastSeen) / 60000));
        return `Был ${mins} мин назад`;
    }
    return 'Не в сети';
}

function bindSelfPresence() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userStatusRef = ref(db, `status/${uid}`);
    const connectedRef = ref(db, '.info/connected');

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            const isOnlineForDatabase = {
                state: 'online',
                last_changed: Date.now()
            };
            const isOfflineForDatabase = {
                state: 'offline',
                last_changed: Date.now()
            };
            
            // При отключении от интернета/закрытии вкладки — ставим offline
            onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
                // Как только onDisconnect установлен, ставим online
                set(userStatusRef, isOnlineForDatabase);
            });
        }
    });
}

function subscribeToOwnProfile() {
    if (!auth.currentUser) return;
    const profileRef = ref(db, `users/${auth.currentUser.uid}/profile`);
    onValue(profileRef, (snap) => {
        const profile = snap.val() || {};
        const displayName = profile.name || auth.currentUser.displayName || auth.currentUser.email || 'User';
        if ($('user-display-name')) $('user-display-name').innerText = displayName;
        const avatar = $('my-avatar');
            if (avatar) {
                if (profile.avatar === 'silhouette') {
                    // Показываем простую ч/б силуэтную иконку
                    avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="56" height="56"><circle cx="32" cy="20" r="12" fill="#000"/><path d="M12 56c0-11 9-20 20-20s20 9 20 20z" fill="#000"/></svg>';
                    avatar.style.background = profile.color || '#f5f7fa';
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.filter = 'grayscale(100%)';
                    avatar.style.display = 'flex';
                    avatar.style.alignItems = 'center';
                    avatar.style.justifyContent = 'center';
                } else {
                    avatar.innerHTML = '';
                    avatar.style.filter = '';
                    avatar.style.background = `linear-gradient(45deg, ${profile.color || '#f5f7fa'}, rgba(255,255,255,0.08))`;
                }
            }
        if (currentRoomId && presenceRef) update(presenceRef, { name: displayName }).catch(() => {});
        Object.entries(roomsCache || {}).forEach(([roomId, room]) => {
            if (room?.admin === auth.currentUser.uid && room.adminName !== displayName) {
                update(ref(db, `rooms/${roomId}`), { adminName: displayName }).catch(() => {});
            }
        });
    });
}

function clearRoomProfileSubscriptions() {
    roomProfileSubscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch (e) {} });
    roomProfileSubscriptions.clear();
}

function clearFriendProfileSubscriptions() {
    friendProfileSubscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch (e) {} });
    friendProfileSubscriptions.clear();
}

function bindRoomPreviewLazyLoad() {
    roomPreviewObserver?.disconnect();
    roomPreviewObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const video = entry.target;
            if (!video.src) {
                video.src = video.dataset.src || '';
                applyRoomCardFrame(video);
            }
            roomPreviewObserver.unobserve(video);
        });
    }, { rootMargin: '180px 0px' });

    document.querySelectorAll('.room-thumb-video').forEach((video) => {
        if (video.dataset.src) roomPreviewObserver.observe(video);
    });
}

function renderRoomsV4(filter = '') {
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

        grid.innerHTML += `
            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(roomLink)}, ${JSON.stringify(room.admin || '')})'>
                ${colorDot}
                <div class="room-thumb">${previewContent}</div>
                <h4>${lock + escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${escapeHtml(host)}</p>
            </div>`;
    });

    bindRoomPreviewLazyLoad();
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
            card.querySelector('strong').textContent = profile.name || 'User';
            card.querySelector('.friend-live-avatar').style.background = `linear-gradient(45deg, ${profile.color || '#f5f7fa'}, rgba(255,255,255,0.08))`;
            card.querySelector('.friend-status-text').textContent = getOnlineLabel(status);
            card.querySelector('.friend-online-dot').classList.toggle('online', !!status.online);
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
            openDirectChatModalV2(button.dataset.fuid, name);
        };
    });
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

function renderDirectMessagesV2(messages = [], pinnedMessage = null) {
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
}

function bindDirectMessageActions(messages, pinnedMessage) {
    $('dm-messages')?.querySelectorAll('.dm-action-btn').forEach((button) => {
        button.onclick = async () => {
            if (!currentDirectChat) return;
            const message = messages.find((item) => item.id === button.dataset.mid);
            if (!message) return;
            const chatBaseRef = ref(db, `direct-messages/${currentDirectChat.id}`);

            if (button.dataset.action === 'delete' && message.fromUid === auth.currentUser.uid) {
                await remove(ref(db, `direct-messages/${currentDirectChat.id}/messages/${message.id}`));
                if (pinnedMessage?.id === message.id) await remove(ref(db, `direct-messages/${currentDirectChat.id}/pinned`));
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

function openDirectChatModalV2(targetUid, targetName) {
    if (!targetUid || !auth.currentUser) return;
    closeDirectChatModal();
    currentDirectChat = { uid: targetUid, name: targetName || 'Друг', id: getDirectChatId(auth.currentUser.uid, targetUid) };
    if ($('dm-chat-title')) $('dm-chat-title').textContent = `Чат с ${currentDirectChat.name}`;
    if ($('dm-chat-status')) $('dm-chat-status').textContent = 'Редактирование, удаление и закреп доступны прямо в чате';
    $('modal-dm-chat')?.classList.add('active');

    const chatRef = ref(db, `direct-messages/${currentDirectChat.id}`);
    const listener = (snap) => {
        const data = snap.val() || {};
        const messages = Object.entries(data.messages || {}).map(([id, value]) => ({ id, ...value })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        renderDirectMessagesV2(messages, data.pinned || null);
        bindDirectMessageActions(messages, data.pinned || null);
        if (data.lastMessage?.ts) sessionStorage.setItem(`dmSeen:${currentDirectChat.id}`, String(data.lastMessage.ts));
    };
    onValue(chatRef, listener);
    directChatUnsubscribe = () => off(chatRef, 'value', listener);
}

async function sendDirectMessageV2() {
    const input = $('dm-input');
    if (!input || !currentDirectChat || !input.value.trim() || !auth.currentUser) return;
    const text = input.value.trim();
    input.value = '';
    const payload = { fromUid: auth.currentUser.uid, fromName: getDisplayName(), text, ts: Date.now() };
    await update(ref(db, `direct-messages/${currentDirectChat.id}`), {
        participants: { [auth.currentUser.uid]: true, [currentDirectChat.uid]: true },
        updatedAt: payload.ts,
        lastMessage: payload
    });
    await push(ref(db, `direct-messages/${currentDirectChat.id}/messages`), payload);
    sessionStorage.setItem(`dmSeen:${currentDirectChat.id}`, String(payload.ts));
}

function bindDirectChatUiV2() {
    if ($('btn-dm-close')) $('btn-dm-close').onclick = closeDirectChatModal;
    if ($('btn-dm-send')) $('btn-dm-send').onclick = sendDirectMessageV2;
    if ($('dm-input')) $('dm-input').onkeydown = (event) => { if (event.key === 'Enter') sendDirectMessageV2(); };
}

function setupLobbyNotificationsV4() {
    if (setupLobbyNotificationsV4.didInit || !auth.currentUser) return;
    setupLobbyNotificationsV4.didInit = true;
    setupLobbyNotificationsV3();
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
}

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

function enterRoomV4(roomId, name, link, adminId) {
    closeDirectChatModal();
    currentRoomId = roomId;
    lastSyncTs = 0;
    processedMsgs.clear();
    currentPresenceCache = {};
    latestRoomPresenceData = {};
    isHost = auth.currentUser.uid === adminId;
    if ($('room-title-text')) $('room-title-text').innerText = name;
    player.src = link;
    player.controls = isHost;
    player.style.pointerEvents = isHost ? 'auto' : 'none';
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
    roomEnteredAt = Date.now();

    const delBtn = $('btn-delete-room');
    const editBtn = $('btn-edit-room');
    if (delBtn) {
        delBtn.style.display = isHost ? 'inline-block' : 'none';
        delBtn.onclick = async () => {
            if (!isHost) return;
            if (!confirm('ВНИМАНИЕ! Удалить эту комнату навсегда?')) return;
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
                if ($('room-password')) $('room-password').style.display = $('room-private').checked ? 'block' : 'none';
            }
            if ($('room-password')) $('room-password').value = '';
            $('modal-create')?.classList.add('active');
        };
    }

    initRoomServicesV4();
    showToast(isHost ? 'Вы зашли как Хост' : 'Вы зашли как Зритель');
}

async function leaveRoomV4() {
    closeDirectChatModal();
    closeVoiceSignalLayer();
    await disableMicrophoneNative({ notify: false });
    clearRoomProfileSubscriptions();
    if (presenceRef) { try { await remove(presenceRef); } catch (e) {} }
    if (roomListenerUnsubscribe) { try { roomListenerUnsubscribe(); } catch (e) {} roomListenerUnsubscribe = null; }
    player.pause();
    player.src = '';
    presenceRef = null;
    currentRoomId = null;
    currentPresenceCache = {};
    latestRoomPresenceData = {};
    $('modal-join')?.classList.remove('active');
    const delBtn = $('btn-delete-room'); if (delBtn) delBtn.style.display = 'none';
    const editBtn = $('btn-edit-room'); if (editBtn) editBtn.style.display = 'none';
    showScreen('lobby-screen');
}

function initRoomServicesV4() {
    // Cleanup any previous room listeners to avoid duplicate handlers
    if (typeof roomListenerUnsubscribe === 'function') {
        try { roomListenerUnsubscribe(); } catch(e) {}
        roomListenerUnsubscribe = null;
    }
    const roomId = currentRoomId;
    const roomRef = ref(db, `rooms/${roomId}`);
    const videoRef = ref(db, `rooms/${roomId}/sync`);
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const presenceDbRef = ref(db, `rooms/${roomId}/presence`);
    const reactionsRef = ref(db, `rooms/${roomId}/reactions`);
    const adminId = roomsCache[roomId]?.admin || null;
    const teardown = [];
    const bindValue = (dbRef, handler) => { onValue(dbRef, handler); teardown.push(() => { try { off(dbRef, 'value', handler); } catch (e) {} }); };
    const bindChild = (dbRef, handler) => { onChildAdded(dbRef, handler); teardown.push(() => { try { off(dbRef, 'child_added', handler); } catch (e) {} }); };

    presenceRef = ref(db, `rooms/${roomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: getDisplayName(), perms: getDefaultRoomPerms(isHost) });
    onDisconnect(presenceRef).remove();

    const rerenderUsers = () => {
        const usersListEl = $('users-list');
        if (!usersListEl) return;
        usersListEl.innerHTML = '';
        const ids = Object.keys(currentPresenceCache);
        if ($('users-count')) $('users-count').innerText = ids.length;
        subscribeRoomProfiles(ids, rerenderUsers);

        const frag = document.createDocumentFragment();
        ids.forEach((uid) => {
            const presenceNode = currentPresenceCache[uid] || {};
            const profile = latestRoomPresenceData[uid]?._profile || {};
            const status = latestRoomPresenceData[uid]?._status || {};
            const perms = getEffectiveRoomPerms(presenceNode, uid === adminId);
            const isLocal = uid === auth.currentUser.uid;
            const isUserHost = uid === adminId;
            const name = escapeHtml(profile.name || presenceNode.name || 'User');

            const item = document.createElement('div');
            item.className = 'user-item';
            item.dataset.uid = uid;
            let inner = `<div class="indicator ${status.online ? 'online' : ''}"></div>`;
            inner += `<div class="user-main"><span class="user-name">${name}</span>`;
            if (isUserHost) inner += `<span class="host-label">Host</span>`;
            if (isLocal) inner += `<span class="you-label">(Вы)</span>`;
            inner += `</div>`;
            inner += `<div class="user-card-actions">`;
            if (!isLocal) inner += `<button type="button" class="report-btn" data-uid="${uid}">Report</button>`;
            if (!isLocal) inner += `<button type="button" class="dm-btn" data-uid="${uid}">💬</button>`;
            inner += `</div>`;
            if (isHost && !isLocal) inner += renderPermissionControls(uid, perms);
            item.innerHTML = inner;
            frag.appendChild(item);
        });

        usersListEl.appendChild(frag);

        usersListEl.querySelectorAll('.dm-btn').forEach((button) => {
            button.onclick = () => {
                const item = button.closest('.user-item');
                const name = item?.querySelector('.user-name')?.textContent?.trim() || 'Друг';
                openDirectChatModalV2(button.dataset.uid, name);
            };
        });
        usersListEl.querySelectorAll('.perm-toggle').forEach((toggle) => {
            toggle.onchange = async (event) => {
                if (!isHost) return;
                const uid = event.currentTarget.dataset.uid;
                const perm = event.currentTarget.dataset.perm;
                const checked = event.currentTarget.checked;
                await set(ref(db, `rooms/${roomId}/presence/${uid}/perms/${perm}`), checked).catch(() => showToast('Ошибка при обновлении прав'));
                if (perm === 'voice' && !checked) await remove(ref(db, `rooms/${roomId}/rtc/participants/${uid}`)).catch(() => {});
            };
        });

        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        if ($('chat-input')) $('chat-input').disabled = !localPerms.chat;
        if ($('send-btn')) $('send-btn').disabled = !localPerms.chat;
        if ($('mic-btn')) $('mic-btn').disabled = !localPerms.voice;
        if (!localPerms.voice && myStream) disableMicrophoneNative({ notify: false }).then(() => showToast('Вам отключили голос'));
        player.controls = !!localPerms.player || isHost;
        player.style.pointerEvents = (localPerms.player || isHost) ? 'auto' : 'none';
        document.querySelectorAll('.react-btn').forEach((btn) => { btn.disabled = !localPerms.reactions; });
    };

    bindValue(roomRef, (snap) => {
        if (!snap.exists() && currentRoomId) {
            showToast('Комната удалена');
            leaveRoomV4();
        }
    });
    bindValue(presenceDbRef, (snap) => {
        currentPresenceCache = snap.val() || {};
        rerenderUsers();
    });
    bindValue(videoRef, (snap) => {
        if (isHost) return;
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        if (Math.abs(player.currentTime - d.time) > 1) player.currentTime = d.time;
        if (d.type === 'play') player.play().catch(() => {});
        else player.pause();
        setTimeout(() => { isRemoteAction = false; }, 250);
    });

    const parseTimecodes = (text) => {
        const escaped = escapeHtml(text);
        return isHost
            ? escaped.replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>')
            : escaped.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn disabled">$1</span>');
    };
    const sendRoomMessage = () => {
        const input = $('chat-input');
        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        if (!input || !input.value.trim() || !localPerms.chat) return;
        push(chatRef, { user: getDisplayName(), fromUid: auth.currentUser.uid, content: input.value.trim(), ts: Date.now() });
        input.value = '';
        // Обновим метку активности комнаты
        try { update(ref(db, `rooms/${roomId}`), { lastActive: Date.now() }); } catch (e) { /* ignore */ }
    };
    if ($('send-btn')) $('send-btn').onclick = sendRoomMessage;
    if ($('chat-input')) $('chat-input').onkeydown = (event) => { if (event.key === 'Enter') sendRoomMessage(); };
    if ($('chat-messages')) {
    $('chat-messages').onclick = (event) => {
        const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
        if (!(localPerms.player || isHost) || !event.target.classList.contains('timecode-btn')) return;

        const [mm, ss] = event.target.dataset.time.split(':').map((v) => parseInt(v, 10));
        const seconds = (mm * 60) + ss;
        player.currentTime = seconds;
        player.play().catch(() => {});
        set(videoRef, { type: 'seek', time: seconds, ts: Date.now() });
    };
}
    bindChild(chatRef, (snap) => {
        const msg = snap.val();
        const id = snap.key;
        if (processedMsgs.has(id)) return;
        processedMsgs.add(id);
        const isMe = msg.fromUid === auth.currentUser.uid;
        const line = document.createElement('div');
        line.className = isMe ? 'm-line self' : 'm-line';
        line.innerHTML = `<div class="bubble"><strong>${escapeHtml(msg.user || 'User')}</strong><p>${parseTimecodes(msg.content || '')}</p></div>`;
        $('chat-messages')?.appendChild(line);
        if ($('chat-messages')) $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    document.querySelectorAll('.react-btn').forEach((btn) => {
        btn.onclick = () => {
            const localPerms = getEffectiveRoomPerms(currentPresenceCache[auth.currentUser.uid], isHost);
            if (!localPerms.reactions) return;
            push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
            try { update(ref(db, `rooms/${roomId}`), { lastActive: Date.now() }); } catch (e) { /* ignore */ }
        };
    });
    bindChild(reactionsRef, (snap) => {
        const reaction = snap.val();
        if (!reaction || Date.now() - reaction.ts > 5000) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = reaction.emoji;
        el.style.left = `${Math.random() * 80 + 10}%`;
        $('reaction-layer')?.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    });

    const voiceRefs = getVoiceRefs(roomId);
    bindValue(voiceRefs.participants, async (snap) => {
        voiceParticipantsCache = snap.val() || {};
        for (const remoteUid of Array.from(voicePeerConnections.keys())) {
            if (!voiceParticipantsCache[remoteUid]) destroyVoiceConnection(remoteUid);
        }
        if (myStream && voiceSessionId) {
            for (const remoteUid of Object.keys(voiceParticipantsCache)) await createVoiceOfferFor(remoteUid);
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
            try { await enableMicrophoneNative(this); } catch (e) { this.classList.remove('active'); showToast('Ошибка доступа к микрофону'); }
        };
    }
    if ($('voice-volume')) $('voice-volume').oninput = (event) => {
        document.querySelectorAll('#remote-audio-container audio').forEach((audio) => { audio.volume = event.target.value; });
    };
    if (isHost) {
        player.onplay = () => { if (!isRemoteAction) { set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); try { update(roomRef, { lastActive: Date.now() }); } catch(e){} } };
        player.onpause = () => { if (!isRemoteAction) { set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); try { update(roomRef, { lastActive: Date.now() }); } catch(e){} } };
        player.onseeked = () => { if (!isRemoteAction) { set(videoRef, { type: 'seek', time: player.currentTime, ts: Date.now() }); try { update(roomRef, { lastActive: Date.now() }); } catch(e){} } };
    } else {
        player.onplay = null;
        player.onpause = null;
        player.onseeked = null;
    }

    $('btn-fullscreen').onclick = () => $('player-wrapper')?.requestFullscreen();
    $('tab-chat-btn').onclick = () => { $('chat-messages').style.display = 'flex'; $('users-list').style.display = 'none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); };
    $('tab-users-btn').onclick = () => { $('users-list').style.display = 'flex'; $('chat-messages').style.display = 'none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); };

    roomListenerUnsubscribe = () => {
        teardown.forEach((fn) => fn());
        closeVoiceSignalLayer();
        clearRoomProfileSubscriptions();
    };
}

function bindCreateModalOverrides() {
    if ($('btn-open-modal')) {
        $('btn-open-modal').onclick = () => {
            editingRoomId = null;
            setCreateModalMode('create');
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

function widenLobbyLayout() {
    const layout = document.querySelector('.lobby-layout');
    if (layout) {
        layout.style.maxWidth = '95vw';
        layout.style.width = '95vw';
    }
}

function sendSystemMessage(text) {
    if (!currentRoomId) return;
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    push(chatRef, {
        senderId: 'system',
        text: text,
        timestamp: Date.now(),
        isSystem: true // Специальный флаг
    });
}

bindDirectChatUiV2();
bindCreateModalOverrides();
widenLobbyLayout();

// Кнопка пропуска авторизации (гость)
if ($('btn-skip-auth')) {
    $('btn-skip-auth').onclick = () => {
        showScreen('lobby-screen');
        showToast('Гостевой режим: некоторые функции могут быть недоступны');
    };
}

renderRooms = renderRoomsV4;
setupLobbyNotifications = setupLobbyNotificationsV4;
enterRoom = enterRoomV4;
leaveRoom = leaveRoomV4;
initRoomServices = initRoomServicesV4;

if ($('btn-leave-room')) $('btn-leave-room').onclick = leaveRoomV4;

// Автоудаление неактивных комнат: если поле lastActive старше 1 часа и в комнате нет присутствующих — удаляем
async function cleanupInactiveRooms() {
    try {
        const threshold = Date.now() - (60 * 60 * 1000); // 1 час
        const data = roomsCache || {};
        for (const [rid, room] of Object.entries(data)) {
            if (!room) continue;
            if (room.autoDelete === false) continue;
            const last = Number(room.lastActive || room.createdAt || 0);
            if (!last || last > threshold) continue;
            try {
                const presSnap = await get(ref(db, `rooms/${rid}/presence`));
                const pres = presSnap.val() || {};
                if (!Object.keys(pres).length) {
                    await remove(ref(db, `rooms/${rid}`));
                    console.log('Removed inactive room', rid);
                }
            } catch (e) { /* ignore per-room failures */ }
        }
    } catch (e) { console.warn('cleanupInactiveRooms failed', e); }
}

setInterval(cleanupInactiveRooms, 10 * 60 * 1000);
cleanupInactiveRooms().catch(() => {});