import { escapeHtml, generateAvatarSvgDataUri } from './utils.js';

// --- STRICT UI ISOLATION LAYER ---
// Этот файл управляет всеми манипуляциями с DOM.

const els = {};
const cacheEls = () => {
    const ids = [
        'auth-screen', 'lobby-screen', 'room-screen', 'toast-container', 
        'tab-login', 'tab-register', 'form-login', 'form-register',
        'login-email', 'login-password', 'btn-login-email',
        'reg-name', 'reg-email', 'reg-password', 'btn-register-email', 'btn-google-auth',
        'my-avatar', 'user-display-name', 'user-online-status', 'btn-edit-profile', 'btn-logout',
        'btn-all-rooms', 'btn-friends-sidebar', 'sidebar-friends', 'rooms-grid', 'search-rooms', 'btn-open-modal',
        'modal-create', 'room-name', 'room-link', 'room-private', 'room-password', 'btn-create-finish',
        'modal-join', 'join-password', 'btn-join-cancel', 'btn-join-confirm',
        'room-title', 'video-container', 'chat-messages', 'chat-input', 'send-btn', 
        'tab-chat', 'tab-members', 'room-users', 'mic-btn', 'voice-volume', 'btn-leave-room'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            els[id] = el;
        } else {
            console.warn(`UI: Элемент с id="${id}" не найден в HTML`);
        }
    });
};

