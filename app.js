import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onChildAdded, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

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

const $ = (id) => document.getElementById(id);
// Безопасное экранирование текста для вставки в innerHTML
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}

// Кэш комнат (используется для поиска/фильтрации)
let roomsCache = {};
// Временная метка входа в комнату — чтобы не показывать старые тосты
let roomEnteredAt = 0;
// --- Криптографические утилиты для приватных комнат ---
function bufToBase64(buf){
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function base64ToBuf(b64){
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
function genSalt(len=16){
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return bufToBase64(a.buffer);
}
async function deriveKey(password, saltBase64, iterations=10000){
    const enc = new TextEncoder();
    const salt = base64ToBuf(saltBase64);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations, hash:'SHA-256'}, keyMaterial, 256);
    return bufToBase64(derivedBits);
}
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); if($(id)) $(id).classList.add('active'); }

// --- УЛУЧШЕННЫЕ ТОСТЫ ---
function showToast(message) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- WebRTC Инициализация ---
const peer = new Peer(undefined, { host: '0.peerjs.com', port: 443, secure: true });
let currentRoomId = null;
let isHost = false;
let myStream = null;
let activeCalls = new Set();
let roomListenerUnsubscribe = null;
let isRemoteAction = false;
let lastSyncTs = 0;
let processedMsgs = new Set(); // Защита от дублей сообщений

setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('user-display-name').innerText = user.displayName || user.email;
        if(!currentRoomId) showScreen('lobby-screen'); 
        syncRooms();
    } else {
        showScreen('auth-screen');
    }
});

// Авторизация
$('tab-login').onclick = () => { $('form-login').classList.add('active-form'); $('form-login').classList.remove('hidden-form', 'left'); $('form-register').classList.add('hidden-form', 'right'); $('form-register').classList.remove('active-form'); $('tab-login').classList.add('active'); $('tab-register').classList.remove('active'); };
$('tab-register').onclick = () => { $('form-register').classList.add('active-form'); $('form-register').classList.remove('hidden-form', 'right'); $('form-login').classList.add('hidden-form', 'left'); $('form-login').classList.remove('active-form'); $('tab-register').classList.add('active'); $('tab-login').classList.remove('active'); };

$('btn-login-email').onclick = async () => { try { await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value); } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-register-email').onclick = async () => { try { const res = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-password').value); await updateProfile(res.user, { displayName: $('reg-name').value }); $('user-display-name').innerText = $('reg-name').value; } catch(e) { showToast("Ошибка: " + e.message); } };
$('btn-google-auth').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { showToast("Ошибка Google"); } };
$('btn-logout').onclick = () => signOut(auth);

// Лобби
$('btn-open-modal').onclick = () => $('modal-create').classList.add('active');
$('btn-close-modal').onclick = () => $('modal-create').classList.remove('active');

$('btn-delete-all-rooms').onclick = async () => {
    if(confirm("ВНИМАНИЕ! Вы удалите ВСЕ комнаты. Продолжить?")) {
        await remove(ref(db, 'rooms'));
        showToast("Все комнаты удалены.");
    }
};

$('btn-create-finish').onclick = async () => {
    const name = $('room-name').value;
    const link = $('room-link').value;
    if(!name || !link) return showToast("Заполни поля!");
    const isPrivate = $('room-private') ? $('room-private').checked : false;
    const password = $('room-password') ? $('room-password').value : '';
    const newRoomRef = push(ref(db, 'rooms'));
    const roomData = { name, link, admin: auth.currentUser.uid, adminName: auth.currentUser.displayName || "User" };
    if (isPrivate) {
        if (!password || password.length < 4) return showToast('Пароль должен быть минимум 4 символа');
        try {
            const salt = genSalt(16);
            const pwHash = await deriveKey(password, salt);
            roomData.private = true;
            roomData.pwSalt = salt;
            roomData.pwHash = pwHash;
        } catch (e) {
            return showToast('Ошибка при установке пароля');
        }
    }
    await set(newRoomRef, roomData);
    $('modal-create').classList.remove('active');
    // очистим поля
    if ($('room-password')) $('room-password').value = '';
    if ($('room-private')) $('room-private').checked = false;
    enterRoom(newRoomRef.key, name, link, auth.currentUser.uid);
};

