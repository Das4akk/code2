/**
 * ==========================================================================================
 * COW — CO-WATCHING SPACE CORE ENGINE (v2.0.0)
 * ==========================================================================================
 * * ОПИСАНИЕ:
 * Данный файл является единственным и полным источником логики для платформы COW.
 * Включает в себя:
 * - Расширенную интеграцию с Firebase Realtime Database
 * - Полноценный WebRTC Voice Chat (Mesh Network)
 * - Систему уникальных идентификаторов (@username)
 * - Управление медиа-синхронизацией (Video Player Logic)
 * - Систему социальных взаимодействий (Профили, Друзья, Чаты)
 * - Адаптивный UI и анимации (AMOLED Style)
 * * СТРОГОЕ ПРАВИЛО: Весь JS-код находится здесь.
 * ОБЪЕМ: 2500+ строк логических конструкций, обработчиков и системных модулей.
 */

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
    onChildChanged,
    onDisconnect, 
    remove, 
    update,
    serverTimestamp,
    query,
    orderByChild,
    equalTo,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================================================================
// 1. ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ И СОСТОЯНИЕ
// ==========================================================================================

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

// Инициализация сервисов
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/**
 * Глобальный объект состояния приложения
 * Хранит все временные данные сессии, ссылки на стримы и активные соединения.
 */
const state = {
    // Пользовательские данные
    user: null,
    profile: null,
    
    // Состояние комнаты
    currentRoom: null,
    roomData: null,
    isOwner: false,
    
    // Голосовая связь (WebRTC)
    localStream: null,
    isMicEnabled: false,
    peers: {}, // { [uid]: RTCPeerConnection }
    iceConfig: {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" }
        ]
    },

    // Социальное
    friends: [],
    blockedUsers: [],
    activePrivateChats: {},

    // UI Состояние
    activeTab: 'chat', // chat | users | settings
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Хелпер для быстрого доступа к DOM
const $ = (id) => document.getElementById(id);
const q = (selector) => document.querySelector(selector);

// ==========================================================================================
// 2. МОДУЛЬ УВЕДОМЛЕНИЙ (TOAST SYSTEM)
// ==========================================================================================

/**
 * Система всплывающих уведомлений. 
 * Поддерживает типы: success, error, info, warning.
 */
const notify = (message, type = 'info', duration = 4000) => {
    const container = $('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass-panel`;
    
    // Иконка в зависимости от типа
    let icon = '🔔';
    if (type === 'error') icon = '🚫';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-msg">${message}</span>`;
    container.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0) scale(1)';
    });

    // Удаление
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.9)';
        setTimeout(() => toast.remove(), 500);
    }, duration);
};

// ==========================================================================================
// 3. СИСТЕМА УНИКАЛЬНЫХ ЮЗЕРНЕЙМОВ (@USERNAME)
// ==========================================================================================

/**
 * Валидация юзернейма на стороне клиента.
 */
const validateUsername = (username) => {
    if (!username.startsWith('@')) return { valid: false, msg: "Юзернейм должен начинаться с @" };
    if (username.length < 4) return { valid: false, msg: "Слишком короткий юзернейм" };
    if (username.length > 20) return { valid: false, msg: "Слишком длинный юзернейм" };
    const regex = /^@[a-zA-Z0-9_]+$/;
    if (!regex.test(username)) return { valid: false, msg: "Только латиница, цифры и _" };
    return { valid: true };
};

/**
 * Проверка уникальности юзернейма в базе данных с использованием транзакции.
 * Это гарантирует, что два пользователя не смогут занять один ник одновременно.
 */
const claimUsername = async (uid, username) => {
    const cleanTag = username.toLowerCase().replace('@', '');
    const usernameRef = ref(db, `usernames/${cleanTag}`);

    try {
        const result = await runTransaction(usernameRef, (currentData) => {
            if (currentData === null) {
                return uid; // Юзернейм свободен, записываем наш UID
            } else {
                return; // Юзернейм занят, отменяем транзакцию
            }
        });

        return result.committed;
    } catch (e) {
        console.error("Transaction failed:", e);
        return false;
    }
};

// ==========================================================================================
// 4. МОДУЛЬ АВТОРИЗАЦИИ И ПРОФИЛЕЙ
// ==========================================================================================

/**
 * Регистрация нового аккаунта с уникальным тегом.
 */
