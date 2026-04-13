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

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentRoomId = null;
let isHost = false;
let roomSub = null; 

// --- ПЕРЕМЕННЫЕ WEBRTC (Микрофон) ---
let peer = new Peer();
let myStream = null;
let activeCalls = {};   // Хранилище активных соединений (PeerConnection)
let remoteAudios = {};  // Хранилище HTML Audio элементов для управления громкостью

// --- НАВИГАЦИЯ И АВТОРИЗАЦИЯ ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    $('loader').classList.remove('active');
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if (!currentRoomId) showScreen('lobby-screen');
        loadRooms();
    } else {
        showScreen('auth-screen');
    }
});

$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
$('btn-register-email').onclick = async () => {
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    } catch(e) { alert(e.message); }
};
$('btn-google-auth').onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$('btn-logout').onclick = () => signOut(auth);

// UI Табы
$('tab-login').onclick = () => { $('form-login').classList.remove('hidden-form'); $('form-register').classList.add('hidden-form', 'right'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
$('tab-register').onclick = () => { $('form-login').classList.add('hidden-form', 'left'); $('form-register').classList.remove('hidden-form', 'right'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };
$('tab-chat-btn').onclick = () => { $('chat-messages').style.display = 'flex'; $('users-list').style.display = 'none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); $('message-dock-container').style.display = 'block'; };
$('tab-users-btn').onclick = () => { $('users-list').style.display = 'flex'; $('chat-messages').style.display = 'none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); $('message-dock-container').style.display = 'none'; };

// --- ЛОББИ И КОМНАТЫ ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return;

    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, { name, link, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User" });
    $('modal-create').classList.remove('active');
    joinRoom(newRoomRef.key, name, link, auth.currentUser.uid);
};

function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const data = snap.val();
        if(!data) return;
        Object.entries(data).forEach(([id, r]) => {
            const div = document.createElement('div');
            div.className = 'room-card glass-panel';
            div.innerHTML = `<div><h4>${r.name}</h4><p style="font-size:12px; opacity:0.6">Хост: ${r.adminName}</p></div><button class="primary-btn" style="margin-top:15px" id="join-${id}">Войти</button>`;
            grid.appendChild(div);
            $(`join-${id}`).onclick = () => joinRoom(id, r.name, r.link, r.admin);
        });
    });
}

// --- ВХОД В КОМНАТУ И ИНИЦИАЛИЗАЦИЯ ---
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

    const savedTime = localStorage.getItem(`cow_pos_${roomId}`);
    if(savedTime && isHost) player.currentTime = parseFloat(savedTime);

    // Закрываем любые старые аудиозвонки перед входом
    closeAllCalls();

    showScreen('room-screen');
    initRoomLogic();
}

function initRoomLogic() {
    const player = $('native-player');
    const syncRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);

    if(roomSub) roomSub();
    roomSub = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if(!snap.exists() && currentRoomId) { alert("Комната закрыта."); exitRoom(); }
    });

    // PRESENCE (Включает в себя наш PeerID для Mesh-сети)
    set(presenceRef, { name: auth.currentUser.displayName || "User", peerId: peer.id });
    onDisconnect(presenceRef).remove();

    // СИНХРОНИЗАЦИЯ ВИДЕО
    let isRemote = false;
    player.onplay = () => { if(isHost && !isRemote) set(syncRef, { state: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemote) set(syncRef, { state: 'pause', time: player.currentTime, ts: Date.now() }); };
    player.ontimeupdate = () => { if(isHost && Math.floor(player.currentTime) % 5 === 0) localStorage.setItem(`cow_pos_${currentRoomId}`, player.currentTime); };

    onValue(syncRef, (snap) => {
        if(isHost) return;
        const data = snap.val();
        if(!data) return;
        isRemote = true;
        if(Math.abs(player.currentTime - data.time) > 1.5) player.currentTime = data.time;
        data.state === 'play' ? player.play().catch(()=>console.log("Ожидание автоплея")) : player.pause();
        setTimeout(() => isRemote = false, 500);
    });

    // ЧАТ
    $('chat-messages').innerHTML = '';
    $('send-btn').onclick = () => {
        const val = $('chat-input').value.trim();
        if(val) { push(chatRef, { u: auth.currentUser.displayName || "User", m: val }); $('chat-input').value = ''; }
    };
    onChildAdded(chatRef, (snap) => {
        const d = snap.val();
        const msg = document.createElement('div');
        msg.className = `m-line ${d.u === (auth.currentUser.displayName || "User") ? 'self' : ''}`;
        msg.innerHTML = `<div class="bubble"><strong>${d.u}</strong>${d.m}</div>`;
        $('chat-messages').appendChild(msg);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    // ОБНОВЛЕНИЕ СПИСКА УЧАСТНИКОВ И ОБРАБОТКА ЗВОНКОВ
    onValue(ref(db, `rooms/${currentRoomId}/presence`), (snap) => {
        const users = snap.val() || {};
        const list = $('users-list');
        list.innerHTML = '';
        $('users-count').innerText = Object.keys(users).length;
        
        for (let uid in users) {
            const isMe = uid === auth.currentUser.uid;
            list.innerHTML += `<div class="user-item glass-panel"><div class="indicator"></div><span>${users[uid].name}</span>${isMe ? '<span style="opacity:0.5; font-size:12px; margin-left:auto;">(Вы)</span>' : ''}</div>`;
            
            // Если у нас включен микрофон, мы инициируем звонки всем новым/текущим участникам
            if (!isMe && myStream) {
                const targetPeerId = users[uid].peerId;
                if (targetPeerId && !activeCalls[targetPeerId]) {
                    initiateCall(targetPeerId);
                }
            }
        }
    });
}

// ==========================================
// ЯДРО ГОЛОСОВОЙ СВЯЗИ (MESH WEBRTC)
// ==========================================

// Глобальная громкость
$('voice-volume').oninput = (e) => {
    const vol = e.target.value;
    Object.values(remoteAudios).forEach(audio => audio.volume = vol);
};

// 1. УПРАВЛЕНИЕ МИКРОФОНОМ (Инициализация только по клику)
$('mic-btn').onclick = async () => {
    const btn = $('mic-btn');
    if (!btn.classList.contains('active')) {
        try {
            // Запрашиваем доступ
            myStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });
            btn.classList.add('active');
            
            // Как только появился поток, звоним всем, кто сейчас в комнате
            for (let peerId in activeCalls) {
                // В PeerJS проще пересоздать звонок, чтобы передать новый поток
                activeCalls[peerId].close();
                initiateCall(peerId);
            }
            
            // Если звонков еще не было создано (мы зашли первые и включили микрофон),
            // onValue(presence) подхватит вызовы при подключении других.

        } catch(e) { alert("Микрофон недоступен: " + e.message); }
    } else {
        // Выключение микрофона
        if (myStream) {
            myStream.getTracks().forEach(t => t.stop());
            myStream = null;
        }
        btn.classList.remove('active');
        // Обрываем исходящие потоки, но оставляем соединения, чтобы слышать других
        closeAllCalls();
        // Переподключаемся "пустыми", чтобы продолжить слушать
        reconnectAsListener();
    }
};

