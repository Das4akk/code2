// ==========================================
// FILE: app.realtime.js
// ==========================================
import { ref, set, remove, onValue, onChildAdded, onDisconnect, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- WEBRTC & VOICE SYSTEM ---
window.getVoiceRefs = (roomId) => ({
    participants: ref(window.db, `rooms/${roomId}/rtc/participants`),
    offersForMe: ref(window.db, `rooms/${roomId}/rtc/offers/${window.auth.currentUser.uid}`),
    answersForMe: ref(window.db, `rooms/${roomId}/rtc/answers/${window.auth.currentUser.uid}`),
    candidatesForMe: ref(window.db, `rooms/${roomId}/rtc/candidates/${window.auth.currentUser.uid}`)
});

window.cleanupRemoteAudioIndicator = (uid) => {
    const entry = window.AppState.remoteAudioAnalyzers.get(uid);
    if (entry?.animationId) cancelAnimationFrame(entry.animationId);
    window.AppState.remoteAudioAnalyzers.delete(uid);
    const indicator = document.querySelector(`.user-item[data-uid="${uid}"] .indicator`);
    if (indicator) {
        indicator.style.transform = 'scale(1)';
        indicator.style.boxShadow = '0 0 8px #2ed573';
    }
};

window.createRemoteAudioAnalyzer = (audio, uid) => {
    const userItem = document.querySelector(`.user-item[data-uid="${uid}"]`);
    if (!userItem) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementAudioSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    audioCtx.resume().catch(() => {});

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animId = null;

    const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const vol = avg / 256;
        const indicator = userItem.querySelector('.indicator');

        if (indicator && vol > 0.05) {
            indicator.style.transform = `scale(${1 + (vol * 0.4)})`;
            indicator.style.boxShadow = `0 0 ${vol * 20}px #2ed573`;
        } else if (indicator) {
            indicator.style.transform = 'scale(1)';
            indicator.style.boxShadow = '0 0 8px #2ed573';
        }
        animId = requestAnimationFrame(animate);
    };
    animate();
    window.AppState.remoteAudioAnalyzers.set(uid, { analyser, animationId: animId });
};

window.attachRemoteAudioV3 = (stream, uid) => {
    if (!stream) return;
    const container = window.$('remote-audio-container');
    if (!container) return;
    const audioId = `rtc-audio-${uid}`;
    document.getElementById(audioId)?.remove();
    window.cleanupRemoteAudioIndicator(uid);

    const audio = document.createElement('audio');
    audio.id = audioId;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = stream;
    audio.volume = parseFloat(window.$('voice-volume')?.value || '1');
    container.appendChild(audio);

    audio.oncanplay = () => {
        window.createRemoteAudioAnalyzer(audio, uid);
        audio.play().catch(() => document.addEventListener('click', () => audio.play().catch(() => {}), { once: true }));
    };
};

window.destroyVoiceConnection = (remoteUid) => {
    const entry = window.AppState.voicePeerConnections.get(remoteUid);
    if (entry?.pc) {
        try { entry.pc.onicecandidate = null; } catch (e) {}
        try { entry.pc.ontrack = null; } catch (e) {}
        try { entry.pc.close(); } catch (e) {}
    }
    window.AppState.voicePeerConnections.delete(remoteUid);
    document.getElementById(`rtc-audio-${remoteUid}`)?.remove();
    window.cleanupRemoteAudioIndicator(remoteUid);
};

window.destroyAllVoiceConnections = () => {
    Array.from(window.AppState.voicePeerConnections.keys()).forEach(window.destroyVoiceConnection);
    window.AppState.voiceParticipantsCache = {};
};

