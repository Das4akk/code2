
const SettingSections = [
  {
    title: "Внешний вид и лобби",
    icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp",
    items: [
      {
        id: "site-settings-theme",
        type: "toggle",
        title: "Светлая тема (Лобби)",
        desc: "Альтернативное светлое оформление интерфейса",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Sun.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("cowio:globalTheme", val ? "light" : "dark");
          document.documentElement.dataset.globalTheme = val ? "light" : "dark";
          document.documentElement.classList.toggle("theme-light-global", val);
        },
      },
      {
        id: "site-settings-particle",
        type: "toggle",
        title: "Анимации частиц",
        desc: "Интерактивный летающий фон",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkler.webp",
        default: true,
        onChange: (val) => {
          localStorage.setItem("siteParticles", val ? "true" : "false");
          const canvas = document.getElementById("particle-canvas");
          if (canvas)
            canvas.style.setProperty(
              "display",
              val ? "block" : "none",
              "important",
            );
        },
      },
      {
        id: "site-settings-particle-brightness",
        type: "slider",
        title: "Яркость частиц",
        desc: "Видимость фона",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp",
        default: 1,
        onChange: (val) => {
          localStorage.setItem("siteParticleBrightness", val);
          const canvas = document.getElementById("particle-canvas");
          if (canvas) canvas.style.setProperty("opacity", val);
        },
      },
      {
        id: "site-settings-neuro",
        type: "toggle",
        title: "Черный фон",
        desc: "Премиальное темное оформление (neuro-bg)",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp",
        default: true,
        onChange: (val) => {
          localStorage.setItem("siteNeuro", val ? "true" : "false");
          const bg = document.getElementById("premium-black-bg");
          if (bg)
            bg.style.setProperty(
              "display",
              val ? "block" : "none",
              "important",
            );
        },
      },
      {
        id: "site-set-hide-counter",
        type: "toggle",
        title: "Скрывать онлайн",
        desc: "Прячет счетчик онлайна в правом нижнем углу лобби",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Eyes.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("hideOnlineCounter", val);
          const counter = document.querySelector(".online-counter-badge");
          if (counter) counter.style.display = val ? "none" : "flex";
        },
      },
      {
        id: "site-set-hide-recent",
        type: "toggle",
        title: "Скрывать недавние комнаты",
        desc: "Очищает интерфейс от списка ваших комнат",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Sponge.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("hideRecentRooms", val);
          document.body.classList.toggle("hide-recent-rooms", val);
        },
      },
      {
        id: "site-set-monochrome",
        type: "toggle",
        title: "Черно-белый интерфейс",
        desc: "Абсолютно 0 насыщенности",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Full%20Moon.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("siteMonochrome", val);
          document.documentElement.style.filter = val ? "grayscale(1)" : "";
        },
      },

    ],
  },
  {
    title: "Оптимизация и чат",
    icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Keyboard.webp",
    items: [
      {
        id: "site-set-dyslexia",
        type: "toggle",
        title: "Шрифт для дислексиков",
        desc: "Включает monospace шрифт по всей системе",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Abacus.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("siteDyslexia", val);
          document.body.style.fontFamily = val ? "monospace" : "";
        },
      },
      {
        id: "site-set-disable-transitions",
        type: "toggle",
        title: "Отключить анимации окон",
        desc: "Делает интерфейс резким",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/High%20Speed%20Train.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("disableTransitions", val);
          document.body.classList.toggle("disable-transitions", val);
        },
      },
      {
        id: "site-set-use-proxy",
        type: "toggle",
        title: "Включить прокси (Обход)",
        desc: "Проксирует запрос ютуб видео для обхода блокировок",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Satellite%20Antenna.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("useGlobalProxy", val);
          if (window.AppState) window.AppState.useProxy = val;
        },
      },
      {
        id: "site-set-round-avatars",
        type: "toggle",
        title: "Круглые аватарки",
        desc: "Сделать все аватары полностью круглыми",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/New%20Moon.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("siteRoundAvars", val);
          document.body.classList.toggle("round-avatars", val);
        },
      },
      {
        id: "site-set-compact-chat",
        type: "toggle",
        title: "Компактный чат",
        desc: "Уменьшает отступы в сообщениях чата комнаты",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Microscope.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("compactChat", val);
          document.body.classList.toggle("compact-chat", val);
        },
      },
      {
        id: "site-set-hide-chat-time",
        type: "toggle",
        title: "Скрыть время сообщений",
        desc: "Скрывает блок времени в чате",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Hourglass%20Not%20Done.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("hideChatTime", val);
          document.body.classList.toggle("hide-chat-time", val);
        },
      },
    ],
  },
];

