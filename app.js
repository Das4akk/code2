import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato", // Твой ключ
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

// Переключение экранов
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
}

// Слушатель входа
onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        showScreen('lobby-screen');
        loadRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// Табы логина/реги
$('tab-login').onclick = () => {
    $('form-login').classList.remove('hidden-form');
    $('form-register').classList.add('hidden-form');
};
$('tab-register').onclick = () => {
    $('form-login').classList.add('hidden-form');
    $('form-register').classList.remove('hidden-form');
};

// Вход и Выход
$('btn-login-email').onclick = () => {
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
};
$('btn-logout').onclick = () => signOut(auth);

// Модалка
$('btn-open-modal').onclick = () => $('modal-create').style.display = 'flex';
$('btn-close-modal').onclick = () => $('modal-create').style.display = 'none';

// Создание комнаты
$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if (!name || !link) return alert("Заполни поля");

    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, {
        name,
        link,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "User"
    });
    $('modal-create').style.display = 'none';
};

// Загрузка комнат в сетку
function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const rooms = snap.val();
        if (rooms) {
            Object.entries(rooms).forEach(([id, data]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `
                    <h4>${data.name}</h4>
                    <p style="font-size: 0.8rem; opacity: 0.6">Админ: ${data.adminName}</p>
                    <button class="primary-btn enter-btn" data-id="${id}">Войти</button>
                `;
                card.querySelector('.enter-btn').onclick = () => enterRoom(data);
                grid.appendChild(card);
            });
        }
    });
}

// ТА САМАЯ КОМНАТА
function enterRoom(roomData) {
    showScreen('room-screen');
    $('current-room-name').innerText = roomData.name;
    const player = $('main-player');
    player.src = roomData.link;
    player.load();
}

$('btn-leave-room').onclick = () => {
    $('main-player').pause();
    $('main-player').src = "";
    showScreen('lobby-screen');
};

// Плексус (Фон)
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let dots = [];
const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.onresize = resize; resize();

for(let i=0; i<80; i++) dots.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4 });

function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if(d.x<0 || d.x>canvas.width) d.vx*=-1;
        if(d.y<0 || d.y>canvas.height) d.vy*=-1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(d.x, d.y, 1, 0, Math.PI*2); ctx.fill();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 100) {
                ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/500})`;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();