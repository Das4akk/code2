import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    updateProfile 
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
    update,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/** * КОРНЕВАЯ КОНФИГУРАЦИЯ
 * Здесь мы объединяем все системы в один мощный механизм управления.
 */
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

// Утилиты
const $ = (id) => document.getElementById(id);

// Глобальное состояние
let currentUserData = null;
let currentRoomId = null;
let roomUnsubscribe = null;
let myProfileUnsubscribe = null;
let activeProfileUser = null; // Тот, чей чужой профиль мы сейчас смотрим

// --- СИСТЕМА УВЕДОМЛЕНИЙ (TOASTS) ---
function showToast(text, duration = 3000) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast glass-panel';
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('active'), 10);
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- СИСТЕМА ПРОФИЛЕЙ И ЮЗЕРНЕЙМОВ ---

/**
 * Проверка уникальности @username.
 * Важное изменение: username хранится в отдельной ветке /usernames/ для быстрой проверки.
 */
async function checkUsernameUnique(username) {
    if (!username || username.length < 3) return { ok: false, msg: "Минимум 3 символа" };
    const clean = username.toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (clean !== username.toLowerCase()) return { ok: false, msg: "Недопустимые символы" };

    const snapshot = await get(ref(db, `usernames/${clean}`));
    if (snapshot.exists() && snapshot.val() !== auth.currentUser.uid) {
        return { ok: false, msg: "Занят" };
    }
    return { ok: true, clean };
}

async function updateMyProfile(updates) {
    const uid = auth.currentUser.uid;
    try {
        await update(ref(db, `users/${uid}`), updates);
        
        // Если меняем username, нужно обновить глобальную карту имен
        if (updates.username) {
            const clean = updates.username.toLowerCase();
            // Сначала удаляем старый (если был)
            if (currentUserData && currentUserData.username) {
                await remove(ref(db, `usernames/${currentUserData.username.toLowerCase()}`));
            }
            await set(ref(db, `usernames/${clean}`), uid);
        }
        showToast("Профиль обновлен");
    } catch (e) {
        showToast("Ошибка обновления: " + e.message);
    }
}

// --- СИСТЕМА ДРУЗЕЙ (FIXED) ---

/**
 * Подписка на список друзей и входящие заявки
 */
function initFriendSystem() {
    const uid = auth.currentUser.uid;
    
    // Слушаем заявки
    onValue(ref(db, `friendRequests/${uid}`), (snap) => {
        const requests = snap.val() || {};
        const count = Object.keys(requests).filter(k => requests[k] === 'pending').length;
        const badge = $('req-count-badge');
        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = count;
        } else {
            badge.style.display = 'none';
        }
        renderFriendRequests(requests);
    });

    // Слушаем друзей
    onValue(ref(db, `friends/${uid}`), async (snap) => {
        const friendIds = snap.val() || {};
        renderFriendsList(friendIds);
    });
}

async function renderFriendsList(friendIds) {
    const container = $('friends-list-container');
    container.innerHTML = '';
    
    const ids = Object.keys(friendIds).filter(id => friendIds[id] === true);
    if (ids.length === 0) {
        container.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
        return;
    }

    for (const fid of ids) {
        const fSnap = await get(ref(db, `users/${fid}`));
        const fData = fSnap.val();
        if (!fData) continue;

        const div = document.createElement('div');
        div.className = 'friend-item glass-panel';
        div.innerHTML = `
            <div class="avatar-circle small" style="background-image: url(${fData.avatar || ''})"></div>
            <div class="friend-info">
                <div class="friend-name">${escapeHtml(fData.name || 'User')}</div>
                <div class="friend-user">@${fData.username || 'id'}</div>
            </div>
            <div class="friend-actions">
                <button class="icon-btn sm btn-view-profile" data-uid="${fid}">👤</button>
                <button class="icon-btn sm btn-remove-friend" data-uid="${fid}">🗑️</button>
            </div>
        `;
        
        div.querySelector('.btn-view-profile').onclick = () => openUserProfile(fid);
        div.querySelector('.btn-remove-friend').onclick = () => removeFriend(fid);
        container.appendChild(div);
    }
}

async function renderFriendRequests(requests) {
    const container = $('requests-list-container');
    container.innerHTML = '';
    
    const pending = Object.keys(requests).filter(k => requests[k] === 'pending');
    if (pending.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет новых заявок</div>';
        return;
    }

    for (const rid of pending) {
        const uSnap = await get(ref(db, `users/${rid}`));
        const uData = uSnap.val();
        
        const div = document.createElement('div');
        div.className = 'request-item glass-panel';
        div.innerHTML = `
            <div class="user-info">
                <strong>${escapeHtml(uData?.name || 'User')}</strong>
                <span>@${uData?.username || 'id'}</span>
            </div>
            <div class="req-actions">
                <button class="accept-btn" data-uid="${rid}">Принять</button>
                <button class="reject-btn" data-uid="${rid}">Отклонить</button>
            </div>
        `;
        
        div.querySelector('.accept-btn').onclick = () => acceptFriendRequest(rid);
        div.querySelector('.reject-btn').onclick = () => rejectFriendRequest(rid);
        container.appendChild(div);
    }
}

