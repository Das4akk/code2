const fs = require('fs');

const themes = {
    'matte-toxic': { bg: ['#141414', '#0a1208'], accent: '#7fff00', name: 'Toxic' },
    'audi-silver': { bg: ['#eceff3', '#9aa3ad', '#2b3138'], accent: '#d1d6dc', name: 'Audi' },
    'racing-jet': { bg: ['#08080a', '#151c28', '#4a0a0a'], accent: '#e10600', name: 'Racing' },
    'alpine-pink': { bg: ['#a8d4f0', '#5b8fc9', '#3f5f48'], accent: '#f4b8c8', name: 'Alpine' },
    'solar-flare': { bg: ['#ff6a00', '#ffb300', '#fff4d6'], accent: '#ff8c00', name: 'Solar' },
    'neon-tide': { bg: ['#031a2b', '#0a4d6e', '#00e8ff'], accent: '#00e8ff', name: 'Neon' },
    'dusk': { bg: ['#2a1842', '#5a3f6e', '#e8785a'], accent: '#ffb07c', name: 'Dusk' },
    'venom': { bg: ['#040804', '#0f1a10'], accent: '#39ff14', name: 'Venom' },
    'twilight': { bg: ['#1a103c', '#4a3f7a', '#98f5d4'], accent: '#c4b5fd', name: 'Twilight' },
    'noir-rose': { bg: ['#0a0a0a', '#1c1c1c', '#3a1a28'], accent: '#e8748a', name: 'Noir' },
    'vault-gold': { bg: ['#1b3a5c', '#0f2236', '#0a1520'], accent: '#ffd54f', name: 'Vault' },
    'abyss-frost': { bg: ['#010814', '#0a2a4a', '#7dd3fc'], accent: '#bae6fd', name: 'Abyss' },
    'crimson-chalk': { bg: ['#8b0000', '#3d1212', '#f5f0e8'], accent: '#fff5f0', name: 'Crimson' },
};

let css = '';
for (const [key, t] of Object.entries(themes)) {
    const grad = `radial-gradient(ellipse 130% 95% at 18% 8%, ${t.bg.map((c, i) => `${c} ${Math.round((i / (t.bg.length - 1)) * 100)}%`).join(', ')})`;
    const gradPreview = `linear-gradient(165deg, ${t.bg[0]} 0%, ${t.bg[t.bg.length - 1]} 100%)`;

    css += `
        #room-screen.theme-${key} { background: ${grad}; color: #ffffff; }
        #room-screen.theme-${key} .glass-panel,
        #room-screen.theme-${key} .chat-section,
        #room-screen.theme-${key} .chat-input-area { background: rgba(10, 10, 15, 0.85); border-color: ${t.accent}40; box-shadow: 0 16px 40px ${t.accent}20; }
        #room-screen.theme-${key} .input-wrapper { background: rgba(5, 5, 10, 0.9); border-color: ${t.accent}60; }
        #room-screen.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05); border-color: ${t.accent}40; color: #fff; }
        #room-screen.theme-${key} .self .bubble { background: ${t.accent}20; border-color: ${t.accent}60; color: #fff; }
        #room-screen.theme-${key} .send-btn,
        #room-screen.theme-${key} #btn-share-room,
        #room-screen.theme-${key} #btn-room-settings,
        #room-screen.theme-${key} #btn-leave-room { background: ${t.accent}30; color: #fff; border-color: ${t.accent}60; }
        .theme-rect.${key}::before { content: ''; position: absolute; inset: 0; background: ${gradPreview}; }
    `;
}

fs.writeFileSync('themes.css', css);
console.log('done css');