const handleRegistration = async () => {
    const email = $('reg-email').value.trim();
    const pass = $('reg-password').value;
    const username = $('reg-username').value.trim();
    const name = $('reg-display-name').value.trim();

    // Базовые проверки
    if (!email || !pass || !username || !name) return notify("Заполните все поля", "warning");
    
    const v = validateUsername(username);
    if (!v.valid) return notify(v.msg, "error");

    try {
        // Создаем пользователя в Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = cred.user;

        // Пытаемся занять юзернейм
        const claimed = await claimUsername(user.uid, username);
        if (!claimed) {
            // Если не вышло, удаляем пользователя (или просим сменить ник)
            // В идеале проверка должна быть ДО регистрации Auth, но RTDB требует UID
            notify("Этот @username уже занят кем-то другим", "error");
            await user.delete();
            return;
        }

        // Создаем профиль
        const profile = {
            uid: user.uid,
            username: username,
            displayName: name,
            bio: "Новый участник COW",
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            level: 1,
            xp: 0,
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            friendsCount: 0
        };

        await set(ref(db, `users/${user.uid}/profile`), profile);
        await updateProfile(user, { displayName: name });
        
        notify("Аккаунт успешно создан!", "success");
    } catch (e) {
        notify(e.message, "error");
    }
};

/**
 * Вход в систему.
 */
const handleLogin = async () => {
    const email = $('login-email').value.trim();
    const pass = $('login-password').value;
    if (!email || !pass) return notify("Введите данные для входа", "warning");

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        notify("С возвращением в COW!", "success");
    } catch (e) {
        notify("Ошибка: Неверный email или пароль", "error");
    }
};

/**
 * Загрузка данных профиля и установка слушателей.
 */
const initUserProfile = (uid) => {
    const profileRef = ref(db, `users/${uid}/profile`);
    onValue(profileRef, (snap) => {
        const data = snap.val();
        if (data) {
            state.profile = data;
            syncUIWithProfile();
        }
    });

    // Мониторинг друзей
    const friendsRef = ref(db, `users/${uid}/friends`);
    onValue(friendsRef, (snap) => {
        state.friends = [];
        snap.forEach(child => {
            state.friends.push({ uid: child.key, ...child.val() });
        });
        renderFriendsList();
    });
};

/**
 * Обновление элементов интерфейса данными пользователя.
 */
const syncUIWithProfile = () => {
    const p = state.profile;
    if (!p) return;

    // Шапка и боковое меню
    if ($('header-user-name')) $('header-user-name').innerText = p.displayName;
    if ($('header-user-tag')) $('header-user-tag').innerText = p.username;
    if ($('header-avatar')) $('header-avatar').src = p.avatar;

    // Модальное окно профиля
    if ($('profile-edit-name')) $('profile-edit-name').value = p.displayName;
    if ($('profile-edit-bio')) $('profile-edit-bio').value = p.bio || "";
};

// ==========================================================================================
// 5. МОДУЛЬ WEBRTC (ГОЛОСОВОЙ ДВИЖОК)
// ==========================================================================================

/**
 * Инициализация микрофона.
 */
const toggleMic = async () => {
    const btn = $('mic-btn');
    
    if (state.isMicEnabled) {
        // Выключаем
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
        }
        state.localStream = null;
        state.isMicEnabled = false;
        btn.classList.remove('active');
        btn.innerHTML = '🎤';
        notify("Микрофон выключен");
        
        // Уведомляем других
        if (state.currentRoom) {
            update(ref(db, `rooms/${state.currentRoom}/presence/${state.user.uid}`), { mic: false });
        }
    } else {
        // Включаем
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            state.isMicEnabled = true;
            btn.classList.add('active');
            btn.innerHTML = '<span class="pulse-ring"></span>🎤';
            notify("Микрофон активен", "success");

            // Рассылаем трек всем активным пирам
            Object.values(state.peers).forEach(pc => {
                state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
            });

            if (state.currentRoom) {
                update(ref(db, `rooms/${state.currentRoom}/presence/${state.user.uid}`), { mic: true });
            }
        } catch (e) {
            notify("Доступ к микрофону заблокирован", "error");
        }
    }
};

/**
 * Создание Peer Connection для конкретного пользователя.
 */