async function sendFriendRequest(targetUid) {
    if (targetUid === auth.currentUser.uid) return;
    try {
        await set(ref(db, `friendRequests/${targetUid}/${auth.currentUser.uid}`), 'pending');
        showToast("Заявка отправлена");
        if (activeProfileUser === targetUid) openUserProfile(targetUid); // Refresh view
    } catch (e) {
        showToast("Ошибка: " + e.message);
    }
}

async function acceptFriendRequest(senderUid) {
    const myUid = auth.currentUser.uid;
    try {
        await update(ref(db, `friends/${myUid}`), { [senderUid]: true });
        await update(ref(db, `friends/${senderUid}`), { [myUid]: true });
        await remove(ref(db, `friendRequests/${myUid}/${senderUid}`));
        showToast("Теперь вы друзья!");
    } catch (e) {
        showToast("Ошибка: " + e.message);
    }
}

async function rejectFriendRequest(senderUid) {
    await remove(ref(db, `friendRequests/${auth.currentUser.uid}/${senderUid}`));
}

async function removeFriend(friendUid) {
    const myUid = auth.currentUser.uid;
    await update(ref(db, `friends/${myUid}`), { [friendUid]: null });
    await update(ref(db, `friends/${friendUid}`), { [myUid]: null });
    showToast("Друг удален");
}

// --- ОТКРЫТИЕ ПРОФИЛЕЙ ---

async function openUserProfile(uid) {
    if (uid === auth.currentUser.uid) {
        $('modal-my-profile').classList.add('active');
        return;
    }

    activeProfileUser = uid;
    const modal = $('modal-user-profile');
    const uSnap = await get(ref(db, `users/${uid}`));
    const uData = uSnap.val();
    
    if (!uData) return showToast("Пользователь не найден");

    $('user-view-name').textContent = uData.name || "Без имени";
    $('user-view-username').textContent = `@${uData.username || 'id'}`;
    $('user-view-status').textContent = uData.status ? `"${uData.status}"` : "Без статуса";
    $('user-view-avatar').style.backgroundImage = `url(${uData.avatar || ''})`;

    // Кол-во друзей
    const fSnap = await get(ref(db, `friends/${uid}`));
    const friends = fSnap.val() || {};
    $('user-view-friends-count').textContent = Object.keys(friends).filter(k => friends[k] === true).length;

    // Кнопки действий
    const actions = $('user-view-actions');
    actions.innerHTML = '';

    const myFriendsSnap = await get(ref(db, `friends/${auth.currentUser.uid}/${uid}`));
    const isFriend = myFriendsSnap.val() === true;

    const myReqSnap = await get(ref(db, `friendRequests/${uid}/${auth.currentUser.uid}`));
    const hasSentReq = myReqSnap.exists();

    if (isFriend) {
        actions.innerHTML = `
            <button class="secondary-btn" onclick="app.startChat('${uid}')">💬 ЛС</button>
            <button class="danger-btn" onclick="app.removeFriend('${uid}')">Удалить</button>
        `;
    } else if (hasSentReq) {
        actions.innerHTML = `<button class="secondary-btn" disabled>Заявка отправлена</button>`;
    } else {
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.textContent = 'Добавить в друзья';
        btn.onclick = () => sendFriendRequest(uid);
        actions.appendChild(btn);
    }

    modal.classList.add('active');
}

// Экспортируем некоторые функции в глобальный объект для вызова из HTML
window.app = {
    openUserProfile,
    removeFriend,
    startChat: (uid) => showToast("Чат в разработке")
};

// --- СИСТЕМА КОМНАТ ---

async function createRoom() {
    const name = $('room-name-input').value;
    const isPrivate = $('room-private-check').checked;
    const password = $('room-pass-input').value;

    if (!name) return showToast("Введите название комнаты");

    const roomData = {
        name,
        hostId: auth.currentUser.uid,
        isPrivate,
        password: isPrivate ? password : null,
        createdAt: Date.now(),
        video: {
            url: "",
            state: "paused",
            time: 0
        }
    };

    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, roomData);
    $('modal-create').classList.remove('active');
    joinRoom(newRoomRef.key);
}