window.ensureVoicePeerConnection = (remoteUid) => {
    const existing = window.AppState.voicePeerConnections.get(remoteUid);
    if (existing?.pc && existing.pc.connectionState !== 'closed') return existing.pc;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteParticipant = window.AppState.voiceParticipantsCache[remoteUid] || {};
    
    if (window.AppState.myStream) {
        window.AppState.myStream.getTracks().forEach((track) => pc.addTrack(track, window.AppState.myStream));
    }

    pc.onicecandidate = ({ candidate }) => {
        if (!candidate || !window.AppState.currentRoomId || !window.AppState.voiceSessionId) return;
        const targetSessionId = window.AppState.voiceParticipantsCache[remoteUid]?.sessionId;
        if (!targetSessionId) return;
        push(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/candidates/${remoteUid}/${window.auth.currentUser.uid}`), {
            candidate: candidate.toJSON(),
            fromSessionId: window.AppState.voiceSessionId,
            toSessionId: targetSessionId,
            ts: Date.now()
        });
    };

    pc.ontrack = (event) => {
        const [stream] = event.streams || [];
        if (stream) window.attachRemoteAudioV3(stream, remoteUid);
    };

    pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) window.destroyVoiceConnection(remoteUid);
    };

    window.AppState.voicePeerConnections.set(remoteUid, { pc, remoteSessionId: remoteParticipant.sessionId || null });
    return pc;
};

window.createVoiceOfferFor = async (remoteUid) => {
    if (!window.AppState.myStream || !window.AppState.voiceSessionId || !window.AppState.currentRoomId || remoteUid === window.auth.currentUser.uid) return;
    if (window.auth.currentUser.uid.localeCompare(remoteUid) >= 0) return;

    const remoteSessionId = window.AppState.voiceParticipantsCache[remoteUid]?.sessionId;
    if (!remoteSessionId) return;

    const pc = window.ensureVoicePeerConnection(remoteUid);
    if (pc.signalingState !== 'stable') return;

    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await set(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/offers/${remoteUid}/${window.auth.currentUser.uid}`), {
        description: pc.localDescription.toJSON(),
        fromSessionId: window.AppState.voiceSessionId,
        toSessionId: remoteSessionId,
        ts: Date.now()
    });
};

window.enableMicrophoneNative = async (button) => {
    try {
        window.AppState.myStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        window.AppState.voiceSessionId = crypto.randomUUID();
        button?.classList.add('active');
        
        await set(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/participants/${window.auth.currentUser.uid}`), {
            sessionId: window.AppState.voiceSessionId,
            ts: Date.now()
        });
        
        for (const remoteUid of Object.keys(window.AppState.voiceParticipantsCache)) {
            await window.createVoiceOfferFor(remoteUid);
        }
        window.showToast('Микрофон включен');
    } catch (e) {
        button?.classList.remove('active');
        window.showToast('Ошибка доступа к микрофону');
    }
};

window.disableMicrophoneNative = async ({ notify = true } = {}) => {
    if (window.AppState.myStream) {
        window.AppState.myStream.getTracks().forEach((track) => track.stop());
    }
    window.AppState.myStream = null;

    if (window.AppState.currentRoomId && window.auth?.currentUser) {
        try { await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/participants/${window.auth.currentUser.uid}`)); } catch (e) {}
    }

    window.AppState.voiceSessionId = null;
    window.$('mic-btn')?.classList.remove('active');
    window.destroyAllVoiceConnections();
    if (notify) window.showToast('Микрофон выключен');
};

// --- PRESENCE & GLOBAL STATUS ---
window.bindSelfPresence = () => {
    if (!window.auth.currentUser) return;
    const connectedRef = ref(window.db, '.info/connected');
    const statusRef = ref(window.db, `users/${window.auth.currentUser.uid}/status`);
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            onDisconnect(statusRef).set({ online: false, lastSeen: Date.now() }).then(() => {
                set(statusRef, { online: true, lastSeen: Date.now() });
            });
        }
    });
};

