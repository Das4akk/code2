const fs = require('fs');

function applyVideoFixes() {
  let code = fs.readFileSync('app.js', 'utf8');

  // Add extractors
  code = code.replace(/static extractRutubeId\(url\) \{/, `static extractVkId(url) {
    if (!url || typeof url !== "string") return null;
    let match = url.match(/vk\\.(?:com|ru)\\/(?:video|video_ext\\.php\\?).*(?:oid=|video-?)(-?\\d+)[_]([A-Za-z0-9]+)/i);
    if (!match) match = url.match(/vkvideo\\.ru\\/video-?(\\d+)_([A-Za-z0-9]+)/i);
    if (!match) match = url.match(/vk\\.com\\/video-?(\\d+)_([A-Za-z0-9]+)/i);
    if (match) return match[1] + '_' + match[2];
    return null;
  }

  static extractVimeoId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/i);
    if (match) return match[1];
    return null;
  }

  static extractTwitchId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/twitch\\.tv\\/([^?]+)/i);
    if (match && match[1] !== 'videos') return match[1];
    return null;
  }

  static extractRutubeId(url) {`);

  // Fix resolution logic in MediaResolverClient.resolve
  const resolutionHack = `const rutubeId = this.extractRutubeId(normalized);
    if (rutubeId) {
      return {
        source: normalized,
        title: "Rutube Video",
        duration: 0,
        thumbnail: \`https://rutube.ru/api/video/\${rutubeId}/thumbnail/?format=json\`, 
        platform: "rutube",
        isHls: false,
        ext: "rutube",
        resolvedAt: Date.now(),
      };
    }

    const vkId = this.extractVkId(normalized);
    if (vkId) {
      return {
        source: \`https://vk.com/video_ext.php?oid=\${vkId.split('_')[0]}&id=\${vkId.split('_')[1]}&hd=2&js_api=1\`,
        title: "VK Video",
        duration: 0,
        thumbnail: "",
        platform: "vk",
        isHls: false,
        ext: "vk",
        resolvedAt: Date.now()
      }
    }

    const vimeoId = this.extractVimeoId(normalized);
    if (vimeoId) {
       return {
         source: \`https://player.vimeo.com/video/\${vimeoId}?api=1\`,
         title: "Vimeo Video",
         duration: 0,
         thumbnail: "",
         platform: "vimeo",
         isHls: false,
         ext: "vimeo",
         resolvedAt: Date.now()
       };
    }

    const twitchId = this.extractTwitchId(normalized);
    if (twitchId) {
       return {
          source: \`https://player.twitch.tv/?channel=\${twitchId}&parent=localhost\`,
          title: "Twitch Stream",
          duration: 0,
          thumbnail: "",
          platform: "twitch",
          isHls: false,
          ext: "twitch",
          resolvedAt: Date.now()
       };
    }`;

  code = code.replace(/const rutubeId = this\.extractRutubeId\(normalized\);\s*if \(rutubeId\) \{[\s\S]*?resolvedAt: Date\.now\(\),\s*\};\s*\}/, resolutionHack);

  // Added Managers for Vk, Vimeo, Twitch
  const managers = `class VkPlayerManager {
  static player = null;
  static iframe = null;

  static destroy() {
    if (this.iframe) { this.iframe.remove(); this.iframe = null; }
    this.player = null;
    window.removeEventListener("message", this.handleMessage);
  }

  static handleMessage = (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.event === "timeupdate") this.currentTime = data.time;
      if (data.event === "onStateChange" && this.onStateChange) this.onStateChange(data.state);
    } catch {}
  };

  static initPlayer(src, onStateChangeCallback) {
    this.destroy();
    this.onStateChange = onStateChangeCallback;
    const container = Utils.$("yt-player");
    container.innerHTML = "";
    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.frameBorder = "0";
    this.iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture;";
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    container.appendChild(this.iframe);
    window.addEventListener("message", this.handleMessage);

    this.player = {
      postMessage: (method, args) => {
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage(JSON.stringify({method}), "*");
        }
      }
    };
    return Promise.resolve(this.player);
  }
  static play() { if (this.player) this.player.postMessage("play"); }
  static pause() { if (this.player) this.player.postMessage("pause"); }
  static seek(time) { if(this.player) this.player.postMessage("seek", {time}); }
  static getCurrentTime() { return this.currentTime || 0; }
  static getState() { return 'unknown'; }
}

class VimeoPlayerManager {
  static player = null;
  static iframe = null;

  static destroy() {
    if (this.iframe) { this.iframe.remove(); this.iframe = null; }
    this.player = null;
    window.removeEventListener("message", this.handleMessage);
  }

  static handleMessage = (e) => {
    try {
      let data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.event === "playProgress") this.currentTime = data.data.seconds;
    } catch {}
  };

  static initPlayer(src, onStateChangeCallback) {
    this.destroy();
    this.onStateChange = onStateChangeCallback;
    const container = Utils.$("yt-player");
    container.innerHTML = "";
    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.frameBorder = "0";
    this.iframe.allow = "autoplay; fullscreen; picture-in-picture";
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    container.appendChild(this.iframe);
    window.addEventListener("message", this.handleMessage);

    this.player = {
      postMessage: (method, value) => {
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage(JSON.stringify({method, value}), "*");
        }
      }
    };
    return Promise.resolve(this.player);
  }
  static play() { if (this.player) this.player.postMessage("play"); }
  static pause() { if (this.player) this.player.postMessage("pause"); }
  static seek(time) { if(this.player) this.player.postMessage("seekTo", time); }
  static getCurrentTime() { return this.currentTime || 0; }
  static getState() { return 'unknown'; }
}

class TwitchPlayerManager {
  static player = null;
  static iframe = null;
  static initPlayer(src) {
    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.style.width = "100%"; this.iframe.style.height = "100%";
    const container = Utils.$("yt-player"); container.innerHTML = "";
    container.appendChild(this.iframe);
    this.player = {};
    return Promise.resolve(this.player);
  }
}
`;

  code = code.replace(/class RutubePlayerManager \{/, managers + '\\nclass RutubePlayerManager {');
  
  // Clean relationship
  // Instead of completely parsing AST, let's null-out the methods in PartnerBondEngine to not break call sites
  // BUT we need to remove badges
  code = code.replace(/case "partner_7":[\s\S]*?(?=case "pioneer":)/, '');
  code = code.replace(/case "partner_30":[\s\S]*?(?=case "partner_100":|case "pioneer":)/, '');
  code = code.replace(/case "partner_100":[\s\S]*?(?=case "pioneer":)/, '');

  code = code.replace(/if\s*\(profile\?\.partner\)\s*badges\.push\(`<span class="partner-badge">Пара<\/span>`\);/, '');

  // Add settings features 
  code = code.replace(/Utils\.\$\("btn-do-login"\)\.onclick = async \(\) => \{/, `
    if (Utils.$("btn-forgot-password")) {
      Utils.$("btn-forgot-password").onclick = async () => {
        const email = Utils.$("login-email").value.trim();
        if(!email) return Utils.toast("Введите почту для сброса", "error");
        Utils.toast("Письмо для сброса пароля будет отправлено на " + email + " (Функционал в разработке)");
      };
    }

    if (Utils.$("btn-settings-change-email")) {
      Utils.$("btn-settings-change-email").onclick = () => {
        const email = Utils.$("settings-new-email").value.trim();
        if(!email) return Utils.toast("Введите новую почту", "error");
        Utils.toast("Письмо с кодом подтверждения будет отправлено на: " + email + " (Скоро)");
      }
    }
    if (Utils.$("btn-settings-change-password")) {
      Utils.$("btn-settings-change-password").onclick = () => {
        const pass = Utils.$("settings-new-password").value.trim();
        if(!pass) return Utils.toast("Введите новый пароль", "error");
        Utils.toast("Пароль будет изменён с подтверждением по почте (Скоро)");
      }
    }

    Utils.$("btn-do-login").onclick = async () => {`);

  fs.writeFileSync('app.js', code);
}
applyVideoFixes();