function joinRoom(roomId) {
    if (currentRoomId) leaveRoom();

    currentRoomId = roomId;
    switchScreen('room-screen');
    
    // Подписка на данные комнаты
    roomUnsubscribe = onValue(ref(db, `rooms/${roomId}`), (snap) => {
        const data = snap.val();
        if (!data) {
            leaveRoom();
            return showToast("Комната удалена");
        }
        renderRoomUI(data);
    });

    // Чат комнаты
    const chatRef = ref(db, `chats/${roomId}`);
    onChildAdded(chatRef, (snap) => {
        appendChatMessage(snap.val());
    });

    // Система присутствия в комнате
    const userRef = ref(db, `rooms/${roomId}/users/${auth.currentUser.uid}`);
    set(userRef, {
        name: currentUserData.name,
        avatar: currentUserData.avatar,
        joinedAt: Date.now()
    });
    onDisconnect(userRef).remove();

    // Слушатель списка пользователей
    onValue(ref(db, `rooms/${roomId}/users`), (snap) => {
        const users = snap.val() || {};
        renderUsersList(users);
    });
}

function leaveRoom() {
    if (!currentRoomId) return;
    
    // Удаляем себя
    remove(ref(db, `rooms/${currentRoomId}/users/${auth.currentUser.uid}`));
    
    off(ref(db, `rooms/${currentRoomId}`));
    off(ref(db, `chats/${currentRoomId}`));
    off(ref(db, `rooms/${currentRoomId}/users`));

    currentRoomId = null;
    switchScreen('lobby-screen');
}

function renderRoomUI(data) {
    $('room-name-display').textContent = data.name;
    // Здесь будет логика плеера...
}

