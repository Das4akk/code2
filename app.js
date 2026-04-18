import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    get, 
    onValue, 
    onChildAdded, 
    onChildRemoved,
    onDisconnect, 
    remove, 
    update,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// --- КОНФИГУРАЦИЯ FIREBASE ---
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Устанавливаем сохранение сессии
setPersistence(auth, browserLocalPersistence);

// ==========================================
// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
// ==========================================
let currentUser = null;
let currentRoomId = null;
let localStream = null;
let isMicActive = false;
let peerConnections = {}; // uid -> RTCPeerConnection
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Селекторы
const $ = (id) => document.getElementById(id);
const screens = {
    auth: $('auth-screen'),
    lobby: $('lobby-screen'),
    room: $('room-screen')
};

// ==========================================
// --- СИСТЕМА УВЕДОМЛЕНИЙ (TOAST) ---
// ==========================================
function showToast(text) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ==========================================
// --- АНИМАЦИЯ НЕЙРО-ФОНА (NEURAL NETWORK) ---
// ==========================================
function initNeuralBackground() {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dots = [];
    const dotCount = 80;
    const connectionDist = 140;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    class Dot {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
    }

    for (let i = 0; i < dotCount; i++) dots.push(new Dot());

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        
        for (let i = 0; i < dots.length; i++) {
            const d = dots[i];
            d.update();
            ctx.beginPath();
            ctx.arc(d.x, d.y, 1.2, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < dots.length; j++) {
                const d2 = dots[j];
                const dist = Math.sqrt((d.x - d2.x)**2 + (d.y - d2.y)**2);
                if (dist < connectionDist) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 - dist/connectionDist * 0.15})`;
                    ctx.lineWidth = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d2.x, d2.y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}

// ==========================================
// --- СИСТЕМА ОНЛАЙНА ---
// ==========================================
function setupOnlineSystem() {
    const onlineRef = ref(db, '.info/connected');
    const statusRef = ref(db, `status/${currentUser.uid}`);

    onValue(onlineRef, (snap) => {
        if (snap.val() === false) return;
        onDisconnect(statusRef).set({ online: false, lastSeen: serverTimestamp() }).then(() => {
            set(statusRef, { online: true, lastSeen: serverTimestamp() });
        });
    });

    // Общий счетчик онлайна
    onValue(ref(db, 'status'), (snap) => {
        let count = 0;
        snap.forEach(child => {
            if (child.val().online) count++;
        });
        const counterEl = $('online-count');
        if (counterEl) counterEl.innerText = count;
        const globalCounter = $('global-online-count');
        if (globalCounter) globalCounter.innerText = count;
    });
}

// ==========================================
// --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
// ==========================================
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s?.classList.remove('active'));
    if (screens[screenName]) screens[screenName].classList.add('active');
}

// ==========================================
// --- МОБИЛЬНОЕ МЕНЮ (FIX) ---
// ==========================================
function initMobileUI() {
    const burger = $('toggle-sidebar');
    const sidebar = $('main-sidebar');
    if (burger && sidebar) {
        burger.onclick = () => {
            sidebar.classList.toggle('open');
        };
        // Закрытие при клике по пункту
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => sidebar.classList.remove('open'));
        });
    }
}

// ==========================================
// --- СИСТЕМА ПРОФИЛЕЙ (FIXED) ---
// ==========================================

// Сохранение своего профиля
async function saveMyProfile() {
    const username = $('edit-username').value.trim();
    const bio = $('edit-bio').value.trim();
    const avatar = $('edit-avatar-url').value.trim();

    if (!username) return showToast("Ник не может быть пустым");

    try {
        const profileRef = ref(db, `users/${currentUser.uid}/profile`);
        await update(profileRef, {
            username: username,
            bio: bio,
            avatar: avatar,
            updatedAt: serverTimestamp()
        });
        
        await updateProfile(auth.currentUser, { displayName: username });
        showToast("Профиль успешно сохранен!");
        $('modal-edit-profile').classList.remove('active');
    } catch (e) {
        showToast("Ошибка сохранения: " + e.message);
    }
}

// Загрузка своего профиля в UI
function syncMyProfileUI() {
    onValue(ref(db, `users/${currentUser.uid}/profile`), (snap) => {
        const p = snap.val();
        if (!p) return;
        
        if ($('my-name-display')) $('my-name-display').innerText = p.username;
        const avatarBox = $('my-avatar-display');
        if (avatarBox) {
            avatarBox.innerHTML = p.avatar ? `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;">` : p.username[0].toUpperCase();
        }
    });
}

