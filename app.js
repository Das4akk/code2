import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const provider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence);

const $ = id => document.getElementById(id);

// --- Глобальные состояния ---
let currentRoomId = null;
let isHost = false;
let myStream = null;
let peer = new Peer();
let activeCalls = {};
let roomUnsubs = []; 
let globalRoomSub = null; 

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function showToast(text) {
    const container = $('room-notifications');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast glass-panel';
    toast.innerText = text;
    container.appendChild(toast);
    new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(()=>{});
    setTimeout(() => toast.remove(), 4000);
}

// РЕНДЕР РЕАКЦИИ (ГЛОБАЛЬНЫЙ ДЛЯ Firebase)
window.renderEmoji = function(emoji) {
    const container = $('reaction-layer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;
    el.style.left = Math.random() * 80 + 10 + '%';
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
};

function sendEmoji(emoji) {
    if (!currentRoomId) return;
    push(ref(db, `rooms/${currentRoomId}/reactions`), { emoji, ts: Date.now() });
}

// ВОСПРОИЗВЕДЕНИЕ ГОЛОСА (ФИКС ДЛЯ ПК)
function playRemoteStream(stream, peerId) {
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.className = 'peer-audio-track';
        document.body.appendChild(audio); 
    }
    audio.srcObject = stream;
    audio.volume = $('voice-volume').value;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            console.log("Звук заблокирован политикой ПК. Ждем клика.");
            showToast("Кликните для включения звука участников");
            document.addEventListener('click', () => audio.play(), { once: true });
        });
    }
}

function updateAmbilight() {
    const player = $('native-player');
    const ambiCanvas = $('ambilight-canvas');
    if (!ambiCanvas) return;
    const ambiCtx = ambiCanvas.getContext('2d');
    if (player && !player.paused && !player.ended) {
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(updateAmbilight);
}

// --- ОСНОВНАЯ ЛОГИКА ---

function initRoomLogic() {
    const player = $('native-player');
    const syncRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceRef = ref(db, `rooms/${currentRoomId}/presence`);
    const myPresenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);

    // Отслеживание удаления комнаты
    if(globalRoomSub) globalRoomSub();
    globalRoomSub = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if(!snap.exists() && currentRoomId) {
            alert("Комната была закрыта хостом");
            exitRoom();
        }
    });

    const myName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    set(myPresenceRef, { name: myName });
    onDisconnect(myPresenceRef).remove();

    // Синхронизация списка участников
    roomUnsubs.push(onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        const ul = $('users-list');
        ul.innerHTML = '';
        let count = 0;
        Object.values(data).forEach(u => {
            count++;
            const div = document.createElement('div');
            div.className = 'user-card';
            div.innerHTML = `<span>${u.name}</span>`;
            ul.appendChild(div);
        });
        $('users-count').innerText = count;
    }));

    // Синхронизация видео
    let isRemote = false;
    player.onplay = () => { if(isHost && !isRemote) set(syncRef, { state: 'play', time: player.currentTime }); };
    player.onpause = () => { if(isHost && !isRemote) set(syncRef, { state: 'pause', time: player.currentTime }); };
    
    roomUnsubs.push(onValue(syncRef, (snap) => {
        if(isHost) return;
        const data = snap.val();
        if(!data) return;
        isRemote = true;
        if(Math.abs(player.currentTime - data.time) > 1.5) player.currentTime = data.time;
        data.state === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemote = false, 500);
    }));

    // Чат и реакции для ВСЕХ
    roomUnsubs.push(onChildAdded(chatRef, (snap) => {
        const d = snap.val();
        const msg = document.createElement('div');
        msg.className = `m-line ${d.u === myName ? 'self' : ''}`;
        msg.innerHTML = `<div class="bubble"><strong>${d.u}:</strong> ${d.m}</div>`;
        $('chat-messages').appendChild(msg);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }));

    roomUnsubs.push(onChildAdded(ref(db, `rooms/${currentRoomId}/reactions`), (snap) => {
        window.renderEmoji(snap.val().emoji);
    }));

    // Голосовая связь
    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (rs) => playRemoteStream(rs, call.peer));
    });

    roomUnsubs.push(onValue(voiceRef, (snap) => {
        const data = snap.val();
        if(!data || !myStream) return;
        Object.values(data).forEach(pId => {
            if(pId !== peer.id && !activeCalls[pId]) {
                const call = peer.call(pId, myStream);
                call.on('stream', (rs) => playRemoteStream(rs, pId));
                activeCalls[pId] = true;
            }
        });
    }));

    updateAmbilight();
    showToast("Вы в комнате");
}

