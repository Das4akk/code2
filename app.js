/**
 * @fileoverview COWIO Core Engine v4.0 - The Ultimate Edition
 * @description Интегрированы все фиксы: MPA-подобная стабильность, обход пароля по инвайтам,
 * улучшенный интерактивный нейрофон, левитация элементов, фикс мобильного скролла,
 * статистика профилей и строгая защита уникальных юзернеймов.
 * + ПАТЧ: Система ролей (Создатель / Модератор) с защитой приоритетов.
 * + ПАТЧ: Адаптивный Ambilight плеера, фикс /milk, COWIO ребрендинг, Z-index фикс.
 * + ПАТЧ: Плавные исчезновения пасхалок (Fade-out) и увеличенное время (15s).
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
    currentRoomJoinTs: 0, // Фикс синхронизации новых юзеров
    currentTheme: null,
    globalTheme: 'dark', // [NEW]
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
        lastAnnouncementId: null,
        activeSection: 'dashboard',
        logs: [],
        shadowbans: {},
        globalMute: false,
        spectators: {}
    },
    easterEggs: {
        activeEffects: new Map(),
        audioPool: new Set(),
        processedRoomEvents: new Set(),
        keyBuffer: '',
        lastKeyTs: 0,
        konamiIndex: 0,
        animationHandles: new Map(),
        notificationMutedUntil: 0,
        roomUnsub: null
    }
};

// ============================================================================
// 2. УТИЛИТЫ И GUI ФИКСЫ (Инъекция стилей, Анимации, Нейрофон)
// ============================================================================

class Utils {
    static $(id) { return document.getElementById(id); }

    static toast(msg, type = 'info') {
        let container = Utils.$('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
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

        // Показываем футер с ссылками ТОЛЬКО в лобби
        const footerLinks = Utils.$('bottom-footer-links');
        if (footerLinks) {
            footerLinks.style.display = (screenId === 'lobby-screen') ? 'flex' : 'none';
        }
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

    // [ADD] File to Base64 (Compressed for performance/DB)
    static fileToBase64(file, maxWidth = 800) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    static heartDistributionState = new WeakMap(); // [NEW]

    static getGreatestCommonDivisor(a, b) { // [NEW]
        while (b) { // [NEW]
            const next = a % b; // [NEW]
            a = b; // [NEW]
            b = next; // [NEW]
        } // [NEW]
        return Math.abs(a || 1); // [NEW]
    } // [NEW]

    static getDistributedHeartLeft(layer, key = 'default') { // [NEW]
        const width = Math.max(1, layer?.clientWidth || window.innerWidth || 1); // [NEW]
        const columns = Math.max(6, Math.min(16, Math.floor(width / 92))); // [NEW]
        let layerState = this.heartDistributionState.get(layer); // [NEW]
        if (!layerState) { // [NEW]
            layerState = {}; // [NEW]
            if (layer) this.heartDistributionState.set(layer, layerState); // [NEW]
        } // [NEW]
        let state = layerState[key]; // [NEW]
        if (!state || state.columns !== columns) { // [NEW]
            let step = Math.max(2, Math.floor(columns / 2)); // [NEW]
            while (this.getGreatestCommonDivisor(step, columns) !== 1) step += 1; // [NEW]
            state = { columns, cursor: Math.floor(Math.random() * columns), step }; // [NEW]
            layerState[key] = state; // [NEW]
        } // [NEW]
        const slot = state.cursor; // [NEW]
        state.cursor = (state.cursor + state.step) % columns; // [NEW]
        const spread = 84 / columns; // [NEW]
        const jitter = (Math.random() - 0.5) * Math.min(spread * 0.45, 6); // [NEW]
        return Math.max(6, Math.min(94, 8 + (slot * spread) + (spread / 2) + jitter)); // [NEW]
    } // [NEW]

    static injectFixes() {
        const style = document.createElement('style');
        style.innerHTML = `
            body {
                transition: background 1s ease, background-color 1s ease, filter 1s ease, transform 1s ease, color 1s ease, text-shadow 1s ease;
            }

            /* Анимация левитации */
            @keyframes levitate {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
            .glass-panel, .room-card, .user-card, .msg-bubble, .friend-item {
                animation: levitate 10s ease-in-out infinite;
                will-change: transform;
            }
            .room-card { animation-delay: 1s; }
            .user-card { animation-delay: 2s; }
            
            /* Фикс размеров плеера и Ambilight стили */
            .video-container {
                position: relative;
                min-height: 35vh;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
            }
            #native-player {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                border-radius: 16px;
                background: #000;
                position: relative;
                z-index: 2;
                transition: box-shadow 0.3s ease;
            }

            /* Тосты - МАКСИМАЛЬНЫЙ Z-INDEX */
            #toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999 !important;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .toast {
                background: rgba(15,15,15,0.95);
                color: #fff;
                padding: 12px 20px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
                transition: opacity 0.3s ease;
                pointer-events: all;
                border: 1px solid var(--border-light);
                z-index: 999999 !important;
                animation: levitate 6s ease-in-out infinite;
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

            /* СТИЛИ ФУТЕРА С ССЫЛКАМИ */
            #bottom-footer-links {
                position: fixed;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 16px;
                background: rgba(15, 15, 15, 0.75);
                backdrop-filter: blur(10px);
                padding: 8px 24px;
                border-radius: 20px;
                border: 1px solid var(--border-light);
                z-index: 9998;
                font-size: 13px;
                font-weight: 600;
            }
            #bottom-footer-links a {
                color: var(--text-muted);
                text-decoration: none;
                transition: color 0.2s ease, transform 0.2s ease;
            }
            #bottom-footer-links a:hover {
                color: var(--accent);
                transform: translateY(-2px);
            }
            @media (max-width: 768px) {
                #bottom-footer-links {
                    bottom: 70px;
                    padding: 6px 14px;
                    font-size: 11px;
                    gap: 12px;
                }
            }

            /* UI polish layer: outlines, motion, light-input fix */
            button,
            .primary-btn,
            .secondary-btn,
            .danger-btn,
            .dm-btn,
            .add-friend-btn,
            .btn-small {
                outline: 1px solid rgba(255, 255, 255, 0.22);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
                transition: transform 0.35s ease, box-shadow 0.45s ease, filter 0.45s ease, background 0.45s ease;
            }
            button:hover,
            .primary-btn:hover,
            .secondary-btn:hover,
            .danger-btn:hover,
            .dm-btn:hover,
            .add-friend-btn:hover,
            .btn-small:hover {
                transform: translateY(-1px) scale(1.02);
                box-shadow: 0 0 16px rgba(255, 255, 255, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.35) inset;
            }
            button:active {
                transform: scale(0.98);
                filter: brightness(0.95);
            }
            .theme-light-global input,
            .theme-light-global textarea,
            .theme-light-global select {
                color: #111 !important;
                background: rgba(250, 246, 238, 0.96) !important;
                border: 2px solid rgba(0, 0, 0, 0.62) !important;
            }
            .theme-light-global input::placeholder,
            .theme-light-global textarea::placeholder {
                color: rgba(0, 0, 0, 0.46) !important;
            }
            .theme-light-global body,
            body.theme-light-global {
                background: linear-gradient(135deg, #f7f2e8 0%, #f1eadf 48%, #ece3d5 100%) !important;
                color: #2e271d !important;
            }
            .theme-light-global,
            html.theme-light-global,
            html[data-global-theme="light"] {
                --bg: #f4eee2 !important;
                --panel: rgba(252, 247, 237, 0.92) !important;
                --panel-hover: rgba(250, 244, 233, 0.98) !important;
                --border: rgba(0, 0, 0, 0.25) !important;
                --border-light: rgba(0, 0, 0, 0.42) !important;
                --text-main: #1f1a13 !important;
                --text-muted: #4b4135 !important;
                --accent: #1f1a13 !important;
                --accent-hover: #000000 !important;
            }
            .theme-light-global #auth-screen,
            .theme-light-global #lobby-screen,
            .theme-light-global #room-screen,
            .theme-light-global .screen,
            body.theme-light-global #auth-screen,
            body.theme-light-global #lobby-screen,
            body.theme-light-global #room-screen,
            body.theme-light-global .screen {
                background: linear-gradient(135deg, #f7f2e8 0%, #f1eadf 48%, #ece3d5 100%) !important;
            }
            .theme-light-global #particle-canvas,
            body.theme-light-global #particle-canvas {
                opacity: 1 !important;
                filter: contrast(1.25) !important;
            }
            .theme-light-global .glass-panel,
            .theme-light-global .room-card,
            .theme-light-global .user-item,
            .theme-light-global .friend-item,
            .theme-light-global .chat-section,
            .theme-light-global .player-section,
            .theme-light-global .modal-content {
                border: 2px solid rgba(0, 0, 0, 0.56) !important;
                background: rgba(252, 247, 237, 0.88) !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12) inset, 0 8px 20px rgba(0, 0, 0, 0.08);
            }
            .theme-light-global .bubble,
            .theme-light-global .friend-request-item,
            .theme-light-global .room-info,
            .theme-light-global .perm-controls {
                border: 2px solid rgba(0, 0, 0, 0.48) !important;
                background: rgba(255, 251, 243, 0.88) !important;
            }
            .theme-light-global button,
            .theme-light-global .primary-btn,
            .theme-light-global .secondary-btn,
            .theme-light-global .danger-btn,
            .theme-light-global .dm-btn,
            .theme-light-global .add-friend-btn,
            .theme-light-global .btn-small {
                border: 2px solid rgba(0, 0, 0, 0.68) !important;
                outline: none !important;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.82) inset;
            }

            .room-card {
                transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
            }
            .room-card:hover {
                transform: translateY(-3px) scale(1.01);
                box-shadow: 0 10px 28px rgba(255, 255, 255, 0.16);
                border-color: rgba(255, 255, 255, 0.45);
            }
            .room-preview video {
                transition: transform 0.7s ease, filter 0.7s ease;
            }
            .room-card:hover .room-preview video {
                transform: scale(1.06);
                filter: saturate(1.15);
            }
            .room-meta .avatars-stack {
                display: inline-flex;
                align-items: center;
                margin-left: 6px;
            }
            .room-meta .stack-avatar {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.45);
                margin-left: -7px;
                overflow: hidden;
                background: rgba(255,255,255,0.08);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
            }

            .profile-open-link {
                cursor: pointer;
                transition: color 0.2s ease, text-shadow 0.2s ease;
            }
            .profile-open-link:hover {
                color: var(--accent);
                text-shadow: 0 0 8px rgba(46, 213, 115, 0.45);
            }

            .voice-wave {
                display: inline-flex;
                gap: 2px;
                margin-left: 8px;
                vertical-align: middle;
            }
            .voice-wave i {
                width: 2px;
                height: 8px;
                border-radius: 8px;
                background: #ffffff;
                opacity: 0.35;
                animation: voiceWave 1.8s ease-in-out infinite;
            }
            .voice-wave i:nth-child(2) { animation-delay: 0.1s; }
            .voice-wave i:nth-child(3) { animation-delay: 0.2s; }
            .voice-wave i:nth-child(4) { animation-delay: 0.3s; }
            .user-item.speaking .voice-wave i {
                opacity: 1;
            }
            @keyframes voiceWave {
                0%, 100% { transform: scaleY(0.5); }
                50% { transform: scaleY(1.6); }
            }

            #modal-admin-panel.godmode-modal .modal-content {
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                display: grid;
                grid-template-columns: 260px minmax(0, 1fr);
                gap: 0;
                background: radial-gradient(circle at top, rgba(255, 255, 255, 0.09), rgba(9, 9, 9, 0.98));
            }
            .godmode-sidebar {
                border-right: 1px solid rgba(255, 255, 255, 0.25);
                background: rgba(7, 7, 7, 0.92);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .godmode-sidebar button {
                width: 100%;
                text-align: left;
                padding: 10px 12px;
                font-family: Consolas, Menlo, Monaco, monospace;
            }
            .godmode-main {
                overflow: auto;
                padding: 20px;
            }
            .godmode-section {
                display: none;
            }
            .godmode-section.active {
                display: block;
                animation: fadeInUp 0.45s ease;
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
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

class GlobalThemeManager { // [NEW]
    static storageKey = 'cowio:globalTheme'; // [NEW]

    static normalizeTheme(theme = 'dark') { // [NEW]
        return theme === 'light' ? 'light' : 'dark'; // [NEW]
    } // [NEW]

    static getStoredTheme() { // [NEW]
        return this.normalizeTheme(localStorage.getItem(this.storageKey) || document.documentElement.dataset.globalTheme || 'dark'); // [NEW]
    } // [NEW]

    static applyTheme(theme = 'dark', persist = true) { // [NEW]
        const normalized = this.normalizeTheme(theme); // [NEW]
        AppState.globalTheme = normalized; // [NEW]
        document.documentElement.dataset.globalTheme = normalized; // [NEW]
        document.documentElement.classList.toggle('theme-light-global', normalized === 'light'); // [NEW]
        document.body?.classList.toggle('theme-light-global', normalized === 'light'); // [NEW]
        const toggle = Utils.$('global-theme-toggle'); // [NEW]
        if (toggle) toggle.checked = normalized === 'light'; // [NEW]
        if (persist) localStorage.setItem(this.storageKey, normalized); // [NEW]
    } // [NEW]

    static init() { // [NEW]
        this.applyTheme(this.getStoredTheme(), false); // [NEW]
        const toggle = Utils.$('global-theme-toggle'); // [NEW]
        if (!toggle) return; // [NEW]
        toggle.onchange = () => this.applyTheme(toggle.checked ? 'light' : 'dark', true); // [NEW]
    } // [NEW]
} // [NEW]

// Адаптивный Ambilight для плеера
class Ambilight {
    static loopId = null;
    static canvas = document.createElement('canvas');
    static ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    static start(videoEl) {
        this.stop();
        if (!videoEl) return;
        
        let glowEl = Utils.$('ambilight-glow');
        if (!glowEl) {
            glowEl = document.createElement('div');
            glowEl.id = 'ambilight-glow';
            glowEl.style.cssText = 'position:absolute; top:5%; left:5%; width:90%; height:90%; z-index:0; filter:blur(40px); opacity:0.85; transition: background 0.5s ease, box-shadow 0.5s ease; border-radius: 20px; pointer-events:none; transform: translateZ(0);';
            videoEl.parentNode.insertBefore(glowEl, videoEl);
        }

        this.canvas.width = 64; 
        this.canvas.height = 64;

        const draw = () => {
            if (!AppState.currentRoomId) return this.stop();
            
            if (AppState.currentTheme === 'love') {
                glowEl.style.background = 'rgba(255, 105, 180, 0.9)';
                glowEl.style.boxShadow = '0 0 100px rgba(255, 105, 180, 0.8)';
            } else {
                // Adaptive color reading from video
                if (!videoEl.paused && !videoEl.ended && videoEl.readyState > 2) {
                    try {
                        this.ctx.drawImage(videoEl, 0, 0, 64, 64);
                        const data = this.ctx.getImageData(0, 0, 64, 64).data;
                        let r = 0, g = 0, b = 0, count = 0;
                        for (let i = 0; i < data.length; i += 16) {
                            r += data[i]; g += data[i+1]; b += data[i+2]; count++;
                        }
                        r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
                        const color = `rgb(${r}, ${g}, ${b})`;
                        glowEl.style.background = color;
                        glowEl.style.boxShadow = `0 0 80px ${color}, 0 0 120px ${color}`;
                    } catch(e) { 
                        // Fallback on CORS errors
                        glowEl.style.background = 'rgba(255, 255, 255, 0.05)';
                        glowEl.style.boxShadow = 'none';
                    }
                }
            }
            this.loopId = requestAnimationFrame(draw);
        };
        draw();
    }

    static updateTheme(theme) {
        const glowEl = Utils.$('ambilight-glow');
        if (glowEl && theme === 'love') {
            glowEl.style.background = 'rgba(255, 105, 180, 0.9)';
            glowEl.style.boxShadow = '0 0 100px rgba(255, 105, 180, 0.8)';
        }
    }

    static stop() {
        if (this.loopId) cancelAnimationFrame(this.loopId);
        const glowEl = Utils.$('ambilight-glow');
        if (glowEl) { glowEl.style.background = 'transparent'; glowEl.style.boxShadow = 'none'; }
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
                const isLight = document.body.classList.contains('theme-light-global');
                ctx.fillStyle = isLight ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.78)";
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        
        for (let i = 0; i < 90; i++) dots.push(new Dot()); 
        
        function animate() {
            if (!isTabVisible) return; 
            ctx.clearRect(0, 0, canvas.width, canvas.height); // [FIX] Made clearRect so premium background shines through beautifully

            for (let i = 0; i < dots.length; i++) {
                dots[i].update(); dots[i].draw();
                for (let j = i + 1; j < dots.length; j++) {
                    let dx = dots[i].x - dots[j].x;
                    let dy = dots[i].y - dots[j].y;
                    let dist = dx * dx + dy * dy; 
                    if (dist < 25000) { 
                        const isLight = document.body.classList.contains('theme-light-global');
                        const alpha = Math.max(0.16, 0.78 - Math.sqrt(dist) / 1000);
                        ctx.strokeStyle = isLight ? `rgba(0, 0, 0, ${Math.min(0.95, alpha)})` : `rgba(255, 255, 255, ${alpha})`; 
                        ctx.lineWidth = isLight ? 1.6 : 1.4;
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

class EasterEggManager {
    static DURATION = 5000; // ПАТЧ: Увеличено время работы всех пасхалок до 15 секунд
    static SOUND_URLS = {
        notification: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
        glass: 'https://actions.google.com/sounds/v1/impacts/glass_shatters_into_debris.ogg',
        vader: 'https://actions.google.com/sounds/v1/science_fiction/alien_breath.ogg'
    };
    static COMMANDS = new Map([
        ['/moo', 'moo'],
        ['/grass', 'grass'],
        ['/milk', 'milk'],
        ['/popcorn', 'popcorn'],
        ['/dvd', 'dvd'],
        ['/roll', 'roll'],
        ['/matrix', 'matrix'],
        ['/shh', 'shh'],
        ['/nyan', 'nyan']
    ]);
    static KEYWORD_EFFECTS = {
        COWIO: 'cow-cursor',
        GLASS: 'glass',
        CINEMA: 'cinema',
        POTATO: 'potato',
        NINJA: 'ninja',
        ZOMBIE: 'zombie',
        SPACE: 'space',
        MIRROR: 'mirror'
    };
    static KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    static init() {
        this.injectStyles();
        this.ensureFxRoot();
        this.bindKeyboard();
    }

    static injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            body.easter-green {
                --bg: #031507;
                --panel: rgba(8, 28, 10, 0.92);
                --panel-hover: rgba(15, 45, 17, 0.96);
                --border: rgba(90, 255, 132, 0.16);
                --border-light: rgba(90, 255, 132, 0.32);
                --text-main: #eaffec;
                --text-muted: #8ec99a;
                --accent: #69ff88;
                --accent-hover: #43d762;
                --brand: #b7ffc4;
            }
            body.easter-roll #room-screen,
            body.easter-roll #lobby-screen {
                animation: easterRoll 15s cubic-bezier(0.22, 1, 0.36, 1);
                transform-origin: center center;
            }
            body.easter-matrix {
                background: #020704;
                color: #6dff8c;
                text-shadow: 0 0 8px rgba(109, 255, 140, 0.2);
            }
            body.easter-matrix .glass-panel,
            body.easter-matrix .chat-section,
            body.easter-matrix .bubble,
            body.easter-matrix .room-card,
            body.easter-matrix .user-item,
            body.easter-matrix .friend-item {
                border-color: rgba(109, 255, 140, 0.24) !important;
                background: rgba(5, 20, 8, 0.78) !important;
                box-shadow: 0 0 18px rgba(17, 255, 105, 0.08);
            }
            body.easter-vhs,
            body.easter-cinema,
            body.easter-zombie,
            body.easter-potato,
            body.easter-mirror,
            body.easter-space {
                transition: filter 0.9s ease, transform 0.9s ease;
            }
            body.easter-vhs { filter: saturate(0.8) contrast(1.08); }
            body.easter-zombie { filter: grayscale(1) contrast(1.15); }
            body.easter-potato * {
                font-family: "Comic Sans MS", "Comic Neue", cursive !important;
                image-rendering: pixelated;
            }
            body.easter-potato {
                filter: contrast(1.25) saturate(0.82);
            }
            body.easter-mirror {
                transform: scaleX(-1);
                transform-origin: center center;
            }
            body.easter-space .glass-panel,
            body.easter-space .room-card,
            body.easter-space .user-item,
            body.easter-space .friend-item,
            body.easter-space .chat-section,
            body.easter-space .player-section {
                animation: easterFloatPanels 4s ease-in-out infinite;
            }
            body.easter-space .room-card:nth-child(2n),
            body.easter-space .user-item:nth-child(2n),
            body.easter-space .friend-item:nth-child(2n) {
                animation-delay: -1.2s;
            }
            body.easter-hide-ui #room-screen .chat-section,
            body.easter-hide-ui #room-screen .room-top-bar {
                opacity: 0;
                transform: translateY(-18px) scale(0.98);
                pointer-events: none;
            }
            body.easter-cow-cursor,
            body.easter-cow-cursor * {
                cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='18' fill='%23fffef8' stroke='%23111111' stroke-width='2'/%3E%3Cellipse cx='14' cy='13' rx='6' ry='8' fill='%23642f1a'/%3E%3Cellipse cx='34' cy='13' rx='6' ry='8' fill='%23642f1a'/%3E%3Cellipse cx='24' cy='28' rx='12' ry='9' fill='%23f6b3c1' stroke='%23111111' stroke-width='1.5'/%3E%3Ccircle cx='20' cy='27' r='2' fill='%23111111'/%3E%3Ccircle cx='28' cy='27' r='2' fill='%23111111'/%3E%3Ccircle cx='18' cy='20' r='2.5' fill='%23111111'/%3E%3Ccircle cx='30' cy='20' r='2.5' fill='%23111111'/%3E%3Cpath d='M19 35c2 2 8 2 10 0' fill='none' stroke='%23111111' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, auto !important;
            }
            #easter-egg-root {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 4000;
                overflow: hidden;
            }
            .easter-overlay {
                position: absolute;
                inset: 0;
                opacity: 0;
                transition: opacity 1s ease, transform 1s ease;
            }
            .easter-overlay.active {
                opacity: 1;
            }
            .easter-drop {
                position: absolute;
                top: -12vh;
                font-size: clamp(30px, 4vw, 50px);
                animation: easterPopcornDrop linear forwards;
                text-shadow: 0 6px 15px rgba(0,0,0,0.5);
            }
            #dvd-overlay {
                overflow: hidden;
            }
            .dvd-logo {
                position: absolute;
                left: 24px;
                top: 24px;
                padding: 14px 20px;
                border-radius: 18px;
                background: rgba(255,255,255,0.12);
                border: 1px solid rgba(255,255,255,0.35);
                color: #fff;
                font-size: 34px;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                backdrop-filter: blur(12px);
                box-shadow: 0 12px 30px rgba(0,0,0,0.35);
            }
            #matrix-canvas,
            #vhs-canvas {
                width: 100%;
                height: 100%;
            }
            #vhs-overlay {
                mix-blend-mode: screen;
            }
            #glass-overlay svg {
                width: 100%;
                height: 100%;
                animation: shatterPulse 0.2s ease-out;
            }
            #cinema-overlay {
                background: rgba(0,0,0,0.65);
            }
            #nyan-overlay {
                position: absolute;
                left: 50%;
                bottom: 28px;
                width: min(460px, 80vw);
                height: 22px;
                transform: translateX(-50%);
                border-radius: 999px;
                background: linear-gradient(90deg, #ff004c, #ff9100, #ffe600, #2eff7b, #00c2ff, #5b5bff, #ff00c8);
                background-size: 220% 100%;
                animation: nyanRainbow 1.4s linear infinite;
                box-shadow: 0 0 20px rgba(255,255,255,0.16);
            }
            #nyan-overlay::before {
                content: 'NYAN';
                position: absolute;
                right: 12px;
                top: -28px;
                font-size: 12px;
                letter-spacing: 2px;
                color: #fff;
                opacity: 0.8;
            }
            .nyan-cat {
                position: absolute;
                left: 0;
                top: 50%;
                transform: translate(-50%, -50%);
                font-size: 48px;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));
                animation: nyanCruise 15s ease-in-out forwards;
            }
            body.easter-nyan #native-player,
            body.easter-nyan .video-container {
                filter: hue-rotate(0deg) saturate(1.35);
                animation: nyanVideo 1.8s linear infinite;
            }
            #crack-overlay path {
                fill: none;
                stroke: rgba(255,255,255,0.86);
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                filter: drop-shadow(0 0 6px rgba(255,255,255,0.35));
            }
            
            /* ADVANCED MILK STYLES - FIXED & OPTIMIZED */
            #advanced-milk-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 5000; pointer-events: none; overflow: hidden; display: block;
            }
            #fluid-canvas {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5001; pointer-events: none;
            }
            #milk-glass {
                position: absolute; font-size: 120px; z-index: 5002; opacity: 0;
                transform: scale(0) rotate(-20deg); transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: none; filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.5));
                top: 50%; left: 50%; margin-top: -60px; margin-left: -60px;
            }
            #milk-glass.active { opacity: 1; transform: scale(1.4) rotate(0deg); }
            #milk-glass.pouring { animation: easterShake 0.15s infinite; }
            @keyframes easterShake {
                0% { transform: scale(1.4) rotate(-3deg) translateY(0); }
                50% { transform: scale(1.4) rotate(3deg) translateY(-8px); }
                100% { transform: scale(1.4) rotate(-3deg) translateY(0); }
            }
            @keyframes shatterPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }

            @keyframes easterPopcornDrop {
                0% { transform: translate3d(0, -10vh, 0) rotate(0deg) scale(1); opacity: 0; }
                10% { opacity: 1; }
                80% { transform: translate3d(var(--drift, 0px), 80vh, 0) rotate(360deg) scale(1.2); opacity: 1; }
                100% { transform: translate3d(var(--drift, 0px), 120vh, 0) rotate(460deg) scale(0.8); opacity: 0; }
            }
            @keyframes easterRoll {
                0% { transform: rotate(0deg) scale(1); }
                50% { transform: rotate(180deg) scale(0.98); }
                100% { transform: rotate(360deg) scale(1); }
            }
            @keyframes easterFloatPanels {
                0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
                25% { transform: translate3d(10px, -12px, 0) rotate(0.8deg); }
                50% { transform: translate3d(-12px, -24px, 0) rotate(-0.8deg); }
                75% { transform: translate3d(8px, -10px, 0) rotate(0.6deg); }
            }
            @keyframes nyanRainbow {
                from { background-position: 0% 50%; }
                to { background-position: 220% 50%; }
            }
            @keyframes nyanCruise {
                0% { left: -10%; transform: translate(-50%, -50%) rotate(-5deg); }
                50% { transform: translate(-50%, -60%) rotate(5deg); }
                100% { left: 110%; transform: translate(-50%, -50%) rotate(-5deg); }
            }
            @keyframes nyanVideo {
                0% { filter: hue-rotate(0deg) saturate(1.2); }
                100% { filter: hue-rotate(360deg) saturate(1.45); }
            }
        `;
        document.head.appendChild(style);
    }

    static ensureFxRoot() {
        if (Utils.$('easter-egg-root')) return;
        const root = document.createElement('div');
        root.id = 'easter-egg-root';
        root.innerHTML = `
            <div id="green-overlay" class="easter-overlay" style="background: radial-gradient(circle at 20% 20%, rgba(86, 255, 137, 0.18), transparent 35%), linear-gradient(160deg, rgba(4, 22, 8, 0.25), rgba(4, 22, 8, 0.58));"></div>
            <div id="dvd-overlay" class="easter-overlay"></div>
            <div id="matrix-overlay" class="easter-overlay"><canvas id="matrix-canvas"></canvas></div>
            <div id="vhs-overlay" class="easter-overlay"><canvas id="vhs-canvas"></canvas></div>
            <div id="glass-overlay" class="easter-overlay"></div>
            <div id="cinema-overlay" class="easter-overlay"></div>
            <div id="popcorn-overlay" class="easter-overlay"></div>
            <div id="nyan-overlay" class="easter-overlay"><div class="nyan-cat">🐱🌈</div></div>
        `;
        document.body.appendChild(root);
    }

    static bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const isEditable = target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA/.test(target.tagName));
            if (isEditable && target instanceof HTMLInputElement && target.type === 'password') return;
            this.handleKonami(e.key);
            this.handleWordSequence(e.key);
        });
    }

    static handleKonami(key) {
        const expected = this.KONAMI[AppState.easterEggs.konamiIndex];
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        if (normalized === expected) {
            AppState.easterEggs.konamiIndex += 1;
            if (AppState.easterEggs.konamiIndex === this.KONAMI.length) {
                AppState.easterEggs.konamiIndex = 0;
                this.activateLocalEffect('konami', () => this.startVhs(), () => this.stopVhs());
            }
            return;
        }
        AppState.easterEggs.konamiIndex = normalized === this.KONAMI[0] ? 1 : 0;
    }

    static handleWordSequence(key) {
        if (!/^[a-zа-я]$/i.test(key)) return;
        const now = Date.now();
        AppState.easterEggs.keyBuffer = now - AppState.easterEggs.lastKeyTs > 1200 ? '' : AppState.easterEggs.keyBuffer;
        AppState.easterEggs.lastKeyTs = now;
        AppState.easterEggs.keyBuffer = `${AppState.easterEggs.keyBuffer}${key.toUpperCase()}`.slice(-12);

        Object.entries(this.KEYWORD_EFFECTS).forEach(([word, effect]) => {
            if (AppState.easterEggs.keyBuffer.endsWith(word)) {
                AppState.easterEggs.keyBuffer = '';
                this.runLocalKeyword(effect);
            }
        });
    }

    static runLocalKeyword(effect) {
        if (effect === 'cow-cursor') return this.activateLocalEffect('cow-cursor', () => document.body.classList.add('easter-cow-cursor'), () => document.body.classList.remove('easter-cow-cursor'));
        if (effect === 'glass') return this.activateLocalEffect('glass-local', () => this.startGlassCrack(true), () => this.stopGlassCrack());
        if (effect === 'cinema') return this.activateLocalEffect('cinema', () => this.showOverlay('cinema-overlay'), () => this.hideOverlay('cinema-overlay'));
        if (effect === 'potato') return this.activateLocalEffect('potato', () => document.body.classList.add('easter-potato'), () => document.body.classList.remove('easter-potato'));
        if (effect === 'ninja') return this.activateLocalEffect('ninja', () => document.body.classList.add('easter-hide-ui'), () => document.body.classList.remove('easter-hide-ui'));
        if (effect === 'zombie') return this.activateLocalEffect('zombie', () => this.startZombie(), () => this.stopZombie());
        if (effect === 'space') return this.activateLocalEffect('space', () => document.body.classList.add('easter-space'), () => document.body.classList.remove('easter-space'));
        if (effect === 'mirror') return this.activateLocalEffect('mirror', () => document.body.classList.add('easter-mirror'), () => document.body.classList.remove('easter-mirror'));
    }

    static async handleChatInput(text, chatRef, uid) {
        const trimmed = text.trim();
        const command = this.COMMANDS.get(trimmed.toLowerCase());
        if (command) {
            await this.emitRoomEffect(command, { from: AppState.currentUser.displayName || 'Кто-то' });
            Utils.toast(`Пасхалка ${trimmed} активирована`, 'info');
            return true;
        }

        if (trimmed.toLowerCase() === 'i am your father') {
            await push(chatRef, { uid, name: AppState.currentUser.displayName, text: trimmed, ts: Date.now() });
            await this.emitRoomEffect('vader', { from: AppState.currentUser.displayName || 'Кто-то' });
            return true;
        }

        return false;
    }

    static async emitRoomEffect(type, extra = {}) {
        if (!AppState.currentRoomId) return;
        await push(ref(db, `rooms/${AppState.currentRoomId}/easterEggs`), {
            type,
            ts: Date.now(),
            uid: AppState.currentUser?.uid || null,
            ...extra
        });
    }

    static bindRoom(roomId) {
        AppState.easterEggs.processedRoomEvents.clear();
        AppState.currentRoomJoinTs = Date.now(); // ФИКС: Запоминаем время входа, чтобы не смотреть старые пасхалки

        const fxRef = ref(db, `rooms/${roomId}/easterEggs`);
        const unsub = onChildAdded(fxRef, (snap) => {
            const payload = snap.val();
            if (!payload) return;
            
            // ФИКС СИНХРОНИЗАЦИИ: Игнорируем все, что было вызвано ДО захода в комнату, и старше 15 сек.
            if (Date.now() - Number(payload.ts || 0) > 15000) return;
            if (Number(payload.ts || 0) < AppState.currentRoomJoinTs) return;

            if (AppState.easterEggs.processedRoomEvents.has(snap.key)) return;
            AppState.easterEggs.processedRoomEvents.add(snap.key);
            this.applyRoomEffect(payload);
        });
        AppState.roomSubscriptions.push(() => off(fxRef, 'child_added', unsub));
    }

    static applyRoomEffect(payload) {
            const fromName = payload.from ? ` от ${payload.from}` : '';
        switch (payload.type) {
            case 'moo':
                Utils.toast(`Муууу${fromName}`, 'info');
                this.activateLocalEffect('moo', () => {
                    this.playMoo();
                    const interval = setInterval(() => this.playMoo(), 1500);
                    AppState.easterEggs.animationHandles.set('moo', interval);
                }, () => {
                    clearInterval(AppState.easterEggs.animationHandles.get('moo'));
                    AppState.easterEggs.animationHandles.delete('moo');
                });
                break;
            case 'grass':
                this.activateLocalEffect('grass', () => {
                    document.body.classList.add('easter-green');
                    this.showOverlay('green-overlay');
                }, () => {
                    document.body.classList.remove('easter-green');
                    this.hideOverlay('green-overlay');
                });
                break;
            case 'milk':
                this.startAdvancedMilk();
                break;
            case 'popcorn':
                this.activateLocalEffect('popcorn', () => this.startPopcornRain(), () => this.stopPopcornRain());
                break;
            case 'dvd':
                this.activateLocalEffect('dvd', () => this.startDvd(), () => this.stopDvd());
                break;
            case 'roll':
                this.activateLocalEffect('roll', () => document.body.classList.add('easter-roll'), () => document.body.classList.remove('easter-roll'));
                break;
            case 'matrix':
                this.activateLocalEffect('matrix', () => this.startMatrix(), () => this.stopMatrix());
                break;
            case 'shh':
                this.activateLocalEffect('shh', () => {
                    AppState.easterEggs.notificationMutedUntil = Date.now() + this.DURATION;
                    Utils.toast('Уведомления приглушены на 15 секунд', 'info');
                }, () => { AppState.easterEggs.notificationMutedUntil = 0; });
                break;
            case 'vader':
                this.activateLocalEffect('vader', () => this.playVaderBreath(), () => {});
                break;
            case 'nyan':
                this.activateLocalEffect('nyan', () => this.startNyan(), () => this.stopNyan());
                break;
            default:
                break;
        }
    }

    static activateLocalEffect(name, start, stop, duration = this.DURATION) {
        const existing = AppState.easterEggs.activeEffects.get(name);
        if (existing) {
            clearTimeout(existing.timer);
            existing.stop?.();
        }
        start?.();
        const timer = setTimeout(() => {
            stop?.();
            AppState.easterEggs.activeEffects.delete(name);
        }, duration);
        AppState.easterEggs.activeEffects.set(name, { stop, timer });
    }

    static cleanupAllEffects() {
        for (const { stop, timer } of AppState.easterEggs.activeEffects.values()) {
            clearTimeout(timer);
            stop?.();
        }
        AppState.easterEggs.activeEffects.clear();
        AppState.easterEggs.notificationMutedUntil = 0;
        ['easter-green', 'easter-roll', 'easter-matrix', 'easter-vhs', 'easter-potato', 'easter-mirror', 'easter-space', 'easter-hide-ui', 'easter-cow-cursor', 'easter-nyan', 'easter-zombie'].forEach(cls => document.body.classList.remove(cls));
        ['green-overlay', 'dvd-overlay', 'matrix-overlay', 'vhs-overlay', 'glass-overlay', 'cinema-overlay', 'popcorn-overlay', 'nyan-overlay'].forEach(id => this.hideOverlay(id));
        this.stopMatrix();
        this.stopVhs();
        this.stopPopcornRain();
        this.stopDvd();
        this.stopGlassCrack();
        this.stopNyan();
        this.stopZombie();
        this.stopAdvancedMilk();
    }

    // ADVANCED MILK SIMULATION (ФИКСИРОВАННАЯ И ОПТИМИЗИРОВАННАЯ ВЕРСИЯ - 15 Секунд)
    static startAdvancedMilk() {
        if (this.milkActive) return;
        this.milkActive = true;

        let container = Utils.$('advanced-milk-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'advanced-milk-container';
            container.style.opacity = '0'; // Для эффекта Fade-in
            container.style.transition = 'opacity 1s ease';
            container.innerHTML = `
                <div id="milk-glass">🥛</div>
                <canvas id="fluid-canvas"></canvas>
            `;
            document.body.appendChild(container);
        }
        
        // Запускаем Fade-in
        setTimeout(() => {
            if (Utils.$('advanced-milk-container')) Utils.$('advanced-milk-container').style.opacity = '1';
        }, 50);

        const canvas = Utils.$('fluid-canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        const glass = Utils.$('milk-glass');

        let width, height;
        let particles = [];

        class Particle {
            constructor(x, y) {
                this.x = x; this.y = y; 
                const angle = (Math.random() - 0.5) * Math.PI; // Explode upwards
                const speed = Math.random() * 25 + 10;
                this.vx = Math.sin(angle) * speed; 
                this.vy = -Math.cos(angle) * speed - 15; // Shoot up stronger
                this.size = Math.random() * 12 + 4; 
                this.life = 1.0; 
                this.decay = Math.random() * 0.015 + 0.01;
                this.color = `rgba(255, 255, 255, `;
            }
            update() {
                this.vy += 0.8; // Gravity
                this.x += this.vx; this.y += this.vy;
                this.life -= this.decay; 
            }
            draw(ctx) {
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color + this.life + ')'; 
                ctx.shadowColor = 'rgba(255,255,255,0.8)';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0; // reset
            }
        }

        this.milkResizeHandler = () => {
            width = window.innerWidth; height = window.innerHeight;
            canvas.width = width * (window.devicePixelRatio || 1);
            canvas.height = height * (window.devicePixelRatio || 1);
            ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        };
        window.addEventListener('resize', this.milkResizeHandler);
        this.milkResizeHandler();

        const loop = () => {
            ctx.clearRect(0, 0, width, height); // Прозрачный фон
            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update(); 
                if (particles[i].life <= 0) particles.splice(i, 1);
                else particles[i].draw(ctx);
            }
            this.milkAnimFrame = requestAnimationFrame(loop);
        };
        loop();

        setTimeout(() => {
            glass.classList.add('active');
            setTimeout(() => {
                glass.classList.add('pouring');
                
                // Burst particles like a fountain from the glass
                this.milkStreamInterval = setInterval(() => {
                    const rect = glass.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2 - 20;
                    for(let i=0; i<8; i++) {
                        particles.push(new Particle(cx, cy));
                    }
                }, 30);

                setTimeout(() => {
                    clearInterval(this.milkStreamInterval);
                    glass.classList.remove('pouring'); glass.classList.remove('active');
                    setTimeout(() => {
                        if (Utils.$('advanced-milk-container')) Utils.$('advanced-milk-container').style.opacity = '0';
                        setTimeout(() => {
                            this.stopAdvancedMilk();
                        }, 1000); // Даем 1 секунду на анимацию затухания
                    }, 2000); // Даем частицам упасть
                }, 12500); // Длительность фонтана ~12.5s (итого ~15s с затуханием)
            }, 800); // Ждем пока стакан увеличится
        }, 100);
    }

    static stopAdvancedMilk() {
        if (!this.milkActive) return;
        this.milkActive = false;
        const container = Utils.$('advanced-milk-container');
        if (container) container.remove();
        if (this.milkAnimFrame) cancelAnimationFrame(this.milkAnimFrame);
        if (this.milkStreamInterval) clearInterval(this.milkStreamInterval);
        if (this.milkResizeHandler) window.removeEventListener('resize', this.milkResizeHandler);
    }

    static playNotification() {
        if (Date.now() < AppState.easterEggs.notificationMutedUntil) return;
        this.playSound(this.SOUND_URLS.notification, { volume: 0.28, fallback: () => this.playSimpleTone(880, 0.09, 'square', 0.05) });
    }

    static playMoo() {
        const audioCtx = this.getAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        const low = audioCtx.createOscillator();
        const high = audioCtx.createOscillator();
        low.type = 'sawtooth';
        high.type = 'triangle';
        low.frequency.setValueAtTime(160, now);
        low.frequency.exponentialRampToValueAtTime(105, now + 1.1);
        high.frequency.setValueAtTime(320, now);
        high.frequency.exponentialRampToValueAtTime(210, now + 1.1);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
        low.connect(gain);
        high.connect(gain);
        gain.connect(audioCtx.destination);
        low.start(now);
        high.start(now);
        low.stop(now + 1.35);
        high.stop(now + 1.35);
    }

    static playVaderBreath() {
        this.playSound(this.SOUND_URLS.vader, {
            volume: 0.45,
            fallback: () => {
                const audioCtx = this.getAudioContext();
                if (!audioCtx) return;
                const now = audioCtx.currentTime;
                const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2.2, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i += 1) {
                    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
                }
                const src = audioCtx.createBufferSource();
                const filter = audioCtx.createBiquadFilter();
                const gain = audioCtx.createGain();
                src.buffer = buffer;
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(420, now);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.12, now + 0.25);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
                src.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
                src.start(now);
            }
        });
    }

    static startPopcornRain() {
        this.showOverlay('popcorn-overlay');
        const overlay = Utils.$('popcorn-overlay');
        const spawn = () => {
            if (!overlay) return;
            const item = document.createElement('div');
            item.className = 'easter-drop';
            item.innerText = ['🍿', '🍿', '✨'][Math.floor(Math.random() * 3)];
            item.style.left = `${Math.random() * 100}%`;
            item.style.animationDuration = `${2.1 + Math.random() * 1.4}s`;
            item.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
            overlay.appendChild(item);
            setTimeout(() => item.remove(), 3800);
        };
        for (let i = 0; i < 12; i += 1) setTimeout(spawn, i * 110);
        const interval = setInterval(spawn, 120);
        AppState.easterEggs.animationHandles.set('popcorn', interval);
    }

    static stopPopcornRain() {
        this.hideOverlay('popcorn-overlay');
        setTimeout(() => {
            const overlay = Utils.$('popcorn-overlay');
            if (overlay && !overlay.classList.contains('active')) {
                clearInterval(AppState.easterEggs.animationHandles.get('popcorn'));
                AppState.easterEggs.animationHandles.delete('popcorn');
                overlay.innerHTML = '';
            }
        }, 1000);
    }

    static startDvd() {
        this.showOverlay('dvd-overlay');
        const overlay = Utils.$('dvd-overlay');
        if (!overlay) return;
        overlay.innerHTML = '<div class="dvd-logo">COWIO</div>';
        const logo = overlay.firstElementChild;
        let x = 40;
        let y = 40;
        let dx = 3.4;
        let dy = 2.7;
        const step = () => {
            const bounds = overlay.getBoundingClientRect();
            const logoRect = logo.getBoundingClientRect();
            x += dx;
            y += dy;
            if (x <= 0 || x + logoRect.width >= bounds.width) dx *= -1;
            if (y <= 0 || y + logoRect.height >= bounds.height) dy *= -1;
            logo.style.transform = `translate(${x}px, ${y}px)`;
            const raf = requestAnimationFrame(step);
            AppState.easterEggs.animationHandles.set('dvd', raf);
        };
        step();
    }

    static stopDvd() {
        this.hideOverlay('dvd-overlay');
        setTimeout(() => {
            const overlay = Utils.$('dvd-overlay');
            if (overlay && !overlay.classList.contains('active')) {
                cancelAnimationFrame(AppState.easterEggs.animationHandles.get('dvd'));
                AppState.easterEggs.animationHandles.delete('dvd');
                overlay.innerHTML = '';
            }
        }, 1000);
    }

    static startMatrix() {
        document.body.classList.add('easter-matrix');
        this.showOverlay('matrix-overlay');
        const canvas = Utils.$('matrix-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        const fontSize = 18;
        const columns = Math.ceil(canvas.width / fontSize);
        const drops = Array(columns).fill(1);
        const chars = '01アカサタナハマヤラワXYZ$#<>[]{}';
        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#69ff88';
            ctx.fillStyle = '#69ff88';
            ctx.font = `${fontSize}px monospace`;
            for (let i = 0; i < drops.length; i += 1) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) drops[i] = 0;
                drops[i] += 1;
            }
            ctx.shadowBlur = 0; // reset
            const raf = requestAnimationFrame(draw);
            AppState.easterEggs.animationHandles.set('matrix', raf);
        };
        draw();
    }

    static stopMatrix() {
        document.body.classList.remove('easter-matrix');
        this.hideOverlay('matrix-overlay');
        setTimeout(() => {
            const overlay = Utils.$('matrix-overlay');
            if (overlay && !overlay.classList.contains('active')) {
                cancelAnimationFrame(AppState.easterEggs.animationHandles.get('matrix'));
                AppState.easterEggs.animationHandles.delete('matrix');
                const canvas = Utils.$('matrix-canvas');
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }, 1000);
    }

    static startVhs() {
        document.body.classList.add('easter-vhs');
        this.showOverlay('vhs-overlay');
        const canvas = Utils.$('vhs-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            for (let y = 0; y < canvas.height; y += 4) {
                ctx.fillRect(0, y, canvas.width, 1);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            for (let i = 0; i < 24; i += 1) {
                ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 180, 1);
            }
            ctx.fillStyle = 'rgba(255,0,120,0.08)';
            ctx.fillRect(Math.random() * 20, 0, canvas.width, canvas.height);
            const raf = requestAnimationFrame(draw);
            AppState.easterEggs.animationHandles.set('vhs', raf);
        };
        draw();
    }

    static stopVhs() {
        document.body.classList.remove('easter-vhs');
        this.hideOverlay('vhs-overlay');
        setTimeout(() => {
            const overlay = Utils.$('vhs-overlay');
            if (overlay && !overlay.classList.contains('active')) {
                cancelAnimationFrame(AppState.easterEggs.animationHandles.get('vhs'));
                AppState.easterEggs.animationHandles.delete('vhs');
                const canvas = Utils.$('vhs-canvas');
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }, 1000);
    }

    static startGlassCrack(playSound = false) {
        this.showOverlay('glass-overlay');
        const overlay = Utils.$('glass-overlay');
        if (!overlay) return;
        overlay.innerHTML = `
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <g id="crack-overlay">
                    <path d="M50 0 L49 24 L60 38 L55 56 L68 79 L60 100" />
                    <path d="M49 24 L35 18 L22 26 L9 24" />
                    <path d="M60 38 L78 35 L92 44" />
                    <path d="M55 56 L42 64 L36 80 L28 100" />
                    <path d="M68 79 L82 74 L100 82" />
                    <path d="M42 64 L30 60 L18 67 L0 62" />
                    <path d="M35 18 L30 8 L18 0" />
                </g>
            </svg>
        `;
        if (playSound) {
            this.playSound(this.SOUND_URLS.glass, { volume: 0.35, fallback: () => this.playSimpleTone(180, 0.18, 'sawtooth', 0.05) });
        }
    }

    static stopGlassCrack() {
        this.hideOverlay('glass-overlay');
        setTimeout(() => {
            const overlay = Utils.$('glass-overlay');
            if (overlay && !overlay.classList.contains('active')) overlay.innerHTML = '';
        }, 1000);
    }

    static startNyan() {
        document.body.classList.add('easter-nyan');
        const overlay = Utils.$('nyan-overlay');
        if (overlay) overlay.innerHTML = '<div class="nyan-cat">🐱🌈</div>';
        this.showOverlay('nyan-overlay');
    }

    static stopNyan() {
        document.body.classList.remove('easter-nyan');
        this.hideOverlay('nyan-overlay');
        setTimeout(() => {
            const overlay = Utils.$('nyan-overlay');
            if (overlay && !overlay.classList.contains('active')) overlay.innerHTML = '';
        }, 1000);
    }

    static startZombie() {
        document.body.classList.add('easter-zombie');
        const video = Utils.$('native-player');
        if (video) {
            video.dataset.originalPlaybackRate = String(video.playbackRate || 1);
            video.playbackRate = 0.5;
        }
    }

    static stopZombie() {
        document.body.classList.remove('easter-zombie');
        setTimeout(() => {
            const video = Utils.$('native-player');
            if (video && video.dataset.originalPlaybackRate) {
                video.playbackRate = Number(video.dataset.originalPlaybackRate || 1);
                delete video.dataset.originalPlaybackRate;
            }
        }, 1000);
    }

    static showOverlay(id) {
        const el = Utils.$(id);
        if (el) el.classList.add('active');
    }

    static hideOverlay(id) {
        const el = Utils.$(id);
        if (el) el.classList.remove('active');
    }

    static getAudioContext() {
        if (!this.audioContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            this.audioContext = new Ctx();
        }
        if (this.audioContext.state === 'suspended') this.audioContext.resume().catch(() => {});
        return this.audioContext;
    }

    static playSimpleTone(frequency, duration, type = 'sine', gainValue = 0.04) {
        const audioCtx = this.getAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(gainValue, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    static playSound(url, { volume = 0.35, fallback } = {}) {
        const audio = new Audio(url);
        audio.volume = volume;
        audio.preload = 'auto';
        AppState.easterEggs.audioPool.add(audio);
        const cleanup = () => AppState.easterEggs.audioPool.delete(audio);
        audio.onended = cleanup;
        audio.onerror = () => {
            cleanup();
            fallback?.();
        };
        audio.play().then(() => {
            setTimeout(() => cleanup(), 6000);
        }).catch(() => {
            cleanup();
            fallback?.();
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

class HashtagManager {
    static defaultTags = ['#music', '#movies', '#gaming', '#love', '#chill', '#anime', '#coding', '#friends'];

    static initHashtags() {
        this.bindHashtagInput('edit-hashtags', 'profile-hashtag-suggestions', false);
        this.bindHashtagInput('room-input-hashtag', 'room-hashtag-suggestions', true);
    }

    static parseHashtags(rawValue = '', single = false) {
        const tokens = String(rawValue || '')
            .split(/\s+/)
            .map(token => this.normalizeTag(token))
            .filter(Boolean);
        const unique = Array.from(new Set(tokens));
        return single ? unique.slice(0, 1) : unique.slice(0, 10);
    }

    static normalizeTag(value = '') {
        const clean = String(value || '')
            .replace(/#/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-zа-я0-9_]/gi, '');
        return clean ? `#${clean}` : '';
    }

    static collectTags() {
        const tags = new Set(this.defaultTags);
        AppState.usersCache.forEach((profile) => {
            if (!Array.isArray(profile?.hashtags)) return;
            profile.hashtags.forEach(tag => {
                const normalized = this.normalizeTag(tag);
                if (normalized) tags.add(normalized);
            });
        });
        AppState.roomsCache.forEach((room) => {
            if (!Array.isArray(room?.hashtags)) return;
            room.hashtags.forEach(tag => {
                const normalized = this.normalizeTag(tag);
                if (normalized) tags.add(normalized);
            });
        });
        return Array.from(tags);
    }

    static bindHashtagInput(inputId, suggestionsId, single = false) {
        const input = Utils.$(inputId);
        const suggestions = Utils.$(suggestionsId);
        if (!input || !suggestions) return;

        const updateSuggestions = () => {
            const current = input.value.trim().toLowerCase().replace('#', '');
            const pool = this.collectTags();
            const filtered = pool
                .filter(tag => !current || tag.includes(current))
                .slice(0, 6);

            if (!filtered.length) {
                suggestions.classList.remove('active');
                suggestions.innerHTML = '';
                return;
            }

            suggestions.innerHTML = filtered
                .map(tag => `<button class="hashtag-suggestion-item" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}</button>`)
                .join('');
            suggestions.classList.add('active');

            suggestions.querySelectorAll('.hashtag-suggestion-item').forEach(btn => {
                btn.onclick = () => {
                    const tag = btn.dataset.tag || '';
                    if (single) input.value = tag;
                    else {
                        const existing = this.parseHashtags(input.value, false).filter(t => t !== tag);
                        input.value = [...existing, tag].join(' ');
                    }
                    suggestions.classList.remove('active');
                };
            });
        };

        input.addEventListener('focus', updateSuggestions);
        input.addEventListener('input', updateSuggestions);
        input.addEventListener('blur', () => setTimeout(() => suggestions.classList.remove('active'), 120));
    }
}