// Открытие чужого профиля
async function viewUserProfile(uid) {
    try {
        const snap = await get(ref(db, `users/${uid}/profile`));
        if (!snap.exists()) return showToast("Профиль не найден");
        
        const p = snap.val();
        $('view-avatar').innerHTML = p.avatar ? `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : p.username[0].toUpperCase();
        $('view-name').innerText = p.username;
        $('view-bio').innerText = p.bio || "Нет информации";
        
        // Кнопка добавления в друзья
        const actionBtn = $('btn-add-friend');
        if (uid === currentUser.uid) {
            actionBtn.style.display = 'none';
        } else {
            actionBtn.style.display = 'block';
            actionBtn.onclick = () => sendFriendRequest(uid, p.username);
        }

        $('modal-view-profile').classList.add('active');
    } catch (e) {
        showToast("Ошибка загрузки профиля");
    }
}

// ==========================================
// --- СИСТЕМА ДРУЗЕЙ (FIXED) ---
// ==========================================

async function sendFriendRequest(targetUid, targetName) {
    try {
        const requestRef = ref(db, `users/${targetUid}/requests/${currentUser.uid}`);
        await set(requestRef, {
            username: currentUser.displayName || "User",
            timestamp: serverTimestamp()
        });
        showToast(`Заявка отправлена ${targetName}`);
    } catch (e) {
        showToast("Не удалось отправить заявку");
    }
}

function loadFriendsSystem() {
    // Список входящих заявок
    const reqListEl = $('friend-requests-list');
    onValue(ref(db, `users/${currentUser.uid}/requests`), (snap) => {
        if (!reqListEl) return;
        reqListEl.innerHTML = '';
        if (!snap.exists()) {
            reqListEl.innerHTML = '<div style="font-size:12px;opacity:0.5;padding:10px;">Заявок нет</div>';
            return;
        }

        snap.forEach(child => {
            const uid = child.key;
            const data = child.val();
            
            const div = document.createElement('div');
            div.className = 'friend-request-item';
            div.innerHTML = `
                <span style="font-weight:600">${data.username}</span>
                <div class="friend-btn-group">
                    <button class="btn-small btn-accept" id="acc-${uid}">Принять</button>
                    <button class="btn-small btn-decline" id="dec-${uid}">Х</button>
                </div>
            `;
            reqListEl.appendChild(div);

            // Обработчики кнопок (FIX: Раньше был просто текст)
            $(`acc-${uid}`).onclick = () => acceptFriend(uid, data.username);
            $(`dec-${uid}`).onclick = () => declineFriend(uid);
        });
    });

    // Список друзей
    const friendsListEl = $('friends-list');
    onValue(ref(db, `users/${currentUser.uid}/friends`), (snap) => {
        if (!friendsListEl) return;
        friendsListEl.innerHTML = '';
        snap.forEach(child => {
            const uid = child.key;
            const data = child.val();
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.innerHTML = `<span class="online-dot"></span> ${data.username}`;
            item.onclick = () => viewUserProfile(uid);
            friendsListEl.appendChild(item);
        });
    });
}

async function acceptFriend(uid, name) {
    try {
        const myFriendsRef = ref(db, `users/${currentUser.uid}/friends/${uid}`);
        const theirFriendsRef = ref(db, `users/${uid}/friends/${currentUser.uid}`);
        const myRequestRef = ref(db, `users/${currentUser.uid}/requests/${uid}`);

        await set(myFriendsRef, { username: name });
        await set(theirFriendsRef, { username: currentUser.displayName });
        await remove(myRequestRef);
        
        showToast("Друг добавлен!");
    } catch (e) {
        showToast("Ошибка: " + e.message);
    }
}

async function declineFriend(uid) {
    await remove(ref(db, `users/${currentUser.uid}/requests/${uid}`));
    showToast("Заявка отклонена");
}

// ==========================================
// --- MIC / ГОЛОСОВОЙ ЧАТ (WEBRTC FIX) ---
// ==========================================

async function toggleMic() {
    if (isMicActive) {
        stopLocalMic();
    } else {
        await startLocalMic();
    }
}

async function startLocalMic() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        $('mic-toggle').classList.add('active');
        showToast("Микрофон включен");

        // Если мы уже в комнате, добавляем трек во все соединения
        Object.values(peerConnections).forEach(pc => {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        });
    } catch (e) {
        showToast("Доступ к микрофону запрещен");
    }
}

function stopLocalMic() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    isMicActive = false;
    $('mic-toggle').classList.remove('active');
    showToast("Микрофон выключен");
}

async function initVoiceSignaling() {
    const roomPeersRef = ref(db, `rooms/${currentRoomId}/peers`);
    const myPeerRef = ref(db, `rooms/${currentRoomId}/peers/${currentUser.uid}`);

    // Добавляем себя в список активных участников комнаты
    await set(myPeerRef, { username: currentUser.displayName, joinedAt: serverTimestamp() });
    onDisconnect(myPeerRef).remove();

    // Слушаем появление других участников
    onChildAdded(roomPeersRef, (snap) => {
        const otherUid = snap.key;
        if (otherUid === currentUser.uid) return;
        initPeerConnection(otherUid, true); // Мы создаем оффер
    });

    onChildRemoved(roomPeersRef, (snap) => {
        const otherUid = snap.key;
        if (peerConnections[otherUid]) {
            peerConnections[otherUid].close();
            delete peerConnections[otherUid];
            $(`audio-${otherUid}`)?.remove();
        }
    });

    // Слушаем сигналы (SDP/ICE)
    const signalsRef = ref(db, `signals/${currentRoomId}/${currentUser.uid}`);
    onChildAdded(signalsRef, async (snap) => {
        const signal = snap.val();
        const fromUid = signal.from;

        if (!peerConnections[fromUid]) initPeerConnection(fromUid, false);
        const pc = peerConnections[fromUid];

        try {
            if (signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(fromUid, { type: 'answer', sdp: answer });
            } else if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            } else if (signal.type === 'ice') {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        } catch (e) { console.error("RTC Error:", e); }
        
        remove(snap.ref);
    });
}

function initPeerConnection(otherUid, isInitiator) {
    if (peerConnections[otherUid]) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[otherUid] = pc;

    // Добавляем локальный поток если он уже включен
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(otherUid, { type: 'ice', candidate: e.candidate });
    };

    pc.ontrack = (e) => {
        let audio = $(`audio-${otherUid}`);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${otherUid}`;
            audio.autoplay = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
        }
        audio.srcObject = e.streams[0];
        // Важно: на мобилках часто требуется взаимодействие для начала звука
        audio.play().catch(() => {
            showToast("Нажмите на экран, чтобы услышать друзей");
        });
    };

    if (isInitiator) {
        pc.onnegotiationneeded = async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(otherUid, { type: 'offer', sdp: offer });
        };
    }
}

