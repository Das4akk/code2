const fs = require('fs');

const themes = {
    'matte-toxic': { bg: ['#121212', '#0A0A0A'], accent: '#39FF14', name: 'Toxic' },
    'audi-silver': { bg: ['#bf0a30', '#1c1c1e'], accent: '#c0c0c0', name: 'Audi' },
    'racing-jet': { bg: ['#004225', '#0a0a0a'], accent: '#004225', name: 'Racing' },
    'alpine-pink': { bg: ['#00529b', '#202022'], accent: '#f5b6c2', name: 'Alpine' },
    'solar-flare': { bg: ['#ff4e00', '#ec9f05'], accent: '#ff4e00', name: 'Solar' },
    'neon-tide': { bg: ['#00f2fe', '#4facfe'], accent: '#00f2fe', name: 'Neon' },
    'dusk': { bg: ['#2c3e50', '#fd746c'], accent: '#ff7b54', name: 'Dusk' },
    'venom': { bg: ['#000000', '#1a1a1a'], accent: '#ff003c', name: 'Venom' },
    'twilight': { bg: ['#0f2027', '#203a43', '#2c5364'], accent: '#78ffd6', name: 'Twilight' },
    'noir-rose': { bg: ['#111111', '#1a1a1a'], accent: '#ff6666', name: 'Noir' },
    'vault-gold': { bg: ['#0d0d0d', '#1a1a1a'], accent: '#ffd700', name: 'Vault' },
    'abyss-frost': { bg: ['#000428', '#004e92'], accent: '#00d2ff', name: 'Abyss' },
    'crimson-chalk': { bg: ['#800000', '#1a1111'], accent: '#f4f4f4', name: 'Crimson' },
};

let css = '';
for (const [key, t] of Object.entries(themes)) {
    // Generate background for preview rect
    const grad = `radial-gradient(circle at 20% 12%, ${t.bg[0]} 0%, ${t.bg[1] || t.bg[0]} 100%)`;
    
    css += `
        #room-screen.theme-${key} { background: ${grad}; color: #ffffff; }
        #room-screen.theme-${key} .glass-panel,
        #room-screen.theme-${key} .chat-section,
        #room-screen.theme-${key} .chat-input-area { background: rgba(10, 10, 15, 0.85); border-color: ${t.accent}60; box-shadow: 0 16px 40px ${t.accent}30; }
        #room-screen.theme-${key} .input-wrapper { background: rgba(5, 5, 10, 0.9); border-color: ${t.accent}80; }
        #room-screen.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05); border-color: ${t.accent}40; color: #fff; }
        #room-screen.theme-${key} .self .bubble { background: ${t.accent}20; border-color: ${t.accent}60; color: #fff; }
        #room-screen.theme-${key} .send-btn,
        #room-screen.theme-${key} #btn-share-room,
        #room-screen.theme-${key} #btn-room-settings,
        #room-screen.theme-${key} #btn-leave-room { background: ${t.accent}30; color: #fff; border-color: ${t.accent}60; }
        .theme-rect.${key}::before { content: ''; position: absolute; inset: 0; background: ${grad}; }
    `;
}

fs.writeFileSync('themes.css', css);
console.log('done css');
