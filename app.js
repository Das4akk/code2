import { auth, db, ref, set, get, onValue, push, remove, update, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onChildAdded, onDisconnect, browserLocalPersistence, setPersistence } from './firebase.js';
import { initVoiceChat, toggleMicrophone, stopMicrophone, setGlobalVolume } from './webrtc.js';

const $ = (id) => document.getElementById(id);

// --- Утилиты и Безопасность ---
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}

async function genSalt() { return crypto.getRandomValues(new Uint8Array(16)); }
function bufToBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function base64ToBuf(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 10000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

// --- Состояние приложения ---
let currentRoomId = null;
let isHost = false;
let myProfile = { name: 'Гость', color: '#ffffff', avatar: '' };
const remoteAudioAnalyzers = new Map();

// --- Визуальные эффекты: Particles ---
class Particles {
    constructor() {
        this.canvas = $('particle-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.pts = [];
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.init();
        this.animate();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    init() {
        for (let i = 0; i < 60; i++) {
            this.pts.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4
            });
        }
    }
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.pts.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
            this.ctx.fill();
            for (let j = i + 1; j < this.pts.length; j++) {
                const p2 = this.pts[j];
                const d = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (d < 150) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - d / 150)})`;
                    this.ctx.stroke();
                }
            }
        });
        requestAnimationFrame(() => this.animate());
    }
}
new Particles();

// --- Ambilight Эффект ---
const video = $('native-player');
const ambicv = $('ambilight-canvas');
if (ambicv && video) {
    const actx = ambicv.getContext('2d', { alpha: false });
    function renderAmbi() {
        if (!video.paused && !video.ended) {
            actx.drawImage(video, 0, 0, ambicv.width, ambicv.height);
        }
        requestAnimationFrame(renderAmbi);
    }
    video.addEventListener('play', renderAmbi);
}

// --- Голосовой чат: Визуализация ---
initVoiceChat((uid, audioEl) => {
    createAudioVisualizer(uid, audioEl);
});

function createAudioVisualizer(uid, audioEl) {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const src = context.createMediaStreamSource(audioEl.srcObject);
        const analyzer = context.createAnalyser();
        src.connect(analyzer);
        const data = new Uint8Array(analyzer.frequencyBinCount);
        
        function update() {
            if (!remoteAudioAnalyzers.has(uid)) return;
            analyzer.getByteFrequencyData(data);
            const vol = data.reduce((a, b) => a + b) / data.length;
            const indicator = document.querySelector(`.user-item[data-uid="${uid}"] .voice-indicator`);
            if (indicator) {
                indicator.style.transform = `scale(${1 + vol / 100})`;
                indicator.style.boxShadow = vol > 10 ? `0 0 ${vol / 2}px #2ed573` : 'none';
            }
            requestAnimationFrame(update);
        }
        remoteAudioAnalyzers.set(uid, { context, update });
        update();
    } catch (e) { console.error("Visualizer error:", e); }
}

window.addEventListener('rtc-peer-left', (e) => {
    remoteAudioAnalyzers.delete(e.detail.uid);
});

// --- Авторизация ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        myProfile.name = user.displayName || 'Пользователь';
        showScreen('lobby-screen');
        loadRooms();
    } else {
        showScreen('auth-screen');
    }
});

// --- Логика комнат ---
async function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = snap.val() || {};
        const container = $('rooms-grid');
        container.innerHTML = '';
        for (const id in rooms) {
            const r = rooms[id];
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-card-info">
                    <h3>${escapeHtml(r.name)}</h3>
                    <p>${r.isPrivate ? '🔒 Приватная' : '🌐 Открытая'}</p>
                </div>
                <button class="primary-btn join-btn" data-id="${id}">Войти</button>
            `;
            card.querySelector('.join-btn').onclick = () => tryEnterRoom(id, r);
            container.appendChild(card);
        }
    });
}

async function tryEnterRoom(id, room) {
    if (room.isPrivate) {
        const pass = prompt('Введите пароль:');
        if (!pass) return;
        const salt = base64ToBuf(room.salt);
        const key = await deriveKey(pass, salt);
        const testBuf = base64ToBuf(room.testHash);
        try {
            await crypto.subtle.decrypt({ name: "AES-GCM", iv: salt.slice(0, 12) }, key, testBuf);
            enterRoom(id, room);
        } catch { alert('Неверный пароль'); }
    } else {
        enterRoom(id, room);
    }
}

function enterRoom(id, room) {
    currentRoomId = id;
    isHost = auth.currentUser.uid === room.adminId;
    showScreen('room-screen');
    $('room-title-text').innerText = room.name;
    video.src = room.videoLink;
    video.controls = isHost;
    
    initRoomServices(id);
}

function initRoomServices(id) {
    // Микрофон
    $('mic-btn').onclick = async function() {
        const active = await toggleMicrophone(id);
        this.classList.toggle('active', active);
    };

    // Громкость голоса
    $('voice-volume').oninput = (e) => setGlobalVolume(e.target.value);

    // Чат и синхронизация
    const chatRef = ref(db, `rooms/${id}/chat`);
    onValue(chatRef, (snap) => {
        const msgs = snap.val() || {};
        const area = $('chat-messages');
        area.innerHTML = '';
        for (const mId in msgs) {
            const m = msgs[mId];
            const div = document.createElement('div');
            div.className = 'message';
            div.innerHTML = `<b>${escapeHtml(m.user)}:</b> ${escapeHtml(m.text)}`;
            area.appendChild(div);
        }
        area.scrollTop = area.scrollHeight;
    });

    // Список людей
    const presenceRef = ref(db, `rooms/${id}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: myProfile.name });
    onDisconnect(presenceRef).remove();

    onValue(ref(db, `rooms/${id}/presence`), (snap) => {
        const users = snap.val() || {};
        const list = $('users-list');
        list.innerHTML = '';
        for (const uid in users) {
            const u = users[uid];
            const div = document.createElement('div');
            div.className = 'user-item';
            div.setAttribute('data-uid', uid);
            div.innerHTML = `<div class="voice-indicator"></div> <span>${escapeHtml(u.name)}</span>`;
            list.appendChild(div);
        }
    });
}

// --- Навигация ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

$('btn-leave-room').onclick = () => {
    stopMicrophone();
    if (currentRoomId) remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
    video.pause();
    showScreen('lobby-screen');
};

// Регистрация/Вход (упрощенно)
$('btn-login-email').onclick = () => {
    const email = $('login-email').value;
    const pass = $('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};