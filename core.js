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
export const auth = getAuth(app);
export const db = getDatabase(app);

export const AppState = { 
    user: null, 
    currentRoomId: null,
    isOwner: false
};

export function initCore() {
    console.log('📡 Core: Подключение к Firebase...');
    onAuthStateChanged(auth, (user) => {
        AppState.user = user;
        console.log('🔑 Статус пользователя изменился:', user ? user.email : 'Выход');
        document.dispatchEvent(new CustomEvent('core:authChanged', { detail: user }));
        
        if (user) {
            listenRooms();
        }
    });
}

function listenRooms() {
    onValue(ref(db, 'rooms'), (snap) => {
        const rooms = [];
        snap.forEach(child => { 
            const data = child.val();
            data.id = child.key;
            rooms.push(data); 
        });
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
            name: data.name || "Без названия",
            videoUrl: data.videoUrl || "",
            private: data.private || false,
            password: data.password || ""
        };
        await set(roomRef, roomData);
        return roomRef.key;
    }
};