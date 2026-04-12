import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);

let currentRoomId = null;
let ytPlayer = null;
let syncInterval = null;

// ПЕРЕКЛЮЧАТЕЛЬ ЭКРАНОВ
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// ПРОВЕРКА ВХОДА
onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        showScreen('lobby-screen');
        listenRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// МОДАЛКА И СОЗДАНИЕ
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    const pass = $('room-pass').value;
    if(!name || !link) return alert("Введите данные");

    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, {
        name, link, password: pass || null,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "User"
    });
    $('modal-create').classList.remove('active');
};

// ВХОД В КОМНАТУ
async function enterRoom(id, room) {
    if(room.password && room.admin !== auth.currentUser.uid) {
        const p = prompt("Введите пароль:");
        if(p !== room.password) return alert("Неверно!");
    }

    currentRoomId = id;
    const isAdmin = room.admin === auth.currentUser.uid;
    showScreen('room-screen');
    $('current-room-name').innerText = room.name;
    
    if(isAdmin) { $('admin-label').classList.remove('hidden'); $('player-blocker').classList.add('hidden'); }
    else { $('admin-label').classList.add('hidden'); $('player-blocker').classList.remove('hidden'); }

    initPlayer(room.link, isAdmin);
    initSync(id, isAdmin);
    initOnline(id);
    initChat(id);
}

// УМНЫЙ ПЛЕЕР
function initPlayer(link, isAdmin) {
    const container = $('player-container');
    container.innerHTML = '';
    
    if(link.includes('youtube') || link.includes('youtu.be')) {
        const vid = link.split('v=')[1] || link.split('/').pop();
        container.innerHTML = `<div id="yt-player"></div>`;
        ytPlayer = new YT.Player('yt-player', {
            videoId: vid,
            playerVars: { controls: isAdmin ? 1 : 0, disablekb: isAdmin ? 0 : 1 },
            events: { 'onReady': () => { if(!isAdmin) ytPlayer.mute(); } }
        });
    } else {
        container.innerHTML = `<video id="video-core" src="${link}" ${isAdmin?'controls':''}></video>`;
    }
}

// СИНХРОНИЗАЦИЯ
function initSync(id, isAdmin) {
    const syncRef = ref(db, `rooms/${id}/sync`);
    if(isAdmin) {
        syncInterval = setInterval(() => {
            const time = ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : $('video-core')?.currentTime;
            const state = ytPlayer?.getPlayerState ? ytPlayer.getPlayerState() : ($('video-core')?.paused ? 2 : 1);
            set(syncRef, { time, state, sender: auth.currentUser.uid });
        }, 1500);
    } else {
        onValue(syncRef, (snap) => {
            const s = snap.val();
            if(!s) return;
            const core = $('video-core');
            if(ytPlayer?.seekTo) {
                if(Math.abs(ytPlayer.getCurrentTime() - s.time) > 3) ytPlayer.seekTo(s.time);
                s.state === 1 ? ytPlayer.playVideo() : ytPlayer.pauseVideo();
            } else if(core) {
                if(Math.abs(core.currentTime - s.time) > 3) core.currentTime = s.time;
                s.state === 1 ? core.play() : core.pause();
            }
        });
    }
}

// ОНЛАЙН И ЧАТ
function initOnline(id) {
    const presenceRef = ref(db, `rooms/${id}/online/${auth.currentUser.uid}`);
    set(presenceRef, true);
    onDisconnect(presenceRef).remove();
    onValue(ref(db, `rooms/${id}/online`), (s) => $('online-count').innerText = s.val() ? Object.keys(s.val()).length : 0);
}

function initChat(id) {
    const chatRef = ref(db, `rooms/${id}/chat`);
    onValue(chatRef, (s) => {
        const box = $('chat-messages'); box.innerHTML = '';
        if(s.val()) Object.values(s.val()).forEach(m => {
            box.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

$('btn-send-msg').onclick = () => {
    const t = $('chat-input').value;
    if(!t) return;
    push(ref(db, `rooms/${currentRoomId}/chat`), { user: auth.currentUser.displayName || "Anon", text: t });
    $('chat-input').value = '';
};

// ЧИСТЫЙ ВОЙС (Echo Cancellation)
let micStream = null;
$('btn-mic').onclick = async () => {
    if(!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        $('btn-mic').classList.replace('mic-off', 'mic-on');
    } else {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
        $('btn-mic').classList.replace('mic-on', 'mic-off');
    }
};

// НЕЙРОСЕТЬ (ФОН)
const canvas = $('particle-canvas'); const ctx = canvas.getContext('2d'); let dots = [];
const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.onresize = resize; resize();
for(let i=0; i<70; i++) dots.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5 });
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.x+=d.vx; d.y+=d.vy; if(d.x<0||d.x>canvas.width) d.vx*=-1; if(d.y<0||d.y>canvas.height) d.vy*=-1;
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(d.x, d.y, 1.2, 0, Math.PI*2); ctx.fill();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 100) { ctx.strokeStyle = `rgba(255,255,255,${0.1 - dist/1000})`; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke(); }
        });
    });
    requestAnimationFrame(anim);
}
anim();