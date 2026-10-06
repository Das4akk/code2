/**
 * COWIO Session & Device Manager
 * Tracks active user sessions, devices (PC/Mobile), browser logos, login dates, last active dates, and country flags.
 * Follows UI Design Constitution (Frosted Glass & Animated Telegram Emojis).
 */
import { ref, set, get, update, remove, onDisconnect } from "./firebase.js";
import { db, auth, AppState } from "./firebase.js";
import { Utils } from "./utils.js";

class SessionManager {
  static STORAGE_KEY = "cowio_device_session_id";
  static LOGIN_TIME_KEY = "cowio_device_login_time";
  static COUNTRY_CACHE_KEY = "cowio_device_country_cache_v2";

  static COUNTRY_FLAGS = {
    RU: { name: "Россия", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Russia.webp" },
    KZ: { name: "Казахстан", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Kazakhstan.webp" },
    BY: { name: "Беларусь", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Belarus.webp" },
    UA: { name: "Украина", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Ukraine.webp" },
    UZ: { name: "Узбекистан", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Uzbekistan.webp" },
    KG: { name: "Кыргызстан", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Kyrgyzstan.webp" },
    DE: { name: "Германия", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Germany.webp" },
    US: { name: "США", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20United%20States.webp" },
    GB: { name: "Великобритания", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20United%20Kingdom.webp" },
    FR: { name: "Франция", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20France.webp" },
    PL: { name: "Польша", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Poland.webp" },
    TR: { name: "Турция", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Turkey.webp" },
    GE: { name: "Грузия", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Georgia.webp" },
    AM: { name: "Армения", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Armenia.webp" },
    AZ: { name: "Азербайджан", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Azerbaijan.webp" },
    AE: { name: "ОАЭ", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20United%20Arab%20Emirates.webp" },
    MD: { name: "Молдова", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Flag%20Moldova.webp" },
    DEFAULT: { name: "Неизвестная страна", flag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Flags/Triangular%20Flag.webp" }
  };

  static getSessionId() {
    let sid = localStorage.getItem(this.STORAGE_KEY);
    if (!sid) {
      sid = "sess_" + (Utils.generateCryptoId ? Utils.generateCryptoId(12) : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
      localStorage.setItem(this.STORAGE_KEY, sid);
    }
    return sid;
  }

  static getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua);
    const isTablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isTablet) return "tablet";
    if (isMobile) return "mobile";
    return "desktop";
  }

  static getBrowserDetails() {
    const ua = navigator.userAgent;
    let name = "Веб-браузер";
    let icon = "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Compass.webp";

    if (/yaBrowser/i.test(ua)) {
      name = "Яндекс Браузер";
      icon = "https://cdn-icons-png.flaticon.com/128/9986/9986062.png";
    } else if (/edg\//i.test(ua)) {
      name = "Microsoft Edge";
      icon = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/edge/edge-original.svg";
    } else if (/chrome|crios/i.test(ua)) {
      name = "Google Chrome";
      icon = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/chrome/chrome-original.svg";
    } else if (/firefox|fxios/i.test(ua)) {
      name = "Mozilla Firefox";
      icon = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firefox/firefox-original.svg";
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      name = "Apple Safari";
      icon = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/safari/safari-original.svg";
    } else if (/opera|opr\//i.test(ua)) {
      name = "Opera";
      icon = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opera/opera-original.svg";
    }

    return { name, icon };
  }

  static getDeviceInfo() {
    const ua = navigator.userAgent;
    const devType = this.getDeviceType();
    const browser = this.getBrowserDetails();

    // Detect OS
    let os = "Неизвестная ОС";
    if (/windows nt 10\.0/i.test(ua)) os = "Windows 11 / 10";
    else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
    else if (/windows nt 6\.1/i.test(ua)) os = "Windows 7";
    else if (/windows/i.test(ua)) os = "Windows PC";
    else if (/iphone/i.test(ua)) os = "iPhone (iOS)";
    else if (/ipad/i.test(ua)) os = "iPad (iPadOS)";
    else if (/macintosh|mac os x/i.test(ua)) os = "macOS (MacBook/iMac)";
    else if (/android/i.test(ua)) os = "Android Смартфон";
    else if (/linux/i.test(ua)) os = "Linux PC";

    let icon = "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Laptop.webp";
    let typeName = "Компьютер / ПК";

    if (devType === "mobile") {
      icon = "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Mobile%20Phone.webp";
      typeName = "Смартфон";
    } else if (devType === "tablet") {
      icon = "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Mobile%20Phone.webp";
      typeName = "Планшет";
    }

    const deviceName = `${typeName} (${os})`;

    return {
      devType,
      typeName,
      os,
      browser: browser.name,
      browserIcon: browser.icon,
      deviceName,
      icon
    };
  }

  static async detectCountry() {
    const cached = localStorage.getItem(this.COUNTRY_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.code && Date.now() - (parsed.ts || 0) < 86400000) {
          return parsed;
        }
      } catch (e) {}
    }

    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
    let code = "RU";

    if (tz.includes("moscow") || tz.includes("samara") || tz.includes("yekaterinburg") || tz.includes("omsk") || tz.includes("krasnoyarsk") || tz.includes("irkutsk") || tz.includes("yakutsk") || tz.includes("vladivostok") || tz.includes("kaliningrad") || tz.includes("novosibirsk")) {
      code = "RU";
    } else if (tz.includes("almaty") || tz.includes("qyzylorda") || tz.includes("astana") || tz.includes("aqtobe") || tz.includes("aqtau") || tz.includes("oral")) {
      code = "KZ";
    } else if (tz.includes("minsk")) {
      code = "BY";
    } else if (tz.includes("kyiv") || tz.includes("kiev") || tz.includes("simferopol") || tz.includes("zaporozhye") || tz.includes("uzhgorod")) {
      code = "UA";
    } else if (tz.includes("tashkent") || tz.includes("samarkand")) {
      code = "UZ";
    } else if (tz.includes("bishkek")) {
      code = "KG";
    } else if (tz.includes("yerevan")) {
      code = "AM";
    } else if (tz.includes("tbilisi")) {
      code = "GE";
    } else if (tz.includes("baku")) {
      code = "AZ";
    } else if (tz.includes("chisinau")) {
      code = "MD";
    } else if (tz.includes("berlin") || tz.includes("frankfurt") || tz.includes("munich")) {
      code = "DE";
    } else if (tz.includes("london")) {
      code = "GB";
    } else if (tz.includes("paris")) {
      code = "FR";
    } else if (tz.includes("warsaw")) {
      code = "PL";
    } else if (tz.includes("new_york") || tz.includes("los_angeles") || tz.includes("chicago") || tz.includes("denver")) {
      code = "US";
    } else if (tz.includes("istanbul")) {
      code = "TR";
    } else if (tz.includes("dubai")) {
      code = "AE";
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch("/api/auth/geo", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.country) {
          const apiCode = String(data.country).toUpperCase().trim();
          if (this.COUNTRY_FLAGS[apiCode]) {
            code = apiCode;
          }
        }
      }
    } catch (e) {}

    const flagInfo = this.COUNTRY_FLAGS[code] || this.COUNTRY_FLAGS.DEFAULT;
    const result = {
      code,
      name: flagInfo.name,
      flagUrl: flagInfo.flag,
      ts: Date.now()
    };

    localStorage.setItem(this.COUNTRY_CACHE_KEY, JSON.stringify(result));
    return result;
  }

  static async registerCurrentSession(user) {
    if (!user || !user.uid) return;
    const uid = user.uid;
    const sessionId = this.getSessionId();
    const devInfo = this.getDeviceInfo();
    const countryData = await this.detectCountry();

    let loginAt = parseInt(localStorage.getItem(this.LOGIN_TIME_KEY) || "0", 10);
    if (!loginAt) {
      loginAt = Date.now();
      localStorage.setItem(this.LOGIN_TIME_KEY, String(loginAt));
    }

    const sessionPayload = {
      sessionId,
      deviceType: devInfo.devType,
      typeName: devInfo.typeName,
      deviceName: devInfo.deviceName,
      os: devInfo.os,
      browser: devInfo.browser,
      browserIcon: devInfo.browserIcon,
      icon: devInfo.icon,
      countryCode: countryData.code,
      countryName: countryData.name,
      countryFlag: countryData.flagUrl,
      loginAt,
      lastActiveAt: Date.now(),
      userAgent: navigator.userAgent.slice(0, 180),
      ip: "online"
    };

    try {
      const sessionRef = ref(db, `users/${uid}/profile/sessions/${sessionId}`);
      await set(sessionRef, sessionPayload);
      onDisconnect(sessionRef).update({ lastActiveAt: Date.now() });

      if (this._heartbeat) clearInterval(this._heartbeat);
      this._heartbeat = setInterval(() => {
        if (!AppState.currentUser || AppState.currentUser.uid !== uid) return;
        update(ref(db, `users/${uid}/profile/sessions/${sessionId}`), {
          lastActiveAt: Date.now()
        }).catch(() => {});
      }, 120000);
    } catch (err) {
      console.warn("[SessionManager] Register session error:", err);
    }
  }

  static async getSessions(uid) {
    if (!uid) return [];
    try {
      const snap = await get(ref(db, `users/${uid}/profile/sessions`));
      if (!snap.exists()) return [];
      const val = snap.val() || {};
      const currentSid = this.getSessionId();
      
      const list = Object.entries(val).map(([sid, data]) => ({
        ...data,
        sessionId: sid,
        isCurrent: sid === currentSid
      }));

      list.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
      });

      return list;
    } catch (err) {
      console.warn("[SessionManager] Get sessions error:", err);
      return [];
    }
  }

  static async terminateSession(uid, targetSessionId) {
    if (!uid || !targetSessionId) return;
    try {
      await remove(ref(db, `users/${uid}/profile/sessions/${targetSessionId}`));
      if (targetSessionId === this.getSessionId()) {
        Utils.toast("Текущая сессия завершена", "info");
        if (window.AuthManager && typeof window.AuthManager.signOut === "function") {
          window.AuthManager.signOut();
        }
      } else {
        Utils.toast("Сессия устройства успешно завершена", "success");
      }
      this.refreshSessionsUI();
    } catch (e) {
      Utils.toast("Ошибка при завершении сессии", "error");
    }
  }

  static async terminateAllOtherSessions(uid) {
    if (!uid) return;
    const currentSid = this.getSessionId();
    try {
      const snap = await get(ref(db, `users/${uid}/profile/sessions`));
      if (!snap.exists()) return;
      const val = snap.val() || {};
      const updates = {};
      
      for (const sid of Object.keys(val)) {
        if (sid !== currentSid) {
          updates[`users/${uid}/profile/sessions/${sid}`] = null;
        }
      }

      await update(ref(db), updates);
      Utils.toast("Все остальные устройства отключены", "success");
      this.refreshSessionsUI();
    } catch (e) {
      Utils.toast("Ошибка при завершении сессий", "error");
    }
  }

  static formatDate(ts) {
    if (!ts) return "Недавно";
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year}, ${hours}:${mins}`;
  }

  static formatRelative(ts) {
    if (!ts) return "Недавно";
    const diffMs = Date.now() - ts;
    if (diffMs < 60000) return "Только что";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} мин. назад`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} ч. назад`;
    return this.formatDate(ts);
  }

  static async renderSessionsContainer(containerEl) {
    if (!containerEl) return;
    const user = AppState.currentUser || (window.auth && window.auth.currentUser);
    if (!user) {
      containerEl.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding:12px;">Войдите в аккаунт для просмотра активных сессий.</div>`;
      return;
    }

    containerEl.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding:12px; text-align:center;">Загрузка списка устройств...</div>`;

    const sessions = await this.getSessions(user.uid);
    if (sessions.length === 0) {
      await this.registerCurrentSession(user);
      const reSessions = await this.getSessions(user.uid);
      this._buildSessionsHTML(containerEl, reSessions, user.uid);
      return;
    }

    this._buildSessionsHTML(containerEl, sessions, user.uid);
  }

  static _buildSessionsHTML(containerEl, sessions, uid) {
    const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

    let html = `
      <div style="display:flex; flex-direction:column; gap:12px;">
    `;

    sessions.forEach((sess) => {
      const isCurrent = sess.isCurrent;
      const isOnline = isCurrent || (Date.now() - (sess.lastActiveAt || 0) < 300000);
      const icon = sess.icon || (sess.deviceType === "mobile" 
        ? "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Mobile%20Phone.webp"
        : "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Laptop.webp");

      // Browser logo
      const browserName = sess.browser || "Веб-браузер";
      const browserIcon = sess.browserIcon || (
        /chrome/i.test(browserName)
          ? "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/chrome/chrome-original.svg"
          : (/safari/i.test(browserName)
            ? "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/safari/safari-original.svg"
            : (/yandex/i.test(browserName)
              ? "https://cdn-icons-png.flaticon.com/128/9986/9986062.png"
              : "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Compass.webp"))
      );

      // Country Flag Sticker
      const countryName = sess.countryName || (sess.country ? String(sess.country).replace(/[^\w\sа-яА-ЯёЁ]/gi, '').trim() : "Россия");
      const flagUrl = sess.countryFlag || (this.COUNTRY_FLAGS[sess.countryCode]?.flag || this.COUNTRY_FLAGS.RU.flag);

      html += `
        <div style="
          background: ${isCurrent ? 'rgba(46, 213, 115, 0.05)' : 'rgba(255, 255, 255, 0.02)'};
          border: 1px solid ${isCurrent ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 255, 255, 0.08)'};
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(12px);
          transition: all 0.2s ease;
        ">
          <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 240px;">
            <div style="
              width: 44px;
              height: 44px;
              border-radius: 12px;
              background: ${isCurrent ? 'rgba(46, 213, 115, 0.12)' : 'rgba(255, 255, 255, 0.05)'};
              border: 1px solid ${isCurrent ? 'rgba(46, 213, 115, 0.25)' : 'rgba(255, 255, 255, 0.1)'};
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <img src="${icon}" style="width: 26px; height: 26px; object-fit: contain;" alt="Device">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 15px; color: #ffffff;">${Utils.escapeHtml(sess.deviceName || "Неизвестное устройство")}</span>
                ${isCurrent ? `
                  <span style="
                    font-size: 11px;
                    font-weight: 800;
                    color: #2ed573;
                    background: rgba(46, 213, 115, 0.15);
                    border: 1px solid rgba(46, 213, 115, 0.35);
                    padding: 2px 8px;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                  ">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #2ed573; box-shadow: 0 0 6px #2ed573; display: inline-block;"></span>
                    Текущая сессия
                  </span>
                ` : (isOnline ? `
                  <span style="
                    font-size: 11px;
                    font-weight: 700;
                    color: #2ed573;
                    background: rgba(46, 213, 115, 0.1);
                    padding: 2px 6px;
                    border-radius: 6px;
                  ">Онлайн</span>
                ` : '')}
              </div>

              <div style="font-size: 13px; color: rgba(255, 255, 255, 0.85); display: flex; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; gap: 5px;">
                  <img src="${browserIcon}" style="width: 15px; height: 15px; object-fit: contain; vertical-align: middle;" alt="${Utils.escapeHtml(browserName)}">
                  <span>${Utils.escapeHtml(browserName)}</span>
                </span>
                <span style="opacity: 0.3;">•</span>
                <span style="display: inline-flex; align-items: center; gap: 5px; color: #ffd700; font-weight: 600;">
                  <img src="${flagUrl}" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle;" alt="Flag">
                  <span>${Utils.escapeHtml(countryName)}</span>
                </span>
              </div>

              <div style="font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
                <div><strong>Вход в аккаунт:</strong> ${this.formatDate(sess.loginAt)}</div>
                <div><strong>Заход на сайт:</strong> ${this.formatRelative(sess.lastActiveAt)} (${this.formatDate(sess.lastActiveAt)})</div>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-end;">
            ${!isCurrent ? `
              <button type="button" class="danger-btn" onclick="SessionManager.terminateSession('${uid}', '${sess.sessionId}')" style="
                padding: 7px 14px;
                font-size: 12px;
                font-weight: 700;
                border-radius: 10px;
                width: auto;
                display: inline-flex;
                align-items: center;
                gap: 6px;
              ">
                <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width: 12px; height: 12px; object-fit: contain;">
                Завершить
              </button>
            ` : `
              <span style="font-size: 12px; color: rgba(255, 255, 255, 0.4); font-style: italic;">Это устройство</span>
            `}
          </div>
        </div>
      `;
    });

    if (otherSessionsCount > 0) {
      html += `
        <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
          <button type="button" class="secondary-btn" onclick="SessionManager.terminateAllOtherSessions('${uid}')" style="
            width: auto;
            padding: 9px 18px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 12px;
            color: #ff6b6b;
            border-color: rgba(255, 107, 107, 0.3);
            background: rgba(255, 107, 107, 0.08);
            display: inline-flex;
            align-items: center;
            gap: 8px;
          ">
            <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width: 14px; height: 14px; object-fit: contain;">
            Завершить все другие сессии (${otherSessionsCount})
          </button>
        </div>
      `;
    }

    html += `</div>`;
    containerEl.innerHTML = html;
  }

  static refreshSessionsUI() {
    const container = document.getElementById("settings-sessions-list-container");
    if (container) {
      this.renderSessionsContainer(container);
    }
  }
}

if (typeof window !== "undefined") {
  window.SessionManager = SessionManager;
}

export default SessionManager;
export { SessionManager };
