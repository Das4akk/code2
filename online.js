import { auth, db } from './firebase.js';
import { ref, set, onValue, onDisconnect, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let connectionUnsubscribe = null;

export const OnlineSystem = {
    /**
     * Инициализация подсистемы присутствия.
     * Использует магический эндпоинт Firebase `.info/connected`.
     */
    startTracking() {
        if (!auth.currentUser) return;
        
        const connectedRef = ref(db, '.info/connected');
        const statusRef = ref(db, `users/${auth.currentUser.uid}/status`);

        // Очищаем старую подписку, если есть
        this.stopTracking();

        const listener = onValue(connectedRef, (snap) => {
            // Проверяем, подключены ли мы реально к серверу базы данных
            if (snap.val() === true) {
                // 1. СНАЧАЛА регистрируем действие на случай обрыва (onDisconnect)
                const disconnectPayload = { online: false, lastSeen: Date.now() };
                onDisconnect(statusRef).set(disconnectPayload).then(() => {
                    // 2. ТОЛЬКО ПОСЛЕ успешной регистрации onDisconnect ставим статус "онлайн"
                    // Это защищает от фантомных онлайнов при сбое сети во время рукопожатия
                    set(statusRef, { 
                        online: true, 
                        lastSeen: Date.now() 
                    });
                }).catch(console.error);
            }
        });

        connectionUnsubscribe = () => off(connectedRef, 'value', listener);
    },

    stopTracking() {
        if (connectionUnsubscribe) {
            connectionUnsubscribe();
            connectionUnsubscribe = null;
        }
        // Если выходим осознанно (Logout), снимаем онлайн вручную
        if (auth.currentUser) {
            const statusRef = ref(db, `users/${auth.currentUser.uid}/status`);
            set(statusRef, { online: false, lastSeen: Date.now() }).catch(()=>{});
        }
    }
};