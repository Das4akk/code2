import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
const googleProvider = new GoogleAuthProvider();

export const AppState = {
    user: null,
    currentRoomId: null,
    isOwner: false,
    peer: null,
    roomSubscriptions: [],
    isMicMuted: true
};

export async function initCore() {
    // Слушатель авторизации (Автологин тут)
    onAuthStateChanged(auth, (user) => {
        AppState.user = user;
        if (user) {
            console.log("Автологин: ", user.displayName);
            setupPresence(user.uid);
        }
        // Уведомляем UI, что статус юзера изменился
        document.dispatchEvent(new CustomEvent('core:authChanged', { detail: user }));
    });
}

function setupPresence(uid) {
    const statusRef = ref(db, `users/${uid}/status`);
    onValue(ref(db, '.info/connected'), snap => {
        if (snap.val()) {
            onDisconnect(statusRef).set('offline');
            set(statusRef, 'online');
        }
    });
}

export const authActions = {
    login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    register: async (email, pass, name) => {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        return res;
    },
    logout: () => signOut(auth)
};

export const roomActions = {
    create: async (data) => {
        const roomRef = push(ref(db, 'rooms'));
        const roomData = {
            id: roomRef.key,
            owner: AppState.user.uid,
            name: data.name,
            videoUrl: data.videoUrl,
            private: data.private || false,
            password: data.password || '',
            state: { isPlaying: false, currentTime: 0 }
        };
        await set(roomRef, roomData);
        return roomRef.key;
    },
    join: async (roomId, password = '') => {
        const snap = await get(ref(db, `rooms/${roomId}`));
        if (!snap.exists()) throw new Error("Комната не найдена");
        if (snap.val().private && snap.val().password !== password) throw new Error("Неверный пароль");
        AppState.currentRoomId = roomId;
        AppState.isOwner = snap.val().owner === AppState.user.uid;
        return snap.val();
    }
};

export const chatActions = {
    send: (text) => {
        if (!AppState.currentRoomId || !text.trim()) return;
        push(ref(db, `rooms/${AppState.currentRoomId}/messages`), {
            senderId: AppState.user.uid,
            senderName: AppState.user.displayName || 'Anon',
            text: text,
            timestamp: Date.now()
        });
    }
};

export function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}