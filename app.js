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
            $('user-name').innerText = user.displayName || user.email;
            showScreen('lobby-screen');
            listenRooms();
        } else {
            showScreen('auth-screen');
        }
        $('loader').classList.remove('active');
    });

    // --- АВТОРИЗАЦИЯ ---
    $('tab-login').onclick = () => { $('login-form').classList.add('active'); $('register-form').classList.remove('active'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
    $('tab-register').onclick = () => { $('register-form').classList.add('active'); $('login-form').classList.remove('active'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };

    $('btn-login').onclick = () => signInWithEmailAndPassword(auth, $('email').value, $('pass').value).catch(alert);
    $('btn-reg').onclick = async () => {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-pass').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    };
    $('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    $('btn-out').onclick = () => signOut(auth);

    // --- МОДАЛКА ---
    $('btn-new-room').onclick = () => $('modal-box').classList.add('active');
    $('btn-cancel').onclick = () => $('modal-box').classList.remove('active');
    $('btn-confirm').onclick = async () => {
        const name = $('in-room-name').value;
        let link = $('in-room-link').value;
        if(link.includes('dropbox.com')) link = link.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?raw=1', '');
        
        const newRoom = push(ref(db, 'rooms'));
        await set(newRoom, {
            name, link, admin: auth.currentUser.uid,
            adminName: auth.currentUser.displayName || "User",
            password: $('in-room-pass').value || null
        });
        $('modal-box').classList.remove('active');
    };

    function listenRooms() {
        onValue(ref(db, 'rooms'), (s) => {
            $('rooms-list').innerHTML = '';
            if(s.val()) Object.entries(s.val()).forEach(([id, r]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.style.padding = '20px'; card.style.cursor = 'pointer';
                card.innerHTML = `<h4>${r.name}</h4><p style="font-size:12px; color:#555">Host: ${r.adminName}</p>`;
                card.onclick = () => enterRoom(id, r);
                $('rooms-list').appendChild(card);
            });
        });
    }

    // --- КОМНАТА ---
    function enterRoom(id, room) {
        if(room.password && room.admin !== auth.currentUser.uid) {
            if(prompt("Password:") !== room.password) return alert("Denied!");
        }

        currentRoomId = id;
        isAdmin = room.admin === auth.currentUser.uid;
        showScreen('room-screen');
        $('room-title').innerText = room.name;

        const video = $('v-player');
        video.src = room.link;
        video.load();

        if(!isAdmin) {
            $('v-lock').classList.remove('hidden');
            $('host-badge').classList.add('hidden');
            onValue(ref(db, `rooms/${id}/sync`), (s) => {
                const data = s.val();
                if(data) {
                    if(Math.abs(video.currentTime - data.time) > 2) video.currentTime = data.time;
                    data.paused ? video.pause() : video.play();
                }
            });
        } else {
            $('host-badge').classList.remove('hidden');
            $('v-lock').classList.add('hidden');
            video.onplay = () => set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: false });
            video.onpause = () => set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: true });
            setInterval(() => {
                if(!video.paused) set(ref(db, `rooms/${id}/sync`), { time: video.currentTime, paused: false });
            }, 2000);
        }

        // Online & Chat
        const pRef = ref(db, `rooms/${id}/users/${auth.currentUser.uid}`);
        set(pRef, auth.currentUser.displayName || "Anon");
        onDisconnect(pRef).remove();
        onValue(ref(db, `rooms/${id}/users`), (s) => {
            $('users-box').innerHTML = '';
            if(s.val()) Object.values(s.val()).forEach(n => $('users-box').innerHTML += `<span class="u-tag">${n}</span>`);
        });

        const cRef = ref(db, `rooms/${id}/chat`);
        off(cRef);
        onValue(cRef, (s) => {
            $('messages-box').innerHTML = '';
            if(s.val()) Object.values(s.val()).forEach(m => $('messages-box').innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.t}</div>`);
            $('messages-box').scrollTop = $('messages-box').scrollHeight;
        });
    }

    $('btn-send').onclick = () => {
        if(!$('msg-input').value) return;
        push(ref(db, `rooms/${currentRoomId}/chat`), { u: auth.currentUser.displayName || "User", t: $('msg-input').value });
        $('msg-input').value = '';
    };

    $('btn-back').onclick = () => {
        const video = $('v-player');
        video.pause(); video.src = "";
        if(currentRoomId) set(ref(db, `rooms/${currentRoomId}/users/${auth.currentUser.uid}`), null);
        currentRoomId = null;
        showScreen('lobby-screen');
    };

    // --- МИКРОФОН ---
    let aCtx, analyser, dataArr, source;
    $('btn-mic').onclick = async () => {
        if(!aCtx) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            aCtx = new AudioContext();
            analyser = aCtx.createAnalyser();
            source = aCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 32;
            dataArr = new Uint8Array(analyser.frequencyBinCount);
            $('btn-mic').style.color = '#ff3b30';
            const loop = () => {
                if(!aCtx) return;
                analyser.getByteFrequencyData(dataArr);
                let v = dataArr.reduce((a,b)=>a+b)/dataArr.length;
                $('btn-mic').style.transform = `scale(${1 + v/100})`;
                requestAnimationFrame(loop);
            };
            loop();
        } else {
            aCtx.close(); aCtx = null;
            $('btn-mic').style.color = '#fff';
            $('btn-mic').style.transform = 'scale(1)';
        }
    };

    // --- НЕЙРОСЕТЬ (ЧАСТИЦЫ) ---
    const cvs = $('particle-canvas'); const ctx = cvs.getContext('2d'); let pts = [];
    const res = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    window.onresize = res; res();
    for(let i=0; i<60; i++) pts.push({ x: Math.random()*cvs.width, y: Math.random()*cvs.height, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4 });
    function draw() {
        ctx.clearRect(0,0,cvs.width,cvs.height);
        pts.forEach(p => {
            p.x+=p.vx; p.y+=p.vy;
            if(p.x<0||p.x>cvs.width) p.vx*=-1; if(p.y<0||p.y>cvs.height) p.vy*=-1;
            ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fill();
            pts.forEach(p2 => {
                let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
                if(d<110) { ctx.strokeStyle=`rgba(255,255,255,${0.1 - d/1100})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); }
            });
        });
        requestAnimationFrame(draw);
    }
    draw();
});