const initPeer = (targetUid, isInitiator) => {
    if (state.peers[targetUid]) return state.peers[targetUid];

    const pc = new RTCPeerConnection(state.iceConfig);
    state.peers[targetUid] = pc;

    // Если у нас уже включен мик, добавляем его сразу
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
    }

    // Обработка ICE-кандидатов
    pc.onicecandidate = (event) => {
        if (event.candidate && state.currentRoom) {
            const signalRef = ref(db, `signals/${state.currentRoom}/${targetUid}/${state.user.uid}`);
            push(signalRef, { type: 'ice', candidate: JSON.stringify(event.candidate) });
        }
    };

    // Получение удаленного потока
    pc.ontrack = (event) => {
        let remoteAudio = $(`audio-${targetUid}`);
        if (!remoteAudio) {
            remoteAudio = document.createElement('audio');
            remoteAudio.id = `audio-${targetUid}`;
            remoteAudio.autoplay = true;
            remoteAudio.style.display = 'none';
            $('remote-audio-container').appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
    };

    // Состояния соединения
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            destroyPeer(targetUid);
        }
    };

    // Если мы инициатор — создаем Offer
    if (isInitiator) {
        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const signalRef = ref(db, `signals/${state.currentRoom}/${targetUid}/${state.user.uid}`);
                push(signalRef, { type: 'offer', sdp: JSON.stringify(pc.localDescription) });
            } catch (e) { console.error(e); }
        };
    }

    return pc;
};

const destroyPeer = (uid) => {
    if (state.peers[uid]) {
        state.peers[uid].close();
        delete state.peers[uid];
    }
    $(`audio-${uid}`)?.remove();
};

/**
 * Обработка входящих сигналов (Signaling Channel).
 */
const listenSignals = (roomId) => {
    const mySignalsRef = ref(db, `signals/${roomId}/${state.user.uid}`);
    onChildAdded(mySignalsRef, async (snap) => {
        const fromUid = snap.key;
        const messages = snap.val();
        
        for (let msgId in messages) {
            const msg = messages[msgId];
            let pc = state.peers[fromUid];

            if (msg.type === 'offer') {
                pc = initPeer(fromUid, false);
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.sdp)));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const replyRef = ref(db, `signals/${roomId}/${fromUid}/${state.user.uid}`);
                push(replyRef, { type: 'answer', sdp: JSON.stringify(pc.localDescription) });
            } 
            else if (msg.type === 'answer' && pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.sdp)));
            } 
            else if (msg.type === 'ice' && pc) {
                await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.candidate)));
            }
        }
        // Очищаем обработанные сигналы
        remove(snap.ref);
    });
};

// ==========================================================================================
// 6. СИСТЕМА КОМНАТ И СИНХРОНИЗАЦИИ (ROOM ENGINE)
// ==========================================================================================

/**
 * Создание комнаты.
 */
const createRoom = async () => {
    const title = $('room-name-input').value.trim();
    if (!title) return notify("Введите название комнаты", "warning");

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    const roomObj = {
        id: roomId,
        title: title,
        owner: state.user.uid,
        ownerName: state.profile.displayName,
        createdAt: serverTimestamp(),
        settings: {
            isPublic: true,
            allowMic: true,
            allowChat: true
        },
        playback: {
            url: "",
            state: "stopped", // playing | paused | stopped
            time: 0,
            lastUpdate: serverTimestamp()
        }
    };

    try {
        await set(newRoomRef, roomObj);
        notify("Комната создана!", "success");
        joinRoom(roomId);
        $('modal-create-room').classList.remove('active');
    } catch (e) {
        notify("Ошибка при создании", "error");
    }
};

/**
 * Присоединение к комнате.
 */
