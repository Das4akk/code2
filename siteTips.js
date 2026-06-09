/**
 * Подсказки COWIO: компактные фишки в стиле Telegram / Discord / YouTube
 */
class SiteTipsManager {
  static STORAGE_KEY = "cowio_dismissed_tips";

  static TIPS = [
    { id: "rooms-watchparty", target: "#section-rooms", screen: "lobby-screen", text: "Создайте комнату и скиньте ссылку друзьям. Это наш аналог Watch Party из YouTube." },
    { id: "rooms-search", target: "#section-rooms", screen: "lobby-screen", text: "Поиск сверху ищет комнаты по названию, как глобальный поиск каналов в Discord." },
    { id: "rooms-theme", target: "#section-rooms", screen: "lobby-screen", text: "Перед созданием комнаты можно выбрать тему оформления. Попробуйте разные варианты." },
    { id: "friends-invite", target: "#section-friends", screen: "lobby-screen", text: "Добавьте друзей, и потом можно пригласить их в комнату одной кнопкой." },
    { id: "friends-requests", target: "#section-friends", screen: "lobby-screen", text: "Заявки в друзья живут во вкладке «Друзья». Не пропустите новые." },
    { id: "find-id", target: "#section-find-friend", screen: "lobby-screen", text: "Ищите людей по @ID. Это работает так же, как username в Telegram или Discord." },
    { id: "support-ticket", target: "#section-support", screen: "lobby-screen", text: "Опишите проблему чётко и приложите скрин. Так мы ответим быстрее, чем в обычном чате." },
    { id: "support-priority", target: "#section-support", screen: "lobby-screen", text: "Приоритет «срочно» ставьте только если сайт реально не даёт пользоваться." },
    { id: "settings-particles", target: "#section-settings", screen: "lobby-screen", text: "Фон-нейросеть можно отключить или приглушить в настройках, если отвлекает." },
    { id: "settings-emojis", target: "#section-settings", screen: "lobby-screen", text: "На слабом телефоне включите статичные эмодзи. Страница станет легче." },
    { id: "settings-theme", target: "#section-settings", screen: "lobby-screen", text: "Тёмная тема удобнее для ночных кино-сессий. Переключатель в лобби или здесь." },
    { id: "profile-bio", target: "#section-profile", screen: "lobby-screen", text: "Заполните био и аватар. Так проще найти людей с похожими интересами." },
    { id: "profile-xp", target: "#section-profile", screen: "lobby-screen", text: "XP капает за активность: смотрите, общайтесь, и уровень в профиле растёт сам." },
    { id: "catalog-frames", target: "#section-catalog", screen: "lobby-screen", text: "Рамки из Базара видны в чате и профиле, как Nitro-украшения в Discord." },
    { id: "auth-google", target: "#auth-screen", screen: "auth-screen", text: "Можно войти через Google. Пароль запоминать необязательно." },
    { id: "auth-id", target: "#auth-screen", screen: "auth-screen", text: "@ID это ваш постоянный ник. Выбирайте сразу нормальный, как tag в Discord." },
    { id: "auth-code", target: "#auth-screen", screen: "auth-screen", text: "Код с почты приходит за минуту. Не видите? Загляните в «Спам»." },
    { id: "room-easter", target: ".chat-section", screen: "room-screen", text: "В чате комнаты работают команды /moo, /matrix, /popcorn. Попробуйте на всю комнату." },
    { id: "room-users", target: ".chat-section", screen: "room-screen", text: "Вкладка «Люди» показывает, кто сейчас в комнате, как список участников в Discord." },
    { id: "room-soundpad", target: "#tab-soundpad-btn", screen: "room-screen", text: "Soundpad: быстрые звуки для атмосферы, как на Twitch-стриме." },
    { id: "room-mic", target: "#mic-btn", screen: "room-screen", text: "Голосовой чат через микрофон. Наушники сильно уменьшают эхо, как в Discord." },
    { id: "room-sync", target: ".player-section", screen: "room-screen", text: "Видео синхронное: пауза и перемотка видны всем, как в Teleparty." },
    { id: "room-reactions", target: "#chat-input-container", screen: "room-screen", text: "На сообщения можно ставить реакции. Нажмите эмодзи под текстом." },
    { id: "room-fullscreen", target: ".video-container", screen: "room-screen", text: "Полноэкранный режим: кнопка в углу плеера, как на YouTube." },
    { id: "room-attach", target: "#btn-room-attach", screen: "room-screen", text: "Скрепка слева от чата отправляет картинку в комнату." },
    { id: "room-dm", target: "#users-list", screen: "room-screen", text: "Из списка людей можно открыть профиль и написать в личку." },
    { id: "help-fab", target: "#lobby-screen .lobby-layout", screen: "lobby-screen", text: "Справочник с ответами всегда в правом нижнем углу, как FAQ в Telegram." },
    { id: "mobile-menu", target: ".mobile-header", screen: "lobby-screen", text: "На телефоне все разделы в меню слева сверху. Свайп от края тоже открывает." },
    { id: "footer-suggest", target: "#bottom-footer-links", screen: "lobby-screen", text: "Есть идея? Ссылка «Предложка» внизу, как feedback-сервер в Discord." },
    { id: "switch-account", target: "#section-switch-account", screen: "lobby-screen", text: "Несколько аккаунтов? Переключайтесь здесь без выхода из браузера." },
  ];

