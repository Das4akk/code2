const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
const mIdx = c.indexOf('// MARKETPLACE & SOUNDPAD');
const newC = c.slice(0, mIdx) + `// MARKETPLACE & SOUNDPAD
// ============================
window.SoundpadController = class SoundpadController {
    static loadPad() {
        if(!AppState.currentRoomId) return;
        const triggerRef = ref(db, \`rooms/\${AppState.currentRoomId}/soundTrigger\`);
        onValue(triggerRef, (snap) => {
            const data = snap.val();
            if(data && data.timestamp && (Date.now() - data.timestamp < 5000)) {
                if(data.triggeredBy === AppState.currentUser?.uid) return;
                this.playAudio(data.url);
            }
        });
        this.renderGrid();
    }
    static playAudio(url) {
        if(!url) return;
        const volSlider = Utils.$('soundpad-vol-slider');
        const vol = volSlider ? parseFloat(volSlider.value) : 0.8;
        const a = new Audio(url);
        a.volume = vol;
        a.play().catch(()=>{});
    }
    static async renderGrid() {
        const grid = Utils.$('soundpad-grid');
        if(!grid) return;
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const currentProf = AppState.usersCache.get(uid);
        const ownedIds = currentProf?.inventory || [];
        const sounds = [
            { id: 'cow', name: 'Moo', url: window.EasterEggManager?.SOUND_URLS?.moo || 'https://actions.google.com/sounds/v1/animals/cow_moo_1.ogg', hotkey: '1' },
            { id: 'glass', name: 'Glass', url: window.EasterEggManager?.SOUND_URLS?.glass || 'https://actions.google.com/sounds/v1/impacts/glass_shatters_into_debris.ogg', hotkey: '2' },
        ];
        if (window.CatalogManager && CatalogManager.items) {
            ownedIds.forEach(id => {
                const snd = CatalogManager.items.find(i => i.id === id && i.type === 'sound');
                if (snd) sounds.push({ id: snd.id, name: snd.title, url: snd.image, hotkey: '' });
            });
        }
        grid.innerHTML = sounds.map(s => \`
            <div class="sound-btn" onclick="SoundpadController.triggerSound('\${s.url}')">
                <div class="sound-icon">🎵</div>
                <div class="sound-name">\${s.name}</div>
                \${s.hotkey ? \`<div class="sound-hotkey">\${s.hotkey}</div>\` : ''}
            </div>
        \`).join('');
    }
    static triggerSound(url) {
        if(!AppState.currentRoomId) return;
        if(this.lastTrigger && Date.now() - this.lastTrigger < 3000) return Utils.toast('Не спамьте!', 'error');
        this.lastTrigger = Date.now();
        this.playAudio(url);
        set(ref(db, \`rooms/\${AppState.currentRoomId}/soundTrigger\`), { url, timestamp: Date.now(), triggeredBy: AppState.currentUser?.uid });
    }
};
window.AdminSoundManager = class { static initAdmin() {} };
window.ShopController = class { static loadShop() {} };
`;
fs.writeFileSync('app.js', newC);
