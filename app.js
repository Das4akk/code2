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
let roomUnsubs = []; // Массив для отписки от базы данных при выходе из комнаты
let globalRoomSub = null; 

// --- Навигация ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// --- Auth Observer ---
onAuthStateChanged(auth, (user) => {
    $('loader').classList.remove('active');
    if (user) {
        // Защита от undefined имени
        const displayName = user.displayName || user.email.split('@')[0];
        $('user-display-name').innerText = displayName;
        
        if (!currentRoomId) showScreen('lobby-screen');
        loadRooms();
    } else {
        showScreen('auth-screen');
    }
});

// --- Вход / Регистрация / Google ---
$('btn-login-email').onclick = () => {
    $('btn-login-email').innerText = 'Загрузка...';
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value)
    .catch(e => alert("Ошибка: " + e.message))
    .finally(() => $('btn-login-email').innerText = 'Войти');
};

$('btn-register-email').onclick = async () => {
    try {
        $('btn-register-email').innerText = 'Создаем...';
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        const name = $('reg-name').value || "Пользователь";
        await updateProfile(res.user, { displayName: name });
        // Обновляем UI сразу после регистрации
        $('user-display-name').innerText = name;
    } catch(e) { 
        alert(e.message); 
    } finally {
        $('btn-register-email').innerText = 'Создать аккаунт';
    }
};

$('btn-google-auth').onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$('btn-logout').onclick = () => signOut(auth);

// --- Табы авторизации ---
$('tab-login').onclick = () => {
    $('form-login').className = 'auth-form active-form';
    $('form-register').className = 'auth-form hidden-form right';
    $('tab-login').classList.add('active');
    $('tab-register').classList.remove('active');
};
$('tab-register').onclick = () => {
    $('form-login').className = 'auth-form hidden-form left';
    $('form-register').className = 'auth-form active-form';
    $('tab-register').classList.add('active');
    $('tab-login').classList.remove('active');
};

// --- Работа с комнатами ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value || "Новая комната";
    const link = $('room-link').value;
    if(!link) return alert("Нужна ссылка на видео!");

    const hostName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    const newRoomRef = push(ref(db, 'rooms'));
    const roomId = newRoomRef.key;

    await set(newRoomRef, {
        name, link,
        admin: auth.currentUser.uid,
        adminName: hostName
    });

    $('modal-create').classList.remove('active');
    joinRoom(roomId, name, link, auth.currentUser.uid);
};

function loadRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const data = snap.val();
        if(!data) {
            grid.innerHTML = '<p style="color:#666; width:100%; text-align:center;">Пока нет активных комнат. Создай первую!</p>';
            return;
        }
        Object.entries(data).forEach(([id, r]) => {
            const div = document.createElement('div');
            div.className = 'room-card glass-panel';
            div.innerHTML = `
                <div>
                    <h4 style="margin-bottom:8px; font-size:18px;">${r.name}</h4>
                    <p style="color:#aaa; font-size:13px;">Хост: <span style="color:#fff;">${r.adminName || "Неизвестен"}</span></p>
                </div>
                <button class="primary-btn" style="margin-top:15px;" id="join-${id}">Присоединиться</button>
            `;
            grid.appendChild(div);
            $(`join-${id}`).onclick = () => joinRoom(id, r.name, r.link, r.admin);
        });
    });
}

