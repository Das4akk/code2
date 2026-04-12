import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

const $ = (id) => document.getElementById(id);

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentRoomId = null;
let isHost = false;
let isRemoteAction = false;
let lastSyncTs = 0;
let myStream = null;
const peer = new Peer();
let activeCalls = {}; // Трекинг звонков для предотвращения двоения
let remoteAudioElements = []; // Ссылки на аудио теги для контроля громкости

// --- ЭКРАНЫ ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if($(id)) $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        if($('user-display-name')) $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen'); 
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// --- ТАБЫ ---
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

$('tab-chat-btn').onclick = () => {
    $('chat-messages').classList.add('active-area');
    $('users-list').classList.remove('active-area');
    $('tab-chat-btn').classList.add('active');
    $('tab-users-btn').classList.remove('active');
    $('message-dock-container').style.display = 'block';
};
$('tab-users-btn').onclick = () => {
    $('users-list').classList.add('active-area');
    $('chat-messages').classList.remove('active-area');
    $('tab-users-btn').classList.add('active');
    $('tab-chat-btn').classList.remove('active');
    $('message-dock-container').style.display = 'none'; // Прячем инпут во вкладке юзеров
};

// --- AUTH ACTIONS ---
$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
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
// ЛОГИКА ВНУТРИ КОМНАТЫ
// ==========================================

const player = $('native-player');
const chatMessages = $('chat-messages');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);

    $('room-title-text').innerText = name;
    player.src = link;
    chatMessages.innerHTML = ''; 
    
    if (isHost) {
        player.controls = true;
        player.style.pointerEvents = "auto";
    } else {
        player.controls = false;
        player.style.pointerEvents = "none";
    }

    showScreen('room-screen');
    initRoomServices();
}

$('btn-leave-room').onclick = () => {
    // 1. Чистим присутствие
    if (presenceRef) remove(presenceRef);
    
    // 2. Останавливаем видео и стримы
    player.pause();
    player.src = '';
    currentRoomId = null;
    
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
        $('mic-btn').classList.remove('active');
    }
    
    // 3. Очищаем звонки и аудио
    remoteAudioElements.forEach(a => { a.pause(); a.srcObject = null; });
    remoteAudioElements = [];
    activeCalls = {};

    showScreen('lobby-screen');
};

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const roomPresenceRef = ref(db, `rooms/${currentRoomId}/presence`);

    // --- ФУЛЛСКРИН ДЛЯ ВСЕХ ---
    $('btn-fullscreen').onclick = () => {
        const wrapper = $('player-wrapper');
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch(err => alert("Ошибка фуллскрина: " + err.message));
        } else {
            document.exitFullscreen();
        }
    };

    // --- PRESENCE (СПИСОК УЧАСТНИКОВ) ---
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove(); // Авто-удаление при обрыве связи

    onValue(roomPresenceRef, (snap) => {
        const data = snap.val() || {};
        const list = $('users-list');
        list.innerHTML = '';
        $('users-count').innerText = Object.keys(data).length;
        for (let uid in data) {
            list.innerHTML += `
                <div class="user-item glass-panel">
                    <div class="indicator"></div>
                    <span>${data[uid].name}</span>
                    ${uid === auth.currentUser.uid ? '<span style="opacity:0.5; font-size:12px; margin-left:auto;">(Вы)</span>' : ''}
                </div>`;
        }
    });

    // --- СИНХРОНИЗАЦИЯ ПЛЕЕРА ---
    player.onplay = () => { if(isHost && !isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
    
    onValue(videoRef, (snap) => {
        if (isHost) return;
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        
        if (Math.abs(player.currentTime - d.time) > 1) player.currentTime = d.time;
        if (d.type === 'play') player.play().catch(e => console.log(e));
        if (d.type === 'pause') player.pause();
        setTimeout(() => isRemoteAction = false, 1000);
    });

    // --- ЧАТ ---
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // --- ГРОМКОСТЬ ГОЛОСА (ОТДЕЛЬНЫЙ ПОЛЗУНОК) ---
    $('voice-volume').oninput = (e) => {
        const vol = e.target.value;
        remoteAudioElements.forEach(audio => audio.volume = vol);
    };

    function attachRemoteAudio(remoteStream, peerId) {
        if (activeCalls[peerId]) return; // Жесткий фикс двоения звука
        activeCalls[peerId] = true;

        const audio = new Audio();
        audio.srcObject = remoteStream; 
        audio.volume = $('voice-volume').value; // Применяем текущую громкость ползунка
        audio.play().catch(e => console.warn("Audio autoplay blocked", e));
        remoteAudioElements.push(audio);
    }

    // --- ГОЛОСОВОЙ ЧАТ (PeerJS) ---
    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, call.peer));
    });

    $('mic-btn').onclick = async function() {
        if (!myStream) {
            try {
                myStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                myStream.getAudioTracks()[0].enabled = false;
            } catch (e) { alert("Не удалось получить доступ к микрофону!"); return; }
        }
        const isActive = this.classList.toggle('active');
        myStream.getAudioTracks()[0].enabled = isActive;
        
        if (isActive) {
            set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
        } else {
            remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
        }
    };

    onValue(voiceRef, (snap) => {
        const data = snap.val() || {};
        for (let uid in data) {
            const remotePeerId = data[uid];
            if (uid !== auth.currentUser.uid && myStream && !activeCalls[remotePeerId]) {
                const call = peer.call(remotePeerId, myStream);
                call.on('stream', (rs) => attachRemoteAudio(rs, remotePeerId));
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