const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const bannerHtml = `
  <div id="profile-banner-wrapper" style="position: relative; width: 100%; height: 220px; display: none; z-index: 1;">
    <img id="profile-banner-img" style="width: 100%; height: 100%; object-fit: cover; display: block;" src="">
    <div id="profile-banner-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.3);"></div>
  </div>
`;

html = html.replace(
  '<main class="rooms-main" id="section-profile" style="display: none"><div class="tiktok-profile-container">',
  '<main class="rooms-main" id="section-profile" style="display: none">' + bannerHtml + '<div class="tiktok-profile-container" style="position: relative; z-index: 2;">'
);

fs.writeFileSync('index.html', html);
console.log("Injected profile banner HTML");
