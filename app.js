import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Твой актуальный конфиг со скриншота
const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnLHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43",
    measurementId: "G-DYEMG7JYQV"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Состояние приложения
let currentUser = null;
let currentRoomId = null;
let isAdmin = false;
let roomListeners = []; 

// PeerJS для голоса
let myStream = null;
const peer = new Peer();

// DOM элементы
const scrAuth = document.getElementById('auth-screen');
const scrLobby = document.getElementById('lobby-screen');
const scrRoom = document.getElementById('main-app');
const player = document.getElementById('native-player');
const chatMessages = document.getElementById('chat-messages');

// --- 1. ПЛЕКСУС ФОН ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function initCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = initCanvas; initCanvas();
class P {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x<0 || this.x>canvas.width) this.vx*=-1; if (this.y<0 || this.y>canvas.height) this.vy*=-1;
    }
}
for (let i=0; i<60; i++) particles.push(new P());
function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach((p,i) => {
        p.update();
        ctx.fillStyle = 'rgba(150,150,150,0.4)'; ctx.beginPath(); ctx.arc(p.x,p.y,1.2,0,Math.PI*2); ctx.fill();
        for (let j=i+1; j<particles.length; j++){
            let dx=p.x-particles[j].x, dy=p.y-particles[j].y, dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<150){ ctx.strokeStyle=`rgba(150,150,150,${1-dist/150})`; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(particles[j].x,particles[j].y); ctx.stroke(); }
        }
    });
    requestAnimationFrame(animate);
}
animate();

// --- 2. АВТОРИЗАЦИЯ ---
document.getElementById('tab-login').onclick = () => {
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
};
document.getElementById('tab-register').onclick = () => {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
};

document.getElementById('btn-register-email').onclick = async () => {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;
    if(!email || !pass || !name) return alert("Заполни все поля");
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
    } catch (e) { alert("Ошибка регистрации: " + e.message); }
};

document.getElementById('btn-login-email').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if(!email || !pass) return;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (e) { alert("Ошибка входа"); }
};

document.getElementById('btn-google-auth').onclick = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } 
    catch (e) { console.error(e); }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('lobby-username').innerText = user.displayName || user.email;
        showScreen('lobby');
        loadRooms();
    } else {
        currentUser = null;
        showScreen('auth');
    }
});

document.getElementById('btn-logout').onclick = () => signOut(auth);

function showScreen(type) {
    scrAuth.classList.remove('active'); scrLobby.classList.remove('active'); scrRoom.classList.remove('active');
    if(type === 'auth') scrAuth.classList.add('active');
    if(type === 'lobby') scrLobby.classList.add('active');
    if(type === 'room') scrRoom.classList.add('active');
}

// --- 3. ЛОББИ ---
document.getElementById('btn-open-create-modal').onclick = () => document.getElementById('create-room-modal').classList.remove('hidden');
document.getElementById('btn-cancel-create').onclick = () => document.getElementById('create-room-modal').classList.add('hidden');

document.getElementById('btn-confirm-create').onclick = () => {
    const name = document.getElementById('new-room-name').value || "Без названия";
    const url = document.getElementById('new-room-url').value;
    const pass = document.getElementById('new-room-pass').value;
    if(!url) return alert("Нужна ссылка!");

    const newRoomRef = push(ref(db, 'rooms'));
    const rId = newRoomRef.key;

    set(newRoomRef, {
        config: { title: name, videoUrl: url, password: pass || "", admin: currentUser.uid, adminOnline: true, isLocked: pass.length > 0 },
        sync: { type: 'pause', time: 0, ts: Date.now() }
    }).then(() => {
        document.getElementById('create-room-modal').classList.add('hidden');
        joinRoom(rId, pass);
    });
};

function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        if(currentRoomId) return;
        const container = document.getElementById('rooms-list');
        container.innerHTML = '';
        const rooms = snap.val();
        if(!rooms) { container.innerHTML = '<p>Пока нет комнат</p>'; return; }

        for (let rId in rooms) {
            const conf = rooms[rId].config;
            const div = document.createElement('div');
            div.className = 'room-card glass-panel';
            div.innerHTML = `
                ${conf.isLocked ? '<div class="room-locked-icon">🔒</div>' : ''}
                <h3>${conf.title}</h3>
                <p>Статус: ${conf.adminOnline ? 'Админ в сети 🟢' : 'Пауза (Админ оффлайн) 🔴'}</p>
            `;
            div.onclick = () => {
                if(conf.isLocked && conf.admin !== currentUser.uid) {
                    const pModal = document.getElementById('password-modal');
                    pModal.classList.remove('hidden');
                    document.getElementById('btn-confirm-pass').onclick = () => {
                        if(document.getElementById('enter-room-pass').value === conf.password) {
                            pModal.classList.add('hidden'); joinRoom(rId, conf.password);
                        } else alert("Неверный пароль!");
                    };
                    document.getElementById('btn-cancel-pass').onclick = () => pModal.classList.add('hidden');
                } else joinRoom(rId, conf.password);
            };
            container.appendChild(div);
        }
    });
}

