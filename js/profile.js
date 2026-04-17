import { auth, db } from 'js/firebase.js';
import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { UI } from 'JS/ui.js';

let currentProfileUnsubscribe = null;

export const ProfileSystem = {
    // Дефолтные значения для защиты от broken-state
    DEFAULT_COLOR: '#f5f7fa',
    DEFAULT_VOLUME: 100,

    async saveProfile(data) {
        if (!auth.currentUser) return;
        
        const name = (data.name || '').trim();
        const color = data.color || this.DEFAULT_COLOR;
        
        try {
            // 1. Обновляем базовый профиль Firebase Auth (нужно для быстрого доступа)
            if (name && name !== auth.currentUser.displayName) {
                await updateProfile(auth.currentUser, { displayName: name });
            }

            // 2. Обновляем расширенный профиль в RTDB
            await set(ref(db, `users/${auth.currentUser.uid}/profile`), {
                name: name || auth.currentUser.displayName || 'User',
                status: (data.status || '').trim(),
                bio: (data.bio || '').trim(),
                color: color,
                defaultVolume: parseInt(data.volume || this.DEFAULT_VOLUME, 10),
                updatedAt: Date.now()
            });

            UI.showToast('Профиль сохранен');
        } catch (e) {
            console.error('Save Profile Error:', e);
            UI.showToast('Ошибка сохранения профиля');
        }
    },

    async getProfile(uid) {
        try {
            const snap = await get(ref(db, `users/${uid}/profile`));
            return snap.val() || null;
        } catch (e) {
            console.error("Get Profile Error:", e);
            return null;
        }
    },

    /**
     * Слушает изменения собственного профиля и прокидывает их в UI
     */
    subscribeToOwnProfile(onProfileLoadedCb) {
        if (!auth.currentUser) return;
        if (currentProfileUnsubscribe) currentProfileUnsubscribe();

        const profileRef = ref(db, `users/${auth.currentUser.uid}/profile`);
        const listener = onValue(profileRef, (snap) => {
            const profile = snap.val() || {};
            const displayName = profile.name || auth.currentUser.displayName || auth.currentUser.email || 'User';
            const color = profile.color || this.DEFAULT_COLOR;
            
            // Отправляем данные в UI
            UI.updateSelfProfile(displayName, color, profile.status || 'Онлайн', true);
            
            if (onProfileLoadedCb) onProfileLoadedCb(profile);
        });

        currentProfileUnsubscribe = () => off(profileRef, 'value', listener);
    },

    unsubscribe() {
        if (currentProfileUnsubscribe) {
            currentProfileUnsubscribe();
            currentProfileUnsubscribe = null;
        }
    }
};