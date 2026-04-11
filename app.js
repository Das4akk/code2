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
const videoRef = ref(db, 'sync_v10');
const chatRef = ref(db, 'chat_v10');
const voiceRef = ref(db, 'voice_v10');

let myUser = { name: "" };
let isRemoteAction = false;
let myStream = null;
const peer = new Peer();

const player = document.getElementById('native-player');
const chatMessages = document.getElementById('chat-messages');

// --- ФОН ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function initC() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = initC; initC();

class P {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    update() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0||this.x>canvas.width) this.vx*=-1; if(this.y<0||this.y>canvas.height) this.vy*=-1;
        ctx.fillStyle='rgba(150,150,150,0.5)'; ctx.beginPath(); ctx.arc(this.x,this.y,1,0,Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<50; i++) particles.push(new P());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach((p,i)=>{
        p.update();
        for(let j=i+1; j<particles.length; j++){
            let dx=p.x-particles[j].x, dy=p.y-particles[j].y, d=Math.sqrt(dx*dx+dy*dy);
            if(d<120){ ctx.strokeStyle=`rgba(150,150,150,${1-d/120})`; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(particles[j].x,particles[j].y); ctx.stroke(); }
        }
    });
    requestAnimationFrame(anim);
}
anim();

// --- ГОЛОС ---
peer.on('call', (call) => {
    call.answer(myStream);
    const audio = new Audio();
    call.on('stream', (s) => { audio.srcObject = s; audio.play(); });
});

document.getElementById('mic-toggle').onclick = async function() {
    if(!myStream) {
        myStream = await navigator.mediaDevices.getUserMedia({audio:true});
        myStream.getAudioTracks()[0].enabled = false;
    }
    const act = this.classList.toggle('active');
    myStream.getAudioTracks()[0].enabled = act;
    if(act) set(ref(db, 'voice_v10/'+myUser.name), peer.id);
};

onValue(voiceRef, (s) => {
    const users = s.val();
    for(let id in users) {
        if(id !== myUser.name && myStream) {
            const call = peer.call(users[id], myStream);
            const audio = new Audio();
            call.on('stream', (st) => { audio.srcObject = st; audio.play(); });
        }
    }
});

// --- ВХОД ---
const saved = localStorage.getItem('cow_username');
if(saved) document.getElementById('username-input').value = saved;

document.getElementById('login-btn').onclick = () => {
    const n = document.getElementById('username-input').value.trim();
    if(n) {
        myUser.name = n;
        localStorage.setItem('cow_username', n);
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
    }
};

// --- СИНХРОН ---
player.onplay = () => { if(!isRemoteAction) set(videoRef, {type:'play', time:player.currentTime, u:myUser.name, ts:Date.now()}); };
player.onpause = () => { if(!isRemoteAction) set(videoRef, {type:'pause', time:player.currentTime, u:myUser.name, ts:Date.now()}); };

onValue(videoRef, (s) => {
    const d = s.val();
    if(!d || d.u === myUser.name) return;
    isRemoteAction = true;
    if(d.type === 'play') { player.currentTime = d.time; player.play(); }
    if(d.type === 'pause') { player.pause(); player.currentTime = d.time; }
    setTimeout(()=> isRemoteAction = false, 1000);
});

// --- ЧАТ ---
const send = () => {
    const i = document.getElementById('chat-input');
    if(i.value.trim()) { push(chatRef, {u:myUser.name, c:i.value.trim()}); i.value=''; }
};
document.getElementById('send-btn').onclick = send;
onChildAdded(chatRef, (s) => {
    const m = s.val();
    const d = document.createElement('div');
    d.className = m.u === myUser.name ? 'm-line self' : 'm-line';
    d.innerHTML = `<div class="bubble"><strong>${m.u}</strong><p>${m.c}</p></div>`;
    chatMessages.appendChild(d);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});