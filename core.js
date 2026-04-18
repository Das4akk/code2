// core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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


export const AppState = { user: null, currentRoomId: null };

export function initCore() {
    onAuthStateChanged(auth, (user) => {
        AppState.user = user;
        // Отправляем событие о смене юзера
        document.dispatchEvent(new CustomEvent('core:authChanged', { detail: user }));
        
        if (user) {
            listenRooms(); // Начинаем слушать список комнат
        }
    });
}

function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = [];
        snap.forEach(child => { rooms.push(child.val()); });
        document.dispatchEvent(new CustomEvent('core:roomsUpdated', { detail: rooms }));
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
            owner: auth.currentUser.uid,
            name: data.name,
            videoUrl: data.videoUrl,
            private: data.private,
            password: data.password
        };
        await set(roomRef, roomData);
        return roomRef.key;
        
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