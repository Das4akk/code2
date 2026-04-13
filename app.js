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

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Утилиты) ---

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

function renderEmoji(emoji) {
    const container = $('reaction-layer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;
    el.style.left = Math.random() * 80 + 10 + '%';
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function sendEmoji(emoji) {
    if (!currentRoomId) return;
    push(ref(db, `rooms/${currentRoomId}/reactions`), { emoji, ts: Date.now() });
}

function formatMessageWithTimecodes(text) {
    return text.replace(/(\d{1,2}:\d{2})/g, '<span class="time-link" onclick="window.seekToTime(\'$1\')">$1</span>');
}

window.seekToTime = (timeStr) => {
    if (!isHost) return showToast("Только хост может перематывать");
    const [m, s] = timeStr.split(':').map(Number);
    $('native-player').currentTime = m * 60 + s;
};

function playRemoteStream(stream, peerId) {
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.autoplay = true;
        audio.className = 'peer-audio-track';
        document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.volume = $('voice-volume').value;
    audio.play().catch(() => console.log("Ждем взаимодействия пользователя для звука"));
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

// --- ЛОГИКА КОМНАТЫ ---

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

    // Список участников
    roomUnsubs.push(onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        const ul = $('users-list');
        ul.innerHTML = '';
        let count = 0;
        Object.values(data).forEach(u => {
            count++;
            const div = document.createElement('div');
            div.className = 'user-card';
            div.innerHTML = `<div class="avatar-circle" style="width:32px; height:32px;"></div><span>${u.name}</span>`;
            ul.appendChild(div);
        });
        $('users-count').innerText = count;
    }));

    // Синхронизация видео
    let isRemote = false;
    player.onplay = () => { if(isHost && !isRemote) set(syncRef, { state: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemote) set(syncRef, { state: 'pause', time: player.currentTime, ts: Date.now() }); };
    player.ontimeupdate = () => { if(isHost) localStorage.setItem(`cow_pos_${currentRoomId}`, player.currentTime); };

    roomUnsubs.push(onValue(syncRef, (snap) => {
        if(isHost) return;
        const data = snap.val();
        if(!data) return;
        isRemote = true;
        if(Math.abs(player.currentTime - data.time) > 1.5) player.currentTime = data.time;
        data.state === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemote = false, 500);
    }));

    // Чат и реакции
    roomUnsubs.push(onChildAdded(chatRef, (snap) => {
        const d = snap.val();
        const msg = document.createElement('div');
        msg.className = `m-line ${d.u === myName ? 'self' : ''}`;
        msg.innerHTML = `<div class="bubble"><strong>${d.u}</strong>${formatMessageWithTimecodes(d.m)}</div>`;
        $('chat-messages').appendChild(msg);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }));

    roomUnsubs.push(onChildAdded(ref(db, `rooms/${currentRoomId}/reactions`), (snap) => {
        renderEmoji(snap.val().emoji);
    }));

    // Голос (WebRTC)
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
    showToast("Вы вошли в комнату");
}

// --- ИНТЕРФЕЙС И НАВИГАЦИЯ ---

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    $('loader').classList.remove('active');
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        $('user-display-name').innerText = displayName;
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
            div.innerHTML = `<div><h4>${r.name}</h4><p>Хост: ${r.adminName || "Аноним"}</p></div>
                             <button class="primary-btn" id="join-${id}">Присоединиться</button>`;
            grid.appendChild(div);
            $(`join-${id}`).onclick = () => joinRoom(id, r.name, r.link, r.admin);
        });
    });
}

function joinRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    $('chat-messages').innerHTML = '';
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

// --- ОБРАБОТЧИКИ СОБЫТИЙ ---

$('btn-login-email').onclick = () => {
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
};

$('btn-register-email').onclick = async () => {
    const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
    await updateProfile(res.user, { displayName: $('reg-name').value });
};

$('btn-google-auth').onclick = () => signInWithPopup(auth, provider);
$('btn-logout').onclick = () => signOut(auth);

$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, {
        name: $('room-name').value || "Комната",
        link: $('room-link').value,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName
    });
    $('modal-create').classList.remove('active');
};

$('send-btn').onclick = () => {
    const val = $('chat-input').value.trim();
    if(val) { 
        push(ref(db, `rooms/${currentRoomId}/chat`), { u: auth.currentUser.displayName, m: val }); 
        $('chat-input').value = ''; 
    }
};

$('chat-input').onkeypress = (e) => { if(e.key === 'Enter') $('send-btn').click(); };

$('mic-btn').onclick = async () => {
    if(!myStream) {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        $('mic-btn').classList.add('active');
        set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
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

$('tab-chat-btn').onclick = () => {
    $('chat-messages').style.display = 'flex';
    $('users-list').style.display = 'none';
};

$('tab-users-btn').onclick = () => {
    $('chat-messages').style.display = 'none';
    $('users-list').style.display = 'flex';
};

$('btn-leave-room').onclick = exitRoom;

// --- ФОНОВАЯ АНИМАЦИЯ (ПЛЕКСУС) ---
const pCanvas = $('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let pts = [];
function resize() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
window.onresize = resize; resize();

class Pt {
    constructor() { 
        this.x = Math.random() * pCanvas.width; 
        this.y = Math.random() * pCanvas.height; 
        this.vx = (Math.random() - 0.5) * 0.5; 
        this.vy = (Math.random() - 0.5) * 0.5; 
    }
    upd() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > pCanvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > pCanvas.height) this.vy *= -1;
        pCtx.fillStyle = "rgba(255,255,255,0.4)"; 
        pCtx.beginPath(); pCtx.arc(this.x, this.y, 1.5, 0, Math.PI * 2); pCtx.fill();
    }
}
for(let i=0; i<70; i++) pts.push(new Pt());

function loop() {
    pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
    pts.forEach(p => {
        p.upd();
        pts.forEach(p2 => {
            let d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if(d < 120) { 
                pCtx.strokeStyle = `rgba(255,255,255,${0.15 - d/800})`; 
                pCtx.beginPath(); pCtx.moveTo(p.x, p.y); pCtx.lineTo(p2.x, p2.y); pCtx.stroke(); 
            }
        });
    });
    requestAnimationFrame(loop);
}
loop();