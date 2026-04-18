import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, onChildAdded, onDisconnect, remove, off, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

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

// --- Глобальные утилиты и кэши ---
window.$ = (id) => document.getElementById(id);

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}));
}

function showToast(msg, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// Глобальные переменные состояния
let currentUser = null;
let currentRoomId = null;
let isOwner = false;
let player = null;
let roomListenerUnsubscribe = null;
let dmUnsubscribe = null;
let userProfileCache = {};
let activeDirectChatUid = null;
let editingRoomId = null;

// --- Плеер (YouTube) ---
let isLocalAction = false;
let lastServerState = { time: 0, playing: false };

function loadYouTubeIframeApi() {
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        onYouTubeIframeAPIReady();
    }
}

window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('video-player', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ',
        playerVars: { 'autoplay': 0, 'controls': 1, 'rel': 0, 'modestbranding': 1 },
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': () => { console.log("Player Ready"); }
        }
    });
};

function onPlayerStateChange(event) {
    if (!isOwner || isLocalAction) return;
    const playing = (event.data === YT.PlayerState.PLAYING);
    const time = player.getCurrentTime();
    if (currentRoomId) {
        update(ref(db, `rooms/${currentRoomId}/state`), { playing, time, updatedAt: Date.now() });
    }
}

// --- Авторизация ---
setPersistence(auth, browserLocalPersistence);

$('tab-login').onclick = () => {
    $('tab-login').classList.add('active');
    $('tab-register').classList.remove('active');
    $('form-login').classList.add('active-form');
    $('form-register').classList.remove('active-form');
};

$('tab-register').onclick = () => {
    $('tab-register').classList.add('active');
    $('tab-login').classList.remove('active');
    $('form-register').classList.add('active-form');
    $('form-login').classList.remove('active-form');
};

$('btn-login').onclick = async () => {
    const email = $('login-email').value;
    const pass = $('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { showToast("Ошибка входа: " + e.message, 'error'); }
};

$('btn-register').onclick = async () => {
    const email = $('reg-email').value;
    const name = $('reg-name').value;
    const pass = $('reg-password').value;
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        await set(ref(db, `users/${res.user.uid}`), { uid: res.user.uid, name: name, photo: '' });
    } catch (e) { showToast("Ошибка регистрации: " + e.message, 'error'); }
};

$('btn-google').onclick = async () => {
    try {
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(auth, provider);
        await set(ref(db, `users/${res.user.uid}`), { uid: res.user.uid, name: res.user.displayName, photo: res.user.photoURL });
    } catch (e) { showToast("Ошибка Google: " + e.message, 'error'); }
};

$('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        $('auth-screen').classList.remove('active');
        $('lobby-screen').classList.add('active');
        $('user-name-display').innerText = user.displayName || user.email;
        $('online-counter').style.display = 'flex';
        initLobby();
        initGlobalOnline();
    } else {
        $('lobby-screen').classList.remove('active');
        $('room-screen').classList.remove('active');
        $('auth-screen').classList.add('active');
        $('online-counter').style.display = 'none';
        if (roomListenerUnsubscribe) roomListenerUnsubscribe();
    }
});

// --- Лобби и комнаты ---
function initLobby() {
    onValue(ref(db, 'rooms'), (snap) => {
        const list = $('rooms-list');
        list.innerHTML = '';
        const data = snap.val();
        if (!data) {
            list.innerHTML = '<p style="opacity:0.5; text-align:center;">Комнат пока нет. Создайте первую!</p>';
            return;
        }
        Object.keys(data).forEach(id => {
            const r = data[id];
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            const isPrivate = r.isPrivate ? '<span style="color:#ff4757">🔒</span> ' : '';
            card.innerHTML = `
                <div class="room-card-info">
                    <h3>${isPrivate}${escapeHtml(r.name)}</h3>
                    <p>Автор: ${escapeHtml(r.ownerName)}</p>
                </div>
                <div class="room-card-actions">
                    ${r.ownerUid === currentUser.uid ? `<button class="edit-room-btn" data-id="${id}">⚙️</button>` : ''}
                    <button class="join-btn" data-id="${id}">${r.isPrivate ? 'Ключ' : 'Войти'}</button>
                </div>
            `;
            list.appendChild(card);
        });

        document.querySelectorAll('.join-btn').forEach(b => {
            b.onclick = () => joinRoom(b.dataset.id);
        });

        document.querySelectorAll('.edit-room-btn').forEach(b => {
            b.onclick = (e) => {
                e.stopPropagation();
                openEditRoom(b.dataset.id);
            };
        });
    });
}