function appendChatMessage(msg) {
    const container = $('chat-messages');
    const div = document.createElement('div');
    div.className = `msg-line ${msg.uid === auth.currentUser.uid ? 'self' : ''}`;
    div.innerHTML = `
        <div class="msg-bubble">
            <strong>${escapeHtml(msg.name)}</strong>
            <p>${escapeHtml(msg.text)}</p>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function renderUsersList(users) {
    const container = $('users-list');
    container.innerHTML = '';
    const entries = Object.entries(users);
    $('users-count').textContent = entries.length;

    entries.forEach(([uid, data]) => {
        const div = document.createElement('div');
        div.className = 'user-row';
        div.innerHTML = `
            <div class="avatar-circle small" style="background-image: url(${data.avatar || ''})"></div>
            <span>${escapeHtml(data.name)}</span>
        `;
        div.onclick = () => openUserProfile(uid);
        container.appendChild(div);
    });
}

// --- ИНИЦИАЛИЗАЦИЯ И AUTH ---

function bindEvents() {
    // Вкладки авторизации
    $('tab-login').onclick = () => {
        $('tab-login').classList.add('active');
        $('tab-register').classList.remove('active');
        $('form-login').classList.add('active-form');
        $('form-register').classList.remove('active-form');
    };

    $('tab-register').onclick = () => {
        $('tab-register').classList.add('active');
        $('tab-login').classList.remove('active');
        $('form-register').classList.add('active-form');
        $('form-login').classList.remove('active-form');
    };

    // Кнопки авторизации
    $('btn-login-submit').onclick = async () => {
        const email = $('login-email').value;
        const pass = $('login-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) { showToast("Ошибка: " + e.message); }
    };

    $('btn-register-submit').onclick = async () => {
        const name = $('reg-name').value;
        const username = $('reg-username').value;
        const email = $('reg-email').value;
        const pass = $('reg-password').value;

        if (!name || !username) return showToast("Заполните все поля");

        const check = await checkUsernameUnique(username);
        if (!check.ok) return showToast("Username: " + check.msg);

        try {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            const uid = res.user.uid;
            // Создаем запись пользователя
            await set(ref(db, `users/${uid}`), {
                name,
                username: check.clean,
                email,
                avatar: "",
                status: "Всем привет!",
                createdAt: Date.now()
            });
            // Резервируем username
            await set(ref(db, `usernames/${check.clean}`), uid);
        } catch (e) { showToast("Ошибка: " + e.message); }
    };

    $('btn-logout').onclick = () => signOut(auth);

    // Управление профилем (Свой)
    $('my-profile-trigger').onclick = () => {
        if (!currentUserData) return;
        $('edit-display-name').value = currentUserData.name || "";
        $('edit-status').value = currentUserData.status || "";
        $('edit-avatar-url').value = currentUserData.avatar || "";
        $('edit-username-input').value = currentUserData.username || "";
        $('display-username').textContent = `@${currentUserData.username || 'id'}`;
        $('edit-avatar-preview').style.backgroundImage = `url(${currentUserData.avatar || ''})`;
        $('modal-my-profile').classList.add('active');
    };

    $('btn-close-profile').onclick = () => $('modal-my-profile').classList.remove('active');

    $('btn-save-profile').onclick = async () => {
        const name = $('edit-display-name').value;
        const status = $('edit-status').value;
        const avatar = $('edit-avatar-url').value;
        const newUsername = $('edit-username-input').value;

        const updates = { name, status, avatar };

        // Если username изменился
        if (newUsername !== currentUserData.username) {
            const check = await checkUsernameUnique(newUsername);
            if (!check.ok) return showToast("Username: " + check.msg);
            updates.username = check.clean;
        }

        await updateMyProfile(updates);
        $('modal-my-profile').classList.remove('active');
    };

    // Лобби действия
    $('btn-open-create').onclick = () => $('modal-create').classList.add('active');
    $('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');
    $('btn-confirm-create').onclick = createRoom;

    // Друзья модалка
    $('btn-open-friends').onclick = () => $('modal-friends').classList.add('active');
    
    document.querySelectorAll('.f-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.f-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.friends-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $(btn.dataset.tab).classList.add('active');
        };
    });

    // Поиск друзей
    $('btn-do-search').onclick = async () => {
        const queryStr = $('friend-search-input').value.toLowerCase().replace('@','');
        if (!queryStr) return;
        
        const container = $('search-results-container');
        container.innerHTML = '<div class="empty-state">Поиск...</div>';

        // Ищем через /usernames/
        const snap = await get(ref(db, `usernames/${queryStr}`));
        if (snap.exists()) {
            const foundUid = snap.val();
            const uSnap = await get(ref(db, `users/${foundUid}`));
            const uData = uSnap.val();
            container.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'friend-item glass-panel';
            div.innerHTML = `
                <div class="avatar-circle small" style="background-image: url(${uData.avatar || ''})"></div>
                <div class="friend-info">
                    <strong>${escapeHtml(uData.name)}</strong>
                    <span>@${uData.username}</span>
                </div>
                <button class="primary-btn sm" onclick="app.openUserProfile('${foundUid}')">Профиль</button>
            `;
            container.appendChild(div);
        } else {
            container.innerHTML = '<div class="empty-state">Никто не найден</div>';
        }
    };

    // Чат действия
    $('send-btn').onclick = () => {
        const input = $('chat-input');
        if (!input.value || !currentRoomId) return;
        push(ref(db, `chats/${currentRoomId}`), {
            uid: auth.currentUser.uid,
            name: currentUserData.name,
            text: input.value,
            time: Date.now()
        });
        input.value = '';
    };

    $('tab-chat-btn').onclick = () => {
        $('tab-chat-btn').classList.add('active');
        $('tab-users-btn').classList.remove('active');
        $('chat-messages').style.display = 'block';
        $('users-list').style.display = 'none';
    };

    $('tab-users-btn').onclick = () => {
        $('tab-users-btn').classList.add('active');
        $('tab-chat-btn').classList.remove('active');
        $('chat-messages').style.display = 'none';
        $('users-list').style.display = 'block';
    };

    $('btn-leave-room').onclick = leaveRoom;
}

// Загрузка списка комнат в лобби
function initLobby() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = snap.val() || {};
        const container = $('rooms-grid');
        container.innerHTML = '';
        
        const roomEntries = Object.entries(rooms);
        $('rooms-count-label').textContent = `${roomEntries.length} активных`;

        roomEntries.forEach(([id, data]) => {
            const userCount = data.users ? Object.keys(data.users).length : 0;
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-info">
                    <h3>${escapeHtml(data.name)}</h3>
                    <span>Хост: ID ${data.hostId.substring(0,5)}</span>
                </div>
                <div class="room-meta">
                    <span class="badge">${userCount} 👥</span>
                    ${data.isPrivate ? '<span class="badge">🔒</span>' : ''}
                    <button class="join-btn" onclick="window.app.joinRoom('${id}')">Войти</button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

// Экспортируем для глобального доступа
window.app.joinRoom = joinRoom;

// Точка входа
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Подписываемся на свои данные
        myProfileUnsubscribe = onValue(ref(db, `users/${user.uid}`), (snap) => {
            currentUserData = snap.val();
            if (currentUserData) {
                $('my-name-display').textContent = currentUserData.name || "User";
                $('my-username-display').textContent = `@${currentUserData.username || 'id'}`;
                $('my-avatar-display').style.backgroundImage = `url(${currentUserData.avatar || ''})`;
            }
        });
        
        initFriendSystem();
        initLobby();
        switchScreen('lobby-screen');
    } else {
        if (myProfileUnsubscribe) myProfileUnsubscribe();
        switchScreen('auth-screen');
    }
});

window.onload = bindEvents;