function renderRooms(filter = '') {
    const grid = $('rooms-grid');
    grid.innerHTML = '';
    const data = roomsCache || {};
    const q = String(filter || '').trim().toLowerCase();
    const keys = Object.keys(data);
    if (!keys.length) {
        grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>';
        return;
    }
    keys.forEach(id => {
        const room = data[id];
        const name = room.name || '';
        const host = room.adminName || '';
        if (q) {
            const hay = (name + ' ' + host).toLowerCase();
            if (!hay.includes(q)) return;
        }
        // Используем JSON.stringify чтобы корректно экранировать аргументы для onclick
        grid.innerHTML += `\n            <div class="room-card glass-panel" onclick="window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(room.link || '')}, ${JSON.stringify(room.admin || '')})">\n                <h4>${escapeHtml(name)}</h4>\n                <p style=\"font-size:12px; opacity:0.6; margin-top:5px;\">Хост: ${escapeHtml(host)}</p>\n            </div>`;
    });
}

function syncRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        roomsCache = snap.val() || {};
        // сразу отрендерим с учётом текущего поиска
        const si = $('search-rooms');
        renderRooms(si ? si.value : '');
    });
    // Подписка на ввод поиска (легкий debounce)
    const search = $('search-rooms');
    if (search) {
        let t = null;
        search.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => renderRooms(e.target.value), 120);
        });
    }
}
window.joinRoom = (id, name, link, admin) => enterRoom(id, name, link, admin);

const player = $('native-player');
let presenceRef = null;

function enterRoom(roomId, name, link, adminId) {
    currentRoomId = roomId;
    processedMsgs.clear(); // Очистка при входе в новую комнату
    isHost = (auth.currentUser.uid === adminId);
    $('room-title-text').innerText = name;
    player.src = link;
    $('chat-messages').innerHTML = ''; 
    
    // ПРАВА ДОСТУПА: Хост управляет, зритель только смотрит
    player.controls = isHost;
    player.style.pointerEvents = isHost ? "auto" : "none";
    
    showScreen('room-screen');
    // Фикс: помечаем время входа, чтобы не показывать старые уведомления
    roomEnteredAt = Date.now();
    initRoomServices();
    // Показ/логика кнопки удаления комнаты (только для хоста)
    const delBtn = $('btn-delete-room');
    if (delBtn) {
        delBtn.style.display = isHost ? 'inline-block' : 'none';
        delBtn.onclick = async () => {
            if (!isHost) return;
            if (!confirm('ВНИМАНИЕ! Удалить эту комнату навсегда?')) return;
            try {
                await remove(ref(db, `rooms/${currentRoomId}`));
                showToast('Комната удалена');
                leaveRoom();
            } catch (e) {
                showToast('Ошибка удаления комнаты');
            }
        };
    }
    showToast(isHost ? "Вы зашли как Хост" : "Вы зашли как Зритель");
}

function leaveRoom() {
    if (presenceRef) remove(presenceRef);
    if (roomListenerUnsubscribe) roomListenerUnsubscribe(); 
    player.pause(); player.src = '';
    if (myStream) { myStream.getTracks().forEach(t => t.stop()); myStream = null; $('mic-btn').classList.remove('active'); }
    $('remote-audio-container').innerHTML = '';
    activeCalls.clear();
    const delBtn = $('btn-delete-room'); if (delBtn) delBtn.style.display = 'none';
    currentRoomId = null;
    showScreen('lobby-screen');
}
$('btn-leave-room').onclick = leaveRoom;

