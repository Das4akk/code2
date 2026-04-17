import { db, auth } from 'JS/firebase.js';
import { ref, push, set, onChildAdded, off, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Измени: import { UI } from 'JS/js/ui.js';
import { UI } from 'JS/ui.js';

export const ChatSystem = {
    roomUnsubscribe: null,
    dmUnsubscribe: null,

    initRoomChat(roomId, canControl) {
        this.stopRoomChat();
        const chatRef = query(ref(db, `rooms/${roomId}/chat`), limitToLast(50));
        
        const listener = onChildAdded(chatRef, (snap) => {
            const msg = snap.val();
            UI.renderChatMsg(msg, auth.currentUser.uid, canControl, msg.type === 'system');
        });

        this.roomUnsubscribe = () => off(chatRef, 'child_added', listener);
    },

    async sendMessage(roomId, text, userProfile) {
        if (!text.trim()) return;
        const chatRef = ref(db, `rooms/${roomId}/chat`);
        await push(chatRef, {
            fromUid: auth.currentUser.uid,
            user: userProfile.name || 'User',
            content: text.trim(),
            ts: Date.now(),
            type: 'user'
        });
    },

    async sendSystemMessage(roomId, text) {
        const chatRef = ref(db, `rooms/${roomId}/chat`);
        await push(chatRef, {
            content: text,
            ts: Date.now(),
            type: 'system'
        });
    },

    stopRoomChat() {
        if (this.roomUnsubscribe) this.roomUnsubscribe();
        UI.clearChat();
    }
};