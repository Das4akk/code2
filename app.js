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
    customBadges: {},
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
            roomCreationBlocked: false,
            globalChatLocked: false,
            globalReactionsBlocked: false,
            globalInvitesBlocked: false,
            globalRegistrationsBlocked: false,
            maintenanceMode: false,
            systemReadOnlyMode: false
        },
        lastAnnouncementId: null,
        activeSection: 'dashboard',
        activeUsersTab: 'online',
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
    static getAppleEmojiHtml(char) {
        const appleMap = {
            '💋': '1f48b', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '2728', '💞': '1f49e', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f525', '🐄': '1f404', '🍿': '1f37f', '🐱': '1f431', '🌈': '1f308', '🥛': '1f95b', '📀': '1f4c0', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Up%20Button.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f504', '💻': '1f4bb', '🤫': '1f92b', '⚔️': '2694-fe0f', '🔒': '1f512', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f465', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f4fa', '📎': '1f4ce', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f4cc', '📍': '1f4cd', '💗': '1f497', '💘': '1f498', '💕': '1f495', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '2764-fe0f', '🔴': '1f534', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f602', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f631', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f44f', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Musical%20Note.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f3b5', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f4cc', '📍': '1f4cd', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f451', '✅': '2705', '❌': '274c', '⚠️': '26a0-fe0f', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '1f4ac', '💎': '1f48e', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '2699-fe0f', '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">': '2b50', '🌟': '1f31f', '🎮': '1f3ae', '🎧': '1f3a7', '🎉': '1f389', '💰': '1f4b0'
        };
        const codepoint = appleMap[char] || char.codePointAt(0).toString(16);
        return `<img src="https://emojigraph.org/media/144/apple/${codepoint}.png" style="width: 1.25em; height: 1.25em; vertical-align: middle; display: inline-block; object-fit: contain;" alt="${char}" onerror="this.onerror=null; this.src=''; this.alt='${char}';"/>`;
    }

    static formatLastSeen(ts) {
        if (!ts) return 'Ещё не заходил';
        const diff = Date.now() - ts;
        if (diff < 60000) return 'Только что';
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} мин. назад`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} ч. назад`;
        const days = Math.floor(hours / 24);
        return `${days} д. назад`;
    }

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

    static showScreen(screenId, pushState = true) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = Utils.$(screenId);
        if (screen) screen.classList.add('active');

        // Показываем футер с ссылками ТОЛЬКО в лобби
        const footerLinks = Utils.$('bottom-footer-links');
        if (footerLinks) {
            footerLinks.style.display = (screenId === 'lobby-screen') ? 'flex' : 'none';
        }
        
        // MPA Routing Emulation
        if (pushState) {
            let path = '/';
            if (screenId === 'auth-screen') path = '/login';
            if (screenId === 'lobby-screen') path = '/lobby';
            if (screenId === 'room-screen') path = `/room/${AppState.currentRoomId || 'current'}`;
            window.history.pushState({ screenId }, "", path);
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

    static formatDuration(ms = 0) {
        const totalMin = Math.max(0, Math.floor(Number(ms) / 60000));
        if (totalMin < 1) return 'меньше минуты';
        if (totalMin < 60) return `${totalMin} мин`;
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        if (hours < 24) return mins ? `${hours} ч ${mins} мин` : `${hours} ч`;
        const days = Math.floor(hours / 24);
        const remH = hours % 24;
        return remH ? `${days} д ${remH} ч` : `${days} д`;
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
                .logo { font-size: 28px !important; font-weight: 900; letter-spacing: 2px; background: linear-gradient(90deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; text-align: center; display: inline-block; }
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
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 800;
                padding: 4px 10px;
                border-radius: 8px;
                margin-left: 8px;
                text-transform: uppercase;
                vertical-align: middle;
                letter-spacing: 0.5px;
                transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            .role-badge::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transform: translateX(-100%); transition: 0.5s; }
            .role-badge:hover { transform: translateY(-2px) scale(1.05); }
            .role-badge:hover::before { transform: translateX(100%); }
            
            .badge-creator {
                background: linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 107, 129, 0.2));
                color: #ff4757;
                border: 1px solid rgba(255, 71, 87, 0.5);
                box-shadow: 0 4px 12px rgba(255, 71, 87, 0.25);
            }
            .badge-moderator {
                background: linear-gradient(135deg, rgba(255, 165, 2, 0.2), rgba(255, 195, 18, 0.2));
                color: #ffa502;
                border: 1px solid rgba(255, 165, 2, 0.5);
                box-shadow: 0 4px 12px rgba(255, 165, 2, 0.25);
            }
            .badge-hybrid {
                background: linear-gradient(135deg, rgba(93, 63, 211, 0.2), rgba(125, 95, 255, 0.2));
                color: #8d63ff;
                border: 1px solid rgba(141, 99, 255, 0.5);
                box-shadow: 0 4px 12px rgba(141, 99, 255, 0.3);
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
                background:
                    radial-gradient(1100px 520px at 8% -10%, rgba(139, 170, 255, 0.18) 0%, rgba(139, 170, 255, 0) 62%),
                    radial-gradient(900px 460px at 102% 8%, rgba(124, 236, 255, 0.16) 0%, rgba(124, 236, 255, 0) 58%),
                    linear-gradient(135deg, #edf3fb 0%, #e8eff8 48%, #dfe9f5 100%) !important;
                color: #2e271d !important;
            }
            .theme-light-global,
            html.theme-light-global,
            html[data-global-theme="light"] {
                --bg: #e8edf4 !important;
                --panel: rgba(246, 251, 255, 0.88) !important;
                --panel-hover: rgba(238, 246, 255, 0.96) !important;
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
                background: transparent !important;
                background-color: transparent !important;
            }
            .theme-light-global #particle-canvas,
            body.theme-light-global #particle-canvas {
                opacity: 0.76 !important;
                filter: contrast(1.12) saturate(1.08) brightness(1.03) !important;
                display: block !important;
            }
            #particle-canvas {
                position: fixed !important;
                inset: 0 !important;
                z-index: 0 !important;
                pointer-events: none !important;
            }
            #auth-screen, #lobby-screen, #room-screen { position: relative; z-index: 2; }
            .theme-light-global .glass-panel,
            .theme-light-global .room-card,
            .theme-light-global .user-item,
            .theme-light-global .friend-item,
            .theme-light-global .chat-section,
            .theme-light-global .player-section,
            .theme-light-global .modal-content {
                border: 2px solid rgba(0, 0, 0, 0.56) !important;
                background: linear-gradient(180deg, rgba(248,253,255,0.9) 0%, rgba(241,248,255,0.86) 100%) !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset, 0 12px 28px rgba(32, 66, 112, 0.12);
            }
            .theme-light-global .bubble,
            .theme-light-global .friend-request-item,
            .theme-light-global .room-info,
            .theme-light-global .perm-controls {
                border: 2px solid rgba(0, 0, 0, 0.48) !important;
                background: rgba(251, 254, 255, 0.9) !important;
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
                overflow: visible;
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
                height: 100dvh !important;
                max-width: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                display: grid;
                grid-template-columns: 260px minmax(0, 1fr);
                gap: 0;
                background: radial-gradient(circle at top, rgba(255, 255, 255, 0.09), rgba(9, 9, 9, 0.98));
            }
            @media (max-width: 1024px) {
                #modal-admin-panel.godmode-modal .modal-content {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto 1fr;
                }
                .godmode-sidebar {
                    flex-direction: row !important;
                    overflow-x: auto;
                    padding: 8px !important;
                    gap: 8px !important;
                    scrollbar-width: none; /* Firefox */
                }
                .godmode-sidebar::-webkit-scrollbar {
                    display: none; /* Safari and Chrome */
                }
                .godmode-sidebar button {
                    font-size: 11px !important;
                    padding: 6px 12px !important;
                    white-space: nowrap !important;
                }
                .godmode-main {
                    padding: 10px !important;
                    overflow-x: hidden !important;
                }
                .godmode-main [style*="grid-template-columns"] {
                    grid-template-columns: 1fr !important;
                }
                .godmode-main [style*="justify-content:space-between"] {
                    flex-wrap: wrap;
                }
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
            .admin-form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .admin-form-label {
                font-size: 12px;
                color: var(--text-muted);
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .admin-color-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 10px;
                margin-top: 10px;
            }
            .admin-color-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 10px;
                border: 1px solid var(--border-light);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.03);
            }
            .admin-color-field input[type="color"] {
                width: 100%;
                height: 38px;
                margin: 0;
                border-radius: 8px;
                padding: 2px;
                border: 1px solid var(--border-light);
            }
            .admin-editor-block {
                border: 1px solid var(--border-light);
                border-radius: 12px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.02);
                display: flex;
                flex-direction: column;
                gap: 8px;
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
            customBadge.innerHTML = `Сейчас в комнатах - <span id="custom-online-count">0</span>`;
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

class MediaResolverClient {
    static apiBase = (typeof window !== 'undefined' && window.COWIO_MEDIA_API)
        ? String(window.COWIO_MEDIA_API).replace(/\/$/, '')
        : '';

    static pending = new Map();
    static RESOLVE_STALE_MS = 12 * 60 * 1000;

    static PLATFORM_RE = /rutube\.ru|youtube\.com|youtu\.be|vk\.com|vkvideo\.ru|vimeo\.com|twitch\.tv/i;

    static needsResolve(url = '') {
        const value = String(url || '').trim();
        if (!value) return false;
        if (this.PLATFORM_RE.test(value)) return true;
        try {
            const host = new URL(value).hostname.toLowerCase();
            return host.includes('rutube.ru');
        } catch {
            return false;
        }
    }

    static extractYouTubeId(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/i);
        if (match && match[1] && match[1].length >= 10) return match[1];
        return null;
    }

    static extractRutubeId(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/i);
        if (match && match[1]) return match[1];
        return null;
    }

    static isDirectMedia(url = '') {
        return /\.(mp4|webm|m4v|mov|mkv|m3u8)(\?|#|$)/i.test(String(url || ''));
    }

    static getErrorMessage(code, fallback = '') {
        const map = {
            INVALID_URL: 'Некорректная ссылка',
            UNSUPPORTED_URL: 'Платформа не поддерживается',
            TIMEOUT: 'Превышено время ожидания извлечения',
            EXTRACTION_FAILED: 'Не удалось извлечь видео',
            BOT_PROTECTION: 'Видео защищено от ботов. Попробуйте другой сервис.',
            RATE_LIMITED: 'Слишком много запросов, попробуйте позже',
            NETWORK: 'Backend выключен (node server.js). Без него извлечение видео невозможно.'
        };
        return map[code] || fallback || 'Ошибка извлечения видео';
    }

    static setModalStatus(state = 'idle', message = '') {
        const el = Utils.$('room-media-status');
        if (!el) return;
        el.dataset.state = state;
        el.className = `room-media-status state-${state}`;
        el.textContent = message || '';
        el.style.display = message ? 'block' : 'none';
    }

    static bindRoomUrlInput() {
        const input = Utils.$('room-input-url');
        const previewBtn = Utils.$('btn-preview-media');
        const ytNote = Utils.$('yt-create-note');
        if (!input) return;

        const checkYt = () => {
            if (!ytNote) return;
            const url = input.value.trim();
            const isYt = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/i.test(url);
            ytNote.style.display = isYt ? 'block' : 'none';
        };

        const runPreview = Utils.debounce(async () => {
            const url = input.value.trim();
            if (!url) {
                this.setModalStatus('idle', '');
                return;
            }
            if (!this.needsResolve(url) && !this.isDirectMedia(url)) {
                this.setModalStatus('idle', 'Ссылка будет сохранена как есть');
                return;
            }
            try {
                const data = await this.resolve(url);
                const dur = data.duration ? ` · ${Math.floor(data.duration / 60)}:${String(Math.floor(data.duration % 60)).padStart(2, '0')}` : '';
                this.setModalStatus('success', `${data.platform}: ${data.title || 'Видео'}${dur}`);
            } catch (err) {
                this.setModalStatus('error', err.message);
            }
        }, 700);

        input.addEventListener('input', () => {
            checkYt();
            runPreview();
        });
        
        // Also check on init in case of edit mode
        const observer = new MutationObserver((mutations) => {
            if (input.value) checkYt();
        });
        observer.observe(Utils.$('modal-room'), { attributes: true, attributeFilter: ['class'] });

        if (previewBtn) {
            previewBtn.onclick = async () => {
                const url = input.value.trim();
                if (!url) return Utils.toast('Вставьте ссылку на видео', 'error');
                try {
                    const data = await this.resolve(url);
                    Utils.toast(`Готово: ${data.title || data.platform}`);
                    this.setModalStatus('success', `${data.platform}: ${data.title || 'Видео'}`);
                } catch (err) {
                    Utils.toast(err.message, 'error');
                    this.setModalStatus('error', err.message);
                }
            };
        }
    }

    static async resolve(url) {
        const normalized = String(url || '').trim();
        if (!normalized) {
            throw Object.assign(new Error('Пустая ссылка'), { code: 'INVALID_URL' });
        }
        if (this.pending.has(normalized)) return this.pending.get(normalized);

        const ytId = this.extractYouTubeId(normalized);
        if (ytId) {
            return {
                source: normalized,
                title: 'YouTube Video',
                duration: 0,
                thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
                platform: 'youtube',
                isHls: false,
                ext: 'youtube',
                resolvedAt: Date.now()
            };
        }
        
        const rutubeId = this.extractRutubeId(normalized);
        if (rutubeId) {
            return {
                source: normalized,
                title: 'Rutube Video',
                duration: 0,
                thumbnail: `https://rutube.ru/api/video/${rutubeId}/thumbnail/?format=json`, // Placeholder, real thumbnail requires API call we skip for now
                platform: 'rutube',
                isHls: false,
                ext: 'rutube',
                resolvedAt: Date.now()
            };
        }

        const task = (async () => {
            this.setModalStatus('loading', 'Извлекаем поток через yt-dlp…');
            let response;
            try {
                response = await fetch(`${this.apiBase}/api/resolve-media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: normalized })
                });
            } catch {
                throw Object.assign(new Error(this.getErrorMessage('NETWORK')), { code: 'NETWORK' });
            }

            let payload = null;
            try {
                payload = await response.json();
            } catch {
                throw Object.assign(new Error('Некорректный ответ media resolver'), { code: 'EXTRACTION_FAILED' });
            }

            if (!response.ok || !payload?.success) {
                const code = payload?.code || (response.status === 504 ? 'TIMEOUT' : 'EXTRACTION_FAILED');
                throw Object.assign(new Error(this.getErrorMessage(code, payload?.error)), { code });
            }

            return {
                source: payload.source,
                title: payload.title || '',
                duration: Number(payload.duration) || 0,
                thumbnail: payload.thumbnail || '',
                platform: payload.platform || 'unknown',
                isHls: Boolean(payload.isHls),
                ext: payload.ext || '',
                resolvedAt: Number(payload.resolvedAt) || Date.now()
            };
        })();

        this.pending.set(normalized, task);
        try {
            return await task;
        } finally {
            this.pending.delete(normalized);
            const input = Utils.$('room-input-url');
            if (input && !input.value.trim()) this.setModalStatus('idle', '');
        }
    }

    static async buildRoomVideoFields(inputUrl) {
        const trimmed = String(inputUrl || '').trim();
        if (!trimmed) {
            return {
                videoUrl: '',
                videoSourceUrl: '',
                videoPlatform: '',
                videoIsHls: false,
                videoResolvedAt: 0,
                videoTitle: '',
                videoThumbnail: ''
            };
        }

        if (this.needsResolve(trimmed)) {
            const resolved = await this.resolve(trimmed);
            return {
                videoUrl: resolved.source,
                videoSourceUrl: trimmed,
                videoPlatform: resolved.platform,
                videoIsHls: resolved.isHls,
                videoResolvedAt: resolved.resolvedAt,
                videoTitle: resolved.title,
                videoThumbnail: resolved.thumbnail
            };
        }

        return {
            videoUrl: trimmed,
            videoSourceUrl: trimmed,
            videoPlatform: this.isDirectMedia(trimmed) ? 'direct' : 'external',
            videoIsHls: /\.m3u8(\?|#|$)/i.test(trimmed),
            videoResolvedAt: Date.now(),
            videoTitle: '',
            videoThumbnail: ''
        };
    }

    static shouldRefreshResolved(room = {}) {
        const source = room.videoSourceUrl || '';
        if (!source || !this.needsResolve(source)) return false;
        const resolvedAt = Number(room.videoResolvedAt || 0);
        if (!resolvedAt) return true;
        return Date.now() - resolvedAt > this.RESOLVE_STALE_MS;
    }
}

class RutubePlayerManager {
    static player = null;
    static apiReady = false;
    static iframe = null;

    static destroy() {
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
        this.player = null;
        window.removeEventListener('message', this.handleMessage);
    }

    static handleMessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.type === 'player:currentTime') {
                this.currentTime = data.data.time;
            } else if (data.type === 'player:stateChange') {
                if (this.onStateChange) this.onStateChange(data.data.state);
            }
        } catch {}
    };

    static initPlayer(rutubeId, onStateChangeCallback) {
        this.destroy();
        this.onStateChange = onStateChangeCallback;
        const container = Utils.$('yt-player');
        container.innerHTML = '';
        this.iframe = document.createElement('iframe');
        this.iframe.src = `https://rutube.ru/play/embed/${rutubeId}/?autoStart=false`;
        this.iframe.frameBorder = '0';
        this.iframe.allow = 'clipboard-write; autoplay';
        this.iframe.webkitAllowFullScreen = true;
        this.iframe.mozallowfullscreen = true;
        this.iframe.allowFullscreen = true;
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        container.appendChild(this.iframe);
        
        window.addEventListener('message', this.handleMessage);
        
        this.player = {
            postMessage: (type, data) => {
                if (this.iframe && this.iframe.contentWindow) {
                    this.iframe.contentWindow.postMessage(JSON.stringify({ type, data }), '*');
                }
            }
        };
        
        return Promise.resolve(this.player);
    }

    static play() {
        if (this.player) this.player.postMessage('player:play', {});
    }

    static pause() {
        if (this.player) this.player.postMessage('player:pause', {});
    }
    
    static getState() {
        // Rutube has limited exposed state via postMessage unless tracked
        // but we track onStateChange in handleMessage? Actually we just pass it.
        // For simplicity, return null if unknown.
        return null; 
    }

    static seek(time) {
        if (this.player) this.player.postMessage('player:setCurrentTime', { time });
    }

    static getCurrentTime() {
        return this.currentTime || 0;
    }

    static setVolume(vol) {
        if (this.player) this.player.postMessage('player:setVolume', { volume: vol });
    }
}

class YouTubePlayerManager {
    static player = null;
    static apiReady = false;

    static _loadPromise = null;
    static loadApi() {
        if (window.YT && window.YT.Player) {
            this.apiReady = true;
            return Promise.resolve();
        }
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = new Promise(resolve => {
            const check = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(check);
                    this.apiReady = true;
                    resolve();
                }
            }, 100);
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }
        });
        return this._loadPromise;
    }

    static async initPlayer(videoId, onStateChange) {
        await this.loadApi();
        return new Promise(resolve => {
            if (this.player && this.playerReady) {
                try {
                    this.player.loadVideoById(videoId);
                    this.player.getIframe().style.pointerEvents = 'auto';
                    setTimeout(() => typeof RoomManager !== 'undefined' && RoomManager.forceSyncVideo(), 800);
                } catch(e) {
                    console.error('Failed to load video on existing player', e);
                }
                resolve(this.player);
            } else {
                this.playerReady = false;
                this.player = new window.YT.Player('yt-player', {
                    videoId: videoId,
                    width: '100%',
                    height: '100%',
                    playerVars: {
                        autoplay: 1,
                        controls: 1,
                        disablekb: 0,
                        fs: 0,
                        modestbranding: 1,
                        rel: 0,
                        origin: window.location.origin
                    },
                    events: {
                        onReady: () => {
                            this.playerReady = true;
                            try {
                                this.player.getIframe().style.pointerEvents = 'auto';
                            } catch (e) {}
                            setTimeout(() => {
                                if (typeof RoomManager !== 'undefined') RoomManager.forceSyncVideo();
                                if (this.player && this.player.playVideo) this.player.playVideo();
                            }, 500);
                            resolve(this.player);
                        },
                        onStateChange: (e) => onStateChange(e),
                        onError: (e) => {
                            console.error('YouTube Player Error:', e.data);
                            Utils.toast(e.data === 150 ? 'Владелец видео запретил его воспроизведение на других сайтах' : 'Ошибка YouTube плеера (Код ' + e.data + ')', 'error');
                            resolve(this.player);
                        }
                    }
                });
            }
        });
    }

    static play() { if (this.player && this.playerReady && this.player.playVideo) this.player.playVideo(); }
    static pause() { if (this.player && this.playerReady && this.player.pauseVideo) this.player.pauseVideo(); }
    static getState() {
        if (!this.player || !this.playerReady || !this.player.getPlayerState) return null;
        const state = this.player.getPlayerState();
        if (state === window.YT.PlayerState.PLAYING) return 'playing';
        if (state === window.YT.PlayerState.PAUSED) return 'paused';
        return null;
    }
    static seek(time) { if (this.player && this.playerReady && this.player.seekTo) this.player.seekTo(time, true); }
    static getCurrentTime() { return this.player && this.playerReady && this.player.getCurrentTime ? this.player.getCurrentTime() : 0; }
    static destroy() {
        this.playerReady = false;
        if (this.player && typeof this.player.destroy === 'function') {
            try { this.player.destroy(); } catch(e){}
            this.player = null;
        }
        const container = document.getElementById('yt-player-container');
        if (container) {
            container.innerHTML = '<div id="yt-player"></div>';
        }
    }
}

class VideoPlaybackManager {
    static hlsInstance = null;
    static lastSignature = '';

    static getPlaybackSignature(room = {}) {
        return [
            room.videoUrl || '',
            room.videoSourceUrl || '',
            room.videoResolvedAt || '',
            room.videoIsHls ? '1' : '0'
        ].join('|');
    }

    static destroy() {
        const vid = Utils.$('native-player');
        if (this.hlsInstance) {
            try { this.hlsInstance.destroy(); } catch { /* ignore */ }
            this.hlsInstance = null;
        }
        if (vid) {
            vid.pause();
            vid.removeAttribute('src');
            vid.load();
            delete vid.dataset.playbackKey;
            delete vid.dataset.roomUrl;
            vid.onerror = null;
        }
        YouTubePlayerManager.destroy();
        RutubePlayerManager.destroy();
        this.lastSignature = '';
        Ambilight.stop();
    }

    static detach(vid) {
        if (!vid) return;
        if (this.hlsInstance) {
            try { this.hlsInstance.destroy(); } catch { /* ignore */ }
            this.hlsInstance = null;
        }
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        delete vid.dataset.playbackKey;
        delete vid.dataset.roomUrl;
        vid.onerror = null;
        
        YouTubePlayerManager.destroy();
        this.lastSignature = '';
        Ambilight.stop();
        if (Utils.$('yt-player-container')) Utils.$('yt-player-container').style.display = 'none';
        vid.style.display = 'block';
    }

    static async resolvePlaybackSource(room = {}) {
        const sourceUrl = String(room.videoSourceUrl || room.videoUrl || '').trim();
        const playbackUrl = String(room.videoUrl || '').trim();

        if (!sourceUrl) return { source: '', isHls: false };

        if (MediaResolverClient.shouldRefreshResolved(room)) {
            Utils.toast('Обновляем ссылку на поток…', 'info');
            const fresh = await MediaResolverClient.resolve(sourceUrl);
            return { source: fresh.source, isHls: fresh.isHls, meta: fresh };
        }

        if (MediaResolverClient.needsResolve(sourceUrl)) {
            if (playbackUrl) {
                return {
                    source: playbackUrl,
                    isHls: Boolean(room.videoIsHls) || /\.m3u8(\?|#|$)/i.test(playbackUrl)
                };
            }
            const resolved = await MediaResolverClient.resolve(sourceUrl);
            return { source: resolved.source, isHls: resolved.isHls, meta: resolved };
        }

        return {
            source: playbackUrl || sourceUrl,
            isHls: Boolean(room.videoIsHls) || /\.m3u8(\?|#|$)/i.test(playbackUrl || sourceUrl)
        };
    }

    static attachSource(vid, source, isHls) {
        this.detach(vid);
        if (!source) return;

        const useHls = isHls || /\.m3u8(\?|#|$)/i.test(source);
        if (useHls && window.Hls && window.Hls.isSupported()) {
            this.hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 300,
                maxMaxBufferLength: 1200,
                maxBufferSize: 300 * 1024 * 1024,
                backBufferLength: 120,
                autoStartLoad: true,
                startFragPrefetch: true,
                fragLoadingTimeOut: 30000,
                manifestLoadingTimeOut: 30000,
                levelLoadingTimeOut: 30000
            });
            this.hlsInstance.loadSource(source);
            this.hlsInstance.attachMedia(vid);
            this.hlsInstance.on(window.Hls.Events.ERROR, (_evt, data) => {
                if (data && data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            Utils.toast('Сетевая ошибка потока (вероятно CORS или недоступен сервер). Пробую восстановить...', 'warn');
                            this.hlsInstance.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            Utils.toast('Медиа ошибка HLS, пробую восстановить...', 'warn');
                            this.hlsInstance.recoverMediaError();
                            break;
                        default:
                            Utils.toast('Критическая ошибка HLS-потока', 'error');
                            this.hlsInstance.destroy();
                            break;
                    }
                }
            });
            return;
        }

        if (useHls && vid.canPlayType('application/vnd.apple.mpegurl')) {
            vid.src = source;
            vid.load();
            return;
        }

        if (useHls) {
            Utils.toast('HLS не поддерживается в этом браузере', 'error');
            return;
        }

        vid.src = source;
        vid.load();
    }

    static async applyRoomVideo(room = {}) {
        const vid = Utils.$('native-player');
        if (!vid) return;

        vid.onloadedmetadata = () => {
            if (typeof RoomManager !== 'undefined') RoomManager.forceSyncVideo();
        };

        const signature = this.getPlaybackSignature(room);
        const ytId = MediaResolverClient.extractYouTubeId(room.videoSourceUrl || room.videoUrl);
        const rtId = MediaResolverClient.extractRutubeId(room.videoSourceUrl || room.videoUrl);
        
        if (signature === this.lastSignature && (vid.dataset.playbackKey || ((YouTubePlayerManager.player && ytId) || (RutubePlayerManager.player && rtId)))) return;

        try {
            if (ytId || rtId) {
                this.detach(vid);
                this.lastSignature = signature;
                if (Utils.$('yt-player-container')) Utils.$('yt-player-container').style.display = 'block';
                vid.style.display = 'none';
                
                const onStateChange = (e) => {
                    if (window._isSyncingVideo) return; // ignore events during forceSync
                    
                    const isYT = ytId;
                    const state = isYT ? e.data : e; 
                    const playingState = isYT ? (window.YT ? window.YT.PlayerState.PLAYING : 1) : 'playing';
                    const pausedState = isYT ? (window.YT ? window.YT.PlayerState.PAUSED : 2) : 'paused';
                    const Manager = isYT ? YouTubePlayerManager : RutubePlayerManager;
                    
                    if (state === playingState) {
                        if (AppState.ignoreVideoEvents) return;
                        if (!RoomManager.hasPerm('player')) return;
                        if (Manager.getCurrentTime() === 0 && AppState.lastKnownSyncState && AppState.lastKnownSyncState.time > 2) return; // Prevent spurious 0:00 broadcasts on load
                        
                        AppState.ignoreVideoEvents = true;
                        set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
                            type: 'play',
                            state: 'playing',
                            time: Manager.getCurrentTime(),
                            ts: Date.now()
                        });
                        setTimeout(() => AppState.ignoreVideoEvents = false, 1500);
                    } else if (state === pausedState) {
                        if (AppState.ignoreVideoEvents || window._isSyncingVideo) return;
                        if (!RoomManager.hasPerm('player')) return;
                        AppState.ignoreVideoEvents = true;
                        set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
                            type: 'pause',
                            state: 'paused',
                            time: Manager.getCurrentTime(),
                            ts: Date.now()
                        });
                        setTimeout(() => AppState.ignoreVideoEvents = false, 1500);
                    }
                };

                if (ytId) {
                    await YouTubePlayerManager.initPlayer(ytId, onStateChange);
                } else {
                    await RutubePlayerManager.initPlayer(rtId, onStateChange);
                }
                vid.dataset.playbackKey = signature;
                return;
            }

            const playback = await this.resolvePlaybackSource(room);
            const source = String(playback.source || '').trim();

            this.lastSignature = signature;
            vid.dataset.playbackKey = signature;
            vid.dataset.roomUrl = source;

            if (Utils.$('yt-player-container')) Utils.$('yt-player-container').style.display = 'none';
            vid.style.display = 'block';

            this.attachSource(vid, source, playback.isHls);

            vid.controls = true;
            vid.playsInline = true;
            vid.preload = 'auto';
            vid.onerror = () => {
                Utils.toast('Плеер не смог загрузить видео. Проверьте ссылку или пересоздайте комнату.', 'error');
            };

            Ambilight.start(vid);
        } catch (err) {
            Utils.toast(err.message || 'Ошибка загрузки видео', 'error');
        }
    }

    static syncRoomVideoIfChanged(room = {}) {
        if (!AppState.currentRoomId) return;
        const signature = this.getPlaybackSignature(room);
        if (signature !== this.lastSignature) {
            this.applyRoomVideo(room).catch(() => {});
        }
    }
}

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

/** Общая «связь» пары: тепло, серия дней, моменты — без трекинга комнат */
class PartnerBondEngine {
    static MOMENT_LABELS = {
        union: 'Стались парой',
        kiss: 'Поцелуй',
        checkin: 'Отметка дня',
        milestone: 'Веха'
    };

    static dateKey(ts = Date.now()) {
        return new Date(ts).toISOString().slice(0, 10);
    }

    static pairKey(uidA, uidB) {
        return [uidA, uidB].sort().join('__');
    }

    static bondRef(uidA, uidB) {
        return ref(db, `bonds/${this.pairKey(uidA, uidB)}`);
    }

    static async getBond(uidA, uidB) {
        if (!uidA || !uidB) return { totalWarmth: 0, streak: 0, lastStreakKey: '', moments: {}, daily: {}, checkins: {} };
        const snap = await get(this.bondRef(uidA, uidB));
        const raw = snap.val() || {};
        return {
            totalWarmth: Number(raw.totalWarmth || 0),
            streak: Number(raw.streak || 0),
            lastStreakKey: raw.lastStreakKey || '',
            moments: raw.moments || {},
            daily: raw.daily || {},
            checkins: raw.checkins || {}
        };
    }

    static yesterdayKey() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return this.dateKey(d.getTime());
    }

    static calcStreak(bond, dateKey = this.dateKey()) {
        const last = bond.lastStreakKey || '';
        if (!last) return 0;
        if (last === dateKey) return bond.streak || 0;
        if (last === this.yesterdayKey()) return (bond.streak >= 1) ? (bond.streak + 1) : 2;
        return 0;
    }

    static bondLevel(totalWarmth = 0) {
        return Math.max(1, Math.floor(totalWarmth / 120) + 1);
    }

    static levelProgress(totalWarmth = 0) {
        return Math.round(((totalWarmth % 120) / 120) * 100);
    }

    static async saveBond(uidA, uidB, bond) {
        await set(this.bondRef(uidA, uidB), {
            totalWarmth: bond.totalWarmth,
            streak: bond.streak,
            lastStreakKey: bond.lastStreakKey,
            moments: bond.moments,
            daily: bond.daily,
            checkins: bond.checkins,
            updatedAt: Date.now()
        });
    }

    static async recordMoment(uidA, uidB, type, extra = {}) {
        if (!uidA || !uidB || String(uidB).startsWith('custom_partner_')) return null;
        const bond = await this.getBond(uidA, uidB);
        const dateKey = this.dateKey();
        const momentId = Utils.generateCryptoId(10);
        const label = extra.label || this.MOMENT_LABELS[type] || 'Момент';
        const moment = { type, label, ts: extra.ts || Date.now(), fromUid: extra.fromUid || uidA };
        bond.moments = bond.moments || {};
        bond.moments[momentId] = moment;
        if (extra.checkinKey) {
            bond.checkins = bond.checkins || {};
            bond.checkins[extra.checkinKey] = true;
        }

        const daily = bond.daily?.[dateKey] || { warmth: 0, moments: 0 };
        const warmthGain = Number(extra.warmth || (type === 'kiss' ? 8 : type === 'checkin' ? 12 : type === 'union' ? 25 : 5));
        daily.warmth = Math.min(100, Number(daily.warmth || 0) + warmthGain);
        daily.moments = Number(daily.moments || 0) + 1;
        bond.daily = bond.daily || {};
        bond.daily[dateKey] = daily;
        bond.totalWarmth = Number(bond.totalWarmth || 0) + warmthGain;
        bond.streak = this.calcStreak(bond, dateKey);
        bond.lastStreakKey = dateKey;

        await this.saveBond(uidA, uidB, bond);
        return bond;
    }

    static async onUnion(uidA, uidB, sinceTs = Date.now()) {
        await this.recordMoment(uidA, uidB, 'union', { label: 'Стались парой 💞', warmth: 30, ts: sinceTs });
    }

    static async sendKiss(fromUid, partnerUid) {
        return this.recordMoment(fromUid, partnerUid, 'kiss', { fromUid, label: 'Воздушный поцелуй 💋', warmth: 10 });
    }

    static async dailyCheckin(uid, partnerUid) {
        const dateKey = this.dateKey();
        const checkinKey = `${dateKey}_${uid}`;
        const bond = await this.getBond(uid, partnerUid);
        if (bond.checkins?.[checkinKey]) return { ok: false, reason: 'already' };
        await this.recordMoment(uid, partnerUid, 'checkin', {
            fromUid: uid,
            label: 'Отметили день вместе <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">',
            warmth: 14,
            checkinKey
        });
        return { ok: true };
    }

    static canCheckinToday(bond, uid) {
        return !bond.checkins?.[`${this.dateKey()}_${uid}`];
    }

    static buildTrailDays(sinceTs, bond) {
        const days = [];
        const cursor = new Date(sinceTs || Date.now());
        cursor.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const momentsList = Object.values(bond.moments || {}).sort((a, b) => a.ts - b.ts);

        for (let d = new Date(cursor); d <= end; d.setDate(d.getDate() + 1)) {
            const key = this.dateKey(d.getTime());
            const row = bond.daily?.[key] || {};
            const dayMoments = momentsList.filter(m => this.dateKey(m.ts) === key);
            const lastMoment = dayMoments[dayMoments.length - 1];
            days.push({
                key,
                label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
                warmth: Number(row.warmth || 0),
                momentsCount: Number(row.moments || dayMoments.length),
                lastMomentLabel: lastMoment?.label || '',
                isToday: key === this.dateKey()
            });
        }
        return days;
    }

}

class PartnerRelationshipPanel {
    static milestones = [7, 30, 100, 365];
    static lastContext = null;

    static async open(ownerUid, partnerUid, myProf, theirProf, sinceTs) {
        const root = Utils.$('partner-ambilight-root');
        const modal = Utils.$('modal-partner-view');
        if (!root || !modal) return;

        const myUid = AppState.currentUser?.uid || ownerUid;
        const daysTogether = sinceTs ? Math.max(1, Math.ceil((Date.now() - sinceTs) / 86400000)) : 1;
        const sinceText = sinceTs ? new Date(sinceTs).toLocaleDateString('ru-RU') : 'недавно';

        let bond = await PartnerBondEngine.getBond(myUid, partnerUid);
        if (sinceTs && daysTogether >= 7 && Object.keys(bond.moments || {}).length === 0) {
            await PartnerBondEngine.onUnion(myUid, partnerUid, sinceTs);
            bond = await PartnerBondEngine.getBond(myUid, partnerUid);
        }

        const trailDays = PartnerBondEngine.buildTrailDays(sinceTs || Date.now(), bond);
        const level = PartnerBondEngine.bondLevel(bond.totalWarmth);
        const levelPct = PartnerBondEngine.levelProgress(bond.totalWarmth);
        const warmthFill = Math.min(100, Math.round((bond.totalWarmth % 120) / 1.2) || (trailDays[trailDays.length - 1]?.warmth || 0));
        const momentsTotal = Object.keys(bond.moments || {}).length;
        const nextMilestone = this.milestones.find(m => m > daysTogether) || this.milestones[this.milestones.length - 1];
        const milestoneProgress = Math.min(100, Math.round((daysTogether / nextMilestone) * 100));
        const canCheckin = PartnerBondEngine.canCheckinToday(bond, myUid);

        this.lastContext = { ownerUid, partnerUid, myUid, myProf, theirProf, sinceTs };

        const pathMarkup = this.buildZigzagMarkup(trailDays, daysTogether);
        root.innerHTML = `
            <div class="partner-ambilight-panel" style="--together-pct:${warmthFill};">
                <div class="partner-ambilight-glow" aria-hidden="true"></div>
                <div class="partner-ambilight-shine" aria-hidden="true"></div>
                <header class="partner-ambilight-header">
                    <div class="partner-ambilight-couple">
                        <div class="partner-ambilight-avatar heartbeat" id="partner-modal-my-avatar"></div>
                        <div class="partner-ambilight-link" aria-hidden="true">
                            <span class="partner-link-pulse"></span>
                            <span class="partner-link-icon">💞</span>
                        </div>
                        <div class="partner-ambilight-avatar heartbeat" id="partner-modal-their-avatar"></div>
                    </div>
                    <div class="partner-ambilight-titles">
                        <h2 id="partner-modal-names">${Utils.escapeHtml(myProf.name)} & ${Utils.escapeHtml(theirProf.name)}</h2>
                        <p id="partner-modal-stats">Уровень ${level} · ${daysTogether} дн. вместе · с ${sinceText}</p>
                    </div>
                </header>
                <section class="partner-ambilight-metrics">
                    <div class="partner-metric-ring" title="Прогресс до следующего уровня связи">
                        <svg viewBox="0 0 72 72">
                            <defs><linearGradient id="partnerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff9fd4"/><stop offset="100%" stop-color="#9eb8ff"/></linearGradient></defs>
                            <circle cx="36" cy="36" r="30" class="ring-bg"/>
                            <circle cx="36" cy="36" r="30" class="ring-val" style="stroke-dasharray:${levelPct * 1.885} 188.5"/>
                        </svg>
                        <div class="ring-label"><strong>${levelPct}%</strong><span>уровень</span></div>
                    </div>
                    <div class="partner-metric-card">
                        <span class="metric-label">Тепло связи</span>
                        <strong>${bond.totalWarmth} ✦</strong>
                    </div>
                    <div class="partner-metric-card">
                        <span class="metric-label">Серия дней</span>
                        <strong>${bond.streak || 0} <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"></strong>
                    </div>
                    <div class="partner-metric-card milestone-card">
                        <span class="metric-label">Моментов · до ${nextMilestone} дн.</span>
                        <div class="milestone-bar"><span style="width:${milestoneProgress}%"></span></div>
                        <strong>${momentsTotal} · ${milestoneProgress}%</strong>
                    </div>
                </section>
                <section class="partner-path-section">
                    <div class="partner-path-head">
                        <span>Тропинка моментов</span>
                        <span class="partner-path-hint">тепло дня и события</span>
                    </div>
                    <div class="partner-path-scroll">${pathMarkup}</div>
                    <div class="partner-path-tooltip" id="partner-path-tooltip" hidden></div>
                </section>
                <footer class="partner-ambilight-footer">
                    <button type="button" class="partner-kiss-btn" id="btn-partner-modal-kiss">Поцелуй 💋</button>
                    <button type="button" class="partner-checkin-btn" id="btn-partner-checkin" ${canCheckin ? '' : 'disabled'}>${canCheckin ? 'Отметить день <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : 'День отмечен'}</button>
                    <button type="button" class="secondary-btn btn-close-modal">Закрыть</button>
                </footer>
            </div>
        `;

        Utils.$('partner-modal-my-avatar').innerHTML = ProfileManager.getAvatarHtml(myProf);
        Utils.$('partner-modal-their-avatar').innerHTML = ProfileManager.getAvatarHtml(theirProf);
        this.bindPathNodes();
        this.bindActions();
        modal.classList.add('active');
    }

    static buildZigzagMarkup(days, daysTogether = 1) {
        if (!days.length) {
            return '<div class="partner-path-empty">Отметьте день или отправьте поцелуй — тропинка оживёт</div>';
        }

        const padY = 24;
        const rowGap = 56;
        const colLeft = 42;
        const colRight = 258;
        const width = 300;
        const rows = Math.ceil(days.length / 2);
        const height = padY * 2 + Math.max(0, rows - 1) * rowGap + 20;

        const points = days.map((day, i) => {
            const row = Math.floor(i / 2);
            return {
                day,
                x: i % 2 === 0 ? colLeft : colRight,
                y: padY + row * rowGap
            };
        });

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const maxWarmth = Math.max(1, ...days.map(d => d.warmth));
        const nodes = points.map((p, i) => {
            const intensity = 0.2 + (p.day.warmth / maxWarmth) * 0.8;
            const dayNum = i + 1;
            const isMilestone = this.milestones.includes(dayNum) || this.milestones.includes(daysTogether - (days.length - 1 - i));
            return `
                <g class="partner-path-node ${p.day.isToday ? 'is-today' : ''} ${isMilestone ? 'is-milestone' : ''} ${p.day.warmth > 0 ? 'has-warmth' : ''}"
                   data-warmth="${p.day.warmth}"
                   data-moments="${p.day.momentsCount}"
                   data-moment="${Utils.escapeHtml(p.day.lastMomentLabel || '')}"
                   data-label="${Utils.escapeHtml(p.day.label)}"
                   data-weekday="${Utils.escapeHtml(p.day.weekday)}"
                   style="--node-glow:${intensity}">
                    <circle class="node-halo" cx="${p.x}" cy="${p.y}" r="14"/>
                    <circle class="node-core" cx="${p.x}" cy="${p.y}" r="7"/>
                    ${isMilestone ? `<text class="node-star" x="${p.x}" y="${p.y - 18}" text-anchor="middle">✦</text>` : ''}
                </g>
            `;
        }).join('');

        return `
            <svg class="partner-zigzag-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet">
                <defs>
                    <linearGradient id="partnerPathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(255,143,198,0.9)"/>
                        <stop offset="50%" stop-color="rgba(186,130,255,0.75)"/>
                        <stop offset="100%" stop-color="rgba(120,210,255,0.85)"/>
                    </linearGradient>
                </defs>
                <path class="partner-path-line" d="${pathD}" fill="none" stroke="url(#partnerPathGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                ${nodes}
            </svg>
        `;
    }

    static bindPathNodes() {
        const tooltip = Utils.$('partner-path-tooltip');
        const scroll = document.querySelector('.partner-path-scroll');
        if (!tooltip || !scroll) return;

        const showTip = (node, clientX, clientY) => {
            const warmth = Number(node.dataset.warmth || 0);
            const moments = Number(node.dataset.moments || 0);
            const moment = node.dataset.moment || '';
            const label = node.dataset.label || '';
            const weekday = node.dataset.weekday || '';
            tooltip.hidden = false;
            tooltip.innerHTML = `
                <strong>${Utils.escapeHtml(label)} · ${Utils.escapeHtml(weekday)}</strong>
                <span class="tip-warmth">Тепло дня: ${warmth}/100</span>
                <span class="tip-moments">Моментов: ${moments}</span>
                ${moment ? `<span class="tip-last">${Utils.escapeHtml(moment)}</span>` : '<span class="tip-last">Тихий день — добавьте поцелуй или отметку</span>'}
            `;
            const rect = scroll.getBoundingClientRect();
            tooltip.style.left = `${Math.min(Math.max(12, clientX - rect.left), rect.width - 180)}px`;
            tooltip.style.top = `${Math.max(8, clientY - rect.top - 88)}px`;
        };

        scroll.querySelectorAll('.partner-path-node').forEach(node => {
            node.addEventListener('mouseenter', (e) => showTip(node, e.clientX, e.clientY));
            node.addEventListener('mousemove', (e) => showTip(node, e.clientX, e.clientY));
            node.addEventListener('mouseleave', () => { tooltip.hidden = true; });
            node.addEventListener('click', (e) => {
                scroll.querySelectorAll('.partner-path-node').forEach(n => n.classList.remove('is-pinned'));
                node.classList.add('is-pinned');
                showTip(node, e.clientX, e.clientY);
            });
        });
    }

    static bindActions() {
        const ctx = this.lastContext;
        if (!ctx) return;

        const kissBtn = Utils.$('btn-partner-modal-kiss');
        if (kissBtn) {
            kissBtn.onclick = async () => {
                const rect = kissBtn.getBoundingClientRect();
                for (let i = 0; i < 15; i++) {
                    const heart = document.createElement('div');
                    heart.innerText = ['💖', '💋', '💕', '💘'][Math.floor(Math.random() * 4)];
                    heart.style.cssText = `position:fixed;left:${rect.left + rect.width / 2 + (Math.random() - 0.5) * 50}px;top:${rect.top}px;font-size:${20 + Math.random() * 20}px;pointer-events:none;z-index:10000;transition:all 1.5s ease-out`;
                    document.body.appendChild(heart);
                    setTimeout(() => {
                        heart.style.transform = `translateY(-${100 + Math.random() * 100}px) scale(1.5) rotate(${(Math.random() - 0.5) * 90}deg)`;
                        heart.style.opacity = '0';
                    }, 50);
                    setTimeout(() => heart.remove(), 1600);
                }
                await PartnerBondEngine.sendKiss(ctx.myUid, ctx.partnerUid);
                Utils.toast('Поцелуй отправлен — связь стала теплее');
                await this.open(ctx.ownerUid, ctx.partnerUid, ctx.myProf, ctx.theirProf, ctx.sinceTs);
            };
        }

        const checkinBtn = Utils.$('btn-partner-checkin');
        if (checkinBtn) {
            checkinBtn.onclick = async () => {
                const res = await PartnerBondEngine.dailyCheckin(ctx.myUid, ctx.partnerUid);
                if (!res.ok) return Utils.toast('Вы уже отметили сегодняшний день', 'info');
                Utils.toast('День отмечен — +тепло к связи');
                await this.open(ctx.ownerUid, ctx.partnerUid, ctx.myProf, ctx.theirProf, ctx.sinceTs);
            };
        }
    }
}

class BackgroundFX {
    static init() {
        const canvas = Utils.$('particle-canvas');
        if (!canvas) return;
        if (window.innerWidth < 768) {
            canvas.style.display = 'none';
            return;
        }
        const ctx = canvas.getContext('2d');
        let dots = [];
        const connectionStrength = new Map();
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
                if (isLight) {
                    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.8);
                    glow.addColorStop(0, 'rgba(0, 0, 0, 0.16)');
                    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.8, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
                } else {
                    ctx.fillStyle = "rgba(255,255,255,0.39)";
                }
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        
        for (let i = 0; i < 90; i++) dots.push(new Dot()); 
        
        function animate() {
            if (!isTabVisible) return; 
            ctx.clearRect(0, 0, canvas.width, canvas.height); // [FIX] Made clearRect so premium background shines through beautifully
            const t = performance.now() * 0.0016;

            for (let i = 0; i < dots.length; i++) {
                dots[i].update(); dots[i].draw();
                for (let j = i + 1; j < dots.length; j++) {
                    let dx = dots[i].x - dots[j].x;
                    let dy = dots[i].y - dots[j].y;
                    let dist = dx * dx + dy * dy;
                    const key = `${i}:${j}`;
                    const prevStrength = connectionStrength.get(key) || 0;
                    const targetStrength = dist < 25000 ? 1 : 0;
                    const nextStrength = prevStrength + (targetStrength - prevStrength) * 0.12;
                    if (nextStrength <= 0.01) {
                        connectionStrength.delete(key);
                        continue;
                    }
                    connectionStrength.set(key, nextStrength);
                    if (nextStrength > 0.02) {
                        const isLight = document.body.classList.contains('theme-light-global');
                        const distance = Math.sqrt(dist);
                        const proximity = Math.max(0, 1 - distance / 158);
                        const baseAlpha = Math.max(0.08, 0.39 - distance / 2000);
                        const pulse = 0.92 + Math.sin(t + i * 0.21 + j * 0.13) * 0.08;
                        const alpha = Math.min(0.55, (baseAlpha + proximity * 0.22) * nextStrength * pulse);
                        if (isLight) {
                            ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.38, alpha)})`;
                        } else {
                            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                        }
                        ctx.lineWidth = (isLight ? 1.6 : 1.4) * (0.75 + nextStrength * 0.25);
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
    static DURATION = 5000;
    static SOUND_URLS = {
        notification: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
        glass: 'https://actions.google.com/sounds/v1/impacts/glass_shatters_into_debris.ogg',
        vader: 'https://actions.google.com/sounds/v1/science_fiction/alien_breath.ogg',
        moo: 'https://actions.google.com/sounds/v1/animals/cow_moo_1.ogg', // cow sound
        grass: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg',
        milk: 'https://actions.google.com/sounds/v1/water/pour_water.ogg',
        popcorn: 'https://actions.google.com/sounds/v1/foley/bubble_wrap_popping.ogg',
        nyan: 'https://archive.org/download/nyancat_201906/nyancat.mp3',
        matrix: 'https://actions.google.com/sounds/v1/science_fiction/sci_fi_hum.ogg',
        scream: 'https://actions.google.com/sounds/v1/horror/male_scream_short.ogg',
        cheer: 'https://actions.google.com/sounds/v1/crowds/large_crowd_cheer_and_clap.ogg'
    };
    static COMMANDS = new Map([
        ['/moo', 'moo'],
        ['/grass', 'grass'],
        ['/milk', 'milk'],
        ['/popcorn', 'popcorn'],
        ['/dvd', 'dvd'],
        ['/matrix', 'matrix'],
        ['/shh', 'shh'],
        ['/nyan', 'nyan'],
        ['/scream', 'scream'],
        ['/cheer', 'cheer']
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
                cursor: url("https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Cow.webp") 16 16, auto !important;
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
                -webkit-backdrop-filter: blur(12px);
                box-shadow: 0 12px 30px rgba(0,0,0,0.35);
                transform: translateZ(0);
                -webkit-transform: translateZ(0);
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
                position: fixed;
                inset: 0;
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
        if (!key) return;
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
        if (!key) return;
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
        const myName = AppState.usersCache.get(uid)?.name || AppState.currentUser?.displayName || 'Кто-то';
        if (command) {
            await this.emitRoomEffect(command, { from: myName });
            Utils.toast(`Пасхалка ${trimmed} активирована`, 'info');
            return true;
        }

        if (trimmed.toLowerCase() === 'i am your father') {
            await push(chatRef, { uid, name: myName, text: trimmed, ts: Date.now() });
            await this.emitRoomEffect('vader', { from: myName });
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
            
            // ФИКС СИНХРОНИЗАЦИИ: Игнорируем все, что было вызвано ДО захода в комнату, и старше 5 сек.
            if (Date.now() - Number(payload.ts || 0) > 5000) return;
            if (Number(payload.ts || 0) < AppState.currentRoomJoinTs) return;

            if (AppState.easterEggs.processedRoomEvents.has(snap.key)) return;
            AppState.easterEggs.processedRoomEvents.add(snap.key);
            this.applyRoomEffect(payload);
        });
        AppState.roomSubscriptions.push(unsub);
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
                    this.playSound(this.SOUND_URLS.grass, { volume: 0.5 });
                    document.body.classList.add('easter-green');
                    this.showOverlay('green-overlay');
                }, () => {
                    document.body.classList.remove('easter-green');
                    this.hideOverlay('green-overlay');
                });
                break;
            case 'milk':
                this.activateLocalEffect('milk', () => this.startAdvancedMilk(), () => this.stopAdvancedMilk());
                break;
            case 'popcorn':
                this.activateLocalEffect('popcorn', () => this.startPopcornRain(), () => this.stopPopcornRain());
                break;
            case 'dvd':
                this.activateLocalEffect('dvd', () => this.startDvd(), () => this.stopDvd());
                break;
            case 'roll':
                this.activateLocalEffect('roll', () => {
                    this.playSound(this.SOUND_URLS.roll, { volume: 0.5 });
                    document.body.classList.add('easter-roll');
                }, () => document.body.classList.remove('easter-roll'));
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
            case 'scream':
                Utils.toast(`Скример${fromName} 👻`, 'info');
                this.activateLocalEffect('scream', () => this.playSound(this.SOUND_URLS.scream, { volume: 0.8 }), () => {}, 3000);
                break;
            case 'cheer':
                Utils.toast(`Овации${fromName} 👏`, 'success');
                this.activateLocalEffect('cheer', () => this.playSound(this.SOUND_URLS.cheer, { volume: 0.7 }), () => {}, 6000);
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

        // ФИКС: Остановка всех звуков при выходе
        if (AppState.easterEggs.audioPool) {
            for (const audio of AppState.easterEggs.audioPool) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = '';
                } catch(e) {}
            }
            AppState.easterEggs.audioPool.clear();
        }

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
        this.playSound(this.SOUND_URLS.milk, { volume: 0.5 });
        this.milkActive = true;
        let container = Utils.$('advanced-milk-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'advanced-milk-container';
            container.className = 'milk-wave-container';
            document.body.appendChild(container);
        }
        const html = `
            <div class="milk-liquid" id="milk-fill-anim">
                <div class="milk-surface"></div>
            </div>
            <div style="position:fixed; top:40%; left:50%; transform:translate(-50%,-50%); font-size:120px; z-index:9999; 
                animation: bounceInMilk 2s infinite alternate ease-in-out; pointer-events:none;">🥛</div>
        `;
        container.innerHTML = html;
        if (!document.getElementById('milk-css-fix')) {
            const style = document.createElement('style');
            style.id = 'milk-css-fix';
            style.innerHTML = `
                .milk-wave-container { position: fixed; inset: 0; pointer-events: none; z-index: 10000; overflow: hidden; transform: translateZ(0); }
                .milk-liquid { position: absolute; bottom: 0; left: 0; right: 0; height: 120vh; background: rgba(255, 255, 255, 0.95); box-shadow: inset 0 20px 40px rgba(100,150,255,0.1); transform: translateY(120vh); transition: transform 13.5s cubic-bezier(0.1, 0.8, 0.1, 1); }
                .milk-liquid.active { transform: translateY(0); }
                @keyframes waveSpill { 0% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-15%) scaleY(1.1); } 100% { transform: translateX(-30%) scaleY(1); } }
                .milk-surface { position: absolute; top: -80px; left: 0; width: 200%; height: 100px; background: radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.95) 40%, transparent 100%); animation: waveSpill 3s infinite linear alternate; }
                @keyframes bounceInMilk { 0% { transform: translate(-50%, -50%) rotate(-10deg) scale(0.9); } 100% { transform: translate(-50%, -60%) rotate(10deg) scale(1.1); } }
            `;
            document.head.appendChild(style);
        }
        setTimeout(() => {
            const fill = document.getElementById('milk-fill-anim');
            if (fill) fill.classList.add('active');
        }, 50);
    }

    static stopAdvancedMilk() {
        if (!this.milkActive) return;
        this.milkActive = false;
        const fill = document.getElementById('milk-fill-anim');
        if (fill) fill.classList.remove('active');
        const container = Utils.$('advanced-milk-container');
        if (container) {
            container.style.transition = 'opacity 1s';
            container.style.opacity = '0';
            setTimeout(() => container.remove(), 1000);
        }
    }

    static playNotification() {
        if (Date.now() < AppState.easterEggs.notificationMutedUntil) return;
        this.playSound(this.SOUND_URLS.notification, { volume: 0.28, fallback: () => this.playSimpleTone(880, 0.09, 'square', 0.05) });
    }

    static playMoo() {
        this.playSound(this.SOUND_URLS.moo, { volume: 0.6 });
        
        const container = document.createElement('div');
        container.style.cssText = `position:fixed; inset:0; pointer-events:none; z-index:9999; display:flex; align-items:center; justify-content:center;`;
        container.innerHTML = `<div style="font-size: 25vw; animation: mooZoom 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5)); will-change: transform, opacity;">🐄</div>`;
        if (!document.getElementById('moo-css')) {
            const s = document.createElement('style'); s.id = 'moo-css';
            s.innerHTML = `@keyframes mooZoom { 0% { transform: scale(0.1) translateY(50vh); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; transform: scale(1.5) translateY(-5vh); } 100% { transform: scale(2) translateY(-10vh); opacity: 0; } }`;
            document.head.appendChild(s);
        }
        document.body.appendChild(container);
        setTimeout(() => container.remove(), 2600);
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
        this.playSound(this.SOUND_URLS.popcorn, { volume: 0.5 });
        this.showOverlay('popcorn-overlay');
        const overlay = Utils.$('popcorn-overlay');
        if (!overlay) return;
        overlay.innerHTML = `
            <div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-size:120px; z-index:99; animation: rumblingBucket 0.5s infinite linear;">🍿</div>
            <div id="popcorn-particles"></div>
        `;
        if (!document.getElementById('popcorn-css-fix')) {
            const style = document.createElement('style');
            style.id = 'popcorn-css-fix';
            style.innerHTML = `
                @keyframes rumblingBucket { 0%{transform:translate(-50%,-50%) rotate(-5deg) scale(1);} 50%{transform:translate(-50%,-55%) rotate(5deg) scale(1.1);} 100%{transform:translate(-50%,-50%) rotate(-5deg) scale(1);} }
                .popcorn-p { position: absolute; left: 50%; top: 50%; font-size: 30px; will-change: transform, opacity; }
            `;
            document.head.appendChild(style);
        }
        const particles = Utils.$('popcorn-particles');
        const popcornInterval = setInterval(() => {
            if (!particles) return;
            for(let i=0; i<3; i++) {
                const item = document.createElement('div');
                item.innerText = '🍿';
                item.className = 'popcorn-p';
                particles.appendChild(item);
                const angle = Math.random() * Math.PI * 2;
                const velocity = 20 + Math.random() * 30;
                let vx = Math.cos(angle) * velocity;
                let vy = Math.sin(angle) * velocity - 20;
                let x = 0; let y = 0;
                let rot = 0; let rotV = (Math.random() - 0.5) * 20;
                const move = () => {
                    if(!item.parentNode) return;
                    x += vx; y += vy; vy += 1.5; rot += rotV;
                    item.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) rotate(${rot}deg)`;
                    item.style.opacity = Math.max(0, (window.innerHeight - Math.abs(y)) / window.innerHeight);
                    if (y > window.innerHeight / 2 + 100) item.remove();
                    else requestAnimationFrame(move);
                };
                requestAnimationFrame(move);
            }
        }, 100);
        AppState.easterEggs.animationHandles.set('popcorn', popcornInterval);
    }

    static stopPopcornRain() {
        const interval = AppState.easterEggs.animationHandles.get('popcorn');
        if (interval) clearInterval(interval);
        const overlay = Utils.$('popcorn-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 1s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                this.hideOverlay('popcorn-overlay');
                overlay.innerHTML = '';
                overlay.style.opacity = '1';
                AppState.easterEggs.animationHandles.delete('popcorn');
            }, 1000);
        }
    }

    static startDvd() {
        this.showOverlay('dvd-overlay');
        const overlay = Utils.$('dvd-overlay');
        if (!overlay) return;
        if (AppState.easterEggs.animationHandles.has('dvd')) cancelAnimationFrame(AppState.easterEggs.animationHandles.get('dvd'));
        overlay.innerHTML = '<div class="dvd-logo" id="dvd-logo-anim">DVD<br><span style="font-size:14px; font-weight:700; letter-spacing:4px">VIDEO</span></div>';
        if (!document.getElementById('dvd-css-fix')) {
            const style = document.createElement('style');
            style.id = 'dvd-css-fix';
            style.innerHTML = `
                #dvd-logo-anim { position: absolute; left: 0; top: 0; padding: 12px 24px; border-radius: 18px; border: 3px solid currentColor; font-weight: 900; font-size: 38px; text-align: center; line-height: 1; font-family: Impact, sans-serif; box-shadow: 0 10px 30px currentColor; filter: brightness(1.2); will-change: transform, color; }
            `;
            document.head.appendChild(style);
        }
        const logo = document.getElementById('dvd-logo-anim');
        let x = Math.random() * (window.innerWidth - 150);
        let y = Math.random() * (window.innerHeight - 100);
        let dx = 4; let dy = 4;
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
        let lastColor = colors[0];
        logo.style.color = lastColor;
        const tick = () => {
            if (!logo) return;
            const w = logo.offsetWidth || 150; const h = logo.offsetHeight || 100;
            x += dx; y += dy;
            let hit = false;
            if (x <= 0) { x = 0; dx = Math.abs(dx); hit = true; }
            else if (x + w >= window.innerWidth) { x = window.innerWidth - w; dx = -Math.abs(dx); hit = true; }
            if (y <= 0) { y = 0; dy = Math.abs(dy); hit = true; }
            else if (y + h >= window.innerHeight) { y = window.innerHeight - h; dy = -Math.abs(dy); hit = true; }
            if (hit) {
                let nc = colors[Math.floor(Math.random() * colors.length)];
                while (nc === lastColor) nc = colors[Math.floor(Math.random() * colors.length)];
                lastColor = nc; logo.style.color = nc;
            }
            logo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            AppState.easterEggs.animationHandles.set('dvd', requestAnimationFrame(tick));
        };
        tick();
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
        this.playSound(this.SOUND_URLS.matrix, { volume: 0.5 });
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
        const overlay = Utils.$('vhs-overlay');
        if (!overlay) return;
        if (!document.getElementById('vhs-css-fix')) {
            const style = document.createElement('style');
            style.id = 'vhs-css-fix';
            style.innerHTML = `
                @keyframes vhsGlitchAnim {
                    0% { transform: translateY(0) scale(1.01); filter: hue-rotate(0deg); }
                    50% { transform: translateY(2px) scale(1.01); filter: hue-rotate(4deg); }
                    100% { transform: translateY(-1px) scale(1.0); filter: hue-rotate(-2deg); }
                }
                @keyframes vhsTrackDown { 0% { top: -10vh; } 100% { top: 110vh; } }
                .vhs-css-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9998; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 2px, 3px 100%; animation: vhsGlitchAnim 0.15s infinite alternate ease-in-out; }
                .vhs-track-line { position: absolute; left: 0; right: 0; height: 10vh; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent); animation: vhsTrackDown 4s linear infinite; }
                .vhs-text { position: absolute; top: 40px; left: 40px; color: #fff; font-family: "Courier New", monospace; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 0px blue, -2px -2px 0px red; }
            `;
            document.head.appendChild(style);
        }
        overlay.innerHTML = `
            <div class="vhs-css-overlay">
                <div class="vhs-track-line"></div>
                <div class="vhs-text" id="vhs-time-text">PLAY ►</div>
            </div>
        `;
        const vhsInterval = setInterval(() => {
            const el = document.getElementById('vhs-time-text');
            if (el) {
                const d = new Date();
                const pad = n => n.toString().padStart(2, '0');
                const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                el.innerHTML = `PLAY ►<br><span style="font-size:24px">${t}</span>`;
            }
        }, 1000);
        AppState.easterEggs.animationHandles.set('vhs-text', vhsInterval);
    }

    static stopVhs() {
        document.body.classList.remove('easter-vhs');
        const interval = AppState.easterEggs.animationHandles.get('vhs-text');
        if (interval) clearInterval(interval);
        AppState.easterEggs.animationHandles.delete('vhs-text');
        
        const overlay = Utils.$('vhs-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 1s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                this.hideOverlay('vhs-overlay');
                overlay.innerHTML = '';
                overlay.style.opacity = '1';
            }, 1000);
        }
    }

    static startGlassCrack(playSound = false) {
        this.showOverlay('glass-overlay');
        const overlay = Utils.$('glass-overlay');
        if (!overlay) return;
        overlay.innerHTML = `
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); 
                        width: 200vmax; height: 200vmax; 
                        background: radial-gradient(circle, transparent 20%, rgba(255,255,255,0.75) 22%, transparent 25%),
                                    radial-gradient(circle, transparent 40%, rgba(255,255,255,0.5) 42%, transparent 45%);
                        clip-path: polygon(50% 50%, 0% 0%, 20% 0%, 50% 50%, 40% 0%, 60% 0%, 50% 50%, 80% 0%, 100% 0%, 50% 50%, 100% 20%, 100% 40%, 50% 50%, 100% 60%, 100% 80%, 50% 50%, 100% 100%, 80% 100%, 50% 50%, 60% 100%, 40% 100%, 50% 50%, 20% 100%, 0% 100%, 50% 50%, 0% 80%, 0% 60%, 50% 50%, 0% 40%, 0% 20%, 50% 50%);
                        z-index: 10000; pointer-events: none; opacity: 1; animation: glassFadeOut 2.5s forwards;">
            </div>
            <div style="position:fixed; inset:0; background:white; opacity:1; animation: flashWhite 0.5s ease-out forwards; pointer-events:none; z-index:10001;"></div>
            <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); padding:20px; font-size:120px; font-weight:900; color:white; filter:drop-shadow(0 0 30px white); animation: txtShake 0.4s; pointer-events:none; z-index:10002;">CRACK!</div>
        `;
        if (!document.getElementById('glass-css-fix')) {
            const style = document.createElement('style');
            style.id = 'glass-css-fix';
            style.innerHTML = `
                @keyframes flashWhite { 0% {opacity: 1;} 100% {opacity: 0;} }
                @keyframes glassFadeOut { 0% {opacity:0.9; transform: translate(-50%,-50%) scale(1);} 10% {transform: translate(-50%,-50%) scale(1.05);} 100% {opacity:0; transform: translate(-50%,-50%) scale(1.1);} }
                @keyframes txtShake { 0%{transform:translate(-50%,-50%) rotate(-5deg);} 25%{transform:translate(-52%,-48%) rotate(5deg);} 50%{transform:translate(-48%,-52%) rotate(-5deg);} 100%{transform:translate(-50%,-50%) rotate(0);} }
            `;
            document.head.appendChild(style);
        }
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
        this.playSound(this.SOUND_URLS.nyan, { volume: 0.5 });
        document.body.classList.add('easter-nyan');
        this.showOverlay('nyan-overlay');
        const overlay = Utils.$('nyan-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div id="nyan-cat-anim" style="position:absolute; width:120px; height:80px; font-size: 60px; line-height:80px; text-align:center; transform:translate3d(-200px, 50vh, 0); will-change: transform;">🐱
                    <div style="content:''; position:absolute; top:20px; right:80px; width:200vw; height:40px; background:linear-gradient(to bottom, red 16%, orange 16% 32%, yellow 32% 48%, green 48% 64%, blue 64% 80%, purple 80%); z-index:-1; opacity:0.8; border-radius:20px 0 0 20px;"></div>
                </div>
            `;
            if (!document.getElementById('nyan-css-fix')) {
                const style = document.createElement('style');
                style.id = 'nyan-css-fix';
                style.innerHTML = `
                    @keyframes nyanSuperFly {
                        0% { transform: translate3d(-20vw, 40vh, 0) scale(1); }
                        25% { transform: translate3d(25vw, 60vh, 0) scale(1.5) rotate(15deg); }
                        50% { transform: translate3d(50vw, 30vh, 0) scale(1.2) rotate(-10deg); }
                        75% { transform: translate3d(75vw, 70vh, 0) scale(1.6) rotate(20deg); }
                        100% { transform: translate3d(120vw, 50vh, 0) scale(1) rotate(0deg); }
                    }
                    #nyan-cat-anim { animation: nyanSuperFly 5s linear infinite; filter: drop-shadow(0 0 20px rgba(255,100,255,0.8)); }
                `;
                document.head.appendChild(style);
            }
        }
    }

    static stopNyan() {
        document.body.classList.remove('easter-nyan');
        const overlay = Utils.$('nyan-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 1s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                this.hideOverlay('nyan-overlay');
                overlay.innerHTML = '';
                overlay.style.opacity = '1';
            }, 1000);
        }
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

class BadgeManager {
    static async checkLevelBadges(uid, xpVal) {
        if (!uid) return;
        const math = ProfileManager.getExpMath(xpVal);
        const lvl = math.level;
        
        const lvlBadges = [];
        if (lvl >= 10) lvlBadges.push('lvl_10');
        if (lvl >= 25) lvlBadges.push('lvl_25');
        if (lvl >= 50) lvlBadges.push('lvl_50');
        if (lvl >= 100) lvlBadges.push('lvl_100');
        
        if (lvlBadges.length > 0) {
            const profSnap = await get(ref(db, `users/${uid}/profile/assignedBadges`));
            let assigned = profSnap.val() || [];
            if (!Array.isArray(assigned)) assigned = [];
            
            let changed = false;
            lvlBadges.forEach(bId => {
                if (!assigned.includes(bId)) {
                    assigned.push(bId);
                    changed = true;
                    if (uid === AppState.currentUser?.uid) {
                        setTimeout(() => Utils.toast('🏆 Вы получили новый бейдж за уровень!', 'success'), 1000);
                    }
                }
            });
            
            if (changed) {
                await update(ref(db, `users/${uid}/profile`), { assignedBadges: assigned });
            }
        }
    }

    static async checkRelationshipBadges(uid) {
        if (!uid) return;
        const pSinceSnap = await get(ref(db, `users/${uid}/partnerSince`));
        if (!pSinceSnap.exists()) return;
        const sinceTs = parseInt(pSinceSnap.val());
        if (!sinceTs) return;
        
        const now = Date.now();
        const diffMs = now - sinceTs;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        const relBadges = [];
        if (diffDays >= 7) relBadges.push('rel_1week');
        if (diffDays >= 30) relBadges.push('rel_1month');
        if (diffDays >= 180) relBadges.push('rel_6months');
        if (diffDays >= 365) relBadges.push('rel_1year');
        
        if (relBadges.length > 0) {
            const profSnap = await get(ref(db, `users/${uid}/profile/assignedBadges`));
            let assigned = profSnap.val() || [];
            if (!Array.isArray(assigned)) assigned = [];
            
            let changed = false;
            relBadges.forEach(bId => {
                if (!assigned.includes(bId)) {
                    assigned.push(bId);
                    changed = true;
                }
            });
            
            if (changed) {
                await update(ref(db, `users/${uid}/profile`), { assignedBadges: assigned });
            }
        }
    }

    static async grantEventBadgeToOnline() {
        if (!AdminPanel.requireAdmin()) return;
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель', 'error');
        const badgeId = Utils.$('admin-event-badge-id')?.value.trim();
        if (!badgeId) return Utils.toast('Введите ID бейджа', 'error');

        if (!confirm(`Точно выдать бейдж "${badgeId}" всем, кто сейчас онлайн?`)) return;

        const usersSnap = await get(ref(db, 'users'));
        const usersData = usersSnap.val() || {};
        
        let count = 0;
        const updates = {};
        
        let bXp = AppState.customBadges && AppState.customBadges[badgeId] ? Number(AppState.customBadges[badgeId].xp) || 0 : 0;
        
        for (const [uid, uData] of Object.entries(usersData)) {
            if (uData.status && uData.status.online) {
                let assigned = (uData.profile && uData.profile.assignedBadges) || [];
                if (!Array.isArray(assigned)) assigned = [];
                if (!assigned.includes(badgeId)) {
                    assigned.push(badgeId);
                    updates[`users/${uid}/profile/assignedBadges`] = assigned;
                    if (bXp > 0) {
                        let curXp = Number(uData.profile?.xp) || 0;
                        let newXp = curXp + bXp;
                        let newLevel = ProfileManager.getExpMath(newXp).level;
                        updates[`users/${uid}/profile/xp`] = newXp;
                        updates[`users/${uid}/profile/level`] = newLevel;
                    }
                    count++;
                }
            }
        }
        
        if (count > 0) {
            await update(ref(db), updates);
            Utils.toast(`Бейдж выдан ${count} пользователям!`);
        } else {
            Utils.toast('Нет новых пользователей для выдачи.', 'info');
        }
    }

    static init() {
        onValue(ref(db, 'badges'), snap => {
            AppState.customBadges = snap.val() || {};
            this.renderBadgeList();
        });
        
        const presetEmojis = [
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face%20With%20Horns.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Sleeping%20Face.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Partying%20Face.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Clown%20Face.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face%20With%20Sunglasses.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp',
            'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Without%20Mouth.webp'
        ];
        
        setTimeout(() => {
            const presetContainer = Utils.$('admin-badge-preset-icons');
            if (presetContainer) {
                presetContainer.innerHTML = presetEmojis.map(url => 
                    `<img src="${url}" style="width:32px; height:32px; cursor:pointer; border-radius:4px;" onclick="document.getElementById('admin-badge-edit-icon').value='${url}'" />`
                ).join('');
            }
        }, 1000);
    }

    static async saveBadge() {
        if (!AdminPanel.requireAdmin()) return;
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель', 'error');
        const id = Utils.$('admin-badge-edit-id')?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const name = Utils.$('admin-badge-edit-name')?.value.trim();
        if (!id || !name) return Utils.toast('ID и название обязательны', 'error');
        
        const payload = {
            name,
            desc: Utils.$('admin-badge-edit-desc')?.value.trim() || '',
            icon: Utils.$('admin-badge-edit-icon')?.value.trim() || '',
            xp: parseInt(Utils.$('admin-badge-edit-xp')?.value, 10) || 0,
            color: Utils.$('admin-badge-edit-color')?.value || '#ffffff',
            bg: Utils.$('admin-badge-edit-bg')?.value || '#5d3fd3',
            border: Utils.$('admin-badge-edit-border')?.value || '#8d63ff'
        };
        await set(ref(db, `badges/${id}`), payload);
        Utils.toast('Бейдж сохранен');
        this.renderBadgeList();
    }

    static async generateSystemBadges() {
        if (!AdminPanel.requireAdmin()) return;
        const badges = {
            rel_1week: { name: "1 Неделя", desc: "Вместе уже неделю!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Growing%20Heart.webp", color: "#ffffff", bg: "#d81b60", border: "#ff4081" },
            rel_1month: { name: "1 Месяц", desc: "Первый совместный месяц!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Sparkling%20Heart.webp", color: "#ffffff", bg: "#c2185b", border: "#f50057" },
            rel_6months: { name: "Полгода", desc: "Связь крепчает. 6 месяцев!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Two%20Hearts.webp", color: "#ffffff", bg: "#ad1457", border: "#c51162" },
            rel_1year: { name: "1 Год", desc: "Юбилей любви! 1 год", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Revolving%20Hearts.webp", color: "#ffffff", bg: "#880e4f", border: "#f50057" },
            lvl_10: { name: "Ветеран", desc: "Достиг 10 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp", color: "#cddc39", xp: 0, bg: "rgba(205, 220, 57, 0.2)", border: "#cddc39" },
            lvl_25: { name: "Мастер", desc: "Достиг 25 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp", color: "#ff9800", xp: 0, bg: "rgba(255, 152, 0, 0.2)", border: "#ff9800" },
            lvl_50: { name: "Легенда", desc: "Достиг 50 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gem%20Stone.webp", color: "#2196f3", xp: 0, bg: "rgba(33, 150, 243, 0.2)", border: "#2196f3" },
            lvl_100: { name: "Божество", desc: "Достиг 100 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp", color: "#ffeb3b", xp: 0, bg: "rgba(255, 235, 59, 0.2)", border: "#ffeb3b" }
        };
        for (const [id, payload] of Object.entries(badges)) {
            await set(ref(db, `badges/${id}`), payload);
        }
        Utils.toast('Системные бейджи добавлены!');
        this.renderBadgeList();
    }

    static async deleteBadge(id) {
        if (!AdminPanel.requireAdmin()) return;
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель', 'error');
        if (!confirm('Точно удалить бейдж?')) return;
        await set(ref(db, `badges/${id}`), null);
        Utils.toast('Бейдж удален');
        this.renderBadgeList();
    }

    static renderBadgeList() {
        const container = Utils.$('admin-badges-list');
        if (!container) return;
        container.innerHTML = '';
        const badges = AppState.customBadges || {};
        const entries = Object.entries(badges);
        if (entries.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">Нет бейджей</div>`;
            return;
        }

        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        container.style.gap = '15px';

        entries.forEach(([id, bdg]) => {
            const div = document.createElement('div');
            div.style.position = 'relative';

            const iconHtml = bdg.icon ? (bdg.icon.match(/^http/) ? `<img src="${Utils.escapeHtml(bdg.icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>` : `<span style="font-size:48px;">${Utils.escapeHtml(bdg.icon)}</span>`) : '';
            
            const cardHtml = `
            <div class="ach-card admin-ach-item" data-id="${Utils.escapeHtml(id)}" style="
                width: 100%; 
                height: 180px;
                border-radius: 12px;
                background: ${bdg.bg || 'rgba(0,0,0,0.2)'};
                border: 1px solid ${bdg.border || 'rgba(255,255,255,0.1)'};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                position: relative;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.2s ease;
            ">
                <div style="position:absolute; top:5px; left:5px; background:rgba(0,0,0,0.6); padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; font-family:monospace; color:var(--text-muted); pointer-events:none; z-index:2;">${Utils.escapeHtml(id)}</div>
                <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px; z-index:1;">
                    ${iconHtml}
                </div>
                <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%; z-index:1;">
                    <div style="color: ${bdg.color || '#ffffff'}; font-weight: 800; font-size: 13px; line-height: 1.2;">${Utils.escapeHtml(bdg.name)}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${Utils.escapeHtml(bdg.desc)}</div>
                </div>
            </div>`;
            
            div.innerHTML = `
                ${cardHtml}
                <button class="danger-btn btn-small" data-id="${Utils.escapeHtml(id)}" style="margin-top:8px; width:100%;">Удалить</button>
            `;
            
            div.querySelector('.ach-card').onclick = () => {
                Utils.$('admin-badge-edit-id').value = id;
                Utils.$('admin-badge-edit-name').value = bdg.name;
                Utils.$('admin-badge-edit-desc').value = bdg.desc || '';
                Utils.$('admin-badge-edit-icon').value = bdg.icon || '';
                if(Utils.$('admin-badge-edit-xp')) Utils.$('admin-badge-edit-xp').value = bdg.xp || 0;
                Utils.$('admin-badge-edit-color').value = bdg.color;
                Utils.$('admin-badge-edit-bg').value = bdg.bg;
                Utils.$('admin-badge-edit-border').value = bdg.border;
                if (window.updateAdminBadgePreview) window.updateAdminBadgePreview();
            };
            
            div.querySelector('button').onclick = () => this.deleteBadge(id);
            container.appendChild(div);
        });
    }

    static renderUserEditorBadges(targetUid, userAssignedArray) {
        const container = Utils.$('admin-edit-badges-container');
        if (!container) return;
        container.innerHTML = '';
        const allBadges = AppState.customBadges || {};
        const entries = Object.entries(allBadges);
        if (entries.length === 0) {
            container.innerHTML = `<div style="font-size:11px; color:var(--text-muted);">Нет созданных бейджей</div>`;
            return;
        }

        const currentSet = new Set(userAssignedArray || []);

        entries.forEach(([id, b]) => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '4px';
            label.style.fontSize = '12px';
            label.style.cursor = 'pointer';
            label.style.padding = '4px 8px';
            label.style.borderRadius = '6px';
            label.style.background = currentSet.has(id) ? 'rgba(255,255,255,0.1)' : 'transparent';
            label.style.border = '1px solid rgba(255,255,255,0.1)';

            label.innerHTML = `
                <input type="checkbox" value="${Utils.escapeHtml(id)}" ${currentSet.has(id) ? 'checked' : ''}>
                ${Utils.escapeHtml(b.name)}
            `;

            const cb = label.querySelector('input');
            cb.onchange = async () => {
                const checked = cb.checked;
                if (!AdminPanel.isCurrentUserCreator()) {
                    cb.checked = !checked;
                    return Utils.toast('Выдавать бейджи может только Создатель', 'error');
                }
                label.style.background = checked ? 'rgba(255,255,255,0.1)' : 'transparent';
                
                if (checked) currentSet.add(id);
                else currentSet.delete(id);

                const newArr = Array.from(currentSet);
                const updates = { assignedBadges: newArr };
                let bXp = AppState.customBadges && AppState.customBadges[id] ? Number(AppState.customBadges[id].xp) || 0 : 0;
                
                if (checked && bXp > 0) {
                    const pSnap = await get(ref(db, `users/${targetUid}/profile`));
                    const p = pSnap.val() || {};
                    let curXp = Number(p.xp) || 0;
                    let newXp = curXp + bXp;
                    let newLevel = ProfileManager.getExpMath(newXp).level;
                    updates.xp = newXp;
                    updates.level = newLevel;
                }
                
                await update(ref(db, `users/${targetUid}/profile`), updates);
                AdminPanel.pushAuditLog('admin.badge.custom_assigned', { targetUid, badgeId: id, granted: checked });
                Utils.toast(checked ? 'Бейдж выдан' : 'Бейдж снят');
                if (checked && bXp > 0) AdminPanel.loadUserEditor(targetUid);
            };
            container.appendChild(label);
        });
    }
}

class AuthManager {
    static init() {
        Utils.injectFixes();

        onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    AppState.currentUser = user;
                    const savedAccounts = JSON.parse(localStorage.getItem('cowio_saved_accounts') || '[]');
                    const existingAcc = savedAccounts.find(a => a.uid === user.uid);
                    if (!existingAcc) {
                        savedAccounts.push({ uid: user.uid, email: user.email });
                        localStorage.setItem('cowio_saved_accounts', JSON.stringify(savedAccounts));
                    }

                    await AdminPanel.getDeveloperUid();
                    
                    // MPA initial routing checks
                    let pathname = window.location.pathname;
                    const intended = sessionStorage.getItem('cowio_intended_route');
                    if (intended && intended !== '/login' && intended !== '/') {
                        pathname = intended;
                        sessionStorage.removeItem('cowio_intended_route');
                    }

                    if (pathname.startsWith('/room/')) {
                        const roomId = pathname.split('/')[2];
                        if (roomId && roomId !== 'current') {
                            window.history.replaceState({screenId: 'room-screen'}, "", `/room/${roomId}`);
                            RoomManager.joinRoom(roomId);
                        } else {
                            window.history.replaceState({screenId: 'lobby-screen'}, "", "/lobby");
                            Utils.showScreen('lobby-screen', false);
                        }
                    } else {
                        window.history.replaceState({screenId: 'lobby-screen'}, "", "/lobby");
                        Utils.showScreen('lobby-screen', false);
                    }
                    
                    if (!AppState.isRegistering) {
                        await ProfileManager.ensureProfileExists(user);
                    }
                    const profSnap = await get(ref(db, `users/${user.uid}/profile`));
                    if (profSnap.exists()) {
                        await BadgeManager.checkLevelBadges(user.uid, Number(profSnap.val().xp) || 0);
                    }
                    await ProfileManager.migrateLegacyDefaultBackground(user.uid);
                    await BadgeManager.checkRelationshipBadges(user.uid);
                    ProfileManager.bindMyProfileListener();
                    FriendsManager.initListeners();
                    RoomManager.initLobbyListeners();
                    DirectMessages.startNotifications();
                    AdminPanel.init();
                    if(window.SupportSystem) window.SupportSystem.initGlobalListener();
                    if(window.ShopController) window.ShopController.loadShop();
                    if(window.AdminSoundManager) window.AdminSoundManager.initAdmin();
                    this.bindGlobalPresence();
                } else {
                    this.handleLogoutCleanup();
                }
            } finally {
                this.finishAuthBootstrap();
            }
        });

        ThemeManager.init();
        this.bindUI();
    }

    static finishAuthBootstrap() {
        document.body.classList.remove('auth-loading');
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
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                
                // save password for 1-click login
                const savedAccounts = JSON.parse(localStorage.getItem('cowio_saved_accounts') || '[]');
                const existingAcc = savedAccounts.find(a => a.email === email);
                if (existingAcc) existingAcc.pass = pass;
                else savedAccounts.push({ uid: cred.user.uid, email: email, pass: pass });
                localStorage.setItem('cowio_saved_accounts', JSON.stringify(savedAccounts));
                
            } catch (e) {
                Utils.toast('Ошибка входа. Проверьте данные.', 'error');
                Utils.$('btn-do-login').disabled = false;
            }
        };

        Utils.$('btn-do-reg').onclick = async () => {
            if (AppState.admin.settings.globalRegistrationsBlocked) return Utils.toast('Регистрация временно отключена', 'error');
            const email = Utils.$('reg-email').value.trim();
            const pass = Utils.$('reg-pass').value.trim();
            const name = Utils.$('reg-name').value.trim();
            let username = Utils.$('reg-username').value.toLowerCase().trim().replace('@', '');
            const agreementAccepted = Utils.$('reg-agreement')?.checked;
            const gender = document.querySelector('input[name="reg-gender"]:checked')?.value || 'male';

            if (!email || pass.length < 6 || !name || !username) return Utils.toast('Заполните поля. Пароль от 6 символов.', 'error');
            if (!agreementAccepted) return Utils.toast('Примите пользовательское соглашение', 'error');
            if (!/^[a-z0-9_]{3,15}$/.test(username)) return Utils.toast('ID: 3-15 символов, только a-z, 0-9 и _', 'error');
            if (username === 'developer') return Utils.toast('ID developer зарезервирован!', 'error');

            try {
                Utils.$('btn-do-reg').disabled = true;
                
                const isAvail = await ProfileManager.checkUsernameAvailability(username);
                if (!isAvail) throw new Error('Этот @ID уже занят другим пользователем!');

                AppState.isRegistering = true;
                const creds = await createUserWithEmailAndPassword(auth, email, pass);
                
                // save password for 1-click login
                const savedAccounts = JSON.parse(localStorage.getItem('cowio_saved_accounts') || '[]');
                savedAccounts.push({ uid: creds.user.uid, email: email, pass: pass });
                localStorage.setItem('cowio_saved_accounts', JSON.stringify(savedAccounts));
                
                await updateProfile(creds.user, { displayName: name });
                await ProfileManager.createProfile(creds.user.uid, name, username, email, {
                    provider: 'email',
                    emailVerified: false
                }, gender);
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
        if (window.location.pathname !== '/login') {
            sessionStorage.setItem('cowio_intended_route', window.location.pathname);
        }
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

class ThemeManager {
    static FAVORITES_KEY = 'cowio:favoriteThemes';

    static FOLDERS = {
        'favorites': { label: '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Любимые', themes: [] },
        'classic': { label: 'Классика', themes: ['default', 'light', 'inverted'] },
        'nature': { label: 'Природа', themes: ['sunset', 'ocean', 'aurora', 'love'] },
        'gradient': { label: 'Градиенты', themes: ['matte-toxic', 'audi-silver', 'racing-jet', 'alpine-pink', 'solar-flare', 'neon-tide', 'dusk', 'venom', 'twilight', 'noir-rose', 'vault-gold', 'abyss-frost', 'crimson-chalk'] }
    };

    static THEME_LABELS = {
        'matte-toxic': 'matte toxic',
        'audi-silver': 'audi silver',
        'racing-jet': 'racing jet',
        'alpine-pink': 'alpine pink',
        'solar-flare': 'solar flare',
        'neon-tide': 'neon tide',
        'noir-rose': 'noir rose',
        'vault-gold': 'vault gold',
        'abyss-frost': 'abyss frost',
        'crimson-chalk': 'crimson chalk'
    };
    
    static EXTENDED_THEMES = {
        'default': { bg: ['#0d0d10', '#040404'], accent: '#ffffff', symbol: '·' },
        'light': { bg: ['#ffffff', '#e8ebf1'], accent: '#000000', symbol: '☼' },
        'inverted': { bg: ['#f8f8f8', '#d9dce2'], accent: '#050505', symbol: '◐' },
        'sunset': { bg: ['#ff9a76', '#7b2233', '#240b15'], accent: '#ff9a76', symbol: '☼' },
        'ocean': { bg: ['#6de0ff', '#13667a', '#082835'], accent: '#6de0ff', symbol: '≈' },
        'aurora': { bg: ['#4776ff', '#1a2f68', '#0a1023'], accent: '#4776ff', symbol: '✦' },
        'love': { bg: ['#66304f', '#301226', '#10050d'], accent: '#ff99cc', symbol: '❤' },
        'matte-toxic': { bg: ['#141414', '#0a1208'], accent: '#7fff00', symbol: '☣' },
        'audi-silver': { bg: ['#eceff3', '#9aa3ad', '#2b3138'], accent: '#d1d6dc', symbol: '◆' },
        'racing-jet': { bg: ['#08080a', '#151c28', '#4a0a0a'], accent: '#e10600', symbol: '🏁' },
        'alpine-pink': { bg: ['#a8d4f0', '#5b8fc9', '#3f5f48'], accent: '#f4b8c8', symbol: '⛰' },
        'solar-flare': { bg: ['#ff6a00', '#ffb300', '#fff4d6'], accent: '#ff8c00', symbol: '☀' },
        'neon-tide': { bg: ['#031a2b', '#0a4d6e', '#00e8ff'], accent: '#00e8ff', symbol: '🌊' },
        'dusk': { bg: ['#2a1842', '#5a3f6e', '#e8785a'], accent: '#ffb07c', symbol: '🌆' },
        'venom': { bg: ['#040804', '#0f1a10'], accent: '#39ff14', symbol: '🕷' },
        'twilight': { bg: ['#1a103c', '#4a3f7a', '#98f5d4'], accent: '#c4b5fd', symbol: '☾' },
        'noir-rose': { bg: ['#0a0a0a', '#1c1c1c', '#3a1a28'], accent: '#e8748a', symbol: '🌹' },
        'vault-gold': { bg: ['#1b3a5c', '#0f2236', '#0a1520'], accent: '#ffd54f', symbol: '⛃' },
        'abyss-frost': { bg: ['#010814', '#0a2a4a', '#7dd3fc'], accent: '#bae6fd', symbol: '❄' },
        'crimson-chalk': { bg: ['#8b0000', '#3d1212', '#f5f0e8'], accent: '#fff5f0', symbol: '♦' }
    };

    static getFavorites() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.FAVORITES_KEY) || '[]');
            return Array.isArray(raw) ? raw.filter(k => this.EXTENDED_THEMES[k]) : [];
        } catch {
            return [];
        }
    }

    static isFavorite(themeKey) {
        return this.getFavorites().includes(themeKey);
    }

    static toggleFavorite(themeKey) {
        if (!this.EXTENDED_THEMES[themeKey]) return;
        let favs = this.getFavorites();
        favs = favs.includes(themeKey) ? favs.filter(k => k !== themeKey) : [...favs, themeKey];
        localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favs));
        this.refreshFavoritesFolder();
        if (RoomManager.currentThemeFolder === 'favorites') this.renderCarouselTrack('favorites');
        this.syncFavButtons();
        Utils.toast(favs.includes(themeKey) ? 'Тема в любимых' : 'Убрано из любимых');
    }

    static refreshFavoritesFolder() {
        this.FOLDERS.favorites.themes = this.getFavorites();
    }

    static getThemeLabel(themeKey) {
        return this.THEME_LABELS[themeKey] || themeKey;
    }

    static init() {
        this.refreshFavoritesFolder();
        this.injectCSS();
        this.renderFolders();
        this.renderCarousel();
        this.renderDMChips();
    }

    static buildThemeGradient(colors = [], preview = false) {
        const bg = colors.length ? colors : ['#0d0d10', '#040404'];
        if (bg.length === 1) return bg[0];
        if (preview) return `linear-gradient(165deg, ${bg[0]} 0%, ${bg[bg.length - 1]} 100%)`;
        const stops = bg.map((c, i) => `${c} ${Math.round((i / (bg.length - 1)) * 100)}%`).join(', ');
        return `radial-gradient(ellipse 130% 95% at 18% 8%, ${stops})`;
    }

    static injectCSS() {
        let css = '';
        for (const [key, t] of Object.entries(this.EXTENDED_THEMES)) {
            if (['default', 'light', 'inverted', 'sunset', 'ocean', 'aurora', 'love'].includes(key)) continue;
            const gradPreview = this.buildThemeGradient(t.bg, true);
            const gradRoom = this.buildThemeGradient(t.bg, false);
            
            css += `
                #room-screen.theme-${key} { background: ${gradRoom}; color: #ffffff; }
                #room-screen.theme-${key} .glass-panel,
                #room-screen.theme-${key} .chat-section,
                #room-screen.theme-${key} .chat-input-area { background: rgba(10, 10, 15, 0.85); border-color: ${t.accent}40; box-shadow: 0 16px 40px ${t.accent}20; }
                #room-screen.theme-${key} .input-wrapper { background: rgba(5, 5, 10, 0.9); border-color: ${t.accent}60; }
                #room-screen.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05); border-color: ${t.accent}40; color: #fff; }
                #room-screen.theme-${key} .self .bubble { background: ${t.accent}20; border-color: ${t.accent}60; color: #fff; }
                #room-screen.theme-${key} .send-btn,
                #room-screen.theme-${key} #btn-share-room,
                #room-screen.theme-${key} #btn-room-settings,
                #room-screen.theme-${key} #btn-leave-room { background: ${t.accent}30; color: #fff; border-color: ${t.accent}60; }
                
                #modal-dm-chat.theme-${key} .modal-content { background: ${gradRoom} !important; border-color: ${t.accent}40 !important; box-shadow: 0 16px 40px ${t.accent}20 !important; color: #ffffff !important; }
                #modal-dm-chat.theme-${key} .dm-messages,
                #modal-dm-chat.theme-${key} .dm-compose { background: rgba(10,10,15,0.7) !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05) !important; border-color: ${t.accent}40 !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} .self .bubble { background: ${t.accent}20 !important; border-color: ${t.accent}60 !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} input { color: #fff !important; }
                
                .theme-rect.${key}::before { content: ''; position: absolute; inset: 0; background: ${gradPreview}; }
                .theme-rect.${key}::after { content: '${t.symbol}'; position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); color: ${t.accent}; letter-spacing: 4px; font-size: 14px; opacity: 0.8; }
            `;
        }
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    static renderFolders() {
        const foldersContainer = Utils.$('room-theme-folders');
        if (!foldersContainer) return;
        foldersContainer.innerHTML = '';
        const fKeys = Object.keys(this.FOLDERS);
        fKeys.forEach((fKey, index) => {
            const btn = document.createElement('button');
            btn.className = `secondary-btn theme-folder-btn ${index === 0 ? 'active' : ''}`;
            btn.dataset.folder = fKey;
            btn.innerHTML = this.FOLDERS[fKey].label;
            btn.style.padding = '6px 12px';
            btn.style.fontSize = '12px';
            btn.onclick = () => {
                foldersContainer.querySelectorAll('.theme-folder-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                RoomManager.currentThemeFolder = fKey;
                this.renderCarouselTrack(fKey);
            };
            foldersContainer.appendChild(btn);
        });
        RoomManager.currentThemeFolder = fKeys.includes('favorites') ? 'favorites' : fKeys[0];
    }
    
    static renderCarousel() {
        if (!RoomManager.currentThemeFolder) RoomManager.currentThemeFolder = Object.keys(this.FOLDERS)[0];
        this.renderCarouselTrack(RoomManager.currentThemeFolder);
    }

    static renderCarouselTrack(fKey) {
        const track = Utils.$('room-theme-track');
        if (!track) return;
        track.innerHTML = '';
        const themesList = this.FOLDERS[fKey]?.themes || [];

        if (fKey === 'favorites' && !themesList.length) {
            track.innerHTML = `
                <div class="theme-card theme-card-empty">
                    <div class="theme-empty-msg">Нажмите ★ на любой теме,<br>чтобы добавить в любимые</div>
                </div>
            `;
            RoomManager.themeIndex = 0;
            RoomManager.updateThemeTransform();
            return;
        }

        themesList.forEach(themeKey => {
            const t = this.EXTENDED_THEMES[themeKey];
            if (!t) return;
            const isFav = this.isFavorite(themeKey);
            const div = document.createElement('div');
            div.className = `theme-card ${RoomManager.selectedTheme === themeKey ? 'active' : ''}`;
            div.dataset.theme = themeKey;
            div.innerHTML = `
                <button type="button" class="theme-fav-btn ${isFav ? 'active' : ''}" data-theme="${themeKey}" title="${isFav ? 'Убрать из любимых' : 'В любимые'}">★</button>
                <div class="theme-rect ${themeKey}"></div>
                <div class="theme-name">${this.getThemeLabel(themeKey)}</div>
                <div class="theme-check">✓</div>
            `;
            track.appendChild(div);
        });
        this.bindCarouselFavButtons();
        const idx = themesList.indexOf(RoomManager.selectedTheme);
        if (idx >= 0) RoomManager.themeIndex = idx;
        else RoomManager.themeIndex = Math.min(RoomManager.themeIndex, Math.max(0, themesList.length - 1));
        RoomManager.updateThemeTransform();
    }

    static bindCarouselFavButtons() {
        const track = Utils.$('room-theme-track');
        if (!track) return;
        track.querySelectorAll('.theme-fav-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.toggleFavorite(btn.dataset.theme);
            };
        });
    }

    static syncFavButtons() {
        const track = Utils.$('room-theme-track');
        if (!track) return;
        track.querySelectorAll('.theme-fav-btn').forEach(btn => {
            const active = this.isFavorite(btn.dataset.theme);
            btn.classList.toggle('active', active);
            btn.title = active ? 'Убрать из любимых' : 'В любимые';
        });
    }

    static findFolderForTheme(themeKey) {
        if (this.getFavorites().includes(themeKey)) return 'favorites';
        for (const [fKey, folder] of Object.entries(this.FOLDERS)) {
            if (fKey === 'favorites') continue;
            if (folder.themes.includes(themeKey)) return fKey;
        }
        return 'classic';
    }
    
    static renderDMChips() {
        const dmControls = Utils.$('dm-theme-controls');
        if (!dmControls) return;
        dmControls.innerHTML = '';
        Object.keys(this.EXTENDED_THEMES).forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'dm-theme-chip';
            btn.dataset.theme = key;
            btn.innerText = key;
            dmControls.appendChild(btn);
        });
    }
}

class ProfileManager {
    static backgroundPresets = ['#111111', '#f8fafc', '#ff6fae', '#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#f59e0b', '#ef4444', '#1f2937', '#8b5cf6', '#14b8a6']; // [NEW]

    static getRoleBadgeHtml(profile, uid = null) {
        if (!profile) return '';
        const badges = []; // [UPDATE]
        if (AdminPanel.isCreatorProfile(profile, uid)) badges.push(`<span class="role-badge badge-creator">Создатель</span>`); // [UPDATE]
        if (AdminPanel.isModeratorProfile(profile, uid)) badges.push(`<span class="role-badge badge-moderator">Модератор</span>`); // [UPDATE]
        const adminBadge = String(profile?.adminBadge || '').toLowerCase().trim();
        if (adminBadge === 'developer') badges.push(`<span class="role-badge badge-developer" style="background:#000; color:#0ff; border:1px solid #0ff; text-shadow:0 0 5px #0ff; box-shadow:0 0 8px rgba(0,255,255,0.4);">Разработчик</span>`);
        if (adminBadge === 'creator') badges.push(`<span class="role-badge badge-creator">Создатель</span>`);
        if (adminBadge === 'moderator') badges.push(`<span class="role-badge badge-moderator">Модератор</span>`);
        if (adminBadge === 'creator_moderator') badges.push(`<span class="role-badge badge-hybrid">Создатель/Модератор</span>`);
        if (profile?.adminBadgeCustom?.text) {
            const custom = profile.adminBadgeCustom;
            const text = Utils.escapeHtml(custom.text);
            const color = Utils.escapeHtml(custom.color || '#ffffff');
            const bg = Utils.escapeHtml(custom.bg || 'rgba(120,120,120,0.2)');
            const border = Utils.escapeHtml(custom.border || 'rgba(255,255,255,0.35)');
            badges.push(`<span class="role-badge" style="color:${color}; background:${bg}; border:1px solid ${border}; box-shadow:none;">${text}</span>`);
        }
        
        if (profile?.partner) badges.push(`<span class="partner-badge">Пара</span>`); // [UPDATE]
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

    static async createProfile(uid, name, username, email, security = {}, gender = 'male') {
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
            gender,
            background: { color: '#111111', index: 1, url: '', dim: 0.5 }, // [UPDATE]
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

    static async updateDailyStreak(uid, profile) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        
        let streak = profile.streak || 0;
        const lastLoginDate = profile.lastLoginDate;
        
        if (lastLoginDate === todayStr) {
            return; // Already logged in today
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
        
        if (lastLoginDate === yesterdayStr) {
            streak = streak >= 1 ? streak + 1 : 2;
        } else {
            streak = 0;
        }
        
        await update(ref(db, `users/${uid}/profile`), {
            streak,
            lastLoginDate: todayStr
        });
    }

    static async ensureProfileExists(user) {
        const snap = await get(ref(db, `users/${user.uid}/profile`));
        if (!snap.exists()) {
            const fallbackUser = `user_${Utils.generateCryptoId(6)}`;
            await this.createProfile(user.uid, user.displayName || 'Guest', fallbackUser, user.email, {
                provider: this.normalizeProvider(user),
                emailVerified: Boolean(user.emailVerified)
            });
            await this.updateDailyStreak(user.uid, {});
        } else {
            await this.updateDailyStreak(user.uid, snap.val());
        }
    }

    static async migrateLegacyDefaultBackground(uid) {
        if (!uid) return;
        const profileRef = ref(db, `users/${uid}/profile`);
        const snap = await get(profileRef);
        if (!snap.exists()) return;
        const profile = snap.val() || {};
        const normalized = this.normalizeProfileBackground(profile.background);
        const rawBackground = profile.background;
        const isEmptyLegacy = rawBackground === undefined || rawBackground === null || String(rawBackground).trim() === '';
        const isOldDefault = normalized.color === '#1f2937';
        if (!isEmptyLegacy && !isOldDefault) return;
        await update(profileRef, {
            background: {
                color: '#111111',
                index: 1,
                url: normalized.url || '',
                dim: typeof normalized.dim === 'number' ? Math.max(0, Math.min(1, normalized.dim)) : 0.5
            }
        });
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
            Utils.$('my-avatar-display').innerHTML = ProfileManager.getAvatarHtml(p);

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
        
        let selectedFrame = p.frame || null;
        
        let availableFrames = [{ id: null, name: 'Нет' }];
        const currentInv = p.inventory || [];
        
        if (window.CatalogManager && CatalogManager.items) {
            CatalogManager.items.filter(i => i.type === 'frame').forEach(frame => {
                if (currentInv.includes(frame.id)) {
                    availableFrames.push({
                        id: frame.image,
                        name: frame.title
                    });
                }
            });
        }
        
        currentInv.forEach((invItem, idx) => {
            if (invItem.startsWith('http://') || invItem.startsWith('https://')) {
                if (!availableFrames.some(f => f.id === invItem)) {
                    availableFrames.push({
                        id: invItem,
                        name: `Спец. рамка #${idx}`
                    });
                }
            }
        });
        
        const renderFramesCarousel = () => {
            const carousel = Utils.$('profile-frames-carousel');
            if (!carousel) return;
            carousel.innerHTML = availableFrames.map(f => `
                <div class="frame-option" style="
                    width: 60px; height: 60px; flex-shrink: 0;
                    border-radius: 8px; border: 2px solid ${selectedFrame === f.id ? 'var(--accent)' : 'transparent'};
                    background: rgba(0,0,0,0.3); overflow: hidden; cursor: pointer;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;
                " onclick="window.selectAvatarFrame('${f.id || ''}')" title="${f.name || ''}">
                    ${f.id ? `<img src="${Utils.escapeHtml(f.id)}" style="width:50px;height:50px;object-fit:cover; pointer-events:none;">` : `<span style="font-size:12px;color:var(--text-muted);">✖</span>`}
                </div>
            `).join('');
            
            const frameImg = Utils.$('edit-avatar-frame');
            if (frameImg) {
                if (selectedFrame) {
                    frameImg.src = selectedFrame;
                    frameImg.style.display = 'block';
                } else {
                    frameImg.style.display = 'none';
                }
            }
        };
        
        window.selectAvatarFrame = (frameId) => {
            selectedFrame = frameId || null;
            Utils.$('modal-edit-profile').dataset.selectedFrame = selectedFrame || '';
            renderFramesCarousel();
        };
        
        renderFramesCarousel();
        Utils.$('modal-edit-profile').dataset.selectedFrame = selectedFrame || '';

        if (p.gender) {
            const rad = document.querySelector(`input[name="edit-gender"][value="${p.gender}"]`);
            if (rad) rad.checked = true;
            const genderSelectDiv = document.querySelector('#modal-edit-profile .user-gender-select');
            if (genderSelectDiv) {
                genderSelectDiv.style.display = 'none';
            }
        } else {
            const genderSelectDiv = document.querySelector('#modal-edit-profile .user-gender-select');
            if (genderSelectDiv) {
                genderSelectDiv.style.display = 'flex';
            }
        }
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
            emailBox.innerText = email || 'Вы авторизованы через Google';
            actionBtn.innerText = 'Изменить почту';
            passwordInput.style.display = 'none';

            // Show set password for google users if they haven't explicitly set one
            // We can't perfectly check if password exists, but we can offer to set/reset it
            Utils.$('security-set-password-section').style.display = 'block';
            Utils.$('btn-security-set-password').onclick = async () => {
                const newPass = Utils.$('security-new-password').value;
                if (newPass.length < 6) return Utils.toast('Пароль минимум 6 символов', 'error');
                
                try {
                    const { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    await updatePassword(auth.currentUser, newPass);
                    
                    // Save to fast-switch cache
                    const savedAccounts = JSON.parse(localStorage.getItem('cowio_saved_accounts') || '[]');
                    const existingAcc = savedAccounts.find(a => a.uid === auth.currentUser.uid);
                    if (existingAcc) { existingAcc.pass = newPass; }
                    else { savedAccounts.push({ uid: auth.currentUser.uid, email: auth.currentUser.email, pass: newPass }); }
                    localStorage.setItem('cowio_saved_accounts', JSON.stringify(savedAccounts));

                    Utils.toast('Пароль успешно установлен!');
                    Utils.$('security-new-password').value = '';
                } catch(e) {
                    if (e.code === 'auth/requires-recent-login') {
                        Utils.toast('Нужна повторная авторизация. Перезайдите в аккаунт.', 'error');
                    } else {
                        Utils.toast(e.message || 'Ошибка установки пароля', 'error');
                    }
                }
            };
        } else {
            emailBox.innerText = email || 'Email не указан';
            actionBtn.innerText = 'Изменить почту';
            passwordInput.style.display = 'block';
            Utils.$('security-set-password-section').style.display = 'none';
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

    static normalizeHexColor(value = '#111111') { // [UPDATE]
        const raw = String(value || '').trim(); // [UPDATE]
        if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase(); // [NEW]
        if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase(); // [NEW]
        return '#111111'; // [UPDATE]
    } // [UPDATE]

    static hexToRgb(hex = '#111111') { // [NEW]
        const safeHex = this.normalizeHexColor(hex).slice(1); // [NEW]
        return { // [NEW]
            r: parseInt(safeHex.slice(0, 2), 16), // [NEW]
            g: parseInt(safeHex.slice(2, 4), 16), // [NEW]
            b: parseInt(safeHex.slice(4, 6), 16) // [NEW]
        }; // [NEW]
    } // [NEW]

    static rgbToHex(r = 17, g = 17, b = 17) { // [NEW]
        return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, '0')).join('')}`; // [NEW]
    } // [NEW]

    static getReadableProfileColors(hex = '#111111') { // [NEW]
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
            const index = isNaN(rawIndex) || rawIndex <= 0 ? 1 : Math.max(1, Math.min(12, rawIndex)); 
            const url = this.normalizeProfileBackgroundUrl(value.url || ''); // [NEW]
            const dim = typeof value.dim !== 'undefined' ? Number(value.dim) : 0.5; // [ADD] Dim logic
            return { color, index, url, dim: Math.max(0, Math.min(1, dim)) }; // [NEW]
        } // [NEW]
        const raw = String(value || '').trim(); // [UPDATE]
        if (!raw) return { color: '#111111', index: 1, url: '', dim: 0.5 }; // [UPDATE]
        if (/data:image/i.test(raw) || /^https?:\/\//i.test(raw)) return { color: '#111111', index: 1, url: this.normalizeProfileBackgroundUrl(raw), dim: 0.5 }; // [NEW] Support base64 or http
        return { color: this.normalizeHexColor(raw), index: 1, url: '', dim: 0.5 }; // [UPDATE]
    } // [UPDATE]

    static normalizeProfileBackgroundUrl(value = '') { // [NEW]
        const raw = String(value || '').trim(); // [NEW]
        if (!raw) return ''; // [NEW]
        if (raw.startsWith('data:image')) {
            if (raw.length > 5000000) return '';
            return raw;
        }
        if (raw.length > 1024 || /["\\]/.test(raw)) return ''; // [NEW]
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
            index: Number(Utils.$('profile-bg-panel')?.dataset.selectedIndex) || 1, // [PATCH]
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

    static renderProfileBackgroundPresets(activeIndex = 1) { // [NEW]
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

    static setProfileBackgroundRgb(r, g, b, index = 1) { // [NEW]
        [['r', r], ['g', g], ['b', b]].forEach(([key, value]) => { // [NEW]
            const safe = Math.max(0, Math.min(255, Number(value) || 0)); // [NEW]
            if (Utils.$(`profile-bg-${key}`)) Utils.$(`profile-bg-${key}`).value = safe; // [NEW]
            if (Utils.$(`profile-bg-${key}-num`)) Utils.$(`profile-bg-${key}-num`).value = safe; // [NEW]
        }); // [NEW]
        if (Utils.$('profile-bg-panel')) Utils.$('profile-bg-panel').dataset.selectedIndex = String(index || 1); // [PATCH]
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
                if (panel) panel.dataset.selectedIndex = '1'; // [PATCH]
                this.renderProfileBackgroundPresets(1); // [PATCH]
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
            color: this.rgbToHex(Utils.$('profile-bg-r')?.value || 17, Utils.$('profile-bg-g')?.value || 17, Utils.$('profile-bg-b')?.value || 17), // [NEW]
            index: Number(Utils.$('profile-bg-panel')?.dataset.selectedIndex) || 1, // [PATCH]
            url: this.normalizeProfileBackgroundUrl(Utils.$('profile-bg-url')?.value || ''), // [NEW]
            dim: Number(Utils.$('profile-bg-dim')?.value || 0.5) // [ADD]
        }; // [NEW]
        const colors = this.getReadableProfileColors(data.color); // [NEW]
        preview.style.background = data.color; // [NEW]
        if (data.url) {
            const overlay = `rgba(0,0,0,${data.dim})`;
            preview.style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${data.url.replace(/"/g, '%22')}")`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        } else {
            preview.style.backgroundImage = '';
        }
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
        panel.style.setProperty('background', data.color, 'important'); // [UPDATE]
        panel.style.setProperty('color', colors.text, 'important'); // [NEW]
        panel.style.setProperty('border-color', colors.border, 'important'); // [NEW]
        panel.style.removeProperty('background-image'); // [UPDATE]
        panel.style.removeProperty('background-size'); // [UPDATE]
        panel.style.removeProperty('background-position'); // [UPDATE]
        if (data.url) { // [UPDATE]
            const dimValue = data.dim !== undefined ? data.dim : 0.5; // [ADD] Apply custom dim
            const overlay = `rgba(0,0,0,${dimValue})`;
            panel.style.setProperty('background-image', `linear-gradient(${overlay}, ${overlay}), url("${data.url.replace(/"/g, '%22')}")`, 'important'); // [UPDATE]
            panel.style.setProperty('background-size', 'cover', 'important'); // [UPDATE]
            panel.style.setProperty('background-position', 'center', 'important'); // [UPDATE]
        } // [UPDATE]
    } // [UPDATE]

    static async getPartnerUid(uid) { // [NEW]
        if (!uid) return null; // [NEW]
        const snap = await get(ref(db, `users/${uid}/partner`)); // [NEW]
        return snap.exists() ? snap.val() : null; // [NEW]
    } // [NEW]

    static getAvatarHtml(profile = {}) { 
        const textFallback = Utils.escapeHtml((profile.name || '?')[0].toUpperCase());
        let innerHTML = '';
        if (profile.avatar) {
            innerHTML = `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.parentElement.innerHTML='?';" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
        } else {
            innerHTML = textFallback;
        }
        
        let frameHTML = '';
        if (profile.frame) {
            const frameVal = Utils.escapeHtml(profile.frame);
            if (frameVal.includes('.') || frameVal.includes('/') || frameVal.startsWith('http')) {
                // it is an image
                frameHTML = `<img src="${frameVal}" style="width:130%; height:130%; object-fit:contain; position:absolute; top:-15%; left:-15%; z-index:2; pointer-events:none;">`;
            } else {
                // it is a CSS class
                frameHTML = `<div class="${frameVal}" style="z-index:2; pointer-events:none;"></div>`;
            }
        }
        
        return `<div class="avatar-inner-wrap" style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; border-radius:inherit;"><div style="position:absolute; inset:0; width:100%; height:100%; overflow:hidden; border-radius:inherit; display:flex; align-items:center; justify-content:center; font-size:inherit; font-weight:inherit; color:inherit; background:transparent;">${innerHTML}</div>${frameHTML}</div>`;
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
        let bondMeta = '';
        if (ownerUid && !String(partnerUid).startsWith('custom_partner_')) {
            const bond = await PartnerBondEngine.getBond(ownerUid, partnerUid);
            const lvl = PartnerBondEngine.bondLevel(bond.totalWarmth);
            bondMeta = ` · ур. ${lvl}${bond.streak ? ` · <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">${bond.streak}` : ''}`;
        }
        container.innerHTML = `
            <div class="partner-avatar">${this.getAvatarHtml(partnerProfile)}</div>
            <div class="partner-info">
                <div class="partner-label">Вторая половинка</div>
                <div class="partner-name">${Utils.escapeHtml(partnerProfile.name || 'Пользователь')}</div>
                <div class="partner-meta">${sinceTs ? `Вместе ${daysText} дн.${bondMeta}` : `Пара подтверждена${bondMeta}`}</div>
            </div>
            ${canRemove ? '<button class="danger-btn btn-remove-current-partner" style="width:auto; padding:8px 10px; z-index:10; position:relative;">Убрать</button>' : ''}
        `; // [NEW]
        container.classList.add('active'); // [NEW]
        
        // [ADD] Click to open sweet modal
        container.style.cursor = 'pointer';
        container.onclick = (e) => {
            if (!e.target.closest('button')) {
                this.openPartnerModal(ownerUid || partnerUid, partnerUid);
            }
        };

        const removeBtn = container.querySelector('.btn-remove-current-partner'); // [NEW]
        if (removeBtn) removeBtn.onclick = (e) => { e.stopPropagation(); this.removePartner(partnerUid); }; // [NEW]
    } // [NEW]

    static async openPartnerModal(ownerUid, partnerUid) {
        const myProf = await this.loadUser(ownerUid);
        const theirProf = await this.loadUser(partnerUid);
        if (!myProf || !theirProf) return;

        const sinceSnap = await get(ref(db, `users/${ownerUid}/partnerSince`));
        const sinceTs = sinceSnap?.exists() ? Number(sinceSnap.val()) : 0;
        await PartnerRelationshipPanel.open(ownerUid, partnerUid, myProf, theirProf, sinceTs);
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
        
        const myProfile = AppState.usersCache.get(myUid) || await this.loadUser(myUid) || {};
        const targetProfile = AppState.usersCache.get(targetUid) || await this.loadUser(targetUid) || {};
        const myGender = myProfile.gender || 'male';
        const targetGender = targetProfile.gender || 'male';
        if (myGender === targetGender) {
            return Utils.toast('Однополые браки запрещены', 'error');
        }

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
        let partnerSince = Date.now(); // [NEW]
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
            partnerSince = Date.now(); // [NEW]
            updates[`users/${myUid}/partner`] = partnerUid; // [NEW]
            updates[`users/${partnerUid}/partner`] = myUid; // [NEW]
            updates[`users/${myUid}/partnerSince`] = partnerSince; // [NEW]
            updates[`users/${partnerUid}/partnerSince`] = partnerSince; // [NEW]
        } // [NEW]
        updates[`users/${myUid}/loveRequests/${partnerUid}`] = null; // [NEW]
        await update(ref(db), updates); // [NEW]
        if (accept) await PartnerBondEngine.onUnion(myUid, partnerUid, partnerSince); // [NEW]
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
        const gender = document.querySelector('input[name="edit-gender"]:checked')?.value || 'male';
        const frame = Utils.$('modal-edit-profile').dataset.selectedFrame || null;

        if (!name || !username) throw new Error('Имя и ID обязательны');
        if (!/^[a-z0-9_]{3,15}$/.test(username)) throw new Error('ID: 3-15 символов, a-z, 0-9, _');
        if (username === 'developer' && oldProfile.username !== 'developer') throw new Error('ID developer зарезервирован!');

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

        updates[`users/${uid}/profile`] = { ...oldProfile, name, username, bio, hashtags, avatar, background, gender, frame }; // [UPDATE]
        await update(ref(db), updates);

        if (uid === AppState.currentUser?.uid) {
            await updateProfile(AppState.currentUser, { displayName: name, photoURL: avatar }).catch(e => console.warn('Failed to update auth profile', e));
        }
    }

    static getExpMath(totalXp) {
        if (typeof totalXp !== 'number' || isNaN(totalXp) || totalXp < 0) {
            return { level: 0, current: totalXp || 0, needed: 240, percent: 0 };
        }
        const level = Math.floor(Math.sqrt(totalXp / 240));
        const xpAtCurrentLevel = 240 * (level * level);
        const xpAtNextLevel = 240 * ((level + 1) * (level + 1));
        
        const current = totalXp - xpAtCurrentLevel;
        const needed = xpAtNextLevel - xpAtCurrentLevel;
        const percent = Math.max(0, Math.min(100, Math.floor((current / needed) * 100)));
        
        return { level, current, needed, percent };
    }

    static async loadUser(uid) {
        // If we want up-to-date avatar/frame, it might be better to skip cache, but let's keep it 
        if (AppState.usersCache.has(uid)) return AppState.usersCache.get(uid);
        try {
            const snap = await get(ref(db, `users/${uid}`));
            if(!snap.exists()) return { name: 'Unknown', username: 'unknown' };
            const node = snap.val();
            const data = node.profile || { name: 'Unknown', username: 'unknown' };
            
            const eqFrame = node.equippedFrame;
            if (eqFrame && AppState.catalog && AppState.catalog.frames && AppState.catalog.frames[eqFrame]) {
                data.frame = AppState.catalog.frames[eqFrame].url || eqFrame;
            }
            AppState.usersCache.set(uid, data);
            return data;
        } catch (e) { return null; }
    }

    static async openProfileModal(uid) {
        return this.openViewProfileModal(uid);
    }

    static getActiveStreak(profile) {
        if (!profile || !profile.lastLoginDate) return 0;
        let streak = Number(profile.streak || 0);
        if (streak <= 0) return 0;
        
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
        
        if (profile.lastLoginDate !== todayStr && profile.lastLoginDate !== yesterdayStr) {
            return 0; // Streak broken!
        }
        return streak;
    }

    static async openViewProfileModal(targetUid) {
        const profile = await this.loadUser(targetUid);
        if (!profile) return Utils.toast('Пользователь не найден', 'error');

        const activeStreak = this.getActiveStreak(profile);
        const streakEl = Utils.$('view-streak');
        if (activeStreak > 0) {
            streakEl.style.display = 'flex';
            Utils.$('view-streak-count').innerText = activeStreak;
        } else {
            streakEl.style.display = 'none';
        }

        // New math logic
        const updateLevelUI = (xpVal) => {
            const math = ProfileManager.getExpMath(xpVal);
            const isNegative = xpVal < 0;
            const lvl = math.level;
            
            // Update Mini Badge
            const viewLevelBadge = Utils.$('view-level-badge');
            const viewLevelBadgeText = Utils.$('view-level-badge-text');
            const viewLevelBadgeIcon = Utils.$('view-level-badge-icon');
            
            if (isNegative) {
                if (viewLevelBadgeText) viewLevelBadgeText.innerText = `Скрыт`;
                if (viewLevelBadgeIcon) viewLevelBadgeIcon.style.filter = 'grayscale(100%) opacity(50%)';
                if (viewLevelBadge) {
                    viewLevelBadge.style.background = 'rgba(255,59,48,0.15)';
                    viewLevelBadge.style.border = '1px solid rgba(255,59,48,0.3)';
                }
            } else {
                if (viewLevelBadgeText) viewLevelBadgeText.innerText = `Уровень ${lvl}`;
                if (viewLevelBadgeIcon) viewLevelBadgeIcon.style.filter = 'drop-shadow(0 2px 4px rgba(255, 170, 0, 0.4))';
                if (viewLevelBadge) {
                    viewLevelBadge.style.background = 'rgba(34,34,34,0.8)';
                    viewLevelBadge.style.border = '1px solid rgba(255,255,255,0.08)';
                }
            }

            // Update Drawer Header and Progress
            const drawerTitle = Utils.$('drawer-level-title');
            if (drawerTitle) drawerTitle.innerText = isNegative ? `Рейтинг скрыт` : `Уровень ${lvl}`;
            
            const drawerStarContainer = Utils.$('drawer-star-container');
            if (drawerStarContainer) {
                if (isNegative) drawerStarContainer.style.filter = 'grayscale(100%) opacity(50%) drop-shadow(0 4px 15px rgba(255,0,0,0.2))';
                else drawerStarContainer.style.filter = 'none';
            }
            
            if (Utils.$('drawer-xp-text')) {
                Utils.$('drawer-xp-text').innerText = isNegative ? `Ненадежный статус (${xpVal} XP)` : `${math.current.toLocaleString()} / ${math.needed.toLocaleString()} 🌟`;
            }
            if (Utils.$('drawer-xp-progress')) {
                Utils.$('drawer-xp-progress').style.width = isNegative ? '0%' : `${math.percent}%`;
            }
            
            const drawerXpBarContainer = Utils.$('drawer-xp-bar-container');
            if (drawerXpBarContainer) {
                drawerXpBarContainer.style.display = isNegative ? 'none' : 'block';
            }
        };

        updateLevelUI(Number(profile.xp) || 0);

        if (this.viewUnsubs) { this.viewUnsubs.forEach(f => f()); this.viewUnsubs = []; }
        else { this.viewUnsubs = []; }

        const profileRef = ref(db, `users/${targetUid}/profile`);
        const pUnsub = onValue(profileRef, (snap) => {
            const val = snap.val();
            if (val) {
                updateLevelUI(Number(val.xp) || 0);
            }
        });
        this.viewUnsubs.push(() => off(profileRef, 'value', pUnsub));

        // Drawer logic
        const bottomSheetOverlay = Utils.$('level-bottom-sheet-overlay');
        const bottomSheet = Utils.$('level-bottom-sheet');
        const badgeBtn = Utils.$('view-level-badge');
        const closeBtn = bottomSheet.querySelector('.btn-close-drawer');
        
        const closeDrawer = () => {
            bottomSheet.style.transform = 'translateY(100%)';
            bottomSheetOverlay.style.opacity = '0';
            setTimeout(() => {
                bottomSheetOverlay.style.display = 'none';
            }, 300);
        };

        if (badgeBtn) {
            badgeBtn.onclick = () => {
                bottomSheetOverlay.style.display = 'block';
                // Trigger reflow
                void bottomSheetOverlay.offsetWidth;
                bottomSheetOverlay.style.opacity = '1';
                bottomSheet.style.transform = 'translateY(0)';
            };
        }
        
        if (bottomSheetOverlay) bottomSheetOverlay.onclick = closeDrawer;
        if (closeBtn) closeBtn.onclick = closeDrawer;

        const friendsSnap = await get(ref(db, `users/${targetUid}/friends`));
        const friendsCount = friendsSnap.exists() ? Object.values(friendsSnap.val()).filter(f => f.status === 'accepted').length : 0;
        const joinDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Неизвестно';
        
        const statusSnap = await get(ref(db, `users/${targetUid}/status`));
        const st = statusSnap.val() || {};
        const isOnline = st.online;
        const statusText = isOnline ? 'Онлайн' : (st.lastSeen ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}` : 'Офлайн');
        Utils.$('view-status').innerHTML = `<div class="indicator ${isOnline ? 'online' : ''}" style="width:8px;height:8px;border-radius:50%;background:${isOnline ? '#4caf50' : '#888'};display:inline-block;margin-right:6px;"></div>${statusText}`;

        const badgeHtml = this.getRoleBadgeHtml(profile, targetUid);
        
        let genderString = '';
        if (profile.gender === 'female') {
            genderString = 'Пол: Женский <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman%20Technologist.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;" alt="Женщина"><br>';
        } else if (profile.gender === 'male') {
            genderString = 'Пол: Мужской <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Man%20Technologist.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;" alt="Мужчина"><br>';
        }

        Utils.$('view-name').innerHTML = `${Utils.escapeHtml(profile.name)} ${badgeHtml}`;
        Utils.$('view-username').innerText = `@${Utils.escapeHtml(profile.username)}`;
        Utils.$('view-bio').innerHTML = `
            ${Utils.escapeHtml(profile.bio || 'Пользователь не добавил описание.')}<br><br>
            ${genderString}
            <strong style="color:var(--text-main);">Статистика:</strong><br>
            Друзей: ${friendsCount}<br>
            На платформе с: ${joinDate}
        `;
        
        const badgesContainer = Utils.$('view-badges-collection');
        if (badgesContainer) {
            badgesContainer.innerHTML = '';
            
            let userBadges = [];
            if (profile.assignedBadges && Array.isArray(profile.assignedBadges)) {
                const systemFallbacks = {
                    lvl_10: { name: "Ветеран", desc: "Достиг 10 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp", color: "#cddc39", xp: 0, bg: "rgba(205, 220, 57, 0.2)", border: "#cddc39" },
                    lvl_25: { name: "Мастер", desc: "Достиг 25 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp", color: "#ff9800", xp: 0, bg: "rgba(255, 152, 0, 0.2)", border: "#ff9800" },
                    lvl_50: { name: "Легенда", desc: "Достиг 50 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gem%20Stone.webp", color: "#2196f3", xp: 0, bg: "rgba(33, 150, 243, 0.2)", border: "#2196f3" },
                    lvl_100: { name: "Божество", desc: "Достиг 100 уровня", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp", color: "#ffeb3b", xp: 0, bg: "rgba(255, 235, 59, 0.2)", border: "#ffeb3b" },
                    rel_1week: { name: "1 Неделя", desc: "Вместе уже неделю!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Growing%20Heart.webp", color: "#ffffff", bg: "#d81b60", border: "#ff4081" },
                    rel_1month: { name: "1 Месяц", desc: "Первый совместный месяц!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Sparkling%20Heart.webp", color: "#ffffff", bg: "#c2185b", border: "#f50057" },
                    rel_6months: { name: "Полгода", desc: "Связь крепчает. 6 месяцев!", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Two%20Hearts.webp", color: "#ffffff", bg: "#ad1457", border: "#c51162" },
                    rel_1year: { name: "1 Год", desc: "Юбилей любви! 1 год", icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Revolving%20Hearts.webp", color: "#ffffff", bg: "#880e4f", border: "#f50057" }
                };
                profile.assignedBadges.forEach(bId => {
                    const b = (AppState.customBadges && AppState.customBadges[bId]) || systemFallbacks[bId];
                    if (b) userBadges.push({ ...b, _id: bId });
                });
            }
            
            // Partner dynamic badges
            const partnerUid = await this.getPartnerUid(targetUid);
            if (partnerUid) {
                const partnerProfile = await this.loadUser(partnerUid);
                const partnerName = partnerProfile ? partnerProfile.name : "Неизвестно";
                const sinceSnap = await get(ref(db, `users/${targetUid}/partnerSince`));
                const sinceTs = sinceSnap.exists() ? Number(sinceSnap.val()) : Date.now();
                const days = Math.floor((Date.now() - sinceTs) / (1000 * 60 * 60 * 24));
                
                if (days >= 7) {
                    userBadges.push({
                        _id: 'partner_7',
                        name: 'И Долго это будет?',
                        desc: `Первая неделя отношений с ${partnerName}`,
                        icon: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face%20With%20Hearts.webp',
                        color: '#ffffff'
                    });
                }
                
                if (days >= 30) {
                    userBadges.push({
                        name: 'Ну врооде бы серьезка',
                        desc: `Первый месяц отношений вместе с ${partnerName}`,
                        icon: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face%20With%20Hearts.webp',
                        color: '#ffffff'
                    });
                }
                
                if (days >= 100) {
                    userBadges.push({
                        _id: 'partner_100',
                        name: 'Брак',
                        desc: `100 Дней отношений с ${partnerName}`,
                        icon: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face%20With%20Hearts.webp',
                        color: '#ffffff'
                    });
                }
            }

            // Put selected badge first
            if (profile.selectedBadge) {
                const selectedIdx = userBadges.findIndex(b => b._id === profile.selectedBadge);
                if (selectedIdx > -1) {
                    const sb = userBadges.splice(selectedIdx, 1)[0];
                    userBadges.unshift(sb);
                }
            }

            if (userBadges.length > 0) {
                window.ProfileBadgesState = { index: 0 };
                
                const badgesHtml = userBadges.map((bdg, i) => {
                    const icon = bdg.icon ? (bdg.icon.match(/^http/) ? `<img src="${Utils.escapeHtml(bdg.icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>` : `<span style="font-size:48px;">${Utils.escapeHtml(bdg.icon)}</span>`) : '';
                    return `
                    <div class="ach-card" data-index="${i}" style="
                        width: 160px; 
                        min-width: 160px;
                        max-width: 160px;
                        height: 180px;
                        min-height: 180px;
                        max-height: 180px;
                        flex-shrink: 0;
                        border-radius: 12px; 
                        background: rgba(0,0,0,0.2);
                        border: 1px solid var(--border-light, rgba(255,255,255,0.1));
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        cursor: pointer;
                        user-select: none;
                    ">
                        <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px;">
                            ${icon}
                        </div>
                        <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%;">
                            <div style="color: #ffffff; font-weight: 800; font-size: 13px; line-height: 1.2;">${Utils.escapeHtml(bdg.name)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${Utils.escapeHtml(bdg.desc)}</div>
                            <div id="ach-count-${i}" style="color: rgba(255,255,255,0.5); font-size: 9.5px; margin-top:6px; font-weight: 600;">Уже получили: ...</div>
                        </div>
                    </div>`;
                }).join('');
                
                badgesContainer.innerHTML = `
                    <div style="width:100%; font-size:12px; color:var(--text-muted); font-weight:700; margin-bottom:10px; text-align:center; opacity:0.7; letter-spacing:0.5px;">ПОСТИЖЕНИЯ И АЧИВКИ</div>
                    <div style="position:relative; width:100%; height:200px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <button id="badge-prev" style="position:absolute; left:10px; z-index:10; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:white; border-radius:50%; width:36px; height:36px; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">‹</button>
                        <div class="badge-carousel-wrap" style="width:100%; max-width:500px; height:100%; position:relative; overflow:hidden; mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);">
                            <div id="badge-track" style="display:flex; height:100%; align-items:center; transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform:translateX(0px); gap:20px; width:max-content; box-sizing:content-box;">
                                ${badgesHtml}
                            </div>
                        </div>
                        <button id="badge-next" style="position:absolute; right:10px; z-index:10; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:white; border-radius:50%; width:36px; height:36px; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">›</button>
                    </div>
                    <!-- Action for selected badge -->
                    <div id="badge-action-container" style="text-align:center; height:30px; margin-top:10px;"></div>
                `;
                
                const updateBadgeCarousel = () => {
                    const track = Utils.$('badge-track');
                    if(!track) return;
                    const items = track.querySelectorAll('.ach-card');
                    if (items.length === 0) return;
                    
                    const itemWidth = 160;
                    const gap = 20;
                    const step = itemWidth + gap;
                    
                    const wrapElem = badgesContainer.querySelector('.badge-carousel-wrap');
                    let wrapWidth = 0;
                    if (wrapElem && wrapElem.clientWidth > 0) {
                        wrapWidth = wrapElem.clientWidth;
                    } else {
                        let modalParent = badgesContainer.closest('.modal-content');
                        if (modalParent && modalParent.clientWidth > 0) {
                            wrapWidth = modalParent.clientWidth - 48;
                        } else {
                            wrapWidth = Math.min(440, window.innerWidth - 32) - 48;
                        }
                    }
                    if (wrapWidth < 100) wrapWidth = Math.min(440, window.innerWidth - 32) - 48;
                    
                    const centerOffset = Math.floor((wrapWidth / 2) - (itemWidth / 2));
                    
                    track.style.transform = `translate3d(${centerOffset - (window.ProfileBadgesState.index * step)}px, 0, 0)`;
                    
                    items.forEach((el, i) => {
                        // Ensure all cards are visible
                        el.style.visibility = 'visible';
                        if(i === window.ProfileBadgesState.index) {
                            el.style.transform = 'scale(1)';
                            el.style.opacity = '1';
                            el.style.filter = 'brightness(1)';
                            el.style.zIndex = '5';
                            el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                        } else {
                            el.style.transform = 'scale(0.85)';
                            el.style.opacity = '0.5';
                            el.style.filter = 'brightness(0.5)';
                            el.style.zIndex = '1';
                            el.style.boxShadow = 'none';
                        }
                    });

                    // Update the action button
                    const actionContainer = Utils.$('badge-action-container');
                    const activeBadge = userBadges[window.ProfileBadgesState.index];
                    if (actionContainer && activeBadge) {
                        if (targetUid === AppState.currentUser.uid && activeBadge._id) {
                            if (profile.selectedBadge === activeBadge._id) {
                                actionContainer.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">Установлен как основной</span>`;
                            } else {
                                actionContainer.innerHTML = `<button class="secondary-btn" id="btn-select-main-badge" style="padding: 4px 12px; font-size: 11px; width: auto; display: inline-block;">Выбрать основным</button>`;
                                Utils.$('btn-select-main-badge').onclick = () => {
                                    update(ref(db, `users/${targetUid}/profile`), { selectedBadge: activeBadge._id }).then(() => {
                                        profile.selectedBadge = activeBadge._id;
                                        updateBadgeCarousel();
                                        Utils.toast('Бейдж установлен основным!');
                                    });
                                };
                            }
                        } else {
                            actionContainer.innerHTML = '';
                        }
                    }
                };

                Utils.$('badge-prev').onclick = () => {
                    if (window.ProfileBadgesState.index > 0) {
                        window.ProfileBadgesState.index--;
                        updateBadgeCarousel();
                    }
                };
                
                Utils.$('badge-next').onclick = () => {
                    if (window.ProfileBadgesState.index < userBadges.length - 1) {
                        window.ProfileBadgesState.index++;
                        updateBadgeCarousel();
                    }
                };

                let badgeStartX = 0;
                let badgeEndX = 0;
                const trackElem = Utils.$('badge-track');
                if (trackElem) {
                    trackElem.addEventListener('touchstart', e => {
                        badgeStartX = e.touches[0].clientX;
                    }, { passive: true });
                    trackElem.addEventListener('touchend', e => {
                        badgeEndX = e.changedTouches[0].clientX;
                        const diff = badgeEndX - badgeStartX;
                        if (diff > 40 && window.ProfileBadgesState.index > 0) {
                            window.ProfileBadgesState.index--;
                            updateBadgeCarousel();
                        } else if (diff < -40 && window.ProfileBadgesState.index < userBadges.length - 1) {
                            window.ProfileBadgesState.index++;
                            updateBadgeCarousel();
                        }
                    });
                }
                
                badgesContainer.querySelectorAll('.ach-card').forEach((card, i) => {
                    card.onclick = () => {
                        window.ProfileBadgesState.index = i;
                        updateBadgeCarousel();
                    };
                });
                
                setTimeout(updateBadgeCarousel, 50);
                setTimeout(updateBadgeCarousel, 200);
                setTimeout(updateBadgeCarousel, 500);
                setTimeout(updateBadgeCarousel, 250);
                setTimeout(updateBadgeCarousel, 500);
                
                // Fetch counts asynchronously
                get(ref(db, 'users')).then(snap => {
                    const allUsers = snap.val() || {};
                    const badgeCounts = {};
                    for (const u of Object.values(allUsers)) {
                        let assigned = u.profile?.assignedBadges;
                        if (Array.isArray(assigned)) {
                            assigned.forEach(bId => {
                                badgeCounts[bId] = (badgeCounts[bId] || 0) + 1;
                            });
                        }
                        if (u.partnerSince && u.partner) badgeCounts['rel_1week'] = (badgeCounts['rel_1week']||0) + 1; // Simplified fallback for dynamic ones
                    }
                    
                    userBadges.forEach((bdg, i) => {
                        const countEl = Utils.$(`ach-count-${i}`);
                        if (countEl) {
                            const num = badgeCounts[bdg._id] || badgeCounts[bdg.id] || badgeCounts[bdg.type] || 0;
                            countEl.innerHTML = `Уже получили: ${num}`;
                        }
                    });
                }).catch(e => console.error(e));
            }
        }

        const hashtagsEl = Utils.$('view-hashtags');
        const profileTags = Array.isArray(profile.hashtags) ? profile.hashtags : [];
        hashtagsEl.innerHTML = profileTags.map(tag => `<span class="hashtag-chip">${Utils.escapeHtml(tag)}</span>`).join('');
        this.applyProfileBackground(Utils.$('modal-view-profile')?.querySelector('.modal-content'), profile.background); // [NEW]
        const targetPartnerUid = await this.getPartnerUid(targetUid); // [NEW]
        await this.renderPartnerContainer('view-partner-container', targetPartnerUid, targetUid === AppState.currentUser.uid, targetUid); // [UPDATE]
        
        const avatarEl = Utils.$('view-avatar');
        avatarEl.innerHTML = ProfileManager.getAvatarHtml(profile);

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

        const vModal = Utils.$('modal-view-profile');
        vModal.classList.add('active');
        const vAvatar = Utils.$('view-avatar');
    }
}

// ============================================================================
// 4. СИСТЕМА ДРУЗЕЙ И ЛИЧНЫХ СООБЩЕНИЙ (с Share Room)
// ============================================================================

class FriendsManager {
    static sentFriendRequests = new Set();
    static pendingFriendRequestsMap = {};

    static initListeners() {
        const uid = AppState.currentUser.uid;
        const reqRef = ref(db, `users/${uid}/friend-requests`);
        const unsubReq = onValue(reqRef, (snap) => {
            const reqs = snap.val() || {};
            this.pendingFriendRequestsMap = reqs;
            this.renderRequests(reqs);
            if (AppState.currentRoomId) RoomManager.rerenderUsersList();
        });
        
        const frRef = ref(db, `users/${uid}/friends`);
        const unsubFr = onValue(frRef, (snap) => {
            this.renderFriends(snap.val() || {});
            if (AppState.currentRoomId) RoomManager.rerenderUsersList();
        });

        AppState.activeSubscriptions.push(() => off(reqRef, 'value', unsubReq), () => off(frRef, 'value', unsubFr));

        const navItems = ['nav-profile', 'nav-rooms', 'nav-catalog', 'nav-shop', 'nav-find-friend', 'nav-friends', 'nav-switch-account', 'nav-support', 'nav-support-staff'];
        const setNavActive = (id) => {
            navItems.forEach(n => {
                const el = Utils.$(n);
                if (el) el.classList.remove('active');
            });
            if (Utils.$(id)) Utils.$(id).classList.add('active');
            
            Utils.$('section-friends').style.display = id === 'nav-friends' ? 'flex' : 'none';
            Utils.$('section-find-friend').style.display = id === 'nav-find-friend' ? 'flex' : 'none';
            Utils.$('section-rooms').style.display = id === 'nav-rooms' ? 'flex' : 'none';
            Utils.$('section-catalog').style.display = id === 'nav-catalog' ? 'flex' : 'none';
            if(Utils.$('section-shop')) Utils.$('section-shop').style.display = id === 'nav-shop' ? 'flex' : 'none';
            if(Utils.$('section-support')) Utils.$('section-support').style.display = (id === 'nav-support' || id === 'nav-support-staff') ? 'flex' : 'none';
            Utils.$('section-profile').style.display = id === 'nav-profile' ? 'flex' : 'none';
            Utils.$('section-switch-account').style.display = id === 'nav-switch-account' ? 'flex' : 'none';
        };

        Utils.$('nav-friends').onclick = () => setNavActive('nav-friends');
        Utils.$('nav-find-friend').onclick = () => setNavActive('nav-find-friend');
        Utils.$('nav-rooms').onclick = () => setNavActive('nav-rooms');
        if (Utils.$('nav-catalog')) Utils.$('nav-catalog').onclick = () => setNavActive('nav-catalog');
        if (Utils.$('nav-shop')) Utils.$('nav-shop').onclick = () => { setNavActive('nav-shop'); window.ShopController?.loadShop(); };
        if (Utils.$('nav-support')) Utils.$('nav-support').onclick = () => { setNavActive('nav-support'); if (window.SupportSystem) SupportSystem.renderTickets(); };
        if (Utils.$('nav-support-staff')) Utils.$('nav-support-staff').onclick = () => { setNavActive('nav-support-staff'); if (window.SupportSystem) SupportSystem.renderTickets(); };
        if (Utils.$('nav-profile')) Utils.$('nav-profile').onclick = async () => {
            setNavActive('nav-profile');
            const uid = AppState.currentUser?.uid;
            const profile = await ProfileManager.loadUser(uid);
            const c = Utils.$('my-profile-container');
            if (c && profile) {
                const friendsSnap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref}) => get(ref(db, `users/${uid}/friends`)));
                const friendsCount = friendsSnap.exists() ? Object.values(friendsSnap.val()).filter(f => f.status === 'accepted').length : 0;
                const joinDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Неизвестно';
                
                let avatarStrStr = ProfileManager.getAvatarHtml(profile);
                c.innerHTML = `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 40px; text-align: center; position: relative;">
                        <div style="width: 120px; height: 120px; font-size: 48px; margin: 0 auto 20px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                            ${avatarStrStr}
                        </div>
                        <h3 style="font-size:28px; margin-bottom:5px;">${Utils.escapeHtml(profile.name)} ${ProfileManager.getRoleBadgeHtml(profile, uid)}</h3>
                        <div style="color:var(--accent); font-weight:600; font-size:16px; margin-bottom:20px;">@${Utils.escapeHtml(profile.username)}</div>
                        <p style="color:var(--text-muted); font-size:15px; margin-bottom:20px;">Для просмотра полной статистики, отношений и ачивок, откройте карточку профиля.</p>
                        <div style="display:flex; justify-content:center; gap: 15px;">
                            <button class="primary-btn" id="btn-open-full-profile-inline" style="width:auto; padding: 12px 24px;">Посмотреть в полном виде</button>
                            <button class="secondary-btn" id="btn-edit-my-profile-inline" style="width:auto; padding: 12px 24px;">Редактировать</button>
                        </div>
                    </div>
                `;
                
                Utils.$('btn-open-full-profile-inline').onclick = async () => {
                    try {
                        await ProfileManager.openViewProfileModal(uid);
                    } catch (e) {
                        Utils.toast('Ошибка: ' + (e.message||e), 'error');
                        console.error('Profile Modal error:', e);
                    }
                };
                
                Utils.$('btn-edit-my-profile-inline').onclick = () => {
                    ProfileManager.openEditProfileModal();
                };
            }
        };
        if (Utils.$('btn-switch-account')) {
            Utils.$('btn-switch-account').onclick = async () => {
                setNavActive('nav-switch-account');
                
                const listEl = Utils.$('saved-accounts-list');
                const saved = JSON.parse(localStorage.getItem('cowio_saved_accounts') || '[]');
                
                if (saved.length === 0) {
                    listEl.innerHTML = '<div style="color:var(--text-muted); font-size:14px;">Нет сохраненных аккаунтов.</div>';
                    return;
                }
                
                listEl.innerHTML = '';
                for (const acc of saved) {
                    const profile = await ProfileManager.loadUser(acc.uid); // Fetch profile data if needed, but it might be locally cached.
                    const isCurrent = AppState.currentUser?.uid === acc.uid;
                    const nameStr = profile ? profile.name : acc.email;
                    const avatarStr = profile ? `<div style=\"width:40px;height:40px;\">${ProfileManager.getAvatarHtml(profile)}</div>` : `<div style=\"width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;\">${(nameStr||'?')[0]}</div>`;
                    
                    const item = document.createElement('div');
                    item.style.cssText = `display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.3); padding:10px; border-radius:12px; cursor:${isCurrent?'default':'pointer'}; border:1px solid ${isCurrent?'var(--brand)':'rgba(255,255,255,0.1)'}; position: relative;`;
                    item.innerHTML = `
                        ${avatarStr}
                        <div style="flex:1; text-align:left;">
                            <div style="font-weight:bold; font-size:16px;">${Utils.escapeHtml(nameStr)}</div>
                            <div style="color:var(--text-muted); font-size:12px;">${Utils.escapeHtml(acc.email)}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${isCurrent ? '<span style="font-size:12px; color:var(--brand); background:rgba(0,255,136,0.1); padding:4px 8px; border-radius:6px;">Текущий</span>' : '<button class="secondary-btn" style="padding:4px 12px; font-size:12px; width:auto; border-radius:6px;">Войти</button>'}
                            <button class="danger-btn rm-acc-btn" data-email="${Utils.escapeHtml(acc.email)}" style="width: auto; padding: 4px; font-size: 14px; border-radius: 6px; background: transparent; border: 1px solid rgba(255,0,0,0.4); color: rgba(255,0,0,0.8);" title="Удалить аккаунт из списка">✕</button>
                        </div>
                    `;
                    
                    const rmBtn = item.querySelector('.rm-acc-btn');
                    if (rmBtn) {
                        rmBtn.onclick = (e) => {
                            e.stopPropagation();
                            const newSaved = saved.filter(a => a.email !== acc.email);
                            localStorage.setItem('cowio_saved_accounts', JSON.stringify(newSaved));
                            Utils.toast('Аккаунт удален из списка');
                            if (isCurrent && newSaved.length === 0) {
                                localStorage.removeItem('cowio_saved_accounts');
                                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut, getAuth }) => { signOut(getAuth()); });
                            } else {
                                this.initNavActions(); // Trigger re-render by calling the button simulate maybe?
                                // Better: just re-click the switch account button
                                const switchBtn = Utils.$('nav-switch-account');
                                if (switchBtn) switchBtn.click();
                            }
                        };
                    }

                    if (!isCurrent) {
                        item.onclick = (e) => {
                            if (e.target.tagName === 'BUTTON') return;
                            if (!acc.pass) {
                                Utils.toast('Пароль не сохранен. Войдите вручную.');
                                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut, getAuth }) => signOut(getAuth()));
                                return;
                            }
                            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signInWithEmailAndPassword, getAuth }) => {
                                Utils.toast('Вход...');
                                signInWithEmailAndPassword(getAuth(), acc.email, acc.pass).then(() => {
                                    Utils.toast('Успешно!', 'success');
                                    Utils.$('btn-switch-account').onclick(); // Refresh UI
                                }).catch(e => {
                                    Utils.toast('Ошибка входа', 'error');
                                });
                            });
                        };
                    }
                    listEl.appendChild(item);
                }
            };
        }
        if (Utils.$('btn-do-switch-account')) {
            Utils.$('btn-do-switch-account').onclick = () => {
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut, getAuth }) => {
                    signOut(getAuth());
                });
            };
        }
        if (Utils.$('btn-do-switch-account-clear')) {
            Utils.$('btn-do-switch-account-clear').onclick = () => {
                localStorage.removeItem('cowio_saved_accounts');
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut, getAuth }) => {
                    signOut(getAuth());
                });
            };
        }
        if (Utils.$('btn-open-my-profile-modal')) {
            Utils.$('btn-open-my-profile-modal').onclick = () => ProfileManager.openProfileModal(AppState.currentUser?.uid);
        }

        const doSearch = async () => {
            const val = Utils.$('find-friend-input').value.trim().toLowerCase();
            const resContainer = Utils.$('find-friend-results');
            if (!val) {
                resContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Введите username для поиска</div>';
                return;
            }
            resContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Поиск...</div>';
            try {
                const snap = await get(ref(db, 'users'));
                if (snap.exists()) {
                    const allUsers = snap.val();
                    let foundHtml = '';
                    let foundCount = 0;
                    for (const [uid, udata] of Object.entries(allUsers)) {
                        if (uid === AppState.currentUser.uid) continue;
                        if (udata.profile && udata.profile.username && udata.profile.username.toLowerCase().includes(val)) {
                            foundCount++;
                            const isFriend = udata.friends && udata.friends[AppState.currentUser.uid] && udata.friends[AppState.currentUser.uid].status === 'accepted';
                            const avatar = `<div style=\"width:40px;height:40px;\">${ProfileManager.getAvatarHtml(udata.profile)}</div>`;
                            foundHtml += `
                            <div class="user-card" onclick="ProfileManager.openProfileModal('${uid}')" style="cursor:pointer; display:flex; align-items:center; space-between; gap:10px;">
                                ${avatar}
                                <div class="user-card-info" style="flex:1;">
                                    <div class="user-card-name">${Utils.escapeHtml(udata.profile.name)}</div>
                                    <div class="user-card-username">@${Utils.escapeHtml(udata.profile.username)}</div>
                                </div>
                                ${isFriend ? '<span style="font-size:12px; color:var(--accent);">✓ Друг</span>' : '<button class="secondary-btn" style="width:auto; padding:4px 8px; font-size:10px;" onclick="event.stopPropagation(); FriendsManager.sendFriendRequest(\''+uid+'\')">Добавить</button>'}
                            </div>
                            `;
                        }
                    }
                    if (foundCount > 0) resContainer.innerHTML = foundHtml;
                    else resContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Ничего не найдено</div>';
                }
            } catch (e) {
                resContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-error); text-align: center;">Ошибка поиска</div>';
            }
        };

        const searchBtn = Utils.$('btn-find-friend');
        if(searchBtn) searchBtn.onclick = doSearch;
        const searchInput = Utils.$('find-friend-input');
        if(searchInput) searchInput.onkeyup = (e) => { if(e.key === 'Enter') doSearch(); };
    }

    static async sendFriendRequest(targetUid) {
        if (targetUid === AppState.currentUser.uid) return;
        try {
            await set(ref(db, `users/${targetUid}/friend-requests/${AppState.currentUser.uid}`), { ts: Date.now() });
            this.sentFriendRequests.add(targetUid);
            Utils.toast('Заявка отправлена');
            if (AppState.currentRoomId) RoomManager.rerenderUsersList();
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
            delete this.pendingFriendRequestsMap[targetUid];
            this.sentFriendRequests.delete(targetUid);
            Utils.toast(accept ? 'Друг добавлен' : 'Заявка отклонена');
            if (AppState.currentRoomId) RoomManager.rerenderUsersList();
        } catch (e) { Utils.toast('Ошибка', 'error'); }
    }

    static _lastRequestsKeys = [];
    static _initialRequestsLoaded = false;

    static _renderRequestsId = 0;

    static async renderRequests(requests) {
        const renderId = ++this._renderRequestsId;
        const container = Utils.$('friend-requests-list');
        const badge = Utils.$('friend-req-badge');
        const keys = Object.keys(requests);
        
        if (!this._initialRequestsLoaded) {
            this._lastRequestsKeys = keys;
            this._initialRequestsLoaded = true;
        } else {
            const newKeys = keys.filter(k => !this._lastRequestsKeys.includes(k));
            this._lastRequestsKeys = keys;
            
            newKeys.forEach(uid => {
                ProfileManager.loadUser(uid).then(profile => {
                    if (profile) this.showFriendRequestNotification(uid, profile);
                });
            });
        }

        if (keys.length > 0) {
            badge.innerText = keys.length; badge.classList.add('show');
        } else {
            badge.classList.remove('show');
            container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет новых заявок</div>';
            return;
        }

        const itemsHtml = [];
        for (const uid of keys) {
            const profile = await ProfileManager.loadUser(uid);
            if (!profile) continue;
            itemsHtml.push({ uid, profile });
        }

        if (renderId !== this._renderRequestsId) return;

        container.innerHTML = '';
        for (const { uid, profile } of itemsHtml) {
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

    static showFriendRequestNotification(uid, profile) {
        let container = Utils.$('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        
        const div = document.createElement('div');
        div.className = 'toast';
        div.style.borderLeft = `4px solid var(--accent)`;
        div.style.pointerEvents = 'all'; 
        div.innerHTML = `
            <div style="margin-bottom:8px;"><strong>${Utils.escapeHtml(profile.name)}</strong> хочет в друзья.</div>
            <div style="display:flex; gap:8px;">
                <button class="secondary-btn btn-small btn-accept-toast" style="flex:1; padding:6px; font-size:11px;">Принять</button>
                <button class="secondary-btn btn-small btn-close-toast" style="padding:6px; font-size:11px;">✕</button>
            </div>
        `;
        
        div.querySelector('.btn-accept-toast').onclick = () => {
            this.handleRequest(uid, true);
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        };
        div.querySelector('.btn-close-toast').onclick = () => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        };
        
        container.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.style.opacity = '0';
                setTimeout(() => div.remove(), 300);
            }
        }, 12000);
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

                const relData = friendsMap[uid];
                const activeStreak = ProfileManager.getActiveStreak ? ProfileManager.getActiveStreak(profile) : profile.streak;
                const streakHTML = (activeStreak && activeStreak > 0) ? `<div style="position: absolute; bottom: -4px; right: -4px; background: rgba(0,0,0,0.8); border-radius: 50%; padding: 2px 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; border: none;" title="Стрик захода: ${activeStreak} дней"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width:14px; height:14px; margin-right:2px;">${activeStreak}</div>` : '';
                
                const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
                div.innerHTML = `
                    <div class="avatar" style="position:relative; overflow:visible; background:transparent;">
                        ${ProfileManager.getAvatarHtml(profile)}
                        ${streakHTML}
                    </div>
                    <div class="friend-info-col" style="flex:1;">
                        <div class="friend-name">${Utils.escapeHtml(profile.name)} ${roleBadgeHtml}</div>
                        <div class="friend-status" style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                            <div class="status-dot ${isOnline ? 'online' : ''}" style="display:inline-block;"></div>
                            ${isOnline ? 'Онлайн' : status.lastSeen ? `Был(а) ${Utils.formatLastSeen(status.lastSeen)}` : 'Офлайн'}
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
    static themeOptions = ['default', 'love', 'light', 'aurora', 'sunset', 'ocean'];

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
            // Update the sidebar whenever there's a new message or chat update
            if (AppState.currentDirectChat) {
                this.populateSidebar(AppState.currentDirectChat.uid, chats);
            }

            Object.entries(chats).forEach(([chatId, chat]) => {
                if (!chat?.participants?.[AppState.currentUser.uid] || !chat.lastMessage) return;
                
                const marker = `dmSeen:${chatId}`;
                const seenTs = Number(localStorage.getItem(marker) || '0');
                const lastTs = Number(chat.lastMessage.ts || 0);
                
                if (lastTs <= seenTs || chat.lastMessage.fromUid === AppState.currentUser.uid) return;
                if (AppState.currentDirectChat?.id === chatId) return; 
                
                localStorage.setItem(marker, String(lastTs));
                EasterEggManager.playNotification();
                if (chat.lastMessage.type === 'invite') {
                    Utils.toast(`ЛС: ${chat.lastMessage.fromName} приглашает вас в комнату!`);
                } else if (chat.lastMessage.type === 'text') {
                    Utils.toast(`ЛС от ${chat.lastMessage.fromName}: ${chat.lastMessage.text}`);
                } else {
                    Utils.toast(`ЛС от ${chat.lastMessage.fromName} отправил(а) медиа`);
                }
            });
        });
        AppState.activeSubscriptions.push(() => off(dmRoot, 'value', unsub));
    }

    static async populateSidebar(activeTargetUid, chatsData = null) {
        const sidebar = Utils.$('dm-sidebar-list');
        if (!sidebar) return;

        // Build list of users with whom we have chats AND friends, to show in sidebar
        const myUid = AppState.currentUser.uid;
        
        let chats = chatsData;
        if (!chats) {
            const snap = await get(ref(db, 'direct-messages'));
            chats = snap.val() || {};
        }

        const activeChats = Object.entries(chats)
            .filter(([id, c]) => c.participants && c.participants[myUid])
            .map(([id, c]) => ({
                id, 
                partnerUid: Object.keys(c.participants).find(x => x !== myUid) || myUid,
                lastMsg: c.lastMessage || {},
                updatedAt: c.updatedAt || 0
            }));

        const friendsKeys = Object.keys(AppState.friendsCache || {}).filter(k => AppState.friendsCache[k].status === 'accepted');
        
        const combinedUids = new Set([...activeChats.map(c => c.partnerUid), ...friendsKeys, activeTargetUid]);
        
        let listItems = [];

        for (const uid of combinedUids) {
            if (!uid) continue;
            const profile = await ProfileManager.loadUser(uid);
            if (!profile) continue;
            
            const chatObj = activeChats.find(c => c.partnerUid === uid);
            const ts = chatObj ? chatObj.updatedAt : 0;
            let lastText = '';
            if (chatObj && chatObj.lastMsg) {
                if (chatObj.lastMsg.type === 'text') lastText = chatObj.lastMsg.text;
                else if (chatObj.lastMsg.type === 'invite') lastText = 'Приглашение в комнату';
                else lastText = 'Медиа';
            }

            const isPinned = localStorage.getItem(`dmPin:${uid}`) === '1';

            listItems.push({
                uid,
                name: profile.name,
                avatar: profile.avatar,
                frame: profile.frame,
                lastText,
                ts,
                isPinned,
                isActive: (activeTargetUid === uid)
            });
        }

        listItems.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.ts - a.ts;
        });

        // Ensure active user is present even if newly opened
        sidebar.innerHTML = '';
        listItems.forEach(item => {
            const el = document.createElement('div');
            el.className = `dm-chat-item ${item.isActive ? 'active' : ''} ${item.isPinned ? 'pinned' : ''}`;
            el.innerHTML = `
                <div class="dm-chat-avatar">${ProfileManager.getAvatarHtml(item)}</div>
                <div class="dm-chat-info">
                    <div class="dm-chat-name">${Utils.escapeHtml(item.name)}</div>
                    <div class="dm-chat-last-msg">${Utils.escapeHtml(item.lastText) || '<i>Нет сообщений</i>'}</div>
                </div>
                <button class="dm-pin-btn" title="Закрепить">${item.isPinned ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : '📍'}</button>
            `;
            
            el.onclick = (e) => {
                if(e.target.closest('.dm-pin-btn')) {
                    if (item.isPinned) localStorage.removeItem(`dmPin:${item.uid}`);
                    else localStorage.setItem(`dmPin:${item.uid}`, '1');
                    this.populateSidebar(activeTargetUid, chatsData); // re-render
                    return;
                }
                if (!item.isActive) {
                    this.openChat(item.uid, item.name);
                }
            };
            sidebar.appendChild(el);
        });
    }

    static openChat(targetUid, targetName) {
        if (this.unsubCurrent) this.unsubCurrent();
        const chatId = this.getChatId(AppState.currentUser.uid, targetUid);
        AppState.currentDirectChat = { uid: targetUid, name: targetName, id: chatId };
        
        Utils.$('dm-chat-title').innerText = `Чат: ${targetName}`;
        
        // Fetch last seen for target
        get(ref(db, `users/${targetUid}/status`)).then(snap => {
            const st = snap.val() || {};
            const isOnline = st.online;
            const subtitle = isOnline ? 'Онлайн' : (st.lastSeen ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}` : 'Приватные сообщения');
            const subtitleEl = Utils.$('dm-chat-title').nextElementSibling;
            if (subtitleEl) subtitleEl.innerText = subtitle;
        });

        Utils.$('modal-dm-chat').classList.add('active');
        this.bindThemeControls();
        this.applyTheme(this.theme, false);
        this.populateSidebar(targetUid);

        const chatRef = ref(db, `direct-messages/${chatId}`);
        this.unsubCurrent = onValue(chatRef, (snap) => {
            const data = snap.val() || {};
            const dbTheme = this.normalizeTheme(data.theme || 'default');
            if (dbTheme !== this.theme) this.applyTheme(dbTheme, false);
            const messages = Object.entries(data.messages || {}).map(([id, val]) => ({ id, ...val })).sort((a,b)=>a.ts - b.ts);
            this.renderMessages(messages);
            if (data.lastMessage?.ts) localStorage.setItem(`dmSeen:${chatId}`, String(data.lastMessage.ts));
        });

        const sendBtn = Utils.$('btn-dm-send');
        const input = Utils.$('dm-input');
        
        const attachBtn = Utils.$('btn-dm-attach');
        const mediaPicker = Utils.$('dm-media-picker');
        const mediaInput = Utils.$('dm-media-input');
        const mediaSendBtn = Utils.$('btn-dm-media-send');
        const mediaCancelBtnTop = Utils.$('btn-dm-media-cancel-top');
        
        const attachMediaAction = () => {
            if (mediaPicker) {
                mediaPicker.style.display = mediaPicker.style.display === 'none' ? 'flex' : 'none';
                if (mediaPicker.style.display === 'flex') mediaInput.focus();
            }
        };
        
        if (attachBtn) attachBtn.onclick = attachMediaAction;
        if (mediaCancelBtnTop) mediaCancelBtnTop.onclick = () => mediaPicker.style.display = 'none';

        let dmGifSearchTimeout = null;
        if (mediaInput) {
            mediaInput.addEventListener('input', () => {
                if(dmGifSearchTimeout) clearTimeout(dmGifSearchTimeout);
                const query = mediaInput.value.trim();
                const container = Utils.$('dm-gif-results');
                if(!container) return;
                
                if(!query) {
                    container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px 0;">Начните вводить текст для поиска GIF</div>';
                    return;
                }
                
                if(query.startsWith('http')) {
                    container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px 0;">Вы ввели ссылку. Нажмите "Отправить"</div>';
                    return;
                }
                
                container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px 0;">Поиск GIF...</div>';
                
                dmGifSearchTimeout = setTimeout(async () => {
                    try {
                        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=20`);
                        const data = await res.json();
                        if (data.data && data.data.length > 0) {
                            container.innerHTML = data.data.map(g => {
                                const url = g.images.fixed_height.url;
                                return `<img src="${url}" class="dm-preset-gif" style="height:80px; flex-grow:1; object-fit:cover; border-radius:6px; cursor:pointer;" />`;
                            }).join('');
                            // Bind clicks
                            container.querySelectorAll('.dm-preset-gif').forEach(img => {
                                img.onclick = () => performMediaSend(img.src);
                            });
                        } else {
                            container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px 0;">Ничего не найдено</div>';
                        }
                    } catch(e) {
                        container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-error); font-size: 12px; padding: 10px 0;">Ошибка загрузки</div>';
                    }
                }, 500);
            });
        }

        const performMediaSend = async (url) => {
            if (!url) return;
            if (AdminPanel.isSystemReadOnlyForUser()) return Utils.toast('Система в режиме ReadOnly', 'error');
            mediaInput.value = '';
            mediaPicker.style.display = 'none';
            const myProfile = AppState.usersCache.get(AppState.currentUser.uid);
            const myName = myProfile?.name || AppState.currentUser.displayName || 'User';
            
            const payload = { type: 'media', url, fromUid: AppState.currentUser.uid, fromName: myName, ts: Date.now() };
            await update(ref(db, `direct-messages/${chatId}`), {
                participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
                updatedAt: payload.ts, lastMessage: payload
            });
            await push(ref(db, `direct-messages/${chatId}/messages`), payload);
        };
        
        if (mediaSendBtn) mediaSendBtn.onclick = () => performMediaSend(mediaInput.value.trim());

        document.querySelectorAll('.dm-preset-gif').forEach(img => {
            img.onclick = () => performMediaSend(img.src);
        });

        const sendAction = async () => {
            const text = input.value.trim();
            if (!text) return;
            if (AdminPanel.isSystemReadOnlyForUser()) return Utils.toast('Система в режиме ReadOnly', 'error');
            input.value = '';
            
            const myProfile = AppState.usersCache.get(AppState.currentUser.uid);
            const myName = myProfile?.name || AppState.currentUser.displayName || 'User';
            const payload = { type: 'text', fromUid: AppState.currentUser.uid, fromName: myName, text, ts: Date.now() };
            
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
        if (!messages.length) {
            list.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>`;
            return;
        }
        
        list.innerHTML = messages.map(m => {
            const isSelf = m.fromUid === AppState.currentUser.uid;
            if (m.type === 'system') {
                return `<div class="sys-msg">${Utils.escapeHtml(m.fromName || 'Пользователь')} ${Utils.escapeHtml(m.text || '')}</div>`;
            }
            
            if (m.type === 'invite') {
                return `
                    <div class="m-line ${isSelf ? 'self' : ''}">
                        <strong>${Utils.escapeHtml(isSelf ? 'Вы' : m.fromName)}</strong>
                        <div class="bubble" style="border: 1px solid var(--accent); background: rgba(46,213,115,0.1);">
                            <div style="font-weight:bold; margin-bottom:5px;">Привет! Заходи к нам:</div>
                            <div style="font-size: 16px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${Utils.escapeHtml(m.roomName)}</div>
                            <div style="font-size: 12px; opacity:0.8; margin-bottom:8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Зрителей: ${m.membersCount || 1}</div>
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

            if (m.type === 'file' || m.type === 'gif' || m.type === 'media') {
                const isImg = m.type === 'gif' || String(m.url).match(/\.(gif|jpe?g|png|webp|bmp)$/i) || String(m.url).match(/tenor\.com|giphy\.com|imgur\.com/i);
                return `
                    <div class="m-line ${isSelf ? 'self' : ''}">
                        <strong>${Utils.escapeHtml(isSelf ? 'Вы' : m.fromName)}</strong>
                        <div class="bubble" style="padding: 4px;">
                            ${isImg ? `<img src="${Utils.escapeHtml(m.url)}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x150?text=Error';" />` : `<a href="${Utils.escapeHtml(m.url)}" target="_blank" style="color: var(--accent); padding: 8px; display: inline-block;">📎 Прикрепленный файл</a>`}
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
            btn.onclick = () => this.applyTheme(btn.dataset.theme || 'default', true);
        });
    }

    static normalizeTheme(theme = 'default') {
        return ThemeManager.EXTENDED_THEMES[theme] ? theme : 'default';
    }

    static applyTheme(theme = 'default', persist = false) {
        const modal = Utils.$('modal-dm-chat');
        if (!modal) return;
        this.theme = this.normalizeTheme(theme);
        Object.keys(ThemeManager.EXTENDED_THEMES).forEach(k => modal.classList.remove('theme-' + k));
        if (this.theme !== 'default') modal.classList.add(`theme-${this.theme}`);
        Utils.$('dm-theme-controls')?.querySelectorAll('.dm-theme-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.theme);
        });
        if (this.theme === 'love') this.startLoveHearts();
        else this.stopLoveHearts();

        if (persist && AppState.currentDirectChat?.id) {
            const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
            update(ref(db, `direct-messages/${AppState.currentDirectChat.id}`), {
                theme: this.theme,
                updatedAt: Date.now()
            }).catch(() => {});
            push(ref(db, `direct-messages/${AppState.currentDirectChat.id}/messages`), {
                type: 'system',
                fromUid: AppState.currentUser.uid,
                fromName: profile.name || AppState.currentUser.displayName || 'Пользователь',
                text: `сменил тему чата на "${this.theme}"`,
                ts: Date.now()
            }).catch(() => {});
        }
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
        if (AdminPanel.isSystemReadOnlyForUser()) return Utils.toast('Система в режиме ReadOnly', 'error');
        if (AppState.admin.settings.globalInvitesBlocked && !AdminPanel.isCurrentUserAdmin()) return Utils.toast('Инвайты временно отключены администратором', 'error');
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

class SupportSystem {
    static activeTicketId = null;
    static unsubList = null;
    static unsub = null;
    static globalUnsub = null;
    static typingUnsub = null;
    static lastMessageDates = {};
    static lastStatuses = {};
    static typingTimer = null;
    static BANNED_USERS = new Set();
    static TEMPLATES = {
        'Приветствие': 'Здравствуйте! Чем я могу вам помочь?',
        'Ожидание': 'Пожалуйста, подождите, мы уточняем информацию.',
        'Закрытие': 'Рады были помочь! Тикет закрывается.'
    };

    static initGlobalListener() {
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const profile = AppState.usersCache.get(uid) || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        
        // Use implicit import for onValue/ref
        if (typeof onValue !== 'undefined') {
            onValue(ref(db, 'support_bans'), snap => {
                this.BANNED_USERS = new Set(Object.keys(snap.val() || {}));
            });
            onValue(ref(db, 'support_templates'), snap => {
                if (snap.exists()) this.TEMPLATES = {
                    'Приветствие': 'Здравствуйте! Чем я могу вам помочь?',
                    'Ожидание': 'Пожалуйста, подождите, мы уточняем информацию.',
                    'Закрытие': 'Рады были помочь! Тикет закрывается.',
                    ...snap.val()
                };
            });
        }
        
        if (this.globalUnsub) this.globalUnsub();
        
        this.globalUnsub = onValue(ref(db, 'support_tickets'), snap => {
            const val = snap.val() || {};
            let hasUnread = false;
            
            Object.entries(val).forEach(([id, t]) => {
                if (!isAdmin && t.creatorUid !== uid) return;
                
                if (!isAdmin && this.lastStatuses[id] && this.lastStatuses[id] !== t.status) {
                    if (t.status === 'open') Utils.toast(`Ваш тикет "${t.title}" был открыт`, 'info');
                    if (t.status === 'closed') Utils.toast(`Ваш тикет "${t.title}" был закрыт`, 'info');
                }
                this.lastStatuses[id] = t.status;

                const msgs = t.messages || {};
                const msgKeys = Object.keys(msgs);
                if (msgKeys.length > 0) {
                    const lastMsg = msgs[msgKeys[msgKeys.length - 1]];
                    
                    if (this.lastMessageDates[id] && lastMsg.timestamp > this.lastMessageDates[id]) {
                        if ((!isAdmin && lastMsg.isAdmin) || (isAdmin && !lastMsg.isAdmin)) {
                            if (this.activeTicketId !== id) {
                                hasUnread = true;
                                Utils.toast(`Новое сообщение в тикете "${t.title}"`, 'info');
                            }
                        }
                    }
                    this.lastMessageDates[id] = lastMsg.timestamp;
                }
            });

            const navIcon = Utils.$('nav-support') || Utils.$('nav-support-staff');
            if (navIcon) {
                let badge = navIcon.querySelector('.support-badge');
                if (hasUnread) {
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.className = 'support-badge';
                        badge.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 10px; height: 10px; background: red; border-radius: 50%;';
                        navIcon.style.position = 'relative';
                        navIcon.appendChild(badge);
                    }
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    }

    static async openCreatorPanel() {
        const modal = Utils.$('modal-support-creator-panel');
        if (modal) modal.classList.add('active');
        
        try {
            let total = 0, open = 0, closed = 0;
            if (typeof get !== 'undefined' && typeof ref !== 'undefined') {
                const snap = await get(ref(db, 'support_tickets'));
                const val = snap.val() || {};
                Object.values(val).forEach(t => {
                    total++;
                    if (t.status === 'closed') closed++;
                    else open++;
                });
            }
            
            const elTotal = Utils.$('stat-total-tickets'); if (elTotal) elTotal.innerText = total;
            const elOpen = Utils.$('stat-open-tickets'); if (elOpen) elOpen.innerText = open;
            const elClosed = Utils.$('stat-closed-tickets'); if (elClosed) elClosed.innerText = closed;
            
            this.renderCreatorTemplates();
        } catch (e) {
            console.error("Error in openCreatorPanel:", e);
        }
    }

    static renderCreatorTemplates() {
        const list = Utils.$('support-creator-templates-list');
        if (!list) return;
        if (Object.keys(this.TEMPLATES).length === 0) {
            list.innerHTML = `<div style="color:var(--text-muted); font-size:12px; text-align:center;">Нет шаблонов</div>`;
            return;
        }
        list.innerHTML = Object.entries(this.TEMPLATES).map(([name, text]) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px;">
                <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                    <div style="font-size:12px; font-weight:bold; color:var(--accent);">${name}</div>
                    <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${text}</div>
                </div>
                <button class="danger-btn" style="width:auto; padding:4px 8px; font-size:11px;" onclick="SupportSystem.removeGlobalTemplate('${name}')">Удалить</button>
            </div>
        `).join('');
    }

    static async addGlobalTemplate() {
        const nInput = Utils.$('new-template-name');
        const tInput = Utils.$('new-template-text');
        if (!nInput || !tInput) return;
        const name = nInput.value.trim();
        const text = tInput.value.trim();
        if (!name || !text) return Utils.toast('Заполните все поля', 'error');
        if (typeof update !== 'undefined' && typeof ref !== 'undefined') {
             await update(ref(db, 'support_templates'), { [name]: text });
             Utils.toast('Шаблон добавлен', 'success');
             nInput.value = ''; tInput.value = '';
             this.TEMPLATES[name] = text;
             this.renderCreatorTemplates();
             const tContainer = Utils.$('support-inline-templates'); 
             if(tContainer && tContainer.style.display !== 'none' && this.activeTicketId) {
                 SupportSystem.openTicket(this.activeTicketId);
             }
        }
    }

    static async removeGlobalTemplate(name) {
        if (!confirm('Удалить шаблон "' + name + '"?')) return;
        if (typeof update !== 'undefined' && typeof ref !== 'undefined') {
             await update(ref(db, 'support_templates'), { [name]: null });
             delete this.TEMPLATES[name];
             this.renderCreatorTemplates();
             const tContainer = Utils.$('support-inline-templates'); 
             if(tContainer && tContainer.style.display !== 'none' && this.activeTicketId) {
                 SupportSystem.openTicket(this.activeTicketId);
             }
        }
    }

    static async useTemplate(name, id) {
         if (!this.TEMPLATES[name]) return;
         const text = this.TEMPLATES[name];
         await this.sendMessage(id, false, text);
    }

    static async renderTickets() {
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const profile = (AppState.usersCache.get(AppState.currentUser?.uid) || {}) || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        const isCreator = AdminPanel.isCreatorProfile(profile, uid);
        const list = Utils.$('support-tickets-list');
        
        const panelBtn = Utils.$('btn-support-creator-panel');
        if (panelBtn) {
           panelBtn.style.display = isCreator ? 'block' : 'none';
           panelBtn.onclick = () => this.openCreatorPanel();
        }

        const btnOpenCreate = Utils.$('btn-open-create-ticket-modal');
        if (btnOpenCreate) btnOpenCreate.onclick = () => {
            if (this.BANNED_USERS.has(uid)) return Utils.toast('Вы заблокированы в системе поддержки', 'error');
            const m = Utils.$('modal-create-ticket');
            if(m) m.classList.add('active');
        };

        if (this.unsubList) this.unsubList();
        const dbRef = ref(db, 'support_tickets');
        this.unsubList = onValue(dbRef, snap => {
            const val = snap.val() || {};
            let tickets = Object.entries(val).map(([id, t]) => ({ id, ...t }));
            if (!isAdmin) {
                tickets = tickets.filter(t => t.creatorUid === uid);
                tickets = tickets.filter(t => t.status !== 'closed'); // Hide for creator visually
            }
            if (tickets.length === 0) {
                list.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">Тикетов нет</div>`;
                return;
            }
            tickets.sort((a,b) => b.createdAt - a.createdAt); // newest first
            list.innerHTML = tickets.map(t => {
                const titleStr = Utils.escapeHtml(t.title || 'Без темы');
                const titleEscaped = titleStr.replace(/'/g, "\\'").replace(/"/g, '&quot;'); // escape to insert to onclick
                const isOpen = t.status === 'open';
                const statusText = isOpen ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/White%20Circle.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> В работе' : '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Circle.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Закрыт';
                const priority = t.priority ? `<span style="margin-left:8px;font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#fff;">${t.priority}</span>` : '';
                const unreadDot = (t.lastActivity && t.lastActivity > (t.readReceipts?.[uid] || 0) && t.lastSender !== uid && (isAdmin || t.lastSenderIsAdmin)) ? `<div style="width:8px;height:8px;border-radius:50%;background:#ff4757;margin-left:8px;flex-shrink:0;box-shadow:0 0 8px #ff4757;" title="Новые сообщения"></div>` : '';
                
                const categoryEmoji = t.category === 'Баг' ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Bug.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : t.category === 'Вопрос' ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Question%20Mark.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">';
                
                return `
                <div class="dm-chat-item ${this.activeTicketId === t.id ? 'active' : ''}" onclick="SupportSystem.openTicket('${t.id}')">
                    <div class="dm-chat-avatar" style="background:${isOpen ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)'}; color:${isOpen ? '#ffffff' : '#ff4444'}; font-size:20px;">
                        ${categoryEmoji}
                    </div>
                    <div class="dm-chat-info">
                        <div class="dm-chat-name" style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                           <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${titleStr}</span>
                           ${unreadDot}
                        </div>
                        <div class="dm-chat-last-msg" style="display:flex;align-items:center;">${statusText}${isAdmin ? priority : ''}</div>
                    </div>
                </div>`;
            }).join('');
        });

        const btnNew = Utils.$('btn-new-ticket');
        if (btnNew) btnNew.onclick = async () => {
             if (this.BANNED_USERS.has(uid)) return Utils.toast('Вы заблокированы в системе поддержки', 'error');
            const inputEl = Utils.$('support-new-ticket-title');
            const priorityEl = Utils.$('support-new-ticket-priority');
            const textEl = Utils.$('support-new-ticket-text');
            const title = inputEl ? inputEl.value.trim() : '';
            const priority = priorityEl ? priorityEl.value : 'Средний';
            const text = textEl ? textEl.value.trim() : '';
            
            if (!title || !text) return;
            const newRef = push(ref(db, 'support_tickets'));
            const ts = Date.now();
            await set(newRef, {
                title,
                priority,
                creatorUid: uid,
                status: 'open',
                createdAt: ts,
                lastActivity: ts,
                lastSender: uid
            });
            await push(ref(db, `support_tickets/${newRef.key}/messages`), {
                text: text,
                uid,
                name: profile?.name || 'Пользователь',
                username: profile?.username || uid,
                avatar: profile?.avatar || '',
                isAdmin: false,
                timestamp: ts
            });

            if (inputEl) inputEl.value = '';
            if (textEl) textEl.value = '';
            document.getElementById('modal-create-ticket')?.classList.remove('active');
            SupportSystem.openTicket(newRef.key);
        };
    }

    static async openTicket(id) {
        const uid = AppState.currentUser?.uid;
        this.activeTicketId = id;
        
        set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());

        const items = document.querySelectorAll('#support-tickets-list .dm-chat-item');
        items.forEach(el => el.classList.remove('active'));
        const clickedItem = Array.from(items).find(el => el.getAttribute('onclick').includes(id));
        if (clickedItem) clickedItem.classList.add('active');
        
        const layoutContainer = Utils.$('support-grid-container');
        if (layoutContainer) layoutContainer.classList.add('chat-active');
        
        const btnBack = Utils.$('btn-support-back');
        if (btnBack) {
            btnBack.style.display = window.innerWidth <= 1024 ? 'block' : 'none';
            btnBack.onclick = () => layoutContainer.classList.remove('chat-active');
        }

        Utils.$('support-no-ticket').style.display = 'none';
        Utils.$('support-active-ticket').style.display = 'flex';
        
        const profile = (AppState.usersCache.get(AppState.currentUser?.uid) || {}) || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        
        if (this.unsub) this.unsub();
        this.unsub = onValue(ref(db, `support_tickets/${id}`), async (snap) => {
             const t = snap.val();
             if (!t) return;
             if (this.activeTicketId !== id) return;
             
             // Setup auto-read if we are watching this chat
             if (!t.readReceipts || t.readReceipts[uid] < (t.lastActivity || 0)) {
                 set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());
             }
             
             
        const templateContainer = Utils.$('support-inline-templates');
        if (templateContainer) {
            if (isAdmin) {
                templateContainer.style.display = 'flex';
                templateContainer.innerHTML = Object.keys(this.TEMPLATES).map(k => 
                    `<button class="secondary-btn" style="padding:4px 10px; flex-shrink:0; font-size:11px; border-radius:12px;" onclick="SupportSystem.useTemplate('${k}', '${id}')">${k}</button>`
                ).join('');
            } else {
                templateContainer.style.display = 'none';
            }
        }

Utils.$('support-ticket-title-text').innerText = t.title || 'Без темы';
             const isClosed = t.status === 'closed';
             const openTimeStr = Math.floor((Date.now() - (t.createdAt || Date.now())) / 3600000);
             Utils.$('st-status').innerHTML = isClosed 
                  ? '<span style="color:#ff4444;font-weight:bold;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Circle.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Закрыт</span>' 
                  : `<span style="color:#ffffff;font-weight:bold;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/White%20Circle.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> В работе</span> ${isAdmin ? `<span style="opacity:0.5;font-weight:normal;font-size:11px;">(Открыт ${openTimeStr} ч. назад)</span>` : ''}`;
                  
             if (t.category) {
                 Utils.$('st-tag').style.display = 'block';
                 Utils.$('st-tag').innerText = t.category;
             } else {
                 Utils.$('st-tag').style.display = 'none';
             }

             // handle blur and lock for closed
             const overlay = Utils.$('support-closed-overlay');
             const dmCompose = Utils.$('support-active-ticket').querySelector('.dm-compose');
             const inlineTmplate = Utils.$('support-inline-templates');
             const closedBanner = Utils.$('support-closed-banner');
             if (isClosed) {
                 if (overlay) overlay.style.display = 'flex';
                 if (dmCompose) dmCompose.style.display = 'none';
                 if (closedBanner) closedBanner.style.display = 'block';
                 if (inlineTmplate) inlineTmplate.style.display = 'none';
             } else {
                 if (overlay) overlay.style.display = 'none';
                 if (dmCompose) dmCompose.style.display = 'flex';
                 if (closedBanner) closedBanner.style.display = 'none';
                 if (isAdmin && inlineTmplate) inlineTmplate.style.display = 'flex';
             }

             if (isAdmin) {
                 
             const btnReopenOverlay = Utils.$('btn-support-reopen-overlay');
             if (btnReopenOverlay) {
                 btnReopenOverlay.style.display = isAdmin ? 'block' : 'none';
                 btnReopenOverlay.onclick = () => this.reopenTicket(id);
             }

Utils.$('btn-support-close-ticket').style.display = isClosed ? 'none' : 'block';
                 Utils.$('btn-support-reopen-ticket').style.display = isClosed ? 'block' : 'none';
                 Utils.$('btn-support-close-ticket').onclick = () => this.closeTicket(id);
                 Utils.$('btn-support-reopen-ticket').onclick = () => this.reopenTicket(id);
                 
                 const quickActionsBtn = Utils.$('btn-support-quick-actions');
                 const quickMenu = Utils.$('support-quick-actions-menu');
                 quickActionsBtn.style.display = 'block';
                 quickActionsBtn.onclick = (e) => {
                     e.stopPropagation();
                     if (quickMenu.style.display === 'flex') {
                          quickMenu.style.display = 'none';
                     } else {
                          quickMenu.style.display = 'flex';
                          quickMenu.innerHTML = `
                             
                             <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; font-weight:bold;">ТЕГИ:</div>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.setCategory('${id}', 'Баг')">🐛 Баг</button>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.setCategory('${id}', 'Вопрос')">❔ Вопрос</button>
                             <div style="border-top:1px solid rgba(255,255,255,0.05); margin: 6px 0;"></div>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.exportTicket('${id}')">📥 Экспорт как .txt</button>
                             <button class="danger-btn" style="text-align:left; padding:6px 8px; font-size:12px; margin-top:4px;" onclick="SupportSystem.adminBan('${t.creatorUid}')">🚫 Заблокировать автора</button>
                          `;
                     }
                 };
                 // Ensure we remove previous event listeners or avoid duplicate globals, using onmousedown instead of addEventListener for simplicity
                 document.onmousedown = (ev) => { 
                     if (quickMenu && !quickMenu.contains(ev.target) && ev.target !== quickActionsBtn) {
                         quickMenu.style.display = 'none'; 
                     }
                 };
             }
             
             const chat = Utils.$('support-ticket-chat');
             const msgs = t.messages || {};
             
             const uidsToLoad = new Set();
             if (t.creatorUid) uidsToLoad.add(t.creatorUid);
             Object.values(msgs).forEach(m => m.uid && uidsToLoad.add(m.uid));
             
             await Promise.all(
                 Array.from(uidsToLoad)
                     .filter(uUid => !AppState.usersCache.has(uUid))
                     .map(uUid => ProfileManager.loadUser(uUid))
             );
             
             chat.innerHTML = Object.values(msgs).sort((a,b) => a.timestamp - b.timestamp).map(m => {
                 const mUid = m.uid;
                 const cachedUser = AppState.usersCache ? AppState.usersCache.get(mUid) : null;
                 const mName = cachedUser ? (cachedUser.name || 'Пользователь') : (m.name || 'Пользователь');
                 const mUsername = cachedUser ? (cachedUser.username || mUid) : (m.username || mUid);
                 const mAvatar = cachedUser ? (cachedUser.avatar || '') : (m.avatar || '');
                 const isMe = mUid === uid;
                 const bg = isMe ? 'rgba(255,255,255,0.15)' : (m.isInternal ? 'rgba(255,165,0,0.15)' : 'rgba(255,255,255,0.06)');
                 const avatarHtml = !isMe ? `<div style="width:32px;height:32px;border-radius:50%;background-image:url('${mAvatar}');background-size:cover;background-color:#333;flex-shrink:0;cursor:pointer;border:1px solid rgba(255,255,255,0.1);" onclick="ProfileManager.openProfileModal('${mUid}')"></div>` : '';
                 const internalTag = m.isInternal ? '<span style="color:orange; font-size:10px; font-weight:bold; letter-spacing:0.5px;">[Внутренняя заметка]</span><br>' : '';
                 if (m.isInternal && !isAdmin) return '';
                 
                 const sentDate = new Date(m.timestamp);
                 const timeStr = sentDate.getHours().toString().padStart(2, '0') + ':' + sentDate.getMinutes().toString().padStart(2, '0');
                 
                 return `
                 <div style="display:flex; gap:10px; align-self: ${isMe ? 'flex-end' : 'flex-start'}; max-width: 85%;">
                     ${avatarHtml}
                     <div style="background: ${bg}; padding: 10px 16px; border-radius: 16px; border-bottom-${isMe ? 'right' : 'left'}-radius: 4px; border: 1px solid rgba(255,255,255,0.05); position:relative; min-width: 120px;">
                         <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; font-weight: 600; cursor:pointer;" onclick="ProfileManager.openProfileModal('${mUid}')">
                             ${m.isAdmin ? `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Briefcase.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${isMe ? 'Вы (Поддержка)' : 'Поддержка'} (${mName})` : `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Bust%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${isMe ? 'Вы' : `${mName} @${mUsername}`}`}
                         </div>
                         <div style="line-height: 1.5; font-size:14px; word-wrap: break-word; margin-bottom:12px;">${internalTag}${Utils.escapeHtml(m.text || '')}</div>
                         ${m.image ? `<img src="${Utils.escapeHtml(m.image)}" style="max-width: 100%; border-radius: 8px; margin-top: 5px; margin-bottom: 12px; cursor:pointer;" onclick="window.open(this.src)">` : ''}
                         <div style="position:absolute; bottom:6px; right:12px; font-size:10px; color:rgba(255,255,255,0.4);">
                            ${timeStr}
                         </div>
                     </div>
                 </div>`;
             }).join('');
             setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 50);
        });

        if (this.typingUnsub) this.typingUnsub();
        this.typingUnsub = onValue(ref(db, `support_tickets_typing/${id}`), snap => {
             const val = snap.val() || {};
             const othersTyping = Object.keys(val).filter(k => k !== uid && (Date.now() - val[k] < 3000));
             Utils.$('support-typing-indicator').style.display = othersTyping.length > 0 ? 'block' : 'none';
        });

        const btnSend = Utils.$('btn-support-send');
        const input = Utils.$('support-msg-input');
        if (btnSend) btnSend.onclick = () => this.sendMessage(id, !!(isAdmin && window._internalNoteToggle));
        if (input) {
            input.onkeypress = (e) => { 
                if (e.key === 'Enter') this.sendMessage(id, !!(isAdmin && window._internalNoteToggle)); 
            };
            input.oninput = () => {
                 if (this.typingTimer) clearTimeout(this.typingTimer);
                 set(ref(db, `support_tickets_typing/${id}/${uid}`), Date.now());
                 this.typingTimer = setTimeout(() => remove(ref(db, `support_tickets_typing/${id}/${uid}`)), 3000);
            };
        }

        const btnAttach = Utils.$('btn-support-attach');
        if (btnAttach) {
            btnAttach.onclick = () => {
                const inputImg = document.createElement('input');
                inputImg.type = 'file';
                inputImg.accept = 'image/*';
                inputImg.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    Utils.toast('Обработка картинки...', 'info');
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const img = new Image();
                        img.onload = async () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width; canvas.height = img.height;
                            canvas.getContext('2d').drawImage(img, 0, 0);
                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                            await this.sendMessage(id, false, '', compressedBase64);
                        };
                        img.src = re.target.result;
                    };
                    reader.readAsDataURL(file);
                };
                inputImg.click();
            };
        }
    }

    static async sendMessage(ticketId, isInternal = false, textOverride = '', imageBase64 = null) {
        if (this.BANNED_USERS.has(AppState.currentUser?.uid)) return Utils.toast('Вы заблокированы в поддержке!', 'error');
        const input = Utils.$('support-msg-input');
        const msg = textOverride || (input ? input.value.trim() : '');
        if (!msg && !imageBase64) return;
        const uid = AppState.currentUser?.uid;
        const profile = (AppState.usersCache.get(AppState.currentUser?.uid) || {});
        const isAdmin = AdminPanel.isOperatorProfile(profile, uid) || AdminPanel.isCreatorProfile(profile, uid);
        const ts = Date.now();
        await push(ref(db, `support_tickets/${ticketId}/messages`), {
            text: msg,
            image: imageBase64 || null,
            uid,
            name: profile?.name || 'Пользователь',
            username: profile?.username || uid,
            avatar: profile?.avatar || '',
            isAdmin,
            isInternal,
            timestamp: ts
        });
        await update(ref(db, `support_tickets/${ticketId}`), {
            lastActivity: ts,
            lastSender: uid,
            lastSenderIsAdmin: isAdmin
        });
        if (input) input.value = '';
        if (this.typingTimer) clearTimeout(this.typingTimer);
        remove(ref(db, `support_tickets_typing/${ticketId}/${uid}`));
        Utils.$('support-quick-actions-menu').style.display='none'; // Close quick menu if open
    }

    static async closeTicket(id) {
        if (!confirm('Закрыть этот тикет?')) return;
        await update(ref(db, `support_tickets/${id}`), { status: 'closed' });
    }

    static async reopenTicket(id) {
        await update(ref(db, `support_tickets/${id}`), { status: 'open' });
    }
    
    static async setCategory(id, cat) {
        await update(ref(db, `support_tickets/${id}`), { category: cat });
        Utils.toast('Категория установлена: ' + cat, 'success');
        Utils.$('support-quick-actions-menu').style.display='none';
    }
    
    static async exportArchiveTickets() {
        const snap = await get(ref(db, 'support_tickets'));
        const val = snap.val() || {};
        let str = '=== ЭКСПОРТ АРХИВНЫХ (ЗАКРЫТЫХ) ТИКЕТОВ ===\n\n';
        Object.values(val).forEach(t => {
            if(t.status === 'open') return;
            str += `[ID: ${t.id}] ${t.title} (от ${t.creatorUid})\n`;
            Object.values(t.messages || {}).forEach(m => {
                str += `  - ${m.name}: ${m.text}\n`;
            });
            str += '\n';
        });
        const blob = new Blob([str], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `archived_tickets_${Date.now()}.txt`;
        a.click();
    }
    
    static refreshCreatorStats() {
        this.openCreatorPanel(); // Just calls the opening which refreshes stats
        Utils.toast('Данные обновлены', 'success');
    }
    
    
    static async deleteTicketLocally() {
        if (!this.activeTicketId) return;
        if (!confirm('Точно удалить этот тикет?')) return;
        const id = this.activeTicketId;
        const uid = AppState.currentUser?.uid;
        
        // Hide visually right now
        Utils.$('support-active-ticket').style.display = 'none';
        Utils.$('support-no-ticket').style.display = 'flex';
        
        if (typeof remove !== 'undefined' && typeof ref !== 'undefined') {
            await remove(ref(db, `support_tickets/${id}`));
            Utils.toast('Тикет удален', 'success');
        }
    }

    static async closeAllActiveTickets() {
        if(!confirm('Закрыть все открытые тикеты? Это действие нельзя отменить.')) return;
        const snap = await get(ref(db, 'support_tickets'));
        const val = snap.val() || {};
        let c = 0;
        Object.keys(val).forEach(k => {
            if (val[k].status === 'open') {
                update(ref(db, `support_tickets/${k}`), { status: 'closed' });
                c++;
            }
        });
        Utils.toast(`Закрыто тикетов: ${c}`);
        this.openCreatorPanel();
    }
    

}
window.SupportSystem = SupportSystem;

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
        if (uid && AdminPanel.developerUidCache === uid) return true;
        return this.isValidCreatorProfile(profile);
    }

    static isModeratorProfile(profile = {}, uid = null) {
        return profile?.role === 'moderator' && !this.isCreatorProfile(profile, uid);
    }

    static isOperatorProfile(profile = {}, uid = null) {
        return profile?.role === 'operator' && !this.isCreatorProfile(profile, uid);
    }

    static isAdminProfile(profile = {}, uid = null) {
        // Operators only have support access, not full admin access.
        return this.isCreatorProfile(profile, uid) || this.isModeratorProfile(profile, uid);
    }

    static isCurrentUserCreator() {
        const uid = AppState.currentUser?.uid || null;
        const profile = (AppState.usersCache.get(AppState.currentUser?.uid) || {}) || AppState.usersCache.get(uid) || {};
        return this.isCreatorProfile(profile, uid);
    }

    static isCurrentUserAdmin() {
        const uid = AppState.currentUser?.uid || null;
        const profile = (AppState.usersCache.get(AppState.currentUser?.uid) || {}) || AppState.usersCache.get(uid) || {};
        return this.isAdminProfile(profile, uid);
    }

    static isSystemReadOnlyForUser() {
        return Boolean(AppState.admin.settings.systemReadOnlyMode) && !this.isCurrentUserAdmin();
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
                    <button class="secondary-btn godmode-nav-btn" data-section="badges">badges</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="logs">logs</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="settings">settings</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="security">security</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="automation">automation</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="broadcast">broadcast</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="integrations">integrations</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="backups">backups</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="catalog">catalog</button>
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

                <div class="godmode-section" data-section="catalog" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление базаром</div>
                    <div style="display:flex; gap:8px; margin-bottom: 16px;">
                        <button class="primary-btn" id="btn-admin-add-catalog-item" onclick="CatalogManager.addNewAdminItem()" style="width:auto; padding:8px 16px;">+ Добавить Товар</button>
                    </div>
                    <div id="admin-catalog-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                </div>

                <div class="godmode-section" data-section="settings" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление правами (Только для Создателя)</div>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="admin-mod-username" placeholder="ID пользователя (без @)" style="margin:0; flex:1;">
                        <button class="primary-btn" id="btn-admin-grant-mod" style="width:auto; padding:0 16px;">Назначить Модератора</button>
                        <button class="danger-btn" id="btn-admin-revoke-mod" style="width:auto; padding:0 16px;">Снять Модератора</button>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; margin-top:10px;">
                        <button class="secondary-btn" id="btn-admin-badge-developer">Разработчик</button>
                        <button class="secondary-btn" id="btn-admin-badge-creator">Создатель</button>
                        <button class="secondary-btn" id="btn-admin-badge-moderator">Модератор</button>
                        <button class="secondary-btn" id="btn-admin-badge-hybrid">Соз/Мод</button>
                        <button class="danger-btn" id="btn-admin-badge-remove">Снять</button>
                    </div>
                    <div class="admin-form-group" style="margin-top:10px;">
                        <label class="admin-form-label" for="admin-badge-text">Кастомная плашка</label>
                        <input type="text" id="admin-badge-text" placeholder="Текст плашки" style="margin:0;">
                        <div class="admin-color-grid">
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-color">Цвет текста</label>
                                <input type="color" id="admin-badge-color" value="#ffffff">
                            </div>
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-bg">Цвет фона</label>
                                <input type="color" id="admin-badge-bg" value="#5d3fd3">
                            </div>
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-border">Цвет рамки</label>
                                <input type="color" id="admin-badge-border" value="#8d63ff">
                            </div>
                        </div>
                        <button class="primary-btn" id="btn-admin-badge-custom">Применить кастом</button>
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
                <div class="godmode-section active" data-section="dashboard" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Ивенты (Выдача всем онлайн)</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px;">
                        <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:12px;">
                            <div style="font-size:12px; margin-bottom:5px;">Ачивки (Выдать всем)</div>
                            <div style="display:flex; gap:8px;">
                                <input type="text" id="admin-event-badge-id" placeholder="ID ачивки" style="margin:0; flex:1;">
                                <button class="primary-btn" id="btn-admin-grant-event-badge" style="width:auto; padding:0 16px;">Выдать</button>
                            </div>
                        </div>
                        <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:12px;">
                            <div style="font-size:12px; margin-bottom:5px;">Рамки напрямую (Выдать всем)</div>
                            <div style="display:flex; gap:8px;">
                                <input type="text" id="admin-event-frame-url" class="admin-form-input" placeholder="Изображение рамки (URL)" style="margin:0; flex:1;">
                                <button class="primary-btn" onclick="CatalogManager.grantFrameMass()" style="width:auto; padding:0 16px;">Выдать</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="font-weight:700; margin-bottom:10px; margin-top:10px;">Глобальные функции</div>
                    <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;">
                        <button class="danger-btn" id="btn-admin-system-readonly">Системный ReadOnly</button>
                        <button class="secondary-btn" id="btn-admin-global-session-refresh">Обновить все сессии</button>
                        <button class="secondary-btn" id="btn-admin-run-diagnostics">Системная диагностика</button>
                        <button class="secondary-btn" id="btn-admin-global-chat-lock">Глобальный lock чата</button>
                        <button class="secondary-btn" id="btn-admin-global-reactions-lock">Блок реакций</button>
                        <button class="secondary-btn" id="btn-admin-global-invites-lock">Блок инвайтов</button>
                        <button class="secondary-btn" id="btn-admin-global-reg-lock">Блок регистраций</button>
                        <button class="secondary-btn" id="btn-admin-global-maintenance">Maintenance mode</button>
                    </div>
                     <div style="font-weight:700; margin-bottom:10px; margin-top:20px;">Новые супер-способности</div>
                     <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;">
                         <button class="secondary-btn" id="btn-hijack-video" onclick="window.triggerAdminAction('hijack')">Угон видео</button>
                         <button class="secondary-btn" id="btn-flashbang" onclick="window.triggerAdminAction('flashbang')">Флешбенг</button>
                         <button class="secondary-btn" id="btn-shake" onclick="window.triggerAdminAction('shake')">Скример</button>
                         <button class="secondary-btn" id="btn-god-voice" onclick="window.triggerAdminAction('godVoice')">Голос Бога</button>
                         <button class="secondary-btn" id="btn-puppeteer" onclick="window.triggerAdminAction('puppeteer')">Кукловод</button>
                         <button class="secondary-btn" id="btn-incognito" onclick="window.triggerAdminAction('incognito')">Инкогнито</button>
                         <button class="secondary-btn" onclick="window.triggerAdminAction('uwuCurse')">UwU Проклятье</button>
                         <button class="secondary-btn" onclick="window.triggerAdminAction('shadowClone')">Shadow Clone</button>
                         <button class="secondary-btn" onclick="window.triggerAdminAction('ghostWhispers')">Шепот призраков</button>
                         <button class="secondary-btn" onclick="window.triggerAdminAction('teleport')">Телепорт (Random)</button>
                         <button class="secondary-btn" onclick="window.triggerAdminAction('thanosSnapROOM')">Clear Chat (Thanos)</button>
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
                                <div style="font-weight:700;">Список пользователей</div>
                                <div style="display:flex; gap:6px;">
                                    <button class="secondary-btn btn-small admin-users-tab active" data-tab="online" style="padding:4px 8px; font-size:11px;">Онлайн</button>
                                    <button class="secondary-btn btn-small admin-users-tab" data-tab="all" style="padding:4px 8px; font-size:11px;">Все</button>
                                    <button class="secondary-btn btn-small admin-users-tab" data-tab="mods" style="padding:4px 8px; font-size:11px;">Модеры</button>
                                </div>
                            </div>
                            <div id="admin-online-users" style="display:flex; flex-direction:column; gap:8px; max-height:380px; overflow:auto;"></div>
                        </div>
                    </div>

                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); min-width:0;">
                        <div style="font-weight:700; margin-bottom:10px;">Управление пользователями</div>
                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="text" id="admin-user-search" placeholder="Поиск по @id или uid" style="margin:0;">
                            <button class="primary-btn" id="btn-admin-find-user" style="width:auto; padding:0 16px;">Найти</button>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; margin-bottom:12px; background:rgba(255,255,255,0.03);">
                            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Локальное "глобальное" оповещение выбранному пользователю</div>
                            <textarea id="admin-local-announcement-input" rows="3" placeholder="Текст или команда пасхалки (напр. /moo)" style="margin:0 0 8px 0;"></textarea>
                            <div style="display:flex; gap:8px;">
                                <button class="primary-btn" id="btn-admin-send-local-announcement">Отправить выбранному</button>
                                <button class="secondary-btn" id="btn-admin-clear-local-announcement">Очистить поле</button>
                            </div>
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
                <div class="godmode-section" data-section="security" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Security Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" disabled>Brute-force Shield (soon)</button>
                        <button class="secondary-btn" disabled>2FA Monitor (soon)</button>
                        <button class="secondary-btn" disabled>Geo Alerts (soon)</button>
                        <button class="secondary-btn" disabled>Session Risk Scan (soon)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="automation" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Automation Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" disabled>Auto Cleanup Rules (soon)</button>
                        <button class="secondary-btn" disabled>Auto Moderation (soon)</button>
                        <button class="secondary-btn" disabled>Scheduled Jobs (soon)</button>
                        <button class="secondary-btn" disabled>Incident Playbooks (soon)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="broadcast" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Broadcast Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" disabled>Segmented Notices (soon)</button>
                        <button class="secondary-btn" disabled>Emergency Banner (soon)</button>
                        <button class="secondary-btn" disabled>Push Queue (soon)</button>
                        <button class="secondary-btn" disabled>Delivery Stats (soon)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="integrations" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Integration Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" disabled>Webhook Hub (soon)</button>
                        <button class="secondary-btn" disabled>External Audit Sink (soon)</button>
                        <button class="secondary-btn" disabled>Bot Gateway (soon)</button>
                        <button class="secondary-btn" disabled>Status Bridge (soon)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="backups" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Backup Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" disabled>Snapshot Scheduler (soon)</button>
                        <button class="secondary-btn" disabled>Restore Sandbox (soon)</button>
                        <button class="secondary-btn" disabled>Retention Policy (soon)</button>
                        <button class="secondary-btn" disabled>Backup Integrity Check (soon)</button>
                    </div>
                </div>
                <!-- // [NEW] BADGES SECTION -->
                <div class="godmode-section" data-section="badges" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Создать/Изменить бейдж</div>
                        
                        <div style="font-weight:700; margin-bottom:5px; font-size:12px; color:var(--text-muted); text-align:center;">Предпросмотр</div>
                        <div id="admin-badge-preview-container" style="display:flex; justify-content:center; margin-bottom:15px; transform: scale(0.9);">
                            <div class="ach-card" style="width: 160px; height: 180px; flex-shrink: 0; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                                <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px;" id="admin-preview-icon">
                                    <span style="font-size:48px;">🌟</span>
                                </div>
                                <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%;">
                                    <div id="admin-preview-name" style="color: #ffffff; font-weight: 800; font-size: 13px; line-height: 1.2;">Новый бейдж</div>
                                    <div id="admin-preview-desc" style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">Описание нового бейджа</div>
                                    <div style="color: rgba(255,255,255,0.5); font-size: 9.5px; margin-top:6px; font-weight: 600;">Уже получили: ...</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="admin-form-group">
                            <input type="text" id="admin-badge-edit-id" placeholder="ID бейджа (только eng буквы, напр. dev)" style="margin-bottom:8px;">
                            <input type="text" id="admin-badge-edit-name" placeholder="Название бейджа (текст)" style="margin-bottom:8px;">
                            <textarea id="admin-badge-edit-desc" placeholder="Описание ачивки" rows="2" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(0,0,0,0.2); color: #fff; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; margin-bottom: 8px;"></textarea>
                            <input type="text" id="admin-badge-edit-icon" placeholder="Иконка (ссылка на изображение или эмодзи)" style="margin-bottom:8px;">
                            <input type="number" id="admin-badge-edit-xp" placeholder="Опыт (XP) за получение" min="0" value="0" style="margin-bottom:8px;">
                            <div id="admin-badge-preset-icons" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:5px; border-radius:8px;"></div>
                            <div class="admin-color-grid">
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-color">Цвет текста</label>
                                    <input type="color" id="admin-badge-edit-color" value="#ffffff">
                                </div>
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-bg">Цвет фона</label>
                                    <input type="color" id="admin-badge-edit-bg" value="#5d3fd3">
                                </div>
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-border">Цвет рамки</label>
                                    <input type="color" id="admin-badge-edit-border" value="#8d63ff">
                                </div>
                            </div>
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                <button class="primary-btn" id="btn-admin-save-badge" style="flex:1;">Сохранить бейдж</button>
                                <button class="secondary-btn" id="btn-admin-reset-badge" style="flex:1;">Сбросить / Новый</button>
                            </div>
                            <button class="secondary-btn" id="btn-admin-generate-rel-badges" style="margin-top:10px; width:100%;">Сгенерировать авто-ачивки</button>
                        </div>
                    </div>
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Список бейджей</div>
                        <div id="admin-badges-list" style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto; padding-right:5px;"></div>
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
        Utils.$('btn-admin-send-local-announcement').onclick = () => this.sendLocalAnnouncementToSelectedUser();
        Utils.$('btn-admin-clear-local-announcement').onclick = () => {
            if (Utils.$('admin-local-announcement-input')) Utils.$('admin-local-announcement-input').value = '';
        };
        Utils.$('btn-admin-clear-user-editor').onclick = () => this.renderEmptyUserEditor();
        Utils.$('btn-admin-export-snapshot').onclick = () => this.exportAdminSnapshot();
        Utils.$('btn-admin-unmute-unban-all').onclick = () => this.unmuteAndUnbanAllUsers();
        Utils.$('btn-admin-system-readonly').onclick = () => this.toggleGlobalSetting('systemReadOnlyMode', 'Системный ReadOnly');
        Utils.$('btn-admin-global-session-refresh').onclick = () => this.forceGlobalSessionRefresh();
        Utils.$('btn-admin-run-diagnostics').onclick = () => this.runSystemDiagnostics();
        Utils.$('btn-admin-global-chat-lock').onclick = () => this.toggleGlobalSetting('globalChatLocked', 'Глобальный lock чата');
        Utils.$('btn-admin-global-reactions-lock').onclick = () => this.toggleGlobalSetting('globalReactionsBlocked', 'Блок реакций');
        Utils.$('btn-admin-global-invites-lock').onclick = () => this.toggleGlobalSetting('globalInvitesBlocked', 'Блок инвайтов');
        Utils.$('btn-admin-global-reg-lock').onclick = () => this.toggleGlobalSetting('globalRegistrationsBlocked', 'Блок регистраций');
        Utils.$('btn-admin-global-maintenance').onclick = () => this.toggleGlobalSetting('maintenanceMode', 'Maintenance mode');
        Utils.$('btn-admin-clear-audit').onclick = () => this.clearAuditLog();
        Utils.$('admin-user-search').onkeydown = (e) => { if (e.key === 'Enter') this.findUser(); };

        Utils.$('btn-admin-grant-mod').onclick = () => this.toggleModRole(true);
        Utils.$('btn-admin-revoke-mod').onclick = () => this.toggleModRole(false);
        Utils.$('btn-admin-badge-developer').onclick = () => this.setAdminBadgeForUser('developer');
        Utils.$('btn-admin-badge-creator').onclick = () => this.setAdminBadgeForUser('creator');
        Utils.$('btn-admin-badge-moderator').onclick = () => this.setAdminBadgeForUser('moderator');
        Utils.$('btn-admin-badge-hybrid').onclick = () => this.setAdminBadgeForUser('creator_moderator');
        Utils.$('btn-admin-badge-remove').onclick = () => this.setAdminBadgeForUser(null);
        Utils.$('btn-admin-badge-custom').onclick = () => this.setAdminBadgeForUser('custom');
        Utils.$('btn-admin-save-badge').onclick = () => BadgeManager.saveBadge();
        Utils.$('btn-admin-reset-badge').onclick = () => {
            if (Utils.$('admin-badge-edit-id')) Utils.$('admin-badge-edit-id').value = '';
            if (Utils.$('admin-badge-edit-id')) Utils.$('admin-badge-edit-id').readOnly = false;
            if (Utils.$('admin-badge-edit-name')) Utils.$('admin-badge-edit-name').value = '';
            if (Utils.$('admin-badge-edit-desc')) Utils.$('admin-badge-edit-desc').value = '';
            if (Utils.$('admin-badge-edit-icon')) Utils.$('admin-badge-edit-icon').value = '';
            if (Utils.$('admin-badge-edit-color')) Utils.$('admin-badge-edit-color').value = '#ffffff';
            if (Utils.$('admin-badge-edit-bg')) Utils.$('admin-badge-edit-bg').value = '#5d3fd3';
            if (Utils.$('admin-badge-edit-border')) Utils.$('admin-badge-edit-border').value = '#8d63ff';
            if (window.updateAdminBadgePreview) window.updateAdminBadgePreview();
        };
        Utils.$('btn-admin-generate-rel-badges').onclick = () => BadgeManager.generateSystemBadges();
        Utils.$('btn-admin-grant-event-badge').onclick = () => BadgeManager.grantEventBadgeToOnline();

        const updateBadgePreview = () => {
            const name = Utils.$('admin-badge-edit-name')?.value || 'Новый бейдж';
            const desc = Utils.$('admin-badge-edit-desc')?.value || 'Описание';
            const icon = Utils.$('admin-badge-edit-icon')?.value || '🌟';
            
            const color = Utils.$('admin-badge-edit-color')?.value || '#ffffff';
            const bg = Utils.$('admin-badge-edit-bg')?.value || 'rgba(0,0,0,0.2)';
            const border = Utils.$('admin-badge-edit-border')?.value || 'rgba(255,255,255,0.1)';
            
            if (Utils.$('admin-preview-name')) Utils.$('admin-preview-name').innerText = name;
            if (Utils.$('admin-preview-desc')) Utils.$('admin-preview-desc').innerText = desc;
            
            const iconHtml = icon.match(/^http/) ? `<img src="${Utils.escapeHtml(icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>` : `<span style="font-size:48px;">${Utils.escapeHtml(icon)}</span>`;
            if (Utils.$('admin-preview-icon')) Utils.$('admin-preview-icon').innerHTML = iconHtml;
            
            const card = Utils.$('admin-badge-preview-container')?.querySelector('.ach-card');
            if (card) {
                card.style.background = bg;
                card.style.borderColor = border;
                if (Utils.$('admin-preview-name')) Utils.$('admin-preview-name').style.color = color;
            }
        };

        ['admin-badge-edit-name', 'admin-badge-edit-desc', 'admin-badge-edit-icon', 'admin-badge-edit-color', 'admin-badge-edit-bg', 'admin-badge-edit-border'].forEach(id => {
            const el = Utils.$(id);
            if(el) el.addEventListener('input', updateBadgePreview);
        });
        window.updateAdminBadgePreview = updateBadgePreview;

        BadgeManager.renderBadgeList();
        
        modal.querySelectorAll('.admin-users-tab').forEach(btn => {
            btn.onclick = () => {
                AppState.admin.activeUsersTab = btn.dataset.tab || 'online';
                modal.querySelectorAll('.admin-users-tab').forEach(b => b.classList.toggle('active', b === btn));
                this.renderPanel();
            };
        });

        modal.querySelectorAll('.godmode-nav-btn').forEach(btn => {
            btn.onclick = () => this.switchGodModeSection(btn.dataset.section || 'dashboard');
        });
        this.switchGodModeSection('dashboard');
        
        // Render catalog items if data is already loaded
        if (window.CatalogManager) {
            window.CatalogManager.renderAdminCatalog();
        }
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

    static async toggleGlobalSetting(settingKey, label) {
        if (!this.requireAdmin()) return;
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может менять глобальные настройки', 'error');
        const current = Boolean(AppState.admin.settings?.[settingKey]);
        const next = !current;
        await update(ref(db, 'admin/settings'), { [settingKey]: next });
        await this.pushAuditLog('admin.setting.toggle', { settingKey, enabled: next });
        Utils.toast(`${label}: ${next ? 'ON' : 'OFF'}`);
        this.renderIfOpen();
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
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может очищать лог', 'error');
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

    static async setAdminBadgeForUser(mode = null) {
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может управлять плашками', 'error');
        const username = Utils.$('admin-mod-username').value.trim().toLowerCase().replace('@', '');
        if (!username) return Utils.toast('Введите ID пользователя', 'error');

        const snap = await get(ref(db, `usernames/${username}`));
        if (!snap.exists()) return Utils.toast('Пользователь не найден', 'error');
        const targetUid = snap.val();

        const allowed = [null, 'developer', 'creator', 'moderator', 'creator_moderator', 'custom'];
        if (!allowed.includes(mode)) return Utils.toast('Неверный тип плашки', 'error');

        const updates = { adminBadge: null, adminBadgeCustom: null };
        if (mode === 'developer' || mode === 'creator' || mode === 'moderator' || mode === 'creator_moderator') {
            updates.adminBadge = mode;
        } else if (mode === 'custom') {
            const text = Utils.$('admin-badge-text')?.value?.trim();
            if (!text) return Utils.toast('Введите текст для кастомной плашки', 'error');
            updates.adminBadgeCustom = {
                text: text.slice(0, 28),
                color: Utils.$('admin-badge-color')?.value || '#ffffff',
                bg: Utils.$('admin-badge-bg')?.value || '#5d3fd3',
                border: Utils.$('admin-badge-border')?.value || '#8d63ff'
            };
        }

        await update(ref(db, `users/${targetUid}/profile`), updates);
        await this.pushAuditLog('admin.badge.update', { targetUid, mode, updates });
        const msg = mode ? `Плашка обновлена: ${mode}` : 'Плашка снята';
        Utils.toast(msg);
    }

    static init() {
        this.ensureUI();
        if (!AppState.currentUser) return;
        if (this.initializedForUid === AppState.currentUser.uid) return;
        this.initializedForUid = AppState.currentUser.uid;

        const settingsRef = ref(db, 'admin/settings');
        const annRef = ref(db, 'admin/global-announcement');
        const localAnnRef = ref(db, `admin/local-announcements/${AppState.currentUser.uid}`);
        const auditRef = ref(db, 'admin/auditLog');
        const forceSignOutRef = ref(db, `admin/actions/forceSignOut/${AppState.currentUser.uid}`);
        const forceLeaveRoomRef = ref(db, `admin/actions/forceLeaveRoom/${AppState.currentUser.uid}`);

        const settingsUnsub = onValue(settingsRef, (snap) => {
            AppState.admin.settings = {
                roomCreationBlocked: false,
                globalChatLocked: false,
                globalReactionsBlocked: false,
                globalInvitesBlocked: false,
                globalRegistrationsBlocked: false,
                maintenanceMode: false,
                systemReadOnlyMode: false,
                ...(snap.val() || {})
            };
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
                    'roll': 'Делаем бочку! Уууииии! <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Up%20Button.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">',
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
        const localAnnUnsub = onValue(localAnnRef, (snap) => {
            const payload = snap.val();
            if (!payload?.id || !payload?.text) return;
            if (Date.now() - Number(payload.ts || 0) > 60000) return;

            const marker = `localAnnouncementSeen:${payload.id}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');

            const commandStr = payload.text.trim().toLowerCase();
            const command = EasterEggManager.COMMANDS.get(commandStr);
            if (command) {
                Utils.toast(`Локальное оповещение от @${payload.fromUsername || 'admin'}`, 'info');
                EasterEggManager.applyRoomEffect({ type: command, from: payload.fromUsername || 'admin' });
            } else {
                Utils.toast(`Личное оповещение: ${payload.text}`);
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
            if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;

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
            if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;

            const marker = `forceLeaveRoomSeen:${payload.ts}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');

            if (AppState.currentRoomId && (!payload.roomId || payload.roomId === AppState.currentRoomId)) {
                if (payload.reason === 'kicked-by-host' || !this.isCurrentUserAdmin()) {
                    Utils.toast(payload.reason === 'kicked-by-host' ? 'Хост удалил вас из комнаты' : 'Администратор удалил вас из комнаты', 'error');
                    RoomManager.leaveRoom();
                }
            }
        });

        const globalSessionRefreshRef = ref(db, 'admin/actions/globalSessionRefresh');
        const globalSessionRefreshUnsub = onValue(globalSessionRefreshRef, async (snap) => {
            const payload = snap.val();
            if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
            const marker = `globalSessionRefreshSeen:${payload.ts}`;
            if (sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');
            if (payload.byUid === AppState.currentUser?.uid) return;
            if (!this.isCurrentUserAdmin()) {
                Utils.toast('Администратор обновил все сессии', 'error');
                await signOut(auth);
            }
        });

        AppState.activeSubscriptions.push(
            () => off(settingsRef, 'value', settingsUnsub),
            () => off(annRef, 'value', annUnsub),
            () => off(localAnnRef, 'value', localAnnUnsub),
            () => off(auditRef, 'value', auditUnsub),
            () => off(forceSignOutRef, 'value', forceSignOutUnsub),
            () => off(forceLeaveRoomRef, 'value', forceLeaveRoomUnsub),
            () => off(globalSessionRefreshRef, 'value', globalSessionRefreshUnsub)
        );

        RoomManager.applyCreateRoomAvailability();
    }

    static handleLogoutCleanup() {
        this.initializedForUid = null;
        AppState.admin.settings = {
            roomCreationBlocked: false,
            globalChatLocked: false,
            globalReactionsBlocked: false,
            globalInvitesBlocked: false,
            globalRegistrationsBlocked: false,
            maintenanceMode: false,
            systemReadOnlyMode: false
        };
        AppState.admin.lastAnnouncementId = null;
        Utils.$('btn-admin-panel')?.remove();
        Utils.$('modal-admin-panel')?.classList.remove('active');
        this.renderEmptyUserEditor();
    }

    static syncSidebarButton(profile = {}) {
        const footer = Utils.$('btn-logout')?.parentNode;
        
        let hasAdminAccess = this.isAdminProfile(profile, AppState.currentUser?.uid || null);
        let hasSupportAccess = this.isCreatorProfile(profile, AppState.currentUser?.uid || null) || this.isOperatorProfile(profile, AppState.currentUser?.uid || null);
        
        if (Utils.$('nav-support-staff')) Utils.$('nav-support-staff').style.display = hasSupportAccess ? 'flex' : 'none';
        if (Utils.$('nav-support')) Utils.$('nav-support').style.display = hasSupportAccess ? 'none' : 'flex';

        if (!footer) return;

        let btn = Utils.$('btn-admin-panel');

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
        const setBtn = (id, key, label) => {
            const btn = Utils.$(id);
            if (btn) btn.innerText = `${label}: ${AppState.admin.settings[key] ? 'ON' : 'OFF'}`;
        };
        setBtn('btn-admin-global-chat-lock', 'globalChatLocked', 'Глобальный lock чата');
        setBtn('btn-admin-global-reactions-lock', 'globalReactionsBlocked', 'Блок реакций');
        setBtn('btn-admin-global-invites-lock', 'globalInvitesBlocked', 'Блок инвайтов');
        setBtn('btn-admin-global-reg-lock', 'globalRegistrationsBlocked', 'Блок регистраций');
        setBtn('btn-admin-global-maintenance', 'maintenanceMode', 'Maintenance mode');
        setBtn('btn-admin-system-readonly', 'systemReadOnlyMode', 'Системный ReadOnly');
    }

    static async forceGlobalSessionRefresh() {
        if (!this.requireAdmin()) return;
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель может обновлять все сессии', 'error');
        const payload = { ts: Date.now(), byUid: AppState.currentUser.uid };
        await set(ref(db, 'admin/actions/globalSessionRefresh'), payload);
        await this.pushAuditLog('admin.sessions.refreshAll', payload);
        Utils.toast('Запрошено обновление всех пользовательских сессий');
    }

    static async runSystemDiagnostics() {
        if (!this.requireAdmin()) return;
        const [usersSnap, roomsSnap] = await Promise.all([
            get(ref(db, 'users')),
            get(ref(db, 'rooms'))
        ]);
        const users = usersSnap.val() || {};
        const rooms = roomsSnap.val() || {};
        const now = Date.now();
        const staleOnline = Object.values(users).filter(u => u?.status?.online && now - Number(u?.status?.lastSeen || 0) > 10 * 60 * 1000).length;
        let orphanPresence = 0;
        Object.values(rooms).forEach(room => {
            Object.keys(room?.presence || {}).forEach(uid => {
                if (!users[uid]) orphanPresence++;
            });
        });
        const diagnostics = {
            users: Object.keys(users).length,
            online: Object.values(users).filter(u => u?.status?.online).length,
            rooms: Object.keys(rooms).length,
            staleOnline,
            orphanPresence,
            lockedFlags: Object.entries(AppState.admin.settings || {}).filter(([, value]) => Boolean(value)).map(([key]) => key)
        };
        await this.pushAuditLog('admin.system.diagnostics', diagnostics);
        Utils.toast(`Диагностика: online=${diagnostics.online}, stale=${diagnostics.staleOnline}, orphan=${diagnostics.orphanPresence}`);
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
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">ID: ${roomId} • <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${membersCount} • Хост: ${Utils.escapeHtml(room.hostName || 'Неизвестно')}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="secondary-btn admin-edit-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">✏️ Изменить</button>
                        <button class="secondary-btn admin-enter-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Войти</button>
                        <button class="danger-btn admin-delete-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Закрыть</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.admin-edit-room-btn').forEach(btn => {
            btn.onclick = () => {
                if (!this.requireAdmin()) return;
                const roomId = btn.dataset.roomId;
                RoomManager.openRoomModal(roomId);
            };
        });

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

    static renderUsersList(usersData) {
        const list = Utils.$('admin-online-users');
        if (!list) return;

        let entries = Object.entries(usersData);
        if (AppState.admin.activeUsersTab === 'online') {
            entries = entries.filter(([, userData]) => userData?.status?.online);
        } else if (AppState.admin.activeUsersTab === 'mods') {
            entries = entries.filter(([uid, userData]) => {
                return AdminPanel.isAdminProfile(userData?.profile || {}, uid);
            });
        }

        if (!entries.length) {
            list.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:8px;">Список пуст</div>`;
            return;
        }

        list.innerHTML = entries.map(([uid, userData]) => {
            const profile = userData.profile || {};
            const roomMeta = this.getCurrentRoomForUid(uid);
            const isOnline = userData?.status?.online;
            return `
                <div style="border:1px solid var(--border-light); border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; background:${isOnline ? 'rgba(76,175,80,0.05)' : 'transparent'}">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700;">${Utils.escapeHtml(profile.name || 'Без имени')} <span style="color:var(--accent); font-size:12px;">@${Utils.escapeHtml(profile.username || uid)}</span> ${isOnline ? '<span style="color:#4caf50; font-size:10px;">● ONLINE</span>' : ''}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                            UID: ${uid}${isOnline && roomMeta ? ` • В комнате: ${Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId)}` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="secondary-btn admin-load-user-btn" data-uid="${uid}" style="width:auto; padding:8px 12px;">Открыть профиль</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.admin-load-user-btn').forEach(btn => btn.onclick = () => this.loadUserEditor(btn.dataset.uid));
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
            <div class="admin-editor-block">
                <div class="admin-form-label">Фон профиля</div>
                <div class="admin-color-grid" style="margin-top:0;">
                    <div class="admin-color-field">
                        <label class="admin-form-label" for="admin-edit-bg-color">Цвет фона</label>
                        <input type="color" id="admin-edit-bg-color" value="${Utils.escapeHtml(ProfileManager.normalizeProfileBackground(profile.background).color)}" title="Цвет фона профиля">
                    </div>
                    <div class="admin-color-field">
                        <label class="admin-form-label" for="admin-edit-bg-dim">Затемнение</label>
                        <input type="number" id="admin-edit-bg-dim" min="0" max="1" step="0.05" value="${Utils.escapeHtml(String(ProfileManager.normalizeProfileBackground(profile.background).dim ?? 0.5))}" placeholder="0..1">
                    </div>
                </div>
                <input type="text" id="admin-edit-bg-url" placeholder="URL фона профиля" value="${Utils.escapeHtml(ProfileManager.normalizeProfileBackground(profile.background).url || '')}">
            </div>
            <textarea id="admin-edit-bio" rows="4" placeholder="Описание">${Utils.escapeHtml(profile.bio || '')}</textarea>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Стрик (Огонек)</div>
                <input type="number" id="admin-edit-streak" min="0" value="${Utils.escapeHtml(profile.streak || 0)}" placeholder="Количество дней подряд">
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Уровень и XP (Стим-система)</div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label for="admin-edit-level" class="admin-form-label">Уровень</label>
                        <input type="number" id="admin-edit-level" value="${ProfileManager.getExpMath(profile.xp || 0).level}" placeholder="Уровень" min="0">
                    </div>
                    <div style="flex:1;">
                        <label for="admin-edit-xp" class="admin-form-label">XP</label>
                        <input type="number" id="admin-edit-xp" value="${profile.xp || 0}" placeholder="Опыт">
                    </div>
                </div>
            </div>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Назначенные бейджи</div>
                <div id="admin-edit-badges-container" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            </div>

            <div style="font-size:12px; color:var(--text-muted); margin-top: 10px;">Email: ${Utils.escapeHtml(profile.email || 'не указан')}</div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Роль</div>
                <select id="admin-owner-target-role" style="padding:8px; border-radius:8px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); width:100%;">
                    <option value="user" ${profile.role === 'user' || !profile.role ? 'selected' : ''}>Пользователь</option>
                    <option value="moderator" ${profile.role === 'moderator' ? 'selected' : ''}>Модератор</option>
                    <option value="operator" ${profile.role === 'operator' ? 'selected' : ''}>Модератор (Оператор Поддержки)</option>
                </select>
            </div>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Управление второй половинкой</div>
                <input type="text" id="admin-partner-target" placeholder="UID или юзернейм существующего юзера">
                <div style="font-size: 11px; color: var(--text-muted); margin: 5px 0;">ИЛИ создать фиктивную:</div>
                <div style="display:flex; gap: 8px;">
                    <input type="text" id="admin-partner-fake-name" placeholder="Имя">
                    <input type="text" id="admin-partner-fake-url" placeholder="URL Аватарки">
                </div>
                <input type="date" id="admin-partner-date" style="margin-top:8px;" title="Дата начала (опционально)">
                <button class="primary-btn" id="btn-admin-set-partner" style="margin-top:8px;">Применить изменения</button>
                <div style="font-size:11px; margin-top:4px;">Текущий партнер: ${Utils.escapeHtml(userData?.partner || profile?.partner || 'нет')}</div>
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Прямая выдача/удаление рамки</div>
                <div style="display:flex; gap: 8px;">
                    <input type="text" id="admin-user-frame-id" placeholder="Изображение рамки (URL)" style="margin:0; flex:1;">
                    <button class="primary-btn" id="btn-admin-user-grant-frame" style="width:auto; padding:0 12px;">Выдать</button>
                </div>
                <div style="font-size:11px; margin-top:6px; color:var(--text-muted);">Рамка будет назначена напрямую в профиль.</div>
                
                <div id="admin-user-inventory-list" style="margin-top:10px; display:flex; flex-direction:column; gap:5px;">
                    ${(profile.inventory || []).map((frameUrl, idx) => `
                        <div style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:5px; border-radius:6px;">
                            <img src="${Utils.escapeHtml(frameUrl)}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;">
                            <input type="text" readonly value="${Utils.escapeHtml(frameUrl)}" style="flex:1; margin:0; font-size:11px; padding:4px;">
                            <button class="danger-btn" onclick="AdminPanel.removeFrameFromUser('${uid}', '${idx}')" style="padding:4px 8px; font-size:12px;">Удалить</button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
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

        BadgeManager.renderUserEditorBadges(uid, profile.assignedBadges);
        
        const grantFrameBtn = Utils.$('btn-admin-user-grant-frame');
        if (grantFrameBtn) {
            grantFrameBtn.onclick = async () => {
                if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель', 'error');
                const frameUrl = Utils.$('admin-user-frame-id')?.value.trim();
                if (!frameUrl) return Utils.toast('Укажите URL рамки', 'error');
                
                const snap = await get(ref(db, `users/${uid}/profile/inventory`));
                const currentInv = snap.exists() ? snap.val() : [];
                if (!currentInv.includes(frameUrl)) {
                    currentInv.push(frameUrl);
                    await update(ref(db, `users/${uid}/profile`), { frame: frameUrl, inventory: currentInv });
                    Utils.toast('Рамка выдана и добавлена в инвентарь!');
                } else {
                    await update(ref(db, `users/${uid}/profile`), { frame: frameUrl });
                    Utils.toast('У пользователя уже есть эта рамка, она применена');
                }
            };
        }

        Utils.$('btn-admin-save-user').onclick = () => this.saveUserProfile();
        
        const levelInput = Utils.$('admin-edit-level');
        const xpInput = Utils.$('admin-edit-xp');
        if (levelInput && xpInput) {
            levelInput.oninput = () => {
                let lvl = Number(levelInput.value) || 0;
                xpInput.value = 240 * (lvl * lvl);
            };
            xpInput.oninput = () => {
                let xp = Number(xpInput.value) || 0;
                levelInput.value = ProfileManager.getExpMath(xp).level;
            };
        }

        Utils.$('btn-admin-set-partner').onclick = () => this.forceSetPartner(uid);
        Utils.$('btn-admin-reset-user').onclick = () => this.resetUserProfile();
        Utils.$('btn-admin-delete-user').onclick = () => this.deleteUserCompletely(uid);
        Utils.$('btn-admin-force-leave-current').onclick = () => this.forceLeaveRoom(uid);
        Utils.$('btn-admin-force-logout-current').onclick = () => this.forceSignOut(uid);
        Utils.$('btn-admin-toggle-user-mute').onclick = () => this.toggleUserMute(uid);
        Utils.$('btn-admin-toggle-shadowban').onclick = () => this.toggleShadowban(uid);
        Utils.$('btn-admin-reset-password').onclick = () => this.issuePasswordReset(uid);
    }

    static async forceSetPartner(uid) {
        if (!this.requireAdmin()) return;
        const targetVal = Utils.$('admin-partner-target').value.trim();
        const fakeName = Utils.$('admin-partner-fake-name').value.trim();
        const fakeUrl = Utils.$('admin-partner-fake-url').value.trim();
        const customDate = Utils.$('admin-partner-date').value;
        let tsSince = customDate ? new Date(customDate).getTime() : Date.now();

        let companionUid = null;
        let previousTargetPartner = null;

        if (fakeName) {
            companionUid = `custom_partner_${Utils.generateCryptoId(6)}`;
            await set(ref(db, `users/${companionUid}/profile`), {
                name: fakeName,
                username: `mock_${Utils.generateCryptoId(4)}`, // fake
                avatar: fakeUrl || '',
            });
        } else if (targetVal) {
            const byUsernameSnap = await get(ref(db, `usernames/${targetVal.toLowerCase()}`));
            companionUid = byUsernameSnap.exists() ? byUsernameSnap.val() : targetVal;
            const checkProf = await get(ref(db, `users/${companionUid}/profile`));
            if (!checkProf.exists()) return Utils.toast('Реальный пользователь не найден!', 'error');
            
            const tcp = await get(ref(db, `users/${companionUid}/partner`));
            previousTargetPartner = tcp.exists() ? tcp.val() : null;
        } else {
            return Utils.toast('Введите данные половинки', 'error');
        }

        const updates = {};
        const snapMe = await get(ref(db, `users/${uid}/partner`));
        const myPrev = snapMe.exists() ? snapMe.val() : null;

        if (myPrev) {
            updates[`users/${myPrev}/partner`] = null;
            updates[`users/${myPrev}/partnerSince`] = null;
        }
        if (previousTargetPartner) {
            updates[`users/${previousTargetPartner}/partner`] = null;
            updates[`users/${previousTargetPartner}/partnerSince`] = null;
        }

        updates[`users/${uid}/partner`] = companionUid;
        updates[`users/${uid}/partnerSince`] = tsSince;
        
        if (!fakeName) {
            updates[`users/${companionUid}/partner`] = uid;
            updates[`users/${companionUid}/partnerSince`] = tsSince;
        } else {
            updates[`users/${companionUid}/partner`] = uid;
            updates[`users/${companionUid}/partnerSince`] = tsSince;
        }

        await update(ref(db), updates);
        if (!fakeName) await PartnerBondEngine.onUnion(uid, companionUid, tsSince);
        Utils.toast('Пара успешно изменена (СОЗДАТЕЛЬ)');
        this.loadUserEditor(uid);
    }

    static async removeFrameFromUser(uid, idx) {
        if (!this.isCurrentUserCreator()) return Utils.toast('Только Создатель', 'error');
        if (!confirm('Удалить эту рамку у пользователя?')) return;
        idx = parseInt(idx, 10);
        const snap = await get(ref(db, `users/${uid}/profile/inventory`));
        if (snap.exists()) {
            const currentInv = snap.val();
            if (currentInv[idx]) {
                const removedUrl = currentInv[idx];
                currentInv.splice(idx, 1);
                const profileSnap = await get(ref(db, `users/${uid}/profile`));
                const prof = profileSnap.val() || {};
                const updates = { inventory: currentInv };
                if (prof.frame === removedUrl) {
                    updates.frame = null; // Remove active frame if deleted
                }
                await update(ref(db, `users/${uid}/profile`), updates);
                Utils.toast('Рамка удалена');
                this.loadUserEditor(uid); // Refresh
            }
        }
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
        let streak = parseInt(Utils.$('admin-edit-streak')?.value || 0, 10);
        const bgColor = Utils.$('admin-edit-bg-color')?.value || '#111111';
        const bgUrl = Utils.$('admin-edit-bg-url')?.value.trim() || '';
        const bgDim = Number(Utils.$('admin-edit-bg-dim')?.value || 0.5);
        let xp = Number(Utils.$('admin-edit-xp')?.value || 0);
        let level = ProfileManager.getExpMath(xp).level;
        
        let newRole = undefined;
        const roleSelect = Utils.$('admin-owner-target-role');
        if (roleSelect && this.isCurrentUserCreator()) {
             newRole = roleSelect.value;
        }

        if (streak !== (oldProfile.streak || 0) || xp !== (oldProfile.xp || 0)) {
            if (!this.isCurrentUserCreator()) {
                Utils.toast('Изменять стрик и уровень(XP) может только Создатель', 'error');
                streak = oldProfile.streak || 0;
                xp = oldProfile.xp || 0;
                level = ProfileManager.getExpMath(xp).level;
            }
        }

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
            streak,
            level,
            xp,
            background: ProfileManager.normalizeProfileBackground({
                color: bgColor,
                index: ProfileManager.normalizeProfileBackground(oldProfile.background).index || 10,
                url: bgUrl,
                dim: Math.max(0, Math.min(1, bgDim))
            })
        };
        if (newRole !== undefined && newRole !== 'user') {
            nextProfile.role = newRole;
        } else if (newRole === 'user') {
            nextProfile.role = null;
        }
        updates[`users/${uid}/profile`] = nextProfile;

        await update(ref(db), updates);
        if (oldProfile.xp !== xp) {
            await BadgeManager.checkLevelBadges(uid, xp);
        }
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

    static async sendLocalAnnouncementToSelectedUser() {
        if (!this.requireAdmin()) return;
        const targetUid = Utils.$('admin-user-editor')?.dataset?.targetUid || '';
        if (!targetUid) return Utils.toast('Сначала выберите пользователя в блоке управления', 'error');

        const text = Utils.$('admin-local-announcement-input')?.value.trim();
        if (!text) return Utils.toast('Введите текст локального оповещения', 'error');

        const targetSnap = await get(ref(db, `users/${targetUid}/profile`));
        if (!targetSnap.exists()) return Utils.toast('Выбранный пользователь не найден', 'error');

        const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
        const payload = {
            id: Utils.generateCryptoId(10),
            text,
            ts: Date.now(),
            fromUid: AppState.currentUser.uid,
            fromUsername: profile.username || 'admin',
            targetUid
        };
        await set(ref(db, `admin/local-announcements/${targetUid}`), payload);
        await this.pushAuditLog('announcement.local.send', { targetUid, text });
        Utils.$('admin-local-announcement-input').value = '';
        Utils.toast('Локальное оповещение отправлено выбранному пользователю');
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
        const actorProfile = AppState.usersCache.get(AppState.currentUser.uid) || {};
        const actorName = actorProfile.name || AppState.currentUser.displayName || 'ADMIN';
        const actorUsername = actorProfile.username || AppState.currentUser.uid || 'admin';
        const targetName = roomMeta.room?.presence?.[uid]?.name || uid;
        await push(ref(db, `rooms/${roomMeta.roomId}/chat`), {
            type: 'system',
            uid: AppState.currentUser.uid,
            name: 'SYSTEM',
            text: `ХОСТ ${actorName}(@${actorUsername}) кикнул ${targetName}`,
            ts: Date.now()
        }).catch(() => {});
        await this.pushAuditLog('user.forceLeaveRoom', { uid, roomId: roomMeta.roomId });

        Utils.toast('Пользователь удалён из комнаты');
        this.renderIfOpen();
    }

    static async renderPanel() {
        if (!this.requireAdmin()) return;

        const stats = await this.collectDashboardData();
        this.renderStats(stats);
        this.renderRoomsList(stats.rooms);
        this.renderUsersList(stats.usersData);
    }
}

// ============================================================================
// 6. ПОЛНАЯ СИСТЕМА КОМНАТ И ПРАВ
// ============================================================================

class RoomManager {
    static themeIndex = 0;
    static heartsTimer = null;
    static loveHeartEmojis = ['💗', '💘', '💞', '💕'];

    static syncDeveloperControls(profile = {}) {
        AdminPanel.syncSidebarButton(profile);
    }

    static applyCreateRoomAvailability() {
        const btn = Utils.$('btn-open-create-room');
        if (!btn) return;

        const blockedForUser = (AppState.admin.settings.roomCreationBlocked || AppState.admin.settings.maintenanceMode) && !AdminPanel.isCurrentUserAdmin();
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
            if (AppState.currentRoomId) {
                if (!data[AppState.currentRoomId]) {
                    // Комната была удалена
                    Utils.toast('Комната была удалена', 'info');
                    this.leaveRoom();
                } else {
                    const currentRoom = data[AppState.currentRoomId];
                    const newTheme = this.normalizeRoomTheme(currentRoom.theme || 'default');
                    if (AppState.currentTheme !== newTheme) {
                        AppState.currentTheme = newTheme;
                        this.applyRoomTheme(newTheme);
                    }
                    VideoPlaybackManager.syncRoomVideoIfChanged(currentRoom);
                }
            }
            
            let totalOnline = 0;
            for(const r in data) { if (data[r].presence) totalOnline += Object.keys(data[r].presence).length; }
            if(Utils.$('global-online-count')) Utils.$('global-online-count').innerText = totalOnline;
            if(Utils.$('custom-online-count')) Utils.$('custom-online-count').innerText = totalOnline;
            AdminPanel.renderIfOpen();
        });
        AppState.activeSubscriptions.push(() => off(roomsRef, 'value', unsub));

        Utils.$('btn-open-create-room').onclick = () => this.openRoomModal();
        Utils.$('btn-save-room').onclick = () => this.saveRoom();
        Utils.$('search-rooms').oninput = Utils.debounce(() => this.updateRoomsDOM(), 300);
        
        Utils.$('room-input-private').onchange = (e) => { Utils.$('room-input-password').style.display = e.target.checked ? 'block' : 'none'; };
        Utils.$('btn-leave-room').onclick = () => this.leaveRoom();
        if (Utils.$('btn-fullscreen-toggle')) {
            Utils.$('btn-fullscreen-toggle').onclick = () => {
                const vidContainer = Utils.$('native-player')?.parentElement;
                if (!vidContainer) return;
                if (!document.fullscreenElement) {
                    vidContainer.requestFullscreen().catch(() => Utils.toast('Не удалось открыть полный экран', 'error'));
                } else {
                    document.exitFullscreen();
                }
            };
        }
        this.initThemes();
        MediaResolverClient.bindRoomUrlInput();
        this.applyCreateRoomAvailability();
    }

    static currentThemeFolder = 'classic';
    static selectedTheme = 'default';

    static initThemes() {
        const toggleBtn = Utils.$('btn-room-theme-toggle');
        const carousel = Utils.$('room-theme-carousel');
        const prevBtn = Utils.$('room-theme-prev'); // [UPDATE]
        const nextBtn = Utils.$('room-theme-next');
        const track = Utils.$('room-theme-track');
        if (!toggleBtn || !carousel || !prevBtn || !nextBtn || !track) return;

        toggleBtn.onclick = () => carousel.classList.toggle('active');
        prevBtn.onclick = () => this.stepThemeCarousel(-1);
        nextBtn.onclick = () => this.stepThemeCarousel(1);
        track.onclick = (e) => {
            const card = e.target.closest('.theme-card');
            if (!card?.dataset.theme) return;
            const opts = ThemeManager.FOLDERS[this.currentThemeFolder].themes;
            this.themeIndex = Math.max(0, opts.indexOf(card.dataset.theme));
            this.updateThemeTransform();
            this.syncThemeCarouselActive();
        };
    }

    static stepThemeCarousel(direction = 1) {
        const opts = ThemeManager.FOLDERS[this.currentThemeFolder]?.themes || [];
        if (!opts.length) return;
        this.themeIndex = (this.themeIndex + direction + opts.length) % opts.length;
        this.updateThemeTransform();
        this.syncThemeCarouselActive();
    }

    static syncThemeCarouselActive() {
        const track = Utils.$('room-theme-track');
        if (!track) return;
        track.querySelectorAll('.theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.theme === this.selectedTheme);
        });
    }

    static setRoomModalTheme(theme = 'default') {
        const normalized = this.normalizeRoomTheme(theme);
        this.selectedTheme = normalized;
        this.currentThemeFolder = ThemeManager.findFolderForTheme(normalized);
        const foldersContainer = Utils.$('room-theme-folders');
        foldersContainer?.querySelectorAll('.theme-folder-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.folder === this.currentThemeFolder);
        });
        ThemeManager.renderCarouselTrack(this.currentThemeFolder);
        this.syncThemeCarouselActive();
    }

    static updateThemeTransform() {
        const track = Utils.$('room-theme-track');
        if (!track) return;
        const opts = ThemeManager.FOLDERS[this.currentThemeFolder]?.themes || ['default'];
        this.selectedTheme = opts[this.themeIndex] || 'default';
        const modal = Utils.$('modal-room');
        if (modal) modal.dataset.selectedTheme = this.selectedTheme;
        track.style.transform = `translateX(-${this.themeIndex * 100}%)`;
        this.syncThemeCarouselActive();
    }

    static normalizeRoomTheme(theme = 'default') { // [NEW]
        return ThemeManager.EXTENDED_THEMES[theme] ? theme : 'default'; // [NEW]
    } // [NEW]

    static getActorLabel() {
        const uid = AppState.currentUser?.uid || '';
        const profile = AppState.usersCache.get(uid) || {};
        const name = profile.name || AppState.currentUser?.displayName || 'Unknown';
        const username = profile.username || uid || 'unknown';
        const isHostLike = AppState.isHost || AdminPanel.isCurrentUserCreator();
        return `${isHostLike ? 'ХОСТ' : 'ADMIN'} ${name}(@${username})`;
    }

    static async pushRoomSystemMessage(roomId, text, extra = {}) {
        if (!roomId || !text) return;
        await push(ref(db, `rooms/${roomId}/chat`), {
            type: 'system',
            uid: AppState.currentUser?.uid || 'system',
            name: 'SYSTEM',
            text: `${text}`,
            ts: Date.now(),
            ...extra
        }).catch(() => {});
    }

    static async kickUserFromCurrentRoom(targetUid) {
        if (!targetUid || !AppState.currentRoomId) return;
        if (!(AppState.isHost || AdminPanel.isCurrentUserCreator())) return Utils.toast('Недостаточно прав', 'error');
        const targetPresence = AppState.currentPresenceCache?.[targetUid];
        if (!targetPresence) return Utils.toast('Пользователь уже вышел', 'error');
        const roomId = AppState.currentRoomId;
        await Promise.all([
            remove(ref(db, `rooms/${roomId}/presence/${targetUid}`)),
            remove(ref(db, `rooms/${roomId}/rtc/participants/${targetUid}`)),
            set(ref(db, `admin/actions/forceLeaveRoom/${targetUid}`), {
                ts: Date.now(),
                byUid: AppState.currentUser.uid,
                roomId,
                reason: 'kicked-by-host'
            })
        ]);
        await this.pushRoomSystemMessage(roomId, `${this.getActorLabel()} кикнул ${targetPresence.name || targetUid}`);
    }

    static getRoomAvatarsStack(room = {}) {
        const ids = Object.keys(room?.presence || {}).slice(0, 4);
        if (!ids.length) return `<span class="stack-avatar">0</span>`;
        return ids.map(uid => {
            const profile = AppState.usersCache.get(uid) || {};
            return `<span class=\"stack-avatar\">${ProfileManager.getAvatarHtml(profile)}</span>`;
        }).join('');
    }

    static updateRoomsDOM() {
        const grid = Utils.$('rooms-grid');
        const search = Utils.$('search-rooms').value.toLowerCase().trim();
        let count = 0;
        
        AppState.roomsCache.forEach((room, id) => {
            if (search && !(room.name || '').toLowerCase().includes(search)) {
                Utils.$(`room-card-${id}`)?.remove(); return;
            }
            
            const lock = room.isPrivate ? '🔒 ' : '';
            const membersCount = room.presence ? Object.keys(room.presence).length : 0;
            const isYt = MediaResolverClient.extractYouTubeId(room.videoSourceUrl || room.videoUrl);
            const platformBadge = isYt ? `<span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px; vertical-align:middle;">YouTube</span>` : '';

            let card = Utils.$(`room-card-${id}`);
            
            if (!card) {
                card = document.createElement('div'); card.className = 'room-card'; card.id = `room-card-${id}`;
                card.onclick = () => this.attemptJoinRoom(id, room);
                const isYtUrl = MediaResolverClient.extractYouTubeId(room.videoSourceUrl || room.videoUrl);
                const ytHtml = isYtUrl ? `<img src="https://i.ytimg.com/vi/${isYtUrl}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;">` : '';
                const vidHtml = (room.videoUrl && !isYtUrl) ? `<video src="${Utils.escapeHtml(room.videoUrl)}" preload="metadata" muted playsinline></video>` : ytHtml;
                card.innerHTML = `
                    <div class="room-preview">${vidHtml}<div class="room-preview-overlay"></div></div>
                    <div class="room-info"><h4 class="rm-title"></h4><div class="room-meta"><span class="rm-host"></span><span class="rm-count"></span></div></div>
                `;
                grid.appendChild(card);
                const video = card.querySelector('video');
                if (video) { video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(10, video.duration / 2); card.querySelector('.room-preview').classList.add('loaded'); }, { once: true }); }
                if (isYtUrl) { card.querySelector('.room-preview').classList.add('loaded'); }
            }
            card.querySelector('.rm-title').innerHTML = `${platformBadge}${lock}${Utils.escapeHtml(room.name)}`;
            if (Array.isArray(room.hashtags) && room.hashtags[0]) {
                card.querySelector('.rm-title').innerHTML = `${platformBadge}${lock}${Utils.escapeHtml(room.name)} <span style="opacity:0.7;font-size:0.9em">${Utils.escapeHtml(room.hashtags[0])}</span>`;
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
        if (!roomId && AdminPanel.isSystemReadOnlyForUser()) {
            return Utils.toast('Система в режиме ReadOnly', 'error');
        }
        if (!roomId && AppState.admin.settings.roomCreationBlocked && !AdminPanel.isCurrentUserAdmin()) {
            return Utils.toast('Создание комнат временно отключено администратором', 'error');
        }

        const modal = Utils.$('modal-room');
        const isEdit = !!roomId;
        Utils.$('room-modal-title').innerText = isEdit ? 'Настройки комнаты' : 'Создать комнату';
        Utils.$('btn-delete-room').style.display = isEdit ? 'block' : 'none';
        
        if (isEdit) {
            const r = AppState.roomsCache.get(roomId);
            Utils.$('room-input-name').value = r.name || '';
            Utils.$('room-input-url').value = r.videoSourceUrl || r.videoUrl || '';
            MediaResolverClient.setModalStatus(r.videoTitle ? 'success' : 'idle', r.videoTitle ? `${r.videoPlatform || 'video'}: ${r.videoTitle}` : '');
            Utils.$('room-input-private').checked = r.isPrivate; Utils.$('room-input-password').style.display = r.isPrivate ? 'block' : 'none';
            Utils.$('room-input-hashtag').value = Array.isArray(r.hashtags) ? (r.hashtags[0] || '') : '';
            this.setRoomModalTheme(r.theme || 'default');
            Utils.$('room-theme-carousel').classList.remove('active');
            Utils.$('btn-delete-room').onclick = async () => {
                if(confirm('Точно удалить комнату навсегда?')) {
                    modal.classList.remove('active'); 
                    this.leaveRoom();
                    await remove(ref(db, `rooms/${roomId}`)); 
                }
            };
        } else {
            Utils.$('room-input-name').value = ''; Utils.$('room-input-url').value = '';
            Utils.$('room-input-private').checked = false; Utils.$('room-input-password').style.display = 'none'; Utils.$('room-input-password').value = '';
            Utils.$('room-input-hashtag').value = '';
            MediaResolverClient.setModalStatus('idle', '');
            this.setRoomModalTheme('default');
            Utils.$('room-theme-carousel').classList.remove('active');
        }
        modal.classList.add('active'); modal.dataset.editingId = isEdit ? roomId : '';
    }

    static async saveRoom() {
        const name = Utils.$('room-input-name').value.trim();
        const videoInputUrl = Utils.$('room-input-url').value.trim();
        const isPrivate = Utils.$('room-input-private').checked;
        const password = Utils.$('room-input-password').value.trim();
        const hashtags = HashtagManager.parseHashtags(Utils.$('room-input-hashtag').value, true);
        const roomId = Utils.$('modal-room').dataset.editingId;
        const selectedTheme = Utils.$('modal-room').dataset.selectedTheme || 'default';

        if (!roomId && AdminPanel.isSystemReadOnlyForUser()) {
            return Utils.toast('Система в режиме ReadOnly', 'error');
        }
        if (!roomId && AppState.admin.settings.roomCreationBlocked && !AdminPanel.isCurrentUserAdmin()) {
            return Utils.toast('Создание комнат временно отключено администратором', 'error');
        }

        if (!name) return Utils.toast('Название не может быть пустым', 'error');
        if (isPrivate && password.length < 4 && !roomId) return Utils.toast('Пароль минимум 4 символа', 'error');

        Utils.$('btn-save-room').disabled = true;
        try {
            const previousRoom = roomId ? (AppState.roomsCache.get(roomId) || {}) : null;
            let videoFields = {
                videoUrl: '',
                videoSourceUrl: '',
                videoPlatform: '',
                videoIsHls: false,
                videoResolvedAt: 0,
                videoTitle: '',
                videoThumbnail: ''
            };

            const prevInput = previousRoom ? (previousRoom.videoSourceUrl || previousRoom.videoUrl || '') : '';

            if (videoInputUrl) {
                if (previousRoom && videoInputUrl === prevInput) {
                    videoFields = {
                        videoUrl: previousRoom.videoUrl || '',
                        videoSourceUrl: previousRoom.videoSourceUrl || '',
                        videoPlatform: previousRoom.videoPlatform || '',
                        videoIsHls: previousRoom.videoIsHls || false,
                        videoResolvedAt: previousRoom.videoResolvedAt || 0,
                        videoTitle: previousRoom.videoTitle || '',
                        videoThumbnail: previousRoom.videoThumbnail || ''
                    };
                } else {
                    try {
                        videoFields = await MediaResolverClient.buildRoomVideoFields(videoInputUrl);
                    } catch (err) {
                        Utils.toast(err.message || 'Ошибка извлечения видео', 'error');
                        return;
                    }
                }
            }

            const roomData = {
                name,
                videoUrl: videoFields.videoUrl,
                videoSourceUrl: videoFields.videoSourceUrl,
                videoPlatform: videoFields.videoPlatform,
                videoIsHls: videoFields.videoIsHls,
                videoResolvedAt: videoFields.videoResolvedAt,
                videoTitle: videoFields.videoTitle,
                videoThumbnail: videoFields.videoThumbnail,
                isPrivate,
                hashtags,
                theme: this.normalizeRoomTheme(selectedTheme),
                hostId: AppState.currentUser.uid,
                hostName: AppState.usersCache.get(AppState.currentUser.uid)?.name || AppState.currentUser.displayName || 'Хост',
                updatedAt: Date.now()
            };
            if (isPrivate && password) { roomData.salt = Utils.generateCryptoId(16); roomData.hash = await Utils.hashPassword(password, roomData.salt); }

            if (roomId) {
                if (isPrivate && !password) { const oldR = AppState.roomsCache.get(roomId); roomData.salt = oldR.salt; roomData.hash = oldR.hash; }
                await update(ref(db, `rooms/${roomId}`), roomData); Utils.toast('Настройки сохранены');
                const mergedRoom = { ...(AppState.roomsCache.get(roomId) || {}), ...roomData };
                AppState.roomsCache.set(roomId, mergedRoom);
                const actor = this.getActorLabel();
                if (previousRoom && this.normalizeRoomTheme(previousRoom.theme || 'default') !== roomData.theme) {
                    await this.pushRoomSystemMessage(roomId, `${actor} поменял тему комнаты`);
                }
                if (previousRoom && Boolean(previousRoom.isPrivate) !== Boolean(roomData.isPrivate)) {
                    await this.pushRoomSystemMessage(roomId, `${actor} ${roomData.isPrivate ? 'сделал комнату приватной' : 'сделал комнату публичной'}`);
                }
            } else {
                roomData.createdAt = Date.now(); const newRef = push(ref(db, 'rooms')); await set(newRef, roomData); Utils.toast('Комната создана');
                this.enterRoomFinal(newRef.key, roomData);
            }
            Utils.$('modal-room').classList.remove('active');
        } catch (e) { Utils.toast('Ошибка сохранения', 'error'); } 
        finally { Utils.$('btn-save-room').disabled = false; }
    }

    static async attemptJoinRoom(roomId, roomData) {
        if (AppState.admin.settings.maintenanceMode && !AdminPanel.isCurrentUserAdmin()) {
            return Utils.toast('Сервис в режиме обслуживания, доступ временно ограничен', 'error');
        }
        if (roomData.isPrivate && roomData.hostId !== AppState.currentUser.uid && !window.isIncognito) {
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
        AppState.ignoreVideoEvents = true;
        RTCManager.destroy();
        AppState.currentRoomId = roomId;
        AppState.currentRoomJoinTs = Date.now(); // ФИКС: Запоминаем время входа, чтобы не смотреть старые пасхалки
        // Фикс изначального хоста (только владелец получает тру isHost глобально)
        AppState.isHost = (roomData.hostId === AppState.currentUser.uid);
        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.roomSubscriptions.forEach(fn => fn()); AppState.roomSubscriptions = [];
        
        RoomManager.startRoomExperienceTimer();
        
        const roomTag = Array.isArray(roomData.hashtags) && roomData.hashtags[0] ? ` ${roomData.hashtags[0]}` : '';
        Utils.$('room-title-text').innerText = Utils.escapeHtml(`${roomData.name}${roomTag}`);
        VideoPlaybackManager.applyRoomVideo(roomData).catch(() => {});
        
        if (MediaResolverClient.extractYouTubeId(roomData.videoSourceUrl || roomData.videoUrl)) {
            const ytVpnNotice = document.createElement('div');
            ytVpnNotice.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border: 2px solid #ff4757; border-radius: 16px; padding: 24px; z-index: 10000; color: #fff; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-width: 90%; width: 320px;';
            ytVpnNotice.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px;">🔴</div>
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Внимание: YouTube</div>
                <div style="font-size: 14px; opacity: 0.9; line-height: 1.5; margin-bottom: 20px;">Для корректной загрузки и синхронизации видео с YouTube <b>обязательно включите VPN</b>.</div>
                <button class="primary-btn" style="width: 100%;" onclick="this.parentElement.remove()">Я включил VPN</button>
            `;
            document.body.appendChild(ytVpnNotice);
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

        // Add Admin button in room if admin
        if (AdminPanel.isCurrentUserAdmin()) {
            let roomAdminBtn = document.getElementById('btn-room-admin-panel');
            if (!roomAdminBtn) {
                roomAdminBtn = document.createElement('button');
                roomAdminBtn.id = 'btn-room-admin-panel';
                roomAdminBtn.className = 'secondary-btn';
                roomAdminBtn.innerText = '🛡️ Админ-панель';
                roomAdminBtn.style.cssText = 'width:auto; padding:10px 16px; margin-left:8px;';
                roomAdminBtn.onclick = () => AdminPanel.openPanel();
                const rrTopBar = Utils.$('btn-room-settings').parentNode;
                if (rrTopBar) rrTopBar.appendChild(roomAdminBtn);
            }
        }

        const videoVolSlider = Utils.$('video-volume-slider');
        if (videoVolSlider) {
            videoVolSlider.oninput = () => {
                const nativePlayer = Utils.$('native-player');
                if (nativePlayer) nativePlayer.volume = videoVolSlider.value;
                if (YouTubePlayerManager.player && typeof YouTubePlayerManager.player.setVolume === 'function') {
                    YouTubePlayerManager.player.setVolume(videoVolSlider.value * 100);
                }
                if (RutubePlayerManager.player) {
                    RutubePlayerManager.player.postMessage('player:setVolume', { volume: videoVolSlider.value });
                }
            };
        }

        Utils.showScreen('room-screen');
        Utils.$('chat-messages').innerHTML = '<div class="sys-msg">Вы вошли в комнату</div>';
        Utils.$('users-list').innerHTML = '';
        
        AppState.currentTheme = this.normalizeRoomTheme(roomData.theme || 'default'); // [UPDATE]
        this.applyRoomTheme(AppState.currentTheme);
        
        this.initRoomServicesFinal(roomId);
        RTCManager.init(roomId); 
        if(window.SoundpadController) window.SoundpadController.loadPad();
    }

    static getDefaultPerms() { return { chat: true, voice: true, player: true, reactions: true }; }

    static initRoomServicesFinal(roomId) {
        const uid = AppState.currentUser.uid;
        const presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
        const presListRef = ref(db, `rooms/${roomId}/presence`);
        const syncRef = ref(db, `rooms/${roomId}/sync`);
        const chatRef = ref(db, `rooms/${roomId}/chat`);
        const reactionsRef = ref(db, `rooms/${roomId}/reactions`);
        let presenceBootstrapped = false;

        const myName = AppState.usersCache.get(AppState.currentUser.uid)?.name || AppState.currentUser.displayName || 'Пользователь';
        if (!window.isIncognito) {
            set(presenceRef, { uid, name: myName, perms: this.getDefaultPerms() });
            onDisconnect(presenceRef).remove();
        } else {
            // Still allow chatting, just don't list presence
            Utils.toast('ИНКОГНИТО АКТИВЕН. Вас не видно в списке.', 'info');
        }
        
        const pUnsub = onValue(presListRef, (snap) => {
            const prevCache = AppState.currentPresenceCache || {};
            AppState.currentPresenceCache = snap.val() || {};
            this.rerenderUsersList();
            this.applyLocalPermissions();
            if (!presenceBootstrapped) {
                presenceBootstrapped = true;
                return;
            }
            if (AppState.isHost || AdminPanel.isCurrentUserCreator()) {
                const prevIds = new Set(Object.keys(prevCache));
                const nextIds = new Set(Object.keys(AppState.currentPresenceCache));
                nextIds.forEach((joinedUid) => {
                    if (!prevIds.has(joinedUid)) {
                        const joinedName = AppState.currentPresenceCache[joinedUid]?.name || joinedUid;
                        this.pushRoomSystemMessage(roomId, `${joinedName} зашел в комнату`);
                    }
                });
                prevIds.forEach((leftUid) => {
                    if (!nextIds.has(leftUid)) {
                        const leftName = prevCache[leftUid]?.name || leftUid;
                        this.pushRoomSystemMessage(roomId, `${leftName} вышел из комнаты`);
                    }
                });
            }
        });
        AppState.roomSubscriptions.push(() => {
            pUnsub();
            remove(presenceRef);
        });

        const vid = Utils.$('native-player');
        if (vid) {
            vid.onplay = () => { if(!AppState.ignoreVideoEvents && !window._isSyncingVideo && this.hasPerm('player')) set(syncRef, { type: 'play', state: 'playing', time: vid.currentTime, ts: Date.now() }); };
            vid.onpause = () => { if(!AppState.ignoreVideoEvents && !window._isSyncingVideo && this.hasPerm('player')) set(syncRef, { type: 'pause', state: 'paused', time: vid.currentTime, ts: Date.now() }); };
            vid.onseeked = () => { if(!AppState.ignoreVideoEvents && !window._isSyncingVideo && this.hasPerm('player')) set(syncRef, { type: 'seek', state: vid.paused ? 'paused' : 'playing', time: vid.currentTime, ts: Date.now() }); };
        }

        let hasHostRejoinedSync = false;
        const sUnsub = onValue(syncRef, (snap) => {
            const d = snap.val();
            if (!d) {
                setTimeout(() => AppState.ignoreVideoEvents = false, 1000);
                return;
            }

            if (AppState.isHost && !hasHostRejoinedSync) {
                hasHostRejoinedSync = true;
                if (d.state === 'paused') {
                    set(syncRef, {
                        type: 'play',
                        state: 'playing',
                        time: d.time,
                        ts: Date.now()
                    }).catch(()=>{});
                    return;
                }
            }

            AppState.lastKnownSyncState = d;
            RoomManager.forceSyncVideo(d);
        });
        AppState.roomSubscriptions.push(sUnsub);

        const chatActionRef = ref(db, `rooms/${roomId}/chatAction`);
        const caUnsub = onValue(chatActionRef, (snap) => {
            const data = snap.val();
            if (data?.type === 'thanosSnap' && Date.now() - data.ts < 10000) {
                const marker = `thanosSeen:${data.ts}`;
                if (sessionStorage.getItem(marker)) return;
                sessionStorage.setItem(marker, '1');

                document.querySelectorAll('.m-line').forEach((el) => {
                    el.style.transition = `transform ${1 + Math.random()}s cubic-bezier(.36,.07,.19,.97), opacity 1s, filter 1s`;
                    el.style.transform = `translateX(${Math.random() > 0.5 ? 50 : -50}px) translateY(-20px) rotate(${Math.random()*20 - 10}deg) scale(0.9)`;
                    el.style.filter = `blur(${2 + Math.random()*5}px)`;
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 2000);
                });
                
                if (AppState.isHost) {
                    setTimeout(() => {
                        set(chatRef, null); // Actually clear DB chat
                    }, 500);
                }
            }
        });
        AppState.roomSubscriptions.push(caUnsub);

        let myCursorSyncInterval = null;
        const screenEl = document.getElementById('room-screen');
        const updateMyCursor = (e) => {
            if(!screenEl) return;
            const rect = screenEl.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            window._myLastCursorPos = {x, y};
        };
        const csUnsub = onValue(ref(db, `rooms/${roomId}/cursorSync`), (snap) => {
            const isActive = !!snap.val();
            if (isActive) {
                document.addEventListener('mousemove', updateMyCursor);
                myCursorSyncInterval = setInterval(() => {
                    if (window._myLastCursorPos) {
                        set(ref(db, `rooms/${roomId}/cursors/${uid}`), {
                            x: window._myLastCursorPos.x,
                            y: window._myLastCursorPos.y,
                            ts: Date.now()
                        });
                    }
                }, 200);
            } else {
                document.removeEventListener('mousemove', updateMyCursor);
                if(myCursorSyncInterval) clearInterval(myCursorSyncInterval);
                set(ref(db, `rooms/${roomId}/cursors/${uid}`), null);
                document.querySelectorAll('.quantum-cursor').forEach(el => el.remove());
            }
        });
        AppState.roomSubscriptions.push(csUnsub);
        AppState.roomSubscriptions.push(() => {
             document.removeEventListener('mousemove', updateMyCursor);
             if(myCursorSyncInterval) clearInterval(myCursorSyncInterval);
             document.querySelectorAll('.quantum-cursor').forEach(el => el.remove());
        });

        const curUnsub = onValue(ref(db, `rooms/${roomId}/cursors`), (snap) => {
            const activeCursors = snap.val() || {};
            const screen = document.getElementById('room-screen');
            if(!screen) return;
            const rect = screen.getBoundingClientRect();
            
            Object.keys(activeCursors).forEach(cId => {
                let el = document.getElementById(`cursor-${cId}`);
                if(cId === uid || Date.now() - activeCursors[cId].ts > 3000) {
                    if(el) el.remove();
                    return;
                }
                if (!el) {
                    el = document.createElement('div');
                    el.id = `cursor-${cId}`;
                    el.className = 'quantum-cursor';
                    const fallbackChar = (AppState.usersCache.get(cId)?.name || '?')[0].toUpperCase();
                    el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" style="position:absolute; top:-12px; left:-12px; z-index:1;"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><div style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.8); color:#0ff; font-size:10px; border-radius:10px; padding:2px 6px; white-space:nowrap; border:1px solid rgba(0,255,255,0.3); z-index:2;">${AppState.usersCache.get(cId)?.name || 'Анон'}</div>`;
                    el.style.cssText = `position:absolute; pointer-events:none; z-index:500; transition: transform 0.2s linear;`;
                    screen.appendChild(el);
                }
                const px = activeCursors[cId].x * rect.width;
                const py = activeCursors[cId].y * rect.height;
                el.style.transform = `translate(${px}px, ${py}px)`;
            });
            // Cleanup obsolete
            document.querySelectorAll('.quantum-cursor').forEach(el => {
                const id = el.id.replace('cursor-', '');
                if(!activeCursors[id]) el.remove();
            });
        });
        AppState.roomSubscriptions.push(curUnsub);

        const roomJoinTime = Date.now();
        let processedMsgs = new Set();
        const cUnsub = onChildAdded(chatRef, (snap) => {
            const msg = snap.val(); const id = snap.key;
            if (processedMsgs.has(id)) return;
            processedMsgs.add(id);
            if (msg?.shadowbanned && msg.uid !== uid && !AdminPanel.isCurrentUserAdmin()) return;
            if (msg?.type === 'system') {
                const systemLine = document.createElement('div');
                systemLine.className = 'sys-msg';
                systemLine.innerText = msg.text || '';
                Utils.$('chat-messages').appendChild(systemLine);
                Utils.$('chat-messages').scrollTop = Utils.$('chat-messages').scrollHeight;
                return;
            }

            const isMe = msg.uid === uid;
            const line = document.createElement('div');
            line.className = `m-line ${isMe ? 'self' : ''}`;
            
            let content = Utils.escapeHtml(msg.text);
            content = content.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn" data-time="$1">$1</span>');

            const fallbackChar = (msg.name || '?')[0].toUpperCase();
            
            const avatarHtml = `<div class="chat-avatar-placeholder" style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${fallbackChar}</div>`;

            // Overlay display
            const overlayContainer = Utils.$('chat-overlay-container');
            if (overlayContainer && !isMe && msg.ts >= roomJoinTime) {
                const overlayEl = document.createElement('div');
                const avHtml = ProfileManager.getAvatarHtml(AppState.usersCache.get(msg.uid) || {name: msg.name, avatar: null});
                    
                overlayEl.style.cssText = `
                    background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
                    padding: 8px 12px; display: flex; align-items: center; gap: 8px;
                    color: #fff; font-size: 14px; animation: chatOverlayFade 4s forwards;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4); pointer-events: none;
                `;
                overlayEl.innerHTML = `
                    <div style="width:28px; height:28px; border-radius: 50%; overflow:visible; flex-shrink:0;">${avHtml}</div>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="font-size:11px; font-weight:bold; color: var(--accent);">${Utils.escapeHtml(msg.name)}</span>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 250px;">${content}</span>
                    </div>
                `;
                overlayContainer.appendChild(overlayEl);
                setTimeout(() => { if (overlayEl.parentNode) overlayEl.remove(); }, 4000);
            }

            line.innerHTML = `
                <div style="display:flex; gap:8px; align-items:flex-end; max-width:100%; ${isMe ? 'flex-direction:row-reverse;' : ''}">
                    <div class="chat-profile-link" data-uid="${Utils.escapeHtml(msg.uid || '')}" style="width:26px; height:26px; border-radius:50%; flex-shrink:0; cursor:pointer; overflow:visible; border:1px solid var(--border-light); background:rgba(255,255,255,0.05); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 0 8px rgba(255,255,255,0.2)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
                        ${avatarHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; ${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'} max-width:85%;">
                        <strong class="profile-open-link chat-profile-link" data-uid="${Utils.escapeHtml(msg.uid || '')}" style="font-size:11px; margin-bottom:4px; opacity:0.75; padding:0 4px;">${Utils.escapeHtml(msg.name)}</strong>
                        <div class="bubble" style="max-width:100%;">${content}</div>
                    </div>
                </div>
            `;
            
            ProfileManager.loadUser(msg.uid).then(uProfile => {
                if (uProfile) {
                    const container = line.querySelector('.chat-profile-link[data-uid=\x22' + Utils.escapeHtml(msg.uid || '') + '\x22]');
                    if (container) container.innerHTML = ProfileManager.getAvatarHtml(uProfile);
                }
            });
            
            line.querySelectorAll('.timecode-btn').forEach(btn => {
                btn.onclick = () => {
                    if (!this.hasPerm('player')) return Utils.toast('Нет прав на управление плеером', 'error');
                    const parts = btn.dataset.time.split(':');
                    const secs = parseInt(parts[0])*60 + parseInt(parts[1]);
                    AppState.ignoreVideoEvents = true;
                    vid.currentTime = secs;
                    vid.play().catch(()=>{});
                    setTimeout(() => AppState.ignoreVideoEvents = false, 300);
                    set(syncRef, { type: 'seek', time: secs, ts: Date.now() });
                };
            });
            line.querySelectorAll('.chat-profile-link').forEach(btn => {
                if (msg.uid) btn.onclick = () => ProfileManager.openViewProfileModal(msg.uid);
            });

            Utils.$('chat-messages').appendChild(line);
            Utils.$('chat-messages').scrollTop = Utils.$('chat-messages').scrollHeight;
        });
        AppState.roomSubscriptions.push(cUnsub);

        Utils.$('send-btn').onclick = async () => {
            const input = Utils.$('chat-input');
            if (!input.value.trim() || !this.hasPerm('chat')) return;
            if (AdminPanel.isSystemReadOnlyForUser()) return Utils.toast('Система в режиме ReadOnly', 'error');
            if (AppState.admin.settings.globalChatLocked && !AdminPanel.isCurrentUserAdmin()) return Utils.toast('Глобальный чат временно заблокирован', 'error');
            const text = input.value.trim();
            const meModerationSnap = await get(ref(db, `users/${uid}/moderation`));
            const meModeration = meModerationSnap.val() || {};
            if (meModeration.muted && !AdminPanel.isCurrentUserAdmin()) return Utils.toast('Вы заглушены модератором', 'error');
            const wasHandled = await EasterEggManager.handleChatInput(text, chatRef, uid);
            if (!wasHandled) {
                if (text.startsWith('/bet ')) {
                    const parts = text.split(' ');
                    const xpAmount = parseInt(parts[1], 10);
                    if (!isNaN(xpAmount) && xpAmount > 0) {
                        const betDesc = parts.slice(2).join(' ') || 'неопределенный исход';
                        await push(chatRef, {
                            uid: 'system_bet',
                            name: 'СИСТЕМА СТАВОК',
                            text: `🎰 ${AppState.usersCache.get(uid)?.name || 'Пользователь'} ставит ${xpAmount} XP на: "${betDesc}" !`,
                            ts: Date.now()
                        });
                        input.value = '';
                        return;
                    }
                } else if (text.startsWith('/roll')) {
                    const roll = Math.floor(Math.random() * 100) + 1;
                    await push(chatRef, {
                        uid: 'system_dice',
                        name: 'СИСТЕМА КОСТЕЙ',
                        text: `🎲 ${AppState.usersCache.get(uid)?.name || 'Пользователь'} бросает кости и выбивает: ${roll} из 100!`,
                        ts: Date.now()
                    });
                    input.value = '';
                    return;
                }
                
                let sendUid = uid;
                let sendName = AppState.usersCache.get(AppState.currentUser.uid)?.name || AppState.currentUser.displayName || 'Пользователь';
                
                if (window.puppeteerUid && AdminPanel.isCurrentUserAdmin()) {
                    sendUid = window.puppeteerUid;
                    sendName = AppState.usersCache.get(sendUid)?.name || 'Аноним (Кукловод)';
                }

                let finalOutput = text;
                try {
                    const curseSnap = await get(ref(db, `admin/curses/uwu/${sendUid}`));
                    const curseTime = curseSnap.val();
                    // 5 minutes
                    if (curseTime && (Date.now() - curseTime < 300000)) {
                        finalOutput = finalOutput.replace(/[рл]/g, 'w').replace(/[РЛ]/g, 'W').replace(/ч/g, 'c') + ' uwu :3';
                    }
                } catch(e) {}

                if (window.isShadowCloneActive && AdminPanel.isCurrentUserAdmin()) {
                    await push(chatRef, { uid: sendUid, name: sendName, text: finalOutput, ts: Date.now() });
                    const roomKeys = Object.keys(AppState.currentPresenceCache || {});
                    if (roomKeys.length > 0) {
                        for(let i=0; i<5; i++) {
                            const rUid = roomKeys[Math.floor(Math.random() * roomKeys.length)];
                            const rName = AppState.currentPresenceCache[rUid]?.name || 'Клон';
                            await push(chatRef, { uid: rUid, name: rName, text: finalOutput, ts: Date.now() + i + 1 });
                        }
                    }
                } else {
                    await push(chatRef, {
                        uid: sendUid,
                        name: sendName,
                        text: finalOutput,
                        ts: Date.now(),
                        shadowbanned: Boolean(meModeration.shadowban)
                    });
                }
            }
            input.value = '';
        };
        Utils.$('chat-input').onkeydown = (e) => { if(e.key==='Enter') Utils.$('send-btn').click(); };

        document.querySelectorAll('.react-btn').forEach(btn => {
            btn.onclick = () => {
                if(!this.hasPerm('reactions')) return;
                if (AdminPanel.isSystemReadOnlyForUser()) return Utils.toast('Система в режиме ReadOnly', 'error');
                if (AppState.admin.settings.globalReactionsBlocked && !AdminPanel.isCurrentUserAdmin()) return Utils.toast('Глобальные реакции временно отключены', 'error');
                push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
            };
        });
        const rUnsub = onChildAdded(reactionsRef, (snap) => {
            const rx = snap.val();
            if (Date.now() - rx.ts > 5000) return;
            const el = document.createElement('div');
            el.className = 'floating-emoji';
            const imgMap = {
                '🔥': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp',
                '😂': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp',
                '😱': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp',
                '❤️': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp',
                '👏': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp'
            };
            if (imgMap[rx.emoji]) {
                el.innerHTML = `<img src="${imgMap[rx.emoji]}" style="width: 48px; height: 48px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));">`;
            } else {
                el.innerText = rx.emoji;
            }
            el.style.left = `${Math.random() * 80 + 10}%`;
            Utils.$('reaction-layer').appendChild(el);
            setTimeout(() => el.remove(), 3000);
        });
        AppState.roomSubscriptions.push(rUnsub);
        EasterEggManager.bindRoom(roomId);

        const rbChat = Utils.$('tab-chat-btn'); const rbUsers = Utils.$('tab-users-btn'); const rbSound = Utils.$('tab-soundpad-btn');
        const rcChat = Utils.$('chat-messages'); const rcUsers = Utils.$('users-list'); const rcSound = Utils.$('soundpad-list');
        const setRoomTab = (name) => {
            if(rbChat) rbChat.classList.toggle('active', name === 'chat');
            if(rbUsers) rbUsers.classList.toggle('active', name === 'users');
            if(rbSound) rbSound.classList.toggle('active', name === 'sound');
            if(rcChat) rcChat.style.display = name === 'chat' ? 'flex' : 'none';
            if(rcUsers) rcUsers.style.display = name === 'users' ? 'flex' : 'none';
            if(rcSound) rcSound.style.display = name === 'sound' ? 'block' : 'none';
        };
        if(rbChat) rbChat.onclick = () => setRoomTab('chat');
        if(rbUsers) rbUsers.onclick = () => setRoomTab('users');
        if(rbSound) rbSound.onclick = () => { setRoomTab('sound'); window.SoundpadController?.loadPad(); };
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
        if (vid) { vid.controls = pPlayer; }
        
        const overlay = Utils.$('room-video-overlay');
        if (overlay) overlay.style.pointerEvents = pPlayer ? 'none' : 'auto';

        Utils.$('chat-input').disabled = !pChat;
        Utils.$('send-btn').disabled = !pChat;
        Utils.$('mic-btn').disabled = !pVoice;
        
        document.querySelectorAll('.react-btn').forEach(b => b.disabled = !pReactions);
        document.querySelectorAll('.timecode-btn').forEach(b => {
            if (pPlayer) b.classList.remove('disabled'); else b.classList.add('disabled');
        });
        
        const soundpadBtn = Utils.$('tab-soundpad-btn');
        if (soundpadBtn) {
            const isHost = AppState.isHost || AdminPanel.isCurrentUserCreator();
            soundpadBtn.style.display = isHost ? 'flex' : 'none';
            if (!isHost) {
                const spList = Utils.$('soundpad-list');
                if (spList && spList.style.display !== 'none') {
                    if (typeof setRoomTab === 'function') setRoomTab('chat');
                    else if (Utils.$('tab-chat-btn')) Utils.$('tab-chat-btn').click();
                }
            }
        }

        if (!pVoice && RTCManager.isMicActive) RTCManager.toggleMic(true); 
    }

    static rerenderUsersList() {
        const container = Utils.$('users-list');
        const cache = AppState.currentPresenceCache || {};
        const ids = Object.keys(cache);
        let outsideFriendsHtml = '';
        const renderToken = ++AppState.usersListRenderToken;
        const renderRoomId = AppState.currentRoomId;

        this.updateUsersTabButton(ids, cache);
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
                    let inviteHtml = `<div style="font-size:11px; color:var(--text-muted); margin: 15px 0 5px; text-transform:uppercase;">Друзья вне комнаты</div>`;
                    friendsIds.forEach(fid => {
                        inviteHtml += `
                            <div class="user-item" style="background: rgba(46,213,115,0.05); border: 1px solid rgba(46,213,115,0.2);">
                                <div class="user-main" style="flex:1;"><span class="user-name" id="inv-name-${fid}">Загрузка...</span></div>
                                <button class="primary-btn" style="width:auto; padding:4px 8px; font-size:11px;" onclick="DirectMessages.sendRoomInvite('${fid}')">Пригласить</button>
                            </div>
                        `;
                        ProfileManager.loadUser(fid).then(async p => {
                            if (!ensureActualRender() || !p) return;
                            const st = (await get(ref(db, `users/${fid}/status`))).val() || {};
                            if (!ensureActualRender()) return;
                            const isOnline = st.online;
                            const statusText = isOnline ? 'Онлайн' : (st.lastSeen ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}` : 'Офлайн');
                            if (Utils.$(`inv-name-${fid}`)) {
                                Utils.$(`inv-name-${fid}`).innerHTML = `<div style="display:flex; flex-direction:column;"><div style="display:flex; align-items:center;"><div class="indicator ${isOnline ? 'online' : ''}" style="width:8px;height:8px;border-radius:50%;background:${isOnline ? '#4caf50' : '#888'};margin-right:6px;"></div>${Utils.escapeHtml(p.name)}</div><span style="font-size:10px; color:var(--text-muted); margin-top:2px;">${statusText}</span></div>`;
                            }
                        });
                    });
                    outsideFriendsHtml = inviteHtml;
                }
                renderRoomUsers(fr);
            });
        } else {
            renderRoomUsers({});
        }

        function renderRoomUsers(myFriends = {}) {
            if (!ensureActualRender()) return;
            container.innerHTML += `<div style="font-size:11px; color:var(--text-muted); margin: 10px 0 5px; text-transform:uppercase;">В комнате</div>`;
            ids.forEach(uid => {
                const user = cache[uid];
                const isLocal = uid === AppState.currentUser.uid;
                
                // Проверяем, является ли юзер оригинальным хостом ИЛИ создателем (Developer)
                const profile = AppState.usersCache.get(uid) || {};
                const isTargetHost = (AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid) || AdminPanel.isCreatorProfile(profile, uid);
                const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
                
                let html = `<div class="user-item" data-uid="${uid}">`;
                if (user.speaking) html = `<div class="user-item speaking" data-uid="${uid}">`;
                html += `<div class="indicator online" style="margin-right:8px;"></div>`; 
                html += `<div style="width:24px;height:24px;flex-shrink:0;margin-right:8px;border-radius:50%;">${ProfileManager.getAvatarHtml(profile)}</div>`;
                html += `<div class="user-main" style="flex:1;display:flex;align-items:center;gap:4px;"><span class="user-name profile-open-link room-user-profile-link" data-uid="${uid}">${Utils.escapeHtml(user.name)}</span>${roleBadgeHtml}<span class="voice-wave"><i></i><i></i><i></i><i></i></span></div>`;
                if (isTargetHost) html += `<span class="host-label">Host</span>`;
                if (isLocal) html += `<span class="you-label">(Вы)</span>`;
                
                if (!isLocal) {
                    html += `<div style="display:flex; align-items:center; gap:5px; margin-top:4px;"><span style="font-size:10px;">VOL</span><input type="range" class="user-mic-vol" data-uid="${uid}" min="0" max="1" step="0.05" value="${RTCManager.getUserVolume(uid) || 1}" style="width: 50px; height: 3px; cursor:pointer;"></div>`;
                }
                html += `</div>`;

                html += `<div class="user-card-actions">`;
                if (!isLocal) {
                    html += `<button class="dm-btn" data-uid="${uid}">ЛС</button>`;
                    const fStatus = myFriends[uid]?.status;
                    if (fStatus === 'accepted') {
                        // Already friends
                    } else if (FriendsManager.pendingFriendRequestsMap[uid]) {
                        html += `<button class="add-friend-btn accept-friend-btn" data-uid="${uid}" style="background:var(--accent); color:#000;">✓ Принять</button>`;
                    } else if (FriendsManager.sentFriendRequests.has(uid)) {
                        html += `<button class="add-friend-btn" data-uid="${uid}" disabled style="opacity:0.5;">Запрос отправлен</button>`;
                    } else {
                        html += `<button class="add-friend-btn" data-uid="${uid}">+Друг</button>`;
                    }
                }
                if ((AppState.isHost || AdminPanel.isCurrentUserCreator()) && !isLocal) {
                    html += `<button class="viewer-settings-btn" data-uid="${uid}" title="Настройки зрителя">Настр.</button>`;
                }
                html += `</div>`;

                // Управление пермиссиями доступно хосту и разработчику
                if ((AppState.isHost || AdminPanel.isCurrentUserCreator()) && !isLocal) {
                    const perms = user.perms || {};
                    html += `
                        <div class="viewer-settings-panel" id="viewer-settings-${uid}">
                            <div class="perm-controls" style="margin-top:0; padding-top:0; border-top:none;">
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="chat" ${perms.chat?'checked':''}> Чат</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="voice" ${perms.voice?'checked':''}> Микрофон</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="player" ${perms.player?'checked':''}> Плеер</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="reactions" ${perms.reactions?'checked':''}> Реакции</label>
                            </div>
                            <button class="danger-btn room-kick-btn" data-uid="${uid}" style="margin-top:8px;">Кикнуть из комнаты</button>
                        </div>
                    `;
                }
                html += `</div>`;
                container.innerHTML += html;
            });
            if (outsideFriendsHtml) {
                container.innerHTML += outsideFriendsHtml;
            }

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
                btn.onclick = () => {
                    if (btn.classList.contains('accept-friend-btn')) {
                        FriendsManager.handleRequest(btn.dataset.uid, true);
                    } else if (btn.disabled) {
                        return;
                    } else {
                        FriendsManager.sendFriendRequest(btn.dataset.uid);
                    }
                };
            });
            container.querySelectorAll('.user-mic-vol').forEach(slider => {
                slider.oninput = () => RTCManager.setUserVolume(slider.dataset.uid, slider.value);
            });
            container.querySelectorAll('.viewer-settings-btn').forEach(btn => {
                btn.onclick = () => {
                    const panel = Utils.$(`viewer-settings-${btn.dataset.uid}`);
                    if (panel) panel.classList.toggle('open');
                };
            });
            container.querySelectorAll('.p-toggle').forEach(t => {
                t.onchange = async (e) => {
                    const targetUid = e.target.dataset.uid; const perm = e.target.dataset.p; const val = e.target.checked;
                    await set(ref(db, `rooms/${AppState.currentRoomId}/presence/${targetUid}/perms/${perm}`), val);
                    const targetName = (AppState.currentPresenceCache?.[targetUid]?.name || targetUid);
                    await this.pushRoomSystemMessage(AppState.currentRoomId, `${this.getActorLabel()} ${val ? 'разрешил' : 'запретил'} "${perm}" для ${targetName}`);
                };
            });
            container.querySelectorAll('.room-kick-btn').forEach(btn => {
                btn.onclick = async () => {
                    const targetUid = btn.dataset.uid;
                    const targetName = (AppState.currentPresenceCache?.[targetUid]?.name || targetUid);
                    if (!confirm(`Кикнуть ${targetName} из комнаты?`)) return;
                    await this.kickUserFromCurrentRoom(targetUid);
                };
            });
        }
    }

    static updateUsersTabButton(ids = [], cache = {}) {
        const btn = Utils.$('tab-users-btn');
        if (!btn) return;

        const list = Array.isArray(ids) ? ids : [];
        const count = list.length;
        const shuffled = [...list].sort(() => Math.random() - 0.5).slice(0, 3);
        const avatarsHtml = shuffled.map((uid) => {
            const profile = AppState.usersCache.get(uid) || {};
            const displayName = profile.name || cache?.[uid]?.name || 'User';
            const safeName = Utils.escapeHtml(displayName);
            const initial = Utils.escapeHtml((displayName[0] || 'U').toUpperCase());
            return `<span class=\"users-tab-avatar\" title=\"${safeName}\">${ProfileManager.getAvatarHtml(profile)}</span>`;
        }).join('');

        btn.innerHTML = `
            <span class="users-tab-inner">
                <span class="users-tab-left"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Люди (<span id="users-count">${count}</span>)</span>
                <span class="users-tab-avatars">${avatarsHtml}</span>
            </span>
        `;
    }

    static forceSyncVideo(d = AppState.lastKnownSyncState) {
        if (!d) return;
        const vid = Utils.$('native-player');
        
        const ageSec = (Date.now() - d.ts) / 1000;
        let state = d.state || (d.type === 'play' ? 'playing' : 'paused');
        let targetTime = d.time;
        
        if (state === 'playing' && ageSec > 1.0) {
            targetTime += ageSec;
        }

        const currentRoom = AppState.roomsCache.get(AppState.currentRoomId) || {};
        const isYt = MediaResolverClient.extractYouTubeId(currentRoom.videoSourceUrl || currentRoom.videoUrl);
        const isRt = MediaResolverClient.extractRutubeId(currentRoom.videoSourceUrl || currentRoom.videoUrl);

        if ((YouTubePlayerManager.player && isYt) || (RutubePlayerManager.player && isRt)) {
            // Unconditionally apply sync from server, but ignore the resulting local video events
            window._isSyncingVideo = true;
            AppState.ignoreVideoEvents = true;
            const Manager = isYt ? YouTubePlayerManager : RutubePlayerManager;
            const currentState = Manager.getState ? Manager.getState() : null;
            
            if (Math.abs(Manager.getCurrentTime() - targetTime) > 1.5) {
                Manager.seek(targetTime);
            }
            if (state === 'playing' && currentState !== 'playing') Manager.play();
            if (state === 'paused' && currentState !== 'paused') {
                if (!currentState) Manager.play(); // Buffer on init
                setTimeout(() => { if (AppState.currentRoomId) Manager.pause(); }, currentState ? 0 : 500);
            }
            
            setTimeout(() => { AppState.ignoreVideoEvents = false; window._isSyncingVideo = false; }, 1500);
            return;
        }

        if (!vid) return;
        
        const executeNativeSync = () => {
            window._isSyncingVideo = true;
            AppState.ignoreVideoEvents = true;
            
            if (Math.abs(vid.currentTime - targetTime) > 1.5) {
                vid.currentTime = targetTime;
            }
            
            if (state === 'playing' && vid.paused) {
                vid.play().catch(()=>{
                    vid.muted = true;
                    vid.play().catch(()=>{});
                    Utils.toast('Браузер заблокировал автовоспроизведение со звуком. Звук отключен.', 'warn');
                });
            } else if (state === 'paused' && !vid.paused) {
                vid.pause();
            }
            
            setTimeout(() => { AppState.ignoreVideoEvents = false; window._isSyncingVideo = false; }, 1500);
        };

        if (vid.readyState >= 1) {
            executeNativeSync();
        } else {
            const onLoadedMetadata = () => {
                executeNativeSync();
                vid.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            vid.addEventListener('loadedmetadata', onLoadedMetadata);
        }
    }

    static startRoomExperienceTimer() {
        if (AppState.roomExpTimer) clearInterval(AppState.roomExpTimer);

        AppState.roomExpTimer = setInterval(async () => {
            if (!AppState.currentRoomId || !AppState.currentUser) return;

            const uid = AppState.currentUser.uid;
            if (!AppState.pendingRoomExp) AppState.pendingRoomExp = 0;
            AppState.pendingRoomExp += 1;

            if (AppState.pendingRoomExp >= 10) {
                const addXp = AppState.pendingRoomExp;
                AppState.pendingRoomExp = 0;
                
                try {
                    const profRef = ref(db, `users/${uid}/profile`);
                    const snap = await get(profRef);
                    if (snap.exists()) {
                        let curXp = Number(snap.val().xp) || 0;
                        let newXp = curXp + addXp;
                        await update(profRef, { xp: newXp });
                        await BadgeManager.checkLevelBadges(uid, newXp);
                    }
                } catch(e) {}
            }
        }, 1000);
    }
    
    static stopRoomExperienceTimer() {
        if (AppState.roomExpTimer) clearInterval(AppState.roomExpTimer);
        AppState.roomExpTimer = null;
        
        if (AppState.pendingRoomExp > 0 && AppState.currentUser) {
             const uid = AppState.currentUser.uid;
             const addXp = AppState.pendingRoomExp;
             AppState.pendingRoomExp = 0;
             const profRef = ref(db, `users/${uid}/profile`);
             get(profRef).then(snap => {
                 if (snap.exists()) {
                     let curXp = Number(snap.val().xp) || 0;
                     let newXp = curXp + addXp;
                     update(profRef, { xp: newXp });
                     BadgeManager.checkLevelBadges(uid, newXp);
                 }
             }).catch(()=>{});
        }
    }

    static leaveRoom() {
        if (!AppState.currentRoomId) return;
        
        RoomManager.stopRoomExperienceTimer();
        
        if (AppState.isHost) {
            let currentTime = 0;
            let isYt = !!YouTubePlayerManager.player;
            let isRt = !!RutubePlayerManager.player;
            if (isYt) currentTime = YouTubePlayerManager.getCurrentTime();
            else if (isRt) currentTime = RutubePlayerManager.getCurrentTime();
            else {
                const vid = Utils.$('native-player');
                if (vid) currentTime = vid.currentTime;
            }
            try {
                set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
                    type: 'pause',
                    state: 'paused',
                    time: currentTime,
                    ts: Date.now()
                }).catch(()=>{});
            } catch(e) {}
        }

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
            delete vid.dataset.playbackKey;
            vid.onplay = null;
            vid.onpause = null;
            vid.onseeked = null;
            vid.onerror = null;
        }
        
        VideoPlaybackManager.destroy();

        AppState.currentPresenceCache = {};
        AppState.usersListRenderToken++;
        AppState.currentRoomId = null;
        AppState.currentRoomJoinTs = 0; // Сбрасываем время при выходе
        AppState.currentTheme = null;
        this.applyRoomTheme('default');
        AppState.isHost = false;
        if (Utils.$('users-list')) Utils.$('users-list').innerHTML = '';
        this.updateUsersTabButton([], {});
        Utils.showScreen('lobby-screen');
    }

    static applyRoomTheme(theme = 'default') {
        const roomScreen = Utils.$('room-screen');
        if (!roomScreen) return;
        
        // Smooth transition trick: fade the old background out OVER the new background
        let fadeLayer = document.createElement('div');
        fadeLayer.style.cssText = `
            position: absolute; inset: 0; z-index: 0; pointer-events: none;
            background: ${getComputedStyle(roomScreen).background};
            transition: opacity 0.8s ease;
            opacity: 1;
        `;
        roomScreen.appendChild(fadeLayer);
        
        Object.keys(ThemeManager.EXTENDED_THEMES).forEach(k => {
            roomScreen.classList.remove('theme-' + k);
        });
        document.body.classList.remove('theme-love-room', 'theme-inverted-room', 'theme-light-room');
        this.stopLoveHearts();
        
        const safeTheme = this.normalizeRoomTheme(theme);
        Ambilight.updateTheme(safeTheme);

        if (safeTheme === 'love') {
            roomScreen.classList.add('theme-love');
            document.body.classList.add('theme-love-room');
            this.startLoveHearts();
            setTimeout(() => this.startLoveHearts(), 150);
        } else {
            if (safeTheme === 'inverted') document.body.classList.add('theme-inverted-room');
            if (safeTheme === 'light') document.body.classList.add('theme-light-room');
            if (safeTheme !== 'default') roomScreen.classList.add(`theme-${safeTheme}`);
        }
        
        // Trigger fade out
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fadeLayer.style.opacity = '0';
                setTimeout(() => fadeLayer.remove(), 850);
            });
        });
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
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, 
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.l.google.com:19305' }
        ]
    };

    static userVolumes = new Map();

    static getUserVolume(uid) {
        return this.userVolumes.has(uid) ? this.userVolumes.get(uid) : 1;
    }

    static setUserVolume(uid, val) {
        this.userVolumes.set(uid, parseFloat(val));
        const audio = AppState.rtc.audioElements.get(uid);
        if (audio) audio.volume = parseFloat(val);
    }

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
            if (this.analysers) this.analysers.delete(this.uid);
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
                await new Promise(r => setTimeout(r, 200)); // Delay to let track fully start
                this.setupAudioAnalyzer(this.uid, stream);
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

        for (const [targetUid, pc] of AppState.rtc.peerConnections) {
            if (!map[targetUid] || !map[targetUid].sessionId || pc.targetSessionId !== map[targetUid].sessionId) {
                this.destroyConnection(targetUid);
            }
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
        pc.targetSessionId = targetSessionId;
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
        audio.volume = this.getUserVolume(uid);
        audio.play().catch(e => console.warn('Audio play failed:', e));
        this.setupAudioAnalyzer(uid, stream);
    }
    
    static setupAudioAnalyzer(uid, stream) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analysers = new Map();
            const animateEQ = () => {
                requestAnimationFrame(animateEQ);
                this.analysers.forEach((analyser, u) => {
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(data);
                    let sum = 0; for(let i=0; i<data.length; i++) sum += data[i];
                    const avg = sum / data.length;
                    
                    const avatarEls = document.querySelectorAll(`[data-uid="${u}"]`);
                    avatarEls.forEach(el => {
                        const avatar = el.querySelector('.avatar-inner-wrap') || el.querySelector('.avatar') || el.querySelector('.users-tab-avatar') || (el.classList.contains('avatar') ? el : el);
                        if (avatar) {
                            if (avg > 10) {
                                avatar.style.boxShadow = `0 0 ${15 + avg}px var(--accent, #0ff), inset 0 0 ${10 + avg/2}px var(--accent, #0ff)`;
                                avatar.style.transform = `scale(${1 + avg / 400})`;
                            } else {
                                avatar.style.boxShadow = '';
                                avatar.style.transform = '';
                            }
                        }
                    });
                });
            };
            requestAnimationFrame(animateEQ);
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        try {
            const source = this.audioCtx.createMediaStreamSource(stream);
            const analyser = this.audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            this.analysers.set(uid, analyser);
        } catch(e) { console.warn("EQ Analyzer error:", e); }
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
        const sidebarOverlay = Utils.$('sidebar-overlay');
        
        if (sidebar) {
            let startX = 0;
            sidebar.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            }, { passive: true });
            sidebar.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                if (startX - endX > 60) { // swipe left
                    sidebar.classList.remove('open');
                    if (sidebarOverlay) sidebarOverlay.classList.remove('open');
                }
            });
        }
        
        // Edge swipe right to open sidebar
        document.addEventListener('touchstart', (e) => {
            if (e.touches[0].clientX < 30 && window.innerWidth <= 1024) { // Edge of screen
                this.edgeStartX = e.touches[0].clientX;
            } else {
                this.edgeStartX = null;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (this.edgeStartX !== null && window.innerWidth <= 1024) {
                const endX = e.changedTouches[0].clientX;
                if (endX - this.edgeStartX > 50 && sidebar) {
                    sidebar.classList.add('open');
                    if (sidebarOverlay) sidebarOverlay.classList.add('open');
                }
            }
        });
    }
}

// ============================================================================
// 10. ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================================

window.onload = () => {

    BadgeManager.init();
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
    
    const viewProfModal = Utils.$('modal-view-profile');
    if (viewProfModal) {
        const vpContent = viewProfModal.querySelector('.modal-content');
        // Removed 3D tilt
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target !== modal) return;
            if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
            else modal.classList.remove('active');
        });
    });
};

class CatalogManager {
    static items = [];
    static activeFilter = 'all';

    static async init() {
        this.bindFilters();
        
        try {
            onValue(ref(db, 'catalog'), (snap) => {
                if (snap.exists() && snap.val()) {
                    const data = snap.val();
                    this.items = Object.keys(data).filter(k => data[k] !== null).map(k => ({id: k, ...data[k]}));
                } else {
                    this.items = [];
                }
                
                this.items.sort((a, b) => {
                    const aHot = (a.isHot === true || a.isHot === 'true') ? 1 : 0;
                    const bHot = (b.isHot === true || b.isHot === 'true') ? 1 : 0;
                    return bHot - aHot;
                });

                this.renderCatalog();
                this.renderAdminCatalog();
            });
        } catch(e) {
            console.error(e);
        }
    }

    static addNewAdminItem() {
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель может управлять товарами', 'error');
        const id = 'item_' + Date.now();
        set(ref(db, `catalog/${id}`), {
            title: 'Новый Товар',
            desc: 'Описание',
            price: '100',
            priceType: 'paid',
            image: '',
            type: 'frame',
            isHot: false
        });
    }

    static async grantFrameMass() {
        if (!AdminPanel.requireAdmin()) return;
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель может выдавать рамки', 'error');
        const frameUrl = Utils.$('admin-event-frame-url')?.value.trim();
        
        if (!frameUrl) return Utils.toast('Укажите изображение (URL)', 'error');
        
        if (!confirm(`Точно ВЫДАТЬ РАМКУ ВСЕМ, кто сейчас онлайн?`)) return;
        
        const usersSnap = await get(ref(db, 'users'));
        const usersData = usersSnap.val() || {};
        let count = 0;
        const updates = {};
        for (const [uid, uData] of Object.entries(usersData)) {
            if (uData.status && uData.status.online) {
                const currentInv = uData.profile?.inventory || [];
                if (!currentInv.includes(frameUrl)) {
                    updates[`users/${uid}/profile/inventory`] = [...currentInv, frameUrl];
                }
                updates[`users/${uid}/profile/frame`] = frameUrl;
                count++;
            }
        }
        if (count > 0) {
            await update(ref(db), updates);
            Utils.toast(`Рамка выдана ${count} пользователям!`);
        } else {
            Utils.toast('У всех онлайн-пользователей уже есть эта или никого нет онлайн.', 'info');
        }
    }

    static bindFilters() {
        const filters = document.querySelectorAll('#catalog-filters .secondary-btn');
        filters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filters.forEach(b => {
                    b.classList.remove('active-filter');
                    b.style.borderColor = '';
                    b.style.background = '';
                });
                const target = e.target;
                target.classList.add('active-filter');
                target.style.borderColor = 'rgba(255,255,255,0.4)';
                target.style.background = 'rgba(255,255,255,0.1)';
                
                this.activeFilter = target.dataset.filter;
                this.renderCatalog();
            });
        });
    }

    static renderCatalog() {
        const list = Utils.$('catalog-list');
        if (!list) return;

        let filtered = [...this.items];
        filtered.sort((a, b) => {
            const aHot = (a.isHot === true || a.isHot === 'true') ? 1 : 0;
            const bHot = (b.isHot === true || b.isHot === 'true') ? 1 : 0;
            return bHot - aHot;
        });

        if (this.activeFilter === 'frames') filtered = filtered.filter(i => i.type === 'frame');
        if (this.activeFilter === 'free') filtered = filtered.filter(i => i.priceType === 'free' || i.price === 'БЕСПЛАТНО' || i.price === '0');
        if (this.activeFilter === 'paid') filtered = filtered.filter(i => i.priceType === 'paid' || (i.price !== 'БЕСПЛАТНО' && i.price !== '0'));

        list.innerHTML = `
            <style>
                @keyframes catalogFadeIn {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .catalog-card-wrapper {
                    position: relative;
                    border-radius: 14px;
                    padding: 2px;
                    background: transparent;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    opacity: 0;
                    animation: catalogFadeIn 0.4s ease forwards;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                .catalog-card-wrapper:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
                }
                .catalog-card-wrapper.is-hot {
                    background: linear-gradient(135deg, #ff4757, #ffa502, #ff4757);
                    background-size: 200% 200%;
                    animation: catalogFadeIn 0.4s ease forwards, fireBgPan 3s linear infinite;
                }
                @keyframes fireBgPan {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .catalog-card-inner {
                    background: rgba(17, 18, 20, 0.4);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    width: 100%;
                    height: 100%;
                    min-height: 250px;
                    display: flex;
                    flex-direction: column;
                    cursor: pointer;
                    overflow: hidden;
                    position: relative;
                    transition: background 0.2s;
                }
                .catalog-card-wrapper:hover .catalog-card-inner {
                    background: rgba(30, 31, 34, 0.5);
                }
                .catalog-card-banner {
                    width: 100%;
                    height: 140px;
                    background: rgba(0, 0, 0, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .catalog-card-info {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    text-align: left;
                    flex: 1;
                }
                .catalog-card-title {
                    color: #fff;
                    font-size: 16px;
                    font-weight: 800;
                    margin-bottom: 4px;
                }
                .catalog-card-type {
                    color: #b5bac1;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-bottom: 12px;
                }
                .catalog-card-bottom {
                    width: 100%;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    margin-top: auto;
                }
                .catalog-card-price {
                    color: #f2f3f5;
                    font-weight: 700;
                    font-size: 14px;
                }
                .catalog-card-status {
                    background: rgba(76, 209, 55, 0.15);
                    color: #4cd137;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 800;
                }
                .catalog-card-wrapper.is-owned .catalog-card-inner {
                    border: 1px solid rgba(76, 209, 55, 0.3);
                }
            </style>
        ` + filtered.map((item, i) => {
            const currentProf = (window.AppState && AppState.currentUser) ? AppState.usersCache.get(AppState.currentUser.uid) : null;
            const inv = currentProf?.inventory || [];
            const isOwned = inv.includes(item.id);
            const isHot = item.isHot === true || item.isHot === 'true';
            return `
            <div class="catalog-card-wrapper ${isHot ? 'is-hot' : ''} ${isOwned ? 'is-owned' : ''}" style="animation-delay: ${i * 0.05}s;">
                <div class="catalog-card-inner" onclick="if(typeof openCatalogItemModal === 'function') openCatalogItemModal('${item.id}')">
                    <div class="catalog-card-banner">
                        ${isHot ? `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="position:absolute; top:8px; left:8px; width:28px; height:28px; object-fit:contain; z-index:5; pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">` : ''}
                        
                        ${item.type === 'sound' ? `
                            <div style="width: 100%; display:flex; align-items:center; justify-content:center; position:relative; z-index:2; padding: 0 16px;">
                                <audio controls src="${item.image}" style="width:100%; height: 35px; border-radius: 8px; outline:none;" onclick="event.stopPropagation();"></audio>
                            </div>
                        ` : `
                            <div style="width: 90px; height: 90px; display:flex; align-items:center; justify-content:center; position:relative; z-index:2;">
                                <div style="width:90px; height:90px; border-radius:50%; background:#111214; position:absolute; top:0; left:0; z-index:1; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);"></div>
                                <img src="${item.image}" style="width:125px;height:125px;object-fit:contain; position:absolute; top:-17.5px; left:-17.5px; z-index:2; pointer-events:none;"/>
                            </div>
                        `}
                    </div>
                    
                    <div class="catalog-card-info">
                        <div class="catalog-card-title">${item.title}</div>
                        <div class="catalog-card-type">${item.type === 'sound' ? 'ЗВУК' : 'УКРАШЕНИЕ АВАТАРА'}</div>
                        
                        <div class="catalog-card-bottom">
                            <div class="catalog-card-price">${item.priceType === 'free' ? 'БЕСПЛАТНО' : item.price + ' ур.'}</div>
                            ${isOwned ? `<div class="catalog-card-status">В КОЛЛЕКЦИИ</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    static renderAdminCatalog() {
        const list = Utils.$('admin-catalog-list');
        if (!list) return;

        list.innerHTML = this.items.map(item => `
            <div style="border: 1px solid var(--border-light); padding: 10px; border-radius: 8px;">
                <input type="text" id="admin-cat-title-${item.id}" value="${item.title}" class="admin-form-input" placeholder="Название" style="margin-bottom: 4px;"/>
                <input type="text" id="admin-cat-desc-${item.id}" value="${item.desc}" class="admin-form-input" placeholder="Описание" style="margin-bottom: 4px;"/>
                <div style="display:flex; gap: 4px; margin-bottom: 4px;">
                    <select id="admin-cat-pricetype-${item.id}" class="admin-form-input" style="flex:1;" onchange="document.getElementById('admin-cat-price-${item.id}').style.display = this.value === 'free' ? 'none' : 'block';">
                        <option value="free" ${item.priceType==='free'?'selected':''}>Бесплатно</option>
                        <option value="paid" ${item.priceType==='paid'?'selected':''}>Уровень</option>
                    </select>
                    <input type="text" id="admin-cat-price-${item.id}" value="${item.price}" class="admin-form-input" placeholder="Уровень" style="flex:1; display: ${item.priceType==='free'?'none':'block'};"/>
                </div>
                <input type="text" id="admin-cat-img-${item.id}" value="${item.image}" class="admin-form-input" placeholder="URL Картинки/Рамки/Звука" style="margin-bottom: 4px;"/>
                <select id="admin-cat-type-${item.id}" class="admin-form-input" style="margin-bottom: 4px;">
                    <option value="frame" ${item.type==='frame'?'selected':''}>Рамка</option>
                    <option value="sound" ${item.type==='sound'?'selected':''}>Звук</option>
                </select>
                <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 8px;">
                    <input type="checkbox" id="admin-cat-ishot-${item.id}" ${(item.isHot === true || item.isHot === 'true') ? 'checked' : ''} style="margin:0; width:16px; height:16px;">
                    <label style="font-size: 12px; color: var(--text-muted); cursor:pointer;" for="admin-cat-ishot-${item.id}">Огненный фон (Акция)</label>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="primary-btn" onclick="CatalogManager.saveAdminItem('${item.id}')" style="flex:1; padding:6px;">Сохранить</button>
                    <button class="danger-btn" onclick="CatalogManager.deleteAdminItem('${item.id}')" style="flex:1; padding:6px;">Удалить</button>
                </div>
            </div>
        `).join('');
    }

    static saveAdminItem(id) {
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель может управлять товарами', 'error');
        const isHotCb = Utils.$(`admin-cat-ishot-${id}`);
        const updates = {
            title: Utils.$(`admin-cat-title-${id}`).value,
            desc: Utils.$(`admin-cat-desc-${id}`).value,
            price: Utils.$(`admin-cat-price-${id}`).value,
            priceType: Utils.$(`admin-cat-pricetype-${id}`).value,
            image: Utils.$(`admin-cat-img-${id}`).value,
            type: Utils.$(`admin-cat-type-${id}`).value,
            isHot: isHotCb ? isHotCb.checked : false
        };
        update(ref(db, `catalog/${id}`), updates).then(() => Utils.toast('Товар сохранен', 'success'));
    }

    static deleteAdminItem(id) {
        if (!AdminPanel.isCurrentUserCreator()) return Utils.toast('Только Создатель может управлять товарами', 'error');
        if(confirm('Удалить товар?')) {
            remove(ref(db, `catalog/${id}`)).then(() => Utils.toast('Товар удален'));
        }
    }
}

window.openCatalogItemModal = function(itemId) {
    const item = CatalogManager.items.find(i => i.id === itemId);
    const modal = Utils.$('modal-catalog-item');
    if (!modal || !item) return;

    Utils.$('catalog-item-title').innerText = item.title;
    Utils.$('catalog-item-desc').innerText = item.desc;
    Utils.$('catalog-item-price').innerText = item.priceType === 'free' ? 'БЕСПЛАТНО' : (item.price + ' ур.');
    Utils.$('catalog-item-type-label').innerText = item.type === 'sound' ? 'ЗВУК' : 'УКРАШЕНИЕ АВАТАРА';

    const imageSolo = Utils.$('catalog-item-image-solo');
    const audioSolo = Utils.$('catalog-item-audio-solo');
    const rightBg = Utils.$('catalog-item-right-bg');
    const blurObj = Utils.$('catalog-item-bg-blur');

    let currentProf = (window.AppState && AppState.currentUser) ? AppState.usersCache.get(AppState.currentUser.uid) : null;
    let fallbackAvatar = 'https://telegra.ph/file/0c9e88d184cf43b448f21.png';

    if (item.type === 'sound') {
        if(imageSolo) imageSolo.style.display = 'none';
        if(audioSolo) {
            audioSolo.style.display = 'block';
            audioSolo.src = item.image;
        }
        if(rightBg) rightBg.style.display = 'none';
        
        const contentPanel = Utils.$('modal-catalog-content-panel');
        if(contentPanel) {
            contentPanel.style.width = '400px';
            contentPanel.style.flexDirection = 'column';
        }
        
        const leftPanel = Utils.$('catalog-item-left-panel');
        if (leftPanel) {
            leftPanel.style.width = '100%';
            leftPanel.style.borderRight = 'none';
        }
        
    } else {
        if(imageSolo) {
            imageSolo.style.display = 'block';
            imageSolo.src = item.image;
        }
        if(audioSolo) {
            audioSolo.style.display = 'none';
            audioSolo.src = '';
        }
        if(rightBg) rightBg.style.display = 'flex';
        
        const contentPanel = Utils.$('modal-catalog-content-panel');
        if(contentPanel) {
            contentPanel.style.width = '800px';
            contentPanel.style.flexDirection = 'row';
        }
        
        const leftPanel = Utils.$('catalog-item-left-panel');
        if (leftPanel) {
            leftPanel.style.width = '40%';
            leftPanel.style.borderRight = '1px solid var(--border-light)';
        }
        
        if (blurObj) {
            blurObj.style.backgroundImage = `url('${item.image}')`;
        }
        const profileAvatarImg = Utils.$('catalog-profile-avatar-img');
        if (profileAvatarImg) {
            // Must be user's CURRENT avatar, falling back accurately
            profileAvatarImg.src = currentProf?.avatar || fallbackAvatar;
        }
        const profileFrame = Utils.$('catalog-profile-frame');
        if (profileFrame) {
            profileFrame.src = item.image;
            profileFrame.style.display = 'block';
        }
        
        Utils.$('catalog-profile-name').innerText = currentProf?.displayName || currentProf?.username || 'Пользователь';
        Utils.$('catalog-profile-user').innerText = currentProf?.username ? '@' + currentProf.username : '@user';
        Utils.$('catalog-profile-message-ph').innerText = 'Сообщение для @' + (currentProf?.username || 'user');
    }

    modal.classList.add('active');
    
    const buyBtn = Utils.$('btn-buy-catalog-item');
    if(buyBtn) {
       const userProfile = (window.AppState && AppState.currentUser) ? AppState.usersCache.get(AppState.currentUser.uid) : null;
       const inventory = userProfile?.inventory || [];
       const isOwned = inventory.includes(item.id);
       buyBtn.innerText = isOwned ? 'Применить' : (item.priceType === 'free' || String(item.price).trim().toUpperCase() === 'БЕСПЛАТНО' || String(item.price).trim().toUpperCase() === 'FREE' || item.price === '0') ? 'Получить' : `Купить (${item.price} ур.)`;
       buyBtn.style.background = isOwned ? 'var(--panel)' : '#fff';
       buyBtn.style.color = isOwned ? 'var(--text-main)' : '#000';
       if(isOwned) buyBtn.style.border = '1px solid var(--border-light)';
       else buyBtn.style.border = 'none';

       buyBtn.onclick = async () => {
           if (!AppState.currentUser) return Utils.toast('Авторизуйтесь для покупки', 'error');
           const uid = AppState.currentUser.uid;
           const currentProf = AppState.usersCache.get(uid);
           const inv = currentProf?.inventory ? [...currentProf.inventory] : [];
           
           if (inv.includes(item.id)) {
               if (item.type === 'frame' || !item.type) {
                   await update(ref(db), { [`users/${uid}/profile/frame`]: item.image });
                   Utils.toast('Рамка применена!', 'success');
               } else if (item.type === 'sound') {
                   // No profile application for sound directly from catalog modal yet
                   Utils.toast('Звук выбран, но применение профильного звука пока в разработке', 'info');
               }
               modal.classList.remove('active');
           } else {
               const isFree = item.priceType === 'free' || String(item.price).trim().toUpperCase() === 'БЕСПЛАТНО' || String(item.price).trim().toUpperCase() === 'FREE' || item.price === '0';
               
               if (isFree) {
                   inv.push(item.id);
                   await update(ref(db), { [`users/${uid}/profile/inventory`]: inv });
                   Utils.toast('Товар добавлен в инвентарь!', 'success');
                   buyBtn.innerText = 'Применить';
                   buyBtn.style.background = 'var(--panel)';
                   buyBtn.style.color = 'var(--text-main)';
                   buyBtn.style.border = '1px solid var(--border-light)';
                   
                   currentProf.inventory = inv;
                   AppState.usersCache.set(uid, currentProf);
                   if (window.SoundpadController) window.SoundpadController.renderGrid();
               } else {
                   let cost = parseInt(item.price, 10) || 0;
                   let curLevel = Number(currentProf?.level) || 0;
                   if (curLevel >= cost) {
                       inv.push(item.id);
                       await update(ref(db), { [`users/${uid}/profile/inventory`]: inv });
                       Utils.toast('Уровень подходит. Товар добавлен в инвентарь!', 'success');
                       buyBtn.innerText = 'Применить';
                       buyBtn.style.background = 'var(--panel)';
                       buyBtn.style.color = 'var(--text-main)';
                       buyBtn.style.border = '1px solid var(--border-light)';
                       
                       currentProf.inventory = inv;
                       AppState.usersCache.set(uid, currentProf);
                       if (window.SoundpadController) window.SoundpadController.renderGrid();
                   } else {
                       Utils.toast('Недостаточно уровней (нужно: ' + cost + ')', 'error');
                   }
               }
           }
       };;
    }

    const previewBtn = Utils.$('btn-preview-catalog-item');
    if(previewBtn) {
        previewBtn.style.display = 'none';
    }
};

window.CatalogManager = CatalogManager;
window.ProfileManager = ProfileManager;
window.FriendsManager = FriendsManager;

window.addEventListener('popstate', (e) => {
    if (window.AppState && AppState.currentRoomId) {
        RoomManager.leaveRoom();
    }
    if (e.state && e.state.screenId) {
        if (e.state.screenId === 'room-screen') {
            Utils.showScreen('lobby-screen', false);
            window.history.replaceState({ screenId: 'lobby-screen' }, "", "/lobby");
        } else {
            Utils.showScreen(e.state.screenId, false);
        }
    }
});

// Initialize on load so it's visible to guests too
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CatalogManager.init());
} else {
    CatalogManager.init();
}

setTimeout(() => {
    // Global listeners for the pushed events
    onValue(ref(db, 'admin/actions/globalGhostWhispers'), (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `ghostWhispersSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        
        const words = ["почему?", "ты слышишь?", "темнота...", "оно здесь", "не оборачивайся", "холодно", "тссс...", "беги", "мы видим"];
        
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                el.innerText = words[Math.floor(Math.random() * words.length)];
                el.style.cssText = `position:fixed; left:${Math.random()*90}vw; top:${Math.random()*90}vh; color:rgba(255,255,255,0.1); font-size:${10 + Math.random()*20}px; z-index:999990; pointer-events:none; filter:blur(${Math.random()*4}px); opacity:0; transition:opacity 2s ease, transform 4s ease; transform:scale(0.8) translateY(10px); text-shadow:0 0 10px rgba(255,255,255,0.2);`;
                document.body.appendChild(el);
                
                requestAnimationFrame(() => {
                    el.style.opacity = '0.7';
                    el.style.transform = 'scale(1) translateY(0px)';
                    setTimeout(() => {
                        el.style.opacity = '0';
                        el.style.transform = 'scale(1.1) translateY(-10px)';
                        setTimeout(() => el.remove(), 2000);
                    }, 2000 + Math.random()*2000);
                });
            }, Math.random() * 3000);
        }
    });
    
    // Teleport Listener (inside setTimout 1000 so AppState is ready)
    setTimeout(() => {
        if (!AppState.currentUser) return;
        onValue(ref(db, `admin/curses/teleport/${AppState.currentUser.uid}`), (snap) => {
            const data = snap.val();
            if(!data || !data.roomId || Date.now() - data.ts > 10000) return;
            const marker = `teleportSeen:${data.ts}`;
            if(sessionStorage.getItem(marker)) return;
            sessionStorage.setItem(marker, '1');
            Utils.toast('Вас телепортировали!', 'info');
            if (AppState.currentRoomId) RoomManager.leaveRoom();
            setTimeout(() => {
                RoomManager.joinRoom(data.roomId);
            }, 500);
        });
    }, 2000);

    onValue(ref(db, 'admin/actions/globalGodVoice'), (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `godVoiceSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        
        let el = document.getElementById('god-voice-el');
        if (!el) {
            el = document.createElement('div');
            el.id = 'god-voice-el';
            el.className = 'global-god-voice';
            el.innerHTML = `<div class="global-god-voice-text"></div>`;
            document.body.appendChild(el);
        }
        
        const txtEl = el.querySelector('.global-god-voice-text');
        txtEl.innerHTML = '';
        const totalDuration = payload.duration || 8000;
        el.style.setProperty('--gv-duration', totalDuration + 'ms');
        el.classList.add('active');
        
        // Typewriter effect (slower and cinematic)
        const textToType = payload.text || '';
        let i = 0;
        const typeInterval = setInterval(() => {
            if (i < textToType.length) {
                const charSpan = document.createElement('span');
                charSpan.innerText = textToType.charAt(i);
                charSpan.style.opacity = '0';
                charSpan.style.transition = 'opacity 1s filter 1s';
                charSpan.style.filter = 'blur(4px)';
                txtEl.appendChild(charSpan);
                requestAnimationFrame(() => {
                    charSpan.style.opacity = '1';
                    charSpan.style.filter = 'blur(0px)';
                });
                i++;
            } else {
                clearInterval(typeInterval);
            }
        }, 120); // 120ms per char
        
        // Remove slightly after finishing typing (e.g. 5 seconds after duration)
        setTimeout(() => {
            el.classList.remove('active');
            setTimeout(() => { txtEl.innerHTML = ''; }, 1000); // clear after fade out
        }, totalDuration);
    });

    onValue(ref(db, 'admin/actions/globalFlashbang'), (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `flashbangSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        
        let el = document.createElement('div');
        el.className = 'global-flashbang';
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; }, 300);
        setTimeout(() => { el.remove(); }, 4300);
    });

    onValue(ref(db, 'admin/actions/globalScreenShake'), (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `shakeSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        
        document.body.classList.add('screen-shake-active');
        setTimeout(() => { document.body.classList.remove('screen-shake-active'); }, 3000);
    });

    onValue(ref(db, 'admin/actions/globalVideoHijack'), (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `hijackSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        
        if (AppState.currentRoomId) {
            const syncRef = ref(db, `rooms/${AppState.currentRoomId}/sync`);
            set(syncRef, {
                type: 'source', src: payload.url, mediaType: 'youtube', ts: Date.now()
            });
            Utils.toast('СИЛОВОЙ УГОН ВИДЕО СОВЕРШЕН!', 'error');
        }
    });

    // Watch Party Draw System

    let drawLayer = document.createElement('canvas');
    drawLayer.id = 'draw-canvas-layer';
    drawLayer.style.display = 'none';
    const vc = document.querySelector('.video-container');
    if (vc) vc.appendChild(drawLayer);
    
    let isDrawing = false;
    let drawMode = false;
    if (drawLayer && vc) {
        // resize
        const rs = () => { drawLayer.width = vc.clientWidth; drawLayer.height = vc.clientHeight; };
        window.addEventListener('resize', rs); rs();
        
        // Add toggle button to top bar
        const rtb = document.querySelector('.room-top-bar');
        if (rtb) {
            const dbg = document.createElement('button');
            dbg.className = 'secondary-btn draw-toggle-btn';
            dbg.innerText = 'Рисовать Маркером';
            dbg.style.width = 'auto'; dbg.style.padding = '8px 12px'; dbg.style.marginLeft = '10px';
            rtb.appendChild(dbg);
            dbg.onclick = () => {
                drawMode = !drawMode;
                dbg.classList.toggle('active', drawMode);
                drawLayer.style.display = drawMode ? 'block' : 'none';
                drawLayer.style.pointerEvents = drawMode ? 'auto' : 'none';
                if (drawMode) {
                    drawLayer.width = vc.clientWidth;
                    drawLayer.height = vc.clientHeight;
                }
            };
        }
        
        const ctx = drawLayer.getContext('2d');
        const drawPx = (e) => {
            if (!isDrawing || !drawMode) return;
            const r = drawLayer.getBoundingClientRect();
            const x = e.clientX - r.left; const y = e.clientY - r.top;
            ctx.fillStyle = 'red';
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
            if (AppState.currentRoomId) {
                set(ref(db, `rooms/${AppState.currentRoomId}/drawEvents/${Date.now()}`), {
                    x: x/drawLayer.width, y: y/drawLayer.height
                });
            }
        };
        drawLayer.onmousedown = () => isDrawing = true;
        drawLayer.onmouseup = () => isDrawing = false;
        drawLayer.onmousemove = drawPx;
        
        // Listener for remote draws
        setInterval(() => {
            if (!AppState.currentRoomId) return;
            onValue(ref(db, `rooms/${AppState.currentRoomId}/drawEvents`), snap => {
                const vals = snap.val();
                if (!vals) { ctx.clearRect(0,0,drawLayer.width, drawLayer.height); return; }
                ctx.clearRect(0,0,drawLayer.width, drawLayer.height);
                Object.values(vals).forEach(pt => {
                    ctx.fillStyle = 'red';
                    ctx.beginPath(); ctx.arc(pt.x*drawLayer.width, pt.y*drawLayer.height, 3, 0, Math.PI*2); ctx.fill();
                });
            }, { onlyOnce: true });
        }, 1000);
    }
    
    
    // 20. Anonymous Roulette Button
    setInterval(() => {
        const rf = document.querySelector('.lobby-header');
        if (rf && !rf.querySelector('.roulette-btn')) {
            const rb = document.createElement('button');
            rb.className = 'primary-btn roulette-btn';
            rb.style.background = '#e91e63'; rb.style.color = '#fff'; rb.style.width = 'auto';
            rb.innerText = '🎲 Случайная комната';
            rb.onclick = () => {
                get(ref(db, 'rooms')).then(snap => {
                    const rs = snap.val(); if(!rs) return;
                    // filter private and roomless
                    const keys = Object.keys(rs).filter(k => !rs[k].isPrivate);
                    if (keys.length === 0) return Utils.toast('Нет доступных публичных комнат', 'error');
                    const rKey = keys[Math.floor(Math.random() * keys.length)];
                    RoomManager.attemptJoinRoom(rKey, rs[rKey]);
                });
            };
            rf.appendChild(rb);
        }
    }, 1000);
    
}, 3000);

window.triggerAdminAction = (action) => {
    const showAdminPrompt = (title, inputs, onSubmit) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
        
        // Modal container
        const modal = document.createElement('div');
        modal.style.cssText = 'background:rgba(20,20,22,0.9); border:1px solid var(--accent); border-radius:16px; width:90%; max-width:400px; padding:24px; box-shadow:0 10px 40px rgba(0,0,0,0.5); transform:translateY(20px); transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
        
        // Title
        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'color:#fff; margin:0 0 16px 0; font-size:18px; font-weight:700;';
        titleEl.innerText = title;
        modal.appendChild(titleEl);
        
        const inputEls = [];
        inputs.forEach(inp => {
            const el = document.createElement('input');
            el.type = 'text';
            el.placeholder = inp.placeholder;
            el.style.cssText = 'width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px 16px; border-radius:8px; margin-bottom:12px; font-size:14px; outline:none; transition:border-color 0.2s;';
            el.onfocus = () => el.style.borderColor = 'var(--accent)';
            el.onblur = () => el.style.borderColor = 'rgba(255,255,255,0.1)';
            modal.appendChild(el);
            inputEls.push(el);
        });

        // Buttons row
        const btnsRow = document.createElement('div');
        btnsRow.style.cssText = 'display:flex; gap:10px; margin-top:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn';
        cancelBtn.innerText = 'Отмена';
        cancelBtn.style.flex = '1';
        cancelBtn.onclick = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'primary-btn';
        submitBtn.innerText = 'Выполнить';
        submitBtn.style.flex = '1';
        submitBtn.onclick = () => {
            const vals = inputEls.map(el => el.value.trim());
            onSubmit(vals);
            cancelBtn.onclick();
        };

        inputEls[inputEls.length - 1].onkeydown = (e) => {
            if (e.key === 'Enter') submitBtn.click();
        };

        btnsRow.appendChild(cancelBtn);
        btnsRow.appendChild(submitBtn);
        modal.appendChild(btnsRow);
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Open anim
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
            if (inputEls.length) inputEls[0].focus();
        });
    };

    if (action === 'flashbang') {
        set(ref(db, 'admin/actions/globalFlashbang'), { ts: Date.now() });
    } else if (action === 'shake') {
        set(ref(db, 'admin/actions/globalScreenShake'), { ts: Date.now() });
    } else if (action === 'godVoice') {
        showAdminPrompt("Голос Бога", [{placeholder: "Введите текст для всех зрителей..."}], (vals) => {
            if (!vals[0]) return Utils.toast('Текст не может быть пустым', 'error');
            set(ref(db, 'admin/actions/globalGodVoice'), { ts: Date.now(), text: vals[0], duration: 8000 });
        });
    } else if (action === 'hijack') {
        showAdminPrompt("Угон видео", [{placeholder: "URL (YouTube) для угона..."}], (vals) => {
            if (!vals[0]) return Utils.toast('URL не может быть пустым', 'error');
            set(ref(db, 'admin/actions/globalVideoHijack'), { ts: Date.now(), url: vals[0] });
        });
    } else if (action === 'puppeteer') {
        showAdminPrompt("Режим Кукловода", [{placeholder: "UID пользователя (оставьте пустым для отключения)"}], (vals) => {
            const puppetUid = vals[0].trim();
            if (puppetUid) {
                window.puppeteerUid = puppetUid;
                Utils.toast(`Режим Кукловода активирован для UID: ${puppetUid}. Ваши сообщения в чате теперь будут отправляться от его лица.`, 'success');
            } else {
                window.puppeteerUid = null;
                Utils.toast('Режим Кукловода деактивирован', 'info');
            }
        });
    } else if (action === 'incognito') {
        window.isIncognito = !window.isIncognito;
        Utils.toast(window.isIncognito ? 'Инкогнито ВКЛЮЧЕН. Вы невидимы.' : 'Инкогнито ВЫКЛЮЧЕН.', 'success');
    } else if (action === 'uwuCurse') {
        showAdminPrompt("Проклятие UwU", [{placeholder: "UID пользователя"}], (vals) => {
            const curUid = vals[0].trim();
            if(!curUid) return;
            set(ref(db, `admin/curses/uwu/${curUid}`), Date.now());
            Utils.toast('Проклятие наложено.', 'success');
        });
    } else if (action === 'shadowClone') {
        window.isShadowCloneActive = !window.isShadowCloneActive;
        Utils.toast(window.isShadowCloneActive ? 'Shadow Clone ВКЛЮЧЕН.' : 'Shadow Clone ВЫКЛЮЧЕН.', 'success');
    } else if (action === 'ghostWhispers') {
        set(ref(db, 'admin/actions/globalGhostWhispers'), { ts: Date.now() });
        Utils.toast('Шепот призраков отправлен.', 'success');
    } else if (action === 'thanosSnapROOM') {
        if(!AppState.currentRoomId) return Utils.toast('Вы не в комнате', 'error');
        set(ref(db, `rooms/${AppState.currentRoomId}/chatAction`), { type: 'thanosSnap', ts: Date.now() });
    } else if (action === 'teleport') {
        showAdminPrompt("Random Teleport", [{placeholder: "UID пользователя для телепортации"}], async (vals) => {
            const uid = vals[0].trim();
            if(!uid) return;
            const roomsSnap = await get(ref(db, 'rooms'));
            if(roomsSnap.exists()) {
                const rooms = Object.keys(roomsSnap.val() || {}).filter(k => roomsSnap.val()[k]?.type === 'public');
                if(rooms.length > 0) {
                    const rndRoom = rooms[Math.floor(Math.random() * rooms.length)];
                    set(ref(db, `admin/curses/teleport/${uid}`), { roomId: rndRoom, ts: Date.now() });
                    Utils.toast('Юзер телепортирован!', 'success');
                } else Utils.toast('Нет публичных комнат', 'error');
            }
        });
    } else if (action === 'cursorSync') {
        if(!AppState.currentRoomId) return Utils.toast('Вы не в комнате', 'error');
        showAdminPrompt("Режим Cursor Sync (0=Выкл, 1=Вкл)", [{placeholder: "1"}], (vals) => {
            const v = vals[0].trim();
            set(ref(db, `rooms/${AppState.currentRoomId}/cursorSync`), v === '1');
            Utils.toast('Изменено', 'success');
        });
    }
};

window.addEventListener('pagehide', () => {
    if (AppState.currentRoomId && AppState.isHost) {
        let currentTime = 0;
        let isYt = !!YouTubePlayerManager.player;
        let isRt = !!RutubePlayerManager.player;
        if (isYt) currentTime = YouTubePlayerManager.getCurrentTime();
        else if (isRt) currentTime = RutubePlayerManager.getCurrentTime();
        else {
            const vid = Utils.$('native-player');
            if (vid) currentTime = vid.currentTime;
        }
        try {
            set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
                type: 'pause',
                state: 'paused',
                time: currentTime,
                ts: Date.now()
            }).catch(()=>{});
        } catch(e) {}
    }
});

// ============================================================================
// MARKETPLACE & SOUNDPAD
// ============================
window.SoundpadController = class SoundpadController {
    static loadPad() {
        if(!AppState.currentRoomId) return;
        const triggerRef = ref(db, `rooms/${AppState.currentRoomId}/soundTrigger`);
        onValue(triggerRef, (snap) => {
            const data = snap.val();
            if(data && data.timestamp && (Date.now() - data.timestamp < 5000)) {
                if(data.triggeredBy === AppState.currentUser?.uid) return;
                
                // prevent re-playing the same event
                const marker = `sound:${data.timestamp}:${data.triggeredBy}`;
                if (sessionStorage.getItem(marker)) return;
                sessionStorage.setItem(marker, '1');
                
                this.playAudio(data.url);
                const senderName = AppState.currentPresenceCache?.[data.triggeredBy]?.name || 'Хост';
                Utils.toast(`${senderName} запустил звук`, 'info');
            }
        });
        this.renderGrid();
    }
    static playAudio(url) {
        if(!url) return;
        const volSlider = Utils.$('soundpad-vol-slider');
        const vol = volSlider ? parseFloat(volSlider.value) : 0.8;
        const a = new Audio(url);
        a.volume = vol;
        a.play().catch(()=>{});
    }
    static async renderGrid() {
        const grid = Utils.$('soundpad-grid');
        if(!grid) return;
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const currentProf = AppState.usersCache.get(uid);
        const ownedIds = currentProf?.inventory || [];
        const sounds = [];
        if (window.CatalogManager && CatalogManager.items) {
            ownedIds.forEach(id => {
                const snd = CatalogManager.items.find(i => i.id === id && i.type === 'sound');
                if (snd) sounds.push({ id: snd.id, name: snd.title, url: snd.image, hotkey: '' });
            });
        }
        
        if (sounds.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">Нет звуков.<br>Приобретайте их в Каталоге!</div>';
            return;
        }

        grid.innerHTML = sounds.map(s => `
            <div class="sound-btn" onclick="SoundpadController.triggerSound('${s.url}')" style="background: linear-gradient(145deg, rgba(30,30,40,0.8), rgba(15,15,20,0.8)); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 15px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div class="sound-icon" style="font-size: 28px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)); transition: transform 0.2s;">🎵</div>
                <div class="sound-name" style="font-size: 12px; font-weight: 700; color: #fff; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; max-width: 100%;">
                    ${s.name}
                </div>
            </div>
        `).join('');
    }
    static triggerSound(url) {
        if(!AppState.currentRoomId) return;
        if(this.lastTrigger && Date.now() - this.lastTrigger < 3000) return Utils.toast('Не спамьте!', 'error');
        this.lastTrigger = Date.now();
        this.playAudio(url);
        set(ref(db, `rooms/${AppState.currentRoomId}/soundTrigger`), { url, timestamp: Date.now(), triggeredBy: AppState.currentUser?.uid });
    }
};
window.AdminSoundManager = class { static initAdmin() {} };
window.ShopController = class { static loadShop() {} };
