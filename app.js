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

// Сессия теперь сохраняется даже после закрытия вкладки
setPersistence(auth, browserLocalPersistence);

const $ = id => document.getElementById(id);

// --- Глобальные состояния ---
let currentRoomId = null;
let isHost = false;
let myStream = null;
let peer = new Peer();
let activeCalls = {};
let roomSub = null; 

// --- Навигация ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// --- Auth Observer ---
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

// --- Вход / Регистрация / Google ---
$('btn-login-email').onclick = () => {
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value)
    .catch(e => alert("Ошибка: " + e.message));
};

$('btn-register-email').onclick = async () => {
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    } catch(e) { alert(e.message); }
};

$('btn-google-auth').onclick = () => {
    signInWithPopup(auth, provider).catch(e => alert(e.message));
};

$('btn-logout').onclick = () => signOut(auth);

// --- Табы авторизации ---
$('tab-login').onclick = () => {
    $('form-login').classList.remove('hidden-form');
    $('form-register').classList.add('hidden-form', 'right');
    $('tab-login').classList.add('active');
    $('tab-register').classList.remove('active');
};
$('tab-register').onclick = () => {
    $('form-login').classList.add('hidden-form', 'left');
    $('form-register').classList.remove('hidden-form', 'right');
    $('tab-register').classList.add('active');
    $('tab-login').classList.remove('active');
};

// --- Работа с комнатами ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return;

    const newRoomRef = push(ref(db, 'rooms'));
    const roomId = newRoomRef.key;

    await set(newRoomRef, {
        name, link,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "User"
    });

    $('modal-create').classList.remove('active');
    joinRoom(roomId, name, link, auth.currentUser.uid);
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
            div.innerHTML = `<h4>${r.name}</h4><p>Хост: ${r.adminName}</p><button class="primary-btn" style="margin-top:10px" id="join-${id}">Войти</button>`;
            grid.appendChild(div);
            $(`join-${id}`).onclick = () => joinRoom(id, r.name, r.link, r.admin);
        });
    });
}

// --- ВХОД В КОМНАТУ ---
function joinRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    
    const player = $('native-player');
    player.src = link;
    player.load(); // Принудительная загрузка метаданных

    $('room-title-text').innerText = name;
    $('btn-delete-room').style.display = isHost ? 'block' : 'none';
    player.controls = isHost;
    player.style.pointerEvents = isHost ? 'auto' : 'none';

    // Восстановление позиции
    const savedTime = localStorage.getItem(`cow_pos_${roomId}`);
    if(savedTime) player.currentTime = parseFloat(savedTime);

    showScreen('room-screen');
    initRoomLogic();
}

function initRoomLogic() {
    const player = $('native-player');
    const syncRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);

    // Отслеживание удаления комнаты админом
    if(roomSub) roomSub();
    roomSub = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if(!snap.exists() && currentRoomId) {
            alert("Комната удалена админом");
            exitRoom();
        }
    });

    // Presence
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove();

    // Синхронизация видео
    let isRemote = false;
    player.onplay = () => { if(isHost && !isRemote) set(syncRef, { state: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemote) set(syncRef, { state: 'pause', time: player.currentTime, ts: Date.now() }); };
    
    // Сохранение места раз в 5 сек
    player.ontimeupdate = () => {
        if(isHost) localStorage.setItem(`cow_pos_${currentRoomId}`, player.currentTime);
    };

    onValue(syncRef, (snap) => {
        if(isHost) return;
        const data = snap.val();
        if(!data) return;
        isRemote = true;
        if(Math.abs(player.currentTime - data.time) > 1.5) player.currentTime = data.time;
        data.state === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemote = false, 500);
    });

    // Чат
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

    // Микрофон ( PeerJS )
    $('mic-btn').onclick = async () => {
        const btn = $('mic-btn');
        if(!btn.classList.contains('active')) {
            try {
                myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                btn.classList.add('active');
                set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
            } catch(e) { alert("Микрофон недоступен"); }
        } else {
            // ФИКС ЗВУКА: Полная остановка всех дорожек
            if(myStream) {
                myStream.getTracks().forEach(track => track.stop());
                myStream = null;
            }
            btn.classList.remove('active');
            remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
        }
    };

    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (remoteStream) => {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play();
        });
    });

    onValue(voiceRef, (snap) => {
        const data = snap.val();
        if(!data || !myStream) return;
        Object.values(data).forEach(pId => {
            if(pId !== peer.id && !activeCalls[pId]) {
                const call = peer.call(pId, myStream);
                call.on('stream', (rs) => {
                    const audio = new Audio();
                    audio.srcObject = rs;
                    audio.play();
                });
                activeCalls[pId] = true;
            }
        });
    });
}

function exitRoom() {
    currentRoomId = null;
    if(myStream) myStream.getTracks().forEach(t => t.stop());
    showScreen('lobby-screen');
}

$('btn-leave-room').onclick = exitRoom;

$('btn-delete-room').onclick = () => {
    if(confirm("Удалить комнату для всех?")) {
        remove(ref(db, `rooms/${currentRoomId}`));
    }
};

// Нейросеть (Плексус)
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let pts = [];
function res() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = res; res();
class Pt {
    constructor() { this.x=Math.random()*canvas.width; this.y=Math.random()*canvas.height; this.vx=(Math.random()-0.5); this.vy=(Math.random()-0.5); }
    upd() {
        this.x+=this.vx; this.y+=this.vy;
        if(this.x<0||this.x>canvas.width) this.vx*=-1;
        if(this.y<0||this.y>canvas.height) this.vy*=-1;
        ctx.fillStyle="rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(this.x,this.y,1,0,7); ctx.fill();
    }
}
for(let i=0;i<60;i++) pts.push(new Pt());
function loop() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p => {
        p.upd();
        pts.forEach(p2 => {
            let d = Math.hypot(p.x-p2.x, p.y-p2.y);
            if(d<100) { ctx.strokeStyle=`rgba(255,255,255,${1-d/100})`; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
        });
    });
    requestAnimationFrame(loop);
}
loop();