// ui.js
import { authActions, roomActions, AppState } from './core.js';

const $ = (id) => document.getElementById(id);

export function initUI() {
    // 1. Переключение экранов (Главная логика)
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = $(screenId);
        if (target) target.classList.add('active');
        else console.error("Screen not found:", screenId);
    }

    // 2. Слушатель авторизации
    document.addEventListener('core:authChanged', (e) => {
        const user = e.detail;
        if (user) {
            console.log("Юзер залогинен, открываю лобби");
            showScreen('lobby-screen'); 
            if($('user-name-display')) $('user-name-display').innerText = user.displayName || "Пользователь";
        } else {
            showScreen('auth-screen');
        }
    });

    // 3. Обработка списка комнат
    document.addEventListener('core:roomsUpdated', (e) => {
        const rooms = e.detail;
        const grid = $('rooms-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        rooms.forEach(room => {
            const card = document.createElement('div');
            card.className = 'room-card glass-panel';
            card.innerHTML = `
                <div class="room-info">
                    <h4>${room.name}</h4>
                    <p>${room.private ? '🔒 Приватная' : '🔓 Открытая'}</p>
                </div>
                <button class="primary-btn">Войти</button>
            `;
            grid.appendChild(card);
        });
    });

    // 4. Кнопки входа/регистрации
    $('login-btn')?.addEventListener('click', async () => {
        try {
            await authActions.login($('login-email').value, $('login-password').value);
        } catch (e) { alert("Ошибка: " + e.message); }
    });

    $('register-btn')?.addEventListener('click', async () => {
        try {
            await authActions.register($('reg-email').value, $('reg-password').value, $('reg-name').value);
        } catch (e) { alert("Ошибка: " + e.message); }
    });

    // 5. Табы авторизации
    $('tab-login')?.addEventListener('click', () => {
        $('tab-login').classList.add('active'); $('tab-register').classList.remove('active');
        $('form-login').classList.add('active-form'); $('form-register').classList.remove('active-form');
    });

    $('tab-register')?.addEventListener('click', () => {
        $('tab-register').classList.add('active'); $('tab-login').classList.remove('active');
        $('form-register').classList.add('active-form'); $('form-login').classList.remove('active-form');
    });

    // 6. Модалка создания
    $('btn-open-modal')?.addEventListener('click', () => $('modal-create').classList.add('active'));
    
    $('room-private')?.addEventListener('change', (e) => {
        $('room-password').style.display = e.target.checked ? 'block' : 'none';
    });
}

