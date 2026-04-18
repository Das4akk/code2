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

// Глобальная утилита выбора элементов
window.$ = (id) => document.getElementById(id);

// ==========================================
// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
// ==========================================
let currentRoomId = null;
let roomListenerUnsubscribe = null;
let editingRoomId = null;
let userProfiles = {}; // Кэш профилей пользователей {uid: {name, photo}}
let myStream = null;
let peerConnections = {}; // Голосовые соединения

// ==========================================
// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
// ==========================================
function showToast(text) {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId)?.classList.add('active');
    
    // Показываем/скрываем счетчик онлайна
    if (screenId === 'lobby-screen') {
        $('online-counter').style.display = 'flex';
    } else {
        $('online-counter').style.display = 'none';
    }
}

// ==========================================
// --- АВТОРИЗАЦИЯ (AUTH) ---
// ==========================================
function bindAuth() {
    // Переключение вкладок (Логин/Регистрация)
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

    // Вход по Email
    $('btn-login').onclick = async () => {
        const email = $('login-email').value;
        const pass = $('login-password').value;
        if (!email || !pass) return showToast("Заполните все поля");
        try {
            await setPersistence(auth, browserLocalPersistence);
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            showToast("Ошибка входа: " + e.message);
        }
    };

    // Регистрация
    $('btn-register').onclick = async () => {
        const name = $('reg-name').value;
        const email = $('reg-email').value;
        const pass = $('reg-password').value;
        if (!name || !email || !pass) return showToast("Заполните все поля");
        try {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
            // Сохраняем профиль в БД
            await set(ref(db, `users/${res.user.uid}`), {
                name,
                email,
                createdAt: Date.now()
            });
        } catch (e) {
            showToast("Ошибка регистрации: " + e.message);
        }
    };

    // Google Auth
    $('btn-google').onclick = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            showToast("Google Error: " + e.message);
        }
    };

    // Выход
    $('btn-logout').onclick = () => signOut(auth);
}

// ==========================================
// --- ПРОФИЛИ И ПРИСУТСТВИЕ ---
// ==========================================
function bindSelfPresence() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const statusRef = ref(db, `status/${user.uid}`);
            set(statusRef, { online: true, lastSeen: Date.now(), name: user.displayName });
            onDisconnect(statusRef).remove();
        }
    });

    // Глобальный счетчик онлайна
    onValue(ref(db, 'status'), (snap) => {
        const count = snap.size || 0;
        if ($('online-count')) $('online-count').textContent = count;
    });
}

function getUserProfile(uid, callback) {
    if (userProfiles[uid]) return callback(userProfiles[uid]);
    get(ref(db, `users/${uid}`)).then(snap => {
        const data = snap.val() || { name: "Аноним" };
        userProfiles[uid] = data;
        callback(data);
    });
}

