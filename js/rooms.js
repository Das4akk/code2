import { db, auth } from './firebase.js';
import { ref, set, push, get, onValue, off, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { UI } from './ui.js';
import { VoiceSystem } from './voice.js';

export const RoomSystem = {
    currentRoomId: null,
    roomsCache: {},

    initLobby(onRoomsUpdate) {
        const roomsRef = ref(db, 'rooms');
        onValue(roomsRef, (snap) => {
            this.roomsCache = snap.val() || {};
            onRoomsUpdate(this.roomsCache);
        });
    },

    async createRoom(data, adminProfile) {
        const roomsRef = ref(db, 'rooms');
        const newRoomRef = push(roomsRef);
        const roomId = newRoomRef.key;

        const roomData = {
            id: roomId,
            name: data.name || 'Новая комната',
            link: data.link || '',
            private: !!data.isPrivate,
            password: data.password || '',
            adminUid: auth.currentUser.uid,
            adminName: adminProfile.name || 'User',
            createdAt: Date.now(),
            state: { playing: false, time: 0, lastUpdate: Date.now() }
        };

        await set(newRoomRef, roomData);
        return roomId;
    },

    async joinRoom(roomId, password = '') {
        const room = this.roomsCache[roomId];
        if (!room) return false;
        if (room.private && room.password !== password) {
            UI.showToast("Неверный пароль");
            return false;
        }
        this.currentRoomId = roomId;
        
        // Регистрируем присутствие в комнате
        const presenceRef = ref(db, `rooms/${roomId}/users/${auth.currentUser.uid}`);
        await set(presenceRef, { 
            name: auth.currentUser.displayName || 'User',
            joinedAt: Date.now() 
        });
        
        return true;
    },

    async leaveRoom() {
        if (!this.currentRoomId) return;
        const roomId = this.currentRoomId;
        await remove(ref(db, `rooms/${roomId}/users/${auth.currentUser.uid}`));
        this.currentRoomId = null;
        VoiceSystem.shutdown();
    },

    syncPlayer(roomId, isHost, onSync) {
        const stateRef = ref(db, `rooms/${roomId}/state`);
        return onValue(stateRef, (snap) => {
            const state = snap.val();
            if (state && !isHost) onSync(state);
        });
    },

    updatePlayback(roomId, playing, time) {
        update(ref(db, `rooms/${roomId}/state`), {
            playing,
            time,
            lastUpdate: Date.now()
        });
    }
};