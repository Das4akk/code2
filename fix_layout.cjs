const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldPlayerSection = `<div class="player-section" style="padding: 0 54px 24px 24px; position: relative;">
          <div class="reaction-bar" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 12px;">`;

const newPlayerSection = `<div class="player-section" style="padding: 0 16px 24px 24px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; height: 100%;">
          <div class="reaction-bar" style="display: flex; flex-direction: column; gap: 12px; justify-content: center; width: 44px; flex-shrink: 0; order: 2;">`;

html = html.replace(oldPlayerSection, newPlayerSection);

const oldVideoContainer = `<div class="video-container glass-panel" style="position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease;">`;
const newVideoContainer = `<div class="video-container glass-panel" style="flex: 1; height: 100%; position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1;">`;

html = html.replace(oldVideoContainer, newVideoContainer);

fs.writeFileSync('index.html', html);
