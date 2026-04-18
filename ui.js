// ui.js
import { AppState } from './core.js';

// DOM Helpers
export const $ = (id) => document.getElementById(id);

export function renderInitialUI() {
    // Базовая настройка при загрузке
    const layout = document.querySelector('.lobby-layout');
    if (layout) {
        layout.style.maxWidth = '95vw';
        layout.style.width = '95vw';
    }
}

export function bindCreateModalOverrides() {
    const btnOpenModal = $('btn-open-modal');
    const btnCloseModal = $('btn-close-modal');
    const modalCreate = $('modal-create');
    const roomPassword = $('room-password');
    const roomPrivate = $('room-private');

    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            AppState.setEditingRoom(null);
            setCreateModalMode('create');
            modalCreate?.classList.add('active');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            AppState.setEditingRoom(null);
            setCreateModalMode('create');
            modalCreate?.classList.remove('active');
            
            if (roomPassword) roomPassword.value = '';
            if (roomPrivate) roomPrivate.checked = false;
        });
    }
}

export function widenLobbyLayout() {
    const layout = document.querySelector('.lobby-layout');
    if (layout) {
        layout.style.maxWidth = '95vw';
        layout.style.width = '95vw';
    }
}

export function setCreateModalMode(mode) {
    // Управление состоянием модального окна создания/редактирования
    const modalTitle = document.querySelector('#modal-create h3');
    const btnCreateFinish = $('btn-create-finish');
    
    if (mode === 'create') {
        if(modalTitle) modalTitle.textContent = 'Создать комнату';
        if(btnCreateFinish) btnCreateFinish.textContent = 'Запустить';
    } else {
        if(modalTitle) modalTitle.textContent = 'Редактировать комнату';
        if(btnCreateFinish) btnCreateFinish.textContent = 'Сохранить';
    }
}

// Заглушки для интеграции с остальной системой, которые будут расширены в PART 2
export function bindDirectChatUiV2() {
    // Инициализация UI для системы чата
    const tabUsersBtn = $('tab-users-btn');
    const tabChatBtn = $('tab-chat-btn');
    
    if (tabUsersBtn && tabChatBtn) {
        tabUsersBtn.addEventListener('click', () => {
            tabUsersBtn.classList.add('active');
            tabChatBtn.classList.remove('active');
            // Переключение панелей
        });
    }
}

export function bindSelfPresence() {
    // UI логика для отображения собственного статуса
}

// Подписки на события ядра
document.addEventListener('core:authChanged', (e) => {
    const user = e.detail;
    if (user) {
        // Рендер UI залогиненного пользователя
    } else {
        // Возврат на экран авторизации
    }
});
// ui.js (ПРОДОЛЖЕНИЕ)

import { 
    createRoom, joinRoomCore, sendChatMessage, syncVideoState 
} from './core.js';
import { AppState, escapeHtml } from './core.js';

// ==========================================
// 1. УВЕДОМЛЕНИЯ (TOASTS)
// ==========================================
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = escapeHtml(message);
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 2. ИНТЕРФЕЙС КОМНАТ И ФОРМЫ
// ==========================================
export function bindRoomControls() {
    const btnCreateFinish = document.getElementById('btn-create-finish');
    const btnJoinConfirm = document.getElementById('btn-join-confirm');
    const inputChat = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');

    if (btnCreateFinish) {
        btnCreateFinish.addEventListener('click', async () => {
            const name = document.getElementById('room-name').value;
            const videoUrl = document.getElementById('room-link').value;
            const isPrivate = document.getElementById('room-private').checked;
            const password = document.getElementById('room-password').value;

            try {
                btnCreateFinish.disabled = true;
                const roomId = await createRoom({ name, videoUrl, isPrivate, password });
                document.getElementById('modal-create').classList.remove('active');
                showToast('Комната создана!', 'success');
                // Переход в комнату (интеграция UI)
                transitionToRoomView(roomId, videoUrl);
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btnCreateFinish.disabled = false;
            }
        });
    }

    if (btnJoinConfirm) {
        btnJoinConfirm.addEventListener('click', async () => {
            const password = document.getElementById('join-password').value;
            const roomId = AppState.pendingJoinRoomId; // Задается при клике на комнату в лобби
            
            try {
                const roomData = await joinRoomCore(roomId, password);
                document.getElementById('modal-join').classList.remove('active');
                transitionToRoomView(roomId, roomData.videoUrl);
            } catch (err) {
                showToast(err.message || 'Ошибка входа', 'error');
            }
        });
    }

    if (btnSendChat && inputChat) {
        const sendAction = () => {
            sendChatMessage(AppState.currentRoomId, inputChat.value);
            inputChat.value = '';
        };
        btnSendChat.addEventListener('click', sendAction);
        inputChat.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAction();
        });
    }
}

function transitionToRoomView(roomId, videoUrl) {
    document.getElementById('auth-screen')?.classList.remove('active');
    document.getElementById('lobby-screen')?.classList.remove('active');
    document.getElementById('room-screen')?.classList.add('active');
    
    // Инициализация плеера YouTube
    initVideoPlayerUI(videoUrl);
}

