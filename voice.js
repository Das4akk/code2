const VoiceManager = {
    peer: null,
    myStream: null,
    activeCalls: new Set(),
    analyser: null,
    animationId: null,

    init() {
        this.peer = new Peer(undefined, {
            host: '0.peerjs.com', port: 443, secure: true,
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
        });

        this.peer.on('call', (call) => {
            call.answer(this.myStream);
            call.on('stream', (remoteStream) => this.attachAudio(remoteStream, call.peer));
        });
    },

    async toggleMic(roomId, db, auth, btn) {
        if (!this.myStream) {
            try {
                this.myStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                btn.classList.add('active');
                if (this.peer.id) {
                    window.fSet(window.fRef(db, `rooms/${roomId}/voice/${auth.currentUser.uid}`), this.peer.id);
                }
                this.startVisualizer(btn);
                return true;
            } catch (e) { return false; }
        } else {
            this.myStream.getTracks().forEach(t => t.stop());
            this.myStream = null;
            btn.classList.remove('active');
            btn.style.transform = 'scale(1)';
            btn.style.filter = 'none';
            if (this.animationId) cancelAnimationFrame(this.animationId);
            window.fRemove(window.fRef(db, `rooms/${roomId}/voice/${auth.currentUser.uid}`));
            this.activeCalls.clear();
            document.getElementById('remote-audio-container').innerHTML = '';
            return false;
        }
    },

    startVisualizer(el) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(this.myStream);
        this.analyser = audioCtx.createAnalyser();
        this.analyser.fftSize = 32;
        source.connect(this.analyser);
        const data = new Uint8Array(this.analyser.frequencyBinCount);

        const draw = () => {
            if (!this.myStream) return;
            this.analyser.getByteFrequencyData(data);
            let avg = data.reduce((a, b) => a + b, 0) / data.length;
            let vol = avg / 128;
            el.style.transform = `scale(${1 + vol * 0.5})`;
            el.style.filter = `drop-shadow(0 0 ${vol * 30}px #00d1ff)`;
            this.animationId = requestAnimationFrame(draw);
        };
        draw();
    },

    attachAudio(stream, id) {
        if (this.activeCalls.has(id)) return;
        this.activeCalls.add(id);
        let a = document.createElement('audio');
        a.id = `audio-${id}`; a.autoplay = true; a.srcObject = stream;
        a.setAttribute('playsinline', 'true');
        document.getElementById('remote-audio-container').appendChild(a);
        a.play().catch(() => window.addEventListener('click', () => a.play(), { once: true }));
    }
};