import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Твои данные из Firebase Console
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
const auth = getAuth(app);

// --- ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
const tabLogin = document.getElementById('tab-login');
const tabReg = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formReg = document.getElementById('form-register');

tabLogin.onclick = () => {
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
};

tabReg.onclick = () => {
    formLogin.classList.add('hidden');
    formReg.classList.remove('hidden');
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
};

// --- АВТОРИЗАЦИЯ (ФИКС ОШИБОК) ---
document.getElementById('btn-login-email').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value; // Исправлено ID
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
        alert("Ошибка входа: " + e.message);
    }
};

document.getElementById('btn-register-email').onclick = async () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
    } catch (e) {
        alert("Ошибка регистрации: " + e.message);
    }
};

document.getElementById('btn-google-auth').onclick = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        console.error("Ошибка Google:", e);
        if (e.code === 'auth/popup-blocked') {
            alert("Пожалуйста, разрешите всплывающие окна для этого сайта в браузере!");
        }
    }
};

// --- ОТСЛЕЖИВАНИЕ СОСТОЯНИЯ ---
onAuthStateChanged(auth, (user) => {
    const authScreen = document.getElementById('auth-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    
    if (user) {
        authScreen.classList.remove('active');
        lobbyScreen.classList.add('active');
        document.getElementById('user-display-name').innerText = user.displayName || user.email;
    } else {
        authScreen.classList.add('active');
        lobbyScreen.classList.remove('active');
    }
});

document.getElementById('btn-logout').onclick = () => signOut(auth);

// --- ПЛЕКСУС ФОН ---
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
}

for(let i=0; i<100; i++) particles.push(new Particle());

function animate() {
    ctx.clearRect(0,0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI*2);
        ctx.fill();
        
        particles.forEach(p2 => {
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < 100) {
                ctx.strokeStyle = `rgba(255,255,255,${1 - dist/100})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    });
    requestAnimationFrame(animate);
}
animate();