class ProfileManager {
    static backgroundPresets = ['#1f2937', '#f8fafc', '#ff6fae', '#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#f59e0b', '#ef4444', '#111111', '#8b5cf6', '#14b8a6']; // [NEW]

    static getRoleBadgeHtml(profile, uid = null) {
        if (!profile) return '';
        const badges = []; // [UPDATE]
        if (AdminPanel.isCreatorProfile(profile, uid)) badges.push(`<span class="role-badge badge-creator">Создатель</span>`); // [UPDATE]
        if (AdminPanel.isModeratorProfile(profile, uid)) badges.push(`<span class="role-badge badge-moderator">Модератор</span>`); // [UPDATE]
        if (profile?.partner) badges.push(`<span class="partner-badge">💖 Пара</span>`); // [UPDATE]
        return badges.join(' '); // [UPDATE]
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
            background: { color: '#1f2937', index: 10, url: '', dim: 0.5 }, // [UPDATE - Default to 10 and added dim]
            hashtags: [],
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
        Utils.$('edit-hashtags').value = Array.isArray(p.hashtags) ? p.hashtags.join(' ') : '';
        Utils.$('edit-avatar-url').value = p.avatar || '';
        this.hydrateProfileBackgroundControls(p.background); // [UPDATE]
        this.updateAvatarPreview(p.avatar, p.name);
        this.applyProfileBackground(Utils.$('modal-edit-profile')?.querySelector('.modal-content'), p.background); // [NEW]
        this.renderMyPartnerBox(); // [NEW]
        this.renderLoveRequests(); // [NEW]
        
        Utils.$('modal-edit-profile').classList.add('active');
        
        // [ADD] Файловые инпуты в Base64 с превью
        if (Utils.$('edit-avatar-file')) {
            Utils.$('edit-avatar-file').onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const b64 = await Utils.fileToBase64(file, 400); // Ресайз до 400px
                    Utils.$('edit-avatar-url').value = b64;
                    this.updateAvatarPreview(b64, Utils.$('edit-name').value);
                }
            };
        }
        if (Utils.$('profile-bg-file')) {
            Utils.$('profile-bg-file').onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const b64 = await Utils.fileToBase64(file, 1000); // Ресайз до 1000px
                    Utils.$('profile-bg-url').value = b64;
                    this.updateProfileBackgroundPreview();
                }
            };
        }

        Utils.$('edit-avatar-url').oninput = Utils.debounce((e) => this.updateAvatarPreview(e.target.value, Utils.$('edit-name').value), 300);
        Utils.$('edit-name').oninput = Utils.debounce((e) => this.updateAvatarPreview(Utils.$('edit-avatar-url').value, e.target.value), 300);
        this.bindProfileBackgroundControls(); // [NEW]

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

    static normalizeHexColor(value = '#1f2937') { // [UPDATE]
        const raw = String(value || '').trim(); // [UPDATE]
        if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase(); // [NEW]
        if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase(); // [NEW]
        return '#1f2937'; // [UPDATE]
    } // [UPDATE]

    static hexToRgb(hex = '#1f2937') { // [NEW]
        const safeHex = this.normalizeHexColor(hex).slice(1); // [NEW]
        return { // [NEW]
            r: parseInt(safeHex.slice(0, 2), 16), // [NEW]
            g: parseInt(safeHex.slice(2, 4), 16), // [NEW]
            b: parseInt(safeHex.slice(4, 6), 16) // [NEW]
        }; // [NEW]
    } // [NEW]

    static rgbToHex(r = 31, g = 41, b = 55) { // [NEW]
        return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, '0')).join('')}`; // [NEW]
    } // [NEW]

    static getReadableProfileColors(hex = '#1f2937') { // [NEW]
        const { r, g, b } = this.hexToRgb(hex); // [NEW]
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // [NEW]
        const isLight = luminance > 0.58; // [NEW]
        return { // [NEW]
            text: isLight ? '#111827' : '#ffffff', // [NEW]
            muted: isLight ? '#4b5563' : 'rgba(255,255,255,0.76)', // [NEW]
            border: isLight ? 'rgba(17,24,39,0.18)' : 'rgba(255,255,255,0.22)', // [NEW]
            overlay: isLight ? 'rgba(255,255,255,0.76)' : 'rgba(0,0,0,0.42)' // [NEW]
        }; // [NEW]
    } // [NEW]

    static normalizeProfileBackground(value = '') { // [UPDATE]
        if (value && typeof value === 'object') { // [NEW]
            const color = this.normalizeHexColor(value.color); // [NEW]
            // [PATCH] Always force to 10 if invalid to keep the base style anchored
            const rawIndex = Number(value.index);
            const index = isNaN(rawIndex) || rawIndex <= 0 ? 10 : Math.max(1, Math.min(12, rawIndex)); 
            const url = this.normalizeProfileBackgroundUrl(value.url || ''); // [NEW]
            const dim = typeof value.dim !== 'undefined' ? Number(value.dim) : 0.5; // [ADD] Dim logic
            return { color, index, url, dim: Math.max(0, Math.min(1, dim)) }; // [NEW]
        } // [NEW]
        const raw = String(value || '').trim(); // [UPDATE]
        if (!raw) return { color: '#1f2937', index: 10, url: '', dim: 0.5 }; // [UPDATE]
        if (/data:image/i.test(raw) || /^https?:\/\//i.test(raw)) return { color: '#1f2937', index: 10, url: this.normalizeProfileBackgroundUrl(raw), dim: 0.5 }; // [NEW] Support base64 or http
        return { color: this.normalizeHexColor(raw), index: 10, url: '', dim: 0.5 }; // [UPDATE]
    } // [UPDATE]

    static normalizeProfileBackgroundUrl(value = '') { // [NEW]
        const raw = String(value || '').trim(); // [NEW]
        if (!raw) return ''; // [NEW]
        if (raw.startsWith('data:image')) return raw; // [ADD] Base64 allowance
        if (raw.length > 420 || /["\\]/.test(raw)) return ''; // [NEW]
        if (!/^https?:\/\//i.test(raw)) return ''; // [NEW]
        try { new URL(raw); return raw; } catch (e) { return ''; } // [NEW]
    } // [NEW]

    static readProfileBackgroundInput() { // [UPDATE]
        const r = Number(Utils.$('profile-bg-r')?.value || 31); // [NEW]
        const g = Number(Utils.$('profile-bg-g')?.value || 41); // [NEW]
        const b = Number(Utils.$('profile-bg-b')?.value || 55); // [NEW]
        const urlRaw = Utils.$('profile-bg-url')?.value.trim() || ''; // [NEW]
        const dim = Number(Utils.$('profile-bg-dim')?.value || 0.5); // [ADD]
        const url = this.normalizeProfileBackgroundUrl(urlRaw); // [NEW]
        if (urlRaw && !url && !urlRaw.startsWith('data:image')) throw new Error('Фон профиля: некорректный URL/файл'); // [UPDATE]
        return { // [UPDATE]
            color: this.rgbToHex(r, g, b), // [NEW]
            index: Number(Utils.$('profile-bg-panel')?.dataset.selectedIndex) || 10, // [PATCH] Default to 10
            url, // [NEW]
            dim // [ADD]
        }; // [NEW]
    } // [UPDATE]

    static hydrateProfileBackgroundControls(background = '') { // [NEW]
        const data = this.normalizeProfileBackground(background); // [NEW]
        const rgb = this.hexToRgb(data.color); // [NEW]
        this.renderProfileBackgroundPresets(data.index); // [NEW]
        this.setProfileBackgroundRgb(rgb.r, rgb.g, rgb.b, data.index); // [NEW]
        if (Utils.$('profile-bg-url')) Utils.$('profile-bg-url').value = data.url || ''; // [NEW]
        if (Utils.$('profile-bg-dim')) Utils.$('profile-bg-dim').value = data.dim; // [ADD]
        if (Utils.$('profile-bg-dim-num')) Utils.$('profile-bg-dim-num').value = data.dim; // [ADD]
        this.updateProfileBackgroundPreview(); // [NEW]
    } // [NEW]

    static renderProfileBackgroundPresets(activeIndex = 10) { // [NEW - Default 10]
        const container = Utils.$('profile-bg-presets'); // [NEW]
        if (!container) return; // [NEW]
        container.innerHTML = this.backgroundPresets.map((color, idx) => { // [NEW]
            const index = idx + 1; // [NEW]
            return `<button type="button" class="profile-bg-preset ${Number(activeIndex) === index ? 'active' : ''}" data-index="${index}" data-color="${color}" style="background:${color};">${index}</button>`; // [NEW]
        }).join(''); // [NEW]
        container.querySelectorAll('.profile-bg-preset').forEach(btn => { // [NEW]
            btn.onclick = () => { // [NEW]
                const rgb = this.hexToRgb(btn.dataset.color); // [NEW]
                this.setProfileBackgroundRgb(rgb.r, rgb.g, rgb.b, btn.dataset.index); // [NEW]
                this.renderProfileBackgroundPresets(btn.dataset.index); // [NEW]
                this.updateProfileBackgroundPreview(); // [NEW]
            }; // [NEW]
        }); // [NEW]
    } // [NEW]

    static setProfileBackgroundRgb(r, g, b, index = 10) { // [NEW - Default 10]
        [['r', r], ['g', g], ['b', b]].forEach(([key, value]) => { // [NEW]
            const safe = Math.max(0, Math.min(255, Number(value) || 0)); // [NEW]
            if (Utils.$(`profile-bg-${key}`)) Utils.$(`profile-bg-${key}`).value = safe; // [NEW]
            if (Utils.$(`profile-bg-${key}-num`)) Utils.$(`profile-bg-${key}-num`).value = safe; // [NEW]
        }); // [NEW]
        if (Utils.$('profile-bg-panel')) Utils.$('profile-bg-panel').dataset.selectedIndex = String(index || 10); // [PATCH]
    } // [NEW]

    static bindProfileBackgroundControls() { // [NEW]
        const panel = Utils.$('profile-bg-panel'); // [NEW]
        const btn = Utils.$('btn-toggle-profile-bg'); // [NEW]
        if (!panel || !btn) return; // [NEW]
        btn.onclick = () => panel.classList.toggle('active'); // [NEW]
        ['r', 'g', 'b'].forEach(key => { // [NEW]
            const range = Utils.$(`profile-bg-${key}`); // [NEW]
            const number = Utils.$(`profile-bg-${key}-num`); // [NEW]
            const sync = (source, target) => { // [NEW]
                const safe = Math.max(0, Math.min(255, Number(source.value) || 0)); // [NEW]
                source.value = safe; // [NEW]
                if (target) target.value = safe; // [NEW]
                if (panel) panel.dataset.selectedIndex = '10'; // [PATCH] Anchor to 10
                this.renderProfileBackgroundPresets(10); // [PATCH]
                this.updateProfileBackgroundPreview(); // [NEW]
            }; // [NEW]
            if (range) range.oninput = () => sync(range, number); // [NEW]
            if (number) number.oninput = () => sync(number, range); // [NEW]
        }); // [NEW]
        // [ADD] Bind dim sync
        const dimRange = Utils.$('profile-bg-dim');
        const dimNum = Utils.$('profile-bg-dim-num');
        const syncDim = (s, t) => {
            const val = Math.max(0, Math.min(1, Number(s.value) || 0));
            s.value = val; if(t) t.value = val;
            this.updateProfileBackgroundPreview();
        };
        if (dimRange) dimRange.oninput = () => syncDim(dimRange, dimNum);
        if (dimNum) dimNum.oninput = () => syncDim(dimNum, dimRange);

        if (Utils.$('profile-bg-url')) Utils.$('profile-bg-url').oninput = Utils.debounce(() => this.updateProfileBackgroundPreview(), 250); // [NEW]
    } // [NEW]

    static updateProfileBackgroundPreview() { // [NEW]
        const preview = Utils.$('profile-bg-preview'); // [NEW]
        if (!preview) return; // [NEW]
        const data = { // [UPDATE]
            color: this.rgbToHex(Utils.$('profile-bg-r')?.value || 31, Utils.$('profile-bg-g')?.value || 41, Utils.$('profile-bg-b')?.value || 55), // [NEW]
            index: Number(Utils.$('profile-bg-panel')?.dataset.selectedIndex) || 10, // [PATCH]
            url: this.normalizeProfileBackgroundUrl(Utils.$('profile-bg-url')?.value || ''), // [NEW]
            dim: Number(Utils.$('profile-bg-dim')?.value || 0.5) // [ADD]
        }; // [NEW]
        const colors = this.getReadableProfileColors(data.color); // [NEW]
        preview.style.background = data.color; // [NEW]
        preview.style.color = colors.text; // [NEW]
        preview.style.borderColor = colors.border; // [NEW]
        preview.innerText = `Цвет ${data.index || 'RGB'} · ${data.color.toUpperCase()}`; // [NEW]
    } // [NEW]

    static applyProfileBackground(panel, background = '') { // [UPDATE]
        if (!panel) return; // [UPDATE]
        const data = this.normalizeProfileBackground(background); // [UPDATE]
        const colors = this.getReadableProfileColors(data.color); // [NEW]
        panel.style.setProperty('--profile-bg', data.color); // [NEW]
        panel.style.setProperty('--profile-text', colors.text); // [NEW]
        panel.style.setProperty('--profile-muted', colors.muted); // [NEW]
        panel.style.setProperty('--profile-border', colors.border); // [NEW]
        panel.style.background = data.color; // [UPDATE]
        panel.style.color = colors.text; // [NEW]
        panel.style.borderColor = colors.border; // [NEW]
        panel.style.backgroundImage = ''; // [UPDATE]
        panel.style.backgroundSize = ''; // [UPDATE]
        panel.style.backgroundPosition = ''; // [UPDATE]
        if (data.url) { // [UPDATE]
            const dimValue = data.dim !== undefined ? data.dim : 0.5; // [ADD] Apply custom dim
            const overlay = `rgba(0,0,0,${dimValue})`;
            panel.style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${data.url}")`; // [UPDATE]
            panel.style.backgroundSize = 'cover'; // [UPDATE]
            panel.style.backgroundPosition = 'center'; // [UPDATE]
        } // [UPDATE]
    } // [UPDATE]

    static async getPartnerUid(uid) { // [NEW]
        if (!uid) return null; // [NEW]
        const snap = await get(ref(db, `users/${uid}/partner`)); // [NEW]
        return snap.exists() ? snap.val() : null; // [NEW]
    } // [NEW]

    static getAvatarHtml(profile = {}) { // [NEW]
        if (profile.avatar) return `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.parentElement.innerHTML='?';">`; // [NEW]
        return Utils.escapeHtml((profile.name || '?')[0].toUpperCase()); // [NEW]
    } // [NEW]

    static async renderPartnerContainer(containerId, partnerUid, canRemove = false, ownerUid = null) { // [UPDATE]
        const container = Utils.$(containerId); // [NEW]
        if (!container) return; // [NEW]
        container.classList.remove('active'); // [NEW]
        container.innerHTML = ''; // [NEW]
        if (!partnerUid) {
            container.onclick = null; // [PATCH]
            container.style.cursor = 'default';
            return; 
        } // [NEW]
        const partnerProfile = await this.loadUser(partnerUid); // [NEW]
        if (!partnerProfile) return; // [NEW]
        const sinceSnap = ownerUid ? await get(ref(db, `users/${ownerUid}/partnerSince`)) : null; // [NEW]
        const sinceTs = sinceSnap?.exists() ? Number(sinceSnap.val()) : 0; // [NEW]
        const sinceText = sinceTs ? new Date(sinceTs).toLocaleDateString() : 'дата не указана'; // [NEW]
        const daysText = sinceTs ? Math.max(1, Math.ceil((Date.now() - sinceTs) / 86400000)) : 0; // [NEW]
        // [NEW]
        container.innerHTML = `
            <div class="partner-avatar">${this.getAvatarHtml(partnerProfile)}</div>
            <div class="partner-info">
                <div class="partner-label">Вторая половинка 💖</div>
                <div class="partner-name">${Utils.escapeHtml(partnerProfile.name || 'Пользователь')}</div>
                <div class="partner-meta">${sinceTs ? `Вместе ${daysText} дн. · с ${sinceText}` : 'Пара подтверждена'}</div>
            </div>
            ${canRemove ? '<button class="danger-btn btn-remove-current-partner" style="width:auto; padding:8px 10px; z-index:10; position:relative;">Убрать</button>' : ''}
        `; // [NEW]
        container.classList.add('active'); // [NEW]
        
        // [ADD] Click to open sweet modal
        container.style.cursor = 'pointer';
        container.onclick = (e) => {
            if (!e.target.closest('button')) {
                this.openViewProfileModal(partnerUid);
            }
        };

        const removeBtn = container.querySelector('.btn-remove-current-partner'); // [NEW]
        if (removeBtn) removeBtn.onclick = (e) => { e.stopPropagation(); this.removePartner(partnerUid); }; // [NEW]
    } // [NEW]

    // [ADD] New sweet romantic modal for partners
    static async openPartnerModal(ownerUid, partnerUid) {
        const myProf = await this.loadUser(ownerUid);
        const theirProf = await this.loadUser(partnerUid);
        if (!myProf || !theirProf) return;

        const sinceSnap = await get(ref(db, `users/${ownerUid}/partnerSince`));
        const sinceTs = sinceSnap?.exists() ? Number(sinceSnap.val()) : 0;
        const daysText = sinceTs ? Math.max(1, Math.ceil((Date.now() - sinceTs) / 86400000)) : 1;

        Utils.$('partner-modal-my-avatar').innerHTML = this.getAvatarHtml(myProf);
        Utils.$('partner-modal-their-avatar').innerHTML = this.getAvatarHtml(theirProf);
        Utils.$('partner-modal-names').innerText = `${myProf.name} & ${theirProf.name}`;
        Utils.$('partner-modal-stats').innerText = sinceTs ? `Мы вместе уже ${daysText} счастливых дней 💖` : 'Созданы друг для друга ✨';

        Utils.$('modal-partner-view').classList.add('active');
    }

    static async renderMyPartnerBox() { // [NEW]
        const partnerUid = await this.getPartnerUid(AppState.currentUser?.uid); // [NEW]
        await this.renderPartnerContainer('edit-partner-container', partnerUid, true, AppState.currentUser?.uid); // [UPDATE]
    } // [NEW]

    static async renderLoveRequests() { // [NEW]
        const container = Utils.$('my-love-requests'); // [NEW]
        if (!container || !AppState.currentUser) return; // [NEW]
        const snap = await get(ref(db, `users/${AppState.currentUser.uid}/loveRequests`)); // [NEW]
        const requests = snap.val() || {}; // [NEW]
        const requestUids = Object.keys(requests); // [NEW]
        container.classList.remove('active'); // [NEW]
        container.innerHTML = ''; // [NEW]
        if (!requestUids.length) return; // [NEW]
        const html = []; // [NEW]
        for (const uid of requestUids) { // [NEW]
            const profile = await this.loadUser(uid); // [NEW]
            if (!profile) continue; // [NEW]
            // [NEW]
            html.push(`
                <div class="love-request-item" data-uid="${Utils.escapeHtml(uid)}">
                    <span>${Utils.escapeHtml(profile.name || 'Пользователь')} предлагает стать второй половинкой</span>
                    <div class="love-request-actions">
                        <button class="btn-small btn-accept-love">Принять</button>
                        <button class="btn-small btn-decline-love">Отклонить</button>
                    </div>
                </div>
            `); // [NEW]
        } // [NEW]
        if (!html.length) return; // [NEW]
        container.innerHTML = html.join(''); // [NEW]
        container.classList.add('active'); // [NEW]
        container.querySelectorAll('.btn-accept-love').forEach(btn => { // [NEW]
            btn.onclick = () => this.handleLoveRequest(btn.closest('.love-request-item')?.dataset.uid, true); // [NEW]
        }); // [NEW]
        container.querySelectorAll('.btn-decline-love').forEach(btn => { // [NEW]
            btn.onclick = () => this.handleLoveRequest(btn.closest('.love-request-item')?.dataset.uid, false); // [NEW]
        }); // [NEW]
    } // [NEW]

    static async sendLoveRequest(targetUid) { // [NEW]
        const myUid = AppState.currentUser?.uid; // [NEW]
        if (!myUid || !targetUid || targetUid === myUid) return; // [NEW]
        const friendSnap = await get(ref(db, `users/${myUid}/friends/${targetUid}`)); // [NEW]
        if (!friendSnap.exists() || friendSnap.val().status !== 'accepted') return Utils.toast('Предложение доступно только друзьям', 'error'); // [NEW]
        const [myPartnerSnap, targetPartnerSnap] = await Promise.all([ // [NEW]
            get(ref(db, `users/${myUid}/partner`)), // [NEW]
            get(ref(db, `users/${targetUid}/partner`)) // [NEW]
        ]); // [NEW]
        if (myPartnerSnap.exists() || targetPartnerSnap.exists()) return Utils.toast('У кого-то уже есть вторая половинка', 'error'); // [NEW]
        await set(ref(db, `users/${targetUid}/loveRequests/${myUid}`), { ts: Date.now() }); // [NEW]
        Utils.toast('Предложение отправлено'); // [NEW]
    } // [NEW]

    static async handleLoveRequest(partnerUid, accept) { // [NEW]
        const myUid = AppState.currentUser?.uid; // [NEW]
        if (!myUid || !partnerUid) return; // [NEW]
        const updates = {}; // [NEW]
        if (accept) { // [NEW]
            const friendSnap = await get(ref(db, `users/${myUid}/friends/${partnerUid}`)); // [NEW]
            if (!friendSnap.exists() || friendSnap.val().status !== 'accepted') return Utils.toast('Вторая половинка доступна только друзьям', 'error'); // [NEW]
            const [myPartnerSnap, targetPartnerSnap] = await Promise.all([ // [NEW]
                get(ref(db, `users/${myUid}/partner`)), // [NEW]
                get(ref(db, `users/${partnerUid}/partner`)) // [NEW]
            ]); // [NEW]
            if (myPartnerSnap.exists() || targetPartnerSnap.exists()) { // [NEW]
                await remove(ref(db, `users/${myUid}/loveRequests/${partnerUid}`)); // [NEW]
                await this.renderLoveRequests(); // [NEW]
                return Utils.toast('У кого-то уже есть вторая половинка', 'error'); // [NEW]
            } // [NEW]
            const partnerSince = Date.now(); // [NEW]
            updates[`users/${myUid}/partner`] = partnerUid; // [NEW]
            updates[`users/${partnerUid}/partner`] = myUid; // [NEW]
            updates[`users/${myUid}/partnerSince`] = partnerSince; // [NEW]
            updates[`users/${partnerUid}/partnerSince`] = partnerSince; // [NEW]
        } // [NEW]
        updates[`users/${myUid}/loveRequests/${partnerUid}`] = null; // [NEW]
        await update(ref(db), updates); // [NEW]
        Utils.toast(accept ? 'Вторая половинка добавлена' : 'Предложение отклонено'); // [NEW]
        await this.renderMyPartnerBox(); // [NEW]
        await this.renderLoveRequests(); // [NEW]
    } // [NEW]

    static async removePartner(partnerUid = null) { // [NEW]
        const myUid = AppState.currentUser?.uid; // [NEW]
        if (!myUid) return; // [NEW]
        const currentPartnerUid = partnerUid || await this.getPartnerUid(myUid); // [NEW]
        if (!currentPartnerUid) return; // [NEW]
        const updates = {}; // [NEW]
        updates[`users/${myUid}/partner`] = null; // [NEW]
        updates[`users/${currentPartnerUid}/partner`] = null; // [NEW]
        updates[`users/${myUid}/partnerSince`] = null; // [NEW]
        updates[`users/${currentPartnerUid}/partnerSince`] = null; // [NEW]
        await update(ref(db), updates); // [NEW]
        Utils.toast('Вторая половинка удалена'); // [NEW]
        await this.renderMyPartnerBox(); // [NEW]
        await this.renderPartnerContainer('view-partner-container', null, false, myUid); // [UPDATE]
        const removeBtn = Utils.$('btn-remove-partner'); // [NEW]
        if (removeBtn) removeBtn.style.display = 'none'; // [NEW]
    } // [NEW]

    static async updateLoveProfileActions(targetUid, isFriend = false) { // [NEW]
        const loveBtn = Utils.$('btn-love-proposal'); // [NEW]
        const removeBtn = Utils.$('btn-remove-partner'); // [NEW]
        const myUid = AppState.currentUser?.uid; // [NEW]
        if (!loveBtn || !removeBtn || !myUid) return; // [NEW]
        loveBtn.style.display = 'none'; // [NEW]
        removeBtn.style.display = 'none'; // [NEW]
        loveBtn.disabled = false; // [NEW]
        if (!targetUid || targetUid === myUid) return; // [NEW]
        const [myPartnerSnap, targetPartnerSnap, outgoingSnap, incomingSnap] = await Promise.all([ // [NEW]
            get(ref(db, `users/${myUid}/partner`)), // [NEW]
            get(ref(db, `users/${targetUid}/partner`)), // [NEW]
            get(ref(db, `users/${targetUid}/loveRequests/${myUid}`)), // [NEW]
            get(ref(db, `users/${myUid}/loveRequests/${targetUid}`)) // [NEW]
        ]); // [NEW]
        const myPartnerUid = myPartnerSnap.exists() ? myPartnerSnap.val() : null; // [NEW]
        const targetPartnerUid = targetPartnerSnap.exists() ? targetPartnerSnap.val() : null; // [NEW]
        if (myPartnerUid === targetUid) { // [NEW]
            removeBtn.style.display = 'block'; // [NEW]
            removeBtn.onclick = () => this.removePartner(targetUid); // [NEW]
            return; // [NEW]
        } // [NEW]
        if (!isFriend || myPartnerUid || targetPartnerUid) return; // [NEW]
        loveBtn.style.display = 'block'; // [NEW]
        if (incomingSnap.exists()) { // [NEW]
            loveBtn.innerText = 'Принять предложение'; // [NEW]
            loveBtn.onclick = async () => { await this.handleLoveRequest(targetUid, true); await this.updateLoveProfileActions(targetUid, isFriend); }; // [UPDATE]
            return; // [NEW]
        } // [NEW]
        loveBtn.innerText = outgoingSnap.exists() ? 'Предложение отправлено' : 'Предложить стать второй половинкой'; // [NEW]
        loveBtn.disabled = outgoingSnap.exists(); // [NEW]
        loveBtn.onclick = async () => { await this.sendLoveRequest(targetUid); await this.updateLoveProfileActions(targetUid, isFriend); }; // [NEW]
    } // [NEW]

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
        const hashtags = HashtagManager.parseHashtags(Utils.$('edit-hashtags').value, false);
        const avatar = Utils.$('edit-avatar-url').value.trim();
        const background = this.readProfileBackgroundInput(); // [NEW]

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

        updates[`users/${uid}/profile`] = { ...oldProfile, name, username, bio, hashtags, avatar, background }; // [UPDATE]
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
        const hashtagsEl = Utils.$('view-hashtags');
        const profileTags = Array.isArray(profile.hashtags) ? profile.hashtags : [];
        hashtagsEl.innerHTML = profileTags.map(tag => `<span class="hashtag-chip">${Utils.escapeHtml(tag)}</span>`).join('');
        this.applyProfileBackground(Utils.$('modal-view-profile')?.querySelector('.modal-content'), profile.background); // [NEW]
        const targetPartnerUid = await this.getPartnerUid(targetUid); // [NEW]
        await this.renderPartnerContainer('view-partner-container', targetPartnerUid, targetUid === AppState.currentUser.uid, targetUid); // [UPDATE]
        
        const avatarEl = Utils.$('view-avatar');
        if (profile.avatar) {
            avatarEl.innerHTML = `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.innerHTML='?'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.innerHTML = (profile.name || '?')[0].toUpperCase();
        }

        const actionBtn = Utils.$('btn-dm-modal');
        const loveBtn = Utils.$('btn-love-proposal'); // [NEW]
        const removePartnerBtn = Utils.$('btn-remove-partner'); // [NEW]
        if (loveBtn) loveBtn.style.display = 'none'; // [NEW]
        if (removePartnerBtn) removePartnerBtn.style.display = 'none'; // [NEW]
        let isFriendForLove = false; // [NEW]
        if (targetUid === AppState.currentUser.uid) {
            actionBtn.style.display = 'none';
        } else {
            actionBtn.style.display = 'block';
            
            const myFriendsSnap = await get(ref(db, `users/${AppState.currentUser.uid}/friends/${targetUid}`));
            const isFriend = myFriendsSnap.exists() && myFriendsSnap.val().status === 'accepted';
            isFriendForLove = isFriend; // [NEW]
            
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
        await this.updateLoveProfileActions(targetUid, isFriendForLove); // [NEW]

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

            const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
            const div = document.createElement('div');
            div.className = 'friend-request-item';
            div.innerHTML = `
                <div style="font-size: 13px;"><strong>${Utils.escapeHtml(profile.name)}</strong> ${roleBadgeHtml} хочет в друзья</div>
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
                const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
                
                div.innerHTML = `
                    <div class="avatar">${av}</div>
                    <div class="friend-info-col">
                        <div class="friend-name">${Utils.escapeHtml(profile.name)} ${roleBadgeHtml}</div>
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
    static heartsTimer = null;
    static theme = 'default';

    static getChatId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

    static closeChat() {
        if (this.unsubCurrent) {
            this.unsubCurrent();
            this.unsubCurrent = null;
        }
        AppState.currentDirectChat = null;
        const modal = Utils.$('modal-dm-chat');
        if (modal) modal.classList.remove('active');
        this.stopLoveHearts();
        if (Utils.$('dm-input')) Utils.$('dm-input').value = '';
        if (Utils.$('dm-messages')) Utils.$('dm-messages').innerHTML = '';
        if (Utils.$('dm-chat-title')) Utils.$('dm-chat-title').innerText = 'Личный чат';
        Utils.$('dm-theme-controls')?.classList.remove('active');
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
                EasterEggManager.playNotification();
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
        this.bindThemeControls();
        this.applyTheme(this.theme);

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
        const heartsLayer = '<div class="panel-love-hearts" id="dm-love-hearts"></div>';
        if (!messages.length) {
            list.innerHTML = `${heartsLayer}<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>`;
            return;
        }
        
        list.innerHTML = heartsLayer + messages.map(m => {
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
        if (this.theme === 'love') this.startLoveHearts();
    }

    static bindThemeControls() {
        const toggle = Utils.$('btn-dm-theme-toggle');
        const controls = Utils.$('dm-theme-controls');
        if (!toggle || !controls) return;
        toggle.onclick = () => controls.classList.toggle('active');
        controls.querySelectorAll('.dm-theme-chip').forEach(btn => {
            btn.onclick = () => this.applyTheme(btn.dataset.theme || 'default');
        });
    }

    static applyTheme(theme = 'default') {
        const modal = Utils.$('modal-dm-chat');
        if (!modal) return;
        this.theme = theme === 'love' ? 'love' : 'default';
        modal.classList.toggle('theme-love', this.theme === 'love');
        Utils.$('dm-theme-controls')?.querySelectorAll('.dm-theme-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.theme);
        });
        if (this.theme === 'love') this.startLoveHearts();
        else this.stopLoveHearts();
    }

    static startLoveHearts() {
        if (this.theme !== 'love') return;
        if (this.heartsTimer) return;

        const spawnHeart = () => {
            const layer = Utils.$('dm-love-hearts');
            if (!layer) return;
            const heart = document.createElement('div');
            const roll = Math.random();
            const mode = roll < 0.33 ? 'far' : roll > 0.74 ? 'near' : 'mid';
            heart.className = `love-heart ${mode}`;
            heart.innerText = RoomManager.loveHeartEmojis[Math.floor(Math.random() * RoomManager.loveHeartEmojis.length)];
            heart.style.left = `${Utils.getDistributedHeartLeft(layer, 'dm-love')}%`; // [UPDATE]
            const scaleBase = mode === 'far' ? 0.45 : mode === 'near' ? 1.15 : 0.78;
            const scale = scaleBase + Math.random() * (mode === 'near' ? 0.35 : 0.25);
            const drift = -12 + Math.random() * 24;
            const duration = mode === 'near' ? 34 + Math.random() * 10 : 30 + Math.random() * 10;
            const opacity = mode === 'far' ? 0.18 + Math.random() * 0.12 : mode === 'near' ? 0.34 + Math.random() * 0.18 : 0.25 + Math.random() * 0.14;
            const travel = (layer.clientHeight || 620) + 120;
            heart.style.setProperty('--heart-scale', String(scale));
            heart.style.setProperty('--heart-drift', `${drift}px`);
            heart.style.setProperty('--heart-opacity', String(opacity));
            heart.style.setProperty('--heart-travel', `${travel}px`);
            heart.style.animationDuration = `${duration}s`;
            layer.appendChild(heart);
            setTimeout(() => heart.remove(), 46000);
        };

        for (let i = 0; i < 8; i++) spawnHeart();
        this.heartsTimer = setInterval(spawnHeart, 1700);
    }

    static stopLoveHearts() {
        if (this.heartsTimer) {
            clearInterval(this.heartsTimer);
            this.heartsTimer = null;
        }
        const layer = Utils.$('dm-love-hearts');
        if (layer) layer.innerHTML = '';
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

    static async checkModRestrictionsForTarget(targetUid) {
        if (this.isCurrentUserCreator()) return true;
        if (await this.isProtectedCreatorTarget(targetUid)) {
            Utils.toast('Модератор не может взаимодействовать с профилем Создателя', 'error');
            return false;
        }
        return true;
    }

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
        modal.classList.add('godmode-modal');
        modal.innerHTML = `
            <div class="modal-content glass-panel" style="width:min(1180px,100%); padding:22px;">
                <div class="godmode-sidebar" id="godmode-sidebar">
                    <button class="secondary-btn godmode-nav-btn active" data-section="dashboard">dashboard</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="people">people</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="rooms">rooms</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="logs">logs</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="settings">settings</button>
                </div>
                <div class="godmode-main" id="godmode-main">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px;">
                    <div>
                        <h2 style="margin:0;">Админ-панель</h2>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Доступ для Создателя и Модераторов</div>
                    </div>
                    <button class="secondary-btn" id="btn-close-admin-panel" style="width:auto; padding:8px 12px;">✕</button>
                </div>

                <div id="admin-stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px;"></div>

                <div class="godmode-section" data-section="settings" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление правами (Только для Создателя)</div>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="admin-mod-username" placeholder="ID пользователя (без @)" style="margin:0; flex:1;">
                        <button class="primary-btn" id="btn-admin-grant-mod" style="width:auto; padding:0 16px;">Назначить Модератора</button>
                        <button class="danger-btn" id="btn-admin-revoke-mod" style="width:auto; padding:0 16px;">Снять Модератора</button>
                    </div>
                </div>

                <div class="godmode-section active" data-section="dashboard" style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px;">
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Глобальное оповещение / Пасхалка</div>
                        <textarea id="admin-announcement-input" rows="4" placeholder="Введите текст или команду пасхалки (напр. /matrix)"></textarea>
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
                            <button class="secondary-btn" id="btn-admin-export-snapshot">Экспорт Snapshot</button>
                            <button class="secondary-btn" id="btn-admin-unmute-unban-all">Снять mute/shadowban всем</button>
                        </div>
                    </div>
                </div>

                <div class="godmode-section" data-section="rooms" style="display:grid; grid-template-columns:1fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="font-weight:700;">Активные комнаты</div>
                                <div style="font-size:12px; color:var(--text-muted);">Удаление любых комнат одним нажатием</div>
                            </div>
                            <div id="admin-rooms-list" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow:auto;"></div>
                        </div>
                    </div>
                </div>

                <div class="godmode-section" data-section="people" style="display:grid; grid-template-columns:1.15fr 0.85fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">
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
                <div class="godmode-section" data-section="logs" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="font-weight:700;">Audit Log</div>
                        <button class="secondary-btn" id="btn-admin-clear-audit" style="width:auto; padding:8px 12px;">Очистить лог</button>
                    </div>
                    <div id="admin-audit-list" style="display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow:auto;"></div>
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
        Utils.$('btn-admin-export-snapshot').onclick = () => this.exportAdminSnapshot();
        Utils.$('btn-admin-unmute-unban-all').onclick = () => this.unmuteAndUnbanAllUsers();
        Utils.$('btn-admin-clear-audit').onclick = () => this.clearAuditLog();
        Utils.$('admin-user-search').onkeydown = (e) => { if (e.key === 'Enter') this.findUser(); };

        Utils.$('btn-admin-grant-mod').onclick = () => this.toggleModRole(true);
        Utils.$('btn-admin-revoke-mod').onclick = () => this.toggleModRole(false);
        modal.querySelectorAll('.godmode-nav-btn').forEach(btn => {
            btn.onclick = () => this.switchGodModeSection(btn.dataset.section || 'dashboard');
        });
        this.switchGodModeSection('dashboard');
    }

    static switchGodModeSection(section = 'dashboard') {
        AppState.admin.activeSection = section;
        Utils.$('modal-admin-panel')?.querySelectorAll('.godmode-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        Utils.$('modal-admin-panel')?.querySelectorAll('.godmode-section').forEach(node => {
            const nodeSection = node.dataset.section || 'dashboard';
            node.classList.toggle('active', section === nodeSection);
        });
    }

    static async pushAuditLog(action = '', payload = {}) {
        if (!AppState.currentUser) return;
        const item = {
            ts: Date.now(),
            byUid: AppState.currentUser.uid,
            action,
            payload
        };
        await push(ref(db, 'admin/auditLog'), item).catch(() => {});
    }

    static async clearAuditLog() {
        if (!this.requireAdmin()) return;
        await remove(ref(db, 'admin/auditLog'));
        Utils.toast('Audit log очищен');
    }

    static async exportAdminSnapshot() {
        if (!this.requireAdmin()) return;
        const [usersSnap, roomsSnap, settingsSnap] = await Promise.all([
            get(ref(db, 'users')),
            get(ref(db, 'rooms')),
            get(ref(db, 'admin/settings'))
        ]);
        const payload = {
            exportedAt: Date.now(),
            by: AppState.currentUser.uid,
            users: usersSnap.val() || {},
            rooms: roomsSnap.val() || {},
            settings: settingsSnap.val() || {}
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cowio-admin-snapshot-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await this.pushAuditLog('admin.snapshot.export');
        Utils.toast('Snapshot экспортирован');
    }

    static async unmuteAndUnbanAllUsers() {
        if (!this.requireAdmin()) return;
        if (!confirm('Снять mute и shadowban у всех пользователей?')) return;
        const usersSnap = await get(ref(db, 'users'));
        const users = usersSnap.val() || {};
        const updates = {};
        Object.keys(users).forEach(uid => {
            updates[`users/${uid}/moderation/muted`] = null;
            updates[`users/${uid}/moderation/shadowban`] = null;
        });
        await update(ref(db), updates);
        await this.pushAuditLog('admin.users.unmuteUnbanAll', { users: Object.keys(users).length });
        Utils.toast('Mute и shadowban сняты у всех');
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
        await this.pushAuditLog('moderator.toggle', { targetUid, grant });
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
        const auditRef = ref(db, 'admin/auditLog');
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
            
            // ФИКС: Игнорируем старые глобальные объявления (старше 1 минуты)
            if (Date.now() - Number(payload.ts || 0) > 60000) return;

            const marker = `globalAnnouncementSeen:${payload.id}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');
            AppState.admin.lastAnnouncementId = payload.id;

            const commandStr = payload.text.trim().toLowerCase();
            const command = EasterEggManager.COMMANDS.get(commandStr);
            if (command) {
                // ДОБАВЛЕНО: Индивидуальные мемы для каждой пасхалки
                const memeTexts = {
                    'moo': 'Кто-то выпустил корову на пастбище... Му-у-у! 🐄',
                    'grass': 'Пора потрогать траву, друзья! 🌱',
                    'milk': 'кто-нибудь желает молока? 🥛',
                    'popcorn': 'Запасаемся попкорном, сейчас начнется кино! 🍿',
                    'dvd': 'Ждем, когда логотип ударится в угол... 📀',
                    'roll': 'Делаем бочку! Уууииии! 🔄',
                    'matrix': 'Тук-тук, Нео. Матрица имеет тебя... 💻',
                    'shh': 'Тссс... Режим тишины активирован 🤫',
                    'vader': 'Люк, я твой отец... *тяжелое дыхание* ⚔️',
                    'nyan': 'Нян-кэт пролетает над сервером! 🐱🌈'
                };
                const msg = memeTexts[command] || `Глобальная пасхалка от ${payload.fromUsername}!`;
                Utils.toast(msg, 'info');
                EasterEggManager.applyRoomEffect({ type: command, from: payload.fromUsername });
            } else {
                Utils.toast(`Оповещение: ${payload.text}`);
            }
        });

        const auditUnsub = onValue(auditRef, (snap) => {
            const data = snap.val() || {};
            AppState.admin.logs = Object.entries(data)
                .map(([id, value]) => ({ id, ...(value || {}) }))
                .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
                .slice(0, 300);
            this.renderAuditLog();
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
            () => off(auditRef, 'value', auditUnsub),
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

    static renderAuditLog() {
        const list = Utils.$('admin-audit-list');
        if (!list) return;
        if (!AppState.admin.logs.length) {
            list.innerHTML = `<div style="font-size:13px; color:var(--text-muted);">Лог пуст</div>`;
            return;
        }
        list.innerHTML = AppState.admin.logs.map(item => {
            const time = new Date(Number(item.ts || 0)).toLocaleString();
            return `<div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; font-family:Consolas,monospace; font-size:12px;">
                <div style="color:var(--text-muted);">${time}</div>
                <div style="margin-top:4px; color:#ffffff;">${Utils.escapeHtml(item.action || 'action')}</div>
                <div style="margin-top:4px;">uid: ${Utils.escapeHtml(item.byUid || '-')}</div>
                <div style="margin-top:4px; white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(item.payload || {}))}</div>
            </div>`;
        }).join('');
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
        const moderation = userData.moderation || {};
        const roomMeta = this.getCurrentRoomForUid(uid);
        const editor = Utils.$('admin-user-editor');

        editor.dataset.targetUid = uid;
        editor.innerHTML = `
            <div style="font-size:12px; color:var(--text-muted);">UID: ${uid}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:-6px;">Комната: ${roomMeta ? Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId) : 'не находится в комнате'}</div>
            <input type="text" id="admin-edit-name" placeholder="Имя" value="${Utils.escapeHtml(profile.name || '')}">
            <input type="text" id="admin-edit-username" placeholder="ID" value="${Utils.escapeHtml(profile.username || '')}">
            <input type="text" id="admin-edit-avatar" placeholder="URL аватарки" value="${Utils.escapeHtml(profile.avatar || '')}">
            <input type="color" id="admin-edit-bg-color" value="${Utils.escapeHtml(ProfileManager.normalizeProfileBackground(profile.background).color)}" title="Цвет фона профиля">
            <input type="text" id="admin-edit-bg-url" placeholder="URL фона профиля" value="${Utils.escapeHtml(ProfileManager.normalizeProfileBackground(profile.background).url || '')}">
            <input type="number" id="admin-edit-bg-dim" min="0" max="1" step="0.05" value="${Utils.escapeHtml(String(ProfileManager.normalizeProfileBackground(profile.background).dim ?? 0.5))}" placeholder="Затемнение 0..1">
            <textarea id="admin-edit-bio" rows="4" placeholder="Описание">${Utils.escapeHtml(profile.bio || '')}</textarea>
            <div style="font-size:12px; color:var(--text-muted);">Email: ${Utils.escapeHtml(profile.email || 'не указан')}</div>
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2);">
                <div style="font-weight:700; margin-bottom:6px;">Live User Inspector</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">IP: ${Utils.escapeHtml(userData?.status?.ip || 'unavailable')}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Partner: ${Utils.escapeHtml(userData?.partner || profile?.partner || 'none')}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Registered: ${profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'unknown'}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Ban history: ${Array.isArray(moderation.banHistory) ? moderation.banHistory.length : 0}</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                <button class="primary-btn" id="btn-admin-save-user">Сохранить изменения</button>
                <button class="secondary-btn" id="btn-admin-reset-user">Обнулить профиль</button>
                <button class="danger-btn" id="btn-admin-delete-user">Удалить пользователя</button>
                <button class="secondary-btn" id="btn-admin-force-leave-current">Кикнуть из комнаты</button>
                <button class="danger-btn" id="btn-admin-force-logout-current">Форс-выход</button>
                <button class="secondary-btn" id="btn-admin-toggle-user-mute">${moderation.muted ? 'Unmute user' : 'Mute user'}</button>
                <button class="secondary-btn" id="btn-admin-toggle-shadowban">${moderation.shadowban ? 'Снять Shadowban' : 'Shadowban'}</button>
                <button class="secondary-btn" id="btn-admin-reset-password">Reset password</button>
            </div>
        `;

        Utils.$('btn-admin-save-user').onclick = () => this.saveUserProfile();
        Utils.$('btn-admin-reset-user').onclick = () => this.resetUserProfile();
        Utils.$('btn-admin-delete-user').onclick = () => this.deleteUserCompletely(uid);
        Utils.$('btn-admin-force-leave-current').onclick = () => this.forceLeaveRoom(uid);
        Utils.$('btn-admin-force-logout-current').onclick = () => this.forceSignOut(uid);
        Utils.$('btn-admin-toggle-user-mute').onclick = () => this.toggleUserMute(uid);
        Utils.$('btn-admin-toggle-shadowban').onclick = () => this.toggleShadowban(uid);
        Utils.$('btn-admin-reset-password').onclick = () => this.issuePasswordReset(uid);
    }

    static async toggleUserMute(uid) {
        if (!this.requireAdmin()) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return;
        const path = `users/${uid}/moderation/muted`;
        const snap = await get(ref(db, path));
        const next = !Boolean(snap.val());
        await set(ref(db, path), next);
        await this.pushAuditLog('user.mute', { uid, muted: next });
        Utils.toast(next ? 'Пользователь заглушен' : 'Пользователь размьючен');
        this.loadUserEditor(uid);
    }

    static async deleteUserCompletely(uid) {
        if (!this.requireAdmin()) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return;
        if (!confirm('Полностью удалить пользователя и все его данные?')) return;
        const userSnap = await get(ref(db, `users/${uid}`));
        if (!userSnap.exists()) return Utils.toast('Пользователь уже удален');
        const userData = userSnap.val() || {};
        const username = userData?.profile?.username || '';
        const updates = {};
        updates[`users/${uid}`] = null;
        updates[`admin/actions/forceSignOut/${uid}`] = { ts: Date.now(), by: AppState.currentUser.uid };
        updates[`admin/actions/resetPassword/${uid}`] = null;
        if (username) updates[`usernames/${username}`] = null;
        AppState.roomsCache.forEach((room, roomId) => {
            updates[`rooms/${roomId}/presence/${uid}`] = null;
            updates[`rooms/${roomId}/rtc/participants/${uid}`] = null;
        });
        await update(ref(db), updates);
        await this.pushAuditLog('user.delete', { uid, username });
        Utils.toast('Пользователь удален из базы');
        this.renderEmptyUserEditor();
        this.renderIfOpen();
    }

    static async toggleShadowban(uid) {
        if (!this.requireAdmin()) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return;
        const banRef = ref(db, `users/${uid}/moderation/shadowban`);
        const snap = await get(banRef);
        const next = !Boolean(snap.val());
        await set(banRef, next);
        if (next) {
            await push(ref(db, `users/${uid}/moderation/banHistory`), {
                ts: Date.now(),
                by: AppState.currentUser.uid,
                type: 'shadowban'
            });
        }
        await this.pushAuditLog('user.shadowban', { uid, enabled: next });
        Utils.toast(next ? 'Shadowban включен' : 'Shadowban снят');
        this.loadUserEditor(uid);
    }

    static async issuePasswordReset(uid) {
        if (!this.requireAdmin()) return;
        await set(ref(db, `admin/actions/resetPassword/${uid}`), { ts: Date.now(), by: AppState.currentUser.uid });
        await this.pushAuditLog('user.resetPassword.issue', { uid });
        Utils.toast('Событие reset password отправлено');
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
        const bgColor = Utils.$('admin-edit-bg-color')?.value || '#1f2937';
        const bgUrl = Utils.$('admin-edit-bg-url')?.value.trim() || '';
        const bgDim = Number(Utils.$('admin-edit-bg-dim')?.value || 0.5);

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

        const nextProfile = {
            ...oldProfile,
            name,
            username,
            avatar,
            bio,
            background: ProfileManager.normalizeProfileBackground({
                color: bgColor,
                index: ProfileManager.normalizeProfileBackground(oldProfile.background).index || 10,
                url: bgUrl,
                dim: Math.max(0, Math.min(1, bgDim))
            })
        };
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
        await this.pushAuditLog('announcement.send', { text });

        Utils.$('admin-announcement-input').value = '';
        Utils.toast('Глобальное оповещение отправлено');
    }

    static async clearAnnouncement() {
        if (!this.requireAdmin()) return;
        await remove(ref(db, 'admin/global-announcement'));
        await this.pushAuditLog('announcement.clear');
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
        await this.pushAuditLog('room.delete', { roomId });
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
            await this.pushAuditLog('room.delete.bulk', { roomId });
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
        await this.pushAuditLog('room.purgeEmpty', { count: emptyRoomIds.length });
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
        await this.pushAuditLog('user.forceSignOut', { uid });

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
        await this.pushAuditLog('user.forceLeaveRoom', { uid, roomId: roomMeta.roomId });

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
    static themeOptions = ['default', 'love']; // [UPDATE]
    static themeIndex = 0;
    static heartsTimer = null;
    static loveHeartEmojis = ['💗', '💘', '💞', '💕'];

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

            // Автоматическая синхронизация тем
            if (AppState.currentRoomId && data[AppState.currentRoomId]) {
                const newTheme = this.normalizeRoomTheme(data[AppState.currentRoomId].theme || 'default'); // [UPDATE]
                if (AppState.currentTheme !== newTheme) {
                    AppState.currentTheme = newTheme;
                    this.applyRoomTheme(newTheme);
                }
            }
            
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
        const prevBtn = Utils.$('room-theme-prev'); // [UPDATE]
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

    static normalizeRoomTheme(theme = 'default') { // [NEW]
        return this.themeOptions.includes(theme) ? theme : 'default'; // [NEW]
    } // [NEW]

    static getRoomAvatarsStack(room = {}) {
        const ids = Object.keys(room?.presence || {}).slice(0, 4);
        if (!ids.length) return `<span class="stack-avatar">0</span>`;
        return ids.map(uid => {
            const profile = AppState.usersCache.get(uid) || {};
            if (profile.avatar) return `<span class="stack-avatar"><img src="${Utils.escapeHtml(profile.avatar)}" style="width:100%;height:100%;object-fit:cover;"></span>`;
            const letter = Utils.escapeHtml((profile.name || '?')[0]?.toUpperCase() || '?');
            return `<span class="stack-avatar">${letter}</span>`;
        }).join('');
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
            if (Array.isArray(room.hashtags) && room.hashtags[0]) {
                card.querySelector('.rm-title').innerText = `${lock}${room.name} ${room.hashtags[0]}`;
            }
            card.querySelector('.rm-host').innerText = `Хост: ${room.hostName || 'Неизвестно'}`;
            card.querySelector('.rm-count').innerHTML = `<span class="avatars-stack">${this.getRoomAvatarsStack(room)}</span>`;
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
            Utils.$('room-input-hashtag').value = Array.isArray(r.hashtags) ? (r.hashtags[0] || '') : '';
            const theme = this.normalizeRoomTheme(r.theme || 'default'); // [UPDATE]
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
            Utils.$('room-input-hashtag').value = '';
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
        const hashtags = HashtagManager.parseHashtags(Utils.$('room-input-hashtag').value, true);
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
                hashtags,
                theme: this.normalizeRoomTheme(selectedTheme), // [UPDATE]
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
        AppState.currentRoomJoinTs = Date.now(); // ФИКС: Запоминаем время входа, чтобы не смотреть старые пасхалки
        // Фикс изначального хоста (только владелец получает тру isHost глобально)
        AppState.isHost = (roomData.hostId === AppState.currentUser.uid);
        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.roomSubscriptions.forEach(fn => fn()); AppState.roomSubscriptions = [];
        
        const roomTag = Array.isArray(roomData.hashtags) && roomData.hashtags[0] ? ` ${roomData.hashtags[0]}` : '';
        Utils.$('room-title-text').innerText = Utils.escapeHtml(`${roomData.name}${roomTag}`);
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

            // Доступ для создателя и хоста
            vid.controls = AppState.isHost || AdminPanel.isCurrentUserCreator();
            vid.playsInline = true;
            vid.preload = 'auto';
            vid.onerror = () => Utils.toast('Плеер не смог загрузить видео. Нужна прямая ссылка на медиафайл.', 'error');
            
            // Включаем Ambilight
            Ambilight.start(vid);
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

        // Кнопка настроек доступна оригинальному хосту и Разработчику
        Utils.$('btn-room-settings').style.display = (AppState.isHost || AdminPanel.isCurrentUserCreator()) ? 'block' : 'none';
        if (AppState.isHost || AdminPanel.isCurrentUserCreator()) Utils.$('btn-room-settings').onclick = () => this.openRoomModal(roomId);

        Utils.showScreen('room-screen');
        Utils.$('chat-messages').innerHTML = '<div class="sys-msg">Вы вошли в комнату</div>';
        Utils.$('users-list').innerHTML = '';
        
        AppState.currentTheme = this.normalizeRoomTheme(roomData.theme || 'default'); // [UPDATE]
        this.applyRoomTheme(AppState.currentTheme);
        
        this.initRoomServicesFinal(roomId);
        RTCManager.init(roomId); 
    }

    static getDefaultPerms() { return { chat: true, voice: true, player: (AppState.isHost || AdminPanel.isCurrentUserCreator()), reactions: true }; }

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
            if (msg?.shadowbanned && msg.uid !== uid && !AdminPanel.isCurrentUserAdmin()) return;

            const isMe = msg.uid === uid;
            const line = document.createElement('div');
            line.className = `m-line ${isMe ? 'self' : ''}`;
            
            let content = Utils.escapeHtml(msg.text);
            content = content.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn" data-time="$1">$1</span>');

            line.innerHTML = `<strong class="profile-open-link chat-profile-link" data-uid="${Utils.escapeHtml(msg.uid || '')}">${Utils.escapeHtml(msg.name)}</strong><div class="bubble">${content}</div>`;
            
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
            const profileBtn = line.querySelector('.chat-profile-link');
            if (profileBtn && msg.uid) profileBtn.onclick = () => ProfileManager.openViewProfileModal(msg.uid);

            Utils.$('chat-messages').appendChild(line);
            Utils.$('chat-messages').scrollTop = Utils.$('chat-messages').scrollHeight;
        });
        AppState.roomSubscriptions.push(() => off(chatRef, 'child_added', cUnsub));

        Utils.$('send-btn').onclick = async () => {
            const input = Utils.$('chat-input');
            if (!input.value.trim() || !this.hasPerm('chat')) return;
            const text = input.value.trim();
            const meModerationSnap = await get(ref(db, `users/${uid}/moderation`));
            const meModeration = meModerationSnap.val() || {};
            if (meModeration.muted && !AdminPanel.isCurrentUserAdmin()) return Utils.toast('Вы заглушены модератором', 'error');
            const wasHandled = await EasterEggManager.handleChatInput(text, chatRef, uid);
            if (!wasHandled) {
                await push(chatRef, {
                    uid,
                    name: AppState.currentUser.displayName,
                    text,
                    ts: Date.now(),
                    shadowbanned: Boolean(meModeration.shadowban)
                });
            }
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
        EasterEggManager.bindRoom(roomId);

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
        if (AppState.isHost || AdminPanel.isCurrentUserCreator()) return true;
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
        container.innerHTML = '';
        
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
                
                // Проверяем, является ли юзер оригинальным хостом ИЛИ создателем (Developer)
                const profile = AppState.usersCache.get(uid) || {};
                const isTargetHost = (AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid) || AdminPanel.isCreatorProfile(profile, uid);
                const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
                
                let html = `<div class="user-item">`;
                if (user.speaking) html = `<div class="user-item speaking">`;
                html += `<div class="indicator online"></div>`; 
                html += `<div class="user-main"><span class="user-name profile-open-link room-user-profile-link" data-uid="${uid}">${Utils.escapeHtml(user.name)}</span>${roleBadgeHtml}<span class="voice-wave"><i></i><i></i><i></i><i></i></span>`;
                if (isTargetHost) html += `<span class="host-label">Host</span>`;
                if (isLocal) html += `<span class="you-label">(Вы)</span>`;
                html += `</div>`;

                html += `<div class="user-card-actions">`;
                if (!isLocal) {
                    html += `<button class="dm-btn" data-uid="${uid}">💬</button>`;
                    html += `<button class="add-friend-btn" data-uid="${uid}">+Друг</button>`;
                }
                html += `</div>`;

                // Управление пермиссиями доступно хосту и разработчику
                if ((AppState.isHost || AdminPanel.isCurrentUserCreator()) && !isLocal) {
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
            container.querySelectorAll('.room-user-profile-link').forEach(node => {
                node.onclick = () => ProfileManager.openViewProfileModal(node.dataset.uid);
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
        EasterEggManager.cleanupAllEffects();
        
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
        
        Ambilight.stop();

        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.currentRoomId = null;
        AppState.currentRoomJoinTs = 0; // Сбрасываем время при выходе
        AppState.currentTheme = null;
        this.applyRoomTheme('default');
        AppState.isHost = false;
        if (Utils.$('users-list')) Utils.$('users-list').innerHTML = '';
        if (Utils.$('users-count')) Utils.$('users-count').innerText = '0';
        Utils.showScreen('lobby-screen');
    }

    static applyRoomTheme(theme = 'default') {
        const roomScreen = Utils.$('room-screen');
        if (!roomScreen) return;
        roomScreen.classList.remove('theme-love', 'theme-inverted'); // [UPDATE]
        document.body.classList.remove('theme-love-room', 'theme-inverted-room'); // [UPDATE]
        this.stopLoveHearts();
        
        const safeTheme = this.normalizeRoomTheme(theme); // [NEW]
        Ambilight.updateTheme(safeTheme); // [UPDATE]

        if (safeTheme === 'love') { // [UPDATE]
            roomScreen.classList.add('theme-love');
            document.body.classList.add('theme-love-room');
            this.startLoveHearts();
            // Fallback: containers may appear a tick later after rerender.
            setTimeout(() => this.startLoveHearts(), 150);
        }
    }

    static startLoveHearts() {
        if (this.heartsTimer) return;

        const spawnHeart = (layer, mode = 'mid') => {
            if (!layer) return;
            const heart = document.createElement('div');
            heart.className = `love-heart ${mode}`;
            heart.innerText = this.loveHeartEmojis[Math.floor(Math.random() * this.loveHeartEmojis.length)];
            heart.style.left = `${Utils.getDistributedHeartLeft(layer, 'room-love')}%`; // [UPDATE]
            const scaleBase = mode === 'far' ? 0.45 : mode === 'near' ? 1.15 : 0.78;
            const scale = scaleBase + Math.random() * (mode === 'near' ? 0.35 : 0.25);
            const drift = -12 + Math.random() * 24;
            const duration = mode === 'near' ? 34 + Math.random() * 10 : 30 + Math.random() * 10;
            const opacity = mode === 'far' ? 0.18 + Math.random() * 0.12 : mode === 'near' ? 0.34 + Math.random() * 0.18 : 0.25 + Math.random() * 0.14;
            const travel = (layer.clientHeight || 620) + 120;
            heart.style.setProperty('--heart-scale', String(scale));
            heart.style.setProperty('--heart-drift', `${drift}px`);
            heart.style.setProperty('--heart-opacity', String(opacity));
            heart.style.setProperty('--heart-travel', `${travel}px`);
            heart.style.animationDuration = `${duration}s`;
            layer.appendChild(heart);
            setTimeout(() => heart.remove(), 46000);
        };

        const primeLayer = (layer, amount = 14) => {
            if (!layer) return;
            for (let i = 0; i < amount; i++) {
                const roll = Math.random();
                const mode = roll < 0.33 ? 'far' : roll > 0.74 ? 'near' : 'mid';
                spawnHeart(layer, mode);
            }
        };

        const layer = Utils.$('room-love-hearts');
        primeLayer(layer, 10);

        this.heartsTimer = setInterval(() => {
            const sharedLayer = Utils.$('room-love-hearts');
            const roll = Math.random();
            const mode = roll < 0.33 ? 'far' : roll > 0.74 ? 'near' : 'mid';
            spawnHeart(sharedLayer, mode);
        }, 1700);
    }

    static stopLoveHearts() {
        if (this.heartsTimer) {
            clearInterval(this.heartsTimer);
            this.heartsTimer = null;
        }
        const layer = Utils.$('room-love-hearts');
        if (layer) layer.innerHTML = '';
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
// 7. МОБИЛЬНЫЕ СВАЙПЫ (Bottom Sheets, Chat swipe)
// ============================================================================

class MobileSwipeManager {
    static init() {
        if (window.innerWidth > 1024) return; // Only mobile

        // Setup modal swipe to close
        document.querySelectorAll('.modal').forEach(modal => {
            let startY = 0;
            let currentY = 0;
            const content = modal.querySelector('.modal-content');
            if (!content) return;

            content.addEventListener('touchstart', (e) => {
                if (content.scrollTop > 0) return; // Only if at top
                startY = e.touches[0].clientY;
            }, { passive: true });

            content.addEventListener('touchmove', (e) => {
                if (startY === 0) return;
                currentY = e.touches[0].clientY;
                const dy = currentY - startY;
                if (dy > 0) {
                    content.style.transform = `translateY(${dy}px)`;
                }
            }, { passive: true });

            content.addEventListener('touchend', (e) => {
                if (startY === 0) return;
                const dy = currentY - startY;
                if (dy > 120) {
                    // swipe down close
                    if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
                    else modal.classList.remove('active');
                }
                content.style.transform = '';
                startY = 0;
                currentY = 0;
            });
        });

        // Chat vs Users swipe inside Room
        const chatSection = Utils.$('chat-messages')?.parentElement;
        if (chatSection) {
            let startX = 0;
            chatSection.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            }, { passive: true });
            chatSection.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                const dx = endX - startX;
                if (Math.abs(dx) > 80) {
                    if (dx < 0 && Utils.$('chat-messages').style.display !== 'none') {
                        // Swipe left -> open users
                        Utils.$('tab-users-btn')?.click();
                    } else if (dx > 0 && Utils.$('users-list').style.display !== 'none') {
                        // Swipe right -> open chat
                        Utils.$('tab-chat-btn')?.click();
                    }
                }
            });
        }

        // Sidebar swipe to close
        const sidebar = Utils.$('main-sidebar');
        if (sidebar) {
            let startX = 0;
            sidebar.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            }, { passive: true });
            sidebar.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                if (startX - endX > 60) { // swipe left
                    sidebar.classList.remove('open');
                }
            });
        }
    }
}

// ============================================================================
// 10. ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================================

window.onload = () => {
    GlobalThemeManager.init(); // [NEW]
    AuthManager.init();
    BackgroundFX.init();
    EasterEggManager.init();
    HashtagManager.initHashtags();
    MobileSwipeManager.init(); // [NEW] Mobile Swipes initialization

    // Добавляем мини-контейнер с ссылками (изначально скрыт, покажется только в lobby-screen)
    const footerLinks = document.createElement('div');
    footerLinks.id = 'bottom-footer-links';
    footerLinks.style.display = 'none'; // Будет переключаться в Utils.showScreen
    footerLinks.innerHTML = `
        <a href="mailto:support@cowio.com">Mail</a>
        <a href="https://t.me/your_channel" target="_blank">Telegram</a>
        <a href="#" target="_blank">Сайт</a>
        <a href="#" onclick="event.preventDefault()">позже добавлю</a>
    `;
    document.body.appendChild(footerLinks);

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
