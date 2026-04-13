// voice.js
export const VoiceManager = {
    peer: null,
    myStream: null,
    activeCalls: {},
    analyser: null,

    // 1. Инициализация PeerJS (делаем сразу при входе в комнату)
    init(onPeerReady) {
        if (this.peer) return; // Чтобы не плодить соединения

        this.peer = new Peer(undefined, {
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        this.peer.on('open', (id) => {
            console.log("Мой Peer ID:", id);
            if (onPeerReady) onPeerReady(id);
        });

        // Слушаем входящие
        this.peer.on('call', (call) => {
            console.log("Входящий звонок от:", call.peer);
            call.answer(this.myStream); // Отвечаем (даже если нашего звука нет, мы будем слушать)
            call.on('stream', (remoteStream) => {
                this.setupAudioElement(remoteStream, call.peer);
            });
        });
    },

    // 2. Включение/Выключение микрофона
    async toggleMic(btn) {
        if (!this.myStream) {
            try {
                // Прямой запрос потока
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                this.myStream = stream;
                btn.classList.add('active');
                this.startVisualizer(btn);
                return true; 
            } catch (err) {
                console.error("Микрофон не доступен:", err);
                return false;
            }
        } else {
            // Выключаем
            this.myStream.getTracks().forEach(track => track.stop());
            this.myStream = null;
            btn.classList.remove('active');
            btn.style.transform = 'scale(1)';
            btn.style.filter = 'none';
            return false;
        }
    },

    // 3. Функция дозвона до другого человека
    callUser(remotePeerId) {
        if (!this.peer || !remotePeerId || remotePeerId === this.peer.id) return;
        if (this.activeCalls[remotePeerId]) return; // Уже звоним

        console.log("Звоню пользователю:", remotePeerId);
        const call = this.peer.call(remotePeerId, this.myStream);
        
        call.on('stream', (remoteStream) => {
            this.setupAudioElement(remoteStream, remotePeerId);
        });
        
        this.activeCalls[remotePeerId] = call;
    },

    // 4. Создание аудио-элемента (только если его еще нет)
    setupAudioElement(stream, id) {
        if (document.getElementById(`audio-${id}`)) return;

        const audio = document.createElement('audio');
        audio.id = `audio-${id}`;
        audio.srcObject = stream;
        audio.autoplay = true;
        
        // Помещаем в скрытый контейнер
        const container = document.getElementById('remote-audio-container');
        if (container) container.appendChild(audio);
        
        console.log("Аудио-поток подключен для:", id);
    },

    // Визуализация (сияние кнопки)
    startVisualizer(el) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(this.myStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
            if (!this.myStream) return;
            analyser.getByteFrequencyData(data);
            let sum = data.reduce((a, b) => a + b, 0);
            let vol = sum / data.length / 128;
            el.style.transform = `scale(${1 + vol * 0.4})`;
            el.style.filter = `drop-shadow(0 0 ${vol * 25}px #00d1ff)`;
            requestAnimationFrame(loop);
        };
        loop();
    }
};