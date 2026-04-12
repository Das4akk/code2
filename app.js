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

let currentRoomId = null, isHost = false, myStream = null, lastSync = 0, isRemote = false;
const peer = new Peer();
const remoteAudios = {}; 

// --- SEARCH LOGIC ---
let allRoomsData = {};
$('search-rooms').oninput = (e) => {
    renderRoomsList(allRoomsData, e.target.value.toLowerCase());
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen');
        listenRooms();
    } else { showScreen('auth-screen'); }
    $('loader').classList.remove('active');
});

function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        allRoomsData = snap.val() || {};
        renderRoomsList(allRoomsData, $('search-rooms').value.toLowerCase());
    });
}

function renderRoomsList(rooms, filter = "") {
    const grid = $('rooms-grid');
    grid.innerHTML = '';
    Object.entries(rooms).forEach(([id, room]) => {
        if (room.name.toLowerCase().includes(filter)) {
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `<h3>${room.name}</h3><p>Админ: ${room.adminName || 'Anon'}</p><button class="join-btn primary-btn" data-id="${id}">Войти</button>`;
            card.querySelector('.join-btn').onclick = () => enterRoom(id, room);
            grid.appendChild(card);
        }
    });
}

// --- ROOM LOGIC ---
async function enterRoom(id, room) {
    currentRoomId = id;
    isHost = (auth.currentUser.uid === room.admin);
    
    showScreen('room-screen');
    $('room-title-text').innerText = room.name;
    $('native-player').src = room.link;
    $('native-player').controls = isHost; // Только админ видит нативные кнопки
    
    if(isHost) $('btn-delete-room').classList.remove('hidden');

    // Fullscreen для всех по двойному клику
    $('native-player').ondblclick = () => {
        if ($('native-player').requestFullscreen) $('native-player').requestFullscreen();
    };

    // Presence: Я в комнате
    const pRef = ref(db, `rooms/${id}/presence/${auth.currentUser.uid}`);
    set(pRef, auth.currentUser.displayName || "User");
    onDisconnect(pRef).remove();

    initServices(id);
}

function initServices(id) {
    const vRef = ref(db, `rooms/${id}/sync`), cRef = ref(db, `rooms/${id}/chat`), vPRef = ref(db, `rooms/${id}/presence`);
    const player = $('native-player');

    // Sync
    player.onplay = () => isHost && !isRemote && set(vRef, { t: 'play', time: player.currentTime, s: Date.now() });
    player.onpause = () => isHost && !isRemote && set(vRef, { t: 'pause', time: player.currentTime, s: Date.now() });
    onValue(vRef, (s) => {
        const d = s.val(); if(!d || isHost || d.s <= lastSync) return;
        lastSync = d.s; isRemote = true;
        if(Math.abs(player.currentTime - d.time) > 1.5) player.currentTime = d.time;
        d.t === 'play' ? player.play() : player.pause();
        setTimeout(() => isRemote = false, 500);
    });

    // Presence List
    onValue(vPRef, (s) => {
        $('users-online-list').innerHTML = '';
        const users = s.val(); if(users) Object.values(users).forEach(u => {
            const dot = document.createElement('span'); dot.className = 'u-dot'; dot.innerText = u;
            $('users-online-list').appendChild(dot);
        });
    });

    // Chat (logic same, simple push)
    $('send-btn').onclick = () => {
        const val = $('chat-input').value;
        if(val) { push(cRef, { u: auth.currentUser.displayName || "User", m: val }); $('chat-input').value = ''; }
    };
    onChildAdded(cRef, (s) => {
        const m = s.val();
        const msg = document.createElement('div');
        msg.innerHTML = `<small>${m.u}</small><p>${m.m}</p>`;
        $('chat-messages').appendChild(msg);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    });

    // Voice Fix
    peer.on('call', call => {
        call.answer(myStream);
        call.on('stream', stream => {
            if(!remoteAudios[call.peer]) {
                const a = new Audio(); a.srcObject = stream; a.play();
                a.volume = $('voice-volume').value;
                remoteAudios[call.peer] = a;
            }
        });
    });
}

// Удаление комнаты
$('btn-delete-room').onclick = () => {
    if(confirm("Удалить комнату навсегда?")) {
        remove(ref(db, `rooms/${currentRoomId}`));
        exitRoom();
    }
};

function exitRoom() {
    if(currentRoomId) remove(ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`));
    $('native-player').src = '';
    currentRoomId = null;
    showScreen('lobby-screen');
}

$('btn-leave-room').onclick = exitRoom;

// --- AUTH UI TABS ---
$('tab-login').onclick = () => {
    $('form-login').classList.remove('hidden-form'); $('form-register').classList.add('hidden-form', 'right');
    $('tab-login').classList.add('active'); $('tab-register').classList.remove('active');
};
$('tab-register').onclick = () => {
    $('form-login').classList.add('hidden-form', 'left'); $('form-register').classList.remove('hidden-form', 'right');
    $('tab-register').classList.add('active'); $('tab-login').classList.remove('active');
};
// Auth Actions (Standard)
$('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value);
$('btn-register-email').onclick = async () => {
    const r = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
    await updateProfile(r.user, { displayName: $('reg-name').value });
};
$('btn-logout').onclick = () => signOut(auth);
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');
$('btn-create-finish').onclick = () => {
    const n = $('room-name').value, l = $('room-link').value;
    if(n && l) push(ref(db, 'rooms'), { name: n, link: l, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName, s: Date.now() });
    $('modal-create').classList.remove('active');
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}