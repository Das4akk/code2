import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);

// Функция принудительного показа экрана
function showScreen(id) {
    console.log("Switching to screen:", id);
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = $(id);
    if (target) {
        target.style.display = 'flex';
        $('loader').classList.remove('active'); // Убираем черный экран
    }
}

// Аварийный таймер: если через 4 сек ничего не произошло, убираем лоадер
setTimeout(() => {
    if ($('loader').classList.contains('active')) {
        console.warn("Firebase timeout - forcing screen show");
        showScreen('auth-screen');
    }
}, 4000);

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            $('user-display').innerText = user.email;
            showScreen('lobby-screen');
            loadRooms();
        } else {
            showScreen('auth-screen');
        }
    });

    // Логика кнопок
    $('btn-login').onclick = () => {
        const email = $('email').value;
        const pass = $('pass').value;
        signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Ошибка: " + err.message));
    };

    $('btn-add-room').onclick = () => $('modal').classList.remove('hidden');
    $('m-close').onclick = () => $('modal').classList.add('hidden');

    $('m-create').onclick = async () => {
        let url = $('m-url').value;
        if(url.includes('dropbox.com')) url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').split('?')[0];
        const r = push(ref(db, 'rooms'));
        await set(r, { 
            name: $('m-title').value, 
            link: url, 
            host: auth.currentUser.uid, 
            hostName: auth.currentUser.email 
        });
        $('modal').classList.add('hidden');
    };
});

// --- СИНХРОНИЗАЦИЯ И КОМНАТЫ ---
function loadRooms() {
    onValue(ref(db, 'rooms'), s => {
        $('rooms-grid').innerHTML = '';
        const data = s.val();
        if(data) Object.entries(data).forEach(([id, r]) => {
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `<h3>${r.name}</h3><p style="font-size:10px; opacity:0.2; margin-top:10px;">${r.hostName}</p>`;
            card.onclick = () => enterRoom(id, r);
            $('rooms-grid').appendChild(card);
        });
    });
}

function enterRoom(id, r) {
    const video = $('main-v');
    const isAdmin = r.host === auth.currentUser.uid;
    showScreen('room-screen');
    
    $('room-name-display').innerText = r.name;
    video.src = r.link;
    video.load();

    if (isAdmin) {
        $('admin-tag').classList.remove('hidden');
        $('v-lock').classList.add('hidden');
        const sync = () => set(ref(db, `rooms/${id}/sync`), { t: video.currentTime, p: video.paused });
        video.onplay = sync; video.onpause = sync; video.onseeking = sync;
    } else {
        $('admin-tag').classList.add('hidden');
        $('v-lock').classList.remove('hidden');
        onValue(ref(db, `rooms/${id}/sync`), (snap) => {
            const data = snap.val();
            if (data) {
                if (Math.abs(video.currentTime - data.t) > 2) video.currentTime = data.t;
                data.p ? video.pause() : video.play();
            }
        });
    }

    // Чат
    const chatRef = ref(db, `rooms/${id}/chat`);
    off(chatRef);
    onValue(chatRef, s => {
        $('messages-box').innerHTML = s.val() ? Object.values(s.val()).map(m => `<div class="msg"><b>${m.u}:</b> ${m.t}</div>`).join('') : '';
        $('messages-box').scrollTop = $('messages-box').scrollHeight;
    });

    $('btn-send-chat').onclick = () => {
        if (!$('chat-input').value) return;
        push(ref(db, `rooms/${id}/chat`), { u: auth.currentUser.email.split('@')[0], t: $('chat-input').value });
        $('chat-input').value = '';
    };

    $('btn-leave').onclick = () => {
        video.pause(); video.src = "";
        showScreen('lobby-screen');
    };
}