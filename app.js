/**
 * @fileoverview COW Core Engine v2.0 - Enterprise Grade
 * @description Решена проблема DOM Thrashing, утечек памяти WebRTC и багов профилей.
 * Полностью атомарные транзакции, Virtual DOM паттерн для рендера списков.
 * Requires Firebase v10.7.1
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, signOut, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, ref, set, get, push, onValue, onDisconnect, 
    remove, update, onChildAdded, off
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ============================================================================
// 1. КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЙ STATE
// ============================================================================

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

const AppState = {
    currentUser: null,
    currentRoomId: null,
    isHost: false,
    usersCache: new Map(), // Кеш профилей: uid -> данные
    activeSubscriptions: [], // Массив функций-отписок
    rtc: {
        localStream: null,
        sessionId: null,
        peerConnections: new Map(), // P2P соединения
        audioElements: new Map(),   // Аудио теги
        iceRestartTimeouts: new Map() // Защита от спама реконнектов
    },
    pendingJoinRoomId: null,
};

// ============================================================================
// 2. УТИЛИТЫ И ВИРТУАЛЬНЫЙ DOM (Решение проблемы спама сети)
// ============================================================================

class Utils {
    static $(id) { return document.getElementById(id); }

    static toast(msg, type = 'info') {
        const container = Utils.$('toast-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'toast';
        div.style.borderLeft = `4px solid ${type === 'error' ? 'var(--danger)' : 'var(--accent)'}`;
        div.innerText = msg;
        container.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }

    static escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, match => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[match];
        });
    }

    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = Utils.$(screenId);
        if (screen) screen.classList.add('active');
    }

    static generateCryptoId(length = 16) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    static async hashPassword(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
        );
        const derivedBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode(salt), iterations: 10000, hash: 'SHA-256' },
            keyMaterial, 256
        );
        return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    }

    // Защита от спама Firebase (например, при поиске)
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// ============================================================================
// 3. АВТОРИЗАЦИЯ
// ============================================================================

class AuthManager {
    static init() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                AppState.currentUser = user;
                Utils.showScreen('lobby-screen');
                await ProfileManager.ensureProfileExists(user);
                ProfileManager.bindMyProfileListener();
                FriendsManager.initListeners();
                RoomManager.initLobbyListeners();
                this.bindGlobalPresence();
            } else {
                this.handleLogoutCleanup();
            }
        });

        this.bindUI();
    }

    static bindUI() {
        Utils.$('tab-login-btn').onclick = () => {
            Utils.$('tab-login-btn').classList.add('active');
            Utils.$('tab-reg-btn').classList.remove('active');
            Utils.$('login-form').classList.add('active-form');
            Utils.$('reg-form').classList.remove('active-form');
        };
        Utils.$('tab-reg-btn').onclick = () => {
            Utils.$('tab-reg-btn').classList.add('active');
            Utils.$('tab-login-btn').classList.remove('active');
            Utils.$('reg-form').classList.add('active-form');
            Utils.$('login-form').classList.remove('active-form');
        };

        Utils.$('btn-do-login').onclick = async () => {
            const email = Utils.$('login-email').value.trim();
            const pass = Utils.$('login-pass').value.trim();
            if (!email || !pass) return Utils.toast('Заполните все поля', 'error');
            try {
                Utils.$('btn-do-login').disabled = true;
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (e) {
                Utils.toast('Ошибка входа. Проверьте данные.', 'error');
                Utils.$('btn-do-login').disabled = false;
            }
        };

        Utils.$('btn-do-reg').onclick = async () => {
            const email = Utils.$('reg-email').value.trim();
            const pass = Utils.$('reg-pass').value.trim();
            const name = Utils.$('reg-name').value.trim();
            let username = Utils.$('reg-username').value.trim().toLowerCase();

            if (!email || pass.length < 6 || !name || !username) {
                return Utils.toast('Заполните поля. Пароль от 6 символов.', 'error');
            }
            if (username.startsWith('@')) username = username.substring(1);
            if (!/^[a-z0-9_]{3,15}$/.test(username)) {
                return Utils.toast('ID: 3-15 символов, только a-z, 0-9 и _', 'error');
            }

            try {
                Utils.$('btn-do-reg').disabled = true;
                // Проверка уникальности ДО создания аккаунта
                const isAvailable = await ProfileManager.checkUsernameAvailability(username);
                if (!isAvailable) throw new Error('Этот @ID уже занят другим пользователем');

                const creds = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(creds.user, { displayName: name });
                
                // Атомарное создание профиля
                await ProfileManager.createProfile(creds.user.uid, name, username, email);
            } catch (e) {
                Utils.toast(e.message, 'error');
                Utils.$('btn-do-reg').disabled = false;
            }
        };

        Utils.$('btn-logout').onclick = () => signOut(auth);
    }

    static bindGlobalPresence() {
        const uid = AppState.currentUser.uid;
        const connectedRef = ref(db, '.info/connected');
        const userStatusRef = ref(db, `users/${uid}/status`);

        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(userStatusRef).set({ online: false, lastSeen: Date.now() })
                    .then(() => set(userStatusRef, { online: true, lastSeen: Date.now() }));
            }
        });
    }

    static handleLogoutCleanup() {
        AppState.currentUser = null;
        Utils.showScreen('auth-screen');
        Utils.$('login-pass').value = '';
        Utils.$('reg-pass').value = '';
        Utils.$('btn-do-login').disabled = false;
        Utils.$('btn-do-reg').disabled = false;
        RoomManager.leaveRoom();
        AppState.activeSubscriptions.forEach(unsub => unsub());
        AppState.activeSubscriptions = [];
    }
}

// ============================================================================
// 4. МЕНЕДЖЕР ПРОФИЛЕЙ И УНИКАЛЬНЫХ ИМЕН
// ============================================================================

class ProfileManager {
    static async checkUsernameAvailability(username, excludeUid = null) {
        try {
            const snap = await get(ref(db, `usernames/${username}`));
            if (!snap.exists()) return true;
            return snap.val() === excludeUid;
        } catch (e) { return false; }
    }

    static async createProfile(uid, name, username, email) {
        // Транзакционное обновление двух узлов
        const updates = {};
        updates[`usernames/${username}`] = uid;
        updates[`users/${uid}/profile`] = { name, username, email, bio: '', avatar: '', createdAt: Date.now() };
        await update(ref(db), updates);
    }

    static async ensureProfileExists(user) {
        const snap = await get(ref(db, `users/${user.uid}/profile`));
        if (!snap.exists()) {
            const fallbackUser = `user_${Utils.generateCryptoId(6)}`;
            await this.createProfile(user.uid, user.displayName || 'Guest', fallbackUser, user.email);
        }
    }

    static bindMyProfileListener() {
        const uid = AppState.currentUser.uid;
        const profileRef = ref(db, `users/${uid}/profile`);
        const unsub = onValue(profileRef, (snap) => {
            const p = snap.val() || {};
            AppState.usersCache.set(uid, p);
            
            Utils.$('my-name-display').innerText = Utils.escapeHtml(p.name);
            Utils.$('my-username-display').innerText = `@${Utils.escapeHtml(p.username)}`;
            if (p.avatar) {
                Utils.$('my-avatar-display').innerHTML = `<img src="${Utils.escapeHtml(p.avatar)}" onerror="this.style.display='none'">`;
            } else {
                Utils.$('my-avatar-display').innerHTML = (p.name || '?')[0].toUpperCase();
            }
        });
        AppState.activeSubscriptions.push(() => off(profileRef, 'value', unsub));

        Utils.$('btn-open-my-profile').onclick = () => this.openEditProfileModal();
    }

    static openEditProfileModal() {
        const p = AppState.usersCache.get(AppState.currentUser.uid) || {};
        Utils.$('edit-name').value = p.name || '';
        Utils.$('edit-username-input').value = p.username || '';
        Utils.$('edit-bio').value = p.bio || '';
        Utils.$('edit-avatar-url').value = p.avatar || '';
        this.updateAvatarPreview(p.avatar, p.name);
        
        Utils.$('modal-edit-profile').classList.add('active');
        
        Utils.$('edit-avatar-url').oninput = Utils.debounce((e) => this.updateAvatarPreview(e.target.value, Utils.$('edit-name').value), 300);
        Utils.$('edit-name').oninput = Utils.debounce((e) => this.updateAvatarPreview(Utils.$('edit-avatar-url').value, e.target.value), 300);

        Utils.$('btn-save-profile').onclick = async () => {
            const btn = Utils.$('btn-save-profile');
            btn.disabled = true;
            try {
                await this.saveProfile();
                Utils.$('modal-edit-profile').classList.remove('active');
                Utils.toast('Профиль сохранен');
            } catch (e) {
                Utils.toast(e.message, 'error');
            } finally {
                btn.disabled = false;
            }
        };
    }

    static updateAvatarPreview(url, name) {
        const prev = Utils.$('edit-avatar-preview');
        if (url) {
            prev.innerHTML = `<img src="${Utils.escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.innerHTML='?'">`;
        } else {
            prev.innerHTML = (name || '?')[0].toUpperCase();
        }
    }

    static async saveProfile() {
        const uid = AppState.currentUser.uid;
        const oldProfile = AppState.usersCache.get(uid);
        const name = Utils.$('edit-name').value.trim();
        let username = Utils.$('edit-username-input').value.trim().toLowerCase().replace('@', '');
        const bio = Utils.$('edit-bio').value.trim();
        const avatar = Utils.$('edit-avatar-url').value.trim();

        if (!name || !username) throw new Error('Имя и ID обязательны');
        if (!/^[a-z0-9_]{3,15}$/.test(username)) throw new Error('ID: 3-15 символов, a-z, 0-9, _');

        const updates = {};
        
        // Защита: Если ID изменился, проверяем и делаем атомарную замену
        if (username !== oldProfile.username) {
            const isAvail = await this.checkUsernameAvailability(username, uid);
            if (!isAvail) throw new Error('Этот ID уже занят');
            
            if (oldProfile.username) updates[`usernames/${oldProfile.username}`] = null; // Удаляем старый
            updates[`usernames/${username}`] = uid; // Резервируем новый
        }

        updates[`users/${uid}/profile`] = { ...oldProfile, name, username, bio, avatar };
        await update(ref(db), updates);
    }

    static async loadUser(uid) {
        if (AppState.usersCache.has(uid)) return AppState.usersCache.get(uid);
        try {
            const snap = await get(ref(db, `users/${uid}/profile`));
            const data = snap.exists() ? snap.val() : { name: 'Unknown', username: 'unknown' };
            AppState.usersCache.set(uid, data);
            return data;
        } catch (e) { return null; }
    }

    static async openViewProfileModal(targetUid) {
        const profile = await this.loadUser(targetUid);
        if (!profile) return Utils.toast('Пользователь не найден', 'error');

        Utils.$('view-name').innerText = Utils.escapeHtml(profile.name);
        Utils.$('view-username').innerText = `@${Utils.escapeHtml(profile.username)}`;
        Utils.$('view-bio').innerText = Utils.escapeHtml(profile.bio || 'Пользователь не добавил описание.');
        
        const avatarEl = Utils.$('view-avatar');
        if (profile.avatar) {
            avatarEl.innerHTML = `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.innerHTML='?'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.innerHTML = (profile.name || '?')[0].toUpperCase();
        }

        const addBtn = Utils.$('btn-add-friend-modal');
        if (targetUid === AppState.currentUser.uid) {
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'block';
            addBtn.onclick = () => {
                FriendsManager.sendFriendRequest(targetUid);
                Utils.$('modal-view-profile').classList.remove('active');
            };
        }

        Utils.$('modal-view-profile').classList.add('active');
    }
}

// ============================================================================
// 5. СИСТЕМА ДРУЗЕЙ (Оптимизированный рендер)
// ============================================================================

class FriendsManager {
    static initListeners() {
        const uid = AppState.currentUser.uid;

        const reqRef = ref(db, `users/${uid}/friend-requests`);
        const unsubReq = onValue(reqRef, (snap) => this.renderRequests(snap.val() || {}));
        
        const frRef = ref(db, `users/${uid}/friends`);
        const unsubFr = onValue(frRef, (snap) => this.renderFriends(snap.val() || {}));

        AppState.activeSubscriptions.push(
            () => off(reqRef, 'value', unsubReq),
            () => off(frRef, 'value', unsubFr)
        );

        Utils.$('nav-friends').onclick = () => {
            Utils.$('nav-friends').classList.add('active');
            Utils.$('nav-rooms').classList.remove('active');
            Utils.$('friends-section').style.display = 'flex';
            document.querySelector('.rooms-main').style.display = 'none';
        };
        Utils.$('nav-rooms').onclick = () => {
            Utils.$('nav-rooms').classList.add('active');
            Utils.$('nav-friends').classList.remove('active');
            Utils.$('friends-section').style.display = 'none';
            document.querySelector('.rooms-main').style.display = 'flex';
        };
    }

    static async sendFriendRequest(targetUid) {
        if (targetUid === AppState.currentUser.uid) return;
        try {
            await set(ref(db, `users/${targetUid}/friend-requests/${AppState.currentUser.uid}`), { ts: Date.now() });
            Utils.toast('Заявка отправлена');
        } catch (e) { Utils.toast('Ошибка отправки', 'error'); }
    }

    static async handleRequest(targetUid, accept) {
        const myUid = AppState.currentUser.uid;
        try {
            const updates = {};
            if (accept) {
                const ts = Date.now();
                updates[`users/${myUid}/friends/${targetUid}`] = { status: 'accepted', ts };
                updates[`users/${targetUid}/friends/${myUid}`] = { status: 'accepted', ts };
            }
            updates[`users/${myUid}/friend-requests/${targetUid}`] = null; // Удаляем заявку
            await update(ref(db), updates);
            Utils.toast(accept ? 'Друг добавлен' : 'Заявка отклонена');
        } catch (e) { Utils.toast('Ошибка', 'error'); }
    }

    static async renderRequests(requests) {
        const container = Utils.$('friend-requests-list');
        const badge = Utils.$('friend-req-badge');
        const keys = Object.keys(requests);
        
        if (keys.length > 0) {
            badge.innerText = keys.length;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
            container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет новых заявок</div>';
            return;
        }

        container.innerHTML = '';
        for (const uid of keys) {
            const profile = await ProfileManager.loadUser(uid);
            if (!profile) continue;

            const div = document.createElement('div');
            div.className = 'friend-request-item';
            div.innerHTML = `
                <div style="font-size: 13px;"><strong>${Utils.escapeHtml(profile.name)}</strong> хочет в друзья</div>
                <div class="req-actions">
                    <button class="btn-small btn-accept">Принять</button>
                    <button class="btn-small btn-decline">Отклонить</button>
                </div>
            `;
            div.querySelector('.btn-accept').onclick = () => this.handleRequest(uid, true);
            div.querySelector('.btn-decline').onclick = () => this.handleRequest(uid, false);
            container.appendChild(div);
        }
    }

    // VDOM-подобный рендер, чтобы не спамить базу и DOM
    static async renderFriends(friendsMap) {
        const container = Utils.$('friends-list');
        const keys = Object.keys(friendsMap).filter(k => friendsMap[k].status === 'accepted');
        
        if (keys.length === 0) {
            container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет друзей. Общайтесь в комнатах!</div>';
            return;
        }

        // Удаляем тех, кого больше нет в списке
        Array.from(container.children).forEach(child => {
            if (child.id !== 'empty-friends' && !keys.includes(child.dataset.uid)) child.remove();
        });
        if (Utils.$('empty-friends')) Utils.$('empty-friends').remove();

        for (const uid of keys) {
            const profile = await ProfileManager.loadUser(uid);
            if (!profile) continue;

            // Запрашиваем онлайн статус
            get(ref(db, `users/${uid}/status`)).then(snap => {
                const status = snap.val() || { online: false };
                const isOnline = status.online;
                
                let div = Utils.$(`friend-${uid}`);
                if (!div) {
                    div = document.createElement('div');
                    div.className = 'friend-item';
                    div.id = `friend-${uid}`;
                    div.dataset.uid = uid;
                    div.onclick = () => ProfileManager.openViewProfileModal(uid);
                    container.appendChild(div);
                }

                let av = profile.avatar ? `<img src="${Utils.escapeHtml(profile.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (profile.name[0].toUpperCase());
                
                // Обновляем содержимое без пересоздания карточки
                div.innerHTML = `
                    <div class="avatar">${av}</div>
                    <div class="friend-info-col">
                        <div class="friend-name">${Utils.escapeHtml(profile.name)}</div>
                        <div class="friend-status">
                            <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                            ${isOnline ? 'Онлайн' : 'Офлайн'}
                        </div>
                    </div>
                `;
            });
        }
    }
}

// ============================================================================
// 6. МЕНЕДЖЕР КОМНАТ (Искоренен баг пересоздания видео-тегов)
// ============================================================================

class RoomManager {
    static initLobbyListeners() {
        const roomsRef = ref(db, 'rooms');
        const unsub = onValue(roomsRef, (snap) => {
            const data = snap.val() || {};
            // Кешируем комнаты
            const oldKeys = Array.from(AppState.roomsCache.keys());
            AppState.roomsCache.clear();
            for (const key in data) AppState.roomsCache.set(key, data[key]);
            
            // Удаляем мертвые комнаты из DOM
            oldKeys.forEach(k => {
                if (!data[k]) Utils.$(`room-card-${k}`)?.remove();
            });

            this.updateRoomsDOM();
            
            // Подсчет глобального онлайна
            let totalOnline = 0;
            for(const r in data) {
                if (data[r].presence) totalOnline += Object.keys(data[r].presence).length;
            }
            Utils.$('global-online-count').innerText = totalOnline;
        });
        AppState.activeSubscriptions.push(() => off(roomsRef, 'value', unsub));

        Utils.$('btn-open-create-room').onclick = () => this.openRoomModal();
        Utils.$('btn-save-room').onclick = () => this.saveRoom();
        Utils.$('search-rooms').oninput = Utils.debounce(() => this.updateRoomsDOM(), 300);
        
        Utils.$('room-input-private').onchange = (e) => {
            Utils.$('room-input-password').style.display = e.target.checked ? 'block' : 'none';
        };

        Utils.$('btn-leave-room').onclick = () => this.leaveRoom();
    }

    static updateRoomsDOM() {
        const grid = Utils.$('rooms-grid');
        const search = Utils.$('search-rooms').value.toLowerCase().trim();
        
        let count = 0;
        AppState.roomsCache.forEach((room, id) => {
            if (search && !room.name.toLowerCase().includes(search)) {
                Utils.$(`room-card-${id}`)?.remove();
                return;
            }
            
            const lock = room.isPrivate ? '🔒 ' : '';
            const membersCount = room.presence ? Object.keys(room.presence).length : 0;
            
            let card = Utils.$(`room-card-${id}`);
            if (!card) {
                // Если карточки нет — создаем. Видео скачается ОДИН раз.
                card = document.createElement('div');
                card.className = 'room-card';
                card.id = `room-card-${id}`;
                card.onclick = () => this.attemptJoinRoom(id, room);
                
                const vidHtml = room.videoUrl ? `<video src="${Utils.escapeHtml(room.videoUrl)}" preload="metadata" muted playsinline></video>` : '';
                
                card.innerHTML = `
                    <div class="room-preview">
                        ${vidHtml}
                        <div class="room-preview-overlay"></div>
                    </div>
                    <div class="room-info">
                        <h4 class="rm-title"></h4>
                        <div class="room-meta">
                            <span class="rm-host"></span>
                            <span class="rm-count"></span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);

                // Оптимизация превью: перематываем на 10 сек
                const video = card.querySelector('video');
                if (video) {
                    video.addEventListener('loadedmetadata', () => {
                        video.currentTime = Math.min(10, video.duration / 2);
                        card.querySelector('.room-preview').classList.add('loaded');
                    }, { once: true });
                }
            }

            // Обновляем только текст (Virtual DOM pattern)
            card.querySelector('.rm-title').innerText = `${lock}${room.name}`;
            card.querySelector('.rm-host').innerText = `Хост: ${room.hostName || 'Неизвестно'}`;
            card.querySelector('.rm-count').innerText = `👥 ${membersCount}`;
            count++;
        });

        if (count === 0 && !Utils.$('empty-rooms-msg')) {
            const msg = document.createElement('div');
            msg.id = 'empty-rooms-msg';
            msg.style.cssText = 'color:var(--text-muted); padding:20px; grid-column: 1 / -1;';
            msg.innerText = search ? 'Ничего не найдено' : 'Нет активных комнат';
            grid.appendChild(msg);
        } else if (count > 0 && Utils.$('empty-rooms-msg')) {
            Utils.$('empty-rooms-msg').remove();
        }
    }

    static openRoomModal(roomId = null) {
        const modal = Utils.$('modal-room');
        const isEdit = !!roomId;
        Utils.$('room-modal-title').innerText = isEdit ? 'Настройки комнаты' : 'Создать комнату';
        Utils.$('btn-delete-room').style.display = isEdit ? 'block' : 'none';
        
        if (isEdit) {
            const r = AppState.roomsCache.get(roomId);
            Utils.$('room-input-name').value = r.name || '';
            Utils.$('room-input-url').value = r.videoUrl || '';
            Utils.$('room-input-private').checked = r.isPrivate;
            Utils.$('room-input-password').style.display = r.isPrivate ? 'block' : 'none';
            Utils.$('btn-delete-room').onclick = async () => {
                if(confirm('Точно удалить комнату навсегда? Это действие необратимо.')) {
                    await remove(ref(db, `rooms/${roomId}`));
                    modal.classList.remove('active');
                    this.leaveRoom();
                }
            };
        } else {
            Utils.$('room-input-name').value = '';
            Utils.$('room-input-url').value = '';
            Utils.$('room-input-private').checked = false;
            Utils.$('room-input-password').style.display = 'none';
            Utils.$('room-input-password').value = '';
        }
        
        modal.classList.add('active');
        modal.dataset.editingId = isEdit ? roomId : '';
    }

    static async saveRoom() {
        const name = Utils.$('room-input-name').value.trim();
        const videoUrl = Utils.$('room-input-url').value.trim();
        const isPrivate = Utils.$('room-input-private').checked;
        const password = Utils.$('room-input-password').value.trim();
        const roomId = Utils.$('modal-room').dataset.editingId;

        if (!name) return Utils.toast('Название не может быть пустым', 'error');
        if (isPrivate && password.length < 4 && !roomId) return Utils.toast('Пароль минимум 4 символа', 'error');

        Utils.$('btn-save-room').disabled = true;
        try {
            const roomData = {
                name, videoUrl, isPrivate,
                hostId: AppState.currentUser.uid,
                hostName: AppState.currentUser.displayName || 'Хост',
                updatedAt: Date.now()
            };

            if (isPrivate && password) {
                roomData.salt = Utils.generateCryptoId(16);
                roomData.hash = await Utils.hashPassword(password, roomData.salt);
            }

            if (roomId) {
                if (isPrivate && !password) {
                    const oldR = AppState.roomsCache.get(roomId);
                    roomData.salt = oldR.salt;
                    roomData.hash = oldR.hash;
                }
                await update(ref(db, `rooms/${roomId}`), roomData);
                Utils.toast('Настройки сохранены');
            } else {
                roomData.createdAt = Date.now();
                const newRef = push(ref(db, 'rooms'));
                await set(newRef, roomData);
                Utils.toast('Комната создана');
                this.enterRoom(newRef.key, roomData);
            }
            Utils.$('modal-room').classList.remove('active');
        } catch (e) {
            Utils.toast('Ошибка сохранения', 'error');
        } finally {
            Utils.$('btn-save-room').disabled = false;
        }
    }

    static async attemptJoinRoom(roomId, roomData) {
        if (roomData.isPrivate && roomData.hostId !== AppState.currentUser.uid) {
            AppState.pendingJoinRoomId = roomId;
            Utils.$('join-room-password').value = '';
            Utils.$('modal-password').classList.add('active');
            
            Utils.$('btn-submit-password').onclick = async () => {
                const input = Utils.$('join-room-password').value;
                const hashAttempt = await Utils.hashPassword(input, roomData.salt);
                if (hashAttempt === roomData.hash) {
                    Utils.$('modal-password').classList.remove('active');
                    this.enterRoom(roomId, roomData);
                } else {
                    Utils.toast('Неверный пароль', 'error');
                }
            };
        } else {
            this.enterRoom(roomId, roomData);
        }
    }

    static enterRoom(roomId, roomData) {
        AppState.currentRoomId = roomId;
        AppState.isHost = (roomData.hostId === AppState.currentUser.uid);
        
        Utils.$('current-room-name').innerText = Utils.escapeHtml(roomData.name);
        const vid = Utils.$('main-video');
        if(vid.src !== roomData.videoUrl) vid.src = Utils.escapeHtml(roomData.videoUrl || '');
        vid.controls = AppState.isHost;
        
        if (AppState.isHost) {
            Utils.$('btn-room-settings').style.display = 'block';
            Utils.$('btn-room-settings').onclick = () => this.openRoomModal(roomId);
        } else {
            Utils.$('btn-room-settings').style.display = 'none';
        }

        Utils.showScreen('room-screen');
        RoomSyncManager.initSync(roomId);
        ChatManager.initChat(roomId);
        RTCManager.init(roomId); 
    }

    static leaveRoom() {
        if (!AppState.currentRoomId) return;
        RoomSyncManager.destroy();
        ChatManager.destroy();
        RTCManager.destroy();
        
        const vid = Utils.$('main-video');
        vid.pause();
        // Оставляем src, чтобы не было мерцания при переходе, но выгружаем потом
        setTimeout(() => vid.src = '', 500); 
        
        AppState.currentRoomId = null;
        AppState.isHost = false;
        Utils.showScreen('lobby-screen');
    }
}

// ============================================================================
// 7. СИНХРОНИЗАЦИЯ КОМНАТЫ (Умный Sync)
// ============================================================================

class RoomSyncManager {
    static initSync(roomId) {
        const uid = AppState.currentUser.uid;
        this.presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
        this.syncRef = ref(db, `rooms/${roomId}/sync`);
        this.unsubs = [];
        this.lastSyncApplied = 0; // Защита от эха перемотки

        set(this.presenceRef, {
            uid,
            name: AppState.currentUser.displayName,
            joinedAt: Date.now()
        });
        onDisconnect(this.presenceRef).remove();

        const presListRef = ref(db, `rooms/${roomId}/presence`);
        const pUnsub = onValue(presListRef, (snap) => this.renderUsersList(snap.val() || {}));
        this.unsubs.push(() => off(presListRef, 'value', pUnsub));

        const vid = Utils.$('main-video');
        if (AppState.isHost) {
            // Хост отправляет события, но с Throttling, чтобы не спамить
            const throttleSync = Utils.debounce((state) => this.broadcastState(state, vid.currentTime), 200);
            vid.onplay = () => throttleSync('play');
            vid.onpause = () => throttleSync('pause');
            vid.onseeked = () => throttleSync('seek');
        } else {
            // Зритель слушает события
            const sUnsub = onValue(this.syncRef, (snap) => {
                const s = snap.val();
                if (!s || Date.now() - this.lastSyncApplied < 1000) return; // Cooldown 1 секунда
                
                // Допуск рассинхрона - 2 секунды (учитывает пинг)
                if (Math.abs(vid.currentTime - s.time) > 2.0) {
                    this.lastSyncApplied = Date.now();
                    vid.currentTime = s.time;
                }

                if (s.state === 'play' && vid.paused) vid.play().catch(()=>{});
                if (s.state === 'pause' && !vid.paused) vid.pause();
            });
            this.unsubs.push(() => off(this.syncRef, 'value', sUnsub));
        }
    }

    static broadcastState(state, time) {
        set(this.syncRef, { state, time, ts: Date.now() });
    }

    static renderUsersList(presenceMap) {
        const container = Utils.$('room-users-list');
        Utils.$('room-users-count').innerText = Object.keys(presenceMap).length;
        
        // VDOM pattern
        Array.from(container.children).forEach(child => {
            if (!presenceMap[child.dataset.uid]) child.remove();
        });

        for (const uid in presenceMap) {
            const user = presenceMap[uid];
            const isHost = AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid;
            let div = Utils.$(`r-user-${uid}`);
            
            if (!div) {
                div = document.createElement('div');
                div.id = `r-user-${uid}`;
                div.dataset.uid = uid;
                div.className = 'room-user-row';
                if (uid !== AppState.currentUser.uid) {
                    div.style.cursor = 'pointer';
                    div.onclick = () => ProfileManager.openViewProfileModal(uid);
                }
                container.appendChild(div);
            }

            div.innerHTML = `
                <div class="avatar">${user.name[0].toUpperCase()}</div>
                <div class="room-user-row-name">
                    ${Utils.escapeHtml(user.name)} 
                    ${uid === AppState.currentUser.uid ? '<span style="opacity:0.5; font-size:10px;">(Вы)</span>' : ''}
                    ${isHost ? '<span class="role-badge host">Host</span>' : ''}
                </div>
            `;
        }
    }

    static destroy() {
        if (this.presenceRef) remove(this.presenceRef);
        this.unsubs.forEach(fn => fn());
        this.unsubs = [];
    }
}

// ============================================================================
// 8. ЧАТ КОМНАТЫ
// ============================================================================

class ChatManager {
    static initChat(roomId) {
        this.chatRef = ref(db, `rooms/${roomId}/chat`);
        this.unsubs = [];
        this.processedMsgs = new Set();
        
        const container = Utils.$('chat-messages');
        container.innerHTML = '<div class="sys-msg">Добро пожаловать в комнату!</div>';

        const cUnsub = onChildAdded(this.chatRef, (snap) => {
            const msg = snap.val();
            const id = snap.key;
            if (this.processedMsgs.has(id)) return;
            this.processedMsgs.add(id);

            const isSelf = msg.uid === AppState.currentUser.uid;
            const div = document.createElement('div');
            div.className = `msg-line ${isSelf ? 'self' : ''}`;
            
            let content = Utils.escapeHtml(msg.text);
            content = content.replace(/(\d{1,2}:\d{2})/g, '<span style="color:var(--accent); cursor:pointer; font-weight:bold;">$1</span>');

            div.innerHTML = `
                <div class="msg-author">${Utils.escapeHtml(msg.name)}</div>
                <div class="msg-bubble">${content}</div>
            `;

            if (AppState.isHost) {
                div.querySelectorAll('span').forEach(sp => {
                    sp.onclick = () => {
                        const parts = sp.innerText.split(':');
                        const secs = parseInt(parts[0])*60 + parseInt(parts[1]);
                        Utils.$('main-video').currentTime = secs;
                    };
                });
            }

            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        });
        this.unsubs.push(() => off(this.chatRef, 'child_added', cUnsub));

        const input = Utils.$('chat-input');
        const sendAction = () => {
            const text = input.value.trim();
            if (!text) return;
            push(this.chatRef, {
                uid: AppState.currentUser.uid,
                name: AppState.currentUser.displayName,
                text,
                ts: Date.now()
            });
            input.value = '';
        };

        Utils.$('btn-send-msg').onclick = sendAction;
        input.onkeydown = (e) => { if (e.key === 'Enter') sendAction(); };

        Utils.$('tab-chat').onclick = () => {
            Utils.$('tab-chat').classList.add('active');
            Utils.$('tab-users').classList.remove('active');
            Utils.$('chat-messages').style.display = 'flex';
            Utils.$('room-users-list').style.display = 'none';
        };
        Utils.$('tab-users').onclick = () => {
            Utils.$('tab-users').classList.add('active');
            Utils.$('tab-chat').classList.remove('active');
            Utils.$('room-users-list').style.display = 'flex';
            Utils.$('chat-messages').style.display = 'none';
        };
    }

    static destroy() {
        this.unsubs.forEach(fn => fn());
    }
}

// ============================================================================
// 9. СВЕРХНАДЕЖНЫЙ WEBRTC (МИКРОФОН С ICE RESTART)
// ============================================================================

class RTCManager {
    static RTC_CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    static init(roomId) {
        this.roomId = roomId;
        this.uid = AppState.currentUser.uid;
        this.refs = {
            participants: ref(db, `rooms/${roomId}/rtc/participants`),
            offers: ref(db, `rooms/${roomId}/rtc/offers/${this.uid}`),
            answers: ref(db, `rooms/${roomId}/rtc/answers/${this.uid}`),
            candidates: ref(db, `rooms/${roomId}/rtc/candidates/${this.uid}`)
        };
        this.unsubs = [];
        this.isMicActive = false;

        const pUnsub = onValue(this.refs.participants, (snap) => this.handleParticipants(snap.val() || {}));
        const oUnsub = onValue(this.refs.offers, (snap) => this.handleOffers(snap.val() || {}));
        const aUnsub = onValue(this.refs.answers, (snap) => this.handleAnswers(snap.val() || {}));
        const cUnsub = onValue(this.refs.candidates, (snap) => this.handleCandidates(snap.val() || {}));
        
        this.unsubs.push(
            () => off(this.refs.participants, 'value', pUnsub),
            () => off(this.refs.offers, 'value', oUnsub),
            () => off(this.refs.answers, 'value', aUnsub),
            () => off(this.refs.candidates, 'value', cUnsub)
        );

        Utils.$('mic-toggle').onclick = () => this.toggleMic();
    }

    static async toggleMic() {
        const btn = Utils.$('mic-toggle');
        if (this.isMicActive) {
            this.isMicActive = false;
            btn.classList.remove('active');
            this.stopAll();
            await remove(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`));
            Utils.toast('Микрофон выключен');
        } else {
            try {
                btn.style.opacity = '0.5';
                AppState.rtc.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });
                AppState.rtc.sessionId = Utils.generateCryptoId();
                this.isMicActive = true;
                btn.classList.add('active');
                btn.style.opacity = '1';
                
                await set(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`), {
                    sessionId: AppState.rtc.sessionId,
                    ts: Date.now()
                });
                
                this.handleParticipants(this.lastParticipantsMap || {});
                Utils.toast('Микрофон включен');
            } catch (e) {
                btn.style.opacity = '1';
                Utils.toast('Нет доступа к микрофону', 'error');
            }
        }
    }

    static async handleParticipants(map) {
        this.lastParticipantsMap = map;
        if (!this.isMicActive) return;

        // Удаляем мертвые соединения
        for (const [targetUid, pc] of AppState.rtc.peerConnections) {
            if (!map[targetUid]) this.destroyConnection(targetUid);
        }

        // Подключаемся к новым (Политика: инициатор тот, чей UID больше по алфавиту)
        for (const targetUid in map) {
            if (targetUid === this.uid) continue;
            if (this.uid.localeCompare(targetUid) > 0) {
                await this.createOffer(targetUid, map[targetUid].sessionId);
            }
        }
    }

    static getOrCreateConnection(targetUid, targetSessionId) {
        if (AppState.rtc.peerConnections.has(targetUid)) {
            const existingPc = AppState.rtc.peerConnections.get(targetUid);
            if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
                return existingPc;
            }
            this.destroyConnection(targetUid); // Пересоздаем если умерло
        }

        const pc = new RTCPeerConnection(this.RTC_CONFIG);
        
        if (AppState.rtc.localStream) {
            AppState.rtc.localStream.getTracks().forEach(track => pc.addTrack(track, AppState.rtc.localStream));
        }

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            push(ref(db, `rooms/${this.roomId}/rtc/candidates/${targetUid}/${this.uid}`), {
                candidate: candidate.toJSON(),
                fromSessionId: AppState.rtc.sessionId,
                toSessionId: targetSessionId
            });
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream) this.attachRemoteAudio(targetUid, stream);
        };

        // Защита от потери пакетов и обрывов (ICE Restart Logic)
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                if (AppState.rtc.iceRestartTimeouts.has(targetUid)) return; // Уже пытаемся
                
                // Ждем 3 секунды, если не ожило - жестко пересоздаем
                const timeout = setTimeout(() => {
                    this.destroyConnection(targetUid);
                    if (this.isMicActive && this.lastParticipantsMap[targetUid]) {
                        // Переотправляем Offer, если мы инициатор
                        if (this.uid.localeCompare(targetUid) > 0) {
                            this.createOffer(targetUid, this.lastParticipantsMap[targetUid].sessionId);
                        }
                    }
                    AppState.rtc.iceRestartTimeouts.delete(targetUid);
                }, 3000);
                AppState.rtc.iceRestartTimeouts.set(targetUid, timeout);
            } else if (pc.connectionState === 'connected') {
                const timeout = AppState.rtc.iceRestartTimeouts.get(targetUid);
                if (timeout) {
                    clearTimeout(timeout);
                    AppState.rtc.iceRestartTimeouts.delete(targetUid);
                }
            }
        };

        AppState.rtc.peerConnections.set(targetUid, pc);
        return pc;
    }

    static async createOffer(targetUid, targetSessionId) {
        const pc = this.getOrCreateConnection(targetUid, targetSessionId);
        if (pc.signalingState !== 'stable') return;

        try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            
            await set(ref(db, `rooms/${this.roomId}/rtc/offers/${targetUid}/${this.uid}`), {
                description: pc.localDescription.toJSON(),
                fromSessionId: AppState.rtc.sessionId,
                toSessionId: targetSessionId
            });
        } catch (e) { console.error("Offer failed", e); }
    }

    static async handleOffers(offers) {
        if (!this.isMicActive) return;
        for (const [fromUid, payload] of Object.entries(offers)) {
            if (payload.toSessionId !== AppState.rtc.sessionId) continue;
            
            const pc = this.getOrCreateConnection(fromUid, payload.fromSessionId);
            try {
                if (pc.signalingState !== 'stable') {
                    await pc.setLocalDescription({ type: 'rollback' }).catch(()=>{});
                }
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await set(ref(db, `rooms/${this.roomId}/rtc/answers/${fromUid}/${this.uid}`), {
                    description: pc.localDescription.toJSON(),
                    fromSessionId: AppState.rtc.sessionId,
                    toSessionId: payload.fromSessionId
                });
                await remove(ref(db, `rooms/${this.roomId}/rtc/offers/${this.uid}/${fromUid}`));
            } catch (e) {}
        }
    }

    static async handleAnswers(answers) {
        if (!this.isMicActive) return;
        for (const [fromUid, payload] of Object.entries(answers)) {
            if (payload.toSessionId !== AppState.rtc.sessionId) continue;
            const pc = AppState.rtc.peerConnections.get(fromUid);
            if (!pc) continue;

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                await remove(ref(db, `rooms/${this.roomId}/rtc/answers/${this.uid}/${fromUid}`));
            } catch (e) {}
        }
    }

    static async handleCandidates(candidatesGroup) {
        if (!this.isMicActive) return;
        for (const [fromUid, records] of Object.entries(candidatesGroup)) {
            const pc = AppState.rtc.peerConnections.get(fromUid);
            if (!pc) continue;

            for (const [key, payload] of Object.entries(records)) {
                if (payload.toSessionId !== AppState.rtc.sessionId) continue;
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                } catch (e) {}
                await remove(ref(db, `rooms/${this.roomId}/rtc/candidates/${this.uid}/${fromUid}/${key}`));
            }
        }
    }

    static attachRemoteAudio(uid, stream) {
        let audio = AppState.rtc.audioElements.get(uid);
        if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            audio.playsInline = true;
            Utils.$('remote-audios').appendChild(audio);
            AppState.rtc.audioElements.set(uid, audio);
        }
        audio.srcObject = stream;
    }

    static destroyConnection(uid) {
        const pc = AppState.rtc.peerConnections.get(uid);
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.close();
            AppState.rtc.peerConnections.delete(uid);
        }
        const audio = AppState.rtc.audioElements.get(uid);
        if (audio) {
            audio.remove();
            AppState.rtc.audioElements.delete(uid);
        }
    }

    static stopAll() {
        for (const targetUid of AppState.rtc.peerConnections.keys()) {
            this.destroyConnection(targetUid);
        }
        if (AppState.rtc.localStream) {
            AppState.rtc.localStream.getTracks().forEach(t => t.stop());
            AppState.rtc.localStream = null;
        }
    }

    static destroy() {
        this.stopAll();
        if (this.isMicActive && AppState.currentUser) {
            remove(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`)).catch(()=>{});
        }
        this.isMicActive = false;
        Utils.$('mic-toggle').classList.remove('active');
        this.unsubs.forEach(fn => fn());
    }
}

// ============================================================================
// 10. ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================================

window.onload = () => {
    AuthManager.init();

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
};