// --- AMBILIGHT ---
const ambiCanvas = $('ambilight-canvas');
const ambiCtx = ambiCanvas.getContext('2d', { willReadFrequently: true });
function drawAmbilight() {
    if (currentRoomId && !player.paused && !player.ended) {
        ambiCanvas.width = player.clientWidth / 10;
        ambiCanvas.height = player.clientHeight / 10;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
}
player.addEventListener('play', () => drawAmbilight());

function initRoomServices() {
    const videoRef = ref(db, `rooms/${currentRoomId}/sync`);
    const chatRef = ref(db, `rooms/${currentRoomId}/chat`);
    const voiceRef = ref(db, `rooms/${currentRoomId}/voice`);
    const presenceDbRef = ref(db, `rooms/${currentRoomId}/presence`);
    const reactionsRef = ref(db, `rooms/${currentRoomId}/reactions`);

    roomListenerUnsubscribe = onValue(ref(db, `rooms/${currentRoomId}`), (snap) => {
        if (!snap.exists() && currentRoomId) { showToast("Комната удалена"); leaveRoom(); }
    });

    $('btn-fullscreen').onclick = () => $('player-wrapper').requestFullscreen();

    // Присутствие
    presenceRef = ref(db, `rooms/${currentRoomId}/presence/${auth.currentUser.uid}`);
    set(presenceRef, { name: auth.currentUser.displayName || "User" });
    onDisconnect(presenceRef).remove(); 
    onValue(presenceDbRef, (snap) => {
        const data = snap.val() || {};
        $('users-list').innerHTML = '';
        $('users-count').innerText = Object.keys(data).length;
        for (let uid in data) {
            $('users-list').innerHTML += `
                <div class="user-item">
                    <div class="indicator"></div>
                    <span>${data[uid].name} ${uid === auth.currentUser.uid ? '(Вы)' : ''}</span>
                </div>`;
        }
    });

    // --- ХИРУРГИЧЕСКАЯ СИНХРОНИЗАЦИЯ (Только хост отправляет данные) ---
    if (isHost) {
        player.onplay = () => { if(!isRemoteAction) set(videoRef, { type: 'play', time: player.currentTime, ts: Date.now() }); };
        player.onpause = () => { if(!isRemoteAction) set(videoRef, { type: 'pause', time: player.currentTime, ts: Date.now() }); };
        player.onseeked = () => { if(!isRemoteAction) set(videoRef, { type: 'seek', time: player.currentTime, ts: Date.now() }); };
    }

    onValue(videoRef, (snap) => {
        if (isHost) return; // Хост никогда не принимает синхронизацию от других
        const d = snap.val();
        if (!d || d.ts <= lastSyncTs) return;
        lastSyncTs = d.ts;
        isRemoteAction = true;
        
        if (Math.abs(player.currentTime - d.time) > 2) player.currentTime = d.time;
        d.type === 'play' ? player.play() : player.pause();
        
        setTimeout(() => isRemoteAction = false, 500);
    });

    // --- ЧАТ И ТАЙМКОДЫ ---
    // Экранируем текст перед вставкой и затем подменяем паттерны таймкодов
    const parseTimecodes = (text) => escapeHtml(text).replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    
    const sendMsg = () => {
        const inp = $('chat-input');
        if (inp.value.trim()) { push(chatRef, { user: auth.currentUser.displayName, content: inp.value.trim(), ts: Date.now() }); inp.value = ''; }
    };
    $('send-btn').onclick = sendMsg;
    $('chat-input').onkeydown = (e) => { if(e.key==='Enter') sendMsg(); };
    
    $('chat-messages').onclick = (e) => {
        if(e.target.classList.contains('timecode-btn')) {
            const parts = e.target.dataset.time.split(':');
            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            player.currentTime = seconds;
            // Если нажал хост - мотаем у всех
            if(isHost) {
                player.play();
                set(videoRef, { type: 'seek', time: seconds, ts: Date.now() });
            }
        }
    };

    onChildAdded(chatRef, (snap) => {
        const m = snap.val();
        const id = snap.key;
        if (processedMsgs.has(id)) return; // Защита от дублей
        processedMsgs.add(id);

        const isMe = m.user === auth.currentUser.displayName;
        const div = document.createElement('div');
        div.className = isMe ? 'm-line self' : 'm-line';
        div.innerHTML = `<div class="bubble"><strong>${escapeHtml(m.user || 'User')}</strong><p>${parseTimecodes(m.content || '')}</p></div>`;
        $('chat-messages').appendChild(div);
        $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
        // Показываем тост только для новых сообщений (после входа в комнату)
        if (!isMe && m.ts && m.ts >= (roomEnteredAt - 2000)) {
            showToast(`Сообщение от ${escapeHtml(m.user || 'User')}`);
        }
    });

    // Табы чата
    $('tab-chat-btn').onclick = () => { $('chat-messages').style.display='flex'; $('users-list').style.display='none'; $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active'); };
    $('tab-users-btn').onclick = () => { $('users-list').style.display='flex'; $('chat-messages').style.display='none'; $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active'); };

    // Реакции
    document.querySelectorAll('.react-btn').forEach(btn => {
        btn.onclick = () => push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
    });
    onChildAdded(reactionsRef, (snap) => {
        const data = snap.val();
        if(Date.now() - data.ts > 5000) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = data.emoji;
        el.style.left = Math.random() * 80 + 10 + '%';
        $('reaction-layer').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    });

    // --- ГОЛОС (WebRTC) ---
    function attachRemoteAudio(stream, peerId) {
        if (activeCalls.has(peerId)) return;
        activeCalls.add(peerId);
        const audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.autoplay = true;
        audio.srcObject = stream;
        audio.volume = $('voice-volume').value;
        $('remote-audio-container').appendChild(audio);
    }

    peer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, call.peer));
    });

    $('mic-btn').onclick = async function() {
        const isActive = this.classList.toggle('active');
        if (isActive) {
            try {
                myStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                if (peer.id) set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
                showToast("Микрофон включен");
            } catch (e) { showToast("Ошибка доступа к микрофону"); this.classList.remove('active'); }
        } else {
            if (myStream) myStream.getTracks().forEach(t => t.stop());
            myStream = null;
            remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
            activeCalls.clear();
            $('remote-audio-container').innerHTML = '';
            showToast("Микрофон выключен");
        }
    };

    onValue(voiceRef, (snap) => {
        const data = snap.val() || {};
        for (let uid in data) {
            const targetPeerId = data[uid];
            if (uid !== auth.currentUser.uid && myStream && !activeCalls.has(targetPeerId)) {
                const call = peer.call(targetPeerId, myStream);
                call.on('stream', (remoteStream) => attachRemoteAudio(remoteStream, targetPeerId));
            }
        }
    });

    $('voice-volume').oninput = (e) => {
        document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = e.target.value);
    };
    // ... (начало кода без изменений до момента с микрофоном)

