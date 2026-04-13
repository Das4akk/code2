// voice.js
export const VoiceManager = {
    peer: null,
    myStream: null,
    activeCalls: new Map(), // Храним звонки, чтобы не дублировать
    audioCtx: null,

    // Инициализация PeerJS
    init(myId) {
        if (this.peer) return;

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

        this.peer.on('open', (id) => console.log("PeerJS готов. Мой ID:", id));

        // Когда нам кто-то звонит
        this.peer.on('call', (call) => {
            console.log("Входящий вызов от:", call.peer);
            // Отвечаем своим стримом (если он есть) или просто пустым ответом
            call.answer(this.myStream);
            call.on('stream', (remoteStream) => {
                this.handleRemoteStream(remoteStream, call.peer);
            });
        });
    },

    // Включение/выключение микрофона
    async toggleMic(btn) {
        // Если микрофон уже включен — выключаем
        if (this.myStream) {
            this.stopMic(btn);
            return false;
        }

        try {
            console.log("Запрашиваю доступ к микрофону...");
            this.myStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            btn.classList.add('active');
            this.startVisualizer(btn);
            console.log("Микрофон получен успешно");
            return true;
        } catch (err) {
            console.error("Ошибка доступа к микрофону:", err);
            alert("Не удалось включить микрофон. Проверь разрешения в браузере!");
            return false;
        }
    },

    stopMic(btn) {
        if (this.myStream) {
            this.myStream.getTracks().forEach(t => t.stop());
            this.myStream = null;
        }
        btn.classList.remove('active');
        btn.style.transform = 'scale(1)';
        btn.style.filter = 'none';
        console.log("Микрофон выключен");
    },

    // Звоним другому пользователю
    callUser(remotePeerId) {
        if (!this.peer || !remotePeerId || remotePeerId === this.peer.id) return;
        if (this.activeCalls.has(remotePeerId)) return;

        console.log("Звоню на ID:", remotePeerId);
        const call = this.peer.call(remotePeerId, this.myStream);
        
        call.on('stream', (remoteStream) => {
            this.handleRemoteStream(remoteStream, remotePeerId);
        });

        this.activeCalls.set(remotePeerId, call);
    },

    // Создание аудио для удаленного пользователя
    handleRemoteStream(stream, id) {
        if (document.getElementById(`audio-${id}`)) return;

        console.log("Подключаю звук от:", id);
        const audio = document.createElement('audio');
        audio.id = `audio-${id}`;
        audio.srcObject = stream;
        audio.autoplay = true;
        
        // Скрытый контейнер для аудио
        const container = document.getElementById('remote-audio-container');
        if (container) container.appendChild(audio);

        // Попытка запустить аудио (обход блокировок браузера)
        const playAudio = () => {
            audio.play().catch(() => {
                console.log("Браузер заблокировал звук, ждем клика...");
                window.addEventListener('click', () => audio.play(), { once: true });
            });
        };
        playAudio();
    },

    // Визуализация сияния кнопки
    startVisualizer(el) {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const source = this.audioCtx.createMediaStreamSource(this.myStream);
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const frame = () => {
            if (!this.myStream) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            const vol = avg / 128;
            el.style.transform = `scale(${1 + vol * 0.4})`;
            el.style.filter = `drop-shadow(0 0 ${vol * 20}px #2ed573)`;
            requestAnimationFrame(frame);
        };
        frame();
    }
};