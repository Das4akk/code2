import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; // ДОБАВЛЕН onChildAdded

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

const $ = (id) => document.getElementById(id);

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ КОМНАТЫ ---
let currentRoomId = null;
let isHost = false;
let isRemoteAction = false;
let lastSyncTs = 0;
let myStream = null;
const peer = new Peer();
const activeCalls = {}; // Защита от двойного звука

// --- ЭКРАНЫ ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if($(id)) $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        if($('user-display-name')) $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen'); // Если не в комнате, показываем лобби
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// --- ТАБЫ (Без изменений) ---
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

// --- AUTH ACTIONS (Без изменений) ---
$('btn-login-email').onclick = () => {
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
};
$('btn-register-email').onclick = async () => {
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    } catch(e) { alert(e.message); }
};
$('btn-google-auth').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
$('btn-logout').onclick = () => signOut(auth);

// --- ЛОГИКА СОЗДАНИЯ КОМНАТ ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    const pass = $('room-pass').value;

    if(!name || !link) return alert("Заполни название и ссылку!");

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    
    await set(newRoomRef, {
        name,
        link,
        password: pass || null,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "Admin",
        createdAt: Date.now()
    });

    $('modal-create').classList.remove('active');
    // Сразу заходим в свою комнату
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
                card.innerHTML = `
                    <div>
                        <h4>${room.name}</h4>
                        <p style="font-size: 13px; opacity: 0.6; margin-top: 5px;">Админ: ${room.adminName}</p>
                    </div>
                    <button class="primary-btn btn-join" data-id="${id}" data-name="${room.name}" data-link="${room.link}" data-admin="${room.admin}" style="margin-top:15px">Войти</button>
                `;
                grid.appendChild(card);
            });

            // Навешиваем слушатели на кнопки "Войти"
            document.querySelectorAll('.btn-join').forEach(btn => {
                btn.onclick = (e) => {
                    const t = e.target;
                    enterRoom(t.dataset.id, t.dataset.name, t.dataset.link, t.dataset.admin);
                }
            });
        }
    });
}


// ==========================================
// ЛОГИКА ВНУТРИ КОМНАТЫ (С фиксами)
// ==========================================

const player = $('native-player');
const chatMessages = $('chat-messages');

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);

    $('room-title-text').innerText = name;
    player.src = link;
    chatMessages.innerHTML = ''; // Чистим чат от прошлых комнат
    
    // ПРОВЕРКА НА ХОСТА
    if (isHost) {
        player.controls = true;
        player.style.pointerEvents = "auto";
    } else {
        player.controls = false;
        player.style.pointerEvents = "none"; // Обычные юзеры не могут кликать плеер
    }

    showScreen('room-screen');
    initRoomServices();
}

$('btn-leave-room').onclick = () => {
    player.pause();
    player.src = '';
    currentRoomId = null;
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
        $('mic-btn').classList.remove('active');
    }
    showScreen('lobby-screen');
};

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);

    // 1. СИНХРОНИЗАЦИЯ ПЛЕЕРА (Пишет только хост, читают все)
    player.onplay = () => { if(isHost && !isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
    
    onValue(videoRef, (snap) => {
        if (isHost) return; // Хост не слушает сам себя
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        
        if (Math.abs(player.currentTime - d.time) > 1) player.currentTime = d.time;
        if (d.type === 'play') player.play().catch(e => console.log(e));
        if (d.type === 'pause') player.pause();
        setTimeout(() => isRemoteAction = false, 1000);
    });

    // 2. ЧАТ
    const sendMsg = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { 
            push(chatRef, { user: auth.currentUser.displayName || "User", content: inp.value.trim() }); 
            inp.value = ''; 
        }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };
    
    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        const isMe = m.user === (auth.currentUser.displayName || "User");
        div.className = isMe ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${m.user}</strong><p>${m.content}</p></div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Скролл всегда вниз к новому сообщению
    });

    // 3. ГОЛОСОВОЙ ЧАТ (С фиксом эха и двойного звука)
    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (remoteStream) => { 
            if (!activeCalls[call.peer]) { // Фикс: не плодим дубли
                const audio = new Audio();
                audio.srcObject = remoteStream; 
                audio.play(); 
                activeCalls[call.peer] = true;
            }
        });
    });

    $('mic-btn').onclick = async function() {
        if (!myStream) {
            try {
                // АППАРАТНЫЙ ФИКС ЭХА И ШУМОВ
                myStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                myStream.getAudioTracks()[0].enabled = false;
            } catch (e) { alert("Включи микрофон в браузере!"); return; }
        }
        const isActive = this.classList.toggle('active');
        myStream.getAudioTracks()[0].enabled = isActive;
        if (isActive) set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
    };

    onValue(voiceRef, (snap) => {
        const data = snap.val();
        for (let uid in data) {
            if (uid !== auth.currentUser.uid && myStream && !activeCalls[data[uid]]) {
                const call = peer.call(data[uid], myStream);
                call.on('stream', (rs) => { 
                    const audio = new Audio(); 
                    audio.srcObject = rs; 
                    audio.play(); 
                });
                activeCalls[data[uid]] = true; // Запоминаем, что уже подключились
            }
        }
    });
}


// --- НЕЙРОСЕТИ (ПЛЕКСУС) Без изменений ---
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
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.2, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<70; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.draw();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 110) {
                ctx.strokeStyle = `rgba(255,255,255,${1 - dist/110})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();