// 2. ОТВЕТ НА ВХОДЯЩИЙ ЗВОНОК
peer.on('call', (call) => {
    // Отвечаем тем что есть. Если микрофон выключен (myStream = null), 
    // отправляется undefined, но соединение устанавливается!
    call.answer(myStream || undefined);
    
    call.on('stream', (remoteStream) => playRemoteStream(call.peer, remoteStream));
    call.on('close', () => removeRemoteStream(call.peer));
    call.on('error', () => removeRemoteStream(call.peer));
    
    activeCalls[call.peer] = call;
});

// 3. ИСХОДЯЩИЙ ЗВОНОК
function initiateCall(targetPeerId) {
    if (!myStream) return;
    const call = peer.call(targetPeerId, myStream);
    call.on('stream', (remoteStream) => playRemoteStream(targetPeerId, remoteStream));
    call.on('close', () => removeRemoteStream(targetPeerId));
    call.on('error', () => removeRemoteStream(targetPeerId));
    activeCalls[targetPeerId] = call;
}

// 4. ВОСПРОИЗВЕДЕНИЕ И ПОЛИТИКА AUTOPLAY
function playRemoteStream(peerId, stream) {
    if (remoteAudios[peerId]) return; // Уже играет
    
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true'); // Важно для мобильных
    audio.volume = $('voice-volume').value;
    
    // Перехват Autoplay Policy
    audio.play().catch(e => console.warn("Браузер заблокировал автовоспроизведение звука. Требуется клик по странице.", e));
    
    remoteAudios[peerId] = audio;
    document.body.appendChild(audio); // Safari иногда требует добавления в DOM
}

function removeRemoteStream(peerId) {
    if (remoteAudios[peerId]) {
        remoteAudios[peerId].pause();
        remoteAudios[peerId].srcObject = null;
        remoteAudios[peerId].remove();
        delete remoteAudios[peerId];
    }
    if (activeCalls[peerId]) {
        delete activeCalls[peerId];
    }
}

function closeAllCalls() {
    for (let id in activeCalls) {
        if(activeCalls[id]) activeCalls[id].close();
        removeRemoteStream(id);
    }
    activeCalls = {};
    remoteAudios = {};
}

// Переподключение "слушателем", если выключил микрофон
function reconnectAsListener() {
    onValue(ref(db, `rooms/${currentRoomId}/presence`), (snap) => {
        const users = snap.val() || {};
        // Просто обновляем Firebase, что вызовет onValue у других, 
        // и они перезвонят нам сами, передав свой звук.
        set(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`), { 
            name: auth.currentUser.displayName || "User", 
            peerId: peer.id,
            ts: Date.now() // Микро-триггер для обновления базы
        });
    }, { onlyOnce: true });
}

// ==========================================

function exitRoom() {
    if(currentRoomId) remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
    currentRoomId = null;
    
    if(myStream) myStream.getTracks().forEach(t => t.stop());
    myStream = null;
    $('mic-btn').classList.remove('active');
    
    closeAllCalls();
    
    const player = $('native-player');
    player.pause(); player.src = '';
    
    showScreen('lobby-screen');
}

$('btn-leave-room').onclick = exitRoom;
$('btn-delete-room').onclick = () => { if(confirm("Удалить комнату?")) remove(ref(db, `rooms/${currentRoomId}`)); };
$('btn-fullscreen').onclick = () => {
    const pw = $('player-wrapper');
    if (!document.fullscreenElement) pw.requestFullscreen(); else document.exitFullscreen();
};

// --- ФОНОВЫЕ ЧАСТИЦЫ (ПЛЕКСУС) ---
const pCanvas = $('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let pts = [];
function resize() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
window.onresize = resize; resize();
class Pt {
    constructor() { this.x = Math.random() * pCanvas.width; this.y = Math.random() * pCanvas.height; this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4; }
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
    pts.forEach(p => { p.upd();
        pts.forEach(p2 => {
            let d = Math.hypot(p.x-p2.x, p.y-p2.y);
            if(d<100) { pCtx.strokeStyle=`rgba(255,255,255,${1-d/100})`; pCtx.lineWidth=0.5; pCtx.beginPath(); pCtx.moveTo(p.x,p.y); pCtx.lineTo(p2.x,p2.y); pCtx.stroke(); }
        });
    });
    requestAnimationFrame(loop);
}
loop();