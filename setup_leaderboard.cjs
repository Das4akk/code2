const fs = require('fs');

// 1. Add "Список лучших" to index.html nav
let indexHtml = fs.readFileSync('index.html', 'utf8');
const navFriends = /<div class="nav-item" id="nav-find-friend">[\s\S]*?<\/div>/;
const newNavBtn = `<div class="nav-item" id="nav-find-friend">
              <span><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Magnifying%20Glass%20Tilted%20Left.webp" style="width: 1.2em; height: 1.2em; vertical-align: bottom">
                Найти друга</span>
            </div>
            <div class="nav-item" id="nav-leaderboard">
              <span><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width: 1.2em; height: 1.2em; vertical-align: bottom">
                Список лучших</span>
            </div>`;
indexHtml = indexHtml.replace(navFriends, newNavBtn);

// 2. Add Leaderboard Section HTML
const sectionFriends = /<main class="rooms-main" id="section-friends" style="display: none">/;
const leaderboardHtml = `<main class="rooms-main" id="section-leaderboard" style="display: none">
          <div class="leaderboard-container" style="max-width: 900px; width: 100%; margin: 0 auto; padding-top: 20px;">
            <div class="section-title" style="font-size: 28px; margin-bottom: 24px; text-align: center; color: var(--accent);">
              Список лучших
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; flex-wrap: wrap;">
               <button class="primary-btn" style="width: auto; padding: 8px 16px;">Любимчики (Топ Лайков)</button>
               <!-- Future categories can go here -->
            </div>
            <div id="leaderboard-list" style="display: flex; flex-direction: column; gap: 10px;">
               <div style="color:var(--text-muted); text-align:center;">Загрузка...</div>
            </div>
          </div>
        </main>
        <main class="rooms-main" id="section-friends" style="display: none">`;
indexHtml = indexHtml.replace(sectionFriends, leaderboardHtml);

// 3. Add modal for like stats
const modalOverlay = /<div class="modal-overlay" id="modal-settings">/;
const likeStatsHtml = `<div class="modal-overlay" id="modal-like-stats">
      <div class="modal-content" style="max-width: 400px;">
        <button class="btn-close-modal" onclick="Utils.$('modal-like-stats').classList.remove('active')">
          ✕
        </button>
        <h2 style="margin-bottom: 20px; text-align: center;">Статистика лайков</h2>
        <div style="font-size: 48px; text-align: center; font-weight: 800; color: var(--accent); margin-bottom: 20px;" id="like-stats-total">0</div>
        <div style="font-size: 14px; color: var(--text-muted); font-weight: 600; margin-bottom: 10px;">Последние 10 лайков:</div>
        <div id="like-stats-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 5px;"></div>
      </div>
    </div>
    <div class="modal-overlay" id="modal-settings">`;
indexHtml = indexHtml.replace(modalOverlay, likeStatsHtml);

fs.writeFileSync('index.html', indexHtml);

// 4. Update JS for nav routing and like stats modal logic
let appJs = fs.readFileSync('app.js', 'utf8');

// Nav binding
const navSettingsSearch = /if \(Utils\.\$\("nav-settings"\)\) \{/;
const navLeaderboardAdd = `if (Utils.$("nav-leaderboard")) {
      Utils.$("nav-leaderboard").onclick = () => {
        setNavActive("nav-leaderboard");
        Utils.showScreen("section-leaderboard");
        loadLeaderboard();
      };
    }
    if (Utils.$("nav-settings")) {`;
appJs = appJs.replace(navSettingsSearch, navLeaderboardAdd);

// Modal Like logic
const likeBtnClickSearch = /if \(isSelf\) \{\s*Utils\.toast\("Вы не можете поставить лайк самому себе", "error"\);\s*return;\s*\}/;
const likeBtnClickReplace = `if (isSelf) {
              // Open Like Stats Modal
              Utils.$("modal-like-stats").classList.add("active");
              const likedBy = p.likedBy || {};
              Utils.$("like-stats-total").innerText = Object.keys(likedBy).length;
              
              const listEl = Utils.$("like-stats-list");
              listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Загрузка...</div>';
              
              const likesArray = Object.entries(likedBy)
                .map(([uid, ts]) => ({ uid, ts }))
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 10);
                
              if (likesArray.length === 0) {
                 listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Пока никто не поставил вам лайк.</div>';
                 return;
              }
              
              Promise.all(likesArray.map(async (likeObj) => {
                  if (likeObj.uid.startsWith("fake_like_")) {
                      return \`<div style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;">
                          <div style="flex:1;display:flex;flex-direction:column;">
                              <span style="font-weight:600;">Неизвестный пользователь</span>
                              <span style="font-size:11px;color:var(--text-muted);">\${new Date(likeObj.ts).toLocaleString("ru-RU")}</span>
                          </div>
                      </div>\`;
                  }
                  
                  const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => get(ref(getDatabase(), \`users/\${likeObj.uid}/profile\`)));
                  const prof = snap.val() || {};
                  const avHtml = ProfileManager.getAvatarHtml(prof);
                  return \`<div style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;cursor:pointer;transition:background 0.2s;" onclick="ProfileManager.openViewProfileModal('\${likeObj.uid}')">
                      <div style="width:36px;height:36px;margin-right:12px;border-radius:50%;overflow:visible;">\${avHtml}</div>
                      <div style="flex:1;display:flex;flex-direction:column;">
                          <span style="font-weight:600;">\${Utils.escapeHtml(prof.name || "Пользователь")}</span>
                          <span style="font-size:11px;color:var(--text-muted);">\${new Date(likeObj.ts).toLocaleString("ru-RU")}</span>
                      </div>
                  </div>\`;
              })).then(htmlArr => {
                  listEl.innerHTML = htmlArr.join("");
              });
              
              return;
          }`;
appJs = appJs.replace(likeBtnClickSearch, likeBtnClickReplace);

fs.writeFileSync('app.js', appJs);

console.log("Nav and Like Modal logic configured.");
