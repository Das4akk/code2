const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const oldUpdate = `  static updateUsersTabButton(ids = [], cache = {}) {
    const btn = Utils.$("tab-users-btn");
    if (!btn) return;
    const list = Array.isArray(ids) ? ids : [];
    const count = list.length;
    const shuffled = [...list].sort(() => Math.random() - 0.5).slice(0, 3);
    const avatarsHtml = shuffled
      .map((uid) => {
        const profile = AppState.usersCache.get(uid) || {};
        const displayName = profile.name || cache?.[uid]?.name || "User";
        const safeName = Utils.escapeHtml(displayName);
        const initial = Utils.escapeHtml((displayName[0] || "U").toUpperCase());
        return \`<span class="users-tab-avatar" title="\${safeName}">\${ProfileManager.getAvatarHtml(profile)}</span>\`;
      })
      .join("");
    btn.innerHTML = \`
            <span class="users-tab-inner">
                <span class="users-tab-left"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Люди (<span id="users-count">\${count}</span>)</span>
                <span class="users-tab-avatars">\${avatarsHtml}</span>
            </span>
        \`;
  }`;

const newUpdate = `  static updateUsersTabButton(ids = [], cache = {}) {
    const list = Array.isArray(ids) ? ids : [];
    const count = list.length;
    const countEl = Utils.$("users-count");
    if (countEl) {
       countEl.innerText = count.toString();
    }
  }`;

js = js.replace(oldUpdate, newUpdate);
fs.writeFileSync('app.js', js);