function showToast(msg) {
    const t = $('toast-container');
    if(t) {
        const div = document.createElement('div');
        div.className = 'toast';
        div.innerText = msg;
        t.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

// ----------------------------------------------------
// 1. АВТОРИЗАЦИЯ И ЭКРАНЫ
// ----------------------------------------------------
function bindAuth() {
    $('tab-login')?.addEventListener('click', () => switchAuthTab('login'));
    $('tab-register')?.addEventListener('click', () => switchAuthTab('register'));

    $('login-btn')?.addEventListener('click', async () => {
        try {
            await authActions.login($('login-email').value, $('login-password').value);
        } catch (e) { showToast(e.message, 'error'); }
    });

    $('register-btn')?.addEventListener('click', async () => {
        try {
            await authActions.register($('reg-email').value, $('reg-password').value, $('reg-name').value);
        } catch (e) { showToast(e.message, 'error'); }
    });
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        $('tab-login').classList.add('active'); $('tab-register').classList.remove('active');
        $('form-login').classList.add('active-form'); $('form-register').classList.remove('active-form');
    } else {
        $('tab-register').classList.add('active'); $('tab-login').classList.remove('active');
        $('form-register').classList.add('active-form'); $('form-login').classList.remove('active-form');
    }
}

function handleAuthScreen(user) {
    if (user) {
        $('auth-screen')?.classList.remove('active');
        $('app-container').classList.add('in-lobby'); // Можно добавить класс для лобби
        showToast(`Добро пожаловать, ${user.displayName || 'Пользователь'}!`, 'success');
        // Показать кнопку открытия модалки создания комнаты
        if(!$('btn-open-modal')) {
           const btn = document.createElement('button');
           btn.id = 'btn-open-modal';
           btn.className = 'primary-btn';
           btn.innerText = 'Создать комнату';
           btn.style.position = 'fixed'; btn.style.top = '20px'; btn.style.right = '20px';
           document.body.appendChild(btn);
           btn.onclick = () => $('modal-create').classList.add('active');
        }
    } else {
        $('auth-screen')?.classList.add('active');
        $('app-container').classList.remove('in-lobby');
    }
}

// ----------------------------------------------------
// 2. МОДАЛКИ (СОЗДАНИЕ / ВХОД)
// ----------------------------------------------------
function bindModals() {
    $('room-private')?.addEventListener('change', (e) => {
        $('room-password').style.display = e.target.checked ? 'block' : 'none';
    });

    $('btn-create-finish')?.addEventListener('click', async () => {
        const btn = $('btn-create-finish');
        btn.disabled = true;
        try {
            const data = {
                name: $('room-name').value,
                videoUrl: $('room-link').value,
                private: $('room-private').checked,
                password: $('room-password').value
            };
            const roomId = await roomActions.create(data);
            $('modal-create').classList.remove('active');
            await roomActions.join(roomId, data.password);
            
            enterRoomUI(data.videoUrl);
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    // Логика кнопки "Выйти"
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'secondary-btn'; leaveBtn.innerText = 'Выйти из комнаты';
    leaveBtn.style.position = 'absolute'; leaveBtn.style.top = '10px'; leaveBtn.style.left = '10px';
    leaveBtn.onclick = () => {
        roomActions.leave();
        $('chat-messages').innerHTML = '';
        $('users-list').innerHTML = '';
        if(ytPlayer) ytPlayer.destroy();
        showToast('Вы вышли из комнаты');
    };
    $('app-container').appendChild(leaveBtn); // Временно для навигации
}

function enterRoomUI(videoUrl) {
    showToast('Вы в комнате!', 'success');
    initYouTubePlayer(videoUrl);
}

// ----------------------------------------------------
// 3. ЧАТ, МИКРОФОН И ПОЛЬЗОВАТЕЛИ
// ----------------------------------------------------
function bindChatTabs() {
    $('tab-chat-btn')?.addEventListener('click', () => {
        $('tab-chat-btn').classList.add('active'); $('tab-users-btn').classList.remove('active');
        $('chat-messages').style.display = 'block'; $('users-list').style.display = 'none';
        $('message-dock-container').style.display = 'block';
    });

    $('tab-users-btn')?.addEventListener('click', () => {
        $('tab-users-btn').classList.add('active'); $('tab-chat-btn').classList.remove('active');
        $('users-list').style.display = 'block'; $('chat-messages').style.display = 'none';
        $('message-dock-container').style.display = 'none';
    });
}

function bindRoomControls() {
    const sendMsg = () => {
        chatActions.send($('chat-input').value);
        $('chat-input').value = '';
    };

    $('send-btn')?.addEventListener('click', sendMsg);
    $('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsg(); });

    $('mic-btn')?.addEventListener('click', async () => {
        const btn = $('mic-btn');
        try {
            const isMicOn = await voiceActions.toggleMic();
            if (isMicOn) {
                btn.classList.add('active');
                btn.style.background = 'rgba(46, 213, 115, 0.2)'; // Зеленоватый эффект
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
            }
        } catch (e) { showToast('Доступ к микрофону запрещен', 'error'); }
    });
}

function renderMessage(msg) {
    const chat = $('chat-messages');
    if (!chat) return;

    const isSelf = msg.senderId === AppState.user?.uid;
    const div = document.createElement('div');
    div.className = `dm-line ${isSelf ? 'self' : ''}`;
    div.innerHTML = `
        <div class="dm-bubble">
            <strong>${escapeHtml(msg.senderName)}</strong>
            <span>${escapeHtml(msg.text)}</span>
        </div>
    `;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function renderRoomUsers(users) {
    $('users-count').innerText = users.length;
    const list = $('users-list');
    if (!list) return;

    list.innerHTML = '';
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-card';
        div.style.padding = '10px'; div.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        div.innerText = u.name;
        list.appendChild(div);
    });
}

// ----------------------------------------------------
// 4. WEBRTC АУДИО (РЕМОУТ СТРИМЫ)
// ----------------------------------------------------
function attachRemoteAudio(peerId, stream) {
    const container = $('remote-audio-container');
    if (!$(`audio-${peerId}`)) {
        const audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.autoplay = true;
        audio.srcObject = stream;
        container.appendChild(audio);
    }
}

function removeRemoteAudio(peerId) {
    const audio = $(`audio-${peerId}`);
    if (audio) { audio.srcObject = null; audio.remove(); }
}

// ----------------------------------------------------
// 5. YOUTUBE СИНХРОНИЗАЦИЯ
// ----------------------------------------------------
let ytPlayer = null;
let isSyncing = false;

function initYouTubePlayer(videoUrl) {
    const videoId = videoUrl.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)?.[1];
    if (!videoId) return;

    // Предполагается что Iframe API уже загружен скриптом в HTML (или загружаем динамически)
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => createPlayer(videoId);
    } else {
        createPlayer(videoId);
    }
}

function createPlayer(videoId) {
    $('video-player-container').innerHTML = '<div id="yt-player"></div>';
    ytPlayer = new YT.Player('yt-player', {
        height: '100%', width: '100%', videoId: videoId,
        playerVars: { 'autoplay': 1, 'controls': AppState.isOwner ? 1 : 0 },
        events: { 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerStateChange(event) {
    if (!AppState.isOwner || isSyncing) return;
    const isPlaying = event.data === YT.PlayerState.PLAYING;
    if (isPlaying || event.data === YT.PlayerState.PAUSED) {
        roomActions.syncVideo(isPlaying, ytPlayer.getCurrentTime());
    }
}

function handleVideoSync(state) {
    if (!ytPlayer || !ytPlayer.seekTo || AppState.user?.uid === state.updatedBy) return;
    
    isSyncing = true;
    if (Math.abs(ytPlayer.getCurrentTime() - state.currentTime) > 2) {
        ytPlayer.seekTo(state.currentTime, true);
    }
    
    if (state.isPlaying && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) ytPlayer.playVideo();
    else if (!state.isPlaying && ytPlayer.getPlayerState() !== YT.PlayerState.PAUSED) ytPlayer.pauseVideo();
    
    setTimeout(() => isSyncing = false, 500);
}

// ----------------------------------------------------
// 6. УТИЛИТЫ (ТОСТЫ, СЧЕТЧИКИ)
// ----------------------------------------------------

function updateOnlineCounter(count) {
    if ($('online-counter') && $('online-count')) {
        $('online-count').innerText = count;
        $('online-counter').style.display = count > 0 ? 'flex' : 'none';
    }
}