// --- ИНТЕРФЕЙС ---

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    $('loader').classList.remove('active');
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email.split('@')[0];
        if (!currentRoomId) showScreen('lobby-screen');
        loadRooms();
    } else {
        showScreen('auth-screen');
    }
});

function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const data = snap.val();
        if(!data) return;
        Object.entries(data).forEach(([id, r]) => {
            const div = document.createElement('div');
            div.className = 'room-card glass-panel';
            div.innerHTML = `<h4>${r.name}</h4><p>Хост: ${r.adminName}</p>
                             <button class="primary-btn" id="join-${id}">Вход</button>`;
            grid.appendChild(div);
            $(`join-${id}`).onclick = () => joinRoom(id, r.name, r.link, r.admin);
        });
    });
}

function joinRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    const player = $('native-player');
    player.src = link;
    player.load();
    $('room-title-text').innerText = name;
    $('btn-delete-room').style.display = isHost ? 'block' : 'none';
    player.controls = isHost;
    player.style.pointerEvents = isHost ? 'auto' : 'none';
    showScreen('room-screen');
    initRoomLogic();
}

function exitRoom() {
    roomUnsubs.forEach(unsub => unsub());
    roomUnsubs = [];
    if(auth.currentUser && currentRoomId) {
        remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
        remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
    }
    currentRoomId = null;
    $('native-player').pause();
    $('native-player').src = '';
    activeCalls = {};
    document.querySelectorAll('.peer-audio-track').forEach(a => a.remove());
    showScreen('lobby-screen');
}

// СОБЫТИЯ
$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value);
$('btn-register-email').onclick = async () => {
    const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
    await updateProfile(res.user, { displayName: $('reg-name').value });
};
$('btn-google-auth').onclick = () => signInWithPopup(auth, provider);
$('btn-logout').onclick = () => signOut(auth);
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const newRef = push(ref(db, 'rooms'));
    await set(newRef, {
        name: $('room-name').value || "Кино",
        link: $('room-link').value,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "Аноним"
    });
    $('modal-create').classList.remove('active');
};

$('send-btn').onclick = () => {
    const val = $('chat-input').value.trim();
    if(val && currentRoomId) { 
        push(ref(db, `rooms/${currentRoomId}/chat`), { u: auth.currentUser.displayName, m: val }); 
        $('chat-input').value = ''; 
    }
};

$('mic-btn').onclick = async () => {
    if(!myStream) {
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            $('mic-btn').classList.add('active');
            set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
        } catch(e) { showToast("Ошибка микрофона"); }
    } else {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
        $('mic-btn').classList.remove('active');
        remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
    }
};

document.querySelectorAll('.react-btn').forEach(btn => {
    btn.onclick = () => sendEmoji(btn.dataset.emoji);
});

$('btn-fullscreen').onclick = () => {
    const pw = $('player-wrapper');
    if (!document.fullscreenElement) pw.requestFullscreen();
    else document.exitFullscreen();
};

$('btn-leave-room').onclick = exitRoom;

// ФОН (ПЛЕКСУС)
const pCanvas = $('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let pts = [];
function resize() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
window.onresize = resize; resize();
class Pt {
    constructor() { 
        this.x = Math.random() * pCanvas.width; this.y = Math.random() * pCanvas.height; 
        this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4; 
    }
    upd() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > pCanvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > pCanvas.height) this.vy *= -1;
        pCtx.fillStyle = "rgba(255,255,255,0.3)"; pCtx.beginPath(); pCtx.arc(this.x, this.y, 1, 0, Math.PI*2); pCtx.fill();
    }
}
for(let i=0; i<60; i++) pts.push(new Pt());
function loop() {
    pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
    pts.forEach(p => {
        p.upd();
        pts.forEach(p2 => {
            let d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if(d < 120) { 
                pCtx.strokeStyle = `rgba(255,255,255,${0.1 - d/1200})`; 
                pCtx.beginPath(); pCtx.moveTo(p.x, p.y); pCtx.lineTo(p2.x, p2.y); pCtx.stroke(); 
            }
        });
    });
    requestAnimationFrame(loop);
}
loop();