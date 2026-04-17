import { UI } from '../ui.js';
import { AuthSystem } from './auth.js';
import { ProfileSystem } from '../profile.js';
import { OnlineSystem } from '../online.js';
import { FriendsSystem } from './friends.js';
import { RoomSystem } from '../rooms.js';
import { ChatSystem } from './chat.js';
import { VoiceSystem } from './voice.js';

let currentUser = null;
let currentProfile = {};

async function bootstrap() {
    UI.init();

    AuthSystem.init(
        // Login Callback
        async (user) => {
            currentUser = user;
            UI.showScreen('lobby-screen');
            OnlineSystem.startTracking();
            
            ProfileSystem.subscribeToOwnProfile((profile) => {
                currentProfile = profile;
            });

            FriendsSystem.init((friends) => {
                // Рендер друзей в сайдбаре или списке
            });

            RoomSystem.initLobby((rooms) => {
                UI.renderRooms(rooms, UI.getSearchQuery(), (id, room) => handleRoomJoin(id, room));
            });
        },
        // Logout Callback
        () => {
            currentUser = null;
            UI.showScreen('auth-screen');
            OnlineSystem.stopTracking();
            ProfileSystem.unsubscribe();
            RoomSystem.leaveRoom();
        }
    );

    // Bindings
    UI.bindAuth(
        () => AuthSystem.loginWithEmail(UI.getAuthInput().le, UI.getAuthInput().lp),
        () => AuthSystem.registerWithEmail(UI.getAuthInput().rn, UI.getAuthInput().re, UI.getAuthInput().rp),
        () => AuthSystem.loginWithGoogle(),
        () => AuthSystem.logout()
    );

    UI.bindProfile(
        (cb) => cb(currentProfile),
        () => ProfileSystem.saveProfile(UI.getProfileInput())
    );

    UI.bindRoomCreation(async () => {
        const data = UI.getRoomCreateInput();
        const id = await RoomSystem.createRoom(data, currentProfile);
        handleRoomJoin(id, RoomSystem.roomsCache[id]);
    });

    UI.bindRoomActions(() => {
        RoomSystem.leaveRoom();
        ChatSystem.stopRoomChat();
        UI.showScreen('lobby-screen');
    });

    UI.bindChatInput(() => {
        const text = UI.getChatInput();
        if (text && RoomSystem.currentRoomId) {
            ChatSystem.sendMessage(RoomSystem.currentRoomId, text, currentProfile);
        }
    });

    UI.bindMic(() => VoiceSystem.toggleMic());
}

async function handleRoomJoin(roomId, room) {
    let pass = '';
    if (room.private) {
        // Здесь можно вызвать UI.showJoinModal и ждать ввода
        UI.showJoinModal();
        UI.bindRoomJoinAuth(async () => {
            pass = UI.getJoinPassword();
            const success = await RoomSystem.joinRoom(roomId, pass);
            if (success) {
                UI.hideJoinModal();
                enterRoom(roomId, room);
            }
        });
    } else {
        const success = await RoomSystem.joinRoom(roomId);
        if (success) enterRoom(roomId, room);
    }
}

function enterRoom(roomId, room) {
    UI.showScreen('room-screen');
    UI.setupVideoPlayer(room.link, room.adminUid === currentUser.uid);
    ChatSystem.initRoomChat(roomId, room.adminUid === currentUser.uid);
    VoiceSystem.init(roomId);
    
    // Синхронизация плеера
    RoomSystem.syncPlayer(roomId, room.adminUid === currentUser.uid, (state) => {
        UI.setVideoTime(state.time);
        state.playing ? UI.playVideo() : UI.pauseVideo();
    });

    // Обработка событий видео (только для хоста)
    if (room.adminUid === currentUser.uid) {
        UI.onVideoEvent('play', () => RoomSystem.updatePlayback(roomId, true, UI.getVideoTime()));
        UI.onVideoEvent('pause', () => RoomSystem.updatePlayback(roomId, false, UI.getVideoTime()));
        UI.onVideoEvent('seeked', () => RoomSystem.updatePlayback(roomId, true, UI.getVideoTime()));
    }
}

window.addEventListener('load', bootstrap);