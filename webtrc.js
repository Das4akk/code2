import { auth, db, ref, set, onValue, remove, push, onDisconnect } from './firebase.js';

export let myStream = null;
let peerConnections = new Map();
let currentRoomId = null;
let globalVolume = 1;

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },

        // ❗ БЕСПЛАТНЫЙ TURN (работает сразу)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// ---------- INIT ----------

export function setGlobalVolume(vol) {
    globalVolume = vol;
    document.querySelectorAll('#remote-audio-container audio')
        .forEach(a => a.volume = vol);
}

// ---------- MIC ----------

export async function toggleMicrophone(roomId) {
    if (myStream) {
        stopMicrophone();
        return false;
    }

    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        currentRoomId = roomId;

        const userRef = ref(db, `rooms/${roomId}/rtc/participants/${auth.currentUser.uid}`);
        await set(userRef, true);
        onDisconnect(userRef).remove();

        listen(roomId);

        return true;

    } catch (e) {
        console.error("Mic error:", e);
        return false;
    }
}

// ---------- SIGNALING ----------

function listen(roomId) {
    const myUid = auth.currentUser.uid;

    // участники
    onValue(ref(db, `rooms/${roomId}/rtc/participants`), (snap) => {
        const peers = snap.val() || {};

        for (const uid in peers) {
            if (uid !== myUid && !peerConnections.has(uid)) {

                // защита от race
                if (myUid > uid) {
                    startCall(uid, roomId);
                }
            }
        }

        // cleanup
        for (const uid of peerConnections.keys()) {
            if (!peers[uid]) cleanup(uid);
        }
    });

    // offers
    onValue(ref(db, `rooms/${roomId}/rtc/offers/${myUid}`), async (snap) => {
        const offers = snap.val() || {};

        for (const fromUid in offers) {
            if (!peerConnections.has(fromUid)) {
                await answer(fromUid, offers[fromUid].sdp, roomId);
                remove(ref(db, `rooms/${roomId}/rtc/offers/${myUid}/${fromUid}`));
            }
        }
    });

    // answers
    onValue(ref(db, `rooms/${roomId}/rtc/answers/${myUid}`), async (snap) => {
        const answers = snap.val() || {};

        for (const fromUid in answers) {
            const pc = peerConnections.get(fromUid);

            if (pc && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription({
                    type: 'answer',
                    sdp: answers[fromUid].sdp
                });

                remove(ref(db, `rooms/${roomId}/rtc/answers/${myUid}/${fromUid}`));
            }
        }
    });

    // ICE
    onValue(ref(db, `rooms/${roomId}/rtc/candidates/${myUid}`), (snap) => {
        const data = snap.val() || {};

        for (const fromUid in data) {
            const pc = peerConnections.get(fromUid);
            if (!pc) continue;

            for (const key in data[fromUid]) {
                pc.addIceCandidate(data[fromUid][key]);
                remove(ref(db, `rooms/${roomId}/rtc/candidates/${myUid}/${fromUid}/${key}`));
            }
        }
    });
}

// ---------- CONNECTION ----------

function createPC(uid, roomId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(uid, pc);

    // отправляем микрофон
    myStream.getTracks().forEach(track => {
        pc.addTrack(track, myStream);
    });

    // ICE
    pc.onicecandidate = e => {
        if (e.candidate) {
            push(ref(db, `rooms/${roomId}/rtc/candidates/${uid}/${auth.currentUser.uid}`), e.candidate.toJSON());
        }
    };

    // звук пришёл
    pc.ontrack = e => {
        let audio = document.getElementById(`audio-${uid}`);

        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${uid}`;
            audio.autoplay = true;
            audio.playsInline = true;
            audio.volume = globalVolume;

            document.getElementById('remote-audio-container').appendChild(audio);
        }

        audio.srcObject = e.streams[0];

        // 🔥 фикс autoplay
        audio.play().catch(() => {
            document.addEventListener('click', () => audio.play(), { once: true });
        });
    };

    // reconnect
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
            console.log('reconnecting to', uid);
            cleanup(uid);
            setTimeout(() => startCall(uid, roomId), 1000);
        }

        if (['disconnected', 'closed'].includes(pc.connectionState)) {
            cleanup(uid);
        }
    };

    return pc;
}

// ---------- CALL FLOW ----------

async function startCall(uid, roomId) {
    const pc = createPC(uid, roomId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await set(ref(db, `rooms/${roomId}/rtc/offers/${uid}/${auth.currentUser.uid}`), {
        sdp: offer.sdp
    });
}

async function answer(uid, sdp, roomId) {
    const pc = createPC(uid, roomId);

    await pc.setRemoteDescription({
        type: 'offer',
        sdp
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await set(ref(db, `rooms/${roomId}/rtc/answers/${uid}/${auth.currentUser.uid}`), {
        sdp: answer.sdp
    });
}

// ---------- CLEANUP ----------

export function stopMicrophone() {
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
    }

    if (currentRoomId && auth.currentUser) {
        remove(ref(db, `rooms/${currentRoomId}/rtc/participants/${auth.currentUser.uid}`));
    }

    peerConnections.forEach((pc, uid) => cleanup(uid));
    peerConnections.clear();
}

function cleanup(uid) {
    const pc = peerConnections.get(uid);
    if (pc) pc.close();

    peerConnections.delete(uid);

    const audio = document.getElementById(`audio-${uid}`);
    if (audio) audio.remove();
}