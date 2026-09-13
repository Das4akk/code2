const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const originalMain = `        <div id="view-status" style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px"></div>

        <div id="view-bio" style="
             color: var(--text-muted);
             font-size: 14px;
             margin-bottom: 25px;
             line-height: 1.5;
           "></div>`;

const replaceMain = `        <div class="mobile-only-description">
          <div class="view-status" style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px"></div>
          <div class="view-bio" style="
               color: var(--text-muted);
               font-size: 14px;
               margin-bottom: 25px;
               line-height: 1.5;
             "></div>
        </div>`;

html = html.replace(originalMain, replaceMain);

const originalSide = `        <div class="hashtags-list" id="view-hashtags"></div>`;
const replaceSide = `        <div class="hashtags-list" id="view-hashtags"></div>
        
        <div class="desktop-only-description">
          <div class="view-status" style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px"></div>
          <div class="view-bio" style="
               color: var(--text-muted);
               font-size: 14px;
               margin-bottom: 25px;
               line-height: 1.5;
             "></div>
        </div>

        <div id="view-profile-stats" style="margin-top: 15px; padding: 12px; background: rgba(34,34,34,0.5); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); width: 100%;">
          <div style="font-size: 14px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">Статистика профиля</div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
             <span style="color: var(--text-muted);">Дата регистрации:</span>
             <span id="view-stat-created" style="color: #fff; font-weight: 600;">Неизвестно</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
             <span style="color: var(--text-muted);">ID пользователя:</span>
             <span id="view-stat-uid" style="color: #fff; font-weight: 600; font-family: monospace; font-size: 11px;"></span>
          </div>
        </div>`;

html = html.replace(originalSide, replaceSide);

fs.writeFileSync('index.html', html);
console.log("Replaced DOM elements.");
