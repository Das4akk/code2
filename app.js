import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnLHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const videoRef = ref(db, 'native_premium_sync'); // Новая ветка для нового стиля
const chatRef = ref(db, 'chat_messages');

let myName = "";
let isRemoteAction = false; 
const player = document.getElementById('native-player');
const shutter = document.getElementById('player-shutter');

// --- ДВИЖОК МАГИЧЕСКОГО ФОНА (PARTICLE SYSTEM) ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.3 - 0.15;
        this.speedY = Math.random() * 0.3 - 0.15;
        this.alpha = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x > canvas.width) this.x = 0; else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0; else if (this.y < 0) this.y = canvas.height;
        
        // Реакция на мышь
        if (mouse.x && mouse.y) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < 120) {
                this.x -= dx * 0.005;
                this.y -= dy * 0.005;
            }
        }
    }
    draw() {
        ctx.fillStyle = `rgba(212, 175, 55, ${this.alpha})`; // Золотые частицы
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    let numberOfParticles = (canvas.width * canvas.height) / 15000;
    for (let i = 0; i < numberOfParticles; i++) { particles.push(new Particle()); }
}
initParticles();

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();

// --- ПРЕМИУМ ЛОГИКА ---
document.addEventListener('DOMContentLoaded', () => {

    // --- ВХОД С АНИМАЦИЕЙ ПЕРЕХОДА ---
    document.getElementById('login-btn').onclick = () => {
        const val = document.getElementById('username-input').value.trim();
        if (val) {
            myName = val;
            const authScreen = document.getElementById('auth-screen');
            const mainApp = document.getElementById('main-app');
            
            authScreen.style.opacity = '0';
            authScreen.style.transform = 'scale(1.1)'; // Выплывание
            
            setTimeout(() => {
                authScreen.classList.remove('active');
                mainApp.classList.add('active');
            }, 600); // Синхронно с CSS кривой
        }
    };

    // --- СМЕНА СЕРИИ С ЭФФЕКТОМ "ШТОРКИ" ---
    document.querySelectorAll('.ep-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('active')) return;
            const url = btn.getAttribute('data-mp4');
            const title = btn.innerText;
            
            // Анимация в Firebase
            set(videoRef, { type: 'change', url: url, title: title, user: myName, ts: Date.now() });
        };
    });

    function applyChangeEpisode(data) {
        shutter.classList.add('active'); // Шторка ЗАКРЫВАЕТСЯ
        
        setTimeout(() => {
            player.src = data.url;
            document.getElementById('current-title').innerText = data.title;
            player.play().catch(() => console.log("Браузер заблокировал автоплей"));
            
            document.querySelectorAll('.ep-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mp4') === data.url));
            
            setTimeout(() => { shutter.classList.remove('active'); }, 200); // Шторка ОТКРЫВАЕТСЯ
        }, 500); // Пока плеер скрыт
    }

    // --- ОТПРАВКА ДЕЙСТВИЙ ---
    player.onplay = () => {
        if (!isRemoteAction && myName) set(videoRef, { type: 'play', time: player.currentTime, user: myName, ts: Date.now() });
    };
    player.onpause = () => {
        if (!isRemoteAction && myName) set(videoRef, { type: 'pause', time: player.currentTime, user: myName, ts: Date.now() });
    };
    player.onseeking = () => {
        if (!isRemoteAction && myName) set(videoRef, { type: 'seek', time: player.currentTime, user: myName, ts: Date.now() });
    };

    // --- ПОЛУЧЕНИЕ КОМАНД ---
    let lastTs = 0;
    onValue(videoRef, (snap) => {
        const data = snap.val();
        if (!data || data.user === myName || data.ts <= lastTs) return;
        lastTs = data.ts;
        isRemoteAction = true;

        if (data.type === 'change') {
            applyChangeEpisode(data);
        } else if (data.type === 'play') {
            if (Math.abs(player.currentTime - data.time) > 1) player.currentTime = data.time;
            player.play();
        } else if (data.type === 'pause') {
            player.pause();
            player.currentTime = data.time;
        } else if (data.type === 'seek') {
            player.currentTime = data.time;
        }

        document.getElementById('status').innerText = `${data.type} от ${data.user}`;
        setTimeout(() => isRemoteAction = false, 800); // Увеличенный блокиратор
    });

    // --- ЧАТ (Плавное появление встроенно в CSS) ---
    const sendMsg = () => {
        const input = document.getElementById('chat-input');
        if (input.value.trim() && myName) {
            push(chatRef, { user: myName, text: input.value });
            input.value = '';
        }
    };
    document.getElementById('send-btn').onclick = sendMsg;
    document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendMsg(); };

    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        div.className = m.user === myName ? 'bubble self bubble-animate' : 'bubble bubble-animate';
        div.innerHTML = `<strong>${m.user}</strong>${m.text}`;
        const chatArea = document.getElementById('chat-messages');
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    });
});