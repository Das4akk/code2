import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);

let currentRoomId = null;

// ПЕРЕКЛЮЧАТЕЛЬ ЭКРАНОВ
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// АВТО-ВХОД
onAuthStateChanged(auth, (user) => {
    if (user) {
        if($('user-display-name')) $('user-display-name').innerText = user.displayName || user.email;
        showScreen('lobby-screen');
        listenRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// AUTH
$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
$('btn-register-email').onclick = async () => {
    const user = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
    await updateProfile(user.user, { displayName: $('reg-name').value });
};
$('btn-logout').onclick = () => signOut(auth);
$('btn-google-auth').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

// ТАБЫ
$('tab-login').onclick = () => { $('form-login').classList.remove('hidden'); $('form-register').classList.add('hidden'); };
$('tab-register').onclick = () => { $('form-login').classList.add('hidden'); $('form-register').classList.remove('hidden'); };

// МОДАЛКА
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

// СОЗДАНИЕ КОМНАТЫ
$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return alert("Заполни данные!");

    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, {
        name,
        link,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "User"
    });
    $('modal-create').classList.remove('active');
};

// СПИСОК КОМНАТ
function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        if(snap.val()) {
            Object.entries(snap.val()).forEach(([id, room]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `<h4>${room.name}</h4><p>Админ: ${room.adminName}</p><button class="primary-btn join-btn">Войти</button>`;
                card.querySelector('.join-btn').onclick = () => enterRoom(id, room);
                grid.appendChild(card);
            });
        }
    });
}

// ВХОД В КОМНАТУ
function enterRoom(id, room) {
    currentRoomId = id;
    showScreen('room-screen');
    $('current-room-name').innerText = room.name;

    const container = $('player-container');
    container.innerHTML = '';

    // УМНЫЙ ПЛЕЕР (YouTube или MP4)
    if (room.link.includes('youtube.com') || room.link.includes('youtu.be')) {
        let ytId = room.link.split('v=')[1] || room.link.split('/').pop();
        if(ytId.includes('&')) ytId = ytId.split('&')[0];
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
        container.innerHTML = `<video id="video-player" src="${room.link}" controls autoplay></video>`;
    }

    listenChat(id);
}

// ЧАТ
function listenChat(roomId) {
    const chatRef = ref(db, `chats/${roomId}`);
    off(chatRef); // Чистим старые слушатели
    onValue(chatRef, (snap) => {
        const box = $('chat-messages');
        box.innerHTML = '';
        if(snap.val()) {
            Object.values(snap.val()).forEach(m => {
                const div = document.createElement('div');
                div.className = 'msg';
                div.innerHTML = `<b>${m.user}:</b> ${m.text}`;
                box.appendChild(div);
            });
            box.scrollTop = box.scrollHeight;
        }
    });
}

$('btn-send-msg').onclick = () => {
    const text = $('chat-input').value;
    if(!text || !currentRoomId) return;
    push(ref(db, `chats/${currentRoomId}`), {
        user: auth.currentUser.displayName || auth.currentUser.email,
        text: text,
        time: Date.now()
    });
    $('chat-input').value = '';
};

$('btn-leave-room').onclick = () => {
    currentRoomId = null;
    $('player-container').innerHTML = '';
    showScreen('lobby-screen');
};

// ПЛЕКСУС (НЕЙРОСЕТЬ)
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let pts = [];
const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.onresize = resize; resize();
for(let i=0; i<60; i++) pts.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5 });
function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p => {
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>canvas.width) p.vx*=-1;
        if(p.y<0||p.y>canvas.height) p.vy*=-1;
        ctx.fillStyle="rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fill();
        pts.forEach(p2 => {
            let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
            if(d<100) { ctx.strokeStyle=`rgba(255,255,255,${0.15-d/700})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
        });
    });
    requestAnimationFrame(draw);
}
draw();