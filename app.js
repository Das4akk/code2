// ... (Firebase импорты и конфиг те же самые)

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('main-v');
    let currentRoom = null;
    let isAdmin = false;

    // --- СИНХРОНИЗАЦИЯ (ГЛАВНЫЙ ФИКС) ---
    function setupSync(roomId) {
        if (isAdmin) {
            // Админ использует системные кнопки, мы просто слушаем события
            video.controls = true; 
            
            const updateFirebase = () => {
                set(ref(db, `rooms/${roomId}/sync`), {
                    t: video.currentTime,
                    p: video.paused,
                    s: Date.now() // Метка времени для компенсации задержки
                });
            };

            video.onplay = updateFirebase;
            video.onpause = updateFirebase;
            video.onseeking = updateFirebase;
            
            // Периодическая проверка раз в 3 секунды на всякий случай
            setInterval(() => { if(!video.paused) updateFirebase(); }, 3000);

        } else {
            // Зритель видит системные кнопки, но не может нажать (из-за v-tap-blocker)
            video.controls = true; 
            $('v-tap-blocker').classList.remove('hidden');

            onValue(ref(db, `rooms/${roomId}/sync`), (snap) => {
                const data = snap.val();
                if (data) {
                    const diff = Math.abs(video.currentTime - data.t);
                    if (diff > 1.5) video.currentTime = data.t;
                    
                    if (data.p && !video.paused) video.pause();
                    if (!data.p && video.paused) video.play();
                }
            });
        }
    }

    // --- ВХОД В КОМНАТУ ---
    window.enter = (id, r) => {
        currentRoom = id;
        isAdmin = r.host === auth.currentUser.uid;
        
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        document.getElementById('room-screen').style.display = 'flex';
        
        video.src = r.link;
        video.load();
        
        setupSync(id);
        
        // ... (Код чата и онлайна без изменений)
    }

    // --- МИКРОФОН ---
    let isMicOn = false;
    $('btn-mic').onclick = () => {
        isMicOn = !isMicOn;
        $('btn-mic').style.filter = isMicOn ? 'grayscale(0) drop-shadow(0 0 5px #fff)' : 'grayscale(1)';
        // Тут можно добавить логику WebRTC позже
    };
});