// --- ROOM SYSTEM ---
window.enterRoom = (roomId, name, link, adminId) => {
    if (window.closeDirectChatModal) window.closeDirectChatModal();
    window.AppState.currentRoomId = roomId;
    window.AppState.lastSyncTs = 0;
    window.AppState.processedMsgs.clear();
    window.AppState.currentPresenceCache = {};
    window.AppState.latestRoomPresenceData = {};
    window.AppState.isHost = window.auth.currentUser.uid === adminId;
    window.AppState.roomEnteredAt = Date.now();

    if (window.$('room-title-text')) window.$('room-title-text').innerText = name;
    
    const player = window.$('native-player');
    if (player) {
        player.src = link;
        player.controls = window.AppState.isHost;
        player.style.pointerEvents = window.AppState.isHost ? 'auto' : 'none';
    }

    if (window.$('player-wrapper')) {
        window.$('player-wrapper').style.backgroundImage = '';
        window.$('player-wrapper').style.backgroundSize = '';
    }

    if (window.$('chat-messages')) window.$('chat-messages').innerHTML = '';
    if (window.$('users-list')) window.$('users-list').innerHTML = '';

    window.showScreen('room-screen');
    if (window.closeRoomInviteModal) window.closeRoomInviteModal();

    const delBtn = window.$('btn-delete-room');
    const editBtn = window.$('btn-edit-room');
    if (delBtn) {
        delBtn.style.display = window.AppState.isHost ? 'inline-block' : 'none';
        delBtn.onclick = async () => {
            if (!window.AppState.isHost || !confirm('ВНИМАНИЕ! Удалить эту комнату навсегда?')) return;
            await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}`)).catch(() => window.showToast('Ошибка'));
        };
    }
    if (editBtn) {
        editBtn.style.display = window.AppState.isHost ? 'inline-block' : 'none';
        editBtn.onclick = () => {
            window.AppState.editingRoomId = window.AppState.currentRoomId;
            const meta = window.AppState.roomsCache[window.AppState.currentRoomId] || {};
            if (window.$('room-name')) window.$('room-name').value = meta.name || '';
            if (window.$('room-link')) window.$('room-link').value = meta.link || '';
            if (window.$('room-button-color')) window.$('room-button-color').value = meta.buttonColor || '#ffffff';
            if (window.$('room-private')) {
                window.$('room-private').checked = !!meta.private;
                if (window.$('room-password')) window.$('room-password').style.display = !!meta.private ? 'block' : 'none';
            }
            window.$('modal-create')?.classList.add('active');
        };
    }

    window.initRoomServices();
    window.showToast(window.AppState.isHost ? 'Вы зашли как Хост' : 'Вы зашли как Зритель');
};

window.leaveRoom = async () => {
    if (window.closeDirectChatModal) window.closeDirectChatModal();
    await window.disableMicrophoneNative({ notify: false });
    
    window.AppState.teardownFuncs.forEach(unsub => { try { unsub(); } catch (e) {} });
    window.AppState.teardownFuncs = [];

    window.AppState.roomProfileSubscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch (e) {} });
    window.AppState.roomProfileSubscriptions.clear();

    if (window.AppState.currentRoomId && window.auth.currentUser) {
        const presenceRef = ref(window.db, `rooms/${window.AppState.currentRoomId}/presence/${window.auth.currentUser.uid}`);
        try { await remove(presenceRef); } catch (e) {}
    }

    const player = window.$('native-player');
    if (player) { player.pause(); player.src = ''; }
    
    window.AppState.currentRoomId = null;
    window.AppState.currentPresenceCache = {};
    window.AppState.latestRoomPresenceData = {};
    
    window.$('modal-join')?.classList.remove('active');
    if (window.$('btn-delete-room')) window.$('btn-delete-room').style.display = 'none';
    if (window.$('btn-edit-room')) window.$('btn-edit-room').style.display = 'none';
    
    window.showScreen('lobby-screen');
};

window.initRoomServices = () => {
    const roomId = window.AppState.currentRoomId;
    if (!roomId) return;

    const roomRef = ref(window.db, `rooms/${roomId}`);
    const videoRef = ref(window.db, `rooms/${roomId}/sync`);
    const chatRef = ref(window.db, `rooms/${roomId}/chat`);
    const presenceDbRef = ref(window.db, `rooms/${roomId}/presence`);
    const reactionsRef = ref(window.db, `rooms/${roomId}/reactions`);
    const voiceRefs = window.getVoiceRefs(roomId);
    const player = window.$('native-player');

    // 1. Set Self Presence
    const presenceRef = ref(window.db, `rooms/${roomId}/presence/${window.auth.currentUser.uid}`);
    set(presenceRef, { name: window.getDisplayName(), perms: window.getDefaultRoomPerms(window.AppState.isHost) });
    onDisconnect(presenceRef).remove();

    // 2. Room Delete Listener
    const unsubRoom = onValue(roomRef, (snap) => {
        if (!snap.exists() && window.AppState.currentRoomId) {
            window.showToast('Комната удалена');
            window.leaveRoom();
        }
    });
    window.AppState.teardownFuncs.push(() => off(roomRef, 'value', unsubRoom));

    // 3. Presence Listener
    const unsubPresence = onValue(presenceDbRef, (snap) => {
        window.AppState.currentPresenceCache = snap.val() || {};
        if (typeof window.rerenderRoomUsers === 'function') window.rerenderRoomUsers();
    });
    window.AppState.teardownFuncs.push(() => off(presenceDbRef, 'value', unsubPresence));

    // 4. Video Sync Listener
    const broadcastVideoState = (type) => {
        const localPerms = window.getEffectiveRoomPerms(window.AppState.currentPresenceCache[window.auth.currentUser.uid], window.AppState.isHost);
        if (window.AppState.isRemoteAction || (!localPerms.player && !window.AppState.isHost)) return;
        set(videoRef, {
            type,
            time: player.currentTime,
            ts: Date.now(),
            by: window.auth.currentUser.uid,
            state: (type === 'play' || !player.paused) ? 'playing' : 'paused'
        });
    };

    player.onplay = () => broadcastVideoState('play');
    player.onpause = () => broadcastVideoState('pause');
    player.onseeked = () => broadcastVideoState('seek');

    const unsubSync = onValue(videoRef, (snap) => {
        const d = snap.val();
        if (!d || d.ts <= window.AppState.lastSyncTs) return;
        if (d.by === window.auth.currentUser.uid && (Date.now() - d.ts < 800)) return;

        window.AppState.lastSyncTs = d.ts;
        window.AppState.isRemoteAction = true;

        if (Math.abs(player.currentTime - d.time) > 0.5) player.currentTime = d.time;
        if (d.state === 'playing' || d.type === 'play') player.play().catch(() => {});
        else player.pause();
        
        setTimeout(() => { window.AppState.isRemoteAction = false; }, 300);
    });
    window.AppState.teardownFuncs.push(() => off(videoRef, 'value', unsubSync));

    // 5. Chat Listener
    const unsubChat = onChildAdded(chatRef, (snap) => {
        const msg = snap.val();
        const id = snap.key;
        if (window.AppState.processedMsgs.has(id)) return;
        window.AppState.processedMsgs.add(id);
        if (typeof window.appendChatMessage === 'function') window.appendChatMessage(msg);
    });
    window.AppState.teardownFuncs.push(() => off(chatRef, 'child_added', unsubChat));

    // 6. Reactions Listener
    const unsubReactions = onChildAdded(reactionsRef, (snap) => {
        const reaction = snap.val();
        if (!reaction || Date.now() - reaction.ts > 5000) return;
        if (typeof window.showFloatingReaction === 'function') window.showFloatingReaction(reaction.emoji);
    });
    window.AppState.teardownFuncs.push(() => off(reactionsRef, 'child_added', unsubReactions));

    // 7. WebRTC Listeners
    const unsubParts = onValue(voiceRefs.participants, async (snap) => {
        window.AppState.voiceParticipantsCache = snap.val() || {};
        for (const remoteUid of Array.from(window.AppState.voicePeerConnections.keys())) {
            if (!window.AppState.voiceParticipantsCache[remoteUid]) window.destroyVoiceConnection(remoteUid);
        }
        if (window.AppState.myStream && window.AppState.voiceSessionId) {
            for (const remoteUid of Object.keys(window.AppState.voiceParticipantsCache)) {
                await window.createVoiceOfferFor(remoteUid);
            }
        }
    });
    
    const handleIncomingOffers = async (offers = {}) => {
        const localSessionId = window.AppState.voiceSessionId;
        if (!localSessionId || !window.AppState.myStream || !window.AppState.currentRoomId) return;
        for (const [fromUid, payload] of Object.entries(offers)) {
            if (!payload?.description) continue;
            const remotePart = window.AppState.voiceParticipantsCache[fromUid];
            if (!remotePart?.sessionId || payload.toSessionId !== localSessionId || payload.fromSessionId !== remotePart.sessionId) continue;

            const pc = window.ensureVoicePeerConnection(fromUid);
            try {
                if (pc.signalingState !== 'stable') { try { await pc.setLocalDescription({ type: 'rollback' }); } catch (e) {} }
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await set(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/answers/${fromUid}/${window.auth.currentUser.uid}`), {
                    description: pc.localDescription.toJSON(),
                    fromSessionId: localSessionId,
                    toSessionId: remotePart.sessionId,
                    ts: Date.now()
                });
                await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/offers/${window.auth.currentUser.uid}/${fromUid}`));
            } catch (e) {}
        }
    };

    const handleIncomingAnswers = async (answers = {}) => {
        const localSessionId = window.AppState.voiceSessionId;
        if (!localSessionId || !window.AppState.currentRoomId) return;
        for (const [fromUid, payload] of Object.entries(answers)) {
            if (!payload?.description) continue;
            const remotePart = window.AppState.voiceParticipantsCache[fromUid];
            const pc = window.AppState.voicePeerConnections.get(fromUid)?.pc;
            if (!pc || !remotePart?.sessionId || payload.toSessionId !== localSessionId || payload.fromSessionId !== remotePart.sessionId) continue;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
                await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/answers/${window.auth.currentUser.uid}/${fromUid}`));
            } catch (e) {}
        }
    };

    const handleIncomingCandidates = async (candidateGroups = {}) => {
        const localSessionId = window.AppState.voiceSessionId;
        if (!localSessionId || !window.AppState.currentRoomId) return;
        for (const [fromUid, candidates] of Object.entries(candidateGroups)) {
            const remotePart = window.AppState.voiceParticipantsCache[fromUid];
            if (!remotePart?.sessionId) continue;
            const pc = window.ensureVoicePeerConnection(fromUid);
            for (const [candidateId, payload] of Object.entries(candidates || {})) {
                if (!payload?.candidate || payload.toSessionId !== localSessionId || payload.fromSessionId !== remotePart.sessionId) continue;
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    await remove(ref(window.db, `rooms/${window.AppState.currentRoomId}/rtc/candidates/${window.auth.currentUser.uid}/${fromUid}/${candidateId}`));
                } catch (e) {}
            }
        }
    };

    const unsubOffers = onValue(voiceRefs.offersForMe, (snap) => handleIncomingOffers(snap.val() || {}));
    const unsubAnswers = onValue(voiceRefs.answersForMe, (snap) => handleIncomingAnswers(snap.val() || {}));
    const unsubCandidates = onValue(voiceRefs.candidatesForMe, (snap) => handleIncomingCandidates(snap.val() || {}));

    window.AppState.teardownFuncs.push(
        () => off(voiceRefs.participants, 'value', unsubParts),
        () => off(voiceRefs.offersForMe, 'value', unsubOffers),
        () => off(voiceRefs.answersForMe, 'value', unsubAnswers),
        () => off(voiceRefs.candidatesForMe, 'value', unsubCandidates)
    );
};