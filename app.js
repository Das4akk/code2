import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato", // Твой ключ со скрина
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Вспомогательная функция для безопасного поиска элементов
const $ = (id) => document.getElementById(id);

// --- ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
if ($('tab-login') && $('tab-register')) {
    $('tab-login').onclick = () => {
        $('form-login').classList.remove('hidden');
        $('form-register').classList.add('hidden');
        $('tab-login').classList.add('active');
        $('tab-register').classList.remove('active');
    };
    $('tab-register').onclick = () => {
        $('form-login').classList.add('hidden');
        $('form-register').classList.remove('hidden');
        $('tab-register').classList.add('active');
        $('tab-login').classList.remove('active');
    };
}

// --- АВТОРИЗАЦИЯ ---
if ($('btn-login-email')) {
    $('btn-login-email').onclick = async () => {
        const email = $('login-email').value;
        const pass = $('login-password').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch (e) { alert("Ошибка: " + e.message); }
    };
}

if ($('btn-register-email')) {
    $('btn-register-email').onclick = async () => {
        const name = $('reg-name').value;
        const email = $('reg-email').value;
        const pass = $('reg-password').value;
        try {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
        } catch (e) { alert("Ошибка: " + e.message); }
    };
}

if ($('btn-google-auth')) {
    $('btn-google-auth').onclick = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
        catch (e) { console.error(e); }
    };
}

// --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        $('auth-screen').classList.remove('active');
        $('lobby-screen').classList.add('active');
        $('user-display-name').innerText = user.displayName || user.email;
    } else {
        $('auth-screen').classList.add('active');
        $('lobby-screen').classList.remove('active');
    }
});

if ($('btn-logout')) $('btn-logout').onclick = () => signOut(auth);

// --- ПЛЕКСУС ФОН ---
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();
class P {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x<0 || this.x>canvas.width) this.vx*=-1;
        if (this.y<0 || this.y>canvas.height) this.vy*=-1;
    }
}
for(let i=0; i<80; i++) particles.push(new P());
function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
        p.update();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2); ctx.fill();
        particles.forEach(p2 => {
            let d = Math.sqrt((p.x-p2.x)**2 + (p.y-p2.y)**2);
            if(d<100) {
                ctx.strokeStyle = `rgba(255,255,255,${1 - d/100})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(animate);
}
animate();