export const UI = {
    init() {
        cacheEls();
        this.setupAuthTabs();
        this.setupChatTabs();
        this.setupModalLogic();
    },
    // Добавьте это внутрь объекта UI в ui.js
getSearchQuery() {
    return els['search-rooms']?.value || '';
},

bindAuth(loginCb, regCb, googleCb) {
    if (els['btn-login-email']) els['btn-login-email'].onclick = (e) => { e.preventDefault(); loginCb(); };
    if (els['btn-register-email']) els['btn-register-email'].onclick = (e) => { e.preventDefault(); regCb(); };
    if (els['btn-google-auth']) els['btn-google-auth'].onclick = googleCb;
},

    // --- ЭКРАНЫ ---
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (els[screenId]) els[screenId].classList.add('active');
    },

    // --- АВТОРИЗАЦИЯ ---
    setupAuthTabs() {
        if (!els['tab-login'] || !els['tab-register']) return;
        
        els['tab-login'].onclick = () => {
            els['tab-login'].classList.add('active');
            els['tab-register'].classList.remove('active');
            els['form-login'].classList.add('active');
            els['form-register'].classList.remove('active');
        };
        els['tab-register'].onclick = () => {
            els['tab-register'].classList.add('active');
            els['tab-login'].classList.remove('active');
            els['form-register'].classList.add('active');
            els['form-login'].classList.remove('active');
        };
    },

    getAuthData() {
        return {
            login: { e: els['login-email']?.value, p: els['login-password']?.value },
            reg: { n: els['reg-name']?.value, e: els['reg-email']?.value, p: els['reg-password']?.value }
        };
    },

    // --- ЛОББИ И ПРОФИЛЬ ---
    updateSelfProfile(name, color, status, isOnline) {
        if (els['user-display-name']) els['user-display-name'].textContent = name;
        if (els['user-online-status']) {
            els['user-online-status'].textContent = status;
            els['user-online-status'].style.color = isOnline ? '#2ed573' : '#ff4757';
        }
        if (els['my-avatar']) {
            els['my-avatar'].src = generateAvatarSvgDataUri(name, color);
        }
    },

    renderRooms(rooms, filter, onJoin) {
        if (!els['rooms-grid']) return;
        els['rooms-grid'].innerHTML = '';
        
        Object.entries(rooms).forEach(([id, room]) => {
            if (filter && !room.name.toLowerCase().includes(filter.toLowerCase())) return;

            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-info">
                    <h3>${escapeHtml(room.name)}</h3>
                    <p>${room.private ? '🔒 Приватная' : '🔓 Открытая'}</p>
                </div>
                <button class="join-btn">Войти</button>
            `;
            card.querySelector('button').onclick = () => onJoin(id, room);
            els['rooms-grid'].appendChild(card);
        });
    },

    // --- КОМНАТА И ЧАТ ---
    setupChatTabs() {
        // Проверка на существование элементов (защита от null)
        if (!els['tab-chat'] || !els['tab-members'] || !els['chat-messages'] || !els['room-users']) return;

        els['tab-chat'].onclick = () => {
            els['tab-chat'].classList.add('active');
            els['tab-members'].classList.remove('active');
            els['chat-messages'].style.display = 'block';
            els['room-users'].style.display = 'none';
        };

        els['tab-members'].onclick = () => {
            els['tab-members'].classList.add('active');
            els['tab-chat'].classList.remove('active');
            els['chat-messages'].style.display = 'none';
            els['room-users'].style.display = 'block';
        };
    },

    renderChatMsg(msg, myUid, canControl, isSystem = false) {
        if (!els['chat-messages']) return;
        const div = document.createElement('div');
        div.className = `message ${isSystem ? 'system' : (msg.fromUid === myUid ? 'mine' : '')}`;
        
        if (isSystem) {
            div.innerHTML = `<span class="sys-text">${escapeHtml(msg.content)}</span>`;
        } else {
            div.innerHTML = `
                <span class="msg-user">${escapeHtml(msg.user)}</span>
                <span class="msg-content">${escapeHtml(msg.content)}</span>
            `;
        }
        
        els['chat-messages'].appendChild(div);
        els['chat-messages'].scrollTop = els['chat-messages'].scrollHeight;
    },

    // --- МОДАЛКИ ---
    setupModalLogic() {
        if (els['btn-open-modal']) {
            els['btn-open-modal'].onclick = () => els['modal-create'].classList.add('active');
        }
        if (els['room-private']) {
            els['room-private'].onchange = (e) => {
                els['room-password'].style.display = e.target.checked ? 'block' : 'none';
            };
        }
    },

    showJoinModal() { els['modal-join']?.classList.add('active'); },
    hideJoinModal() { els['modal-join']?.classList.remove('active'); },
    getJoinPassword() { return els['join-password']?.value || ''; },

    // --- УВЕДОМЛЕНИЯ ---
    showToast(text) {
        if (!els['toast-container']) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = text;
        els['toast-container'].appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // --- ПЛЕЕР ---
    setupVideoPlayer(link, isHost) {
        if (!els['video-container']) return;
        // Упрощенный пример вставки iframe YouTube
        const videoId = link.split('v=')[1] || link.split('/').pop();
        els['video-container'].innerHTML = `
            <iframe id="main-player" width="100%" height="100%" 
                src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
                frameborder="0" allow="autoplay; encrypted-media"></iframe>
        `;
    },

    // --- БИНДИНГИ (ДЛЯ main.js) ---
    bindAuthEvents(loginCb, regCb, googleCb) {
        if (els['btn-login-email']) els['btn-login-email'].onclick = (e) => { e.preventDefault(); loginCb(); };
        if (els['btn-register-email']) els['btn-register-email'].onclick = (e) => { e.preventDefault(); regCb(); };
        if (els['btn-google-auth']) els['btn-google-auth'].onclick = googleCb;
    },

    bindLobbyEvents(createCb, logoutCb) {
        if (els['btn-create-finish']) els['btn-create-finish'].onclick = createCb;
        if (els['btn-logout']) els['btn-logout'].onclick = logoutCb;
    },

    bindChatInput(sendCb) {
        if (els['send-btn']) els['send-btn'].onclick = sendCb;
        if (els['chat-input']) {
            els['chat-input'].onkeydown = (e) => { if (e.key === 'Enter') sendCb(); };
        }
    },

    bindRoomActions(leaveCb) {
        if (els['btn-leave-room']) els['btn-leave-room'].onclick = leaveCb;
    },

    bindMic(micCb) {
        if (els['mic-btn']) els['mic-btn'].onclick = micCb;
    },

    setMicActive(active) {
        if (els['mic-btn']) {
            els['mic-btn'].classList.toggle('muted', !active);
            els['mic-btn'].textContent = active ? '🎤' : '🔇';
        }
    }
};