function initSettingsRenderer() {
  const container = document.getElementById("settings-dynamic-container");
  if (!container) return;

  let html = "";
  SettingSections.forEach((section) => {
    html += `
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 18px; margin-bottom: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          <img src="${section.icon}" style="width: 24px;"> ${section.title}
        </h3>
        <div style="background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px solid var(--border-light); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    `;

    section.items.forEach((item) => {
      let saved =
        localStorage.getItem(item.id) ||
        localStorage.getItem(item.id.replace("site-settings-", "site")); // backward compatibility
      if (item.id === "site-settings-theme")
        saved =
          localStorage.getItem("cowio:globalTheme") === "light"
            ? "true"
            : "false";
      if (item.id === "site-settings-particle")
        saved = localStorage.getItem("siteParticles") || "true";
      if (item.id === "site-settings-particle-brightness")
        saved = localStorage.getItem("siteParticleBrightness") || "1";
      if (item.id === "site-settings-neuro")
        saved = localStorage.getItem("siteNeuro") || "true";
      if (item.id === "site-settings-static-emojis")
        saved = localStorage.getItem("staticEmojis") || "false";
      if (item.id === "site-set-use-proxy")
        saved = localStorage.getItem("useGlobalProxy") || "false";


      if (saved === null) saved = item.default;
      else if (item.type !== "slider") saved = saved === "true";
      else if (item.type === "slider") saved = Number(saved);

      // Setup initialization for CSS rules
      try {
        if (saved && item.type !== "slider") item.onChange(true);
        if (item.type === "slider") item.onChange(saved);
      } catch (e) {
        console.warn("Setting init err", e);
      }

      if (item.type === "toggle") {
        html += `
          <label style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; align-items: center; gap: 12px;">
               <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                 <img src="${item.icon}" style="width: 24px;">
               </div>
               <div>
                 <div style="font-weight: 700; font-size: 15px;">${item.title}</div>
                 <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.desc}</div>
               </div>
            </div>
            <div class="st-switch">
               <input type="checkbox" id="${item.id}" ${saved ? "checked" : ""}>
               <span class="st-slider"></span>
            </div>
          </label>
        `;
      } else if (item.type === "slider") {
        const min = item.min !== undefined ? item.min : 0;
        const max = item.max !== undefined ? item.max : 1;
        const step = item.step !== undefined ? item.step : 0.05;
        const labelFn = item.labelFn || ((v) => Math.round(v * 100) + "%");

        html += `
          <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
             <div style="display: flex; align-items: center; gap: 12px;">
               <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                 <img src="${item.icon}" style="width: 24px;">
               </div>
               <div>
                 <div style="font-weight: 700; font-size: 15px;">${item.title}</div>
                 <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.desc}: <span id="${item.id}-val">${labelFn(saved)}</span></div>
               </div>
             </div>
             <input type="range" id="${item.id}" min="${min}" max="${max}" step="${step}" value="${saved}" style="width: 100px; accent-color: #fff; cursor: pointer;">
          </div>
        `;
      }
    });

    html += `</div></div>`;
  });

  // Account Security
  html += `
   <div style="margin-bottom: 20px;">
      <h3 style="font-size: 18px; margin-bottom: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Key.webp" style="width: 24px;"> Аккаунт и Безопасность
      </h3>
      <div class="settings-security-card" id="security-email-card" style="background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px solid var(--border-light); margin-bottom: 12px; overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="padding: 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="document.getElementById('security-email-form').style.display = document.getElementById('security-email-form').style.display === 'none' ? 'block' : 'none';">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: rgba(255,143,198,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Incoming%20Envelope.webp" style="width: 24px;">
            </div>
            <div>
              <div style="font-weight: 700; font-size: 15px;">Сменить адрес почты</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Требует подтверждение текущего пароля</div>
            </div>
          </div>
        </div>
        
        <div id="security-email-form" style="display: none; padding: 0 20px 20px 20px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 5px; padding-top: 20px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size: 12px; color: var(--text-muted); margin-bottom: -5px;">Текущий пароль для подтверждения личности</label>
            <input type="password" id="settings-email-old-password" placeholder="Введите ваш текущий пароль" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff;" />
            <label style="font-size: 12px; color: var(--text-muted); margin-top: 5px; margin-bottom: -5px;">Новый адрес электронной почты</label>
            <input type="email" id="settings-new-email" placeholder="new@example.com" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff;" />
            <button class="primary-btn" id="btn-settings-change-email" style="font-size: 14px; padding: 12px; border-radius: 10px; margin-top: 10px;">Продолжить <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Rightwards%20Hand.webp" style="width:16px;height:16px;vertical-align:text-bottom;"></button>
          </div>
        </div>
      </div>

      <div class="settings-security-card" id="security-password-card" style="background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px solid var(--border-light); overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="padding: 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="document.getElementById('security-password-form').style.display = document.getElementById('security-password-form').style.display === 'none' ? 'block' : 'none';">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: rgba(255,143,198,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Key.webp" style="width: 24px;">
            </div>
            <div>
              <div style="font-weight: 700; font-size: 15px;">Сменить пароль</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Задайте новый, более надежный пароль</div>
            </div>
          </div>
        </div>
        
        <div id="security-password-form" style="display: none; padding: 0 20px 20px 20px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 5px; padding-top: 20px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size: 12px; color: var(--text-muted); margin-bottom: -5px;">Текущий пароль</label>
            <input type="password" id="settings-password-old" placeholder="Введите текущий пароль" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff;" />
            <label style="font-size: 12px; color: var(--text-muted); margin-top: 5px; margin-bottom: -5px;">Новый пароль (минимум 6 символов)</label>
            <input type="password" id="settings-new-password" placeholder="Введите новый пароль" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff;" />
            <label style="font-size: 12px; color: var(--text-muted); margin-top: 5px; margin-bottom: -5px;">Подтверждение нового пароля</label>
            <input type="password" id="settings-new-password-confirm" placeholder="Повторите новый пароль" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff;" />
            <button class="primary-btn" id="btn-settings-change-password" style="font-size: 14px; padding: 12px; border-radius: 10px; margin-top: 10px;">Продолжить <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Rightwards%20Hand.webp" style="width:16px;height:16px;vertical-align:text-bottom;"></button>
          </div>
        </div>
      </div>
   </div>
  `;

  container.innerHTML = html;

  // Add event listeners
  SettingSections.forEach((s) => {
    s.items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) {
        if (item.type === "toggle") {
          el.addEventListener("change", (e) => {
            item.onChange(e.target.checked);
          });
        } else if (item.type === "slider") {
          el.addEventListener("input", (e) => {
            const labelFn = item.labelFn || ((v) => Math.round(v * 100) + "%");
            document.getElementById(item.id + "-val").innerText = labelFn(
              e.target.value,
            );
            item.onChange(e.target.value);
          });
        }
      }
    });
  });
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsRenderer);
  } else {
    initSettingsRenderer();
  }
} catch (e) {
  console.error(e);
}


