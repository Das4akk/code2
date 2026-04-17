import { escapeHtml, generateAvatarSvgDataUri, parseTimecodes } from 'JS/utils.js'; // Убедитесь, что здесь НЕТ слова /js/

// --- STRICT UI ISOLATION LAYER ---
// Это ЕДИНСТВЕННЫЙ файл, которому разрешено использовать document.getElementById, querySelector и манипулировать DOM.

const els = {};
const cacheEls = () => {
    ['auth-screen', 'lobby-screen', 'room-screen', 'toast-container', 
     'tab-login', 'tab-register', 'form-login', 'form-register',
     'login-email', 'login-password', 'btn-login-email',
     'reg-name', 'reg-email', 'reg-password', 'btn-register-email', 'btn-google-auth',
     'my-avatar', 'user-display-name', 'user-online-status', 'btn-edit-profile', 'btn-logout',
     'btn-all-rooms', 'btn-friends-sidebar', 'sidebar-friends', 'rooms-grid', 'search-rooms', 'btn-open-modal',
     'modal-create', 'modal-create-title', 'room-name', 'room-link', 'room-private', 'room-password', 'btn-close-modal', 'btn-create-finish',
     'modal-join', 'join-password', 'btn-join-cancel', 'btn-join-confirm',
     'modal-profile', 'profile-name', 'profile-status', 'profile-volume', 'profile-bio', 'profile-color', 'btn-profile-cancel', 'btn-profile-save',
     'room-title-text', 'btn-leave-room', 'btn-open-room-invite', 'btn-edit-room', 'btn-delete-room',
     'voice-volume', 'native-player', 'chat-messages', 'chat-input', 'send-btn', 'mic-btn',
     'tab-chat-btn', 'tab-users-btn', 'users-list', 'users-count', 'reaction-layer', 'remote-audio-container',
     'modal-dm-chat', 'dm-chat-title', 'btn-dm-close', 'dm-messages', 'dm-input', 'btn-dm-send',
     'modal-room-invite', 'btn-room-invite-close', 'room-invite-list', 'friends-list-panel', 'online-count', 'online-counter'
    ].forEach(id => els[id] = document.getElementById(id));
};