// ==========================================
// 3. WEBRTC AUDIO РЕНДЕРИНГ
// ==========================================
document.addEventListener('core:remoteStreamAdded', (e) => {
    const { peerId, stream } = e.detail;
    const container = document.getElementById('remote-audio-container');
    if (!container) return;

    let audioObj = document.getElementById(`audio-${peerId}`);
    if (!audioObj) {
        audioObj = document.createElement('audio');
        audioObj.id = `audio-${peerId}`;
        audioObj.autoplay = true;
        container.appendChild(audioObj);
    }
    audioObj.srcObject = stream;
});

document.addEventListener('core:remoteStreamRemoved', (e) => {
    const peerId = e.detail;
    const audioObj = document.getElementById(`audio-${peerId}`);
    if (audioObj) {
        audioObj.srcObject = null;
        audioObj.remove();
    }
});

// ==========================================
// 4. CHAT UI РЕНДЕРИНГ
// ==========================================
document.addEventListener('core:chatMessageReceived', (e) => {
    const msg = e.detail;
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;

    const isSelf = msg.senderId === AppState.currentUser?.uid;
    const msgEl = document.createElement('div');
    msgEl.className = `dm-line ${isSelf ? 'self' : ''}`;
    
    msgEl.innerHTML = `
        <div class="dm-bubble">
            <strong>${isSelf ? 'Вы' : 'Пользователь'}</strong>
            <span>${msg.text}</span>
        </div>
    `;
    
    chatContainer.appendChild(msgEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
});
// ui.js (ФИНАЛ)

import { syncVideoState, removeFriend, addFriend, AppState } from './core.js';

// ==========================================
// 5. GLOBAL ONLINE UI
// ==========================================
document.addEventListener('core:onlineCountUpdated', (e) => {
    const count = e.detail;
    const counterEl = document.getElementById('online-counter');
    const countSpan = document.getElementById('online-count');
    
    if (counterEl && countSpan) {
        countSpan.textContent = count;
        counterEl.style.display = count > 0 ? 'flex' : 'none';
    }
});

// ==========================================
// 6. FRIENDS UI BINDINGS
// ==========================================
document.addEventListener('core:friendsUpdated', (e) => {
    const friends = e.detail;
    const friendsListEl = document.getElementById('friends-list-container');
    if (!friendsListEl) return;

    friendsListEl.innerHTML = '';
    
    if (friends.length === 0) {
        friendsListEl.innerHTML = '<div class="empty-state">Список друзей пуст</div>';
        return;
    }

    friends.forEach(friend => {
        const isOnline = !!friend.connections;
        const el = document.createElement('div');
        el.className = 'user-card';
        el.innerHTML = `
            <div class="user-info">
                <div class="user-avatar" style="background-image: url('${friend.photoURL || ''}')"></div>
                <div>
                    <div class="user-name">${friend.displayName || 'Без имени'}</div>
                    <div class="user-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? 'Онлайн' : 'Оффлайн'}
                    </div>
                </div>
            </div>
            <button class="secondary-btn btn-remove-friend" data-uid="${friend.uid}">Удалить</button>
        `;
        friendsListEl.appendChild(el);
    });

    // Делегирование событий для кнопок удаления
    friendsListEl.querySelectorAll('.btn-remove-friend').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            const uid = event.target.getAttribute('data-uid');
            try {
                await removeFriend(uid);
            } catch (err) {
                console.error("Ошибка удаления друга:", err);
            }
        });
    });
});

// ==========================================
// 7. VIDEO PLAYER & SYNC UI (YouTube API)
// ==========================================
let player = null;
let isSyncing = false; // Флаг для предотвращения бесконечной петли эвентов

export function initVideoPlayerUI(videoUrl) {
    const videoId = extractYouTubeID(videoUrl);
    if (!videoId) return;

    const playerContainer = document.getElementById('video-player-container');
    if (!playerContainer) return;
    
    playerContainer.innerHTML = '<div id="yt-player"></div>';

    // Предполагается, что скрипт YouTube Iframe API загружен в index.html
    player = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (!AppState.currentRoomId || isSyncing) return;

    const isPlaying = event.data === YT.PlayerState.PLAYING;
    const isPaused = event.data === YT.PlayerState.PAUSED;
    
    if (isPlaying || isPaused) {
        const currentTime = player.getCurrentTime();
        syncVideoState(AppState.currentRoomId, isPlaying, currentTime);
    }
}

document.addEventListener('core:videoStateChanged', (e) => {
    if (!player || !player.seekTo) return;
    
    const state = e.detail;
    // Игнорируем обновление, если его вызвал сам текущий пользователь
    if (state.updatedBy === AppState.currentUser?.uid) return;

    isSyncing = true; // Блокируем отправку эвентов обратно в базу
    
    const timeDiff = Math.abs(player.getCurrentTime() - state.currentTime);
    if (timeDiff > 2) {
        player.seekTo(state.currentTime, true);
    }

    if (state.isPlaying && player.getPlayerState() !== YT.PlayerState.PLAYING) {
        player.playVideo();
    } else if (!state.isPlaying && player.getPlayerState() !== YT.PlayerState.PAUSED) {
        player.pauseVideo();
    }

    setTimeout(() => { isSyncing = false; }, 500);
});

function extractYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