// --- ВХОД В КОМНАТУ ---
function joinRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    isHost = (auth.currentUser.uid === adminId);
    
    // Очищаем UI чата от старой комнаты
    $('chat-messages').innerHTML = '';
    
    const player = $('native-player');
    player.src = link;
    player.load();

    $('room-title-text').innerText = name;
    $('btn-delete-room').style.display = isHost ? 'block' : 'none';
    player.controls = isHost;
    player.style.pointerEvents = isHost ? 'auto' : 'none';

    const savedTime = localStorage.getItem(`cow_pos_${roomId}`);
    if(savedTime) player.currentTime = parseFloat(savedTime);

    // Сброс вкладок на "Чат"
    $('tab-chat-btn').click();

    showScreen('room-screen');
    initRoomLogic();
}

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

    // --- УЧАСТНИКИ (ПРИСУТСТВИЕ) ---
    const myName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    set(myPresenceRef, { name: myName });
    onDisconnect(myPresenceRef).remove();

    roomUnsubs.push(onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        const ul = $('users-list');
        ul.innerHTML = '';
        let count = 0;
        
        Object.values(data).forEach(u => {
            count++;
            const div = document.createElement('div');
            div.className = 'user-card';
            div.innerHTML = `
                <div class="avatar-circle" style="width:32px; height:32px;"></div>
                <span style="font-weight: 500;">${u.name}</span>
            `;
            ul.appendChild(div);
        });
        $('users-count').innerText = count;
    }));

    // --- СИНХРОНИЗАЦИЯ ВИДЕО ---
    let isRemote = false;
    player.onplay = () => { if(isHost && !isRemote) set(syncRef, { state: 'play', time: player.currentTime, ts: Date.now() }); };
    player.onpause = () => { if(isHost && !isRemote) set(syncRef, { state: 'pause', time: player.currentTime, ts: Date.now() }); };
    
    player.ontimeupdate = () => {
        if(isHost) localStorage.setItem(`cow_pos_${currentRoomId}`, player.currentTime);
    };

    roomUnsubs.push(onValue(syncRef, (snap) => {
        if(isHost) return;
        const data = snap.val();
        if(!data) return;
        isRemote = true;
        if(Math.abs(player.currentTime - data.time) > 1.5) player.currentTime = data.time;
        data.state === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemote = false, 500);
    }));

    // --- ЧАТ ---
    $('send-btn').onclick = () => {
        const val = $('chat-input').value.trim();
        if(val) { 
            push(chatRef, { u: myName, m: val }); 
            $('chat-input').value = ''; 
        }
    };
    // Отправка на Enter
    $('chat-input').onkeypress = (e) => { if(e.key === 'Enter') $('send-btn').click(); };

    roomUnsubs.push(onChildAdded(chatRef, (snap) => {
        const d = snap.val();
        const msg = document.createElement('div');
        const isSelf = d.u === myName;
        msg.className = `m-line ${isSelf ? 'self' : ''}`;
        msg.innerHTML = `<div class="bubble"><strong>${d.u}</strong>${d.m}</div>`;
        $('chat-messages').appendChild(msg);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }));

    // --- МИКРОФОН И ЗВУК ---
    $('mic-btn').onclick = async () => {
        const btn = $('mic-btn');
        if(!btn.classList.contains('active')) {
            try {
                myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                btn.classList.add('active');
                set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
            } catch(e) { alert("Не удалось получить доступ к микрофону"); }
        } else {
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
            audio.className = 'peer-audio-track';
            audio.srcObject = remoteStream;
            audio.volume = $('voice-volume').value; // применяем текущую громкость
            audio.play();
        });
    });

    roomUnsubs.push(onValue(voiceRef, (snap) => {
        const data = snap.val();
        if(!data || !myStream) return;
        Object.values(data).forEach(pId => {
            if(pId !== peer.id && !activeCalls[pId]) {
                const call = peer.call(pId, myStream);
                call.on('stream', (rs) => {
                    const audio = new Audio();
                    audio.className = 'peer-audio-track';
                    audio.srcObject = rs;
                    audio.volume = $('voice-volume').value;
                    audio.play();
                });
                activeCalls[pId] = true;
            }
        });
    }));
}

// Управление ползунком громкости
$('voice-volume').oninput = (e) => {
    const vol = e.target.value;
    document.querySelectorAll('.peer-audio-track').forEach(a => a.volume = vol);
};

// Фуллскрин API
$('btn-fullscreen').onclick = () => {
    const pw = $('player-wrapper');
    if (!document.fullscreenElement) {
        pw.requestFullscreen().catch(err => console.log("Ошибка Fullscreen:", err));
    } else {
        document.exitFullscreen();
    }
};

// Переключение вкладок Чат / Участники
$('tab-chat-btn').onclick = () => {
    $('tab-chat-btn').classList.add('active');
    $('tab-users-btn').classList.remove('active');
    $('chat-messages').style.display = 'flex';
    $('users-list').style.display = 'none';
    $('message-dock-container').style.display = 'block';
};

$('tab-users-btn').onclick = () => {
    $('tab-users-btn').classList.add('active');
    $('tab-chat-btn').classList.remove('active');
    $('chat-messages').style.display = 'none';
    $('users-list').style.display = 'flex';
    $('message-dock-container').style.display = 'none';
};

function exitRoom() {
    // Отписываемся от базы, чтобы при входе в новую комнату не лезли старые сообщения
    roomUnsubs.forEach(unsub => unsub());
    roomUnsubs = [];
    
    if(auth.currentUser) {
        remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
        remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
    }
    
    currentRoomId = null;
    $('native-player').pause();
    $('native-player').src = '';
    
    if(myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
    }
    $('mic-btn').classList.remove('active');
    document.querySelectorAll('.peer-audio-track').forEach(a => a.remove()); // чистим аудиоэлементы
    activeCalls = {};
    
    showScreen('lobby-screen');
}

$('btn-leave-room').onclick = exitRoom;

$('btn-delete-room').onclick = () => {
    if(confirm("Удалить комнату для всех?")) {
        remove(ref(db, `rooms/${currentRoomId}`));
    }
};

// --- НЕЙРОСЕТЬ (ПЛЕКСУС) НА ФОНЕ ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let pts = [];
function res() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = res; res();

class Pt {
    constructor() { 
        this.x = Math.random() * canvas.width; 
        this.y = Math.random() * canvas.height; 
        this.vx = (Math.random() - 0.5) * 0.5; // Сделал чуть медленнее для плавности
        this.vy = (Math.random() - 0.5) * 0.5; 
    }
    upd() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.4)"; 
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
}
for(let i=0; i<70; i++) pts.push(new Pt());

function loop() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p => {
        p.upd();
        pts.forEach(p2 => {
            let d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if(d < 120) { 
                ctx.strokeStyle = `rgba(255,255,255,${0.15 - d/800})`; // Плавное затухание линий
                ctx.lineWidth = 0.8; 
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); 
            }
        });
    });
    requestAnimationFrame(loop);
}
loop();