class GlobalThemeManager {
  // [NEW]
  static storageKey = "cowio:globalTheme"; // [NEW]

  static normalizeTheme(theme = "dark") {
    // [NEW]
    return theme === "light" ? "light" : "dark"; // [NEW]
  } // [NEW]

  static getStoredTheme() {
    // [NEW]
    return this.normalizeTheme(
      localStorage.getItem(this.storageKey) ||
        document.documentElement.dataset.globalTheme ||
        "dark",
    ); // [NEW]
  } // [NEW]

  static applyTheme(theme = "dark", persist = true) {
    // [NEW]
    const normalized = this.normalizeTheme(theme); // [NEW]
    AppState.globalTheme = normalized; // [NEW]
    document.documentElement.dataset.globalTheme = normalized; // [NEW]
    document.documentElement.classList.toggle(
      "theme-light-global",
      normalized === "light",
    ); // [NEW]
    document.body?.classList.toggle(
      "theme-light-global",
      normalized === "light",
    ); // [NEW]
    const toggle = Utils.$("global-theme-toggle"); // [NEW]
    if (toggle) toggle.checked = normalized === "light"; // [NEW]
    if (persist) localStorage.setItem(this.storageKey, normalized); // [NEW]
  } // [NEW]

  static init() {
    // [NEW]
    this.applyTheme(this.getStoredTheme(), false); // [NEW]
    const toggle = Utils.$("global-theme-toggle"); // [NEW]
    if (!toggle) return; // [NEW]
    toggle.onchange = () =>
      this.applyTheme(toggle.checked ? "light" : "dark", true); // [NEW]
  } // [NEW]
} // [NEW]


class ThemeManager {
  static FAVORITES_KEY = "cowio:favoriteThemes";

