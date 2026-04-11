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
const videoRef = ref(db, 'rave_sync_v4');
const chatRef = ref(db, 'rave_chat_v4');

let myUser = { name: "", avatar: "Felix" };
let isRemoteAction = false;
let lastSyncTs = 0;

const player = document.getElementById('native-player');
const chatMessages = document.getElementById('chat-messages');

// --- ФОН ПЛЕКСУС (СЕТЬ) ---
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
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = 1.5;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw() {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < 70; i++) particles.push(new Particle());

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                ctx.strokeStyle = `rgba(100, 100, 100, ${1 - dist / 150})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}
animate();

// --- ВХОД И ЗАПОМИНАНИЕ ---
const savedName = localStorage.getItem('cow_username'); //
if (savedName) document.getElementById('username-input').value = savedName;

document.getElementById('login-btn').onclick = () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
        myUser.name = val;
        localStorage.setItem('cow_username', val); //
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
    }
};

// --- СИНХРОНИЗАЦИЯ И ТВОЯ ССЫЛКА ---
// Вставляем твою ссылку в качестве дефолтной
const targetVideo = "https://disk.yandex.ru/d/yatnPdwx--ofDw"; 

player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, user: myUser.name, ts: Date.now() }); };
player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, user: myUser.name, ts: Date.now() }); };

onValue(videoRef, (snap) => {
    const d = snap.val();
    if (!d || d.user === myUser.name || d.ts <= lastSyncTs) return;
    lastSyncTs = d.ts;
    isRemoteAction = true;
    if (d.type === 'play') { player.currentTime = d.time; player.play(); }
    if (d.type === 'pause') { player.pause(); player.currentTime = d.time; }
    setTimeout(() => isRemoteAction = false, 1000);
});

// --- ЧАТ ---
const sendMsg = () => {
    const inp = document.getElementById('chat-input');
    if (inp.value.trim()) {
        push(chatRef, { user: myUser.name, av: myUser.avatar, content: inp.value.trim() });
        inp.value = '';
    }
};

document.getElementById('send-btn').onclick = sendMsg;
document.getElementById('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };

onChildAdded(chatRef, (snap) => {
    const m = snap.val();
    const div = document.createElement('div');
    div.className = m.user === myUser.name ? 'm-line self' : 'm-line';
    div.innerHTML = `
        <div class="bubble"><strong>${m.user}</strong><p>${m.content}</p></div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});