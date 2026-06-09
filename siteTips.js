/**
 * Подсказки COWIO (фишки): всплывающие уведомления сверху справа
 */
class SiteTipsManager {
  static STORAGE_KEY = "cowio_dismissed_tips";
  static SHOW_MS = 5000;
  static RATE_LIMIT_MS = 4000;

  static queue = [];
  static isProcessing = false;
  static lastShownAt = 0;
  static activeTipId = null;
  static activeTimer = null;
  static shownThisSession = new Set();

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
    this.ensureContainer();
    this.hookScreenSwitch();
    document.querySelectorAll("#main-sidebar .nav-item").forEach((item) => {
      item.addEventListener("click", () => setTimeout(() => this.scheduleTips(), 200));
    });
    window.addEventListener("resize", () => this.scheduleTips());
    this.scheduleTips();
  }

  static ensureContainer() {
    if (document.getElementById("cowio-tips-container")) return;
    const el = document.createElement("div");
    el.id = "cowio-tips-container";
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }

  static hookScreenSwitch() {
    if (!window.Utils?.showScreen || Utils.showScreen.__tipsHooked) return;
    const original = Utils.showScreen.bind(Utils);
    Utils.showScreen = (screenId) => {
      original(screenId);
      setTimeout(() => this.scheduleTips(), 200);
    };
    Utils.showScreen.__tipsHooked = true;
  }

  static injectStyles() {
    if (document.getElementById("cowio-tips-styles")) return;
    const style = document.createElement("style");
    style.id = "cowio-tips-styles";
    style.textContent = `
      #cowio-tips-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999998;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        pointer-events: none;
        max-width: min(360px, calc(100vw - 24px));
      }
      .cowio-tip-toast {
        pointer-events: all;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--border-light);
        background: rgba(12, 12, 16, 0.94);
        backdrop-filter: blur(12px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-muted);
        animation: cowioTipSlideIn 0.35s ease;
      }
      .cowio-tip-toast strong {
        color: var(--text-main);
        font-weight: 800;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        display: block;
        margin-bottom: 3px;
      }
      .cowio-tip-toast img.cowio-tip-icon {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
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
      }
      .cowio-tip-dismiss:hover { opacity: 1; }
      @keyframes cowioTipSlideIn {
        from { opacity: 0; transform: translateX(16px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .theme-light-global .cowio-tip-toast,
      body.theme-light-global .cowio-tip-toast {
        background: rgba(255,255,255,0.96);
        border-color: rgba(0,0,0,0.1);
      }
      @media (max-width: 640px) {
        #cowio-tips-container {
          top: 12px;
          right: 12px;
          left: 12px;
          align-items: stretch;
        }
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
    this.shownThisSession.add(id);
    this.hideActive();
    this.queue = this.queue.filter((t) => t.id !== id);
    setTimeout(() => this.processQueue(), 100);
  }

  static isSectionVisible(container) {
    if (!container) return false;
    const style = window.getComputedStyle(container);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (container.closest(".screen:not(.active)")) return false;
    return true;
  }

  static scheduleTips() {
    document.querySelectorAll(".cowio-tip-bar").forEach((el) => el.remove());
    this.collectEligibleTips();
    this.processQueue();
  }

  static collectEligibleTips() {
    const dismissed = this.getDismissed();
    const activeScreen = document.querySelector(".screen.active")?.id;
    const topicsInQueue = new Set(this.queue.map((t) => t.id));

    this.TIPS.forEach((tip) => {
      if (dismissed.has(tip.id)) return;
      if (this.shownThisSession.has(tip.id)) return;
      if (tip.id === this.activeTipId) return;
      if (topicsInQueue.has(tip.id)) return;
      if (tip.screen && activeScreen !== tip.screen) return;

      const container = document.querySelector(tip.target);
      if (!container || !this.isSectionVisible(container)) return;

      this.queue.push(tip);
      topicsInQueue.add(tip.id);
    });
  }

  static async processQueue() {
    if (this.isProcessing || this.activeTipId) return;
    if (!this.queue.length) return;

    const now = Date.now();
    const waitMs = Math.max(0, this.RATE_LIMIT_MS - (now - this.lastShownAt));
    if (waitMs > 0) {
      this.isProcessing = true;
      setTimeout(() => {
        this.isProcessing = false;
        this.processQueue();
      }, waitMs);
      return;
    }

    const tip = this.queue.shift();
    if (!tip) return;

    this.showTip(tip);
  }

  static showTip(tip) {
    this.ensureContainer();
    const container = document.getElementById("cowio-tips-container");
    if (!container) return;

    this.hideActive();
    this.activeTipId = tip.id;
    this.lastShownAt = Date.now();

    const bar = document.createElement("div");
    bar.className = "cowio-tip-toast";
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
    container.appendChild(bar);

    this.activeTimer = setTimeout(() => {
      this.dismiss(tip.id);
    }, this.SHOW_MS);
  }

  static hideActive() {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.activeTipId) {
      document
        .querySelectorAll(`.cowio-tip-toast[data-tip-id="${this.activeTipId}"]`)
        .forEach((el) => el.remove());
      this.activeTipId = null;
    }
  }

  /** @deprecated используйте scheduleTips */
  static renderAll() {
    this.scheduleTips();
  }
}

window.SiteTipsManager = SiteTipsManager;
