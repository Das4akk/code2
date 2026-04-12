// ... (твой импорт Firebase и firebaseConfig)

const auth = getAuth(app);
const db = getDatabase(app);

// МГНОВЕННЫЙ ПЕРЕКЛЮЧАТЕЛЬ ЭКРАНОВ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// АВТО-ВХОД (ЗАПОМИНАНИЕ СИСТЕМЫ)
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-display-name').innerText = user.displayName || user.email;
        showScreen('lobby-screen');
        loadRooms(); // Подгружаем лобби сразу
    } else {
        showScreen('auth-screen');
    }
});

// АНИМАЦИЯ ПЕРЕКЛЮЧЕНИЯ ТАБОВ
document.getElementById('tab-login').onclick = () => {
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
};

document.getElementById('tab-register').onclick = () => {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
};

// БЫСТРЫЙ ВХОД
document.getElementById('btn-login-email').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Ошибка: " + e.message); }
};

// ЗАГРУЗКА ЛОББИ (RAVE STYLE)
function loadRooms() {
    const roomsRef = ref(db, 'rooms');
    onValue(roomsRef, (snapshot) => {
        const grid = document.getElementById('rooms-grid');
        grid.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(id => {
                const room = data[id];
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `
                    <h4>${room.name}</h4>
                    <p style="color: #666; font-size: 0.8rem;">Сейчас смотрят: ${room.online || 1}</p>
                    <button class="primary-btn" style="margin-top:10px; padding: 8px;">Войти</button>
                `;
                card.onclick = () => joinRoom(id);
                grid.appendChild(card);
            });
        }
    });
}

// ВЫХОД
document.getElementById('btn-logout').onclick = () => signOut(auth);