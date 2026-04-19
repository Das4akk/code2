/**
 * @fileoverview COW Core Engine v3.0 - The Restored Masterpiece
 * @description Восстановлена ПОЛНАЯ рабочая логика комнаты (права, WebRTC, таймкоды, реакции).
 * Строгая валидация уникальных имен. Нейросетевой фон интегрирован в ядро.
 * Внедрена система личных сообщений (DM).
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
    usersCache: new Map(), 
    roomsCache: new Map(),
    activeSubscriptions: [], 
    roomSubscriptions: [], // Отписки именно для комнаты
    currentPresenceCache: {}, // Для прав в комнате
    rtc: {
        localStream: null,
        sessionId: null,
        peerConnections: new Map(), 
        audioElements: new Map(),   
        voiceParticipantsCache: {}
    },
    currentDirectChat: null
};

// ============================================================================
// 2. УТИЛИТЫ И АНИМАЦИИ (Нейросеть)
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
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 10000, hash: 'SHA-256' }, keyMaterial, 256);
        return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    }

    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
}

class BackgroundFX {
    static init() {
        const canvas = Utils.$('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let dots = [];
        let isTabVisible = true;
        let animationId;
        
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize);
        resize();
        
        class Dot {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.1; 
                this.vy = (Math.random() - 0.5) * 0.1;
            }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            draw() {
                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        }
        
        for (let i = 0; i < 60; i++) dots.push(new Dot()); 
        
        function animate() {
            if (!isTabVisible) return; 
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < dots.length; i++) {
                dots[i].update(); dots[i].draw();
                for (let j = i + 1; j < dots.length; j++) {
                    let dx = dots[i].x - dots[j].x;
                    let dy = dots[i].y - dots[j].y;
                    let dist = dx * dx + dy * dy; 
                    if (dist < 20000) { 
                        ctx.strokeStyle = `rgba(255,255,255,${0.15 - Math.sqrt(dist) / 1000})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
                    }
                }
            }
            animationId = requestAnimationFrame(animate);
        }
        animate();

        document.addEventListener("visibilitychange", () => {
            isTabVisible = !document.hidden;
            if (isTabVisible) animate();
            else cancelAnimationFrame(animationId);
        });
    }
}

// ============================================================================
// 3. АВТОРИЗАЦИЯ И СТРОГИЕ ПРОВЕРКИ ПРОФИЛЕЙ
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
                DirectMessages.startNotifications();
                this.bindGlobalPresence();
            } else {
                this.handleLogoutCleanup();
            }
        });

        this.bindUI();
    }

    static bindUI() {
        Utils.$('tab-login-btn').onclick = () => {
            Utils.$('tab-login-btn').classList.add('active'); Utils.$('tab-reg-btn').classList.remove('active');
            Utils.$('login-form').classList.add('active-form'); Utils.$('reg-form').classList.remove('active-form');
        };
        Utils.$('tab-reg-btn').onclick = () => {
            Utils.$('tab-reg-btn').classList.add('active'); Utils.$('tab-login-btn').classList.remove('active');
            Utils.$('reg-form').classList.add('active-form'); Utils.$('login-form').classList.remove('active-form');
        };

        Utils.$('btn-do-login').onclick = async () => {
            const email = Utils.$('login-email').value.trim(); const pass = Utils.$('login-pass').value.trim();
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
            let username = Utils.$('reg-username').value.toLowerCase().trim().replace('@', '');

            if (!email || pass.length < 6 || !name || !username) return Utils.toast('Заполните поля. Пароль от 6 символов.', 'error');
            if (!/^[a-z0-9_]{3,15}$/.test(username)) return Utils.toast('ID: 3-15 символов, только a-z, 0-9 и _', 'error');

            try {
                Utils.$('btn-do-reg').disabled = true;
                
                // Строгая проверка уникальности
                const isAvail = await ProfileManager.checkUsernameAvailability(username);
                if (!isAvail) throw new Error('Этот @ID уже занят другим пользователем!');

                const creds = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(creds.user, { displayName: name });
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
        Utils.$('login-pass').value = ''; Utils.$('reg-pass').value = '';
        Utils.$('btn-do-login').disabled = false; Utils.$('btn-do-reg').disabled = false;
        RoomManager.leaveRoom();
        AppState.activeSubscriptions.forEach(unsub => unsub());
        AppState.activeSubscriptions = [];
    }
}

class ProfileManager {
    static async checkUsernameAvailability(username, excludeUid = null) {
        const cleanName = username.toLowerCase().trim();
        const snap = await get(ref(db, `usernames/${cleanName}`));
        if (!snap.exists()) return true;
        return snap.val() === excludeUid;
    }

    static async createProfile(uid, name, username, email) {
        const cleanName = username.toLowerCase().trim();
        const updates = {};
        updates[`usernames/${cleanName}`] = uid;
        updates[`users/${uid}/profile`] = { name, username: cleanName, email, bio: '', avatar: '', createdAt: Date.now() };
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
                Utils.$('my-avatar-display').innerHTML = `<img src="${Utils.escapeHtml(p.avatar)}" onerror="this.innerHTML='?'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
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
            } catch (e) { Utils.toast(e.message, 'error'); } 
            finally { btn.disabled = false; }
        };
    }

    static updateAvatarPreview(url, name) {
        const prev = Utils.$('edit-avatar-preview');
        if (url) {
            prev.innerHTML = `<img src="${Utils.escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.innerHTML='?'">`;
        } else {
            prev.innerHTML = (name || '?')[0].toUpperCase();
        }
    }

    static async saveProfile() {
        const uid = AppState.currentUser.uid;
        const oldProfile = AppState.usersCache.get(uid);
        const name = Utils.$('edit-name').value.trim();
        let username = Utils.$('edit-username-input').value.toLowerCase().trim().replace('@', '');
        const bio = Utils.$('edit-bio').value.trim();
        const avatar = Utils.$('edit-avatar-url').value.trim();

        if (!name || !username) throw new Error('Имя и ID обязательны');
        if (!/^[a-z0-9_]{3,15}$/.test(username)) throw new Error('ID: 3-15 символов, a-z, 0-9, _');

        const updates = {};
        
        if (username !== oldProfile.username) {
            // Двойная проверка прямо перед записью
            const snap = await get(ref(db, `usernames/${username}`));
            if (snap.exists() && snap.val() !== uid) throw new Error('Этот ID уже занят');
            
            if (oldProfile.username) updates[`usernames/${oldProfile.username}`] = null;
            updates[`usernames/${username}`] = uid;
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

        const dmBtn = Utils.$('btn-dm-modal');
        if (targetUid === AppState.currentUser.uid) {
            dmBtn.style.display = 'none';
        } else {
            dmBtn.style.display = 'block';
            dmBtn.onclick = () => {
                Utils.$('modal-view-profile').classList.remove('active');
                DirectMessages.openChat(targetUid, profile.name);
            };
        }

        Utils.$('modal-view-profile').classList.add('active');
    }
}

// ============================================================================
// 4. СИСТЕМА ДРУЗЕЙ И ЛИЧНЫХ СООБЩЕНИЙ
// ============================================================================

class FriendsManager {
    static initListeners() {
        const uid = AppState.currentUser.uid;
        const reqRef = ref(db, `users/${uid}/friend-requests`);
        const unsubReq = onValue(reqRef, (snap) => this.renderRequests(snap.val() || {}));
        
        const frRef = ref(db, `users/${uid}/friends`);
        const unsubFr = onValue(frRef, (snap) => this.renderFriends(snap.val() || {}));

        AppState.activeSubscriptions.push(() => off(reqRef, 'value', unsubReq), () => off(frRef, 'value', unsubFr));

        Utils.$('nav-friends').onclick = () => {
            Utils.$('nav-friends').classList.add('active'); Utils.$('nav-rooms').classList.remove('active');
            Utils.$('friends-section').style.display = 'flex'; document.querySelector('.rooms-main').style.display = 'none';
        };
        Utils.$('nav-rooms').onclick = () => {
            Utils.$('nav-rooms').classList.add('active'); Utils.$('nav-friends').classList.remove('active');
            Utils.$('friends-section').style.display = 'none'; document.querySelector('.rooms-main').style.display = 'flex';
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
            updates[`users/${myUid}/friend-requests/${targetUid}`] = null;
            await update(ref(db), updates);
            Utils.toast(accept ? 'Друг добавлен' : 'Заявка отклонена');
        } catch (e) { Utils.toast('Ошибка', 'error'); }
    }

    static async renderRequests(requests) {
        const container = Utils.$('friend-requests-list');
        const badge = Utils.$('friend-req-badge');
        const keys = Object.keys(requests);
        
        if (keys.length > 0) {
            badge.innerText = keys.length; badge.classList.add('show');
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

    static async renderFriends(friendsMap) {
        const container = Utils.$('friends-list');
        const keys = Object.keys(friendsMap).filter(k => friendsMap[k].status === 'accepted');
        
        if (keys.length === 0) {
            container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет друзей. Общайтесь в комнатах!</div>';
            return;
        }

        Array.from(container.children).forEach(child => {
            if (!keys.includes(child.dataset.uid)) child.remove();
        });

        for (const uid of keys) {
            const profile = await ProfileManager.loadUser(uid);
            if (!profile) continue;

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

class DirectMessages {
    static getChatId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

    static startNotifications() {
        if (!AppState.currentUser) return;
        const dmRoot = ref(db, 'direct-messages');
        const unsub = onValue(dmRoot, (snap) => {
            const chats = snap.val() || {};
            Object.entries(chats).forEach(([chatId, chat]) => {
                if (!chat?.participants?.[AppState.currentUser.uid] || !chat.lastMessage) return;
                
                const marker = `dmSeen:${chatId}`;
                const seenTs = Number(sessionStorage.getItem(marker) || '0');
                const lastTs = Number(chat.lastMessage.ts || 0);
                
                if (lastTs <= seenTs || chat.lastMessage.fromUid === AppState.currentUser.uid) return;
                if (AppState.currentDirectChat?.id === chatId) return; // Мы уже в этом чате
                
                sessionStorage.setItem(marker, String(lastTs));
                Utils.toast(`ЛС от ${chat.lastMessage.fromName}: ${chat.lastMessage.text}`);
            });
        });
        AppState.activeSubscriptions.push(() => off(dmRoot, 'value', unsub));
    }

    static openChat(targetUid, targetName) {
        if (this.unsubCurrent) this.unsubCurrent();
        const chatId = this.getChatId(AppState.currentUser.uid, targetUid);
        AppState.currentDirectChat = { uid: targetUid, name: targetName, id: chatId };
        
        Utils.$('dm-chat-title').innerText = `Чат: ${targetName}`;
        Utils.$('modal-dm-chat').classList.add('active');

        const chatRef = ref(db, `direct-messages/${chatId}`);
        this.unsubCurrent = onValue(chatRef, (snap) => {
            const data = snap.val() || {};
            const messages = Object.entries(data.messages || {}).map(([id, val]) => ({ id, ...val })).sort((a,b)=>a.ts - b.ts);
            this.renderMessages(messages);
            if (data.lastMessage?.ts) sessionStorage.setItem(`dmSeen:${chatId}`, String(data.lastMessage.ts));
        });

        const sendBtn = Utils.$('btn-dm-send');
        const input = Utils.$('dm-input');
        
        const sendAction = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            const payload = { fromUid: AppState.currentUser.uid, fromName: AppState.currentUser.displayName, text, ts: Date.now() };
            
            await update(ref(db, `direct-messages/${chatId}`), {
                participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
                updatedAt: payload.ts, lastMessage: payload
            });
            await push(ref(db, `direct-messages/${chatId}/messages`), payload);
        };

        sendBtn.onclick = sendAction;
        input.onkeydown = (e) => { if(e.key === 'Enter') sendAction(); };
        
        Utils.$('modal-dm-chat').querySelector('.btn-close-modal').onclick = () => {
            if (this.unsubCurrent) { this.unsubCurrent(); this.unsubCurrent = null; }
            AppState.currentDirectChat = null;
            Utils.$('modal-dm-chat').classList.remove('active');
        };
    }

    static renderMessages(messages) {
        const list = Utils.$('dm-messages');
        if (!messages.length) { list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>'; return; }
        
        list.innerHTML = messages.map(m => {
            const isSelf = m.fromUid === AppState.currentUser.uid;
            return `
                <div class="m-line ${isSelf ? 'self' : ''}">
                    <strong>${Utils.escapeHtml(isSelf ? 'Вы' : m.fromName)}</strong>
                    <div class="bubble">${Utils.escapeHtml(m.text)}</div>
                </div>
            `;
        }).join('');
        list.scrollTop = list.scrollHeight;
    }
}

// ============================================================================
// 5. ПОЛНАЯ СИСТЕМА КОМНАТ И ПРАВ (Restored Masterpiece)
// ============================================================================

class RoomManager {
    static initLobbyListeners() {
        const roomsRef = ref(db, 'rooms');
        const unsub = onValue(roomsRef, (snap) => {
            const data = snap.val() || {};
            const oldKeys = Array.from(AppState.roomsCache.keys());
            AppState.roomsCache.clear();
            for (const key in data) AppState.roomsCache.set(key, data[key]);
            oldKeys.forEach(k => { if (!data[k]) Utils.$(`room-card-${k}`)?.remove(); });
            this.updateRoomsDOM();
            
            let totalOnline = 0;
            for(const r in data) { if (data[r].presence) totalOnline += Object.keys(data[r].presence).length; }
            Utils.$('global-online-count').innerText = totalOnline;
        });
        AppState.activeSubscriptions.push(() => off(roomsRef, 'value', unsub));

        Utils.$('btn-open-create-room').onclick = () => this.openRoomModal();
        Utils.$('btn-save-room').onclick = () => this.saveRoom();
        Utils.$('search-rooms').oninput = Utils.debounce(() => this.updateRoomsDOM(), 300);
        
        Utils.$('room-input-private').onchange = (e) => { Utils.$('room-input-password').style.display = e.target.checked ? 'block' : 'none'; };
        Utils.$('btn-leave-room').onclick = () => this.leaveRoom();
    }

    static updateRoomsDOM() {
        const grid = Utils.$('rooms-grid');
        const search = Utils.$('search-rooms').value.toLowerCase().trim();
        let count = 0;
        
        AppState.roomsCache.forEach((room, id) => {
            if (search && !room.name.toLowerCase().includes(search)) {
                Utils.$(`room-card-${id}`)?.remove(); return;
            }
            
            const lock = room.isPrivate ? '🔒 ' : '';
            const membersCount = room.presence ? Object.keys(room.presence).length : 0;
            let card = Utils.$(`room-card-${id}`);
            
            if (!card) {
                card = document.createElement('div'); card.className = 'room-card'; card.id = `room-card-${id}`;
                card.onclick = () => this.attemptJoinRoom(id, room);
                const vidHtml = room.videoUrl ? `<video src="${Utils.escapeHtml(room.videoUrl)}" preload="metadata" muted playsinline></video>` : '';
                card.innerHTML = `
                    <div class="room-preview">${vidHtml}<div class="room-preview-overlay"></div></div>
                    <div class="room-info"><h4 class="rm-title"></h4><div class="room-meta"><span class="rm-host"></span><span class="rm-count"></span></div></div>
                `;
                grid.appendChild(card);
                const video = card.querySelector('video');
                if (video) { video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(10, video.duration / 2); card.querySelector('.room-preview').classList.add('loaded'); }, { once: true }); }
            }
            card.querySelector('.rm-title').innerText = `${lock}${room.name}`;
            card.querySelector('.rm-host').innerText = `Хост: ${room.hostName || 'Неизвестно'}`;
            card.querySelector('.rm-count').innerText = `👥 ${membersCount}`;
            count++;
        });

        if (count === 0 && !Utils.$('empty-rooms-msg')) {
            const msg = document.createElement('div'); msg.id = 'empty-rooms-msg'; msg.style.cssText = 'color:var(--text-muted); padding:20px; grid-column: 1 / -1;';
            msg.innerText = search ? 'Ничего не найдено' : 'Нет активных комнат';
            grid.appendChild(msg);
        } else if (count > 0 && Utils.$('empty-rooms-msg')) Utils.$('empty-rooms-msg').remove();
    }

    static openRoomModal(roomId = null) {
        const modal = Utils.$('modal-room');
        const isEdit = !!roomId;
        Utils.$('room-modal-title').innerText = isEdit ? 'Настройки комнаты' : 'Создать комнату';
        Utils.$('btn-delete-room').style.display = isEdit ? 'block' : 'none';
        
        if (isEdit) {
            const r = AppState.roomsCache.get(roomId);
            Utils.$('room-input-name').value = r.name || ''; Utils.$('room-input-url').value = r.videoUrl || '';
            Utils.$('room-input-private').checked = r.isPrivate; Utils.$('room-input-password').style.display = r.isPrivate ? 'block' : 'none';
            Utils.$('btn-delete-room').onclick = async () => {
                if(confirm('Точно удалить комнату навсегда?')) {
                    await remove(ref(db, `rooms/${roomId}`)); modal.classList.remove('active'); this.leaveRoom();
                }
            };
        } else {
            Utils.$('room-input-name').value = ''; Utils.$('room-input-url').value = '';
            Utils.$('room-input-private').checked = false; Utils.$('room-input-password').style.display = 'none'; Utils.$('room-input-password').value = '';
        }
        modal.classList.add('active'); modal.dataset.editingId = isEdit ? roomId : '';
    }

    static async saveRoom() {
        const name = Utils.$('room-input-name').value.trim(); const videoUrl = Utils.$('room-input-url').value.trim();
        const isPrivate = Utils.$('room-input-private').checked; const password = Utils.$('room-input-password').value.trim();
        const roomId = Utils.$('modal-room').dataset.editingId;

        if (!name) return Utils.toast('Название не может быть пустым', 'error');
        if (isPrivate && password.length < 4 && !roomId) return Utils.toast('Пароль минимум 4 символа', 'error');

        Utils.$('btn-save-room').disabled = true;
        try {
            const roomData = { name, videoUrl, isPrivate, hostId: AppState.currentUser.uid, hostName: AppState.currentUser.displayName || 'Хост', updatedAt: Date.now() };
            if (isPrivate && password) { roomData.salt = Utils.generateCryptoId(16); roomData.hash = await Utils.hashPassword(password, roomData.salt); }

            if (roomId) {
                if (isPrivate && !password) { const oldR = AppState.roomsCache.get(roomId); roomData.salt = oldR.salt; roomData.hash = oldR.hash; }
                await update(ref(db, `rooms/${roomId}`), roomData); Utils.toast('Настройки сохранены');
            } else {
                roomData.createdAt = Date.now(); const newRef = push(ref(db, 'rooms')); await set(newRef, roomData); Utils.toast('Комната создана');
                this.enterRoomFinal(newRef.key, roomData);
            }
            Utils.$('modal-room').classList.remove('active');
        } catch (e) { Utils.toast('Ошибка сохранения', 'error'); } 
        finally { Utils.$('btn-save-room').disabled = false; }
    }

    static async attemptJoinRoom(roomId, roomData) {
        if (roomData.isPrivate && roomData.hostId !== AppState.currentUser.uid) {
            AppState.pendingJoinRoomId = roomId; Utils.$('join-room-password').value = ''; Utils.$('modal-password').classList.add('active');
            Utils.$('btn-submit-password').onclick = async () => {
                const input = Utils.$('join-room-password').value;
                const hashAttempt = await Utils.hashPassword(input, roomData.salt);
                if (hashAttempt === roomData.hash) { Utils.$('modal-password').classList.remove('active'); this.enterRoomFinal(roomId, roomData); } 
                else Utils.toast('Неверный пароль', 'error');
            };
        } else {
            this.enterRoomFinal(roomId, roomData);
        }
    }

    // ВОССТАНОВЛЕННАЯ ЛОГИКА ИЗ ОРИГИНАЛА
    static enterRoomFinal(roomId, roomData) {
        AppState.currentRoomId = roomId;
        AppState.isHost = (roomData.hostId === AppState.currentUser.uid);
        AppState.roomSubscriptions.forEach(fn => fn()); AppState.roomSubscriptions = [];
        
        Utils.$('room-title-text').innerText = Utils.escapeHtml(roomData.name);
        const vid = Utils.$('native-player');
        if(vid.src !== roomData.videoUrl) vid.src = Utils.escapeHtml(roomData.videoUrl || '');
        vid.controls = AppState.isHost; // Base fallback, will be updated by perms
        
        Utils.$('btn-room-settings').style.display = AppState.isHost ? 'block' : 'none';
        if (AppState.isHost) Utils.$('btn-room-settings').onclick = () => this.openRoomModal(roomId);

        Utils.showScreen('room-screen');
        Utils.$('chat-messages').innerHTML = '<div class="sys-msg">Вы вошли в комнату</div>';
        
        this.initRoomServicesFinal(roomId);
        RTCManager.init(roomId); 
    }

    static getDefaultPerms() { return { chat: true, voice: true, player: AppState.isHost, reactions: true }; }

    static initRoomServicesFinal(roomId) {
        const uid = AppState.currentUser.uid;
        const presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
        const presListRef = ref(db, `rooms/${roomId}/presence`);
        const syncRef = ref(db, `rooms/${roomId}/sync`);
        const chatRef = ref(db, `rooms/${roomId}/chat`);
        const reactionsRef = ref(db, `rooms/${roomId}/reactions`);

        // 1. Presence
        set(presenceRef, { uid, name: AppState.currentUser.displayName, perms: this.getDefaultPerms() });
        onDisconnect(presenceRef).remove();

        const pUnsub = onValue(presListRef, (snap) => {
            AppState.currentPresenceCache = snap.val() || {};
            this.rerenderUsersList();
            this.applyLocalPermissions();
        });
        AppState.roomSubscriptions.push(() => off(presListRef, 'value', pUnsub), () => remove(presenceRef));

        // 2. Video Sync
        const vid = Utils.$('native-player');
        let isRemoteSeek = false;
        if (vid) {
            vid.onplay = () => { if(!isRemoteSeek && this.hasPerm('player')) set(syncRef, { type: 'play', time: vid.currentTime, ts: Date.now() }); };
            vid.onpause = () => { if(!isRemoteSeek && this.hasPerm('player')) set(syncRef, { type: 'pause', time: vid.currentTime, ts: Date.now() }); };
            vid.onseeked = () => { if(!isRemoteSeek && this.hasPerm('player')) set(syncRef, { type: 'seek', time: vid.currentTime, ts: Date.now() }); };
        }

        const sUnsub = onValue(syncRef, (snap) => {
            const d = snap.val();
            if (!d || !vid) return;
            if (Date.now() - d.ts > 2000) return; // Stale

            if (Math.abs(vid.currentTime - d.time) > 1.0) {
                isRemoteSeek = true;
                vid.currentTime = d.time;
                setTimeout(() => isRemoteSeek = false, 300);
            }
            if (d.type === 'play' && vid.paused) vid.play().catch(()=>{});
            if (d.type === 'pause' && !vid.paused) vid.pause();
        });
        AppState.roomSubscriptions.push(() => off(syncRef, 'value', sUnsub));

        // 3. Chat & Timecodes
        let processedMsgs = new Set();
        const cUnsub = onChildAdded(chatRef, (snap) => {
            const msg = snap.val(); const id = snap.key;
            if (processedMsgs.has(id)) return;
            processedMsgs.add(id);

            const isMe = msg.uid === uid;
            const line = document.createElement('div');
            line.className = `m-line ${isMe ? 'self' : ''}`;
            
            let content = Utils.escapeHtml(msg.text);
            content = content.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn" data-time="$1">$1</span>');

            line.innerHTML = `<strong>${Utils.escapeHtml(msg.name)}</strong><div class="bubble">${content}</div>`;
            
            // Timecode click logic
            line.querySelectorAll('.timecode-btn').forEach(btn => {
                btn.onclick = () => {
                    if (!this.hasPerm('player')) return Utils.toast('Нет прав на управление плеером', 'error');
                    const parts = btn.dataset.time.split(':');
                    const secs = parseInt(parts[0])*60 + parseInt(parts[1]);
                    isRemoteSeek = true;
                    vid.currentTime = secs;
                    vid.play().catch(()=>{});
                    setTimeout(() => isRemoteSeek = false, 300);
                    set(syncRef, { type: 'seek', time: secs, ts: Date.now() });
                };
            });

            Utils.$('chat-messages').appendChild(line);
            Utils.$('chat-messages').scrollTop = Utils.$('chat-messages').scrollHeight;
        });
        AppState.roomSubscriptions.push(() => off(chatRef, 'child_added', cUnsub));

        Utils.$('send-btn').onclick = () => {
            const input = Utils.$('chat-input');
            if (!input.value.trim() || !this.hasPerm('chat')) return;
            push(chatRef, { uid, name: AppState.currentUser.displayName, text: input.value.trim(), ts: Date.now() });
            input.value = '';
        };
        Utils.$('chat-input').onkeydown = (e) => { if(e.key==='Enter') Utils.$('send-btn').click(); };

        // 4. Reactions
        document.querySelectorAll('.react-btn').forEach(btn => {
            btn.onclick = () => {
                if(!this.hasPerm('reactions')) return;
                push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
            };
        });
        const rUnsub = onChildAdded(reactionsRef, (snap) => {
            const rx = snap.val();
            if (Date.now() - rx.ts > 5000) return;
            const el = document.createElement('div');
            el.className = 'floating-emoji';
            el.innerText = rx.emoji;
            el.style.left = `${Math.random() * 80 + 10}%`;
            Utils.$('reaction-layer').appendChild(el);
            setTimeout(() => el.remove(), 3000);
        });
        AppState.roomSubscriptions.push(() => off(reactionsRef, 'child_added', rUnsub));

        // Tabs
        Utils.$('tab-chat-btn').onclick = () => {
            Utils.$('tab-chat-btn').classList.add('active'); Utils.$('tab-users-btn').classList.remove('active');
            Utils.$('chat-messages').style.display = 'flex'; Utils.$('users-list').style.display = 'none';
        };
        Utils.$('tab-users-btn').onclick = () => {
            Utils.$('tab-users-btn').classList.add('active'); Utils.$('tab-chat-btn').classList.remove('active');
            Utils.$('users-list').style.display = 'flex'; Utils.$('chat-messages').style.display = 'none';
        };
    }

    static hasPerm(permName) {
        if (AppState.isHost) return true;
        const myData = AppState.currentPresenceCache[AppState.currentUser.uid];
        return myData && myData.perms && myData.perms[permName] === true;
    }

    static applyLocalPermissions() {
        const pPlayer = this.hasPerm('player');
        const pChat = this.hasPerm('chat');
        const pVoice = this.hasPerm('voice');
        const pReactions = this.hasPerm('reactions');

        const vid = Utils.$('native-player');
        if (vid) { vid.controls = pPlayer; vid.style.pointerEvents = pPlayer ? 'auto' : 'none'; }
        
        Utils.$('chat-input').disabled = !pChat;
        Utils.$('send-btn').disabled = !pChat;
        Utils.$('mic-btn').disabled = !pVoice;
        
        document.querySelectorAll('.react-btn').forEach(b => b.disabled = !pReactions);
        document.querySelectorAll('.timecode-btn').forEach(b => {
            if (pPlayer) b.classList.remove('disabled'); else b.classList.add('disabled');
        });

        if (!pVoice && RTCManager.isMicActive) RTCManager.toggleMic(true); // Форсированно выключить
    }

    static rerenderUsersList() {
        const container = Utils.$('users-list');
        const cache = AppState.currentPresenceCache;
        const ids = Object.keys(cache);
        Utils.$('users-count').innerText = ids.length;

        container.innerHTML = '';
        ids.forEach(uid => {
            const user = cache[uid];
            const isLocal = uid === AppState.currentUser.uid;
            const isTargetHost = AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid;
            
            let html = `<div class="user-item">`;
            html += `<div class="indicator online"></div>`; 
            html += `<div class="user-main"><span class="user-name">${Utils.escapeHtml(user.name)}</span>`;
            if (isTargetHost) html += `<span class="host-label">Host</span>`;
            if (isLocal) html += `<span class="you-label">(Вы)</span>`;
            html += `</div>`;

            html += `<div class="user-card-actions">`;
            if (!isLocal) {
                html += `<button class="dm-btn" data-uid="${uid}">💬</button>`;
                html += `<button class="add-friend-btn" data-uid="${uid}">+Друг</button>`;
            }
            html += `</div>`;

            // Управление правами (только для хоста над другими)
            if (AppState.isHost && !isLocal) {
                const perms = user.perms || {};
                html += `
                    <div class="perm-controls">
                        <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="chat" ${perms.chat?'checked':''}> Чат</label>
                        <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="voice" ${perms.voice?'checked':''}> Микрофон</label>
                        <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="player" ${perms.player?'checked':''}> Плеер</label>
                        <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="reactions" ${perms.reactions?'checked':''}> Реакции</label>
                    </div>
                `;
            }
            html += `</div>`;
            container.innerHTML += html;
        });

        // Binds
        container.querySelectorAll('.dm-btn').forEach(btn => {
            btn.onclick = () => {
                const name = btn.closest('.user-item').querySelector('.user-name').innerText;
                DirectMessages.openChat(btn.dataset.uid, name);
            };
        });
        container.querySelectorAll('.add-friend-btn').forEach(btn => {
            btn.onclick = () => FriendsManager.sendFriendRequest(btn.dataset.uid);
        });
        container.querySelectorAll('.p-toggle').forEach(t => {
            t.onchange = async (e) => {
                const targetUid = e.target.dataset.uid; const perm = e.target.dataset.p; const val = e.target.checked;
                await set(ref(db, `rooms/${AppState.currentRoomId}/presence/${targetUid}/perms/${perm}`), val);
            };
        });
    }

    static leaveRoom() {
        if (!AppState.currentRoomId) return;
        AppState.roomSubscriptions.forEach(fn => fn());
        AppState.roomSubscriptions = [];
        RTCManager.destroy();
        
        const vid = Utils.$('native-player');
        if(vid) { vid.pause(); vid.src = ''; }
        
        AppState.currentRoomId = null;
        AppState.isHost = false;
        Utils.showScreen('lobby-screen');
    }
}

// ============================================================================
// 6. WEBRTC MESH SYSTEM (Восстановленная надежная версия)
// ============================================================================

class RTCManager {
    static RTC_CONFIG = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
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
        
        this.unsubs.push(() => off(this.refs.participants, 'value', pUnsub), () => off(this.refs.offers, 'value', oUnsub), () => off(this.refs.answers, 'value', aUnsub), () => off(this.refs.candidates, 'value', cUnsub));

        Utils.$('mic-btn').onclick = () => this.toggleMic();
    }

    static async toggleMic(forceOff = false) {
        const btn = Utils.$('mic-btn');
        if (this.isMicActive || forceOff) {
            this.isMicActive = false;
            btn.classList.remove('active');
            this.stopAll();
            await remove(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`));
            if (!forceOff) Utils.toast('Микрофон выключен');
        } else {
            if (!RoomManager.hasPerm('voice')) return Utils.toast('Вам запрещено говорить', 'error');
            try {
                btn.style.opacity = '0.5';
                AppState.rtc.localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                AppState.rtc.sessionId = Utils.generateCryptoId();
                this.isMicActive = true;
                btn.classList.add('active'); btn.style.opacity = '1';
                
                await set(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`), { sessionId: AppState.rtc.sessionId, ts: Date.now() });
                this.handleParticipants(AppState.rtc.voiceParticipantsCache || {});
            } catch (e) {
                btn.style.opacity = '1'; Utils.toast('Нет доступа к микрофону', 'error');
            }
        }
    }

    static async handleParticipants(map) {
        AppState.rtc.voiceParticipantsCache = map;
        if (!this.isMicActive) return;

        for (const [targetUid, pc] of AppState.rtc.peerConnections) {
            if (!map[targetUid]) this.destroyConnection(targetUid);
        }

        for (const targetUid in map) {
            if (targetUid === this.uid) continue;
            if (this.uid.localeCompare(targetUid) > 0) await this.createOffer(targetUid, map[targetUid].sessionId);
        }
    }

    static getOrCreateConnection(targetUid, targetSessionId) {
        if (AppState.rtc.peerConnections.has(targetUid)) {
            const existingPc = AppState.rtc.peerConnections.get(targetUid);
            if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') return existingPc;
            this.destroyConnection(targetUid);
        }

        const pc = new RTCPeerConnection(this.RTC_CONFIG);
        if (AppState.rtc.localStream) AppState.rtc.localStream.getTracks().forEach(track => pc.addTrack(track, AppState.rtc.localStream));

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            push(ref(db, `rooms/${this.roomId}/rtc/candidates/${targetUid}/${this.uid}`), { candidate: candidate.toJSON(), fromSessionId: AppState.rtc.sessionId, toSessionId: targetSessionId });
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream) this.attachRemoteAudio(targetUid, stream);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') this.destroyConnection(targetUid);
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
            await set(ref(db, `rooms/${this.roomId}/rtc/offers/${targetUid}/${this.uid}`), { description: pc.localDescription.toJSON(), fromSessionId: AppState.rtc.sessionId, toSessionId: targetSessionId });
        } catch (e) { }
    }

    static async handleOffers(offers) {
        if (!this.isMicActive) return;
        for (const [fromUid, payload] of Object.entries(offers)) {
            if (payload.toSessionId !== AppState.rtc.sessionId) continue;
            const pc = this.getOrCreateConnection(fromUid, payload.fromSessionId);
            try {
                if (pc.signalingState !== 'stable') await pc.setLocalDescription({ type: 'rollback' }).catch(()=>{});
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
                await set(ref(db, `rooms/${this.roomId}/rtc/answers/${fromUid}/${this.uid}`), { description: pc.localDescription.toJSON(), fromSessionId: AppState.rtc.sessionId, toSessionId: payload.fromSessionId });
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
                try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) {}
                await remove(ref(db, `rooms/${this.roomId}/rtc/candidates/${this.uid}/${fromUid}/${key}`));
            }
        }
    }

    static attachRemoteAudio(uid, stream) {
        let audio = AppState.rtc.audioElements.get(uid);
        if (!audio) {
            audio = document.createElement('audio'); audio.autoplay = true; audio.playsInline = true;
            Utils.$('remote-audio-container').appendChild(audio);
            AppState.rtc.audioElements.set(uid, audio);
        }
        audio.srcObject = stream;
    }

    static destroyConnection(uid) {
        const pc = AppState.rtc.peerConnections.get(uid);
        if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.close(); AppState.rtc.peerConnections.delete(uid); }
        const audio = AppState.rtc.audioElements.get(uid);
        if (audio) { audio.remove(); AppState.rtc.audioElements.delete(uid); }
    }

    static stopAll() {
        for (const targetUid of AppState.rtc.peerConnections.keys()) this.destroyConnection(targetUid);
        if (AppState.rtc.localStream) { AppState.rtc.localStream.getTracks().forEach(t => t.stop()); AppState.rtc.localStream = null; }
    }

    static destroy() {
        this.stopAll();
        if (this.isMicActive && AppState.currentUser && this.roomId) remove(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`)).catch(()=>{});
        this.isMicActive = false;
        Utils.$('mic-btn')?.classList.remove('active');
        this.unsubs.forEach(fn => fn());
    }
}

// ============================================================================
// 10. ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================================

window.onload = () => {
    AuthManager.init();
    BackgroundFX.init();

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