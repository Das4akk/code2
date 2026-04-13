import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

// Глобальные ссылки для voice.js
window.fRef = ref; window.fSet = set; window.fRemove = remove;

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); if($(id)) $(id).classList.add('active'); }

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    $('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(()=>toast.remove(), 500); }, 3000);
}

// Переменные состояния
let currentRoomId = null;
let isHost = false;
let roomListenerUnsubscribe = null;
let isRemoteAction = false;
let lastSyncTs = 0;
let processedMsgs = new Set(); // Защита от дублей

VoiceManager.init(); // Старт PeerJS

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen'); 
        syncRooms();
    } else { showScreen('auth-screen'); }
});

// Авторизация (Твой код)
$('tab-login').onclick = () => { $('form-login').classList.add('active-form'); $('form-login').classList.remove('hidden-form', 'left'); $('form-register').classList.add('hidden-form', 'right'); $('form-register').classList.remove('active-form'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
$('tab-register').onclick = () => { $('form-register').classList.add('active-form'); $('form-register').classList.remove('hidden-form', 'right'); $('form-login').classList.add('hidden-form', 'left'); $('form-login').classList.remove('active-form'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };
$('btn-login-email').onclick = async () => { try { await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); } catch(e) { showToast("Ошибка"); } };
$('btn-register-email').onclick = async () => { try { const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); await updateProfile(res.user, { displayName: $('reg-name').value }); } catch(e) { showToast("Ошибка"); } };
$('btn-google-auth').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { showToast("Ошибка"); } };
$('btn-logout').onclick = () => signOut(auth);

// Лобби
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');
$('btn-delete-all-rooms').onclick = async () => { if(confirm("Удалить всё?")) { await remove(ref(db, 'rooms')); } };

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value; const link = $('room-link').value;
    if(!name || !link) return showToast("Заполни поля!");
    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, { name, link, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User" });
    $('modal-create').classList.remove('active');
    enterRoom(newRoomRef.key, name, link, auth.currentUser.uid);
};

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid'); grid.innerHTML = '';
        const data = snap.val();
        if(data) {
            Object.entries(data).forEach(([id, room]) => {
                grid.innerHTML += `<div class="room-card glass-panel" onclick="window.joinRoom('${id}','${room.name}','${room.link}','${room.admin}')">
                    <h4>${room.name}</h4><p style="font-size:12px;opacity:0.6;">Хост: ${room.adminName}</p></div>`;
            });
        }
    });
}
window.joinRoom = (id, name, link, admin) => enterRoom(id, name, link, admin);

const player = $('native-player');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    processedMsgs.clear();
    $('room-title-text').innerText = name;
    player.src = link;
    $('chat-messages').innerHTML = ''; 
    
    // БЛОКИРОВКА КЛИКОВ ДЛЯ ОБЫЧНЫХ ЛЮДЕЙ
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";
    
    showScreen('room-screen');
    initRoomServices();
}

function leaveRoom() {
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) roomListenerUnsubscribe(); 
    player.pause(); player.src = '';
    VoiceManager.toggleMic(currentRoomId, db, auth, $('mic-btn')); // Выкл микро при выходе
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = leaveRoom;

// Твой AMBILIGHT
const ambiCanvas = $('ambilight-canvas');
const ambiCtx = ambiCanvas.getContext('2d', { willReadFrequently: true });
function drawAmbilight() {
    if (currentRoomId && !player.paused && !player.ended) {
        ambiCanvas.width = player.clientWidth / 10; ambiCanvas.height = player.clientHeight / 10;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
}
player.addEventListener('play', () => drawAmbilight());

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    const reactionsRef = ref(db, `rooms/${currentRoomId}/reactions`);

    roomListenerUnsubscribe = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if (!snap.exists() && currentRoomId) { showToast("Комната удалена"); leaveRoom(); }
    });

    $('btn-fullscreen').onclick = () => $('player-wrapper').requestFullscreen();

    // Присутствие
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove(); 
    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        $('users-list').innerHTML = ''; $('users-count').innerText = Object.keys(data).length;
        for (let uid in data) {
            $('users-list').innerHTML += `<div class="user-item"><div class="indicator"></div><span>${data[uid].name} ${uid === auth.currentUser.uid ? '(Вы)' : ''}</span></div>`;
        }
    });

    // СИНХРОНИЗАЦИЯ (ТОЛЬКО ХОСТ)
    if (isHost) {
        player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
        player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
        player.onseeked = () => { if(!isRemoteAction) set(videoRef, { type: 'seek', time: player.currentTime, ts: Date.now() }); };
    }

    onValue(videoRef, (snap) => {
        if (isHost) return;
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts; isRemoteAction = true;
        if (Math.abs(player.currentTime - d.time) > 2) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemoteAction = false, 500);
    });

    // ЧАТ (Без дублей)
    const parseTimecodes = (text) => text.replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    
    $('send-btn').onclick = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { push(chatRef, { user: auth.currentUser.displayName, content: inp.value.trim(), ts: Date.now() }); inp.value = ''; }
    };
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') $('send-btn').onclick(); };

    onChildAdded(chatRef, (snap) => {
        if (processedMsgs.has(snap.key)) return;
        processedMsgs.add(snap.key);
        const m = snap.val();
        const div = document.createElement('div');
        div.className = m.user === auth.currentUser.displayName ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${m.user}</strong><p>${parseTimecodes(m.content)}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    $('chat-messages').onclick = (e) => {
        if(e.target.classList.contains('timecode-btn')) {
            const p = e.target.dataset.time.split(':');
            const sec = parseInt(p[0]) * 60 + parseInt(p[1]);
            player.currentTime = sec;
            if(isHost) { player.play(); set(videoRef, { type: 'seek', time: sec, ts: Date.now() }); }
        }
    };

    // ГОЛОС
    $('mic-btn').onclick = () => VoiceManager.toggleMic(currentRoomId, db, auth, $('mic-btn'));
    onValue(voiceRef, (snap) => {
        const data = snap.val() || {};
        Object.values(data).forEach(peerId => {
            if (VoiceManager.myStream && peerId !== VoiceManager.peer.id) VoiceManager.callPeer(peerId);
        });
    });

    // Табы и Реакции (Твой код)
    $('tab-chat-btn').onclick = () => { $('chat-messages').style.display='flex'; $('users-list').style.display='none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); };
    $('tab-users-btn').onclick = () => { $('users-list').style.display='flex'; $('chat-messages').style.display='none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); };
    document.querySelectorAll('.react-btn').forEach(btn => {
        btn.onclick = () => push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
    });
    onChildAdded(reactionsRef, (snap) => {
        const data = snap.val(); if(Date.now() - data.ts > 5000) return;
        const el = document.createElement('div'); el.className = 'floating-emoji'; el.innerText = data.emoji;
        el.style.left = Math.random() * 80 + 10 + '%'; $('reaction-layer').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    });
}

// Твой ПЛЕКСУС-ФОН
const canvas = $('particle-canvas'); const ctx = canvas.getContext('2d');
let dots = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();
class Dot {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0 || this.x>canvas.width) this.vx *= -1;
        if(this.y<0 || this.y>canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<80; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => { d.draw(); dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 120) { ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/600})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke(); }
        });
    });
    requestAnimationFrame(anim);
}
anim();