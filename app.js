import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentRoomId = null, isHost = false, myStream = null, lastSyncTs = 0, isRemoteAction = false;
const peer = new Peer();
const remoteAudios = [];
const activeCalls = {};

// --- SEARCH & SYNC ROOMS ---
function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = snap.val() || {};
        renderRooms(rooms, $('search-rooms').value.toLowerCase());
        
        // Повторный рендер при вводе в поиск
        $('search-rooms').oninput = (e) => renderRooms(rooms, e.target.value.toLowerCase());
    });
}

function renderRooms(rooms, filter) {
    const grid = $('rooms-grid');
    grid.innerHTML = '';
    Object.entries(rooms).forEach(([id, room]) => {
        if (room.name.toLowerCase().includes(filter)) {
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div><h3>${room.name}</h3><p style="opacity:0.5; font-size:12px">Админ: ${room.adminName}</p></div>
                <button class="primary-btn join-btn" data-id="${id}">Войти</button>
            `;
            card.querySelector('.join-btn').onclick = () => enterRoom(id, room);
            grid.appendChild(card);
        }
    });
}

// --- ENTER ROOM ---
async function enterRoom(id, room) {
    currentRoomId = id;
    isHost = (auth.currentUser.uid === room.admin);
    
    showScreen('room-screen');
    $('room-title-text').innerText = room.name;
    const player = $('native-player');
    player.src = room.link;
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";

    // Fullscreen для всех по даблклику
    player.parentElement.ondblclick = () => {
        if (player.requestFullscreen) player.requestFullscreen();
        else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
    };

    if(isHost) $('btn-delete-room').classList.remove('hidden');
    else $('btn-delete-room').classList.add('hidden');

    // Presence (Я зашел)
    const pRef = ref(db, `rooms/${id}/presence/${auth.currentUser.uid}`);
    set(pRef, auth.currentUser.displayName || "User");
    onDisconnect(pRef).remove();

    initRoomServices(id);
}

function initRoomServices(roomId) {
    const vRef = ref(db, `rooms/${roomId}/sync`);
    const cRef = ref(db, `rooms/${roomId}/chat`);
    const pRef = ref(db, `rooms/${roomId}/presence`);
    const player = $('native-player');

    // 1. Плеер
    player.onplay = () => isHost && !isRemoteAction && set(vRef, { type: 'play', time: player.currentTime, ts: Date.now() });
    player.onpause = () => isHost && !isRemoteAction && set(vRef, { type: 'pause', time: player.currentTime, ts: Date.now() });
    onValue(vRef, (s) => {
        const d = s.val(); if(!d || isHost || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts; isRemoteAction = true;
        if(Math.abs(player.currentTime - d.time) > 1.5) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemoteAction = false, 500);
    });

    // 2. Участники
    onValue(pRef, (s) => {
        $('users-online-list').innerHTML = '';
        const users = s.val();
        if(users) Object.values(users).forEach(name => {
            const tag = document.createElement('span'); tag.className = 'u-tag'; tag.innerText = `● ${name}`;
            $('users-online-list').appendChild(tag);
        });
    });

    // 3. Чат
    $('chat-messages').innerHTML = '';
    const sendMsg = () => {
        const inp = $('chat-input');
        if(inp.value.trim()) { push(cRef, { u: auth.currentUser.displayName || "User", m: inp.value }); inp.value = ''; }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => e.key === 'Enter' && sendMsg();
    onChildAdded(cRef, (s) => {
        const d = s.val();
        const div = document.createElement('div');
        div.className = d.u === (auth.currentUser.displayName || "User") ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${d.u}</strong><p>${d.m}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    // 4. Громкость
    $('video-volume').oninput = (e) => player.volume = e.target.value;
    $('voice-volume').oninput = (e) => remoteAudios.forEach(a => a.volume = e.target.value);
}

// Удаление комнаты (Только для админа)
$('btn-delete-room').onclick = () => {
    if(confirm("Удалить комнату для всех?")) {
        remove(ref(db, `rooms/${currentRoomId}`));
        exitRoom();
    }
};

function exitRoom() {
    if(currentRoomId) remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
    $('native-player').pause();
    $('native-player').src = '';
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = exitRoom;

// --- AUTH & OTHER (ТВОЙ ПРЕЖНИЙ КОД) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen');
        listenRooms();
    } else { showScreen('auth-screen'); }
    $('loader').classList.remove('active');
});

$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');
$('btn-create-finish').onclick = () => {
    const n = $('room-name').value, l = $('room-link').value;
    if(n && l) {
        push(ref(db, 'rooms'), { name: n, link: l, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User", ts: Date.now() });
        $('modal-create').classList.remove('active');
    }
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// Табы и Auth Actions
$('tab-login').onclick = () => {
    $('form-login').classList.remove('hidden-form'); $('form-register').classList.add('hidden-form', 'right');
    $('tab-login').classList.add('active'); $('tab-register').classList.remove('active');
};
$('tab-register').onclick = () => {
    $('form-login').classList.add('hidden-form', 'left'); $('form-register').classList.remove('hidden-form', 'right');
    $('tab-register').classList.add('active'); $('tab-login').classList.remove('active');
};
$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
$('btn-register-email').onclick = async () => {
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    } catch(e) { alert(e.message); }
};
$('btn-google-auth').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
$('btn-logout').onclick = () => signOut(auth);

// Нейросети фона (Твой код)
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