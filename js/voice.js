import { db, auth } from 'JS/firebase.js';
import { ref, set, onChildAdded, onValue, off, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { UI } from 'JS/ui.js';

export const VoiceSystem = {
    localStream: null,
    peers: new Map(), // uid -> RTCPeerConnection
    roomId: null,
    isMuted: true,

    async init(roomId) {
        this.roomId = roomId;
        this.isMuted = true;
        UI.setMicActive(false);
    },

    async toggleMic() {
        if (!this.localStream) {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                // При получении стрима — обновляем все существующие соединения
                this.peers.forEach(peer => {
                    this.localStream.getTracks().forEach(track => peer.addTrack(track, this.localStream));
                });
            } catch (e) {
                UI.showToast("Доступ к микрофону запрещен");
                return;
            }
        }

        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
        UI.setMicActive(!this.isMuted);
    },

    async setupPeer(targetUid, isOfferer) {
        if (this.peers.has(targetUid)) return;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peers.set(targetUid, pc);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
        }

        pc.ontrack = (e) => UI.attachRemoteAudio(targetUid, e.streams[0]);
        
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                set(ref(db, `rooms/${this.roomId}/signals/${targetUid}/${auth.currentUser.uid}/ice/${Date.now()}`), JSON.stringify(e.candidate));
            }
        };

        if (isOfferer) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await set(ref(db, `rooms/${this.roomId}/signals/${targetUid}/${auth.currentUser.uid}/offer`), JSON.stringify(offer));
        }

        // Слушаем сигналы от этого пира
        const signalRef = ref(db, `rooms/${this.roomId}/signals/${auth.currentUser.uid}/${targetUid}`);
        onValue(signalRef, async (snap) => {
            const data = snap.val();
            if (!data) return;

            if (data.offer && !pc.remoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.offer)));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await set(ref(db, `rooms/${this.roomId}/signals/${targetUid}/${auth.currentUser.uid}/answer`), JSON.stringify(answer));
            }

            if (data.answer && !pc.remoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)));
            }

            if (data.ice) {
                Object.values(data.ice).forEach(candidateStr => {
                    pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateStr))).catch(()=>{});
                });
            }
        });
    },

    removePeer(uid) {
        const pc = this.peers.get(uid);
        if (pc) {
            pc.close();
            this.peers.delete(uid);
        }
        UI.removeRemoteAudio(uid);
    },

    shutdown() {
        this.peers.forEach((pc, uid) => this.removePeer(uid));
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        if (this.roomId) {
            remove(ref(db, `rooms/${this.roomId}/signals/${auth.currentUser.uid}`)).catch(()=>{});
        }
        this.roomId = null;
    }
};