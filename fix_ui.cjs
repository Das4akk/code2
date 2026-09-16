const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix Reaction Bar Position
// Currently it is: <div class="reaction-bar" style="display: flex; flex-direction: column; gap: 12px; justify-content: center; width: 44px; flex-shrink: 0; order: 2;">
// But CSS has position: absolute; left: 50%; transform: translateX(-50%);
// We must override it.
html = html.replace(
  '<div class="reaction-bar" style="display: flex; flex-direction: column; gap: 12px; justify-content: center; width: 44px; flex-shrink: 0; order: 2;">',
  '<div class="reaction-bar" style="display: flex; flex-direction: column; gap: 12px; justify-content: center; width: 44px; flex-shrink: 0; order: 2; position: relative; bottom: auto; left: auto; transform: none; padding: 0; background: transparent;">'
);

// 2. Fix player-section to avoid jittering
html = html.replace(
  '<div class="player-section" style="padding: 0 16px 24px 24px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; height: 100%;">',
  '<div class="player-section" style="padding: 0 16px 24px 24px; display: flex; flex-direction: row; align-items: stretch; justify-content: space-between; gap: 16px; height: 100%; box-sizing: border-box;">'
);

// 3. Fix chat-section border radius and borders
html = html.replace(
  '<div class="chat-section glass-panel" style="display: flex; flex-direction: column; background: #000; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; margin: 0 16px 24px 0; overflow: hidden; max-height: calc(100vh - 80px);">',
  '<div class="chat-section glass-panel" style="display: flex; flex-direction: column; background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px !important; margin: 0 16px 24px 0; overflow: hidden; max-height: calc(100vh - 80px);">'
);

// 4. Let's also ensure video-container has rounded corners with !important
html = html.replace(
  '<div class="video-container glass-panel" style="flex: 1; height: 100%; position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1;">',
  '<div class="video-container glass-panel" style="flex: 1; height: 100%; position: relative; border-radius: 24px !important; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1;">'
);

fs.writeFileSync('index.html', html);
