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
const videoRef = ref(db, 'rave_sync_master_v3');
const chatRef = ref(db, 'rave_chat_master_v3');

let myUser = { name: "", avatar: "Felix" };
let isRemoteAction = false;
let lastSyncTs = 0;

const player = document.getElementById('native-player');
const shutter = document.getElementById('player-shutter');
const chatMessages = document.getElementById('chat-messages');

// --- ДВИЖОК ФОНА: ПЛЕКСУС (СЕТЬ) ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = initCanvas;
initCanvas();

class Particle {
    constructor() {
        // Частицы сразу разбросаны по всему экрану
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.size = Math.random() * 2 + 0.5;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Отскок от краев экрана
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw() {
        ctx.fillStyle = 'rgba(150, 150, 150, 0.6)'; // Серые точки
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Создаем 80 частиц
for (let i = 0; i < 80; i++) particles.push(new Particle());

function animatePlexus() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем линии между близкими частицами
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 120) {
                // Чем ближе точки, тем ярче линия
                ctx.strokeStyle = `rgba(150, 150, 150, ${1 - dist / 120})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animatePlexus);
}
animatePlexus();


// --- ЛОГИКА АВАТАРОВ И ВХОДА (И ЗАПОМИНАНИЕ) ---

// Проверяем, есть ли сохраненный никнейм
const savedName = localStorage.getItem('cow_username');
if (savedName) {
    document.getElementById('username-input').value = savedName;
}

document.querySelectorAll('.av-item').forEach(el => {
    el.onclick = () => {
        document.querySelector('.av-item.active').classList.remove('active');
        el.classList.add('active');
        myUser.avatar = el.dataset.av;
    };
});

document.getElementById('login-btn').onclick = () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
        myUser.name = val;
        // Запоминаем в браузере
        localStorage.setItem('cow_username', val); 
        
        document.getElementById('auth-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-app').classList.add('active');
        }, 500);
    }
};

// --- ВИДЕО СИНХРОНИЗАЦИЯ ---
const sync = (type, time) => {
    if (isRemoteAction || !myUser.name) return;
    set(videoRef, {
        type: type,
        time: time || player.currentTime,
        user: myUser.name,
        ts: Date.now()
    });
};

player.onplay = () => sync('play');
player.onpause = () => sync('pause');
player.onseeking = () => sync('seek');

document.querySelectorAll('.ep-btn').forEach(btn => {
    btn.onclick = () => {
        if (btn.classList.contains('active')) return;
        const url = btn.getAttribute('data-mp4');
        set(videoRef, { type: 'change', url: url, title: btn.innerText, user: myUser.name, ts: Date.now() });
    };
});

onValue(videoRef, (snap) => {
    const d = snap.val();
    if (!d || d.user === myUser.name || d.ts <= lastSyncTs) return;
    lastSyncTs = d.ts;
    isRemoteAction = true;

    if (d.type === 'change') {
        shutter.classList.add('active');
        setTimeout(() => {
            player.src = d.url;
            document.getElementById('current-title').innerText = d.title;
            player.play();
            document.querySelectorAll('.ep-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mp4') === d.url));
            setTimeout(() => shutter.classList.remove('active'), 300);
        }, 600);
    } else if (d.type === 'play') {
        player.currentTime = d.time;
        player.play();
    } else if (d.type === 'pause') {
        player.pause();
        player.currentTime = d.time;
    } else if (d.type === 'seek') {
        player.currentTime = d.time;
    }
    
    document.getElementById('status').innerText = `${d.type} by ${d.user}`;
    setTimeout(() => isRemoteAction = false, 1000);
});


// --- ЧАТ (ТОЛЬКО ТЕКСТ) ---
const sendMsg = () => {
    const inp = document.getElementById('chat-input');
    if (inp.value.trim()) {
        push(chatRef, { user: myUser.name, av: myUser.avatar, type: 'text', content: inp.value.trim() });
        inp.value = '';
    }
};

document.getElementById('send-btn').onclick = sendMsg;
document.getElementById('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };

onChildAdded(chatRef, (snap) => {
    const m = snap.val();
    const div = document.createElement('div');
    const isSelf = m.user === myUser.name;
    div.className = isSelf ? 'm-line self' : 'm-line';
    
    div.innerHTML = `
        <img src="https://api.dicebear.com/8.x/avataaars/svg?seed=${m.av}" class="m-avatar">
        <div class="bubble">
            <strong>${m.user}</strong>
            <p>${m.content}</p>
        </div>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});