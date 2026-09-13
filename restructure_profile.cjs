const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// We need to wrap the banner and tiktok-profile-container inside a new discord-card div.
// First, find the exact string to replace.

let targetHTML = `<main class="rooms-main" id="section-profile" style="display: none">
  <div id="profile-banner-wrapper" style="position: relative; width: 100%; height: 180px; display: none; z-index: 1;">
    <img id="profile-banner-img" style="width: 100%; height: 100%; object-fit: cover; display: block;" src="">
    <div id="profile-banner-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.3);"></div>
  </div>
<div class="tiktok-profile-container" style="position: relative; z-index: 2;">`;

let replacementHTML = `<main class="rooms-main" id="section-profile" style="display: none; overflow-y: auto !important; align-items: center; padding: 40px 20px;">
  <div class="discord-profile-card">
    <div id="profile-banner-wrapper" style="position: relative; width: 100%; aspect-ratio: 21 / 6; min-height: 120px; display: none; z-index: 1;">
      <img id="profile-banner-img" style="width: 100%; height: 100%; object-fit: cover; display: block;" src="">
      <div id="profile-banner-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.3);"></div>
    </div>
    <div class="tiktok-profile-container" style="position: relative; z-index: 2; height: auto !important; overflow-y: visible !important;">`;

html = html.replace(targetHTML, replacementHTML);

// Close the discord-profile-card before closing section-profile.
// Find the end of section-profile.
html = html.replace(/<\/div>\s*<\/main>\s*<!-- Lobby Header -->/, '</div></div></main>\n    <!-- Lobby Header -->');

fs.writeFileSync('index.html', html);
console.log("DOM restructured.");
