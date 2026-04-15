import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnLHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const videoRef = ref(db, 'sync_v12');
const chatRef = ref(db, 'chat_v12');
const voiceRef = ref(db, 'voice_peers_v12');

let myUser = { name: "" };
let isRemoteAction = false;
let lastSyncTs = 0;
let myStream = null;
const peer = new Peer(); // Создаем Peer для голоса

const player = document.getElementById('native-player');
const chatMessages = document.getElementById('chat-messages');

// --- ФОН ПЛЕКСУС ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function initCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = initCanvas; initCanvas();
class P {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x<0 || this.x>canvas.width || this.y<0 || this.y>canvas.height) this.vy*=-1;
    }
}
for (let i=0; i<60; i++) particles.push(new P());
function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach((p,i) => {
        p.update();
        ctx.fillStyle = 'rgba(150,150,150,0.4)'; ctx.beginPath(); ctx.arc(p.x,p.y,1.2,0,Math.PI*2); ctx.fill();
        for (let j=i+1; j<particles.length; j++){
            let dx=p.x-particles[j].x, dy=p.y-particles[j].y, dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<150){ ctx.strokeStyle=`rgba(150,150,150,${1-dist/150})`; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(particles[j].x,particles[j].y); ctx.stroke(); }
        }
    });
    requestAnimationFrame(animate);
}
animate();

// --- ГОЛОСОВОЙ ДВИЖОК ---
peer.on('call', (call) => {
    call.answer(myStream);
    const audio = new Audio();
    call.on('stream', (remoteStream) => { audio.srcObject = remoteStream; audio.play(); });
});

document.getElementById('mic-btn').onclick = async function() {
    if (!myStream) {
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            myStream.getAudioTracks()[0].enabled = false;
        } catch (e) { alert("Включи микрофон в браузере!"); return; }
    }
    const isActive = this.classList.toggle('active');
    myStream.getAudioTracks()[0].enabled = isActive;
    if (isActive) set(ref(db, 'voice_peers_v12/' + myUser.name), peer.id);
};

onValue(voiceRef, (snap) => {
    const data = snap.val();
    for (let id in data) {
        if (id !== myUser.name && myStream) {
            const call = peer.call(data[id], myStream);
            const audio = new Audio();
            call.on('stream', (rs) => { audio.srcObject = rs; audio.play(); });
        }
    }
});

// --- ВХОД ---
const saved = localStorage.getItem('cow_username');
if (saved) document.getElementById('username-input').value = saved;
document.getElementById('login-btn').onclick = () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
        myUser.name = val;
        localStorage.setItem('cow_username', val);
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
    }
};
// --- СИНХРОНИЗАЦИЯ ---
player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, user: myUser.name, ts: Date.now() }); };
player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, user: myUser.name, ts: Date.now() }); };
onValue(videoRef, (snap) => {
    const d = snap.val();
    if (!d || d.ts <= lastSyncTs) return;
    lastSyncTs = d.ts;
    isRemoteAction = true;
    if (d.type === 'play') { player.currentTime = d.time; player.play(); }
    if (d.type === 'pause') { player.pause(); player.currentTime = d.time; }
    setTimeout(() => isRemoteAction = false, 1000);
});

// --- ЧАТ ---
const sendMsg = () => {
    const inp = document.getElementById('chat-input');
    if (inp.value.trim()) { push(chatRef, { user: myUser.name, content: inp.value.trim() }); inp.value = ''; }
};
document.getElementById('send-btn').onclick = sendMsg;
document.getElementById('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };
onChildAdded(chatRef, (snap) => {
    const m = snap.val();
    const div = document.createElement('div');
    div.className = m.user === myUser.name ? 'm-line self' : 'm-line';
    div.innerHTML = `<div class="bubble"><strong>${m.user}</strong><p>${m.content}</p></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});