function sendSignal(toUid, data) {
    push(ref(db, `signals/${currentRoomId}/${toUid}`), { ...data, from: currentUser.uid });
}

// ==========================================
// --- КОМНАТЫ И ЧАТ ---
// ==========================================

async function joinRoom(id) {
    currentRoomId = id;
    switchScreen('room-screen');
    
    const snap = await get(ref(db, `rooms/${id}`));
    const room = snap.val();
    $('current-room-name').innerText = room.name;
    
    const video = $('main-video');
    video.src = room.videoUrl;
    
    // Системное сообщение
    sendChatMessage(`${currentUser.displayName} присоединился к просмотру`, true);

    // Чат
    onValue(ref(db, `chats/${id}`), (snap) => {
        const box = $('chat-messages');
        box.innerHTML = '';
        snap.forEach(child => {
            const m = child.val();
            const div = document.createElement('div');
            if (m.system) {
                div.className = 'system-msg';
                div.innerText = `------ ${m.text} ------`;
            } else {
                div.className = `message ${m.uid === currentUser.uid ? 'self' : ''}`;
                div.innerHTML = `
                    <div class="msg-author">${m.author}</div>
                    <div class="msg-bubble">${m.text}</div>
                `;
            }
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    });

    // Инициализация голоса
    initVoiceSignaling();
}

function leaveRoom() {
    if (!currentRoomId) return;
    sendChatMessage(`${currentUser.displayName} покинул комнату`, true);
    
    // Очистка WebRTC
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    remove(ref(db, `rooms/${currentRoomId}/peers/${currentUser.uid}`));
    
    currentRoomId = null;
    switchScreen('lobby-screen');
}

function sendChatMessage(text, isSystem = false) {
    if (!text.trim()) return;
    push(ref(db, `chats/${currentRoomId}`), {
        uid: currentUser.uid,
        author: currentUser.displayName,
        text: text,
        system: isSystem,
        timestamp: serverTimestamp()
    });
}

// ==========================================
// --- AUTH ACTIONS ---
// ==========================================

async function handleLogin() {
    const email = $('login-email').value;
    const pass = $('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { showToast("Ошибка: " + e.message); }
}

async function handleRegister() {
    const user = $('reg-user').value.trim();
    const email = $('reg-email').value;
    const pass = $('reg-pass').value;

    if (user.length < 3) return showToast("Ник слишком короткий");

    try {
        const userCheck = await get(ref(db, `usernames/${user.toLowerCase()}`));
        if (userCheck.exists()) return showToast("Никнейм уже занят");

        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: user });
        
        // Создаем профиль в БД
        await set(ref(db, `users/${res.user.uid}/profile`), {
            username: user,
            bio: "Привет! Я использую COW",
            avatar: "",
            createdAt: serverTimestamp()
        });
        await set(ref(db, `usernames/${user.toLowerCase()}`), res.user.uid);
        
        showToast("Аккаунт создан!");
    } catch (e) { showToast(e.message); }
}

// ==========================================
// --- ВХОД В ПРИЛОЖЕНИЕ ---
// ==========================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        switchScreen('lobby-screen');
        setupOnlineSystem();
        syncMyProfileUI();
        loadFriendsSystem();
        initRoomsLobby();
        initMobileUI();
    } else {
        currentUser = null;
        switchScreen('auth-screen');
    }
});