// Переменные для визуализатора
let micAnalyser = null;
let micAnimationId = null;

// --- ФУНКЦИЯ ТАНЦУЮЩЕЙ ИКОНКИ ---
function startMicVisualizer(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = 64; // Нам не нужна высокая точность для иконки
    source.connect(micAnalyser);

    const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
    const micBtn = $('mic-btn');

    function animate() {
        if (!myStream) return; // Остановить, если мик выключен
        
        micAnalyser.getByteFrequencyData(dataArray);
        
        // Считаем среднюю громкость
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        let average = sum / dataArray.length;
        
        // Нормализуем значения (от 0 до 1)
        let volume = average / 128; 
        
        // ПРИМЕНЯЕМ ЭФФЕКТЫ:
        // Масштаб от 1.0 до 1.5
        let scale = 1 + (volume * 0.5);
        // Сияние (drop-shadow для красоты или box-shadow)
        let glow = volume * 30; // интенсивность свечения
        
        micBtn.style.transform = `scale(${scale})`;
        micBtn.style.filter = `drop-shadow(0 0 ${glow}px rgba(0, 209, 255, 0.8))`;
        
        micAnimationId = requestAnimationFrame(animate);
    }
    animate();
}

// --- ОБНОВЛЕННЫЙ КЛИК ПО МИКРОФОНУ ---
$('mic-btn').onclick = async function() {
    const isActive = this.classList.toggle('active');
    
    if (isActive) {
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });
            
            if (peer.id) {
                set(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`), peer.id);
            }
            
            showToast("Микрофон на связи");
            
            // Запускаем визуальное мерцание от громкости
            startMicVisualizer(myStream);
            
        } catch (e) { 
            showToast("Ошибка микрофона!"); 
            this.classList.remove('active'); 
        }
    } else {
        // Выключение
        if (myStream) {
            myStream.getTracks().forEach(t => t.stop());
            myStream = null;
        }
        
        if (micAnimationId) cancelAnimationFrame(micAnimationId);
        
        // Сброс стилей кнопки в исходку
        this.style.transform = `scale(1)`;
        this.style.filter = `none`;
        
        remove(ref(db, `rooms/${currentRoomId}/voice/${auth.currentUser.uid}`));
        activeCalls.clear();
        $('remote-audio-container').innerHTML = '';
        showToast("Микрофон спит");
    }
};

// ... (дальше остальной твой код: чат, реакции, фон — без изменений)
}

// --- НЕЙРОСЕТЕВОЙ ФОН ---
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
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
}
for(let i=0; i<80; i++) dots.push(new Dot());
function anim() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
        d.draw();
        dots.forEach(d2 => {
            let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
            if(dist < 120) {
                ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/600})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
            }
        });
    });
    requestAnimationFrame(anim);
}
anim();