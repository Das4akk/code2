import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    let ytPlayer = null;

    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $(id).classList.add('active');
    }

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

    // --- AUTH ---
    $('btn-login-email').onclick = () => signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(alert);
    $('btn-register-email').onclick = async () => {
        try {
            const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
            await updateProfile(res.user, { displayName: $('reg-name').value });
        } catch(e) { alert(e.message); }
    };
    $('btn-google-auth').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    $('btn-logout').onclick = () => signOut(auth);

    $('tab-login').onclick = () => { $('form-login').classList.remove('hidden'); $('form-register').classList.add('hidden'); };
    $('tab-register').onclick = () => { $('form-login').classList.add('hidden'); $('form-register').classList.remove('hidden'); };

    // --- ROOMS ---
    $('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
    $('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

    $('btn-create-finish').onclick = async () => {
        const name = $('room-name').value;
        const link = $('room-link').value;
        const pass = $('room-pass').value;
        if(!name || !link) return alert("Заполни данные!");

        const newRoomRef = push(ref(db, 'rooms'));
        await set(newRoomRef, {
            name, link, password: pass || null,
            admin: auth.currentUser.uid,
            adminName: auth.currentUser.displayName || "User"
        });
        $('modal-create').classList.remove('active');
    };

    function listenRooms() {
        onValue(ref(db, 'rooms'), (snap) => {
            const grid = $('rooms-grid');
            grid.innerHTML = '';
            if(snap.val()) {
                Object.entries(snap.val()).forEach(([id, room]) => {
                    const card = document.createElement('div');
                    card.className = 'room-card glass-panel';
                    card.innerHTML = `<h4>${room.name}</h4><p>Админ: ${room.adminName}</p>`;
                    card.onclick = () => enterRoom(id, room);
                    grid.appendChild(card);
                });
            }
        });
    }

    async function enterRoom(id, room) {
        if(room.password && room.admin !== auth.currentUser.uid) {
            const p = prompt("Введите пароль:");
            if(p !== room.password) return alert("Доступ закрыт!");
        }

        currentRoomId = id;
        const isAdmin = room.admin === auth.currentUser.uid;
        showScreen('room-screen');
        $('current-room-name').innerText = room.name;
        isAdmin ? $('admin-label').classList.remove('hidden') : $('admin-label').classList.add('hidden');

        const container = $('player-container');
        container.innerHTML = '';

        if(room.link.includes('youtube') || room.link.includes('youtu.be')) {
            const vid = room.link.split('v=')[1] || room.link.split('/').pop();
            container.innerHTML = `<div id="yt-player"></div>`;
            ytPlayer = new YT.Player('yt-player', {
                videoId: vid,
                playerVars: { controls: isAdmin ? 1 : 0 },
                events: { 'onReady': (e) => { if(!isAdmin) e.target.mute(); } }
            });
        } else {
            container.innerHTML = `<video id="video-core" src="${room.link}" ${isAdmin?'controls':''}></video>`;
        }

        // Online & Chat
        const presenceRef = ref(db, `rooms/${id}/online/${auth.currentUser.uid}`);
        set(presenceRef, true);
        onDisconnect(presenceRef).remove();
        onValue(ref(db, `rooms/${id}/online`), (s) => $('online-count').innerText = s.val() ? Object.keys(s.val()).length : 0);

        onValue(ref(db, `rooms/${id}/chat`), (s) => {
            const box = $('chat-messages'); box.innerHTML = '';
            if(s.val()) Object.values(s.val()).forEach(m => {
                box.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.text}</div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    }

    $('btn-send-msg').onclick = () => {
        const t = $('chat-input').value;
        if(!t) return;
        push(ref(db, `rooms/${currentRoomId}/chat`), { user: auth.currentUser.displayName || "Anon", text: t });
        $('chat-input').value = '';
    };

    $('btn-leave-room').onclick = () => {
        if(currentRoomId) set(ref(db, `rooms/${currentRoomId}/online/${auth.currentUser.uid}`), null);
        currentRoomId = null;
        showScreen('lobby-screen');
    };

    // --- PLEXUS ---
    const canvas = $('particle-canvas'); const ctx = canvas.getContext('2d'); let pts = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.onresize = resize; resize();
    for(let i=0; i<60; i++) pts.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5 });
    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        pts.forEach(p => {
            p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>canvas.width) p.vx*=-1; if(p.y<0||p.y>canvas.height) p.vy*=-1;
            ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fill();
            pts.forEach(p2 => {
                let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
                if(d<100) { ctx.strokeStyle=`rgba(255,255,255,${0.15-d/700})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
            });
        });
        requestAnimationFrame(draw);
    }
    draw();
});