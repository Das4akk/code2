import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- КОНФИГУРАЦИЯ ---
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

// --- ДВИЖОК ФОНОВЫХ ЧАСТИЦ (HIGH END) ---
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
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 1.8 + 0.2;
        this.speedY = Math.random() * 0.6 + 0.3;
        this.alpha = Math.random() * 0.4 + 0.1;
        this.oscillation = Math.random() * 0.02;
        this.angle = Math.random() * Math.PI * 2;
    }
    update() {
        this.y -= this.speedY;
        this.x += Math.sin(this.angle) * 0.3;
        this.angle += this.oscillation;
        if (this.y < -20) this.reset();
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < 120; i++) particles.push(new Particle());

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

// --- ЛОГИКА АВАТАРОВ И ВХОДА ---
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
        document.getElementById('auth-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-app').classList.add('active');
        }, 500);
    }
};

// --- ВИДЕО СИНХРОНИЗАЦИЯ (PREMIUM) ---
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

// --- ЧАТ И СТИКЕРЫ (Rave Engine) ---
const stickerPanel = document.getElementById('sticker-panel');
document.getElementById('open-stickers').onclick = () => stickerPanel.classList.toggle('active');

const stickerMap = {
    heart: 'https://cdn-icons-png.flaticon.com/512/4117/4117961.png',
    wow: 'https://cdn-icons-png.flaticon.com/512/4117/4117951.png',
    cry: 'https://cdn-icons-png.flaticon.com/512/4117/4117947.png',
    popcorn: 'https://cdn-icons-png.flaticon.com/512/1791/1791330.png'
};

document.querySelectorAll('.st-item').forEach(s => {
    s.onclick = () => {
        push(chatRef, { user: myUser.name, av: myUser.avatar, type: 'sticker', content: s.dataset.st });
        stickerPanel.classList.remove('active');
    };
});

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
    
    let contentHtml = m.type === 'sticker' 
        ? `<img src="${stickerMap[m.content]}" class="chat-sticker">` 
        : `<p>${m.content}</p>`;
    
    div.innerHTML = `
        <img src="https://api.dicebear.com/8.x/avataaars/svg?seed=${m.av}" class="m-avatar">
        <div class="bubble">
            <strong>${m.user}</strong>
            ${contentHtml}
        </div>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});