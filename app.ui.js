// ==========================================
// FILE: app.ui.js
// ==========================================
import { ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- BIND DOM EVENTS ---
if (window.$('tab-login')) window.$('tab-login').onclick = () => { 
    window.$('form-login').classList.add('active-form'); window.$('form-login').classList.remove('hidden-form', 'left'); 
    window.$('form-register').classList.add('hidden-form', 'right'); window.$('form-register').classList.remove('active-form'); 
    window.$('tab-login').classList.add('active'); window.$('tab-register').classList.remove('active'); 
};
if (window.$('tab-register')) window.$('tab-register').onclick = () => { 
    window.$('form-register').classList.add('active-form'); window.$('form-register').classList.remove('hidden-form', 'right'); 
    window.$('form-login').classList.add('hidden-form', 'left'); window.$('form-login').classList.remove('active-form'); 
    window.$('tab-register').classList.add('active'); window.$('tab-login').classList.remove('active'); 
};

if (window.$('btn-login-email')) window.$('btn-login-email').onclick = () => window.signInEmail(window.$('login-email').value, window.$('login-password').value);
if (window.$('btn-register-email')) window.$('btn-register-email').onclick = () => window.registerEmail(window.$('reg-email').value, window.$('reg-password').value, window.$('reg-name').value);
if (window.$('btn-google-auth')) window.$('btn-google-auth').onclick = window.signInGoogle;
if (window.$('btn-logout')) window.$('btn-logout').onclick = window.logoutUser;

if (window.$('btn-leave-room')) window.$('btn-leave-room').onclick = window.leaveRoom;
if (window.$('btn-open-modal')) window.$('btn-open-modal').onclick = () => { window.AppState.editingRoomId = null; window.$('modal-create')?.classList.add('active'); };
if (window.$('btn-close-modal')) window.$('btn-close-modal').onclick = () => { window.$('modal-create')?.classList.remove('active'); };

if (window.$('room-private')) window.$('room-private').addEventListener('change', (e) => { 
    if (window.$('room-password')) window.$('room-password').style.display = e.target.checked ? 'block' : 'none'; 
});

if (window.$('btn-create-finish')) window.$('btn-create-finish').onclick = async () => {
    const name = window.$('room-name').value;
    const link = window.$('room-link').value;
    if (!name || !link) return window.showToast("Заполни поля!");
    const isPrivate = window.$('room-private')?.checked || false;
    const password = window.$('room-password')?.value || '';
    const buttonColor = window.$('room-button-color')?.value || '#ffffff';

    const roomData = { name, link, buttonColor, admin: window.auth.currentUser.uid, adminName: window.auth.currentUser.displayName || "User" };
    
    if (isPrivate) {
        if (!password || password.length < 4) return window.showToast('Пароль мин 4 символа');
        const salt = window.genSalt(16);
        const pwHash = await window.deriveKey(password, salt);
        roomData.private = true; roomData.pwSalt = salt; roomData.pwHash = pwHash;
    } else {
        roomData.private = null; roomData.pwSalt = null; roomData.pwHash = null;
    }

    if (window.AppState.editingRoomId) {
        await set(ref(window.db, `rooms/${window.AppState.editingRoomId}`), { ...window.AppState.roomsCache[window.AppState.editingRoomId], ...roomData });
        window.showToast('Комната обновлена');
        window.AppState.editingRoomId = null;
        window.$('modal-create').classList.remove('active');
        return;
    }

    const newRoomRef = push(ref(window.db, 'rooms'));
    await set(newRoomRef, roomData);
    window.$('modal-create').classList.remove('active');
    window.enterRoom(newRoomRef.key, name, link, window.auth.currentUser.uid);
};

// --- RENDER FUNCTIONS ---
window.syncRooms = () => {
    onValue(ref(window.db, 'rooms'), (snap) => {
        window.AppState.roomsCache = snap.val() || {};
        window.renderRooms(window.$('search-rooms')?.value || '');
    });
};

window.renderRooms = (filter = '') => {
    const grid = window.$('rooms-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const data = window.AppState.roomsCache || {};
    const q = String(filter).trim().toLowerCase();
    const keys = Object.keys(data);
    
    if (!keys.length) { grid.innerHTML = '<div style="padding:20px; color:#888">Пока нет комнат</div>'; return; }

    keys.forEach((id) => {
        const room = data[id] || {};
        const name = room.name || '';
        const host = room.adminName || '';
        if (q && !`${name} ${host}`.toLowerCase().includes(q)) return;

        const lock = room.private ? '🔒 ' : '';
        const colorDot = room.buttonColor ? `<div class="room-color-indicator" style="background:${window.escapeHtml(room.buttonColor)}"></div>` : '';
        const roomLink = room.link || '';

        grid.innerHTML += `
            <div class="room-card glass-panel" onclick='window.joinRoom(${JSON.stringify(id)}, ${JSON.stringify(name)}, ${JSON.stringify(roomLink)}, ${JSON.stringify(room.admin || '')})'>
                ${colorDot}
                <div class="room-thumb"><video class="room-thumb-video" muted playsinline preload="metadata" src="${window.escapeHtml(roomLink)}"></video></div>
                <h4>${lock + window.escapeHtml(name)}</h4>
                <p style="font-size:12px; opacity:0.6; margin-top:5px;">Хост: ${window.escapeHtml(host)}</p>
            </div>`;
    });
};

window.joinRoom = (id, name, link, admin) => {
    const room = window.AppState.roomsCache[id];
    if (room?.private) {
        window.AppState.pendingJoin = { id, name, link, admin };
        window.$('modal-join')?.classList.add('active');
        if (window.$('join-password')) window.$('join-password').value = '';
    } else {
        window.enterRoom(id, name, link, admin);
    }
};

if (window.$('btn-join-confirm')) window.$('btn-join-confirm').onclick = async () => {
    if (!window.AppState.pendingJoin) return;
    const room = window.AppState.roomsCache[window.AppState.pendingJoin.id];
    const pw = window.$('join-password')?.value || '';
    try {
        const derived = await window.deriveKey(pw, room.pwSalt);
        if (derived === room.pwHash) {
            window.$('modal-join').classList.remove('active');
            window.enterRoom(window.AppState.pendingJoin.id, window.AppState.pendingJoin.name, window.AppState.pendingJoin.link, window.AppState.pendingJoin.admin);
            window.AppState.pendingJoin = null;
        } else {
            window.showToast('Неверный пароль');
        }
    } catch (e) { window.showToast('Ошибка'); }
};
if (window.$('btn-join-cancel')) window.$('btn-join-cancel').onclick = () => window.$('modal-join')?.classList.remove('active');

// --- ROOM UI & CHAT ---
window.appendChatMessage = (msg) => {
    const isMe = msg.fromUid === window.auth.currentUser.uid;
    const line = document.createElement('div');
    line.className = isMe ? 'm-line self' : 'm-line';
    const content = window.escapeHtml(msg.content).replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>');
    line.innerHTML = `<div class="bubble"><strong>${window.escapeHtml(msg.user || 'User')}</strong><p>${content}</p></div>`;
    window.$('chat-messages')?.appendChild(line);
    if (window.$('chat-messages')) window.$('chat-messages').scrollTop = window.$('chat-messages').scrollHeight;
};

if (window.$('send-btn')) window.$('send-btn').onclick = () => {
    const input = window.$('chat-input');
    const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
    if (!input || !input.value.trim() || !localPerms.chat) return;
    push(ref(window.db, `rooms/${window.AppState.currentRoomId}/chat`), { user: window.getDisplayName(), fromUid: window.auth.currentUser.uid, content: input.value.trim(), ts: Date.now() });
    input.value = '';
};

if (window.$('chat-input')) window.$('chat-input').onkeydown = (e) => { if (e.key === 'Enter') window.$('send-btn').click(); };

if (window.$('chat-messages')) window.$('chat-messages').onclick = (e) => {
    if (!e.target.classList.contains('timecode-btn')) return;
    const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
    if (!localPerms.player && !window.AppState.isHost) return;
    const parts = e.target.dataset.time.split(':');
    const seconds = (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    const player = window.$('native-player');
    if (player) {
        window.AppState.isRemoteAction = true;
        player.currentTime = seconds;
        player.play().catch(() => {});
        set(ref(window.db, `rooms/${window.AppState.currentRoomId}/sync`), { type: 'seek', time: seconds, ts: Date.now(), by: window.auth.currentUser.uid, state: 'playing' });
        setTimeout(() => { window.AppState.isRemoteAction = false; }, 300);
    }
};

window.showFloatingReaction = (emoji) => {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;
    el.style.left = `${Math.random() * 80 + 10}%`;
    window.$('reaction-layer')?.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

document.querySelectorAll('.react-btn').forEach((btn) => {
    btn.onclick = () => {
        const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
        if (!localPerms.reactions) return;
        push(ref(window.db, `rooms/${window.AppState.currentRoomId}/reactions`), { emoji: btn.dataset.emoji, ts: Date.now() });
    };
});

window.rerenderRoomUsers = () => {
    const list = window.$('users-list');
    if (!list) return;
    list.innerHTML = '';
    const adminId = window.AppState.roomsCache[window.AppState.currentRoomId]?.admin || null;
    const ids = Object.keys(window.AppState.currentPresenceCache);
    if (window.$('users-count')) window.$('users-count').innerText = ids.length;

    ids.forEach(uid => {
        const pNode = window.AppState.currentPresenceCache[uid] || {};
        const perms = window.getEffectiveRoomPerms(pNode, uid === adminId);
        const isLocal = uid === window.auth.currentUser.uid;
        
        let html = `<div class="user-item" data-uid="${uid}"><div class="indicator online"></div><div class="user-main"><span class="user-name">${window.escapeHtml(pNode.name || 'User')}</span>`;
        if (uid === adminId) html += `<span class="host-label">Host</span>`;
        if (isLocal) html += `<span class="you-label">(Вы)</span>`;
        html += `</div>`;
        if (window.AppState.isHost && !isLocal) {
            html += `<div class="perm-controls">
                <label><span>Чат</span><input type="checkbox" data-uid="${uid}" data-perm="chat" ${perms.chat ? 'checked' : ''}></label>
                <label><span>Voice</span><input type="checkbox" data-uid="${uid}" data-perm="voice" ${perms.voice ? 'checked' : ''}></label>
                <label><span>Плеер</span><input type="checkbox" data-uid="${uid}" data-perm="player" ${perms.player ? 'checked' : ''}></label>
                <label><span>Реакции</span><input type="checkbox" data-uid="${uid}" data-perm="reactions" ${perms.reactions ? 'checked' : ''}></label>
            </div>`;
        }
        html += `</div>`;
        list.innerHTML += html;
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
        toggle.onchange = async (e) => {
            if (!window.AppState.isHost) return;
            const uid = e.target.dataset.uid;
            const perm = e.target.dataset.perm;
            await set(ref(window.db, `rooms/${window.AppState.currentRoomId}/presence/${uid}/perms/${perm}`), e.target.checked);
            if (perm === 'voice' && !e.target.checked) await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/participants/${uid}`));
        };
    });

    const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
    if (window.$('chat-input')) window.$('chat-input').disabled = !localPerms.chat;
    if (window.$('send-btn')) window.$('send-btn').disabled = !localPerms.chat;
    if (window.$('mic-btn')) window.$('mic-btn').disabled = !localPerms.voice;
    const player = window.$('native-player');
    if (player) {
        player.controls = !!localPerms.player || window.AppState.isHost;
        player.style.pointerEvents = (localPerms.player || window.AppState.isHost) ? 'auto' : 'none';
    }
    if (!localPerms.voice && window.AppState.myStream) window.disableMicrophoneNative({ notify: false });
};

// MIC UI
if (window.$('mic-btn')) window.$('mic-btn').onclick = function() {
    const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
    if (!localPerms.voice) return;
    if (window.AppState.myStream) { window.disableMicrophoneNative(); return; }
    window.enableMicrophoneNative(this);
};

// AMBILIGHT
const ambiCanvas = window.$('ambilight-canvas');
const ambiCtx = ambiCanvas?.getContext('2d', { willReadFrequently: true });
const player = window.$('native-player');
const drawAmbilight = () => {
    if (window.AppState.currentRoomId && player && !player.paused && !player.ended && ambiCtx) {
        ambiCanvas.width = player.clientWidth / 10;
        ambiCanvas.height = player.clientHeight / 10;
        ambiCtx.drawImage(player, 0, 0, ambiCanvas.width, ambiCanvas.height);
    }
    requestAnimationFrame(drawAmbilight);
};
if (player) player.addEventListener('play', () => drawAmbilight());

// PARTICLES
const canvas = window.$('particle-canvas');
const ctx = canvas?.getContext('2d');
if (canvas && ctx) {
    let dots = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.onresize = resize; resize();
    class Dot {
        constructor() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.5; this.vy = (Math.random()-0.5)*0.5; }
        draw() {
            this.x += this.vx; this.y += this.vy;
            if(this.x<0 || this.x>canvas.width) this.vx *= -1;
            if(this.y<0 || this.y>canvas.height) this.vy *= -1;
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
        }
    }
    for(let i=0; i<80; i++) dots.push(new Dot());
    const anim = () => {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        dots.forEach(d => {
            d.draw();
            dots.forEach(d2 => {
                let dist = Math.sqrt((d.x-d2.x)**2 + (d.y-d2.y)**2);
                if(dist < 120) { ctx.strokeStyle = `rgba(255,255,255,${0.2 - dist/600})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y); ctx.stroke(); }
            });
        });
        requestAnimationFrame(anim);
    };
    anim();
}