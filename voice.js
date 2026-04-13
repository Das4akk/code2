// Делаем VoiceManager экспортируемым модулем
export const VoiceManager = {
    peer: null,
    myStream: null,
    activeCalls: new Set(),
    analyser: null,
    animationId: null,

    init() {
        // Защита от двойной инициализации
        if (this.peer) this.peer.destroy();
        
        // Надежное соединение с использованием STUN-серверов Google (обход NAT)
        this.peer = new Peer(undefined, {
            host: '0.peerjs.com', 
            port: 443, 
            secure: true,
            config: { 
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' }, 
                    { urls: 'stun:stun1.l.google.com:19302' }
                ] 
            }
        });

        // Обработка входящих звонков
        this.peer.on('call', (call) => {
            // Отвечаем нашим стримом (даже если он null, мы сможем слушать)
            call.answer(this.myStream);
            call.on('stream', (remoteStream) => this.attachAudio(remoteStream, call.peer));
        });
    },

    async startMic(btn) {
        try {
            // Включаем фильтры для чистоты звука и исключения эха
            this.myStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true, 
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            btn.classList.add('active');
            this.startVisualizer(btn);
            return this.myStream;
        } catch (e) {
            console.error("Ошибка доступа к микрофону:", e);
            return null;
        }
    },

    stopMic(btn) {
        if (this.myStream) {
            this.myStream.getTracks().forEach(t => t.stop());
            this.myStream = null;
        }
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        if (btn) {
            btn.classList.remove('active');
            btn.style.transform = 'scale(1)';
            btn.style.filter = 'none';
        }
        
        this.activeCalls.clear();
        document.getElementById('remote-audio-container').innerHTML = '';
    },

    callPeer(targetPeerId) {
        // Не звоним самому себе и не дублируем звонки
        if (!this.myStream || this.activeCalls.has(targetPeerId) || targetPeerId === this.peer?.id) return;
        
        const call = this.peer.call(targetPeerId, this.myStream);
        call.on('stream', (remoteStream) => this.attachAudio(remoteStream, targetPeerId));
    },

    attachAudio(stream, id) {
        if (this.activeCalls.has(id)) return;
        this.activeCalls.add(id);
        
        let a = document.createElement('audio');
        a.id = `audio-${id}`; 
        a.autoplay = true; 
        a.srcObject = stream;
        a.setAttribute('playsinline', 'true');
        
        // Подтягиваем громкость из ползунка, если он изменен
        const volSlider = document.getElementById('voice-volume');
        if (volSlider) a.volume = volSlider.value;

        document.getElementById('remote-audio-container').appendChild(a);
        
        // Защита от блокировки автоплея браузером
        a.play().catch(() => window.addEventListener('click', () => a.play(), { once: true }));
    },

    setVolume(vol) {
        document.querySelectorAll('#remote-audio-container audio').forEach(a => a.volume = vol);
    },

    startVisualizer(el) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(this.myStream);
        this.analyser = audioCtx.createAnalyser();
        this.analyser.fftSize = 64; 
        source.connect(this.analyser);
        
        const data = new Uint8Array(this.analyser.frequencyBinCount);

        const draw = () => {
            if (!this.myStream) return;
            this.analyser.getByteFrequencyData(data);
            
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            let avg = sum / data.length;
            let vol = avg / 128;
            
            el.style.transform = `scale(${1 + vol * 0.5})`;
            el.style.filter = `drop-shadow(0 0 ${vol * 30}px rgba(0, 209, 255, 0.8))`;
            
            this.animationId = requestAnimationFrame(draw);
        };
        draw();
    },

    destroy() {
        this.stopMic(null);
    }
};