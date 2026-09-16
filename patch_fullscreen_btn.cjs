const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const containerOpen = `<div class="video-container glass-panel" style="position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">`;
const containerWithExitBtn = `<div class="video-container glass-panel" style="position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease;">
            <button id="btn-exit-fullscreen" style="display: none; position: absolute; top: 20px; right: 20px; z-index: 1000; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; width: 44px; height: 44px; color: #fff; cursor: pointer; align-items: center; justify-content: center; backdrop-filter: blur(10px); transition: all 0.3s ease;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            </button>`;

html = html.replace(containerOpen, containerWithExitBtn);

fs.writeFileSync('index.html', html);