// ==========================================
// --- ЛОББИ И КОМНАТЫ ---
// ==========================================
function initLobby() {
    const roomsContainer = $('rooms-list');
    onValue(ref(db, 'rooms'), (snap) => {
        roomsContainer.innerHTML = '';
        const rooms = snap.val();
        if (!rooms) {
            roomsContainer.innerHTML = '<div class="empty-state">Пока нет созданных комнат...</div>';
            return;
        }

        Object.keys(rooms).forEach(id => {
            const room = rooms[id];
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-info">
                    <h3>${escapeHtml(room.name)}</h3>
                    <p>${room.isPrivate ? '🔒 Приватная' : '🌐 Открытая'}</p>
                </div>
                <button class="join-btn" data-id="${id}">Войти</button>
            `;
            card.querySelector('.join-btn').onclick = () => joinRoom(id, room);
            roomsContainer.appendChild(card);
        });
    });

    // Создание комнаты
    $('btn-open-create').onclick = () => $('modal-create').classList.add('active');
    $('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');
    
    $('btn-confirm-create').onclick = async () => {
        const name = $('room-name-input').value;
        const isPrivate = $('room-private-check').checked;
        const password = $('room-pass-input').value;
        
        if (!name) return showToast("Введите название");

        const newRoomRef = push(ref(db, 'rooms'));
        await set(newRoomRef, {
            name,
            isPrivate,
            password: isPrivate ? password : null,
            hostId: auth.currentUser.uid,
            createdAt: Date.now()
        });
        
        $('modal-create').classList.remove('active');
        showToast("Комната создана!");
    };
}

async function joinRoom(roomId, roomData) {
    if (roomData.isPrivate) {
        const pass = prompt("Введите пароль для входа:");
        if (pass !== roomData.password) return showToast("Неверный пароль");
    }
    
    currentRoomId = roomId;
    switchScreen('room-screen');
    initRoomLogic(roomId);
}

// ==========================================
// --- ЛОГИКА ВНУТРИ КОМНАТЫ ---
// ==========================================
function initRoomLogic(roomId) {
    const chatContainer = $('chat-messages');
    const chatInput = $('chat-input');
    const sendBtn = $('send-btn');
    
    chatContainer.innerHTML = '';
    
    // Подписка на чат
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const chatUnsub = onChildAdded(chatRef, (snap) => {
        const msg = snap.val();
        getUserProfile(msg.uid, (profile) => {
            const div = document.createElement('div');
            div.className = `message ${msg.uid === auth.currentUser.uid ? 'self' : ''}`;
            div.innerHTML = `
                <div class="msg-content">
                    <strong>${escapeHtml(profile.name)}</strong>
                    <p>${escapeHtml(msg.text)}</p>
                </div>
            `;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    });

    // Отправка сообщения
    const sendMessage = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        push(chatRef, {
            uid: auth.currentUser.uid,
            text: text,
            timestamp: Date.now()
        });
        chatInput.value = '';
    };

    sendBtn.onclick = sendMessage;
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

    // Кнопка выхода из комнаты
    $('btn-leave-room').onclick = () => {
        off(chatRef);
        currentRoomId = null;
        switchScreen('lobby-screen');
    };

    // Вкладки Чат/Люди
    $('tab-chat-btn').onclick = () => {
        $('chat-messages').style.display = 'block';
        $('users-list').style.display = 'none';
        $('tab-chat-btn').classList.add('active');
        $('tab-users-btn').classList.remove('active');
    };
    $('tab-users-btn').onclick = () => {
        $('chat-messages').style.display = 'none';
        $('users-list').style.display = 'block';
        $('tab-users-btn').classList.add('active');
        $('tab-chat-btn').classList.remove('active');
    };

    // Синхронизация плеера (упрощенная)
    const video = document.querySelector('video');
    const roomStateRef = ref(db, `rooms/${roomId}/state`);
    
    onValue(roomStateRef, (snap) => {
        const state = snap.val();
        if (!state) return;
        // Здесь логика синхронизации времени и паузы
    });
}

// ==========================================
// --- ВИЗУАЛЬНЫЕ ЭФФЕКТЫ (Particles) ---
// ==========================================
function initParticles() {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dots = [];
    
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.onresize = resize;
    resize();

    class Dot {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
        }
        draw() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    for (let i = 0; i < 60; i++) dots.push(new Dot());

    function anim() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.forEach(d => {
            d.draw();
            dots.forEach(d2 => {
                let dist = Math.sqrt((d.x - d2.x)**2 + (d.y - d2.y)**2);
                if (dist < 100) {
                    ctx.strokeStyle = `rgba(255,255,255,${0.15 - dist/700})`;
                    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
                }
            });
        });
        requestAnimationFrame(anim);
    }
    anim();
}

// ==========================================
// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
// ==========================================
window.onload = () => {
    bindAuth();
    initParticles();
    bindSelfPresence();
    initLobby();

    // Слушатель состояния авторизации
    onAuthStateChanged(auth, (user) => {
        if (user) {
            switchScreen('lobby-screen');
        } else {
            switchScreen('auth-screen');
        }
    });
};