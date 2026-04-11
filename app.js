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
const videoRef = ref(db, 'native_rave_sync'); // Новая ветка
const chatRef = ref(db, 'chat_messages_rave');

// ЛОКАЛЬНЫЕ ДАННЫЕ ПРОФИЛЯ
let myProfile = {
    name: "",
    avatar: "Felix" // Дефолт
};

let isRemoteAction = false; 
const player = document.getElementById('native-player');
const shutter = document.getElementById('player-shutter');

// --- ДВИЖОК БЕЛЫХ ЧАСТИЦ (Rave-Style) ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5 + 0.1;
        this.speedX = Math.random() * 0.1 - 0.05;
        this.speedY = Math.random() * 0.2 + 0.1; // Плывут вверх
        this.alpha = Math.random() * 0.3 + 0.1;
    }
    update() {
        this.y -= this.speedY; // Движение вверх
        if (this.y < 0) { this.y = canvas.height; this.x = Math.random() * canvas.width; }
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`; // ТЕПЕРЬ БЕЛЫЕ
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
}
function initParticles() {
    particles = [];
    let num = (canvas.width * canvas.height) / 10000;
    for (let i = 0; i < num; i++) particles.push(new Particle());
}
initParticles();
function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) { particles[i].update(); particles[i].draw(); }
    requestAnimationFrame(animateParticles);
}
animateParticles();

// --- ПРЕМИУМ-ФУНКЦИОНАЛ ---
document.addEventListener('DOMContentLoaded', () => {

    // Вход
    document.getElementById('login-btn').onclick = () => {
        const val = document.getElementById('username-input').value.trim();
        if (val) {
            myProfile.name = val;
            document.getElementById('auth-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('main-app').classList.add('active');
            }, 600);
        }
    };

    // УПРАВЛЕНИЕ ПАНЕЛЯМИ (Настройки и Стикеры)
    const setPanel = document.getElementById('settings-panel');
    const stickPanel = document.getElementById('sticker-panel');

    const togglePanel = (panel) => panel.classList.toggle('active');

    document.getElementById('open-settings').onclick = () => {
        document.getElementById('settings-name-input').value = myProfile.name;
        togglePanel(setPanel);
    };
    document.getElementById('close-settings').onclick = () => togglePanel(setPanel);
    document.getElementById('open-stickers').onclick = () => togglePanel(stickPanel);

    // Выбор аватарки
    document.querySelectorAll('.av-p').forEach(av => {
        av.onclick = () => {
            document.querySelectorAll('.av-p').forEach(a => a.classList.remove('active'));
            av.classList.add('active');
            myProfile.avatar = av.getAttribute('data-av');
        }
    });

    // Сохранить настройки
    document.getElementById('save-settings').onclick = () => {
        const newName = document.getElementById('settings-name-input').value.trim();
        if(newName) myProfile.name = newName;
        togglePanel(setPanel);
    };

    // ОТПРАВКА СТИКЕРА
    document.querySelectorAll('.sticker-img').forEach(img => {
        img.onclick = () => {
            const stickerId = img.getAttribute('data-sticker');
            if(myName || myProfile.name) {
                push(chatRef, { 
                    user: myProfile.name, 
                    avatar: myProfile.avatar, 
                    type: 'sticker', 
                    content: stickerId, 
                    ts: Date.now() 
                });
                togglePanel(stickPanel); // Закрыть панель
            }
        }
    });

    // --- СИНХРОНИЗАЦИЯ ВИДЕО ---
    document.querySelectorAll('.ep-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('active')) return;
            set(videoRef, { type: 'change', url: btn.getAttribute('data-mp4'), title: btn.innerText, user: myProfile.name, ts: Date.now() });
        };
    });

    player.onplay = () => { if (!isRemoteAction && myProfile.name) set(videoRef, { type: 'play', time: player.currentTime, user: myProfile.name, ts: Date.now() }); };
    player.onpause = () => { if (!isRemoteAction && myProfile.name) set(videoRef, { type: 'pause', time: player.currentTime, user: myProfile.name, ts: Date.now() }); };
    player.onseeking = () => { if (!isRemoteAction && myProfile.name) set(videoRef, { type: 'seek', time: player.currentTime, user: myProfile.name, ts: Date.now() }); };

    let lastTs = 0;
    onValue(videoRef, (snap) => {
        const data = snap.val();
        if (!data || data.user === myProfile.name || data.ts <= lastTs) return;
        lastTs = data.ts; isRemoteAction = true;

        if (data.type === 'change') {
            shutter.classList.add('active');
            setTimeout(() => {
                player.src = data.url; document.getElementById('current-title').innerText = data.title; player.play();
                document.querySelectorAll('.ep-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mp4') === data.url));
                setTimeout(() => { shutter.classList.remove('active'); }, 200);
            }, 500);
        } else if (data.type === 'play') {
            if (Math.abs(player.currentTime - data.time) > 1) player.currentTime = data.time; player.play();
        } else if (data.type === 'pause') {
            player.pause(); player.currentTime = data.time;
        } else if (data.type === 'seek') { player.currentTime = data.time; }
        setTimeout(() => isRemoteAction = false, 600);
    });

    // --- ЧАТ И СТИКЕРЫ (Получение) ---
    const stickerUrls = {
        heart: 'https://cdn-icons-png.flaticon.com/512/4117/4117961.png',
        wow: 'https://cdn-icons-png.flaticon.com/512/4117/4117951.png',
        cry: 'https://cdn-icons-png.flaticon.com/512/4117/4117947.png',
        popcorn: 'https://cdn-icons-png.flaticon.com/512/1791/1791330.png'
    };

    const sendTextMsg = () => {
        const input = document.getElementById('chat-input');
        if (input.value.trim() && myProfile.name) {
            push(chatRef, { 
                user: myProfile.name, 
                avatar: myProfile.avatar, 
                type: 'text', 
                content: input.value, 
                ts: Date.now() 
            });
            input.value = '';
        }
    };
    document.getElementById('send-btn').onclick = sendTextMsg;
    document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendTextMsg(); };

    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const mainDiv = document.createElement('div');
        const isSelf = m.user === myProfile.name;
        mainDiv.className = isSelf ? 'm-line self' : 'm-line';

        // dicebear апи для генерации аватарок по сиду
        const avatarUrl = `https://api.dicebear.com/8.x/avataaars/svg?seed=${m.avatar}`;
        
        let contentHtml = '';
        if (m.type === 'sticker') {
            contentHtml = `<img src="${stickerUrls[m.content]}" class="sticker-in-chat">`;
        } else {
            contentHtml = `<p>${m.content}</p>`;
        }

        mainDiv.innerHTML = `
            <img src="${avatarUrl}" class="m-avatar">
            <div class="bubble">
                <strong>${m.user}</strong>
                ${contentHtml}
            </div>
        `;

        const chatArea = document.getElementById('chat-messages');
        chatArea.appendChild(mainDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    });
});