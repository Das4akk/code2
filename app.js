import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { VoiceManager } from "./voice.js";

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
function showScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
    if($(id)) $(id).classList.add('active'); 
}

function showToast(message) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

// Переменные состояния
let currentRoomId = null;
let isHost = false;
let roomListenerUnsubscribe = null;
let isRemoteAction = false;
let lastSyncTs = 0;
let processedMsgs = new Set();

setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen'); 
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
});

// --- АВТОРИЗАЦИЯ ---
$('tab-login').onclick = () => { 
    $('form-login').classList.add('active-form'); 
    $('form-login').classList.remove('hidden-form', 'left'); 
    $('form-register').classList.add('hidden-form', 'right'); 
    $('form-register').classList.remove('active-form'); 
    $('tab-login').classList.add('active'); 
    $('tab-register').classList.remove('active'); 
};
$('tab-register').onclick = () => { 
    $('form-register').classList.add('active-form'); 
    $('form-register').classList.remove('hidden-form', 'right'); 
    $('form-login').classList.add('hidden-form', 'left'); 
    $('form-login').classList.remove('active-form'); 
    $('tab-register').classList.add('active'); 
    $('tab-login').classList.remove('active'); 
};

$('btn-login-email').onclick = async () => { 
    try { await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); } 
    catch(e) { showToast("Ошибка входа"); } 
};
$('btn-register-email').onclick = async () => { 
    try { 
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); 
        await updateProfile(res.user, { displayName: $('reg-name').value }); 
        $('user-display-name').innerText = $('reg-name').value; 
    } catch(e) { showToast("Ошибка регистрации"); } 
};
$('btn-google-auth').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { showToast("Ошибка Google"); } };
$('btn-logout').onclick = () => signOut(auth);

// --- ЛОББИ ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return showToast("Заполни поля!");
    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, { name, link, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User" });
    $('modal-create').classList.remove('active');
    enterRoom(newRoomRef.key, name, link, auth.currentUser.uid);
};

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const data = snap.val();
        if(data) {
            Object.entries(data).forEach(([id, room]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `<h4>${room.name}</h4><p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${room.adminName}</p>`;
                card.onclick = () => enterRoom(id, room.name, room.link, room.admin);
                grid.appendChild(card);
            });
        }
    });
}

const player = $('native-player');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    $('room-title-text').innerText = name;
    player.src = link;
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";
    
    showScreen('room-screen');
    initRoomServices();
}

function leaveRoom() {
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) roomListenerUnsubscribe(); 
    
    // Удаляем данные голоса
    remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
    
    player.pause(); 
    player.src = '';
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = leaveRoom;

// --- AMBILIGHT ---
const ambiCanvas = $('ambilight-canvas');
const ambiCtx = ambiCanvas.getContext('2d', { willReadFrequently: true });
function drawAmbilight() {
    if (currentRoomId && !player.paused && !player.ended) {
        ambiCanvas.width = player.clientWidth / 10;
        ambiCanvas.height = player.clientHeight / 10;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
}
player.addEventListener('play', () => drawAmbilight());

// --- ОСНОВНЫЕ СЕРВИСЫ КОМНАТЫ ---
function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);

    // Присутствие
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove();

    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        $('users-list').innerHTML = '';
        $('users-count').innerText = Object.keys(data).length;
        for (let uid in data) {
            $('users-list').innerHTML += `<div class="user-item"><span>${data[uid].name}</span></div>`;
        }
    });

    // Синхронизация видео (только хост отправляет)
    if (isHost) {
        const sync = () => {
            if(!isRemoteAction) set(videoRef, { type: player.paused ? 'pause' : 'play', time: player.currentTime, ts: Date.now() });
        };
        player.onplay = sync;
        player.onpause = sync;
        player.onseeked = sync;
    }

    onValue(videoRef, (snap) => {
        if (isHost) return;
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        if (Math.abs(player.currentTime - d.time) > 1.5) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemoteAction = false, 500);
    });

    // Чат
    const sendMsg = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { 
            push(chatRef, { user: auth.currentUser.displayName || "User", content: inp.value.trim(), ts: Date.now() }); 
            inp.value = ''; 
        }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };

    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        div.className = m.user === auth.currentUser.displayName ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${m.user}</strong><p>${m.content}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    // --- ГОЛОСОВОЙ МОДУЛЬ (VOICE) ---
    const micBtn = $('mic-btn');
    const myVoiceRef = ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`);

    // Инициализируем PeerJS
    VoiceManager.init();

    // Клик по микрофону
    micBtn.onclick = async () => {
        console.log("Нажат микрофон...");
        const isActiveNow = await VoiceManager.toggleMic(micBtn);
        
        if (isActiveNow) {
            // Если включили, записываем свой ID в базу
            if (VoiceManager.peer && VoiceManager.peer.id) {
                set(myVoiceRef, VoiceManager.peer.id);
                showToast("Микрофон включен");
            }
        } else {
            // Если выключили — удаляем из базы
            remove(myVoiceRef);
            showToast("Микрофон выключен");
        }
    };

    // Следим за ID других пользователей и звоним им
    onValue(voiceRef, (snap) => {
        const users = snap.val();
        if (!users) return;
        
        Object.keys(users).forEach(uid => {
            if (uid !== auth.currentUser.uid) {
                const targetPeerId = users[uid];
                // Звоним, если у нас активен поток
                if (VoiceManager.myStream) {
                    VoiceManager.callUser(targetPeerId);
                }
            }
        });
    });

    // Громкость
    $('voice-volume').oninput = (e) => {
        document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = e.target.value);
    };
}

// --- ФОНОВЫЕ ЧАСТИЦЫ ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let dots = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();
class Dot {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0 || this.x>canvas.width) this.vx *= -1;
        if(this.y<0 || this.y>canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<80; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.draw();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 120) {
                ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/600})`;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();