/**
 * @fileoverview COW Core Engine v4.0 - The Ultimate Edition
 * @description Интегрированы все фиксы: MPA-подобная стабильность, обход пароля по инвайтам,
 * улучшенный интерактивный нейрофон, левитация элементов, фикс мобильного скролла,
 * статистика профилей и строгая защита уникальных юзернеймов.
 * + ПАТЧ: Система ролей (Создатель / Модератор) с защитой приоритетов.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, signOut, updateProfile,
    signInWithPopup, GoogleAuthProvider,
    reauthenticateWithCredential, EmailAuthProvider,
    verifyBeforeUpdateEmail
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
    isRegistering: false, 
    usersCache: new Map(), 
    roomsCache: new Map(),
    activeSubscriptions: [], 
    roomSubscriptions: [],
    currentPresenceCache: {},
    rtc: {
        localStream: null,
        sessionId: null,
        peerConnections: new Map(), 
        audioElements: new Map(),   
        voiceParticipantsCache: {}
    },
    currentDirectChat: null,
    usersListRenderToken: 0,
    inviteCooldowns: new Map(),
    admin: {
        settings: {
            roomCreationBlocked: false
        },
        lastAnnouncementId: null
    }
};

// ============================================================================
// 2. УТИЛИТЫ И GUI ФИКСЫ (Инъекция стилей, Анимации, Нейрофон)
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

    static injectFixes() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* Анимация левитации */
            @keyframes levitate {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
            .glass-panel, .room-card, .user-card, .msg-bubble, .friend-item, .toast {
                animation: levitate 6s ease-in-out infinite;
                will-change: transform;
            }
            .room-card { animation-delay: 1s; }
            .user-card { animation-delay: 2s; }
            
            /* Фикс размеров плеера */
            #native-player {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                border-radius: 16px;
                background: #000;
            }
            .video-container {
                min-height: 35vh; /* Мобильный минимум */
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Фикс мобильного скролла и UI */
            @media (max-width: 1024px) {
                .rooms-grid {
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch;
                    max-height: 70vh;
                    padding-bottom: 120px;
                }
                .lobby-layout { display: flex !important; flex-direction: column; overflow-y: auto; }
                .sidebar { position: relative !important; left: 0 !important; width: 100% !important; height: auto !important; padding-top: 10px !important; box-shadow: none !important; border-right: none !important; border-bottom: 1px solid var(--border); }
                .burger-btn { display: none !important; } /* Убираем ползунок */
                .logo { font-size: 32px !important; font-weight: 900; letter-spacing: 2px; background: linear-gradient(90deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 auto; text-align: center; width: 100%; display: block;}
                .mobile-header { justify-content: center !important; }
            }
            
            /* Бело-серый бейдж онлайна в лобби */
            #custom-online-badge {
                background: transparent;
                color: #aaa;
                font-size: 14px;
                font-weight: 600;
                padding: 10px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #custom-online-badge::before {
                content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: #aaa; box-shadow: 0 0 8px rgba(255,255,255,0.5);
            }
            .original-badge { display: none !important; }

            /* ПЛАШКИ РОЛЕЙ */
            .role-badge {
                display: inline-block;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                text-transform: uppercase;
                vertical-align: middle;
                letter-spacing: 0.5px;
            }
            .badge-creator {
                background: rgba(255, 71, 87, 0.15);
                color: #ff4757;
                border: 1px solid rgba(255, 71, 87, 0.4);
                box-shadow: 0 0 8px rgba(255, 71, 87, 0.2);
            }
            .badge-moderator {
                background: rgba(255, 165, 2, 0.15);
                color: #ffa502;
                border: 1px solid rgba(255, 165, 2, 0.4);
                box-shadow: 0 0 8px rgba(255, 165, 2, 0.2);
            }
        `;
        document.head.appendChild(style);

        const originalBadge = document.querySelector('.online-counter-badge');
        if (originalBadge) originalBadge.classList.add('original-badge');

        const roomsMain = document.querySelector('.rooms-main');
        if (roomsMain) {
            const customBadge = document.createElement('div');
            customBadge.id = 'custom-online-badge';
            customBadge.innerHTML = `Сейчас в комнатах - <span id="global-online-count">0</span>`;
            roomsMain.insertBefore(customBadge, roomsMain.firstChild);
        }

        if (!Utils.$('btn-google-login')) {
            const btnLogin = document.createElement('button');
            btnLogin.id = 'btn-google-login';
            btnLogin.className = 'secondary-btn';
            btnLogin.innerHTML = '🌐 Войти через Google';
            btnLogin.style.marginTop = '10px';
            Utils.$('login-form').appendChild(btnLogin);

            const btnReg = document.createElement('button');
            btnReg.id = 'btn-google-reg';
            btnReg.className = 'secondary-btn';
            btnReg.innerHTML = '🌐 Регистрация через Google';
            btnReg.style.marginTop = '10px';
            Utils.$('reg-form').appendChild(btnReg);
        }
    }
}

class BackgroundFX {
    static init() {
        const canvas = Utils.$('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let dots = [];
        let isTabVisible = true;
        let mouse = { x: null, y: null, radius: 150 };
        
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize);
        resize();

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });
        window.addEventListener('mouseout', () => {
            mouse.x = undefined; mouse.y = undefined;
        });
        
        class Dot {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.4; 
                this.vy = (Math.random() - 0.5) * 0.4;
                this.size = Math.random() * 2 + 1;
            }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.radius) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x -= forceDirectionX * force * 2;
                        this.y -= forceDirectionY * force * 2;
                    }
                }
            }
            draw() {
                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        
        for (let i = 0; i < 90; i++) dots.push(new Dot()); 
        
        function animate() {
            if (!isTabVisible) return; 
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < dots.length; i++) {
                dots[i].update(); dots[i].draw();
                for (let j = i + 1; j < dots.length; j++) {
                    let dx = dots[i].x - dots[j].x;
                    let dy = dots[i].y - dots[j].y;
                    let dist = dx * dx + dy * dy; 
                    if (dist < 25000) { 
                        ctx.strokeStyle = `rgba(100, 200, 255, ${0.2 - Math.sqrt(dist) / 1000})`; 
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();

        document.addEventListener("visibilitychange", () => {
            isTabVisible = !document.hidden;
        });
    }
}

// ============================================================================
// 3. АВТОРИЗАЦИЯ И СТРОГИЕ ПРОВЕРКИ ПРОФИЛЕЙ
// ============================================================================

class AuthManager {
    static init() {
        Utils.injectFixes();
        
        Utils.$('auth-screen').style.opacity = '0';
        let isFirstLoad = true;

        onAuthStateChanged(auth, async (user) => {
            if (isFirstLoad) {
                Utils.$('auth-screen').style.opacity = '1';
                isFirstLoad = false;
            }

            if (user) {
                AppState.currentUser = user;
                await AdminPanel.getDeveloperUid();
                Utils.showScreen('lobby-screen');
                if (!AppState.isRegistering) {
                    await ProfileManager.ensureProfileExists(user);
                }
                ProfileManager.bindMyProfileListener();
                FriendsManager.initListeners();
                RoomManager.initLobbyListeners();
                DirectMessages.startNotifications();
                AdminPanel.init();
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
            const agreementAccepted = Utils.$('reg-agreement')?.checked;

            if (!email || pass.length < 6 || !name || !username) return Utils.toast('Заполните поля. Пароль от 6 символов.', 'error');
            if (!agreementAccepted) return Utils.toast('Примите пользовательское соглашение', 'error');
            if (!/^[a-z0-9_]{3,15}$/.test(username)) return Utils.toast('ID: 3-15 символов, только a-z, 0-9 и _', 'error');

            try {
                Utils.$('btn-do-reg').disabled = true;
                
                const isAvail = await ProfileManager.checkUsernameAvailability(username);
                if (!isAvail) throw new Error('Этот @ID уже занят другим пользователем!');

                AppState.isRegistering = true;
                const creds = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(creds.user, { displayName: name });
                await ProfileManager.createProfile(creds.user.uid, name, username, email, {
                    provider: 'email',
                    emailVerified: false
                });
                AppState.isRegistering = false;
            } catch (e) {
                AppState.isRegistering = false;
                Utils.toast(e.message, 'error');
                Utils.$('btn-do-reg').disabled = false;
            }
        };

        const handleGoogleAuth = async () => {
            try {
                const result = await signInWithPopup(auth, new GoogleAuthProvider());
                const snap = await get(ref(db, `users/${result.user.uid}/profile`));
                if (!snap.exists()) {
                    AppState.isRegistering = true;
                    const baseName = result.user.displayName || 'GoogleUser';
                    const rand = Utils.generateCryptoId(4);
                    await ProfileManager.createProfile(result.user.uid, baseName, `user_${rand}`, result.user.email, {
                        provider: 'google',
                        emailVerified: Boolean(result.user.emailVerified)
                    });
                    AppState.isRegistering = false;
                }
            } catch (e) { Utils.toast('Ошибка входа через Google', 'error'); }
        };

        Utils.$('btn-google-login').onclick = handleGoogleAuth;
        Utils.$('btn-google-reg').onclick = handleGoogleAuth;

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
        AdminPanel.handleLogoutCleanup();
        RoomManager.leaveRoom();
        AppState.activeSubscriptions.forEach(unsub => unsub());
        AppState.activeSubscriptions = [];
    }
}

class ProfileManager {
    static getRoleBadgeHtml(profile, uid = null) {
        if (!profile) return '';
        if (AdminPanel.isCreatorProfile(profile, uid)) return `<span class="role-badge badge-creator">Создатель</span>`;
        if (AdminPanel.isModeratorProfile(profile, uid)) return `<span class="role-badge badge-moderator">Модератор</span>`;
        return '';
    }

    static async checkUsernameAvailability(username, excludeUid = null) {
        const cleanName = username.toLowerCase().trim();
        const developerUid = await AdminPanel.getDeveloperUid();

        if (cleanName === 'developer') {
            if (developerUid) return Boolean(excludeUid && excludeUid === developerUid);

            const developerSnap = await get(ref(db, 'usernames/developer'));
            if (!developerSnap.exists()) return true;
            return developerSnap.val() === excludeUid;
        }

        const snap = await get(ref(db, `usernames/${cleanName}`));
        if (!snap.exists()) return true;
        return snap.val() === excludeUid;
    }

    static async createProfile(uid, name, username, email, security = {}) {
        const cleanName = username.toLowerCase().trim();
        const developerUid = await AdminPanel.getDeveloperUid();
        const isDeveloperProfile = cleanName === 'developer';

        if (isDeveloperProfile && developerUid && developerUid !== uid) {
            throw new Error('ID developer зарезервирован');
        }

        const profileData = {
            name,
            username: cleanName,
            email,
            bio: '',
            avatar: '',
            createdAt: Date.now(),
            provider: security.provider || this.normalizeProvider(auth.currentUser),
            emailVerified: typeof security.emailVerified === 'boolean'
                ? security.emailVerified
                : Boolean(auth.currentUser?.emailVerified)
        };
        if (isDeveloperProfile) profileData.role = 'creator';

        const updates = {};
        updates[`usernames/${cleanName}`] = uid;
        updates[`users/${uid}/profile`] = profileData;
        if (isDeveloperProfile) updates['admin/creatorUid'] = uid;
        await update(ref(db), updates);
    }

    static async ensureProfileExists(user) {
        const snap = await get(ref(db, `users/${user.uid}/profile`));
        if (!snap.exists()) {
            const fallbackUser = `user_${Utils.generateCryptoId(6)}`;
            await this.createProfile(user.uid, user.displayName || 'Guest', fallbackUser, user.email, {
                provider: this.normalizeProvider(user),
                emailVerified: Boolean(user.emailVerified)
            });
        }
    }

    static bindMyProfileListener() {
        const uid = AppState.currentUser.uid;
        const profileRef = ref(db, `users/${uid}/profile`);
        const unsub = onValue(profileRef, (snap) => {
            const p = snap.val() || {};
            AppState.usersCache.set(uid, p);
            this.syncProfileSecurityFields(uid, p);
            AdminPanel.hydrateDeveloperUidFromProfile(uid, p);
            
            const badgeHtml = this.getRoleBadgeHtml(p, uid);
            Utils.$('my-name-display').innerHTML = `${Utils.escapeHtml(p.name)} ${badgeHtml}`;
            Utils.$('my-username-display').innerText = `@${Utils.escapeHtml(p.username)}`;
            if (p.avatar) {
                Utils.$('my-avatar-display').innerHTML = `<img src="${Utils.escapeHtml(p.avatar)}" onerror="this.innerHTML='?'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                Utils.$('my-avatar-display').innerHTML = (p.name || '?')[0].toUpperCase();
            }

            RoomManager.syncDeveloperControls(p);
        });
        AppState.activeSubscriptions.push(() => off(profileRef, 'value', unsub));

        Utils.$('btn-open-my-profile').onclick = () => this.openEditProfileModal();
        Utils.$('btn-profile-menu').onclick = (e) => {
            e.stopPropagation();
            this.toggleProfileMenu();
        };
        Utils.$('btn-open-security').onclick = () => this.openSecurityModal();
        document.addEventListener('click', () => {
            Utils.$('profile-menu-dropdown')?.classList.remove('active');
        });
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

    static normalizeProvider(user = null) {
        const authUser = user || auth.currentUser;
        const providerId = authUser?.providerData?.[0]?.providerId || authUser?.providerId || '';
        if (providerId === 'password') return 'email';
        if (providerId === 'google.com') return 'google';
        return providerId || 'email';
    }

    static getCurrentAuthSecurity() {
        const user = auth.currentUser;
        return {
            email: user?.email || '',
            provider: this.normalizeProvider(user),
            emailVerified: Boolean(user?.emailVerified)
        };
    }

    static syncProfileSecurityFields(uid, profile = {}) {
        const authSecurity = this.getCurrentAuthSecurity();
        const needsSync = (
            typeof profile.provider === 'undefined' ||
            typeof profile.emailVerified === 'undefined' ||
            (!profile.email && authSecurity.email) ||
            (profile.email && authSecurity.email && profile.email !== authSecurity.email) ||
            (typeof profile.emailVerified === 'boolean' && profile.emailVerified !== authSecurity.emailVerified)
        );
        if (!needsSync) return;
        update(ref(db, `users/${uid}/profile`), {
            email: authSecurity.email || profile.email || '',
            provider: profile.provider || authSecurity.provider,
            emailVerified: authSecurity.emailVerified
        }).catch(() => {});
    }

    static toggleProfileMenu() {
        Utils.$('profile-menu-dropdown')?.classList.toggle('active');
    }

    static openSecurityModal() {
        Utils.$('profile-menu-dropdown')?.classList.remove('active');
        this.renderSecurityModal();
        Utils.$('modal-security').classList.add('active');
    }

    static renderSecurityModal() {
        const p = AppState.usersCache.get(AppState.currentUser.uid) || {};
        const authSecurity = this.getCurrentAuthSecurity();
        const provider = p.provider || authSecurity.provider;
        const email = p.email || authSecurity.email;
        const emailVerified = typeof p.emailVerified === 'boolean' ? p.emailVerified : authSecurity.emailVerified;

        const emailBox = Utils.$('security-email-box');
        const note = Utils.$('security-verified-note');
        const actionBtn = Utils.$('btn-security-email-action');
        const emailInput = Utils.$('security-email-input');
        const passwordInput = Utils.$('security-password-input');

        if (provider === 'google') {
            emailBox.innerText = 'Вы не указали почту';
            actionBtn.innerText = 'Указать email';
            passwordInput.style.display = 'none';
        } else {
            emailBox.innerText = email || 'Email не указан';
            actionBtn.innerText = 'Изменить почту';
            passwordInput.style.display = 'block';
        }

        note.innerText = `Почта подтверждена: ${emailVerified ? 'Да' : 'Нет'}`;
        emailInput.value = email || '';
        passwordInput.value = '';

        actionBtn.onclick = async () => {
            const btn = Utils.$('btn-security-email-action');
            btn.disabled = true;
            try {
                await this.saveSecurityEmail({
                    provider,
                    newEmail: emailInput.value.trim(),
                    currentPassword: passwordInput.value.trim()
                });
                await auth.currentUser?.reload();
                await update(ref(db, `users/${AppState.currentUser.uid}/profile`), {
                    email: auth.currentUser?.email || emailInput.value.trim(),
                    provider,
                    emailVerified: Boolean(auth.currentUser?.emailVerified)
                });
                const refreshed = AppState.usersCache.get(AppState.currentUser.uid) || {};
                AppState.usersCache.set(AppState.currentUser.uid, {
                    ...refreshed,
                    email: auth.currentUser?.email || emailInput.value.trim(),
                    provider,
                    emailVerified: Boolean(auth.currentUser?.emailVerified)
                });
                this.renderSecurityModal();
                Utils.toast('Письмо для подтверждения отправлено на новый email');
            } catch (e) {
                Utils.toast(this.getSecurityEmailErrorText(e), 'error');
            } finally {
                btn.disabled = false;
            }
        };
    }

    static getSecurityEmailErrorText(error) {
        const code = String(error?.code || '');
        if (code === 'auth/wrong-password') return 'Неверный текущий пароль';
        if (code === 'auth/invalid-email') return 'Некорректный email';
        if (code === 'auth/email-already-in-use') return 'Этот email уже используется';
        if (code === 'auth/requires-recent-login') return 'Повторно войдите в аккаунт и попробуйте снова';
        if (code === 'auth/operation-not-allowed') return 'Смена почты через прямое обновление отключена. Подтвердите новый email по письму';
        return error?.message || 'Ошибка обновления почты';
    }

    static async saveSecurityEmail({ provider, newEmail, currentPassword }) {
        const user = auth.currentUser;
        if (!user) throw new Error('Пользователь не авторизован');
        if (!newEmail) throw new Error('Введите email');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error('Некорректный email');
        if ((user.email || '').toLowerCase() === newEmail.toLowerCase()) throw new Error('Это уже ваш текущий email');

        if (provider === 'email') {
            if (!currentPassword) throw new Error('Введите текущий пароль');
            const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
            await reauthenticateWithCredential(user, credential);
        }

        await verifyBeforeUpdateEmail(user, newEmail);
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

        const developerUid = await AdminPanel.getDeveloperUid();
        const isCreatorProfile = Boolean(
            (developerUid && uid === developerUid) ||
            AdminPanel.isValidCreatorProfile(oldProfile)
        );

        if (isCreatorProfile && username !== oldProfile.username) throw new Error('ID Создателя нельзя изменить');

        const updates = {};
        
        if (username !== oldProfile.username) {
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

        const friendsSnap = await get(ref(db, `users/${targetUid}/friends`));
        const friendsCount = friendsSnap.exists() ? Object.values(friendsSnap.val()).filter(f => f.status === 'accepted').length : 0;
        const joinDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Неизвестно';

        const badgeHtml = this.getRoleBadgeHtml(profile, targetUid);

        Utils.$('view-name').innerHTML = `${Utils.escapeHtml(profile.name)} ${badgeHtml}`;
        Utils.$('view-username').innerText = `@${Utils.escapeHtml(profile.username)}`;
        Utils.$('view-bio').innerHTML = `
            ${Utils.escapeHtml(profile.bio || 'Пользователь не добавил описание.')}<br><br>
            <strong style="color:var(--text-main);">Статистика:</strong><br>
            Друзей: ${friendsCount}<br>
            На платформе с: ${joinDate}
        `;
        
        const avatarEl = Utils.$('view-avatar');
        if (profile.avatar) {
            avatarEl.innerHTML = `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.innerHTML='?'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.innerHTML = (profile.name || '?')[0].toUpperCase();
        }

        const actionBtn = Utils.$('btn-dm-modal');
        if (targetUid === AppState.currentUser.uid) {
            actionBtn.style.display = 'none';
        } else {
            actionBtn.style.display = 'block';
            
            const myFriendsSnap = await get(ref(db, `users/${AppState.currentUser.uid}/friends/${targetUid}`));
            const isFriend = myFriendsSnap.exists() && myFriendsSnap.val().status === 'accepted';
            
            if (isFriend) {
                actionBtn.innerText = 'Написать сообщение';
                actionBtn.onclick = () => {
                    Utils.$('modal-view-profile').classList.remove('active');
                    DirectMessages.openChat(targetUid, profile.name);
                };
            } else {
                actionBtn.innerText = 'Добавить в друзья';
                actionBtn.onclick = () => {
                    FriendsManager.sendFriendRequest(targetUid);
                    Utils.$('modal-view-profile').classList.remove('active');
                };
            }
        }

        Utils.$('modal-view-profile').classList.add('active');
    }
}

// ============================================================================
// 4. СИСТЕМА ДРУЗЕЙ И ЛИЧНЫХ СООБЩЕНИЙ (с Share Room)
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

    static closeChat() {
        if (this.unsubCurrent) {
            this.unsubCurrent();
            this.unsubCurrent = null;
        }
        AppState.currentDirectChat = null;
        const modal = Utils.$('modal-dm-chat');
        if (modal) modal.classList.remove('active');
        if (Utils.$('dm-input')) Utils.$('dm-input').value = '';
        if (Utils.$('dm-messages')) Utils.$('dm-messages').innerHTML = '';
        if (Utils.$('dm-chat-title')) Utils.$('dm-chat-title').innerText = 'Личный чат';
    }

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
                if (AppState.currentDirectChat?.id === chatId) return; 
                
                sessionStorage.setItem(marker, String(lastTs));
                if (chat.lastMessage.type === 'invite') {
                    Utils.toast(`ЛС: ${chat.lastMessage.fromName} приглашает вас в комнату!`);
                } else {
                    Utils.toast(`ЛС от ${chat.lastMessage.fromName}: ${chat.lastMessage.text}`);
                }
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
            const payload = { type: 'text', fromUid: AppState.currentUser.uid, fromName: AppState.currentUser.displayName, text, ts: Date.now() };
            
            await update(ref(db, `direct-messages/${chatId}`), {
                participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
                updatedAt: payload.ts, lastMessage: payload
            });
            await push(ref(db, `direct-messages/${chatId}/messages`), payload);
        };

        sendBtn.onclick = sendAction;
        input.onkeydown = (e) => { if(e.key === 'Enter') sendAction(); };
        
        Utils.$('modal-dm-chat').querySelector('.btn-close-modal').onclick = () => this.closeChat();
    }

    static renderMessages(messages) {
        const list = Utils.$('dm-messages');
        if (!messages.length) { list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>'; return; }
        
        list.innerHTML = messages.map(m => {
            const isSelf = m.fromUid === AppState.currentUser.uid;
            
            if (m.type === 'invite') {
                return `
                    <div class="m-line ${isSelf ? 'self' : ''}">
                        <strong>${Utils.escapeHtml(isSelf ? 'Вы' : m.fromName)}</strong>
                        <div class="bubble" style="border: 1px solid var(--accent); background: rgba(46,213,115,0.1);">
                            <div style="font-weight:bold; margin-bottom:5px;">Привет! Заходи к нам:</div>
                            <div style="font-size: 16px;">📺 ${Utils.escapeHtml(m.roomName)}</div>
                            <div style="font-size: 12px; opacity:0.8; margin-bottom:8px;">👥 Зрителей: ${m.membersCount || 1}</div>
                            ${!isSelf ? `
                                <div style="display:flex; gap:10px;">
                                    <button class="primary-btn" style="padding:6px; font-size:12px; width:auto;" onclick="window.acceptRoomInvite('${m.roomId}')">Принять</button>
                                    <button class="secondary-btn" style="padding:6px; font-size:12px; width:auto;" onclick="this.parentElement.innerHTML='Отклонено'">Отклонить</button>
                                </div>
                            ` : `<div style="font-size:11px; opacity:0.6; margin-top:5px;">Приглашение отправлено</div>`}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="m-line ${isSelf ? 'self' : ''}">
                    <strong>${Utils.escapeHtml(isSelf ? 'Вы' : m.fromName)}</strong>
                    <div class="bubble">${Utils.escapeHtml(m.text)}</div>
                </div>
            `;
        }).join('');
        list.scrollTop = list.scrollHeight;
    }

    static async sendRoomInvite(targetUid) {
        if (!AppState.currentRoomId || !targetUid || targetUid === AppState.currentUser.uid) return;
        if (AppState.currentPresenceCache?.[targetUid]) return Utils.toast('Пользователь уже находится в комнате', 'error');

        const roomData = AppState.roomsCache.get(AppState.currentRoomId);
        if (!roomData) return Utils.toast('Комната больше не существует', 'error');

        const cooldownKey = `${AppState.currentRoomId}:${targetUid}`;
        const lastInviteTs = AppState.inviteCooldowns.get(cooldownKey) || 0;
        if (Date.now() - lastInviteTs < 10000) return Utils.toast('Не спамьте инвайтами — подождите 10 секунд', 'error');

        const chatId = this.getChatId(AppState.currentUser.uid, targetUid);
        const membersCount = Object.keys(AppState.currentPresenceCache || {}).length || 1;
        const senderProfile = AppState.usersCache.get(AppState.currentUser.uid) || {};

        const payload = { 
            type: 'invite',
            inviteId: Utils.generateCryptoId(8),
            roomId: AppState.currentRoomId,
            roomName: roomData.name,
            membersCount: membersCount,
            fromUid: AppState.currentUser.uid, 
            fromName: senderProfile.name || AppState.currentUser.displayName || 'Пользователь', 
            text: `Приглашение в комнату: ${roomData.name}`,
            ts: Date.now() 
        };

        AppState.inviteCooldowns.set(cooldownKey, payload.ts);
        
        await update(ref(db, `direct-messages/${chatId}`), {
            participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
            updatedAt: payload.ts, lastMessage: payload
        });
        await push(ref(db, `direct-messages/${chatId}/messages`), payload);
        Utils.toast('Приглашение отправлено');
    }
}

window.DirectMessages = DirectMessages;

window.acceptRoomInvite = async (roomId) => {
    if (!roomId) return;
    try {
        const snap = await get(ref(db, `rooms/${roomId}`));
        if (!snap.exists()) return Utils.toast('Комната больше не существует', 'error');

        const roomData = snap.val();
        AppState.roomsCache.set(roomId, roomData);

        if (AppState.currentRoomId === roomId) {
            DirectMessages.closeChat();
            return Utils.toast('Вы уже находитесь в этой комнате');
        }

        DirectMessages.closeChat();
        RoomManager.enterRoomFinal(roomId, roomData); 
    } catch (e) {
        Utils.toast('Не удалось открыть приглашение', 'error');
    }
};

// ============================================================================
// 5. АДМИН-ПАНЕЛЬ И ГЛОБАЛЬНОЕ УПРАВЛЕНИЕ (С РОЛЯМИ)
// ============================================================================

class AdminPanel {
    static developerUidCache = null;

    static isExplicitCreatorProfile(profile = {}) {
        return String(profile?.role || '').toLowerCase().trim() === 'creator';
    }

    static isLegacyCreatorProfile(profile = {}) {
        const cleanUsername = String(profile?.username || '').toLowerCase().trim();
        const cleanRole = String(profile?.role || '').toLowerCase().trim();
        return cleanUsername === 'developer' && cleanRole !== 'moderator';
    }

    static isValidCreatorProfile(profile = {}, options = {}) {
        const { allowLegacyUsername = true } = options;
        return this.isExplicitCreatorProfile(profile) || (allowLegacyUsername && this.isLegacyCreatorProfile(profile));
    }

    static async persistCreatorIdentity(uid, profile = {}) {
        if (!uid || !this.isValidCreatorProfile(profile)) return null;

        this.developerUidCache = uid;

        const cleanUsername = String(profile?.username || '').toLowerCase().trim();
        const updates = {
            'admin/creatorUid': uid
        };

        if (cleanUsername === 'developer') updates['usernames/developer'] = uid;
        if (profile?.role !== 'creator') updates[`users/${uid}/profile/role`] = 'creator';

        await update(ref(db), updates).catch(() => {});
        return uid;
    }

    static async getDeveloperUid(forceRefresh = false) {
        if (!forceRefresh && this.developerUidCache) return this.developerUidCache;

        const [creatorSnap, usernameSnap, usersSnap] = await Promise.all([
            get(ref(db, 'admin/creatorUid')),
            get(ref(db, 'usernames/developer')),
            get(ref(db, 'users'))
        ]);

        const usersData = usersSnap.val() || {};
        const storedCreatorUid = creatorSnap.exists() ? creatorSnap.val() : null;
        const reservedDeveloperUid = usernameSnap.exists() ? usernameSnap.val() : null;
        const hasExplicitCreatorProfile = (uid) => Boolean(uid && usersData?.[uid]?.profile && this.isExplicitCreatorProfile(usersData[uid].profile));
        const hasLegacyCreatorProfile = (uid) => Boolean(uid && usersData?.[uid]?.profile && this.isLegacyCreatorProfile(usersData[uid].profile));

        let candidateUid = null;

        if (hasExplicitCreatorProfile(storedCreatorUid) || hasLegacyCreatorProfile(storedCreatorUid)) {
            candidateUid = storedCreatorUid;
        } else if (hasLegacyCreatorProfile(reservedDeveloperUid)) {
            candidateUid = reservedDeveloperUid;
        } else {
            candidateUid =
                Object.entries(usersData).find(([, userData]) => {
                    return this.isExplicitCreatorProfile(userData?.profile || {});
                })?.[0] ||
                Object.entries(usersData).find(([, userData]) => {
                    return this.isLegacyCreatorProfile(userData?.profile || {});
                })?.[0] ||
                null;
        }

        if (!candidateUid) {
            this.developerUidCache = null;
            return null;
        }

        await this.persistCreatorIdentity(candidateUid, usersData[candidateUid]?.profile || {});
        return this.developerUidCache;
    }

    static hydrateDeveloperUidFromProfile(uid, profile = {}) {
        if (!uid || !this.isValidCreatorProfile(profile)) return;
        if (this.developerUidCache && this.developerUidCache !== uid) return;

        void this.persistCreatorIdentity(uid, profile);
    }

    static isCreatorProfile(profile = {}, uid = null) {
        if (!uid || !this.developerUidCache || uid !== this.developerUidCache) return false;
        return this.isValidCreatorProfile(profile);
    }

    static isModeratorProfile(profile = {}, uid = null) {
        return profile?.role === 'moderator' && !this.isCreatorProfile(profile, uid);
    }

    static isAdminProfile(profile = {}, uid = null) {
        return this.isCreatorProfile(profile, uid) || this.isModeratorProfile(profile, uid);
    }

    static isCurrentUserCreator() {
        const uid = AppState.currentUser?.uid || null;
        const profile = AppState.usersCache.get(uid) || {};
        return this.isCreatorProfile(profile, uid);
    }

    static isCurrentUserAdmin() {
        const uid = AppState.currentUser?.uid || null;
        const profile = AppState.usersCache.get(uid) || {};
        return this.isAdminProfile(profile, uid);
    }

    static async isProtectedCreatorTarget(targetUid) {
        if (!targetUid) return false;

        const [developerUid, profileSnap] = await Promise.all([
            this.getDeveloperUid(),
            get(ref(db, `users/${targetUid}/profile`))
        ]);

        const profile = profileSnap.exists() ? (profileSnap.val() || {}) : {};
        const cleanUsername = String(profile?.username || '').toLowerCase().trim();

        return Boolean(
            (developerUid && targetUid === developerUid) ||
            cleanUsername === 'developer' ||
            this.isValidCreatorProfile(profile)
        );
    }

    static async isProtectedCreatorRoom(roomId) {
        const room = AppState.roomsCache.get(roomId);
        if (!room) return false;

        const developerUid = await this.getDeveloperUid();
        if (developerUid && (room.hostId === developerUid || room.presence?.[developerUid])) return true;

        if (room.hostId) {
            const hostProfile = AppState.usersCache.get(room.hostId) || await ProfileManager.loadUser(room.hostId);
            if (this.isValidCreatorProfile(hostProfile || {})) return true;
        }

        for (const uid of Object.keys(room.presence || {})) {
            const profile = AppState.usersCache.get(uid) || await ProfileManager.loadUser(uid);
            if (this.isValidCreatorProfile(profile || {})) return true;
        }

        return false;
    }

    static requireAdmin() {
        if (!AppState.currentUser || !this.isCurrentUserAdmin()) {
            Utils.toast('Недостаточно прав для админ-действия', 'error');
            return false;
        }
        return true;
    }

    // Защита: Модератор не может трогать Создателя
    static async checkModRestrictionsForTarget(targetUid) {
        if (this.isCurrentUserCreator()) return true;
        if (await this.isProtectedCreatorTarget(targetUid)) {
            Utils.toast('Модератор не может взаимодействовать с профилем Создателя', 'error');
            return false;
        }
        return true;
    }

    // Защита: Модератор не может трогать комнату Создателя (или комнату, где он сидит)
    static async checkModRestrictionsForRoom(roomId) {
        if (this.isCurrentUserCreator()) return true;
        if (await this.isProtectedCreatorRoom(roomId)) {
            Utils.toast('У модератора нет прав на эту комнату (принадлежит или занята Создателем)', 'error');
            return false;
        }
        return true;
    }

    static ensureUI() {
        if (Utils.$('modal-admin-panel')) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modal-admin-panel';
        modal.innerHTML = `
            <div class="modal-content glass-panel" style="width:min(1180px,100%); padding:22px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px;">
                    <div>
                        <h2 style="margin:0;">Админ-панель</h2>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Доступ для Создателя и Модераторов</div>
                    </div>
                    <button class="secondary-btn" id="btn-close-admin-panel" style="width:auto; padding:8px 12px;">✕</button>
                </div>

                <div id="admin-stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px;"></div>

                <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление правами (Только для Создателя)</div>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="admin-mod-username" placeholder="ID пользователя (без @)" style="margin:0; flex:1;">
                        <button class="primary-btn" id="btn-admin-grant-mod" style="width:auto; padding:0 16px;">Назначить Модератора</button>
                        <button class="danger-btn" id="btn-admin-revoke-mod" style="width:auto; padding:0 16px;">Снять Модератора</button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px;">
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Глобальное оповещение</div>
                        <textarea id="admin-announcement-input" rows="4" placeholder="Сообщение для всех онлайн-пользователей..."></textarea>
                        <div style="display:flex; gap:8px;">
                            <button class="primary-btn" id="btn-admin-send-announcement">Разослать</button>
                            <button class="secondary-btn" id="btn-admin-clear-announcement">Очистить</button>
                        </div>
                    </div>

                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Быстрые действия</div>
                        <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                            <button class="danger-btn" id="btn-admin-delete-all-rooms">Удалить все комнаты</button>
                            <button class="secondary-btn" id="btn-admin-purge-empty-rooms">Очистить пустые комнаты</button>
                            <button class="secondary-btn" id="btn-admin-clear-dms">Удалить все ЛС</button>
                            <button class="secondary-btn" id="btn-admin-toggle-room-lock">Блокировать создание комнат</button>
                            <button class="secondary-btn" id="btn-admin-refresh">Обновить данные</button>
                            <button class="secondary-btn" id="btn-admin-clear-user-editor">Сбросить выбранного юзера</button>
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1.15fr 0.85fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="font-weight:700;">Активные комнаты</div>
                                <div style="font-size:12px; color:var(--text-muted);">Удаление любых комнат одним нажатием</div>
                            </div>
                            <div id="admin-rooms-list" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow:auto;"></div>
                        </div>

                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="font-weight:700;">Онлайн пользователи</div>
                                <div style="font-size:12px; color:var(--text-muted);">Форс-выход / кик из комнаты</div>
                            </div>
                            <div id="admin-online-users" style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow:auto;"></div>
                        </div>
                    </div>

                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); min-width:0;">
                        <div style="font-weight:700; margin-bottom:10px;">Управление пользователями</div>
                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="text" id="admin-user-search" placeholder="Поиск по @id или uid" style="margin:0;">
                            <button class="primary-btn" id="btn-admin-find-user" style="width:auto; padding:0 16px;">Найти</button>
                        </div>

                        <div id="admin-user-editor" data-target-uid="" style="display:flex; flex-direction:column; gap:10px;">
                            <div style="font-size:13px; color:var(--text-muted); padding:12px; border:1px dashed var(--border-light); border-radius:12px;">
                                Выберите пользователя через поиск или клик по списку онлайна.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        Utils.$('btn-close-admin-panel').onclick = () => modal.classList.remove('active');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

        Utils.$('btn-admin-send-announcement').onclick = () => this.sendAnnouncement();
        Utils.$('btn-admin-clear-announcement').onclick = () => this.clearAnnouncement();
        Utils.$('btn-admin-delete-all-rooms').onclick = () => this.deleteAllRooms();
        Utils.$('btn-admin-purge-empty-rooms').onclick = () => this.purgeEmptyRooms();
        Utils.$('btn-admin-clear-dms').onclick = () => this.clearDirectMessages();
        Utils.$('btn-admin-toggle-room-lock').onclick = () => this.toggleRoomCreationLock();
        Utils.$('btn-admin-refresh').onclick = () => this.renderPanel();
        Utils.$('btn-admin-find-user').onclick = () => this.findUser();
        Utils.$('btn-admin-clear-user-editor').onclick = () => this.renderEmptyUserEditor();
        Utils.$('admin-user-search').onkeydown = (e) => { if (e.key === 'Enter') this.findUser(); };

        // Модераторские кнопки
        Utils.$('btn-admin-grant-mod').onclick = () => this.toggleModRole(true);
        Utils.$('btn-admin-revoke-mod').onclick = () => this.toggleModRole(false);
    }

    static async toggleModRole(grant) {
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может управлять модераторами', 'error');
        const username = Utils.$('admin-mod-username').value.trim().toLowerCase().replace('@', '');
        if (!username) return Utils.toast('Введите ID пользователя', 'error');

        const snap = await get(ref(db, `usernames/${username}`));
        if (!snap.exists()) return Utils.toast('Пользователь не найден', 'error');
        const targetUid = snap.val();

        if (await this.isProtectedCreatorTarget(targetUid)) {
            return Utils.toast('Нельзя изменить роль Создателя', 'error');
        }

        await update(ref(db, `users/${targetUid}/profile`), { role: grant ? 'moderator' : null });
        Utils.toast(grant ? 'Права модератора выданы' : 'Права модератора сняты');
        Utils.$('admin-mod-username').value = '';
    }

    static init() {
        this.ensureUI();
        if (!AppState.currentUser) return;
        if (this.initializedForUid === AppState.currentUser.uid) return;
        this.initializedForUid = AppState.currentUser.uid;

        const settingsRef = ref(db, 'admin/settings');
        const annRef = ref(db, 'admin/global-announcement');
        const forceSignOutRef = ref(db, `admin/actions/forceSignOut/${AppState.currentUser.uid}`);
        const forceLeaveRoomRef = ref(db, `admin/actions/forceLeaveRoom/${AppState.currentUser.uid}`);

        const settingsUnsub = onValue(settingsRef, (snap) => {
            AppState.admin.settings = { roomCreationBlocked: false, ...(snap.val() || {}) };
            RoomManager.applyCreateRoomAvailability();
            this.renderIfOpen();
        });

        const annUnsub = onValue(annRef, (snap) => {
            const payload = snap.val();
            if (!payload?.id || !payload?.text) return;

            const marker = `globalAnnouncementSeen:${payload.id}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');
            AppState.admin.lastAnnouncementId = payload.id;
            Utils.toast(`Оповещение: ${payload.text}`);
        });

        const forceSignOutUnsub = onValue(forceSignOutRef, async (snap) => {
            const payload = snap.val();
            if (!payload?.ts) return;

            const marker = `forceSignOutSeen:${payload.ts}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');

            if (!this.isCurrentUserAdmin()) {
                Utils.toast('Администратор завершил вашу сессию', 'error');
                await signOut(auth);
            }
        });

        const forceLeaveRoomUnsub = onValue(forceLeaveRoomRef, (snap) => {
            const payload = snap.val();
            if (!payload?.ts) return;

            const marker = `forceLeaveRoomSeen:${payload.ts}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');

            if (!this.isCurrentUserAdmin() && AppState.currentRoomId && (!payload.roomId || payload.roomId === AppState.currentRoomId)) {
                Utils.toast('Администратор удалил вас из комнаты', 'error');
                RoomManager.leaveRoom();
            }
        });

        AppState.activeSubscriptions.push(
            () => off(settingsRef, 'value', settingsUnsub),
            () => off(annRef, 'value', annUnsub),
            () => off(forceSignOutRef, 'value', forceSignOutUnsub),
            () => off(forceLeaveRoomRef, 'value', forceLeaveRoomUnsub)
        );

        RoomManager.applyCreateRoomAvailability();
    }

    static handleLogoutCleanup() {
        this.initializedForUid = null;
        AppState.admin.settings = { roomCreationBlocked: false };
        AppState.admin.lastAnnouncementId = null;
        Utils.$('btn-admin-panel')?.remove();
        Utils.$('modal-admin-panel')?.classList.remove('active');
        this.renderEmptyUserEditor();
    }

    static syncSidebarButton(profile = {}) {
        const footer = Utils.$('btn-logout')?.parentNode;
        if (!footer) return;

        let btn = Utils.$('btn-admin-panel');
        const hasAdminAccess = this.isAdminProfile(profile, AppState.currentUser?.uid || null);

        if (!hasAdminAccess) {
            if (btn) btn.remove();
            Utils.$('modal-admin-panel')?.classList.remove('active');
            return;
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-admin-panel';
            btn.className = 'secondary-btn';
            btn.innerText = 'Админ-панель';
            footer.insertBefore(btn, Utils.$('btn-logout'));
        }

        btn.onclick = () => this.openPanel();
    }

    static openPanel() {
        if (!this.requireAdmin()) return;
        this.ensureUI();
        this.renderPanel();
        Utils.$('modal-admin-panel').classList.add('active');
    }

    static renderIfOpen() {
        if (Utils.$('modal-admin-panel')?.classList.contains('active')) this.renderPanel();
    }

    static getCurrentRoomForUid(targetUid) {
        for (const [roomId, room] of AppState.roomsCache.entries()) {
            if (room?.presence?.[targetUid]) return { roomId, room };
        }
        return null;
    }

    static async collectDashboardData() {
        const [usersSnap, dmSnap] = await Promise.all([
            get(ref(db, 'users')),
            get(ref(db, 'direct-messages'))
        ]);

        const usersData = usersSnap.val() || {};
        const dmData = dmSnap.val() || {};
        const rooms = Array.from(AppState.roomsCache.entries());

        return {
            usersData,
            dmData,
            rooms,
            onlineUsers: Object.entries(usersData).filter(([, userData]) => userData?.status?.online),
            privateRooms: rooms.filter(([, room]) => room?.isPrivate),
            emptyRooms: rooms.filter(([, room]) => !room?.presence || Object.keys(room.presence).length === 0)
        };
    }

    static renderStats(stats) {
        const cards = [
            { label: 'Всего пользователей', value: Object.keys(stats.usersData).length },
            { label: 'Онлайн сейчас', value: stats.onlineUsers.length },
            { label: 'Активных комнат', value: stats.rooms.length },
            { label: 'Приватных комнат', value: stats.privateRooms.length },
            { label: 'Пустых комнат', value: stats.emptyRooms.length },
            { label: 'Личных чатов', value: Object.keys(stats.dmData).length }
        ];

        Utils.$('admin-stats-grid').innerHTML = cards.map(card => `
            <div style="border:1px solid var(--border-light); border-radius:14px; padding:14px; background:rgba(255,255,255,0.03);">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">${card.label}</div>
                <div style="font-size:24px; font-weight:800;">${card.value}</div>
            </div>
        `).join('');

        const lockBtn = Utils.$('btn-admin-toggle-room-lock');
        if (lockBtn) lockBtn.innerText = AppState.admin.settings.roomCreationBlocked ? 'Разблокировать создание комнат' : 'Блокировать создание комнат';
    }

    static renderRoomsList(rooms) {
        const list = Utils.$('admin-rooms-list');
        if (!list) return;

        if (!rooms.length) {
            list.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:8px;">Нет активных комнат</div>`;
            return;
        }

        list.innerHTML = rooms.map(([roomId, room]) => {
            const membersCount = room?.presence ? Object.keys(room.presence).length : 0;
            return `
                <div style="border:1px solid var(--border-light); border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${room.isPrivate ? '🔒 ' : ''}${Utils.escapeHtml(room.name || 'Без названия')}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">ID: ${roomId} • 👥 ${membersCount} • Хост: ${Utils.escapeHtml(room.hostName || 'Неизвестно')}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="secondary-btn admin-enter-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Войти</button>
                        <button class="danger-btn admin-delete-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Закрыть</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.admin-enter-room-btn').forEach(btn => {
            btn.onclick = () => {
                if (!this.requireAdmin()) return;
                const roomId = btn.dataset.roomId;
                const roomData = AppState.roomsCache.get(roomId);
                if (!roomData) return Utils.toast('Комната уже удалена', 'error');
                Utils.$('modal-admin-panel').classList.remove('active');
                RoomManager.enterRoomFinal(roomId, roomData);
            };
        });

        list.querySelectorAll('.admin-delete-room-btn').forEach(btn => {
            btn.onclick = () => this.deleteRoom(btn.dataset.roomId);
        });
    }

    static renderOnlineUsers(usersData) {
        const list = Utils.$('admin-online-users');
        if (!list) return;

        const onlineEntries = Object.entries(usersData).filter(([, userData]) => userData?.status?.online);
        if (!onlineEntries.length) {
            list.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:8px;">Сейчас никто не онлайн</div>`;
            return;
        }

        list.innerHTML = onlineEntries.map(([uid, userData]) => {
            const profile = userData.profile || {};
            const roomMeta = this.getCurrentRoomForUid(uid);
            return `
                <div style="border:1px solid var(--border-light); border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700;">${Utils.escapeHtml(profile.name || 'Без имени')} <span style="color:var(--accent); font-size:12px;">@${Utils.escapeHtml(profile.username || uid)}</span></div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                            UID: ${uid}${roomMeta ? ` • В комнате: ${Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId)}` : ' • Вне комнаты'}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="secondary-btn admin-load-user-btn" data-uid="${uid}" style="width:auto; padding:8px 12px;">Открыть</button>
                        <button class="secondary-btn admin-force-leave-btn" data-uid="${uid}" style="width:auto; padding:8px 12px;" ${roomMeta ? '' : 'disabled'}>Кик из комнаты</button>
                        <button class="danger-btn admin-force-logout-btn" data-uid="${uid}" style="width:auto; padding:8px 12px;">Выгнать</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.admin-load-user-btn').forEach(btn => btn.onclick = () => this.loadUserEditor(btn.dataset.uid));
        list.querySelectorAll('.admin-force-leave-btn').forEach(btn => btn.onclick = () => this.forceLeaveRoom(btn.dataset.uid));
        list.querySelectorAll('.admin-force-logout-btn').forEach(btn => btn.onclick = () => this.forceSignOut(btn.dataset.uid));
    }

    static renderEmptyUserEditor() {
        const editor = Utils.$('admin-user-editor');
        if (!editor) return;
        editor.dataset.targetUid = '';
        editor.innerHTML = `
            <div style="font-size:13px; color:var(--text-muted); padding:12px; border:1px dashed var(--border-light); border-radius:12px;">
                Выберите пользователя через поиск или клик по списку онлайна.
            </div>
        `;
    }

    static async loadUserEditor(uid) {
        if (!this.requireAdmin()) return;
        if (!uid) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

        const snap = await get(ref(db, `users/${uid}`));
        if (!snap.exists()) return Utils.toast('Пользователь не найден', 'error');

        const userData = snap.val() || {};
        const profile = userData.profile || {};
        const roomMeta = this.getCurrentRoomForUid(uid);
        const editor = Utils.$('admin-user-editor');

        editor.dataset.targetUid = uid;
        editor.innerHTML = `
            <div style="font-size:12px; color:var(--text-muted);">UID: ${uid}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:-6px;">Комната: ${roomMeta ? Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId) : 'не находится в комнате'}</div>
            <input type="text" id="admin-edit-name" placeholder="Имя" value="${Utils.escapeHtml(profile.name || '')}">
            <input type="text" id="admin-edit-username" placeholder="ID" value="${Utils.escapeHtml(profile.username || '')}">
            <input type="text" id="admin-edit-avatar" placeholder="URL аватарки" value="${Utils.escapeHtml(profile.avatar || '')}">
            <textarea id="admin-edit-bio" rows="4" placeholder="Описание">${Utils.escapeHtml(profile.bio || '')}</textarea>
            <div style="font-size:12px; color:var(--text-muted);">Email: ${Utils.escapeHtml(profile.email || 'не указан')}</div>
            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                <button class="primary-btn" id="btn-admin-save-user">Сохранить изменения</button>
                <button class="secondary-btn" id="btn-admin-reset-user">Обнулить профиль</button>
                <button class="secondary-btn" id="btn-admin-force-leave-current">Кикнуть из комнаты</button>
                <button class="danger-btn" id="btn-admin-force-logout-current">Форс-выход</button>
            </div>
        `;

        Utils.$('btn-admin-save-user').onclick = () => this.saveUserProfile();
        Utils.$('btn-admin-reset-user').onclick = () => this.resetUserProfile();
        Utils.$('btn-admin-force-leave-current').onclick = () => this.forceLeaveRoom(uid);
        Utils.$('btn-admin-force-logout-current').onclick = () => this.forceSignOut(uid);
    }

    static async findUser() {
        if (!this.requireAdmin()) return;

        const rawValue = Utils.$('admin-user-search')?.value.trim() || '';
        if (!rawValue) return Utils.toast('Введите @id или uid', 'error');

        const directUidSnap = await get(ref(db, `users/${rawValue}/profile`));
        if (directUidSnap.exists()) return this.loadUserEditor(rawValue);

        const username = rawValue.toLowerCase().replace('@', '').trim();
        const usernameSnap = await get(ref(db, `usernames/${username}`));
        if (!usernameSnap.exists()) return Utils.toast('Пользователь не найден', 'error');

        await this.loadUserEditor(usernameSnap.val());
    }

    static async buildResetUsername(uid) {
        let base = `reset_${String(uid).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
        if (base.length < 3) base = `reset_${Utils.generateCryptoId(3)}`;

        const snap = await get(ref(db, `usernames/${base}`));
        if (!snap.exists() || snap.val() === uid) return base;

        return `${base}_${Utils.generateCryptoId(2)}`;
    }

    static async saveUserProfile() {
        if (!this.requireAdmin()) return;

        const editor = Utils.$('admin-user-editor');
        const uid = editor?.dataset.targetUid;
        if (!uid) return Utils.toast('Сначала выберите пользователя', 'error');
        if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

        const profileSnap = await get(ref(db, `users/${uid}/profile`));
        if (!profileSnap.exists()) return Utils.toast('Профиль пользователя не найден', 'error');

        const oldProfile = profileSnap.val() || {};
        const name = Utils.$('admin-edit-name').value.trim();
        const username = Utils.$('admin-edit-username').value.toLowerCase().trim().replace('@', '');
        const avatar = Utils.$('admin-edit-avatar').value.trim();
        const bio = Utils.$('admin-edit-bio').value.trim();

        if (!name || !username) return Utils.toast('Имя и ID обязательны', 'error');
        if (!/^[a-z0-9_]{3,15}$/.test(username)) return Utils.toast('ID: 3-15 символов, a-z, 0-9, _', 'error');

        const developerUid = await this.getDeveloperUid();
        const isCreatorTarget = Boolean(developerUid && uid === developerUid);

        if (username === 'developer' && !isCreatorTarget) return Utils.toast('ID developer зарезервирован', 'error');
        if (isCreatorTarget && username !== oldProfile.username) return Utils.toast('ID Создателя нельзя изменить', 'error');

        const updates = {};
        if (username !== oldProfile.username) {
            const usernameSnap = await get(ref(db, `usernames/${username}`));
            if (usernameSnap.exists() && usernameSnap.val() !== uid) return Utils.toast('Этот ID уже занят', 'error');
            if (oldProfile.username) updates[`usernames/${oldProfile.username}`] = null;
            updates[`usernames/${username}`] = uid;
        }

        const nextProfile = { ...oldProfile, name, username, avatar, bio };
        updates[`users/${uid}/profile`] = nextProfile;

        await update(ref(db), updates);
        AppState.usersCache.set(uid, nextProfile);
        Utils.toast('Профиль пользователя обновлён');
        await this.loadUserEditor(uid);
        this.renderIfOpen();
    }

    static async resetUserProfile() {
        if (!this.requireAdmin()) return;

        const editor = Utils.$('admin-user-editor');
        const uid = editor?.dataset.targetUid;
        if (!uid) return Utils.toast('Сначала выберите пользователя', 'error');
        if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

        if (!confirm('Обнулить профиль пользователя?')) return;

        const profileSnap = await get(ref(db, `users/${uid}/profile`));
        if (!profileSnap.exists()) return Utils.toast('Профиль пользователя не найден', 'error');

        const oldProfile = profileSnap.val() || {};
        const developerUid = await this.getDeveloperUid();
        if (developerUid && uid === developerUid) return Utils.toast('Профиль Создателя нельзя обнулить', 'error');

        const nextUsername = await this.buildResetUsername(uid);
        const updates = {};

        if (oldProfile.username && oldProfile.username !== nextUsername) updates[`usernames/${oldProfile.username}`] = null;
        updates[`usernames/${nextUsername}`] = uid;

        const nextProfile = {
            ...oldProfile,
            name: 'Профиль сброшен',
            username: nextUsername,
            bio: '',
            avatar: ''
        };

        updates[`users/${uid}/profile`] = nextProfile;
        await update(ref(db), updates);
        AppState.usersCache.set(uid, nextProfile);
        Utils.toast('Профиль пользователя обнулён');
        await this.loadUserEditor(uid);
        this.renderIfOpen();
    }

    static async sendAnnouncement() {
        if (!this.requireAdmin()) return;

        const text = Utils.$('admin-announcement-input')?.value.trim();
        if (!text) return Utils.toast('Введите текст оповещения', 'error');

        const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
        await set(ref(db, 'admin/global-announcement'), {
            id: Utils.generateCryptoId(10),
            text,
            ts: Date.now(),
            fromUid: AppState.currentUser.uid,
            fromUsername: profile.username || 'admin'
        });

        Utils.$('admin-announcement-input').value = '';
        Utils.toast('Глобальное оповещение отправлено');
    }

    static async clearAnnouncement() {
        if (!this.requireAdmin()) return;
        await remove(ref(db, 'admin/global-announcement'));
        Utils.toast('Глобальное оповещение очищено');
    }

    static async deleteRoom(roomId) {
        if (!this.requireAdmin()) return;
        if (!(await this.checkModRestrictionsForRoom(roomId))) return; // Защита комнат Создателя

        const roomData = AppState.roomsCache.get(roomId);
        if (!roomData) return Utils.toast('Комната уже удалена', 'error');
        if (!confirm(`Закрыть комнату "${roomData.name || roomId}"?`)) return;

        if (AppState.currentRoomId === roomId) RoomManager.leaveRoom();
        await remove(ref(db, `rooms/${roomId}`));
        AppState.roomsCache.delete(roomId);
        RoomManager.updateRoomsDOM();
        this.renderIfOpen();
        Utils.toast('Комната удалена');
    }

    static async deleteAllRooms() {
        if (!this.requireAdmin()) return;
        if (!confirm('Удалить вообще все комнаты? Это действие необратимо.')) return;

        const devUid = await this.getDeveloperUid();
        const isModOnly = !this.isCurrentUserCreator();
        let deletedCount = 0;

        for (const [roomId, room] of AppState.roomsCache.entries()) {
            // Модераторы пропускают комнаты Создателя при масс-удалении
            if (isModOnly && (room.hostId === devUid || (room.presence && room.presence[devUid]))) {
                continue; 
            }
            if (AppState.currentRoomId === roomId) RoomManager.leaveRoom();
            await remove(ref(db, `rooms/${roomId}`));
            AppState.roomsCache.delete(roomId);
            deletedCount++;
        }

        RoomManager.updateRoomsDOM();
        this.renderIfOpen();
        Utils.toast(`Удалено комнат: ${deletedCount}`);
    }

    static async purgeEmptyRooms() {
        if (!this.requireAdmin()) return;

        const devUid = await this.getDeveloperUid();
        const isModOnly = !this.isCurrentUserCreator();

        const emptyRoomIds = Array.from(AppState.roomsCache.entries())
            .filter(([, room]) => {
                if (room?.presence && Object.keys(room.presence).length > 0) return false;
                // Защита комнат, созданных разработчиком, от модераторов
                if (isModOnly && room.hostId === devUid) return false; 
                return true;
            })
            .map(([roomId]) => roomId);

        if (!emptyRoomIds.length) return Utils.toast('Доступных для удаления пустых комнат нет');

        await Promise.all(emptyRoomIds.map(roomId => remove(ref(db, `rooms/${roomId}`))));
        emptyRoomIds.forEach(roomId => AppState.roomsCache.delete(roomId));
        RoomManager.updateRoomsDOM();
        this.renderIfOpen();
        Utils.toast(`Удалено пустых комнат: ${emptyRoomIds.length}`);
    }

    static async clearDirectMessages() {
        if (!this.requireAdmin()) return;
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может удалять все ЛС', 'error');

        if (!confirm('Удалить вообще все личные сообщения?')) return;

        await remove(ref(db, 'direct-messages'));
        this.renderIfOpen();
        Utils.toast('Все личные сообщения удалены');
    }

    static async toggleRoomCreationLock() {
        if (!this.requireAdmin()) return;
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может блокировать создание комнат', 'error');

        const nextValue = !AppState.admin.settings.roomCreationBlocked;
        await update(ref(db, 'admin/settings'), { roomCreationBlocked: nextValue });
        AppState.admin.settings.roomCreationBlocked = nextValue;
        RoomManager.applyCreateRoomAvailability();
        this.renderIfOpen();
        Utils.toast(nextValue ? 'Создание комнат заблокировано' : 'Создание комнат разблокировано');
    }

    static async forceSignOut(uid) {
        if (!this.requireAdmin()) return;
        if (!uid) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

        if (!confirm(`Принудительно завершить сессию пользователя ${uid}?`)) return;

        await set(ref(db, `admin/actions/forceSignOut/${uid}`), {
            ts: Date.now(),
            by: AppState.currentUser.uid
        });

        Utils.toast('Команда на форс-выход отправлена');
    }

    static async forceLeaveRoom(uid) {
        if (!this.requireAdmin()) return;
        if (!uid) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

        const roomMeta = this.getCurrentRoomForUid(uid);
        if (!roomMeta) return Utils.toast('Пользователь сейчас не находится в комнате', 'error');
        
        if (!(await this.checkModRestrictionsForRoom(roomMeta.roomId))) return; // Доп. защита комнаты

        if (!confirm(`Удалить пользователя ${uid} из комнаты "${roomMeta.room.name || roomMeta.roomId}"?`)) return;

        await Promise.all([
            remove(ref(db, `rooms/${roomMeta.roomId}/presence/${uid}`)),
            remove(ref(db, `rooms/${roomMeta.roomId}/rtc/participants/${uid}`)),
            set(ref(db, `admin/actions/forceLeaveRoom/${uid}`), {
                roomId: roomMeta.roomId,
                ts: Date.now(),
                by: AppState.currentUser.uid
            })
        ]);

        Utils.toast('Пользователь удалён из комнаты');
        this.renderIfOpen();
    }

    static async renderPanel() {
        if (!this.requireAdmin()) return;

        const stats = await this.collectDashboardData();
        this.renderStats(stats);
        this.renderRoomsList(stats.rooms);
        this.renderOnlineUsers(stats.usersData);
    }
}

// ============================================================================
// 6. ПОЛНАЯ СИСТЕМА КОМНАТ И ПРАВ
// ============================================================================

class RoomManager {
    static themeOptions = ['default', 'love'];
    static themeIndex = 0;
    static heartsChatTimer = null;
    static heartsUsersTimer = null;

    static syncDeveloperControls(profile = {}) {
        AdminPanel.syncSidebarButton(profile);
    }

    static applyCreateRoomAvailability() {
        const btn = Utils.$('btn-open-create-room');
        if (!btn) return;

        const blockedForUser = AppState.admin.settings.roomCreationBlocked && !AdminPanel.isCurrentUserAdmin();
        btn.disabled = blockedForUser;
        btn.title = blockedForUser ? 'Создание комнат временно отключено администратором' : '';
    }

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
            if(Utils.$('global-online-count')) Utils.$('global-online-count').innerText = totalOnline;
            AdminPanel.renderIfOpen();
        });
        AppState.activeSubscriptions.push(() => off(roomsRef, 'value', unsub));

        Utils.$('btn-open-create-room').onclick = () => this.openRoomModal();
        Utils.$('btn-save-room').onclick = () => this.saveRoom();
        Utils.$('search-rooms').oninput = Utils.debounce(() => this.updateRoomsDOM(), 300);
        
        Utils.$('room-input-private').onchange = (e) => { Utils.$('room-input-password').style.display = e.target.checked ? 'block' : 'none'; };
        Utils.$('btn-leave-room').onclick = () => this.leaveRoom();
        this.initThemes();
        this.applyCreateRoomAvailability();
    }

    static initThemes() {
        const toggleBtn = Utils.$('btn-room-theme-toggle');
        const carousel = Utils.$('room-theme-carousel');
        const prevBtn = Utils.$('room-theme-prev');
        const nextBtn = Utils.$('room-theme-next');
        const track = Utils.$('room-theme-track');
        if (!toggleBtn || !carousel || !prevBtn || !nextBtn || !track) return;

        const showTheme = (idx) => {
            this.themeIndex = (idx + this.themeOptions.length) % this.themeOptions.length;
            const value = this.themeOptions[this.themeIndex];
            Utils.$('modal-room').dataset.selectedTheme = value;
            track.style.transform = `translateX(-${this.themeIndex * 100}%)`;
            track.querySelectorAll('.theme-card').forEach(card => {
                card.classList.toggle('active', card.dataset.theme === value);
            });
        };

        toggleBtn.onclick = () => carousel.classList.toggle('active');
        prevBtn.onclick = () => showTheme(this.themeIndex - 1);
        nextBtn.onclick = () => showTheme(this.themeIndex + 1);
        track.querySelectorAll('.theme-card').forEach(card => {
            card.onclick = () => {
                const next = this.themeOptions.indexOf(card.dataset.theme);
                if (next >= 0) showTheme(next);
            };
        });
        showTheme(0);
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
        if (!roomId && AppState.admin.settings.roomCreationBlocked && !AdminPanel.isCurrentUserAdmin()) {
            return Utils.toast('Создание комнат временно отключено администратором', 'error');
        }

        const modal = Utils.$('modal-room');
        const isEdit = !!roomId;
        Utils.$('room-modal-title').innerText = isEdit ? 'Настройки комнаты' : 'Создать комнату';
        Utils.$('btn-delete-room').style.display = isEdit ? 'block' : 'none';
        
        if (isEdit) {
            const r = AppState.roomsCache.get(roomId);
            Utils.$('room-input-name').value = r.name || ''; Utils.$('room-input-url').value = r.videoUrl || '';
            Utils.$('room-input-private').checked = r.isPrivate; Utils.$('room-input-password').style.display = r.isPrivate ? 'block' : 'none';
            const theme = this.themeOptions.includes(r.theme) ? r.theme : 'default';
            this.themeIndex = this.themeOptions.indexOf(theme);
            Utils.$('modal-room').dataset.selectedTheme = theme;
            Utils.$('room-theme-track').style.transform = `translateX(-${this.themeIndex * 100}%)`;
            Utils.$('room-theme-track').querySelectorAll('.theme-card').forEach(card => {
                card.classList.toggle('active', card.dataset.theme === theme);
            });
            Utils.$('room-theme-carousel').classList.remove('active');
            Utils.$('btn-delete-room').onclick = async () => {
                if(confirm('Точно удалить комнату навсегда?')) {
                    await remove(ref(db, `rooms/${roomId}`)); modal.classList.remove('active'); this.leaveRoom();
                }
            };
        } else {
            Utils.$('room-input-name').value = ''; Utils.$('room-input-url').value = '';
            Utils.$('room-input-private').checked = false; Utils.$('room-input-password').style.display = 'none'; Utils.$('room-input-password').value = '';
            this.themeIndex = 0;
            Utils.$('modal-room').dataset.selectedTheme = 'default';
            Utils.$('room-theme-track').style.transform = 'translateX(0%)';
            Utils.$('room-theme-track').querySelectorAll('.theme-card').forEach(card => {
                card.classList.toggle('active', card.dataset.theme === 'default');
            });
            Utils.$('room-theme-carousel').classList.remove('active');
        }
        modal.classList.add('active'); modal.dataset.editingId = isEdit ? roomId : '';
    }

    static async saveRoom() {
        const name = Utils.$('room-input-name').value.trim(); const videoUrl = Utils.$('room-input-url').value.trim();
        const isPrivate = Utils.$('room-input-private').checked; const password = Utils.$('room-input-password').value.trim();
        const roomId = Utils.$('modal-room').dataset.editingId;
        const selectedTheme = Utils.$('modal-room').dataset.selectedTheme || 'default';

        if (!roomId && AppState.admin.settings.roomCreationBlocked && !AdminPanel.isCurrentUserAdmin()) {
            return Utils.toast('Создание комнат временно отключено администратором', 'error');
        }

        if (!name) return Utils.toast('Название не может быть пустым', 'error');
        if (isPrivate && password.length < 4 && !roomId) return Utils.toast('Пароль минимум 4 символа', 'error');

        Utils.$('btn-save-room').disabled = true;
        try {
            const roomData = {
                name,
                videoUrl,
                isPrivate,
                theme: this.themeOptions.includes(selectedTheme) ? selectedTheme : 'default',
                hostId: AppState.currentUser.uid,
                hostName: AppState.currentUser.displayName || 'Хост',
                updatedAt: Date.now()
            };
            if (isPrivate && password) { roomData.salt = Utils.generateCryptoId(16); roomData.hash = await Utils.hashPassword(password, roomData.salt); }

            if (roomId) {
                if (isPrivate && !password) { const oldR = AppState.roomsCache.get(roomId); roomData.salt = oldR.salt; roomData.hash = oldR.hash; }
                await update(ref(db, `rooms/${roomId}`), roomData); Utils.toast('Настройки сохранены');
                const mergedRoom = { ...(AppState.roomsCache.get(roomId) || {}), ...roomData };
                AppState.roomsCache.set(roomId, mergedRoom);
                if (AppState.currentRoomId === roomId) this.applyRoomTheme(mergedRoom.theme || 'default');
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

    static enterRoomFinal(roomId, roomData) {
        RTCManager.destroy();
        AppState.currentRoomId = roomId;
        AppState.isHost = (roomData.hostId === AppState.currentUser.uid);
        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.roomSubscriptions.forEach(fn => fn()); AppState.roomSubscriptions = [];
        
        Utils.$('room-title-text').innerText = Utils.escapeHtml(roomData.name);
        this.applyRoomTheme(roomData.theme || 'default');
        const vid = Utils.$('native-player');
        const nextVideoUrl = String(roomData.videoUrl || '').trim();

        if (vid) {
            if (vid.dataset.roomUrl !== nextVideoUrl) {
                vid.pause();
                vid.removeAttribute('src');
                vid.load();

                if (nextVideoUrl) {
                    vid.src = nextVideoUrl;
                    vid.load();
                }

                vid.dataset.roomUrl = nextVideoUrl;
            }

            vid.controls = AppState.isHost;
            vid.playsInline = true;
            vid.preload = 'auto';
            vid.onerror = () => Utils.toast('Плеер не смог загрузить видео. Нужна прямая ссылка на медиафайл.', 'error');
        }
        
        let shareBtn = Utils.$('btn-share-room');
        if (!shareBtn) {
            shareBtn = document.createElement('button');
            shareBtn.id = 'btn-share-room';
            shareBtn.className = 'primary-btn';
            shareBtn.style.width = 'auto'; shareBtn.style.padding = '10px 16px';
            shareBtn.innerText = 'Поделиться';
            Utils.$('btn-room-settings').parentNode.appendChild(shareBtn);
        }
        shareBtn.onclick = () => {
            Utils.$('tab-users-btn').click();
            Utils.toast('Нажмите "Пригласить" рядом с другом в списке', 'info');
        };

        Utils.$('btn-room-settings').style.display = AppState.isHost ? 'block' : 'none';
        if (AppState.isHost) Utils.$('btn-room-settings').onclick = () => this.openRoomModal(roomId);

        Utils.showScreen('room-screen');
        Utils.$('chat-messages').innerHTML = '<div class="panel-love-hearts" id="chat-love-hearts"></div><div class="sys-msg">Вы вошли в комнату</div>';
        Utils.$('users-list').innerHTML = '<div class="panel-love-hearts" id="users-love-hearts"></div>';
        
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

        set(presenceRef, { uid, name: AppState.currentUser.displayName, perms: this.getDefaultPerms() });
        onDisconnect(presenceRef).remove();

        const pUnsub = onValue(presListRef, (snap) => {
            AppState.currentPresenceCache = snap.val() || {};
            this.rerenderUsersList();
            this.applyLocalPermissions();
        });
        AppState.roomSubscriptions.push(() => off(presListRef, 'value', pUnsub), () => remove(presenceRef));

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
            if (Date.now() - d.ts > 2000) return;

            if (Math.abs(vid.currentTime - d.time) > 1.0) {
                isRemoteSeek = true;
                vid.currentTime = d.time;
                setTimeout(() => isRemoteSeek = false, 300);
            }
            if (d.type === 'play' && vid.paused) vid.play().catch(()=>{});
            if (d.type === 'pause' && !vid.paused) vid.pause();
        });
        AppState.roomSubscriptions.push(() => off(syncRef, 'value', sUnsub));

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

        if (!pVoice && RTCManager.isMicActive) RTCManager.toggleMic(true); 
    }

    static rerenderUsersList() {
        const container = Utils.$('users-list');
        const cache = AppState.currentPresenceCache || {};
        const ids = Object.keys(cache);
        const renderToken = ++AppState.usersListRenderToken;
        const renderRoomId = AppState.currentRoomId;

        Utils.$('users-count').innerText = ids.length;
        container.innerHTML = '<div class="panel-love-hearts" id="users-love-hearts"></div>';
        
        const ensureActualRender = () => {
            if (renderToken !== AppState.usersListRenderToken) return false;
            if (!AppState.currentRoomId || AppState.currentRoomId !== renderRoomId) return false;
            return true;
        };
        
        if (AppState.currentUser) {
            get(ref(db, `users/${AppState.currentUser.uid}/friends`)).then(snap => {
                if (!ensureActualRender()) return;

                const fr = snap.val() || {};
                const friendsIds = Object.keys(fr).filter(k => fr[k].status === 'accepted' && !ids.includes(k)); 
                if (friendsIds.length > 0) {
                    let inviteHtml = `<div style="font-size:11px; color:var(--text-muted); margin: 10px 0 5px; text-transform:uppercase;">Друзья вне комнаты</div>`;
                    friendsIds.forEach(fid => {
                        inviteHtml += `
                            <div class="user-item" style="background: rgba(46,213,115,0.05); border: 1px solid rgba(46,213,115,0.2);">
                                <div class="user-main"><span class="user-name" id="inv-name-${fid}">Загрузка...</span></div>
                                <button class="primary-btn" style="width:auto; padding:4px 8px; font-size:11px;" onclick="DirectMessages.sendRoomInvite('${fid}')">Пригласить</button>
                            </div>
                        `;
                        ProfileManager.loadUser(fid).then(p => {
                            if (!ensureActualRender() || !p) return;
                            if (Utils.$(`inv-name-${fid}`)) Utils.$(`inv-name-${fid}`).innerText = p.name;
                        });
                    });
                    container.innerHTML += inviteHtml + `<div style="font-size:11px; color:var(--text-muted); margin: 15px 0 5px; text-transform:uppercase;">В комнате</div>`;
                }
                renderRoomUsers();
            });
        } else {
            renderRoomUsers();
        }

        function renderRoomUsers() {
            if (!ensureActualRender()) return;
            ids.forEach(uid => {
                const user = cache[uid];
                const isLocal = uid === AppState.currentUser.uid;
                const isTargetHost = AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid;
                
                // Рендер бейджа ролей для списка комнаты
                const profile = AppState.usersCache.get(uid) || {};
                const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
                
                let html = `<div class="user-item">`;
                html += `<div class="indicator online"></div>`; 
                html += `<div class="user-main"><span class="user-name">${Utils.escapeHtml(user.name)}</span>${roleBadgeHtml}`;
                if (isTargetHost) html += `<span class="host-label">Host</span>`;
                if (isLocal) html += `<span class="you-label">(Вы)</span>`;
                html += `</div>`;

                html += `<div class="user-card-actions">`;
                if (!isLocal) {
                    html += `<button class="dm-btn" data-uid="${uid}">💬</button>`;
                    html += `<button class="add-friend-btn" data-uid="${uid}">+Друг</button>`;
                }
                html += `</div>`;

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
    }

    static leaveRoom() {
        if (!AppState.currentRoomId) return;
        AppState.roomSubscriptions.forEach(fn => fn());
        AppState.roomSubscriptions = [];
        RTCManager.destroy();
        
        const vid = Utils.$('native-player');
        if (vid) {
            vid.pause();
            vid.removeAttribute('src');
            vid.load();
            delete vid.dataset.roomUrl;
            vid.onplay = null;
            vid.onpause = null;
            vid.onseeked = null;
            vid.onerror = null;
        }
        
        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.currentRoomId = null;
        this.applyRoomTheme('default');
        AppState.isHost = false;
        if (Utils.$('users-list')) Utils.$('users-list').innerHTML = '';
        if (Utils.$('users-count')) Utils.$('users-count').innerText = '0';
        Utils.showScreen('lobby-screen');
    }

    static applyRoomTheme(theme = 'default') {
        const roomScreen = Utils.$('room-screen');
        if (!roomScreen) return;
        roomScreen.classList.remove('theme-love');
        document.body.classList.remove('theme-love-room');
        this.stopLoveHearts();
        if (theme === 'love') {
            roomScreen.classList.add('theme-love');
            document.body.classList.add('theme-love-room');
            this.startLoveHearts();
        }
    }

    static startLoveHearts() {
        if (this.heartsChatTimer || this.heartsUsersTimer) return;

        const spawnHeart = (layer, mode = 'mid', warm = false) => {
            if (!layer) return;
            const heart = document.createElement('div');
            heart.className = `love-heart ${mode}`;
            const core = document.createElement('div');
            core.className = 'heart-core';
            heart.appendChild(core);
            heart.style.left = `${Math.random() * 100}%`;
            const scaleBase = mode === 'far' ? 0.45 : mode === 'near' ? 1.15 : 0.78;
            const scale = scaleBase + Math.random() * (mode === 'near' ? 0.35 : 0.25);
            const drift = -35 + Math.random() * 70;
            const duration = mode === 'near' ? 26 + Math.random() * 8 : 22 + Math.random() * 9;
            const opacity = mode === 'far' ? 0.16 + Math.random() * 0.12 : mode === 'near' ? 0.34 + Math.random() * 0.18 : 0.24 + Math.random() * 0.14;
            heart.style.setProperty('--heart-scale', String(scale));
            heart.style.setProperty('--heart-drift', `${drift}px`);
            heart.style.setProperty('--heart-opacity', String(opacity));
            heart.style.animationDuration = `${duration}s`;
            if (warm) {
                heart.style.bottom = `${Math.random() * 95}%`;
                heart.style.animationDelay = `-${Math.random() * duration}s`;
            }
            layer.appendChild(heart);
            setTimeout(() => heart.remove(), 36000);
        };

        const primeLayer = (layer, amount = 14) => {
            if (!layer) return;
            for (let i = 0; i < amount; i++) {
                const roll = Math.random();
                const mode = roll < 0.33 ? 'far' : roll > 0.74 ? 'near' : 'mid';
                spawnHeart(layer, mode, true);
            }
        };

        primeLayer(Utils.$('chat-love-hearts'), 16);
        primeLayer(Utils.$('users-love-hearts'), 12);

        this.heartsChatTimer = setInterval(() => {
            const chatLayer = Utils.$('chat-love-hearts');
            const roll = Math.random();
            const mode = roll < 0.33 ? 'far' : roll > 0.74 ? 'near' : 'mid';
            spawnHeart(chatLayer, mode);
        }, 1100);

        this.heartsUsersTimer = setInterval(() => {
            const usersLayer = Utils.$('users-love-hearts');
            const roll = Math.random();
            const mode = roll < 0.45 ? 'far' : roll > 0.8 ? 'near' : 'mid';
            spawnHeart(usersLayer, mode);
        }, 1300);
    }

    static stopLoveHearts() {
        if (this.heartsChatTimer) {
            clearInterval(this.heartsChatTimer);
            this.heartsChatTimer = null;
        }
        if (this.heartsUsersTimer) {
            clearInterval(this.heartsUsersTimer);
            this.heartsUsersTimer = null;
        }
        const chatLayer = Utils.$('chat-love-hearts');
        if (chatLayer) chatLayer.innerHTML = '';
        const usersLayer = Utils.$('users-love-hearts');
        if (usersLayer) usersLayer.innerHTML = '';
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
        AppState.rtc.sessionId = Utils.generateCryptoId();
        AppState.rtc.voiceParticipantsCache = {};
        this.lastCandidatesGroup = {};
        this.refs = {
            selfParticipant: ref(db, `rooms/${roomId}/rtc/participants/${this.uid}`),
            participants: ref(db, `rooms/${roomId}/rtc/participants`),
            offers: ref(db, `rooms/${roomId}/rtc/offers/${this.uid}`),
            answers: ref(db, `rooms/${roomId}/rtc/answers/${this.uid}`),
            candidates: ref(db, `rooms/${roomId}/rtc/candidates/${this.uid}`)
        };
        this.unsubs = [];
        this.isMicActive = false;

        set(this.refs.selfParticipant, { sessionId: AppState.rtc.sessionId, ts: Date.now(), listening: true, speaking: false });
        onDisconnect(this.refs.selfParticipant).remove();

        const pUnsub = onValue(this.refs.participants, (snap) => this.handleParticipants(snap.val() || {}));
        const oUnsub = onValue(this.refs.offers, (snap) => this.handleOffers(snap.val() || {}));
        const aUnsub = onValue(this.refs.answers, (snap) => this.handleAnswers(snap.val() || {}));
        const cUnsub = onValue(this.refs.candidates, (snap) => this.handleCandidates(snap.val() || {}));
        
        this.unsubs.push(() => off(this.refs.participants, 'value', pUnsub), () => off(this.refs.offers, 'value', oUnsub), () => off(this.refs.answers, 'value', aUnsub), () => off(this.refs.candidates, 'value', cUnsub));

        Utils.$('mic-btn').onclick = () => this.toggleMic();
    }

    static async writeParticipantState() {
        if (!this.refs?.selfParticipant || !AppState.rtc.sessionId) return;
        await set(this.refs.selfParticipant, {
            sessionId: AppState.rtc.sessionId,
            ts: Date.now(),
            listening: true,
            speaking: this.isMicActive === true
        });
    }

    static syncLocalTracksToConnection(pc) {
        if (!pc || !AppState.rtc.localStream) return;
        const existingTrackIds = new Set(pc.getSenders().map(sender => sender.track?.id).filter(Boolean));
        AppState.rtc.localStream.getTracks().forEach(track => {
            if (!existingTrackIds.has(track.id)) {
                pc.addTrack(track, AppState.rtc.localStream);
            }
        });
    }

    static async toggleMic(forceOff = false) {
        const btn = Utils.$('mic-btn');
        if (!btn) return;

        if (this.isMicActive || forceOff) {
            this.isMicActive = false;
            btn.classList.remove('active');
            btn.style.opacity = '1';
            this.stopAll();
            AppState.rtc.sessionId = Utils.generateCryptoId();
            await this.writeParticipantState();
            await this.handleParticipants(AppState.rtc.voiceParticipantsCache || {});
            if (!forceOff) Utils.toast('Микрофон выключен');
        } else {
            if (!RoomManager.hasPerm('voice')) return Utils.toast('Вам запрещено говорить', 'error');
            try {
                btn.style.opacity = '0.5';
                this.stopAll();
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                AppState.rtc.localStream = stream;
                AppState.rtc.sessionId = Utils.generateCryptoId();
                this.isMicActive = true;
                btn.classList.add('active');
                btn.style.opacity = '1';

                await this.writeParticipantState();
                await this.handleParticipants(AppState.rtc.voiceParticipantsCache || {});
                Utils.toast('Микрофон включен');
            } catch (e) {
                btn.style.opacity = '1';
                this.isMicActive = false;
                btn.classList.remove('active');
                Utils.toast('Нет доступа к микрофону', 'error');
            }
        }
    }

    static async handleParticipants(map) {
        AppState.rtc.voiceParticipantsCache = map;

        for (const [targetUid] of AppState.rtc.peerConnections) {
            if (!map[targetUid] || !map[targetUid].sessionId) this.destroyConnection(targetUid);
        }

        for (const targetUid in map) {
            if (targetUid === this.uid) continue;
            if (!map[targetUid]?.sessionId) continue;
            if (this.uid.localeCompare(targetUid) > 0) await this.createOffer(targetUid, map[targetUid].sessionId);
        }
    }

    static getOrCreateConnection(targetUid, targetSessionId) {
        if (AppState.rtc.peerConnections.has(targetUid)) {
            const existingPc = AppState.rtc.peerConnections.get(targetUid);
            if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
                this.syncLocalTracksToConnection(existingPc);
                return existingPc;
            }
            this.destroyConnection(targetUid);
        }

        const pc = new RTCPeerConnection(this.RTC_CONFIG);
        this.syncLocalTracksToConnection(pc);

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
        if (!AppState.rtc.sessionId) return;
        for (const [fromUid, payload] of Object.entries(offers)) {
            if (payload.toSessionId !== AppState.rtc.sessionId) continue;
            const pc = this.getOrCreateConnection(fromUid, payload.fromSessionId);
            try {
                if (pc.signalingState !== 'stable') await pc.setLocalDescription({ type: 'rollback' }).catch(()=>{});
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
                await set(ref(db, `rooms/${this.roomId}/rtc/answers/${fromUid}/${this.uid}`), { description: pc.localDescription.toJSON(), fromSessionId: AppState.rtc.sessionId, toSessionId: payload.fromSessionId });
                await this.handleCandidates(this.lastCandidatesGroup || {});
                await remove(ref(db, `rooms/${this.roomId}/rtc/offers/${this.uid}/${fromUid}`));
            } catch (e) {}
        }
    }

    static async handleAnswers(answers) {
        if (!AppState.rtc.sessionId) return;
        for (const [fromUid, payload] of Object.entries(answers)) {
            if (payload.toSessionId !== AppState.rtc.sessionId) continue;
            const pc = AppState.rtc.peerConnections.get(fromUid);
            if (!pc) continue;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                await this.handleCandidates(this.lastCandidatesGroup || {});
                await remove(ref(db, `rooms/${this.roomId}/rtc/answers/${this.uid}/${fromUid}`));
            } catch (e) {}
        }
    }

    static async handleCandidates(candidatesGroup) {
        this.lastCandidatesGroup = candidatesGroup;
        if (!AppState.rtc.sessionId) return;

        for (const [fromUid, records] of Object.entries(candidatesGroup)) {
            const pc = AppState.rtc.peerConnections.get(fromUid);
            if (!pc || !pc.remoteDescription) continue;

            for (const [key, payload] of Object.entries(records)) {
                if (payload.toSessionId !== AppState.rtc.sessionId) continue;
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    await remove(ref(db, `rooms/${this.roomId}/rtc/candidates/${this.uid}/${fromUid}/${key}`));
                } catch (e) {}
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
        if (AppState.currentUser && this.roomId) remove(ref(db, `rooms/${this.roomId}/rtc/participants/${this.uid}`)).catch(()=>{});
        this.isMicActive = false;
        AppState.rtc.sessionId = null;
        AppState.rtc.voiceParticipantsCache = {};
        Utils.$('mic-btn')?.classList.remove('active');
        (this.unsubs || []).forEach(fn => fn());
        this.unsubs = [];
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
            if (!modal) return;
            if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
            else modal.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target !== modal) return;
            if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
            else modal.classList.remove('active');
        });
    });
};