$('btn-create-room').onclick = () => {
    editingRoomId = null;
    setCreateModalMode('create');
    $('modal-create').classList.add('active');
};

$('btn-close-modal').onclick = () => {
    $('modal-create').classList.remove('active');
};

$('confirm-create-room').onclick = async () => {
    const name = $('room-name').value;
    const url = $('room-video-url').value;
    const isPrivate = $('room-private').checked;
    const password = $('room-password').value;

    if (!name) return showToast("Введите название", "error");

    let videoId = 'dQw4w9WgXcQ';
    if (url) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/|.*embed\/))([^?&]+)/);
        if (match) videoId = match[1];
    }

    const roomData = {
        name,
        videoId,
        isPrivate,
        password: isPrivate ? password : null,
        ownerUid: currentUser.uid,
        ownerName: currentUser.displayName,
        createdAt: Date.now(),
        state: { playing: false, time: 0, updatedAt: Date.now() }
    };

    if (editingRoomId) {
        await update(ref(db, `rooms/${editingRoomId}`), roomData);
        showToast("Комната обновлена");
    } else {
        const newRoomRef = push(ref(db, 'rooms'));
        await set(newRoomRef, roomData);
        showToast("Комната создана");
    }

    $('modal-create').classList.remove('active');
};

function openEditRoom(id) {
    get(ref(db, `rooms/${id}`)).then(s => {
        const r = s.val();
        if (!r) return;
        editingRoomId = id;
        setCreateModalMode('edit');
        $('room-name').value = r.name;
        $('room-video-url').value = `https://www.youtube.com/watch?v=${r.videoId}`;
        $('room-private').checked = !!r.isPrivate;
        $('room-password').value = r.password || '';
        $('modal-create').classList.add('active');
    });
}

function setCreateModalMode(mode) {
    const title = $('modal-title');
    const btn = $('confirm-create-room');
    if (mode === 'edit') {
        title.innerText = "Настройка комнаты";
        btn.innerText = "Сохранить";
    } else {
        title.innerText = "Создать пространство";
        btn.innerText = "Создать";
    }
}

// --- Логика внутри комнаты ---
async function joinRoom(id) {
    const s = await get(ref(db, `rooms/${id}`));
    const room = s.val();
    if (!room) return;

    if (room.isPrivate && room.ownerUid !== currentUser.uid) {
        const pass = prompt("Введите пароль для входа:");
        if (pass !== room.password) return showToast("Неверный пароль", "error");
    }

    currentRoomId = id;
    isOwner = (room.ownerUid === currentUser.uid);
    $('lobby-screen').classList.remove('active');
    $('room-screen').classList.add('active');
    $('room-title-display').innerText = room.name;

    if (!player) loadYouTubeIframeApi();
    else player.loadVideoById(room.videoId);

    setupRoomListeners(id);
}

$('btn-leave-room').onclick = () => {
    if (roomListenerUnsubscribe) roomListenerUnsubscribe();
    currentRoomId = null;
    $('room-screen').classList.remove('active');
    $('lobby-screen').classList.add('active');
    if (player) player.pauseVideo();
};

function setupRoomListeners(id) {
    const teardown = [];

    // Чат
    const chatRef = ref(db, `rooms/${id}/messages`);
    const onChat = onChildAdded(chatRef, (snap) => {
        const msg = snap.val();
        renderMessage(msg);
    });
    teardown.push(() => off(chatRef, 'child_added', onChat));

    // Состояние видео
    const stateRef = ref(db, `rooms/${id}/state`);
    const onState = onValue(stateRef, (snap) => {
        const state = snap.val();
        if (!state || isOwner) return;
        lastServerState = state;
        if (!player || !player.getPlayerState) return;

        const serverPlaying = state.playing;
        const serverTime = state.time + (serverPlaying ? (Date.now() - state.updatedAt) / 1000 : 0);
        
        isLocalAction = true;
        if (Math.abs(player.getCurrentTime() - serverTime) > 2) player.seekTo(serverTime, true);
        if (serverPlaying) player.playVideo(); else player.pauseVideo();
        setTimeout(() => { isLocalAction = false; }, 500);
    });
    teardown.push(() => off(stateRef, 'value', onState));

    // Участники и Голос
    const presenceRef = ref(db, `rooms/${id}/users/${currentUser.uid}`);
    set(presenceRef, { uid: currentUser.uid, name: currentUser.displayName, joinedAt: Date.now() });
    onDisconnect(presenceRef).remove();
    teardown.push(() => remove(presenceRef));

    const usersRef = ref(db, `rooms/${id}/users`);
    const onUsers = onValue(usersRef, (snap) => {
        const users = snap.val() || {};
        renderUsersList(users);
        $('users-count').innerText = Object.keys(users).length;
    });
    teardown.push(() => off(usersRef, 'value', onUsers));

    // Реакции
    const reactRef = ref(db, `rooms/${id}/reactions`);
    const onReact = onValue(reactRef, (snap) => {
        const data = snap.val();
        if (data) showFlyingEmoji(data.emoji);
    });
    teardown.push(() => off(reactRef, 'value', onReact));

    roomListenerUnsubscribe = () => {
        teardown.forEach(fn => fn());
        closeVoiceSignalLayer();
    };

    // Инициализация голоса
    initVoiceSignalLayer(id);
}