  static FOLDERS = {
    favorites: {
      label:
        '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Любимые',
      themes: [],
    },
    classic: { label: "Классика", themes: ["default", "light", "inverted"] },
    nature: { label: "Природа", themes: ["sunset", "ocean", "aurora", "love"] },
    gradient: {
      label: "Градиенты",
      themes: [
        "matte-toxic",
        "audi-silver",
        "racing-jet",
        "alpine-pink",
        "solar-flare",
        "neon-tide",
        "dusk",
        "venom",
        "twilight",
        "noir-rose",
        "vault-gold",
        "abyss-frost",
        "crimson-chalk",
      ],
    },
  };

  static THEME_LABELS = {
    "matte-toxic": "matte toxic",
    "audi-silver": "audi silver",
    "racing-jet": "racing jet",
    "alpine-pink": "alpine pink",
    "solar-flare": "solar flare",
    "neon-tide": "neon tide",
    "noir-rose": "noir rose",
    "vault-gold": "vault gold",
    "abyss-frost": "abyss frost",
    "crimson-chalk": "crimson chalk",
  };

  static EXTENDED_THEMES = {
    default: { bg: ["#0d0d10", "#040404"], accent: "#ffffff", symbol: "·" },
    light: { bg: ["#ffffff", "#e8ebf1"], accent: "#000000", symbol: "☼" },
    inverted: { bg: ["#f8f8f8", "#d9dce2"], accent: "#050505", symbol: "◐" },
    sunset: {
      bg: ["#ff9a76", "#7b2233", "#240b15"],
      accent: "#ff9a76",
      symbol: "☼",
    },
    ocean: {
      bg: ["#6de0ff", "#13667a", "#082835"],
      accent: "#6de0ff",
      symbol: "≈",
    },
    aurora: {
      bg: ["#4776ff", "#1a2f68", "#0a1023"],
      accent: "#4776ff",
      symbol: "✦",
    },
    love: {
      bg: ["#66304f", "#301226", "#10050d"],
      accent: "#ff99cc",
      symbol: "❤",
    },
    "matte-toxic": {
      bg: ["#141414", "#0a1208"],
      accent: "#7fff00",
      symbol: "☣",
    },
    "audi-silver": {
      bg: ["#eceff3", "#9aa3ad", "#2b3138"],
      accent: "#d1d6dc",
      symbol: "◆",
    },
    "racing-jet": {
      bg: ["#08080a", "#151c28", "#4a0a0a"],
      accent: "#e10600",
      symbol: "🏁",
    },
    "alpine-pink": {
      bg: ["#a8d4f0", "#5b8fc9", "#3f5f48"],
      accent: "#f4b8c8",
      symbol: "⛰",
    },
    "solar-flare": {
      bg: ["#ff6a00", "#ffb300", "#fff4d6"],
      accent: "#ff8c00",
      symbol: "☀",
    },
    "neon-tide": {
      bg: ["#031a2b", "#0a4d6e", "#00e8ff"],
      accent: "#00e8ff",
      symbol: "🌊",
    },
    dusk: {
      bg: ["#2a1842", "#5a3f6e", "#e8785a"],
      accent: "#ffb07c",
      symbol: "🌆",
    },
    venom: { bg: ["#040804", "#0f1a10"], accent: "#39ff14", symbol: "🕷" },
    twilight: {
      bg: ["#1a103c", "#4a3f7a", "#98f5d4"],
      accent: "#c4b5fd",
      symbol: "☾",
    },
    "noir-rose": {
      bg: ["#0a0a0a", "#1c1c1c", "#3a1a28"],
      accent: "#e8748a",
      symbol: "🌹",
    },
    "vault-gold": {
      bg: ["#1b3a5c", "#0f2236", "#0a1520"],
      accent: "#ffd54f",
      symbol: "⛃",
    },
    "abyss-frost": {
      bg: ["#010814", "#0a2a4a", "#7dd3fc"],
      accent: "#bae6fd",
      symbol: "❄",
    },
    "crimson-chalk": {
      bg: ["#8b0000", "#3d1212", "#f5f0e8"],
      accent: "#fff5f0",
      symbol: "♦",
    },
  };

