import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

document.addEventListener('DOMContentLoaded', () => {
    let currentRoomId = null;
    let isAdmin = false;

    const showScreen = (id) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $(id).classList.add('active');
    };

    onAuthStateChanged(auth, (user) => {
        if (user) {
            $('user-display-name').innerText = user.displayName || user.email;
            showScreen('lobby-screen');
            listenRooms();
        } else {
            showScreen('auth-screen');
        }
        $('loader').classList.remove('active');
    });

    // --- АВТОРИЗАЦИЯ ---
    $('tab-login').onclick = () => { $('form-login').classList.add('active'); $('form-register').classList.remove('active'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
    $('tab-register').onclick = () => { $('form-register').classList.add('active'); $('form-login').classList.remove('active'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };

    $('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(alert);
    $('btn-register-email').onclick = async () => {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    };
    $('btn-logout').onclick = () => signOut(auth);

    // --- КОМНАТЫ ---
    $('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
    $('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

    $('btn-create-finish').onclick = async () => {
        const name = $('room-name').value;
        let link = $('room-link').value;
        if(link.includes('dropbox.com')) link = link.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?raw=1', '');
        
        const newRoom = push(ref(db, 'rooms'));
        await set(newRoom, {
            name, link, admin: auth.currentUser.uid,
            adminName: auth.currentUser.displayName || "User",
            password: $('room-pass').value || null
        });
        $('modal-create').classList.remove('active');
    };

    function listenRooms() {
        onValue(ref(db, 'rooms'), (s) => {
            $('rooms-grid').innerHTML = '';
            if(s.val()) Object.entries(s.val()).forEach(([id, r]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `<h4>${r.name}</h4><p>${r.adminName}</p>`;
                card.onclick = () => enterRoom(id, r);
                $('rooms-grid').appendChild(card);
            });
        });
    }

    // --- ВХОД И СИНХРОНИЗАЦИЯ ---
    function enterRoom(id, room) {
        if(room.password && room.admin !== auth.currentUser.uid) {
            if(prompt("Пароль:") !== room.password) return alert("Минимо!");
        }

        currentRoomId = id;
        isAdmin = room.admin === auth.currentUser.uid;
        showScreen('room-screen');
        $('current-room-name').innerText = room.name;

        const video = $('main-video');
        video.src = room.link;
        video.load();

        if(!isAdmin) {
            $('sync-overlay').classList.remove('hidden');
            onValue(ref(db, `rooms/${id}/sync`), (s) => {
                const data = s.val();
                if(data) {
                    if(Math.abs(video.currentTime - data.time) > 1.5) video.currentTime = data.time;
                    data.paused ? video.pause() : video.play();
                }
            });
        } else {
            $('admin-tag').classList.remove('hidden');
            $('sync-overlay').classList.add('hidden');
            video.ontimeupdate = () => {
                set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: video.paused });
            };
            video.onplay = () => set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: false });
            video.onpause = () => set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: true });
        }

        // Ники онлайн
        const pRef = ref(db, `rooms/${id}/users/${auth.currentUser.uid}`);
        set(pRef, auth.currentUser.displayName || "Аноним");
        onDisconnect(pRef).remove();
        onValue(ref(db, `rooms/${id}/users`), (s) => {
            $('online-users').innerHTML = '';
            if(s.val()) Object.values(s.val()).forEach(name => {
                $('online-users').innerHTML += `<span class="u-tag">${name}</span>`;
            });
        });

        // Чат
        const cRef = ref(db, `rooms/${id}/chat`);
        off(cRef);
        onValue(cRef, (s) => {
            $('chat-messages').innerHTML = '';
            if(s.val()) Object.values(s.val()).forEach(m => {
                $('chat-messages').innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.t}</div>`;
            });
            $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
        });
    }

    $('btn-send-msg').onclick = () => {
        if(!$('chat-input').value) return;
        push(ref(db, `rooms/${currentRoomId}/chat`), { u: auth.currentUser.displayName || "User", t: $('chat-input').value });
        $('chat-input').value = '';
    };

    $('btn-leave-room').onclick = () => {
        const video = $('main-video');
        video.pause();
        video.src = "";
        video.load();
        if(currentRoomId) set(ref(db, `rooms/${currentRoomId}/users/${auth.currentUser.uid}`), null);
        currentRoomId = null;
        showScreen('lobby-screen');
    };

    // --- МИКРОФОН С ВИЗУАЛИЗАЦИЕЙ ---
    let audioCtx, analyser, dataArray, source;
    $('btn-mic').onclick = async () => {
        if(!audioCtx) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 32;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            $('btn-mic').classList.add('mic-on');
            animateMic();
        } else {
            audioCtx.close(); audioCtx = null;
            $('btn-mic').classList.remove('mic-on');
            $('btn-mic').style.transform = 'scale(1)';
        }
    };

    function animateMic() {
        if(!audioCtx) return;
        requestAnimationFrame(animateMic);
        analyser.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        let scale = 1 + (sum / 128);
        $('btn-mic').style.transform = `scale(${scale})`;
    }
});