// --- Чат и UI внутри комнаты ---
$('send-btn').onclick = sendMessage;
$('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

function sendMessage() {
    const text = $('chat-input').value.trim();
    if (!text || !currentRoomId) return;
    
    // Поддержка таймкодов :MM
    let processedText = text;
    const timeMatch = text.match(/^:(\d+)/);
    if (timeMatch && player) {
        const sec = parseInt(timeMatch[1]);
        player.seekTo(sec, true);
    }

    push(ref(db, `rooms/${currentRoomId}/messages`), {
        uid: currentUser.uid,
        name: currentUser.displayName,
        text: processedText,
        time: Date.now()
    });
    $('chat-input').value = '';
}

function renderMessage(msg) {
    const area = $('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${msg.uid === currentUser.uid ? 'own' : ''}`;
    div.innerHTML = `<span class="msg-author">${escapeHtml(msg.name)}</span><p>${escapeHtml(msg.text)}</p>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

function renderUsersList(users) {
    const list = $('users-list');
    list.innerHTML = '';
    Object.values(users).forEach(u => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div class="user-avatar-small">${u.name[0]}</div>
            <span>${escapeHtml(u.name)}</span>
            ${u.uid !== currentUser.uid ? `<button class="dm-btn" onclick="openDirectChat('${u.uid}', '${escapeHtml(u.name)}')">✉️</button>` : ''}
        `;
        list.appendChild(item);
    });
}

// Вкладки чата
$('tab-chat-btn').onclick = () => {
    $('tab-chat-btn').classList.add('active');
    $('tab-users-btn').classList.remove('active');
    $('chat-messages').style.display = 'block';
    $('users-list').style.display = 'none';
};

$('tab-users-btn').onclick = () => {
    $('tab-users-btn').classList.add('active');
    $('tab-chat-btn').classList.remove('active');
    $('chat-messages').style.display = 'none';
    $('users-list').style.display = 'block';
};

// Реакции
document.querySelectorAll('.react-btn').forEach(b => {
    b.onclick = () => {
        if (!currentRoomId) return;
        set(ref(db, `rooms/${currentRoomId}/reactions`), { emoji: b.dataset.emoji, ts: Date.now() });
    };
});

function showFlyingEmoji(emoji) {
    const container = document.body;
    const el = document.createElement('div');
    el.className = 'flying-emoji';
    el.innerText = emoji;
    el.style.left = (Math.random() * 60 + 20) + 'vw';
    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// --- Личные сообщения (DM) ---
window.openDirectChat = (uid, name) => {
    activeDirectChatUid = uid;
    $('dm-window').classList.add('active');
    $('dm-target-name').innerText = name;
    loadDirectMessages(uid);
};

$('btn-close-dm').onclick = () => {
    $('dm-window').classList.remove('active');
    if (dmUnsubscribe) dmUnsubscribe();
};

function loadDirectMessages(otherUid) {
    if (dmUnsubscribe) dmUnsubscribe();
    const chatId = currentUser.uid < otherUid ? `${currentUser.uid}_${otherUid}` : `${otherUid}_${currentUser.uid}`;
    const dmRef = ref(db, `direct_messages/${chatId}`);
    
    const area = $('dm-messages');
    area.innerHTML = '';
    
    dmUnsubscribe = onChildAdded(dmRef, (snap) => {
        const m = snap.val();
        const div = document.createElement('div');
        div.className = `dm-line ${m.senderUid === currentUser.uid ? 'self' : ''}`;
        div.innerHTML = `<div class="dm-bubble">${escapeHtml(m.text)}</div>`;
        area.appendChild(div);
        area.scrollTop = area.scrollHeight;
    });
}

$('dm-send-btn').onclick = sendDirectMessage;
$('dm-input').onkeydown = (e) => { if (e.key === 'Enter') sendDirectMessage(); };

function sendDirectMessage() {
    const text = $('dm-input').value.trim();
    if (!text || !activeDirectChatUid) return;
    const chatId = currentUser.uid < activeDirectChatUid ? `${currentUser.uid}_${activeDirectChatUid}` : `${activeDirectChatUid}_${currentUser.uid}`;
    
    push(ref(db, `direct_messages/${chatId}`), {
        senderUid: currentUser.uid,
        text: text,
        timestamp: Date.now()
    });
    $('dm-input').value = '';
}

// --- Голосовой слой (Signal Layer) ---
let localStream = null;
const peerConnections = {};

async function initVoiceSignalLayer(roomId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        toggleMicIcon(true);
        
        const signalRef = ref(db, `rooms/${roomId}/signals/${currentUser.uid}`);
        onValue(ref(db, `rooms/${roomId}/users`), (snap) => {
            const users = snap.val() || {};
            Object.keys(users).forEach(uid => {
                if (uid !== currentUser.uid && !peerConnections[uid]) {
                    initPeer(uid, roomId, true);
                }
            });
        });
        
        onChildAdded(ref(db, `rooms/${roomId}/signals/${currentUser.uid}`), (snap) => {
            const data = snap.val();
            handleSignal(data, roomId);
        });
    } catch (e) { console.log("Mic access denied or error", e); }
}