// --- 4. ЛОГИКА КОМНАТЫ ---
let isRemoteAction = false;
let lastSyncTs = 0;

function joinRoom(rId, password) {
    currentRoomId = rId;
    showScreen('room');
    chatMessages.innerHTML = '';
    
    // 1. Конфиг и права
    const unsubConfig = onValue(ref(db, `rooms/${rId}/config`), (snap) => {
        const conf = snap.val();
        if(!conf) return;
        document.getElementById('current-room-title').innerText = conf.title;
        if(player.src !== conf.videoUrl) player.src = conf.videoUrl;
        isAdmin = (conf.admin === currentUser.uid);

        if(isAdmin) {
            player.style.pointerEvents = "auto";
            document.getElementById('admin-wait-overlay').classList.add('hidden');
            set(ref(db, `rooms/${rId}/config/adminOnline`), true);
            onDisconnect(ref(db, `rooms/${rId}/config/adminOnline`)).set(false);
        } else {
            player.style.pointerEvents = "none";
            if(!conf.adminOnline) {
                player.pause();
                document.getElementById('admin-wait-overlay').classList.remove('hidden');
            } else document.getElementById('admin-wait-overlay').classList.add('hidden');
        }
    });
    roomListeners.push(unsubConfig);

    // 2. Синхронизация видео
    player.onplay = () => { if(!isRemoteAction && isAdmin) set(ref(db, `rooms/${rId}/sync`), { type: 'play', time: player.currentTime, u: currentUser.uid, ts: Date.now() }); };
    player.onpause = () => { if(!isRemoteAction && isAdmin) set(ref(db, `rooms/${rId}/sync`), { type: 'pause', time: player.currentTime, u: currentUser.uid, ts: Date.now() }); };
    
    const unsubSync = onValue(ref(db, `rooms/${rId}/sync`), (snap) => {
        const d = snap.val();
        if (!d || d.u === currentUser.uid || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        if (d.type === 'play') { player.currentTime = d.time; player.play().catch(() => {}); }
        else { player.pause(); player.currentTime = d.time; }
        setTimeout(() => isRemoteAction = false, 1000);
    });
    roomListeners.push(unsubSync);

    // 3. Чат
    const unsubChat = onChildAdded(ref(db, `rooms/${rId}/chat`), (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        div.className = m.u === (currentUser.displayName || "User") ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${m.u}</strong><p>${m.c}</p></div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    roomListeners.push(unsubChat);

    document.getElementById('send-btn').onclick = () => {
        const inp = document.getElementById('chat-input');
        if (inp.value.trim()) { push(ref(db, `rooms/${rId}/chat`), { u: currentUser.displayName || "User", c: inp.value.trim() }); inp.value = ''; }
    };

    // 4. Голос
    peer.on('call', (call) => {
        call.answer(myStream);
        const audio = new Audio();
        call.on('stream', (rs) => { audio.srcObject = rs; audio.play(); });
    });

    document.getElementById('mic-btn').onclick = async function() {
        if (!myStream) {
            try { myStream = await navigator.mediaDevices.getUserMedia({ audio: true }); myStream.getAudioTracks()[0].enabled = false; } 
            catch (e) { return; }
        }
        const isActive = this.classList.toggle('active');
        myStream.getAudioTracks()[0].enabled = isActive;
        if (isActive) set(ref(db, `rooms/${rId}/voice/` + currentUser.uid), peer.id);
        else remove(ref(db, `rooms/${rId}/voice/` + currentUser.uid));
    };

    const unsubVoice = onValue(ref(db, `rooms/${rId}/voice`), (snap) => {
        const data = snap.val();
        for (let uid in data) {
            if (uid !== currentUser.uid && myStream) {
                const call = peer.call(data[uid], myStream);
                const audio = new Audio();
                call.on('stream', (rs) => { audio.srcObject = rs; audio.play(); });
            }
        }
    });
    roomListeners.push(unsubVoice);
}

document.getElementById('btn-leave-room').onclick = () => {
    if(isAdmin) set(ref(db, `rooms/${currentRoomId}/config/adminOnline`), false);
    roomListeners.forEach(unsub => unsub());
    roomListeners = [];
    currentRoomId = null;
    player.pause();
    player.src = "";
    showScreen('lobby');
};