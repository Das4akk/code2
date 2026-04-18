// core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, 
    signOut, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, ref, push, set, get, onValue, onChildAdded, 
    onDisconnect, remove, off, update 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔧 КОНФИГУРАЦИЯ FIREBASE
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
const googleProvider = new GoogleAuthProvider();

// 🧠 ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE)
export const AppState = {
    user: null,
    currentRoomId: null,
    isOwner: false,
    peer: null,
    localStream: null,
    activeCalls: {},
    isMicMuted: true,
    roomSubscriptions: [],

    clearRoomState() {
        this.roomSubscriptions.forEach(unsub => unsub());
        this.roomSubscriptions = [];
        this.currentRoomId = null;
        this.isOwner = false;
        
        if (this.peer) {
            Object.values(this.activeCalls).forEach(call => call.close());
            this.activeCalls = {};
            this.peer.destroy();
            this.peer = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
    }
};

// 🚀 ИНИЦИАЛИЗАЦИЯ CORE
export function initCore() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            AppState.user = user;
            if (user) {
                initGlobalPresence(user.uid);
                listenGlobalOnlineCount();
            }
            document.dispatchEvent(new CustomEvent('core:authChanged', { detail: user }));
            resolve();
        });
    });
}

// 🔐 АВТОРИЗАЦИЯ
export const authActions = {
    login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    register: async (email, pass, name) => {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        await set(ref(db, `users/${res.user.uid}`), { displayName: name, email });
        return res;
    },
    loginGoogle: () => signInWithPopup(auth, googleProvider),
    logout: () => {
        AppState.clearRoomState();
        return signOut(auth);
    }
};

// 🏠 КОМНАТЫ
export const roomActions = {
    create: async (data) => {
        const roomRef = push(ref(db, 'rooms'));
        const roomData = {
            id: roomRef.key,
            owner: AppState.user.uid,
            name: data.name || 'Новая комната',
            videoUrl: data.videoUrl,
            private: data.private || false,
            password: data.password || '',
            createdAt: Date.now(),
            state: { isPlaying: false, currentTime: 0, updatedAt: Date.now() }
        };
        await set(roomRef, roomData);
        return roomRef.key;
    },
    
    join: async (roomId, password = '') => {
        const snapshot = await get(ref(db, `rooms/${roomId}`));
        if (!snapshot.exists()) throw new Error('Комната не существует');
        const room = snapshot.val();
        
        if (room.private && room.password !== password) throw new Error('Неверный пароль');
        
        AppState.currentRoomId = roomId;
        AppState.isOwner = room.owner === AppState.user.uid;
        
        subscribeToRoom(roomId);
        initPeerJS(roomId);
        return room;
    },

    leave: () => {
        if (AppState.currentRoomId && AppState.user) {
            remove(ref(db, `rooms/${AppState.currentRoomId}/participants/${AppState.user.uid}`));
        }
        AppState.clearRoomState();
    },

    syncVideo: (isPlaying, currentTime) => {
        if (!AppState.currentRoomId || !AppState.isOwner) return;
        update(ref(db, `rooms/${AppState.currentRoomId}/state`), {
            isPlaying, currentTime, updatedAt: Date.now(), updatedBy: AppState.user.uid
        });
    }
};

// 💬 ЧАТ И ПОДПИСКИ НА КОМНАТУ
function subscribeToRoom(roomId) {
    const stateRef = ref(db, `rooms/${roomId}/state`);
    const chatRef = ref(db, `rooms/${roomId}/messages`);
    const usersRef = ref(db, `rooms/${roomId}/participants`);

    // Видео стейт
    const unsubState = onValue(stateRef, snap => {
        if (snap.val()) document.dispatchEvent(new CustomEvent('core:videoSync', { detail: snap.val() }));
    });
    
    // Новые сообщения
    const unsubChat = onChildAdded(chatRef, snap => {
        document.dispatchEvent(new CustomEvent('core:chatMessage', { detail: snap.val() }));
    });

    // Участники
    const unsubUsers = onValue(usersRef, snap => {
        const users = [];
        snap.forEach(child => { users.push({ uid: child.key, ...child.val() }); });
        document.dispatchEvent(new CustomEvent('core:roomUsers', { detail: users }));
    });

    AppState.roomSubscriptions.push(
        () => off(stateRef, 'value', unsubState),
        () => off(chatRef, 'child_added', unsubChat),
        () => off(usersRef, 'value', unsubUsers)
    );
}

export const chatActions = {
    send: (text) => {
        if (!AppState.currentRoomId || !text.trim()) return;
        push(ref(db, `rooms/${AppState.currentRoomId}/messages`), {
            senderId: AppState.user.uid,
            senderName: AppState.user.displayName || 'Пользователь',
            text: text.trim(),
            timestamp: Date.now()
        });
    }
};

// 🎤 WEBRTC / PEERJS (Голосовой чат)
function initPeerJS(roomId) {
    AppState.peer = new Peer(AppState.user.uid, {
        config: {'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }]}
    });

    AppState.peer.on('open', (id) => {
        const pRef = ref(db, `rooms/${roomId}/participants/${AppState.user.uid}`);
        set(pRef, { peerId: id, name: AppState.user.displayName || 'Аноним', joinedAt: Date.now() });
        onDisconnect(pRef).remove();

        // Звоним новым участникам
        const unsubNewUsers = onChildAdded(ref(db, `rooms/${roomId}/participants`), snap => {
            if (snap.key !== AppState.user.uid) callPeer(snap.val().peerId);
        });
        AppState.roomSubscriptions.push(() => off(ref(db, `rooms/${roomId}/participants`), 'child_added', unsubNewUsers));
    });

    AppState.peer.on('call', async (call) => {
        const stream = await getLocalStream();
        call.answer(stream);
        handleCall(call);
    });
}

async function getLocalStream() {
    if (!AppState.localStream) {
        AppState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        AppState.localStream.getAudioTracks()[0].enabled = !AppState.isMicMuted;
    }
    return AppState.localStream;
}

async function callPeer(peerId) {
    const stream = await getLocalStream();
    const call = AppState.peer.call(peerId, stream);
    handleCall(call);
}

function handleCall(call) {
    call.on('stream', remoteStream => {
        document.dispatchEvent(new CustomEvent('core:remoteAudio', { detail: { peerId: call.peer, stream: remoteStream }}));
    });
    call.on('close', () => {
        document.dispatchEvent(new CustomEvent('core:remoteAudioRemove', { detail: call.peer }));
    });
    AppState.activeCalls[call.peer] = call;
}

export const voiceActions = {
    toggleMic: async () => {
        const stream = await getLocalStream();
        AppState.isMicMuted = !AppState.isMicMuted;
        stream.getAudioTracks()[0].enabled = !AppState.isMicMuted;
        return !AppState.isMicMuted; // возвращает true если мик ВКЛЮЧЕН
    }
};

// 🌍 СТАТУС ОНЛАЙН
function initGlobalPresence(uid) {
    const statusRef = ref(db, `users/${uid}/status`);
    onValue(ref(db, '.info/connected'), snap => {
        if (snap.val() === true) {
            onDisconnect(statusRef).set('offline');
            set(statusRef, 'online');
        }
    });
}

function listenGlobalOnlineCount() {
    onValue(ref(db, 'users'), snap => {
        let count = 0;
        snap.forEach(u => { if (u.val().status === 'online') count++; });
        document.dispatchEvent(new CustomEvent('core:onlineCount', { detail: count }));
    });
}

// 🛡️ БЕЗОПАСНОСТЬ
export function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}