import { auth, db } from 'JS/js/firebase.js';
import { ref, get, set, remove, onValue, onChildAdded, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { UI } from 'JS/js/ui.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
let requestsUnsubscribe = null;
let friendsListUnsubscribe = null;
const friendStatusSubscriptions = new Map();

export const FriendsSystem = {
    /**
     * Запуск всех слушателей для друзей и инвайтов.
     * @param {Function} onFriendsListUpdated - (friendsArray) => {}
     */
    init(onFriendsListUpdated) {
        if (!auth.currentUser) return;
        this._listenToIncomingRequests();
        this._listenToFriendsList(onFriendsListUpdated);
    },

    async sendFriendRequest(targetUid) {
        if (!auth.currentUser || targetUid === auth.currentUser.uid) return;
        
        try {
            // 1. Проверяем, не друзья ли мы уже
            const friendRef = ref(db, `users/${auth.currentUser.uid}/friends/${targetUid}`);
            const friendSnap = await get(friendRef);
            if (friendSnap.exists() && friendSnap.val().status === 'accepted') {
                return UI.showToast("Вы уже друзья");
            }

            // 2. Проверяем, нет ли уже отправленного запроса
            const reqRef = ref(db, `users/${targetUid}/friend-requests/${auth.currentUser.uid}`);
            const reqSnap = await get(reqRef);
            if (reqSnap.exists()) {
                return UI.showToast("Запрос уже отправлен");
            }

            // 3. Отправляем
            await set(ref(db, `users/${auth.currentUser.uid}/friends/${targetUid}`), { status: 'pending', ts: Date.now() });
            await set(reqRef, { from: auth.currentUser.displayName || 'User', ts: Date.now() });
            
            UI.showToast('Запрос в друзья отправлен!');
        } catch (e) {
            console.error("Send Friend Request Error:", e);
            UI.showToast('Ошибка отправки запроса');
        }
    },

    async acceptRequest(fromUid) {
        try {
            const now = Date.now();
            await set(ref(db, `users/${auth.currentUser.uid}/friends/${fromUid}`), { status: 'accepted', ts: now });
            await set(ref(db, `users/${fromUid}/friends/${auth.currentUser.uid}`), { status: 'accepted', ts: now });
            await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
            
            UI.showToast('Запрос принят!');
        } catch (e) {
            UI.showToast('Ошибка при принятии запроса');
        }
    },

    async declineRequest(fromUid) {
        try {
            await remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
            await remove(ref(db, `users/${fromUid}/friends/${auth.currentUser.uid}`)); // Очищаем 'pending' у отправителя
        } catch (e) {
            console.error("Decline Error:", e);
        }
    },

    async removeFriend(targetUid) {
        if (!confirm("Удалить из друзей?")) return;
        try {
            await remove(ref(db, `users/${auth.currentUser.uid}/friends/${targetUid}`));
            await remove(ref(db, `users/${targetUid}/friends/${auth.currentUser.uid}`));
            UI.showToast("Друг удален");
        } catch (e) {
            UI.showToast("Ошибка при удалении");
        }
    },

    _listenToIncomingRequests() {
        const reqRef = ref(db, `users/${auth.currentUser.uid}/friend-requests`);
        const listener = onChildAdded(reqRef, (snap) => {
            const req = snap.val();
            const fromUid = snap.key;
            if (!req) return;

            // Дедупликация и очистка: если запросу больше 7 дней, удаляем и игнорируем
            if (Date.now() - req.ts > SEVEN_DAYS_MS) {
                remove(ref(db, `users/${auth.currentUser.uid}/friend-requests/${fromUid}`));
                return;
            }

            // Рендер тоста-уведомления с коллбеками (интеграция с UI слоем)
            // Примечание: В UI-модуле нет конкретно renderFriendToast, поэтому мы 
            // передадим данные наверх в main.js или покажем стандартный тост
            UI.showToast(`Новый запрос в друзья от: ${req.from}`);
            
            // Генерируем событие для main.js, чтобы он мог отрендерить кастомный UI, если нужно
            document.dispatchEvent(new CustomEvent('incomingFriendRequest', {
                detail: { fromUid, name: req.from }
            }));
        });
        requestsUnsubscribe = () => off(reqRef, 'child_added', listener);
    },

    _listenToFriendsList(onFriendsListUpdated) {
        const friendsRef = ref(db, `users/${auth.currentUser.uid}/friends`);
        const listener = onValue(friendsRef, async (snap) => {
            const data = snap.val() || {};
            const acceptedIds = Object.keys(data).filter(uid => data[uid].status === 'accepted');
            
            // Чистим старые подписки на статусы
            this._cleanupStatusSubscriptions(acceptedIds);

            // Получаем профили всех друзей и подписываемся на их статус (online)
            const friendsArray = await Promise.all(acceptedIds.map(uid => this._fetchFriendData(uid)));
            
            onFriendsListUpdated(friendsArray);
        });

        friendsListUnsubscribe = () => off(friendsRef, 'value', listener);
    },

    async _fetchFriendData(uid) {
        let profile = { name: 'User', color: '#f5f7fa' };
        let status = { online: false, lastSeen: 0 };
        
        try {
            const profileSnap = await get(ref(db, `users/${uid}/profile`));
            if (profileSnap.exists()) profile = profileSnap.val();

            // Создаем активную подписку на статус друга (чтобы видеть онлайн в реальном времени)
            if (!friendStatusSubscriptions.has(uid)) {
                const statusRef = ref(db, `users/${uid}/status`);
                const cb = onValue(statusRef, (sSnap) => {
                    // При изменении статуса друга можно триггерить перерисовку
                    document.dispatchEvent(new CustomEvent('friendStatusChanged', { detail: { uid, status: sSnap.val() } }));
                });
                friendStatusSubscriptions.set(uid, () => off(statusRef, 'value', cb));
            }

            const statusSnap = await get(ref(db, `users/${uid}/status`));
            if (statusSnap.exists()) status = statusSnap.val();

        } catch (e) {
            console.error("Fetch friend data error:", e);
        }

        return { uid, profile, status };
    },

    _cleanupStatusSubscriptions(currentFriendIds) {
        const needed = new Set(currentFriendIds);
        for (const [uid, unsub] of friendStatusSubscriptions.entries()) {
            if (!needed.has(uid)) {
                unsub();
                friendStatusSubscriptions.delete(uid);
            }
        }
    },

    shutdown() {
        if (requestsUnsubscribe) requestsUnsubscribe();
        if (friendsListUnsubscribe) friendsListUnsubscribe();
        this._cleanupStatusSubscriptions([]); // Очищаем всё
    }
};