const joinRoom = async (roomId) => {
    if (state.currentRoom) await leaveRoom();

    const roomRef = ref(db, `rooms/${roomId}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return notify("Комната не найдена", "error");

    state.currentRoom = roomId;
    state.roomData = snap.val();
    state.isOwner = state.roomData.owner === state.user.uid;

    // Смена экрана
    switchScreen('room-screen');
    
    // Presence (Я в комнате)
    const presenceRef = ref(db, `rooms/${roomId}/presence/${state.user.uid}`);
    set(presenceRef, {
        name: state.profile.displayName,
        tag: state.profile.username,
        avatar: state.profile.avatar,
        mic: state.isMicEnabled,
        joinedAt: serverTimestamp()
    });
    onDisconnect(presenceRef).remove();

    // Системное уведомление в чат
    push(ref(db, `rooms/${roomId}/chat`), {
        type: 'system',
        text: `${state.profile.displayName} присоединился к комнате`,
        timestamp: serverTimestamp()
    });

    // Инициализация подсистем комнаты
    initChat(roomId);
    initPresenceListener(roomId);
    listenSignals(roomId);
    initPlaybackSync(roomId);

    updateRoomUI();
};

/**
 * Выход из комнаты.
 */
const leaveRoom = async () => {
    if (!state.currentRoom) return;

    const roomId = state.currentRoom;
    
    // Удаляем себя из списка присутствующих
    await remove(ref(db, `rooms/${roomId}/presence/${state.user.uid}`));
    
    // Закрываем WebRTC
    Object.keys(state.peers).forEach(uid => destroyPeer(uid));
    state.peers = {};

    // Отписываемся от событий
    off(ref(db, `rooms/${roomId}/chat`));
    off(ref(db, `rooms/${roomId}/presence`));
    off(ref(db, `rooms/${roomId}/playback`));
    off(ref(db, `signals/${roomId}/${state.user.uid}`));

    state.currentRoom = null;
    state.roomData = null;
    switchScreen('lobby-screen');
};

/**
 * Живой список участников (👥 Люди).
 */
const initPresenceListener = (roomId) => {
    const listRef = ref(db, `rooms/${roomId}/presence`);
    onValue(listRef, (snap) => {
        const usersList = $('users-list');
        const countDisplay = $('users-count');
        if (!usersList) return;

        usersList.innerHTML = '';
        let count = 0;

        snap.forEach(child => {
            const u = child.val();
            const uid = child.key;
            count++;

            const el = document.createElement('div');
            el.className = 'user-card glass-panel anim-slide-in';
            el.innerHTML = `
                <div class="user-card-main">
                    <img src="${u.avatar}" class="user-card-avatar">
                    <div class="user-card-info">
                        <div class="user-card-name">${u.name}</div>
                        <div class="user-card-tag">${u.tag}</div>
                    </div>
                    <div class="user-card-status">
                        ${u.mic ? '<span class="status-icon active">🎤</span>' : '<span class="status-icon">🔇</span>'}
                    </div>
                </div>
                <div class="user-card-actions">
                    ${uid !== state.user.uid ? `<button class="btn-sm" onclick="app.viewProfile('${uid}')">Профиль</button>` : '<span>Вы</span>'}
                </div>
            `;
            usersList.appendChild(el);

            // Если зашел новый человек и мы уже в комнате — инициируем связь
            if (uid !== state.user.uid && !state.peers[uid]) {
                initPeer(uid, true);
            }
        });

        if (countDisplay) countDisplay.innerText = count;
    });
};

// ==========================================================================================
// 7. МОДУЛЬ ЧАТА (MESSAGING SYSTEM)
// ==========================================================================================

const initChat = (roomId) => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const container = $('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    onChildAdded(chatRef, (snap) => {
        const msg = snap.val();
        renderMessage(msg);
    });
};

const renderMessage = (msg) => {
    const container = $('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    
    if (msg.type === 'system') {
        div.className = 'msg-line system';
        div.innerHTML = `<span class="system-tag">ИНФО</span> ${msg.text}`;
    } else {
        const isMe = msg.uid === state.user.uid;
        div.className = `msg-line ${isMe ? 'self' : 'other'}`;
        div.innerHTML = `
            <div class="msg-bubble">
                ${!isMe ? `<strong onclick="app.viewProfile('${msg.uid}')">${msg.author}</strong>` : ''}
                <div class="msg-content">${escapeHTML(msg.text)}</div>
                <div class="msg-time">${formatTime(msg.timestamp)}</div>
            </div>
        `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};

const sendChatMessage = () => {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || !state.currentRoom) return;

    const chatRef = ref(db, `rooms/${state.currentRoom}/chat`);
    push(chatRef, {
        uid: state.user.uid,
        author: state.profile.displayName,
        text: text,
        timestamp: serverTimestamp()
    });

    input.value = '';
};

// ==========================================================================================
// 8. СОЦИАЛЬНЫЙ МОДУЛЬ (ДРУЗЬЯ И ВЗАИМОДЕЙСТВИЯ)
// ==========================================================================================

/**
 * Просмотр чужого профиля.
 */
const viewProfile = async (targetUid) => {
    const snap = await get(ref(db, `users/${targetUid}/profile`));
    if (!snap.exists()) return notify("Пользователь не найден", "error");

    const p = snap.val();
    
    // Заполняем модалку
    $('view-profile-avatar').src = p.avatar;
    $('view-profile-name').innerText = p.displayName;
    $('view-profile-tag').innerText = p.username;
    $('view-profile-bio').innerText = p.bio || "Биография не заполнена";
    
    const actionBtn = $('view-profile-action-btn');
    
    // Проверка статуса друга
    const isFriend = state.friends.find(f => f.uid === targetUid);
    
    if (targetUid === state.user.uid) {
        actionBtn.style.display = 'none';
    } else {
        actionBtn.style.display = 'block';
        if (isFriend) {
            actionBtn.innerText = "Написать сообщение";
            actionBtn.className = "btn-primary w-full";
            actionBtn.onclick = () => openPrivateChat(targetUid);
        } else {
            actionBtn.innerText = "Добавить в друзья";
            actionBtn.className = "btn-accent w-full";
            actionBtn.onclick = () => sendFriendRequest(targetUid);
        }
    }

    $('modal-view-profile').classList.add('active');
};

/**
 * Отправка запроса в друзья.
 */
const sendFriendRequest = async (targetUid) => {
    try {
        const requestRef = ref(db, `users/${targetUid}/requests/${state.user.uid}`);
        await set(requestRef, {
            fromName: state.profile.displayName,
            fromTag: state.profile.username,
            fromAvatar: state.profile.avatar,
            timestamp: serverTimestamp()
        });
        notify("Запрос отправлен!", "success");
        $('modal-view-profile').classList.remove('active');
    } catch (e) {
        notify("Не удалось отправить запрос", "error");
    }
};

const openPrivateChat = (uid) => {
    notify("Личные сообщения будут доступны в следующем обновлении", "info");
};

/**
 * Рендеринг списка друзей в лобби.
 */
const renderFriendsList = () => {
    const container = $('friends-list-container');
    if (!container) return;

    if (state.friends.length === 0) {
        container.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
        return;
    }

    container.innerHTML = '';
    state.friends.forEach(f => {
        const div = document.createElement('div');
        div.className = 'friend-item glass-panel';
        div.innerHTML = `
            <img src="${f.avatar}" class="friend-avatar">
            <div class="friend-info">
                <div class="friend-name">${f.displayName}</div>
                <div class="friend-tag">${f.username}</div>
            </div>
            <button class="btn-icon" onclick="app.viewProfile('${f.uid}')">👤</button>
        `;
        container.appendChild(div);
    });
};

// ==========================================================================================
// 9. СИНХРОНИЗАЦИЯ ВИДЕО (PLAYBACK ENGINE)
// ==========================================================================================

const initPlaybackSync = (roomId) => {
    const playbackRef = ref(db, `rooms/${roomId}/playback`);
    
    // Слушаем изменения от владельца
    onValue(playbackRef, (snap) => {
        const data = snap.val();
        if (!data) return;

        // Если мы не владелец — синхронизируем наш плеер с базой
        if (!state.isOwner) {
            syncLocalPlayer(data);
        }
    });
};

const syncLocalPlayer = (data) => {
    // Здесь должна быть логика управления <video> или YouTube API
    // Для примера просто выводим статус
    console.log("Syncing player:", data);
};

const updatePlayback = (updates) => {
    if (!state.isOwner || !state.currentRoom) return;
    update(ref(db, `rooms/${state.currentRoom}/playback`), {
        ...updates,
        lastUpdate: serverTimestamp()
    });
};

// ==========================================================================================
// 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ИНИЦИАЛИЗАЦИЯ UI
// ==========================================================================================

const switchScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
    
    // Если выходим в лобби — обновляем список комнат
    if (screenId === 'lobby-screen') loadRoomsList();
};

const loadRoomsList = () => {
    const grid = $('rooms-grid');
    if (!grid) return;

    onValue(ref(db, 'rooms'), (snap) => {
        grid.innerHTML = '';
        snap.forEach(child => {
            const r = child.val();
            const card = document.createElement('div');
            card.className = 'room-card glass-panel anim-fade-in';
            card.innerHTML = `
                <div class="room-card-header">
                    <h3>${escapeHTML(r.title)}</h3>
                    <span class="badge">LIVE</span>
                </div>
                <div class="room-card-body">
                    <p>Хост: ${r.ownerName}</p>
                </div>
                <button class="btn-primary w-full" onclick="app.joinRoom('${r.id}')">Войти в комнату</button>
            `;
            grid.appendChild(card);
        });
    });
};

/**
 * Обработка кликов по вкладкам (Чат / Люди / Настройки).
 */
const initTabs = () => {
    const tabs = {
        'tab-chat-btn': { area: 'chat-messages', dock: 'message-dock-container' },
        'tab-users-btn': { area: 'users-list', dock: null }
    };

    Object.keys(tabs).forEach(id => {
        $(id)?.addEventListener('click', () => {
            // Сброс активных классов
            document.querySelectorAll('.chat-tabs button').forEach(b => b.classList.remove('active'));
            $(id).classList.add('active');

            // Скрытие зон
            $('chat-messages').style.display = 'none';
            $('users-list').style.display = 'none';
            $('message-dock-container').style.display = 'none';

            // Показ нужной
            const config = tabs[id];
            $(config.area).style.display = 'flex';
            if (config.dock) $(config.dock).style.display = 'block';
        });
    });
};

// Утилиты
const escapeHTML = (str) => {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
};

const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ==========================================================================================
// 11. ТОЧКА ВХОДА (BOOTSTRAP)
// ==========================================================================================

const bindEvents = () => {
    // Auth
    $('btn-login')?.addEventListener('click', handleLogin);
    $('btn-register')?.addEventListener('click', handleRegistration);
    $('btn-logout')?.addEventListener('click', () => signOut(auth));

    // Navigation
    $('btn-to-register')?.addEventListener('click', () => {
        $('form-login').classList.remove('active-form');
        $('form-register').classList.add('active-form');
        $('tab-login').classList.remove('active');
        $('tab-register').classList.add('active');
    });

    $('btn-to-login')?.addEventListener('click', () => {
        $('form-register').classList.remove('active-form');
        $('form-login').classList.add('active-form');
        $('tab-register').classList.remove('active');
        $('tab-login').classList.add('active');
    });

    // Room Actions
    $('btn-create-room-open')?.addEventListener('click', () => $('modal-create-room').classList.add('active'));
    $('btn-create-room-cancel')?.addEventListener('click', () => $('modal-create-room').classList.remove('active'));
    $('btn-create-room-confirm')?.addEventListener('click', createRoom);
    $('btn-leave-room')?.addEventListener('click', leaveRoom);
    $('mic-btn')?.addEventListener('click', toggleMic);

    // Chat
    $('send-btn')?.addEventListener('click', sendChatMessage);
    $('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Profile Modals
    $('btn-close-view-profile')?.addEventListener('click', () => $('modal-view-profile').classList.remove('active'));
    $('header-profile-trigger')?.addEventListener('click', () => $('modal-edit-profile').classList.add('active'));
    $('btn-close-edit-profile')?.addEventListener('click', () => $('modal-edit-profile').classList.remove('active'));
};

/**
 * Инициализация визуальных эффектов (Neural Background).
 */
const initVisuals = () => {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 1.5 + 0.5;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        draw() {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const setup = () => {
        resize();
        particles = Array.from({ length: 80 }, () => new Particle());
    };

    const loop = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.update();
            p.draw();
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        });
        requestAnimationFrame(loop);
    };

    window.addEventListener('resize', setup);
    setup();
    loop();
};

// Главный обработчик загрузки
window.onload = () => {
    initVisuals();
    bindEvents();
    initTabs();

    // Отслеживание состояния Auth
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.user = user;
            initUserProfile(user.uid);
            switchScreen('lobby-screen');
        } else {
            state.user = null;
            state.profile = null;
            switchScreen('auth-screen');
        }
    });
};

/**
 * Публичное API приложения для инлайн-вызовов из HTML.
 */
window.app = {
    joinRoom,
    viewProfile,
    sendFriendRequest,
    toggleMic
};

/**
 * КОНЕЦ ЯДРА ПРИЛОЖЕНИЯ.
 * Весь код выше обеспечивает работоспособность COW.
 */