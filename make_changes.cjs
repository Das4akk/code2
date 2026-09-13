const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Online/Offline status under Nickname (Bold).
// Originally: <div id="view-username" style="..."> @user </div>
html = html.replace(
  /<div id="view-username"([^>]*)>\s*@user\s*<\/div>/,
  `<div id="view-username"$1>\n           @user\n         </div>\n         <div id="view-status" style="font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 12px; display: flex; align-items: center;"></div>`
);

// Remove the old #view-status (if it's still there down below)
html = html.replace(/\s*<div id="view-status" style="font-size: 12px; color: var\(--text-muted\); margin-bottom: 12px"><\/div>/, '');


// 2. Right Column (Achievements, Bio, Stats)
// Originally:
// <div id="view-badges-collection" ...></div>
// <div class="hashtags-list" id="view-hashtags"></div>
const rightColSearch = /<div id="view-badges-collection" style="[\s\S]*?<\/div>\s*<div class="hashtags-list" id="view-hashtags"><\/div>/;
const rightColReplace = `<div style="display: flex; gap: 20px; width: 100%; flex-wrap: wrap;" class="profile-right-content-wrap">
          <div style="flex: 1; min-width: 200px;">
            <div id="view-badges-collection" style="width: 100%; margin-bottom: 15px;"></div>
            <div class="hashtags-list" id="view-hashtags"></div>
            
            <div class="desktop-only-description" style="margin-top: 15px;">
              <div class="view-bio" style="color: var(--text-muted); font-size: 14px; line-height: 1.5;"></div>
            </div>
          </div>
          <div style="flex: 0 0 200px;" class="profile-stats-container">
            <div id="view-profile-stats" style="padding: 12px; background: rgba(34,34,34,0.5); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); width: 100%;">
              <div style="font-size: 14px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">Статистика</div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                 <span style="color: var(--text-muted);">Регистрация:</span>
                 <span id="view-stat-created" style="color: #fff; font-weight: 600;">Неизвестно</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                 <span style="color: var(--text-muted);">Вход:</span>
                 <span id="view-stat-login" style="color: #fff; font-weight: 600;">Неизвестно</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                 <span style="color: var(--text-muted);">ID:</span>
                 <span id="view-stat-uid" style="color: #fff; font-weight: 600; font-family: monospace; font-size: 11px;"></span>
              </div>
            </div>
          </div>
        </div>`;
html = html.replace(rightColSearch, rightColReplace);


// 3. Setup mobile vs desktop bio
const oldBioSearch = /<div id="view-bio" style="[^"]*"><\/div>/;
const mobileBioReplace = `<div class="mobile-only-description" style="width: 100%;">
          <div class="view-bio" style="color: var(--text-muted); font-size: 14px; margin-bottom: 25px; line-height: 1.5;"></div>
        </div>`;
html = html.replace(oldBioSearch, mobileBioReplace);

// Inject styles for mobile-only-description and profile-right-content-wrap
html = html.replace(/<\/style>/, `
  .mobile-only-description { display: none; }
  .desktop-only-description { display: block; }
  @media (max-width: 768px) {
    .mobile-only-description { display: block; }
    .desktop-only-description { display: none; }
    .profile-right-content-wrap { flex-direction: column; gap: 10px !important; }
    .profile-stats-container { flex: 1 1 100% !important; width: 100%; }
  }
</style>`);

// 4. Add Like Button
const dmButtonSearch = /<button class="primary-btn" id="btn-dm-modal" [^>]*>\s*Написать сообщение\s*<\/button>/;
const likeButtonHtml = `<button class="secondary-btn" id="btn-like-profile" style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); border-radius: 8px; color: #fff; cursor: pointer; transition: 0.2s;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="like-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              <span id="view-likes-count" style="font-weight: 600;">0</span>
            </button>`;
html = html.replace(dmButtonSearch, `$& \n            ${likeButtonHtml}`);

fs.writeFileSync('index.html', html);
console.log("HTML modified successfully.");
