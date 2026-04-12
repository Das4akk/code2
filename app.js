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
    let currentRoom = null;
    let isAdmin = false;
    const video = $('main-v');

    const show = (id) => {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        $(id).style.display = 'flex';
    };

    onAuthStateChanged(auth, u => {
        if(u) { $('user-display').innerText = u.displayName || u.email; show('lobby-screen'); loadRooms(); }
        else show('auth-screen');
        $('loader').classList.remove('active');
    });

    // Auth
    $('btn-login').onclick = () => signInWithEmailAndPassword(auth, $('email').value, $('pass').value).catch(alert);
    $('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    $('btn-logout').onclick = () => signOut(auth);

    // Rooms
    $('btn-add-room').onclick = () => $('room-modal').style.display = 'flex';
    $('btn-close-modal').onclick = () => $('room-modal').style.display = 'none';

    $('btn-create-exec').onclick = async () => {
        let url = $('new-room-url').value;
        if(url.includes('dropbox.com')) url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').split('?')[0];
        
        const r = push(ref(db, 'rooms'));
        await set(r, {
            name: $('new-room-title').value,
            link: url,
            host: auth.currentUser.uid,
            hostName: auth.currentUser.displayName || "User"
        });
        $('room-modal').style.display = 'none';
    };

    function loadRooms() {
        onValue(ref(db, 'rooms'), s => {
            $('rooms-grid').innerHTML = '';
            if(s.val()) Object.entries(s.val()).forEach(([id, r]) => {
                const div = document.createElement('div');
                div.className = 'room-card glass-panel';
                div.innerHTML = `<h4>${r.name}</h4><p style="font-size:10px; opacity:0.3">by ${r.hostName}</p>`;
                div.onclick = () => enter(id, r);
                $('rooms-grid').appendChild(div);
            });
        });
    }

    // Player Sync
    function enter(id, r) {
        currentRoom = id;
        isAdmin = r.host === auth.currentUser.uid;
        show('room-screen');
        $('room-name-display').innerText = r.name;
        video.src = r.link;
        video.load();

        if(!isAdmin) {
            $('v-tap-blocker').classList.remove('hidden');
            $('v-ui-panel').style.display = 'none';
            onValue(ref(db, `rooms/${id}/sync`), snap => {
                const data = snap.val();
                if(data) {
                    if(Math.abs(video.currentTime - data.t) > 1.5) video.currentTime = data.t;
                    data.p ? video.pause() : video.play();
                }
            });
        } else {
            $('admin-label').classList.remove('hidden');
            $('v-tap-blocker').classList.add('hidden');
            $('v-ui-panel').style.display = 'flex';
            video.onplay = () => sync(false);
            video.onpause = () => sync(true);
            video.ontimeupdate = () => {
                $('v-progress').value = (video.currentTime / video.duration) * 100 || 0;
                sync(video.paused);
            };
        }

        // Online & Chat
        const oRef = ref(db, `rooms/${id}/u/${auth.currentUser.uid}`);
        set(oRef, auth.currentUser.displayName || "User");
        onDisconnect(oRef).remove();
        onValue(ref(db, `rooms/${id}/u`), s => {
            $('users-online').innerHTML = s.val() ? Object.values(s.val()).map(n => `<span>${n}</span>`).join(', ') : '';
        });

        const cRef = ref(db, `rooms/${id}/chat`);
        off(cRef);
        onValue(cRef, s => {
            $('messages-box').innerHTML = s.val() ? Object.values(s.val()).map(m => `<div class="msg"><b>${m.u}:</b>${m.t}</div>`).join('') : '';
            $('messages-box').scrollTop = $('messages-box').scrollHeight;
        });
    }

    const sync = (isPaused) => {
        if(isAdmin) set(ref(db, `rooms/${currentRoom}/sync`), { t: video.currentTime, p: isPaused });
    };

    $('play-pause').onclick = () => video.paused ? video.play() : video.pause();
    $('v-progress').oninput = () => { if(isAdmin) video.currentTime = ($('v-progress').value / 100) * video.duration; };
    $('btn-full').onclick = () => video.requestFullscreen();

    $('btn-send-chat').onclick = () => {
        if(!$('chat-input').value) return;
        push(ref(db, `rooms/${currentRoom}/chat`), { u: auth.currentUser.displayName || "User", t: $('chat-input').value });
        $('chat-input').value = '';
    };

    $('btn-leave').onclick = () => {
        video.pause(); video.src = "";
        if(currentRoom) set(ref(db, `rooms/${currentRoom}/u/${auth.currentUser.uid}`), null);
        currentRoom = null;
        show('lobby-screen');
    };

    // Particles (Neuro)
    const cvs = $('particle-canvas'); const ctx = cvs.getContext('2d'); let pts = [];
    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    window.onresize = resize; resize();
    for(let i=0; i<50; i++) pts.push({ x: Math.random()*cvs.width, y: Math.random()*cvs.height, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3 });
    function draw() {
        ctx.clearRect(0,0,cvs.width,cvs.height);
        pts.forEach(p => {
            p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>cvs.width) p.vx*=-1; if(p.y<0||p.y>cvs.height) p.vy*=-1;
            ctx.fillStyle="rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fill();
            pts.forEach(p2 => {
                let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
                if(d<120) { ctx.strokeStyle=`rgba(255,255,255,${0.05 - d/2400})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
            });
        });
        requestAnimationFrame(draw);
    }
    draw();
});