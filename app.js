import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
    const video = $('main-v');
    let currentRoomId = null;
    let isAdmin = false;

    const setScreen = (id) => {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        $(id).style.display = 'flex';
    };

    onAuthStateChanged(auth, (user) => {
        if (user) {
            $('user-display').innerText = user.displayName || user.email;
            setScreen('lobby-screen');
            loadRooms();
        } else {
            setScreen('auth-screen');
        }
        $('loader').classList.remove('active');
    });

    // --- AUTH ---
    $('btn-login').onclick = () => signInWithEmailAndPassword(auth, $('email').value, $('pass').value).catch(alert);
    $('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
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
            hostName: auth.currentUser.displayName || "User"
        });
        $('modal').classList.add('hidden');
    };

    function loadRooms() {
        onValue(ref(db, 'rooms'), s => {
            $('rooms-grid').innerHTML = '';
            if(s.val()) Object.entries(s.val()).forEach(([id, r]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `<h3>${r.name}</h3><p style="font-size:10px; opacity:0.2; margin-top:10px;">${r.hostName}</p>`;
                card.onclick = () => enterRoom(id, r);
                $('rooms-grid').appendChild(card);
            });
        });
    }

    // --- ROOM LOGIC ---
    function enterRoom(id, r) {
        currentRoomId = id;
        isAdmin = r.host === auth.currentUser.uid;
        setScreen('room-screen');
        $('room-name-display').innerText = r.name;
        video.src = r.link;
        video.load();

        if (isAdmin) {
            video.controls = true;
            $('admin-tag').classList.remove('hidden');
            $('v-lock').classList.add('hidden');
            
            const sync = () => set(ref(db, `rooms/${id}/sync`), { t: video.currentTime, p: video.paused });
            video.onplay = sync;
            video.onpause = sync;
            video.onseeking = sync;
        } else {
            video.controls = true; // Нужны для iOS
            $('admin-tag').classList.add('hidden');
            $('v-lock').classList.remove('hidden'); // Блочим клики

            onValue(ref(db, `rooms/${id}/sync`), (snap) => {
                const data = snap.val();
                if (data) {
                    if (Math.abs(video.currentTime - data.t) > 2) video.currentTime = data.t;
                    data.p ? video.pause() : video.play();
                }
            });
        }

        // Chat & Online
        const userRef = ref(db, `rooms/${id}/users/${auth.currentUser.uid}`);
        set(userRef, auth.currentUser.displayName || "User");
        onDisconnect(userRef).remove();

        onValue(ref(db, `rooms/${id}/users`), s => {
            $('users-online').innerText = s.val() ? Object.values(s.val()).join(', ') : '';
        });

        const chatRef = ref(db, `rooms/${id}/chat`);
        off(chatRef);
        onValue(chatRef, s => {
            $('messages-box').innerHTML = s.val() ? Object.values(s.val()).map(m => `<div class="msg"><b>${m.u}:</b> ${m.t}</div>`).join('') : '';
            $('messages-box').scrollTop = $('messages-box').scrollHeight;
        });
    }

    $('btn-send-chat').onclick = () => {
        if (!$('chat-input').value) return;
        push(ref(db, `rooms/${currentRoomId}/chat`), { u: auth.currentUser.displayName || "User", t: $('chat-input').value });
        $('chat-input').value = '';
    };

    $('btn-leave').onclick = () => {
        video.pause(); video.src = "";
        if(currentRoomId) set(ref(db, `rooms/${currentRoomId}/users/${auth.currentUser.uid}`), null);
        currentRoomId = null;
        setScreen('lobby-screen');
    };

    // --- NEURO BACKGROUND ---
    const cvs = $('particle-canvas'); const ctx = cvs.getContext('2d'); let pts = [];
    const res = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    window.onresize = res; res();
    for(let i=0; i<60; i++) pts.push({ x: Math.random()*cvs.width, y: Math.random()*cvs.height, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3 });
    function draw() {
        ctx.clearRect(0,0,cvs.width,cvs.height);
        pts.forEach(p => {
            p.x+=p.vx; p.y+=p.vy;
            if(p.x<0||p.x>cvs.width) p.vx*=-1; if(p.y<0||p.y>cvs.height) p.vy*=-1;
            ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fill();
            pts.forEach(p2 => {
                let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
                if(d<110) { ctx.strokeStyle=`rgba(255,255,255,${0.06 - d/1100})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
            });
        });
        requestAnimationFrame(draw);
    }
    draw();
});