function initPeer(targetUid, roomId, isOfferer) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnections[targetUid] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (e) => {
        let audio = $(`audio-${targetUid}`);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${targetUid}`;
            audio.autoplay = true;
            $('remote-audio-container').appendChild(audio);
        }
        audio.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
        if (e.candidate) {
            push(ref(db, `rooms/${roomId}/signals/${targetUid}`), {
                from: currentUser.uid,
                candidate: e.candidate.toJSON()
            });
        }
    };

    if (isOfferer) {
        pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            push(ref(db, `rooms/${roomId}/signals/${targetUid}`), {
                from: currentUser.uid,
                offer: offer
            });
        });
    }
}

async function handleSignal(data, roomId) {
    const { from, offer, answer, candidate } = data;
    let pc = peerConnections[from];
    if (!pc && (offer || candidate)) {
        initPeer(from, roomId, false);
        pc = peerConnections[from];
    }

    if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        push(ref(db, `rooms/${roomId}/signals/${from}`), { from: currentUser.uid, answer: ans });
    } else if (answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

function closeVoiceSignalLayer() {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    for (let k in peerConnections) delete peerConnections[k];
    $('remote-audio-container').innerHTML = '';
}

$('mic-btn').onclick = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    toggleMicIcon(audioTrack.enabled);
};

function toggleMicIcon(on) {
    $('mic-btn').innerText = on ? '🎤' : '🔇';
    $('mic-btn').style.background = on ? 'rgba(255,255,255,0.1)' : 'rgba(255,71,87,0.3)';
}

// --- Новые фиксы и улучшения из new.app.js ---

function widenLobbyLayout() {
    const layout = document.querySelector('.lobby-layout');
    if (layout) {
        layout.style.maxWidth = '95vw';
        layout.style.width = '95vw';
    }
}

function fixMobileInput() {
    window.addEventListener('resize', () => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            setTimeout(() => {
                document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    });
}

function initParticleBackground() {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dots = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Dot {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.r = Math.random() * 1.5;
        }
        draw() {
            this.x += this.vx; this.y += this.vy;
            if(this.x<0 || this.x>canvas.width) this.vx *= -1;
            if(this.y<0 || this.y>canvas.height) this.vy *= -1;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
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
}

function initGlobalOnline() {
    const globalOnlineRef = ref(db, 'online_users/' + currentUser.uid);
    set(globalOnlineRef, { lastSeen: Date.now(), name: currentUser.displayName });
    onDisconnect(globalOnlineRef).remove();

    onValue(ref(db, 'online_users'), (snap) => {
        const count = snap.val() ? Object.keys(snap.val()).length : 0;
        const counterEl = $('online-count');
        if (counterEl) counterEl.innerText = count;
    });
}

// Полноэкранный режим
$('btn-fullscreen')?.addEventListener('click', () => {
    const el = $('room-screen');
    if (!document.fullscreenElement) el.requestFullscreen().catch(err => showToast("Ошибка ФС: " + err.message));
    else document.exitFullscreen();
});

// Инициализация при загрузке
window.onload = () => {
    initParticleBackground();
    widenLobbyLayout();
    fixMobileInput();
};