  static getFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.FAVORITES_KEY) || "[]");
      return Array.isArray(raw)
        ? raw.filter((k) => this.EXTENDED_THEMES[k])
        : [];
    } catch {
      return [];
    }
  }

  static isFavorite(themeKey) {
    return this.getFavorites().includes(themeKey);
  }

  static toggleFavorite(themeKey) {
    if (!this.EXTENDED_THEMES[themeKey]) return;
    let favs = this.getFavorites();
    favs = favs.includes(themeKey)
      ? favs.filter((k) => k !== themeKey)
      : [...favs, themeKey];
    localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favs));
    this.refreshFavoritesFolder();
    if (RoomManager.currentThemeFolder === "favorites")
      this.renderCarouselTrack("favorites");
    this.syncFavButtons();
    Utils.toast(
      favs.includes(themeKey) ? "Тема в любимых" : "Убрано из любимых",
    );
  }

  static refreshFavoritesFolder() {
    this.FOLDERS.favorites.themes = this.getFavorites();
  }

  static getThemeLabel(themeKey) {
    return this.THEME_LABELS[themeKey] || themeKey;
  }

  static init() {
    this.refreshFavoritesFolder();
    this.injectCSS();
    this.renderFolders();
    this.renderCarousel();
    this.renderDMChips();
  }

  static buildThemeGradient(colors = [], preview = false) {
    const bg = colors.length ? colors : ["#0d0d10", "#040404"];
    if (bg.length === 1) return bg[0];
    if (preview)
      return `linear-gradient(165deg, ${bg[0]} 0%, ${bg[bg.length - 1]} 100%)`;
    const stops = bg
      .map((c, i) => `${c} ${Math.round((i / (bg.length - 1)) * 100)}%`)
      .join(", ");
    return `radial-gradient(ellipse 130% 95% at 18% 8%, ${stops})`;
  }

  static injectCSS() {
    let css = "";
    for (const [key, t] of Object.entries(this.EXTENDED_THEMES)) {
      if (
        [
          "default",
          "light",
          "inverted",
          "sunset",
          "ocean",
          "aurora",
          "love",
        ].includes(key)
      )
        continue;
      const gradPreview = this.buildThemeGradient(t.bg, true);
      const gradRoom = this.buildThemeGradient(t.bg, false);

      css += `
                #room-screen.theme-${key} { background: ${gradRoom}; color: #ffffff; }
                #room-screen.theme-${key} .glass-panel,
                #room-screen.theme-${key} .chat-section,
                #room-screen.theme-${key} .chat-input-area { background: rgba(10, 10, 15, 0.85); border-color: ${t.accent}40; box-shadow: 0 16px 40px ${t.accent}20; }
                #room-screen.theme-${key} .input-wrapper { background: rgba(5, 5, 10, 0.9); border-color: ${t.accent}60; }
                #room-screen.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05); border-color: ${t.accent}40; color: #fff; }
                #room-screen.theme-${key} .self .bubble { background: ${t.accent}20; border-color: ${t.accent}60; color: #fff; }
                #room-screen.theme-${key} .send-btn,
                #room-screen.theme-${key} #btn-share-room,
                #room-screen.theme-${key} #btn-room-settings,
                #room-screen.theme-${key} #btn-leave-room { background: ${t.accent}30; color: #fff; border-color: ${t.accent}60; }
                
                #modal-dm-chat.theme-${key} .modal-content { background: ${gradRoom} !important; border-color: ${t.accent}40 !important; box-shadow: 0 16px 40px ${t.accent}20 !important; color: #ffffff !important; }
                #modal-dm-chat.theme-${key} .dm-messages,
                #modal-dm-chat.theme-${key} .dm-compose { background: rgba(10,10,15,0.7) !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} .bubble { background: rgba(255, 255, 255, 0.05) !important; border-color: ${t.accent}40 !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} .self .bubble { background: ${t.accent}20 !important; border-color: ${t.accent}60 !important; color: #fff !important; }
                #modal-dm-chat.theme-${key} input { color: #fff !important; }
                
                .theme-rect.${key}::before { content: ''; position: absolute; inset: 0; background: ${gradPreview}; }
                .theme-rect.${key}::after { content: '${t.symbol}'; position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); color: ${t.accent}; letter-spacing: 4px; font-size: 14px; opacity: 0.8; }
            `;
    }
    const style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  static renderFolders() {
    const foldersContainer = Utils.$("room-theme-folders");
    if (!foldersContainer) return;
    foldersContainer.innerHTML = "";
    const fKeys = Object.keys(this.FOLDERS);
    fKeys.forEach((fKey, index) => {
      const btn = document.createElement("button");
      btn.className = `secondary-btn theme-folder-btn ${index === 0 ? "active" : ""}`;
      btn.dataset.folder = fKey;
      btn.innerHTML = this.FOLDERS[fKey].label;
      btn.style.padding = "6px 12px";
      btn.style.fontSize = "12px";
      btn.onclick = () => {
        foldersContainer
          .querySelectorAll(".theme-folder-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        RoomManager.currentThemeFolder = fKey;
        this.renderCarouselTrack(fKey);
      };
      foldersContainer.appendChild(btn);
    });
    RoomManager.currentThemeFolder = fKeys.includes("favorites")
      ? "favorites"
      : fKeys[0];
  }

  static renderCarousel() {
    if (!RoomManager.currentThemeFolder)
      RoomManager.currentThemeFolder = Object.keys(this.FOLDERS)[0];
    this.renderCarouselTrack(RoomManager.currentThemeFolder);
  }

  static renderCarouselTrack(fKey) {
    const track = Utils.$("room-theme-track");
    if (!track) return;
    track.innerHTML = "";
    const themesList = this.FOLDERS[fKey]?.themes || [];

    if (fKey === "favorites" && !themesList.length) {
      track.innerHTML = `
                <div class="theme-card theme-card-empty">
                    <div class="theme-empty-msg">Нажмите ★ на любой теме,<br>чтобы добавить в любимые</div>
                </div>
            `;
      RoomManager.themeIndex = 0;
      RoomManager.updateThemeTransform();
      return;
    }

    themesList.forEach((themeKey) => {
      const t = this.EXTENDED_THEMES[themeKey];
      if (!t) return;
      const isFav = this.isFavorite(themeKey);
      const div = document.createElement("div");
      div.className = `theme-card ${RoomManager.selectedTheme === themeKey ? "active" : ""}`;
      div.dataset.theme = themeKey;
      div.innerHTML = `
                <button type="button" class="theme-fav-btn ${isFav ? "active" : ""}" data-theme="${themeKey}" title="${isFav ? "Убрать из любимых" : "В любимые"}">★</button>
                <div class="theme-rect ${themeKey}"></div>
                <div class="theme-name">${this.getThemeLabel(themeKey)}</div>
                <div class="theme-check">✓</div>
            `;
      track.appendChild(div);
    });
    this.bindCarouselFavButtons();
    const idx = themesList.indexOf(RoomManager.selectedTheme);
    if (idx >= 0) RoomManager.themeIndex = idx;
    else
      RoomManager.themeIndex = Math.min(
        RoomManager.themeIndex,
        Math.max(0, themesList.length - 1),
      );
    RoomManager.updateThemeTransform();
  }

  static bindCarouselFavButtons() {
    const track = Utils.$("room-theme-track");
    if (!track) return;
    track.querySelectorAll(".theme-fav-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.toggleFavorite(btn.dataset.theme);
      };
    });
  }

  static syncFavButtons() {
    const track = Utils.$("room-theme-track");
    if (!track) return;
    track.querySelectorAll(".theme-fav-btn").forEach((btn) => {
      const active = this.isFavorite(btn.dataset.theme);
      btn.classList.toggle("active", active);
      btn.title = active ? "Убрать из любимых" : "В любимые";
    });
  }

  static findFolderForTheme(themeKey) {
    if (this.getFavorites().includes(themeKey)) return "favorites";
    for (const [fKey, folder] of Object.entries(this.FOLDERS)) {
      if (fKey === "favorites") continue;
      if (folder.themes.includes(themeKey)) return fKey;
    }
    return "classic";
  }

  static renderDMChips() {
    const dmControls = Utils.$("dm-theme-controls");
    if (!dmControls) return;
    dmControls.innerHTML = "";
    const uid = AppState?.currentUser?.uid;
    const profile = uid ? AppState.usersCache.get(uid) : null;
    Object.keys(this.EXTENDED_THEMES).forEach((key) => {
      const locked =
        key !== "default" &&
        window.PremiumManager &&
        !PremiumManager.canUseTheme(key, profile, uid);
      const btn = document.createElement("button");
      btn.className = "dm-theme-chip" + (locked ? " dm-theme-locked" : "");
      btn.dataset.theme = key;
      btn.innerText = locked ? `${key} ★` : key;
      btn.title = locked ? "Только для Premium" : key;
      btn.disabled = locked;
      dmControls.appendChild(btn);
    });
  }
}

// ============================================================================
// LUMEN MANAGER (CURRENCY ENGINE, COUNTER ANIMATION, ROOM HUD & HISTORY)
// ============================================================================

window.SettingSections = SettingSections;
window.GlobalThemeManager = GlobalThemeManager;
window.ThemeManager = ThemeManager;
export { SettingSections, GlobalThemeManager, ThemeManager };
