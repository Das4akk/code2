const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const settingsHTML = `
        <main class="rooms-main" id="section-settings" style="display: none">
          <div class="lobby-header">
            <h2>
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp" style="width: 1.2em; height: 1.2em; vertical-align: bottom" />
              Настройки
            </h2>
          </div>
          <div class="friends-container" style="padding: 20px;">
            <div style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid var(--border-light); margin-bottom: 20px;">
              <h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 700;">Внешний вид и анимации</h3>
              <div style="display:flex; flex-direction:column; gap:12px;">
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                      <input type="checkbox" id="site-settings-theme" onchange="toggleGlobalThemeSetting(this.checked)" style="width:20px;height:20px;">
                      <span>Светлая тема (Лобби)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Отключите для повышения производительности">
                      <input type="checkbox" id="site-settings-particle" checked onchange="toggleSiteParticlesSetting(this.checked)" style="width:20px;height:20px;">
                      <span>Включить анимации частиц фона</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Премиальный черный фон">
                      <input type="checkbox" id="site-settings-neuro" checked onchange="toggleSiteNeuroSetting(this.checked)" style="width:20px;height:20px;">
                      <span>Премиальный черный фон (neuro-bg)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                      <input type="checkbox" id="site-settings-static-emojis" onchange="toggleStaticEmojis(this.checked)" style="width:20px;height:20px;">
                      <span>Использовать статичные эмодзи вместо анимаций</span>
                  </label>
              </div>
            </div>

            <div style="background: rgba(255,100,100,0.05); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,100,100,0.2); margin-bottom: 20px;">
              <h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 700;">🛡️ Безопасность</h3>
              <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="font-size: 14px; margin-bottom: 10px; color: var(--text-muted);">Настройки Email</h3>
                <div class="security-email-box" id="security-email-box"></div>
                <div class="security-note" id="security-verified-note"></div>
                <input type="email" id="security-email-input" placeholder="Введите новый email" />
                <input type="password" id="security-password-input" placeholder="Введите текущий пароль" style="display: none" />
                <button class="primary-btn" id="btn-security-email-action">Изменить email</button>
              </div>
              <div id="security-set-password-section" style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 12px; margin-bottom: 20px; display: none;">
                <h3 style="font-size: 14px; margin-bottom: 10px; color: var(--text-muted);">Задать пароль (для входа по email)</h3>
                <input type="password" id="security-new-password" placeholder="Придумайте пароль (мин. 6 симв.)" />
                <button class="primary-btn" id="btn-security-set-password">Установить пароль</button>
              </div>
            </div>
          </div>
        </main>
`;

html = html.replace('id="nav-settings" onclick="openSiteSettings()"', 'id="nav-settings"');
html = html.replace('src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gear.webp"', 'src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp"');
html = html.replace('src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gear.webp"', 'src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp"'); // do it twice in case

// We'll append section-settings right before the closing tag of section-catalog's sibling if possible. Or find section-catalog and append it after it.
const catalogRegex = /(<main class="rooms-main" id="section-catalog" style="display: none">[\s\S]*?<\/main>)/;
html = html.replace(catalogRegex, '$1\n' + settingsHTML);

// Remove modal-site-settings completely. Need a more robust regex or string replacement.
const modalSiteStart = '<div class="modal godmode-modal" id="modal-site-settings"';
if (html.includes(modalSiteStart)) {
  const m1 = html.indexOf(modalSiteStart);
  const m2 = html.indexOf('</script>', m1);
  if (m1 !== -1 && m2 !== -1) {
    html = html.substring(0, m1) + html.substring(m2 + 9);
  }
}

// Remove modal-security completely
const modalSecStart = '<div class="modal" id="modal-security">';
if (html.includes(modalSecStart)) {
  const m1 = html.indexOf(modalSecStart);
  // find the closing </div> of modal-security.
  // We can just use regex for it
  html = html.replace(/<div class="modal" id="modal-security">[\s\S]*?<!-- View User Profile Modal \(Updated Button\) -->/, '<!-- View User Profile Modal (Updated Button) -->');
}

// Fix static emojis JS adding logic
// In this repo, to make webp static, one way is to globally replace the WEBP URLs when that option changes, or we can patch the JS where it injects emojis, or we can use CSS filter if possible. A hacky but effective way is to just listen for changes and maybe apply a global CSS style or do nothing for now as there's no native "static animated webp". Wait, there IS static emoji URL in standard emoji libraries! But since the repo has .png equivalents or maybe we can just freeze images... Actually, we can just replace '.webp' with '.png' if the repo provides PNGs (it does!).
const jsAdditions = `
      function toggleStaticEmojis(enabled) {
        localStorage.setItem("staticEmojis", enabled ? "true" : "false");
        
        const imgs = document.querySelectorAll('img[src*="Telegram-Animated-Emojis"]');
        if (enabled) {
            imgs.forEach(img => img.src = img.src.replace('.webp', '.png'));
        } else {
            imgs.forEach(img => img.src = img.src.replace('.png', '.webp'));
        }
      }
      document.addEventListener("DOMContentLoaded", () => {
        if (localStorage.getItem("staticEmojis") === "true") {
           const seCheckbox = document.getElementById("site-settings-static-emojis");
           if (seCheckbox) seCheckbox.checked = true;
        }
        
        // Setup observer to swap future emojis
        const observer = new MutationObserver(mutations => {
           if (localStorage.getItem("staticEmojis") !== "true") return;
           mutations.forEach(m => {
               if (m.type === 'childList') {
                   m.addedNodes.forEach(node => {
                       if (node.nodeName === 'IMG' && node.src.includes('Telegram-Animated-Emojis')) {
                           node.src = node.src.replace('.webp', '.png');
                       } else if (node.querySelectorAll) {
                           node.querySelectorAll('img[src*="Telegram-Animated-Emojis"]').forEach(img => {
                               img.src = img.src.replace('.webp', '.png');
                           });
                       }
                   });
               }
           });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Initial run
        if (localStorage.getItem("staticEmojis") === "true") {
           document.querySelectorAll('img[src*="Telegram-Animated-Emojis"]').forEach(img => {
               img.src = img.src.replace('.webp', '.png');
           });
        }
      });
`;

html = html.replace('<!-- // [NEW] THEME PERSISTENCE BOOTSTRAP -->', `<!-- // [NEW] THEME PERSISTENCE BOOTSTRAP -->\n<script>${jsAdditions}</script>`);

fs.writeFileSync('index.html', html);
console.log('patched index.html');
