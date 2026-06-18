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
        id: "site-settings-static-emojis",
        type: "toggle",
        title: "Статичные эмодзи",
        desc: "Снижает нагрузку на ПК",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Telephone.webp",
        default: false,
        onChange: (val) => {
          localStorage.setItem("staticEmojis", val);
          const imgs = document.querySelectorAll(
            'img[src*="Telegram-Animated-Emojis"]',
          );
          if (val) imgs.forEach(applyStaticEmoji);
          else imgs.forEach(revertStaticEmoji);
        },
      },
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
