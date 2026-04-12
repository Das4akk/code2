import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Твой рабочий конфиг из скриншота 411585
const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

// --- УПРАВЛЕНИЕ ЭКРАНАМИ И ПРЕЛОАДЕРОМ ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
}

// Слушаем статус авторизации (АВТОВХОД)
onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email.split('@')[0];
        showScreen('lobby-screen');
        loadDummyRooms(); // Показываем моковые комнаты для красоты
    } else {
        showScreen('auth-screen');
    }
    // Выключаем загрузочный экран только когда Firebase дал ответ
    $('loader').classList.remove('active');
});

// --- АНИМАЦИЯ ПЕРЕКЛЮЧЕНИЯ ВХОД/РЕГИСТРАЦИЯ ---
const tabLogin = $('tab-login');
const tabRegister = $('tab-register');
const formLogin = $('form-login');
const formRegister = $('form-register');
const tabsContainer = document.querySelector('.auth-tabs');

tabLogin.onclick = () => {
    tabsContainer.classList.remove('register-active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    
    formRegister.className = 'auth-form hidden-form right';
    formLogin.className = 'auth-form active-form';
};

tabRegister.onclick = () => {
    tabsContainer.classList.add('register-active');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    
    formLogin.className = 'auth-form hidden-form left';
    formRegister.className = 'auth-form active-form';
};

// --- АВТОРИЗАЦИЯ ---
$('btn-login-email').onclick = async () => {
    $('loader').classList.add('active'); // Включаем лоадер при клике
    try {
        await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value);
    } catch (e) {
        $('loader').classList.remove('active');
        alert("Ошибка входа: " + e.message);
    }
};

$('btn-register-email').onclick = async () => {
    $('loader').classList.add('active');
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
        window.location.reload(); // Перезагружаем для применения имени
    } catch (e) {
        $('loader').classList.remove('active');
        alert("Ошибка регистрации: " + e.message);
    }
};

$('btn-google-auth').onclick = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (e) { console.error(e); }
};

$('btn-logout').onclick = () => {
    $('loader').classList.add('active');
    signOut(auth);
};

// --- ГЕНЕРАЦИЯ КРАСИВЫХ КОМНАТ ДЛЯ ТЕСТА ---
function loadDummyRooms() {
    const grid = $('rooms-grid');
    grid.innerHTML = '';
    const demoRooms = [
        { name: "Ночной Кинопоказ", online: 12, desc: "Смотрим триллер" },
        { name: "Аниме марафон", online: 45, desc: "Evangelion 1.0" },
        { name: "Chill & Lofi", online: 8, desc: "Музыка и общение" },
        { name: "Разбор кода", online: 3, desc: "Пишем на JS" }
    ];

    demoRooms.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <h4>${room.name}</h4>
            <p>${room.desc}</p>
            <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; color: #4CAF50;">● ${room.online} онлайн</span>
                <button class="primary-btn" style="padding: 8px 15px; width: auto; font-size: 0.9rem;">Войти</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- ФОНОВЫЕ ЧАСТИЦЫ ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();
class P {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.3; this.vy = (Math.random()-0.5)*0.3; }
    update() { this.x += this.vx; this.y += this.vy; if(this.x<0||this.x>canvas.width)this.vx*=-1; if(this.y<0||this.y>canvas.height)this.vy*=-1; }
}
for(let i=0; i<60; i++) particles.push(new P());
function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
        p.update(); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2); ctx.fill();
        particles.forEach(p2 => {
            let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
            if(d<120) { ctx.strokeStyle = `rgba(255,255,255,${0.15 - d/800})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
        });
    });
    requestAnimationFrame(animate);
}
animate();