  static init() {
    this.injectStyles();
    this.renderAll();
    this.hookScreenSwitch();
    document.querySelectorAll("#main-sidebar .nav-item").forEach((item) => {
      item.addEventListener("click", () => setTimeout(() => this.renderAll(), 120));
    });
    window.addEventListener("resize", () => this.renderAll());
  }

  static hookScreenSwitch() {
    if (!window.Utils?.showScreen || Utils.showScreen.__tipsHooked) return;
    const original = Utils.showScreen.bind(Utils);
    Utils.showScreen = (screenId) => {
      original(screenId);
      setTimeout(() => this.renderAll(), 150);
    };
    Utils.showScreen.__tipsHooked = true;
  }

  static injectStyles() {
    if (document.getElementById("cowio-tips-styles")) return;
    const style = document.createElement("style");
    style.id = "cowio-tips-styles";
    style.textContent = `
      .cowio-tip-bar {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        margin: 0 0 14px;
        border-radius: 12px;
        border: 1px solid var(--border-light);
        background: rgba(255,255,255,0.04);
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-muted);
        animation: cowioTipIn 0.35s ease;
      }
      .cowio-tip-bar strong {
        color: var(--text-main);
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        display: block;
        margin-bottom: 2px;
      }
      .cowio-tip-bar img.cowio-tip-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .cowio-tip-text { flex: 1; min-width: 0; }
      .cowio-tip-dismiss {
        flex-shrink: 0;
        border: none;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 6px;
        opacity: 0.7;
        transition: opacity 0.15s;
      }
      .cowio-tip-dismiss:hover { opacity: 1; }
      @keyframes cowioTipIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .theme-light-global .cowio-tip-bar,
      body.theme-light-global .cowio-tip-bar {
        background: rgba(0,0,0,0.03);
        border-color: rgba(0,0,0,0.12);
      }
      #bottom-footer-links .cowio-tip-bar {
        margin-bottom: 8px;
        width: 100%;
      }
      .chat-section .cowio-tip-bar,
      .player-section .cowio-tip-bar {
        margin: 8px 10px 0;
      }
      .mobile-header .cowio-tip-bar {
        margin: 8px 12px 0;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  static getDismissed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }

  static dismiss(id) {
    const set = this.getDismissed();
    set.add(id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...set]));
    document.querySelectorAll(`.cowio-tip-bar[data-tip-id="${id}"]`).forEach((el) => el.remove());
  }

  static isSectionVisible(container) {
    if (!container) return false;
    const style = window.getComputedStyle(container);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (container.closest(".screen:not(.active)")) return false;
    return true;
  }

  static renderAll() {
    document.querySelectorAll(".cowio-tip-bar").forEach((el) => el.remove());
    const dismissed = this.getDismissed();
    const activeScreen = document.querySelector(".screen.active")?.id;

    this.TIPS.forEach((tip) => {
      if (dismissed.has(tip.id)) return;
      if (tip.screen && activeScreen !== tip.screen) return;

      const container = document.querySelector(tip.target);
      if (!container || !this.isSectionVisible(container)) return;
      if (container.querySelector(`.cowio-tip-bar[data-tip-id="${tip.id}"]`)) return;

      const bar = document.createElement("div");
      bar.className = "cowio-tip-bar";
      bar.dataset.tipId = tip.id;
      bar.innerHTML = `
        <img class="cowio-tip-icon" src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp" alt="">
        <div class="cowio-tip-text">
          <strong>Фишка</strong>
          ${tip.text}
        </div>
        <button type="button" class="cowio-tip-dismiss" title="Понятно">✕</button>
      `;
      bar.querySelector(".cowio-tip-dismiss").onclick = () => this.dismiss(tip.id);
      container.insertBefore(bar, container.firstChild);
    });
  }
}

window.SiteTipsManager = SiteTipsManager;
