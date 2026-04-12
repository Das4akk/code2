import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- ЭКРАНЫ ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if($(id)) $(id).classList.add('active');
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        if($('user-display-name')) $('user-display-name').innerText = user.displayName || user.email;
        showScreen('lobby-screen');
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
    $('loader').classList.remove('active');
});

// --- ТАБЫ ---
$('tab-login').onclick = () => {
    $('form-login').classList.remove('hidden-form');
    $('form-register').classList.add('hidden-form', 'right');
    $('tab-login').classList.add('active');
    $('tab-register').classList.remove('active');
};
$('tab-register').onclick = () => {
    $('form-login').classList.add('hidden-form', 'left');
    $('form-register').classList.remove('hidden-form', 'right');
    $('tab-register').classList.add('active');
    $('tab-login').classList.remove('active');
};

// --- AUTH ACTIONS ---
$('btn-login-email').onclick = () => {
    signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value).catch(e => alert(e.message));
};
$('btn-register-email').onclick = async () => {
    try {
        const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value);
        await updateProfile(res.user, { displayName: $('reg-name').value });
    } catch(e) { alert(e.message); }
};
$('btn-google-auth').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
$('btn-logout').onclick = () => signOut(auth);

// --- ЛОГИКА КОМНАТ ---
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    const pass = $('room-pass').value;

    if(!name || !link) return alert("Заполни название и ссылку!");

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    
    await set(newRoomRef, {
        name,
        link,
        password: pass || null,
        admin: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "Admin",
        createdAt: Date.now()
    });

    $('modal-create').classList.remove('active');
    alert("Комната создана! Скоро добавим переход внутрь.");
};

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        const data = snap.val();
        if(data) {
            Object.entries(data).forEach(([id, room]) => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `
                    <h4>${room.name}</h4>
                    <p>Админ: ${room.adminName}</p>
                    <button class="primary-btn" style="margin-top:10px">Войти</button>
                `;
                grid.appendChild(card);
            });
        }
    });
}

// --- НЕЙРОСЕТИ (ПЛЕКСУС) ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let dots = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();

class Dot {
    constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if(this.x<0 || this.x>canvas.width) this.vx *= -1;
        if(this.y<0 || this.y>canvas.height) this.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.2, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<70; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.draw();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 110) {
                ctx.strokeStyle = `rgba(255,255,255,${1 - dist/110})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();