export const UI = {
    init: () => {
        cacheEls();
        UI.setupAuthTabs();
        UI.setupChatTabs();
        UI.setupModals();
    },

    // Getters for inputs
    getAuthInput: () => ({
        le: els['login-email'].value, lp: els['login-password'].value,
        rn: els['reg-name'].value, re: els['reg-email'].value, rp: els['reg-password'].value
    }),
    getRoomCreateInput: () => ({
        name: els['room-name'].value, link: els['room-link'].value, 
        isPrivate: els['room-private'].checked, password: els['room-password'].value
    }),
    getProfileInput: () => ({
        name: els['profile-name'].value, status: els['profile-status'].value,
        volume: els['profile-volume'].value, bio: els['profile-bio'].value, color: els['profile-color'].value
    }),
    getJoinPassword: () => els['join-password'].value,
    getSearchQuery: () => els['search-rooms'].value,
    getChatInput: () => {
        const v = els['chat-input'].value;
        els['chat-input'].value = '';
        return v;
    },
    getDmInput: () => {
        const v = els['dm-input'].value;
        els['dm-input'].value = '';
        return v;
    },

    // Setters & Renderers
    showScreen: (screenId) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (els[screenId]) els[screenId].classList.add('active');
    },

    showToast: (msg) => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = msg;
        els['toast-container'].appendChild(toast);
        setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3400);
    },

    updateSelfProfile: (name, color, statusLabel, isOnline) => {
        if(els['user-display-name']) els['user-display-name'].innerText = name || 'User';
        if(els['my-avatar']) els['my-avatar'].src = generateAvatarSvgDataUri(name, color);
        if(els['user-online-status']) {
            els['user-online-status'].innerText = statusLabel;
            els['user-online-status'].style.color = isOnline ? '#2ed573' : '#888';
        }
    },

    setOnlineCount: (count) => {
        if (els['online-count']) els['online-count'].innerText = count;
        if (els['online-counter']) els['online-counter'].style.display = count > 0 ? 'flex' : 'none';
    },

    renderRooms: (roomsCache, searchQuery, onJoinClick) => {
        const grid = els['rooms-grid'];
        if (!grid) return;
        grid.innerHTML = '';
        const q = (searchQuery || '').trim().toLowerCase();
        const keys = Object.keys(roomsCache || {});
        
        if (!keys.length) {
            grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>';
            return;
        }

        keys.forEach(id => {
            const room = roomsCache[id];
            const name = room.name || '';
            const host = room.adminName || '';
            if (q && !`${name} ${host}`.toLowerCase().includes(q)) return;

            const lock = room.private ? '🔒 ' : '';
            const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${escapeHtml(room.buttonColor)}"></div>` : '';
            const link = room.link || '';
            
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.onclick = () => onJoinClick(id, room);
            
            card.innerHTML = `
                ${colorDot}
                <div class="room-thumb">
                    ${link ? `<video class="room-thumb-video ready" muted playsinline src="${escapeHtml(link)}#t=0.1"></video>` : '<div style="color:#666;font-size:12px;">Нет видео</div>'}
                    <div class="room-thumb-label">В плеере</div>
                </div>
                <h4 style="font-size:15px; margin:0;">${lock + escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin:0;">Хост: ${escapeHtml(host)}</p>
            `;
            grid.appendChild(card);
        });
    },

    renderChatMsg: (msg, currentUid, canControlPlayer, isSystem = false) => {
        const list = els['chat-messages'];
        if (!list) return;
        
        const div = document.createElement('div');
        if (isSystem) {
            div.className = 'm-line system';
            div.innerHTML = `<div class="bubble">${escapeHtml(msg.content)}</div>`;
        } else {
            const isMe = msg.fromUid === currentUid;
            div.className = isMe ? 'm-line self' : 'm-line';
            div.innerHTML = `<div class="bubble"><strong>${escapeHtml(msg.user || 'User')}</strong><p>${parseTimecodes(msg.content, canControlPlayer)}</p></div>`;
        }
        
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    },

    clearChat: () => { if(els['chat-messages']) els['chat-messages'].innerHTML = ''; },

    renderFloatingEmoji: (emoji) => {
        const layer = els['reaction-layer'];
        if (!layer) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.innerText = emoji;
        el.style.left = `${Math.random() * 80 + 10}%`;
        layer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },

    // Video Player wrappers
    setupVideoPlayer: (link, isHost, localPerms) => {
        const p = els['native-player'];
        if(!p) return;
        p.src = link || '';
        p.controls = isHost || localPerms?.player;
        p.style.pointerEvents = (isHost || localPerms?.player) ? 'auto' : 'none';
    },
    getVideoTime: () => els['native-player'] ? els['native-player'].currentTime : 0,
    setVideoTime: (t) => { if(els['native-player'] && Math.abs(els['native-player'].currentTime - t) > 0.5) els['native-player'].currentTime = t; },
    playVideo: () => els['native-player']?.play().catch(()=>{}),
    pauseVideo: () => els['native-player']?.pause(),
    onVideoEvent: (event, cb) => els['native-player']?.addEventListener(event, cb),

    // Audio Elements for Voice
    attachRemoteAudio: (uid, stream) => {
        const container = els['remote-audio-container'];
        if(!container) return;
        const aid = `audio-${uid}`;
        document.getElementById(aid)?.remove();
        
        const audio = document.createElement('audio');
        audio.id = aid;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.srcObject = stream;
        audio.volume = els['voice-volume'] ? parseFloat(els['voice-volume'].value) : 1;
        container.appendChild(audio);
    },
    removeRemoteAudio: (uid) => {
        document.getElementById(`audio-${uid}`)?.remove();
    },
    updateVoiceVolumes: (vol) => {
        document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = vol);
    },
    setMicActive: (isActive) => {
        if(isActive) els['mic-btn']?.classList.add('active');
        else els['mic-btn']?.classList.remove('active');
    },

    // Basic Toggles & Setups
    setupAuthTabs: () => {
        els['tab-login'].onclick = () => {
            els['form-login'].classList.replace('hidden-form', 'active-form');
            els['form-register'].classList.replace('active-form', 'hidden-form');
            els['tab-login'].classList.add('active');
            els['tab-register'].classList.remove('active');
        };
        els['tab-register'].onclick = () => {
            els['form-register'].classList.replace('hidden-form', 'active-form');
            els['form-login'].classList.replace('active-form', 'hidden-form');
            els['tab-register'].classList.add('active');
            els['tab-login'].classList.remove('active');
        };
    },
    setupChatTabs: () => {
        els['tab-chat-btn'].onclick = () => {
            els['chat-messages'].style.display = 'flex';
            els['users-list'].style.display = 'none';
            els['tab-chat-btn'].classList.add('active');
            els['tab-users-btn'].classList.remove('active');
        };
        els['tab-users-btn'].onclick = () => {
            els['users-list'].style.display = 'flex';
            els['chat-messages'].style.display = 'none';
            els['tab-users-btn'].classList.add('active');
            els['tab-chat-btn'].classList.remove('active');
        };
    },
    setupModals: () => {
        els['btn-open-modal'].onclick = () => { els['room-password'].value=''; els['room-private'].checked=false; els['modal-create'].classList.add('active'); };
        els['btn-close-modal'].onclick = () => els['modal-create'].classList.remove('active');
        els['btn-join-cancel'].onclick = () => els['modal-join'].classList.remove('active');
        els['btn-profile-cancel'].onclick = () => els['modal-profile'].classList.remove('active');
        els['btn-dm-close'].onclick = () => els['modal-dm-chat'].classList.remove('active');
        els['btn-room-invite-close'].onclick = () => els['modal-room-invite'].classList.remove('active');
        
        els['room-private'].onchange = (e) => els['room-password'].style.display = e.target.checked ? 'block' : 'none';
    },

    // Binders
    bindAuth: (loginEmail, regEmail, googleAuth, logout) => {
        els['btn-login-email'].onclick = loginEmail;
        els['btn-register-email'].onclick = regEmail;
        els['btn-google-auth'].onclick = googleAuth;
        els['btn-logout'].onclick = logout;
    },
    bindProfile: (openCb, saveCb) => {
        els['btn-edit-profile'].onclick = () => {
            openCb((data) => {
                els['profile-name'].value = data.name || '';
                els['profile-status'].value = data.status || '';
                els['profile-volume'].value = data.defaultVolume || 100;
                els['profile-bio'].value = data.bio || '';
                els['profile-color'].value = data.color || '#f5f7fa';
                els['modal-profile'].classList.add('active');
            });
        };
        els['btn-profile-save'].onclick = () => { saveCb(); els['modal-profile'].classList.remove('active'); };
    },
    bindRoomCreation: (createCb) => els['btn-create-finish'].onclick = () => { createCb(); els['modal-create'].classList.remove('active'); },
    bindRoomJoinAuth: (joinCb) => els['btn-join-confirm'].onclick = () => { joinCb(); },
    bindRoomActions: (leaveCb) => els['btn-leave-room'].onclick = leaveCb,
    bindChatInput: (sendCb) => {
        els['send-btn'].onclick = sendCb;
        els['chat-input'].onkeydown = (e) => { if(e.key === 'Enter') sendCb(); };
        // Timecode click delegation
        els['chat-messages'].onclick = (e) => {
            if(e.target.classList.contains('timecode-btn')) {
                const parts = e.target.dataset.time.split(':');
                const sec = parseInt(parts[0])*60 + parseInt(parts[1]);
                const ev = new CustomEvent('timecodeClick', { detail: sec });
                document.dispatchEvent(ev);
            }
        };
    },
    bindReactions: (reactCb) => {
        document.querySelectorAll('.react-btn').forEach(b => b.onclick = () => reactCb(b.dataset.emoji));
    },
    bindMic: (micCb) => els['mic-btn'].onclick = micCb,
    bindVolume: (volCb) => {
        if(els['voice-volume']) {
            els['voice-volume'].oninput = (e) => {
                UI.updateVoiceVolumes(e.target.value);
                volCb(e.target.value);
            };
        }
    },
    showJoinModal: () => { els['join-password'].value=''; els['modal-join'].classList.add('active'); },
    hideJoinModal: () => els['modal-join'].classList.remove('active'),
};