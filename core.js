// core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
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
    onDisconnect, 
    remove, 
    off, 
    update 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Глобальный State Management (замена window. variables)
export const AppState = {
    currentUser: null,
    editingRoomId: null,
    teardown: [],
    roomSubscriptions: [],
    
    setEditingRoom(id) {
        this.editingRoomId = id;
    },
    
    addTeardown(fn) {
        this.teardown.push(fn);
    },
    
    clearTeardown() {
        this.teardown.forEach(fn => fn());
        this.teardown = [];
    }
};

// Утилиты
export function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
    }[s]));
}

// Core системы
export function initCoreComponents() {
    onAuthStateChanged(auth, (user) => {
        AppState.currentUser = user;
        // Триггер обновления UI через кастомный event или callback, 
        // чтобы не импортировать UI в Core (сохраняем однонаправленный поток данных)
        document.dispatchEvent(new CustomEvent('core:authChanged', { detail: user }));
    });
}

export function subscribeToOwnProfile() {
    if (!AppState.currentUser) return;
    const userRef = ref(db, `users/${AppState.currentUser.uid}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        document.dispatchEvent(new CustomEvent('core:profileUpdated', { detail: data }));
    });
    
    AppState.addTeardown(() => off(userRef, 'value', unsubscribe));
}

export function roomListenerUnsubscribe() {
    AppState.clearTeardown();
    closeVoiceSignalLayer();
    clearRoomProfileSubscriptions();
}

function closeVoiceSignalLayer() {
    // WebRTC / PeerJS логика отключения
    document.dispatchEvent(new CustomEvent('core:voiceLayerClosed'));
}

function clearRoomProfileSubscriptions() {
    AppState.roomSubscriptions.forEach(unsub => unsub());
    AppState.roomSubscriptions = [];
}
// core.js (ПРОДОЛЖЕНИЕ)

import { push, set, onChildAdded, onValue, onDisconnect, remove, update, get, ref } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// 1. ONLINE PRESENCE SYSTEM
// ==========================================
export function initPresenceSystem() {
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true && AppState.currentUser) {
            const myConnectionsRef = ref(db, `users/${AppState.currentUser.uid}/connections`);
            const lastOnlineRef = ref(db, `users/${AppState.currentUser.uid}/lastOnline`);
            
            const con = push(myConnectionsRef);
            onDisconnect(con).remove();
            onDisconnect(lastOnlineRef).set(Date.now());
            set(con, true);
        }
    });
}

// ==========================================
// 2. ROOMS & VIDEO SYNC LOGIC
// ==========================================
export async function createRoom(roomData) {
    if (!AppState.currentUser) return;
    const roomRef = push(ref(db, 'rooms'));
    const newRoom = {
        id: roomRef.key,
        ownerId: AppState.currentUser.uid,
        name: roomData.name || 'Новая комната',
        videoUrl: roomData.videoUrl || '',
        isPrivate: roomData.isPrivate || false,
        password: roomData.password || '',
        createdAt: Date.now(),
        state: { isPlaying: false, currentTime: 0, updatedAt: Date.now() }
    };
    await set(roomRef, newRoom);
    return roomRef.key;
}

export function joinRoomCore(roomId, password = '') {
    return new Promise(async (resolve, reject) => {
        const roomRef = ref(db, `rooms/${roomId}`);
        const snapshot = await get(roomRef);
        
        if (!snapshot.exists()) return reject('Комната не найдена');
        
        const room = snapshot.val();
        if (room.isPrivate && room.password !== password) {
            return reject('Неверный пароль');
        }

        AppState.currentRoomId = roomId;
        
        // Подписка на состояние плеера
        const stateRef = ref(db, `rooms/${roomId}/state`);
        const unsubState = onValue(stateRef, (snap) => {
            const state = snap.val();
            if (state) document.dispatchEvent(new CustomEvent('core:videoStateChanged', { detail: state }));
        });
        
        AppState.roomSubscriptions.push(() => off(stateRef, 'value', unsubState));
        
        // Инициализация голосового чата для комнаты
        initVoiceSignalLayer(roomId);
        resolve(room);
    });
}

export function syncVideoState(roomId, isPlaying, currentTime) {
    if (!AppState.currentUser) return;
    const stateRef = ref(db, `rooms/${roomId}/state`);
    update(stateRef, {
        isPlaying,
        currentTime,
        updatedAt: Date.now(),
        updatedBy: AppState.currentUser.uid
    });
}

// ==========================================
// 3. WEBRTC / PEERJS (VOICE CHAT LAYER)
// ==========================================
let peer = null;
let activeCalls = {};

export function initVoiceSignalLayer(roomId) {
    if (!AppState.currentUser) return;
    
    // Инициализация PeerJS (ожидается, что Peer доступен глобально через CDN)
    peer = new Peer(AppState.currentUser.uid, {
        debug: 1,
        config: {'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]}
    });

    peer.on('open', (id) => {
        console.log('PeerJS подключен:', id);
        joinVoiceRoomDb(roomId, id);
    });

    peer.on('call', (call) => {
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then((stream) => {
                call.answer(stream);
                handleCallStream(call);
            })
            .catch(err => console.error('Ошибка доступа к микрофону:', err));
    });
}

function joinVoiceRoomDb(roomId, peerId) {
    const participantsRef = ref(db, `rooms/${roomId}/participants/${AppState.currentUser.uid}`);
    set(participantsRef, { peerId, joinedAt: Date.now() });
    onDisconnect(participantsRef).remove();

    // Слушаем новых участников, чтобы позвонить им
    const roomPartsRef = ref(db, `rooms/${roomId}/participants`);
    const unsubParts = onChildAdded(roomPartsRef, (snap) => {
        const participant = snap.val();
        if (snap.key !== AppState.currentUser.uid) {
            connectToPeer(participant.peerId);
        }
    });
    AppState.roomSubscriptions.push(() => off(roomPartsRef, 'child_added', unsubParts));
}

function connectToPeer(targetPeerId) {
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then((stream) => {
            const call = peer.call(targetPeerId, stream);
            handleCallStream(call);
        });
}

function handleCallStream(call) {
    call.on('stream', (remoteStream) => {
        document.dispatchEvent(new CustomEvent('core:remoteStreamAdded', { 
            detail: { peerId: call.peer, stream: remoteStream } 
        }));
    });
    call.on('close', () => {
        document.dispatchEvent(new CustomEvent('core:remoteStreamRemoved', { detail: call.peer }));
    });
    activeCalls[call.peer] = call;
}

export function closeVoiceSignalLayer() {
    if (peer) {
        Object.values(activeCalls).forEach(call => call.close());
        activeCalls = {};
        peer.destroy();
        peer = null;
    }
}

// ==========================================
// 4. CHAT SYSTEM
// ==========================================
export function sendChatMessage(roomId, text) {
    if (!AppState.currentUser || !text.trim()) return;
    const msgRef = push(ref(db, `rooms/${roomId}/messages`));
    set(msgRef, {
        senderId: AppState.currentUser.uid,
        text: escapeHtml(text.trim()),
        timestamp: Date.now()
    });
}

export function subscribeToChat(roomId) {
    const messagesRef = ref(db, `rooms/${roomId}/messages`);
    const unsubMsg = onChildAdded(messagesRef, (snap) => {
        document.dispatchEvent(new CustomEvent('core:chatMessageReceived', { detail: snap.val() }));
    });
    AppState.roomSubscriptions.push(() => off(messagesRef, 'child_added', unsubMsg));
}
// core.js (ФИНАЛ)

import { ref, set, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// 5. GLOBAL ONLINE COUNTER
// ==========================================
export function initGlobalOnlineCounter() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        let count = 0;
        snapshot.forEach((childSnap) => {
            const userData = childSnap.val();
            // Считаем пользователя онлайн, если у него есть активные соединения
            if (userData.connections) {
                count++;
            }
        });
        document.dispatchEvent(new CustomEvent('core:onlineCountUpdated', { detail: count }));
    });
}

// ==========================================
// 6. FRIENDS SYSTEM
// ==========================================
export function subscribeToFriends() {
    if (!AppState.currentUser) return;
    const friendsRef = ref(db, `users/${AppState.currentUser.uid}/friends`);
    
    const unsub = onValue(friendsRef, async (snapshot) => {
        const friendsList = [];
        if (snapshot.exists()) {
            const promises = [];
            snapshot.forEach((childSnap) => {
                const friendId = childSnap.key;
                const friendUserRef = ref(db, `users/${friendId}`);
                promises.push(get(friendUserRef).then(res => res.val()));
            });
            const results = await Promise.all(promises);
            results.forEach(user => { if (user) friendsList.push(user); });
        }
        document.dispatchEvent(new CustomEvent('core:friendsUpdated', { detail: friendsList }));
    });
    
    AppState.addTeardown(() => off(friendsRef, 'value', unsub));
}

export async function addFriend(friendUid) {
    if (!AppState.currentUser || friendUid === AppState.currentUser.uid) return false;
    
    // Проверяем, существует ли пользователь
    const userRef = ref(db, `users/${friendUid}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) throw new Error("Пользователь не найден");

    const myFriendRef = ref(db, `users/${AppState.currentUser.uid}/friends/${friendUid}`);
    await set(myFriendRef, true);
    return true;
}

export async function removeFriend(friendUid) {
    if (!AppState.currentUser) return;
    const myFriendRef = ref(db, `users/${AppState.currentUser.uid}/friends/${friendUid}`);
    await remove(myFriendRef);
}

export async function updateUserProfile(displayName, photoURL) {
    if (!AppState.currentUser) return;
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (photoURL) updates.photoURL = photoURL;
    
    await updateProfile(AppState.currentUser, updates);
    const userDbRef = ref(db, `users/${AppState.currentUser.uid}`);
    await update(userDbRef, updates);
}