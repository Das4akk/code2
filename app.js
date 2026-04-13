import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

// Прокидываем Firebase в глобал для работы внешнего модуля voice.js
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

// Тосты (Уведомления)
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    $('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- Инициализация Голоса ---
let currentRoomId = null;
let isHost = false;
let roomListenerUnsubscribe = null;
let isRemoteAction = false;
let lastSyncTs = 0;
let processedMsgs = new Set(); // Защита от дублей сообщений

// Инициализируем PeerJS через наш модуль
VoiceManager.init();

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

// Авторизация
$('tab-login').onclick = () => { $('form-login').classList.add('active-form'); $('form-login').classList.remove('hidden-form', 'left'); $('form-register').classList.add('hidden-form', 'right'); $('form-register').classList.remove('active-form'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
$('tab-register').onclick = () => { $('form-register').classList.add('active-form'); $('form-register').classList.remove('hidden-form', 'right'); $('form-login').classList.add('hidden-form', 'left'); $('form-login').classList.remove('active-form'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };

$('btn-login-email').onclick = async () => { try { await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-register-email').onclick = async () => { try { const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); await updateProfile(res.user, { displayName: $('reg-name').value }); $('user-display-name').innerText = $('reg-name').value; } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-google-auth').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { showToast("Ошибка Google"); } };
$('btn-logout').onclick = () => signOut(auth);

// Лобби: Создание и Удаление ВСЕХ комнат
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-delete-all-rooms').onclick = async () => {
    if(confirm("ВНИМАНИЕ! Вы удалите ВСЕ комнаты в базе данных. Продолжить?")) {
        await remove(ref(db, 'rooms'));
        showToast("Все комнаты удалены.");
    }
};

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
                grid.innerHTML += `
                    <div class="room-card glass-panel" onclick="window.joinRoom('${id}','${room.name}','${room.link}','${room.admin}')">
                        <h4>${room.name}</h4>
                        <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${room.adminName}</p>
                    </div>`;
            });
        }
    });
}
window.joinRoom = (id, name, link, admin) => enterRoom(id, name, link, admin);

// ==========================================
// КОМНАТА И ЛОГИКА
// ==========================================
const player = $('native-player');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    processedMsgs.clear(); // Очистка чата при входе
    $('room-title-text').innerText = name;
    player.src = link;
    $('chat-messages').innerHTML = ''; 
    
    // ПРАВА ДОСТУПА: Хост управляет, зритель только смотрит
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";
    
    showScreen('room-screen');
    initRoomServices();
    showToast(`Вы вошли в комнату: ${name}`);
}

function leaveRoom() {
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) roomListenerUnsubscribe(); 
    player.pause(); player.src = '';
    
    // Выключаем голос через менеджер
    VoiceManager.toggleMic(currentRoomId, db, auth, $('mic-btn'), true);
    
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = leaveRoom;

// --- AMBILIGHT (Свечение плеера) ---
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

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    const reactionsRef = ref(db, `rooms/${currentRoomId}/reactions`);

    // Синхронизация комнаты (удаление)
    roomListenerUnsubscribe = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if (!snap.exists() && currentRoomId) {
            showToast("Комната удалена");
            leaveRoom();
        }
    });

    $('btn-fullscreen').onclick = () => $('player-wrapper').requestFullscreen();

    // Присутствие
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove(); 
    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        $('users-list').innerHTML = '';
        $('users-count').innerText = Object.keys(data).length;
        for (let uid in data) {
            $('users-list').innerHTML += `
                <div class="user-item">
                    <div class="indicator"></div>
                    <span>${data[uid].name} ${uid === auth.currentUser.uid ? '(Вы)' : ''}</span>
                </div>`;
        }
    });

    // --- ПЛЕЕР: ЖЕСТКАЯ СИНХРОНИЗАЦИЯ ТОЛЬКО ХОСТА ---
    if (isHost) {
        player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
        player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
        player.onseeked = () => { if(!isRemoteAction) set(videoRef, { type: 'seek', time: player.currentTime, ts: Date.now() }); };
    }

    onValue(videoRef, (snap) => {
        if (isHost) return;
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        if (Math.abs(player.currentTime - d.time) > 2) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemoteAction = false, 500);
    });

    // --- ЧАТ И ТАЙМКОДЫ ---
    const parseTimecodes = (text) => text.replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    
    const sendMsg = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { push(chatRef, { user: auth.currentUser.displayName, content: inp.value.trim(), ts: Date.now() }); inp.value = ''; }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };
    
    $('chat-messages').onclick = (e) => {
        if(e.target.classList.contains('timecode-btn')) {
            const parts = e.target.dataset.time.split(':');
            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            player.currentTime = seconds;
            if(isHost) {
                player.play();
                set(videoRef, { type: 'seek', time: seconds, ts: Date.now() });
            }
        }
    };

    onChildAdded(chatRef, (snap) => {
        if (processedMsgs.has(snap.key)) return; // Блокировка дублей
        processedMsgs.add(snap.key);
        const m = snap.val();
        const isMe = m.user === auth.currentUser.displayName;
        const div = document.createElement('div');
        div.className = isMe ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${m.user}</strong><p>${parseTimecodes(m.content)}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    // ТАБЫ ЧАТА
    $('tab-chat-btn').onclick = () => { $('chat-messages').style.display='flex'; $('users-list').style.display='none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); };
    $('tab-users-btn').onclick = () => { $('users-list').style.display='flex'; $('chat-messages').style.display='none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); };

    // --- РЕАКЦИИ ---
    document.querySelectorAll('.react-btn').forEach(btn => {
        btn.onclick = () => push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
    });
    onChildAdded(reactionsRef, (snap) => {
        const data = snap.val();
        if(Date.now() - data.ts > 5000) return; 
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = data.emoji;
        el.style.left = Math.random() * 80 + 10 + '%';
        $('reaction-layer').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    });

    // --- ГОЛОС (Вызовы в voice.js) ---
    $('mic-btn').onclick = () => VoiceManager.toggleMic(currentRoomId, db, auth, $('mic-btn'));

    onValue(voiceRef, (snap) => {
        const data = snap.val() || {};
        Object.values(data).forEach(peerId => {
            if (VoiceManager.myStream && peerId !== VoiceManager.peer.id) {
                VoiceManager.callPeer(peerId);
            }
        });
    });

    $('voice-volume').oninput = (e) => {
        document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = e.target.value);
    };
}

// --- НЕЙРОСЕТЕВОЙ ФОН (Плексус) ---
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
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();