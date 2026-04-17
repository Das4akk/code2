import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, onChildAdded, onDisconnect, remove, update, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// КОНФИГУРАЦИЯ
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
const googleProvider = new GoogleAuthProvider();

// УТИЛИТЫ
const $ = (id) => document.getElementById(id);
const showToast = (txt) => {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = txt;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// СОСТОЯНИЕ
let user = null;
let currentRoomId = null;
let myProfile = {};

// ИНИЦИАЛИЗАЦИЯ
window.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initUiEvents();
});

function initAuth() {
    onAuthStateChanged(auth, (u) => {
        user = u;
        if (user) {
            switchScreen('lobby-screen');
            trackOnline();
            loadMyProfile();
            listenRooms();
        } else {
            switchScreen('auth-screen');
        }
    });
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if ($(id)) $(id).classList.add('active');
}

// ЛОГИКА ПРОФИЛЯ
function loadMyProfile() {
    onValue(ref(db, `users/${user.uid}`), (snap) => {
        myProfile = snap.val() || { name: user.displayName || 'Аноним', color: '#f5f7fa', status: 'В сети' };
        renderHeaderProfile();
    });
}

function renderHeaderProfile() {
    if ($('my-name-display')) $('my-name-display').innerText = myProfile.name;
    if ($('my-status-display')) $('my-status-display').innerText = myProfile.status;
    const avatar = $('my-avatar-preview');
    if (avatar) {
        avatar.style.background = myProfile.color;
        avatar.innerText = myProfile.name.charAt(0).toUpperCase();
    }
}

// ОНЛАЙН ТРЕКИНГ
function trackOnline() {
    const onlineRef = ref(db, '.info/connected');
    onValue(onlineRef, (snap) => {
        if (snap.val() === true) {
            const myStatusRef = ref(db, `online/${user.uid}`);
            onDisconnect(myStatusRef).remove();
            set(myStatusRef, Date.now());
        }
    });
    onValue(ref(db, 'online'), (snap) => {
        const count = snap.size;
        if ($('online-counter')) {
            $('online-counter').style.display = 'block';
            $('online-count').innerText = count;
        }
    });
}

// ЛОББИ И КОМНАТЫ
function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = snap.val() || {};
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        Object.keys(rooms).forEach(id => {
            const r = rooms[id];
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-info">
                    <h3>${r.name}</h3>
                    <small>Админ: ${r.adminName}</small>
                </div>
                <button class="primary-btn">Войти</button>
            `;
            card.querySelector('button').onclick = () => joinRoom(id, r);
            grid.appendChild(card);
        });
    });
}

async function joinRoom(id, roomData) {
    if (roomData.private) {
        $('modal-join-auth').classList.add('active');
        $('btn-join-confirm').onclick = async () => {
            const pass = $('join-password').value;
            if (pass === roomData.password) {
                enterRoom(id, roomData);
                $('modal-join-auth').classList.remove('active');
            } else {
                showToast("Неверный пароль");
            }
        };
    } else {
        enterRoom(id, roomData);
    }
}

function enterRoom(id, roomData) {
    currentRoomId = id;
    switchScreen('room-screen');
    $('current-room-title').innerText = roomData.name;
    
    // Регистрируемся в комнате
    const roomUserRef = ref(db, `rooms/${id}/users/${user.uid}`);
    set(roomUserRef, { name: myProfile.name, color: myProfile.color });
    onDisconnect(roomUserRef).remove();

    initChat(id);
    initVideo(id, roomData);
}

// ЧАТ
function initChat(roomId) {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const container = $('chat-messages');
    container.innerHTML = '';
    
    off(chatRef);
    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        div.className = 'msg';
        div.innerHTML = `<strong>${m.user}:</strong> ${m.text}`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });

    $('send-btn').onclick = () => {
        const input = $('chat-input');
        if (!input.value.trim()) return;
        push(chatRef, {
            uid: user.uid,
            user: myProfile.name,
            text: input.value,
            ts: Date.now()
        });
        input.value = '';
    };
}

// ПЛЕЕР (упрощенная версия)
function initVideo(roomId, data) {
    const root = $('video-player-root');
    root.innerHTML = `<iframe width="100%" height="100%" src="${data.link.replace('watch?v=', 'embed/')}" frameborder="0" allowfullscreen></iframe>`;
}

// UI ИВЕНТЫ
function initUiEvents() {
    $('tab-login').onclick = () => {
        $('form-login').classList.add('active-form');
        $('form-register').classList.remove('active-form');
        $('tab-login').classList.add('active');
        $('tab-register').classList.remove('active');
    };
    $('tab-register').onclick = () => {
        $('form-register').classList.add('active-form');
        $('form-login').classList.remove('active-form');
        $('tab-register').classList.add('active');
        $('tab-login').classList.remove('active');
    };

    $('btn-login').onclick = () => {
        signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value)
            .catch(e => showToast("Ошибка входа: " + e.message));
    };

    $('btn-register').onclick = () => {
        createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value)
            .then(cred => {
                set(ref(db, `users/${cred.user.uid}`), {
                    name: $('reg-name').value,
                    color: '#'+Math.floor(Math.random()*16777215).toString(16),
                    status: 'Новичок'
                });
            })
            .catch(e => showToast("Ошибка регистрации: " + e.message));
    };

    $('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
    $('btn-logout').onclick = () => signOut(auth);

    $('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
    
    $('room-private').onchange = (e) => {
        $('room-password').style.display = e.target.checked ? 'block' : 'none';
    };

    $('btn-create-confirm').onclick = () => {
        const name = $('room-name').value;
        const link = $('room-link').value;
        if (!name || !link) return showToast("Заполните поля");
        
        const newRoomRef = push(ref(db, 'rooms'));
        const roomData = {
            name, link,
            adminUid: user.uid,
            adminName: myProfile.name,
            private: $('room-private').checked,
            password: $('room-password').value
        };
        set(newRoomRef, roomData).then(() => {
            $('modal-create').classList.remove('active');
            enterRoom(newRoomRef.key, roomData);
        });
    };

    $('btn-leave-room').onclick = () => {
        if (currentRoomId) remove(ref(db, `rooms/${currentRoomId}/users/${user.uid}`));
        currentRoomId = null;
        switchScreen('lobby-screen');
    };

    $('open-profile-btn').onclick = () => {
        $('edit-name').value = myProfile.name;
        $('edit-status').value = myProfile.status;
        $('edit-color').value = myProfile.color;
        $('modal-profile').classList.add('active');
    };

    $('btn-save-profile').onclick = () => {
        update(ref(db, `users/${user.uid}`), {
            name: $('edit-name').value,
            status: $('edit-status').value,
            color: $('edit-color').value
        }).then(() => {
            $('modal-profile').classList.remove('active');
            showToast("Профиль обновлен");
        });
    };
}