function initRoomsLobby() {
    onValue(ref(db, 'rooms'), (snap) => {
        const grid = $('rooms-grid');
        grid.innerHTML = '';
        snap.forEach(child => {
            const r = child.val();
            const id = child.key;
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-preview">
                    <video src="${r.videoUrl}#t=5" muted></video>
                    <div style="position:absolute;top:10px;right:10px;background:red;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">LIVE</div>
                </div>
                <div class="room-info">
                    <div style="font-weight:bold;font-size:16px;">${r.name}</div>
                    <div style="font-size:12px;opacity:0.6;margin-top:5px;">ID: ${r.slug}</div>
                </div>
            `;
            card.onclick = () => joinRoom(id);
            grid.appendChild(card);
        });
    });
}

// Удаление всех комнат пользователя
async function deleteAllMyRooms() {
    const snap = await get(ref(db, 'rooms'));
    snap.forEach(child => {
        if (child.val().owner === currentUser.uid) {
            remove(child.ref);
        }
    });
    showToast("Ваши комнаты удалены");
}

// ==========================================
// --- BIND EVENTS ---
// ==========================================

window.onload = () => {
    initNeuralBackground();

    $('btn-do-login').onclick = handleLogin;
    $('btn-do-reg').onclick = handleRegister;
    $('btn-logout').onclick = () => signOut(auth);
    
    $('btn-send-msg').onclick = () => {
        const input = $('chat-input');
        sendChatMessage(input.value);
        input.value = '';
    };

    $('mic-toggle').onclick = toggleMic;
    $('btn-leave-room').onclick = leaveRoom;
    
    // Вкладки Лобби
    $('nav-rooms').onclick = () => {
        $('nav-rooms').classList.add('active');
        $('nav-friends').classList.remove('active');
        $('friends-section').style.display = 'none';
        $('rooms-grid').parentElement.style.display = 'block';
    };

    $('nav-friends').onclick = () => {
        $('nav-friends').classList.add('active');
        $('nav-rooms').classList.remove('active');
        $('friends-section').style.display = 'flex';
        $('rooms-grid').parentElement.style.display = 'none';
    };

    // Модалки
    $('btn-edit-profile').onclick = () => $('modal-edit-profile').classList.add('active');
    $('btn-cancel-edit').onclick = () => $('modal-edit-profile').classList.remove('active');
    $('btn-confirm-edit').onclick = saveMyProfile;
    
    $('btn-open-create-room').onclick = () => $('modal-create-room').classList.add('active');
    $('btn-cancel-create').onclick = () => $('modal-create-room').classList.remove('active');
    $('btn-confirm-create').onclick = async () => {
        const name = $('new-room-name').value;
        const slug = $('new-room-slug').value;
        const video = $('new-room-video').value;
        if (!name || !slug || !video) return showToast("Заполните всё");
        await push(ref(db, 'rooms'), { name, slug, videoUrl: video, owner: currentUser.uid });
        $('modal-create-room').classList.remove('active');
        showToast("Комната создана!");
    };

    $('btn-delete-all-my-rooms').onclick = deleteAllMyRooms;
    $('btn-close-view').onclick = () => $('modal-view-profile').classList.remove('active');

    // Переключение табов авторизации
    $('tab-login-btn').onclick = () => {
        $('login-form').classList.add('active-form');
        $('reg-form').classList.remove('active-form');
        $('tab-login-btn').classList.add('active');
        $('tab-reg-btn').classList.remove('active');
    };
    $('tab-reg-btn').onclick = () => {
        $('reg-form').classList.add('active-form');
        $('login-form').classList.remove('active-form');
        $('tab-reg-btn').classList.add('active');
        $('tab-login-btn').classList.remove('active');
    };
};