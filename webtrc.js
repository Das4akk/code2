import { auth, db, ref, set, onValue, remove, push, onDisconnect } from './firebase.js';

export let myStream = null;
let peerConnections = new Map();
let currentRoomId = null;
let onAudioStreamCallback = null;
let globalVolume = 1;

const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function initVoiceChat(onAudioStream) {
    onAudioStreamCallback = onAudioStream;
}

export function setGlobalVolume(vol) {
    globalVolume = vol;
    document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = vol);
}

export async function toggleMicrophone(roomId) {
    if (myStream) {
        stopMicrophone();
        return false;
    }

    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        currentRoomId = roomId;

        const userRef = ref(db, `rooms/${roomId}/rtc/participants/${auth.currentUser.uid}`);
        await set(userRef, true);
        onDisconnect(userRef).remove();

        listenToSignaling(roomId);
        return true;
    } catch (e) {
        console.error("Mic access denied:", e);
        return false;
    }
}

function listenToSignaling(roomId) {
    const myUid = auth.currentUser.uid;

    onValue(ref(db, `rooms/${roomId}/rtc/participants`), (snap) => {
        const peers = snap.val() || {};
        for (const uid in peers) {
            if (uid !== myUid && !peerConnections.has(uid)) {
                if (myUid > uid) initiateCall(uid, roomId); 
            }
        }
        for (const uid of peerConnections.keys()) {
            if (!peers[uid]) cleanupPeer(uid);
        }
    });

    onValue(ref(db, `rooms/${roomId}/rtc/offers/${myUid}`), async (snap) => {
        const offers = snap.val() || {};
        for (const fromUid in offers) {
            if (!peerConnections.has(fromUid)) {
                await answerCall(fromUid, offers[fromUid].sdp, roomId);
                remove(ref(db, `rooms/${roomId}/rtc/offers/${myUid}/${fromUid}`));
            }
        }
    });

    onValue(ref(db, `rooms/${roomId}/rtc/answers/${myUid}`), async (snap) => {
        const answers = snap.val() || {};
        for (const fromUid in answers) {
            const pc = peerConnections.get(fromUid);
            if (pc && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answers[fromUid].sdp }));
                remove(ref(db, `rooms/${roomId}/rtc/answers/${myUid}/${fromUid}`));
            }
        }
    });

    onValue(ref(db, `rooms/${roomId}/rtc/candidates/${myUid}`), (snap) => {
        const candidates = snap.val() || {};
        for (const fromUid in candidates) {
            const pc = peerConnections.get(fromUid);
            if (pc) {
                for (const key in candidates[fromUid]) {
                    pc.addIceCandidate(new RTCIceCandidate(candidates[fromUid][key]));
                    remove(ref(db, `rooms/${roomId}/rtc/candidates/${myUid}/${fromUid}/${key}`));
                }
            }
        }
    });
}

function createPeerConnection(remoteUid, roomId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(remoteUid, pc);

    if (myStream) {
        myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
    }

    pc.onicecandidate = e => {
        if (e.candidate) {
            push(ref(db, `rooms/${roomId}/rtc/candidates/${remoteUid}/${auth.currentUser.uid}`), e.candidate.toJSON());
        }
    };

    pc.ontrack = e => {
        let container = document.getElementById('remote-audio-container');
        let audio = document.getElementById(`rtc-audio-${remoteUid}`);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `rtc-audio-${remoteUid}`;
            audio.autoplay = true;
            audio.volume = globalVolume;
            container.appendChild(audio);
        }
        audio.srcObject = e.streams[0];
        if (onAudioStreamCallback) onAudioStreamCallback(remoteUid, audio);
    };

    return pc;
}

async function initiateCall(remoteUid, roomId) {
    const pc = createPeerConnection(remoteUid, roomId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await set(ref(db, `rooms/${roomId}/rtc/offers/${remoteUid}/${auth.currentUser.uid}`), { sdp: offer.sdp });
}

async function answerCall(remoteUid, sdp, roomId) {
    const pc = createPeerConnection(remoteUid, roomId);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await set(ref(db, `rooms/${roomId}/rtc/answers/${remoteUid}/${auth.currentUser.uid}`), { sdp: answer.sdp });
}

export function stopMicrophone() {
    if (myStream) myStream.getTracks().forEach(t => t.stop());
    myStream = null;
    if (currentRoomId) remove(ref(db, `rooms/${currentRoomId}/rtc/participants/${auth.currentUser.uid}`));
    peerConnections.forEach((pc, uid) => cleanupPeer(uid));
    peerConnections.clear();
}

function cleanupPeer(uid) {
    const pc = peerConnections.get(uid);
    if (pc) pc.close();
    peerConnections.delete(uid);
    const audio = document.getElementById(`rtc-audio-${uid}`);
    if (audio) audio.remove();
    window.dispatchEvent(new CustomEvent('rtc-peer-left', { detail: { uid } }));
}