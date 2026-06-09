/**
 * Справочник COWIO — FAQ и помощь (только лобби)
 */
class HelpGuideManager {
  static EXCLAMATION_IMG =
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Exclamation%20Mark.webp";

  static CREATOR_NOTE = `
    <div style="border:1px dashed var(--border-light); border-radius:14px; padding:16px; margin-top:20px; background:rgba(255,255,255,0.03);">
      <div style="font-weight:800; margin-bottom:8px;">Слово от создателя</div>
      <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
        <!-- Здесь вы можете написать что-то от себя: приветствие, новости, благодарность сообществу -->
        Добро пожаловать в COWIO! Мы стараемся сделать платформу удобной и безопасной.
        Если что-то не работает — не стесняйтесь писать в поддержку. Ваши отзывы помогают нам расти.
      </p>
    </div>
  `;

  static TOPICS = [
    {
      id: "start",
      title: "Начало работы",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/Rocket.webp",
      items: [
        { q: "Как зарегистрироваться?", a: "Нажмите «Регистрация», заполните имя, @ID, почту и пароль (от 6 символов), примите соглашение. После нажатия «Создать аккаунт» на почту придёт код — введите его для завершения регистрации." },
        { q: "Как войти в аккаунт?", a: "Вкладка «Вход» → email и пароль → «Войти в систему». Можно войти через Google." },
        { q: "Что такое @ID?", a: "Уникальный никнейм 3–15 символов: латиница, цифры и _. Отображается как @ваш_id. ID developer зарезервирован." },
        { q: "Код подтверждения не приходит", a: "Проверьте папку «Спам». Подождите до 2 минут. Нажмите «Отправить повторно» через 60 секунд. Убедитесь, что email введён без опечаток." },
        { q: "Ошибка API send-code / HTTP 405", a: "Это проблема сервера отправки писем. Попробуйте позже или напишите в поддержку — администраторы проверят SMTP на Vercel." },
      ],
    },
    {
      id: "auth",
      title: "Аккаунт и безопасность",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp",
      items: [
        { q: "Забыл пароль", a: "На экране входа → «Забыли пароль?» → введите почту → получите код → введите новый пароль (мин. 6 символов)." },
        { q: "Как сменить пароль?", a: "Настройки → Аккаунт и Безопасность → Смена пароля. Потребуется текущий пароль и код с почты." },
        { q: "Как сменить email?", a: "Настройки → введите текущий пароль и новую почту → подтвердите кодом на новый адрес." },
        { q: "Вышел из аккаунта сам", a: "Возможен вход с другого устройства или истечение сессии. Войдите снова. Проверьте, не меняли ли пароль." },
        { q: "Подозрительная активность", a: "Смените пароль, проверьте привязанную почту. Напишите в поддержку с описанием ситуации." },
      ],
    },
    {
      id: "rooms",
      title: "Комнаты и видео",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp",
      items: [
        { q: "Как создать комнату?", a: "В лобби нажмите «Создать комнату», укажите название, ссылку на видео (YouTube и др.), при необходимости — приватность и пароль." },
        { q: "Не могу войти в комнату", a: "Комната может быть приватной (нужен пароль), переполнена или удалена. Проверьте ссылку-приглашение." },
        { q: "Видео не воспроизводится", a: "Проверьте ссылку, интернет и блокировщики рекламы. Некоторые ролики ограничены регионом. Попробуйте другое видео." },
        { q: "Видео тормозит или зависает", a: "Снизьте качество источника, закройте лишние вкладки, проверьте скорость интернета. На мобильном — Wi‑Fi предпочтительнее." },
        { q: "Создание комнат заблокировано", a: "Администратор временно отключил создание. Дождитесь объявления или спросите в поддержке." },
        { q: "Как пригласить друзей в комнату?", a: "Скопируйте ID комнаты или ссылку из интерфейса комнаты. Отправьте другу в ЛС или внешним мессенджером." },
      ],
    },
    {
      id: "chat",
      title: "Чат и сообщения",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp",
      items: [
        { q: "Сообщения не отправляются", a: "Возможен глобальный lock чата, mute или shadowban. Проверьте интернет. Перезагрузите страницу." },
        { q: "Не вижу сообщения других", a: "Обновите страницу. Возможна задержка Firebase. Проверьте, не включён ли режим «Скрыть чат» в настройках." },
        { q: "Как писать в личные сообщения?", a: "Откройте профиль пользователя → «Написать» или раздел друзей/ЛС в боковом меню." },
        { q: "Реакции не работают", a: "Администратор мог заблокировать реакции глобально. Попробуйте позже." },
        { q: "Спам и оскорбления", a: "Заблокируйте пользователя, сообщите модератору или в поддержку. Укажите @ID нарушителя." },
      ],
    },
    {
      id: "friends",
      title: "Друзья и профиль",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp",
      items: [
        { q: "Как добавить в друзья?", a: "Откройте профиль → «Добавить в друзья». Дождитесь принятия заявки во вкладке «Друзья»." },
        { q: "Заявка не приходит", a: "Проверьте @ID. Пользователь мог отклонить или заблокировать заявки. Обновите список заявок." },
        { q: "Как изменить аватар и био?", a: "Настройки профиля или карточка профиля → редактирование. Сохраните изменения." },
        { q: "Что такое уровень и XP?", a: "Опыт начисляется за активность. Уровень растёт с XP — отображается в профиле." },
        { q: "Ачивки и бейджи", a: "Получаются за достижения и события. Смотрите в профиле в разделе достижений." },
      ],
    },
    {
      id: "shop",
      title: "Базар и рамки",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Shopping%20Bags.webp",
      items: [
        { q: "Как купить рамку?", a: "Откройте «Базар» в лобби, выберите товар и подтвердите покупку (если доступна валюта/условия)." },
        { q: "Рамка не отображается", a: "Примените рамку в инвентаре профиля. Обновите страницу. Проверьте, что URL рамки загружается." },
        { q: "Покупка не прошла", a: "Проверьте баланс/условия. Если списалось, но товар не появился — напишите в поддержку с временем покупки." },
      ],
    },
    {
      id: "mobile",
      title: "Мобильная версия",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Mobile%20Phone.webp",
      items: [
        { q: "Меню не открывается", a: "Нажмите иконку «бургер» слева вверху. На некоторых устройствах — свайп от левого края экрана." },
        { q: "Комнаты отображаются криво", a: "Обновите страницу. Мы оптимизировали сетку комнат для узких экранов — карточки должны быть на всю ширину." },
        { q: "Клавиатура перекрывает чат", a: "Прокрутите чат вверх. На iOS закройте клавиатуру свайпом вниз." },
        { q: "Видео в полноэкранном режиме", a: "Используйте кнопку полноэкранного режима плеера. На iOS может потребоваться тап по видео." },
      ],
    },
    {
      id: "tech",
      title: "Технические проблемы",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp",
      items: [
        { q: "Белый/чёрный экран", a: "Обновите страницу (Ctrl+F5). Очистите кэш браузера. Попробуйте другой браузер (Chrome, Firefox, Edge)." },
        { q: "Ошибка JSON / <!doctype", a: "Сервер вернул HTML вместо данных API. Обычно при сбое backend или неверном URL. Сообщите поддержке." },
        { q: "Firebase / permission denied", a: "Сессия устарела — перелогиньтесь. Если повторяется — возможны правила безопасности или бан." },
        { q: "Сайт очень медленный", a: "Проверьте интернет, отключите тяжёлые расширения. Режим обслуживания (maintenance) может ограничивать функции." },
        { q: "Звук не работает", a: "Разрешите автовоспроизведение в браузере. Проверьте громкость вкладки и системы. Кликните по странице для разблокировки audio." },
        { q: "Уведомления не приходят", a: "Разрешите уведомления в браузере. Проверьте, не включён ли режим «Не беспокоить» в ОС." },
      ],
    },
    {
      id: "easter",
      title: "Пасхалки и команды",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Party%20Popper.webp",
      items: [
        { q: "Что такое пасхалки?", a: "Скрытые эффекты в чате комнаты. Команды: /moo, /grass, /milk, /popcorn, /dvd, /matrix, /nyan, /scream, /cheer и др." },
        { q: "Пасхалка не сработала", a: "Вводите команду целиком в чат комнаты. Некоторые эффекты видны всем в комнате. /matrix оставлен в классическом стиле." },
        { q: "Секретные слова", a: "Попробуйте набрать на клавиатуре: COWIO, GLASS, CINEMA, POTATO, NINJA, ZOMBIE, SPACE, MIRROR (латиница)." },
      ],
    },
    {
      id: "rules",
      title: "Правила и модерация",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp",
      items: [
        { q: "За что могут забанить?", a: "Спам, оскорбления, NSFW-контент, обход банов, взлом. Решение принимают модераторы и создатель." },
        { q: "Mute и shadowban", a: "Mute — не можете писать. Shadowban — сообщения видите только вы. Обратитесь в поддержку, если считаете ошибкой." },
        { q: "Как пожаловаться?", a: "Чат с нами :) — опишите ситуацию, @ID нарушителя, скриншоты по возможности." },
        { q: "Пользовательское соглашение", a: "Ссылка на соглашение при регистрации. Принимая его, вы соглашаетесь с правилами платформы." },
      ],
    },
    {
      id: "other",
      title: "Прочее",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp",
      items: [
        { q: "Как удалить аккаунт?", a: "Напишите в поддержку с email аккаунта. Удаление выполняется администратором." },
        { q: "Предложить идею", a: "Используйте ссылку «Предложка» внизу лобби или чат с поддержкой." },
        { q: "Регистрация отключена", a: "Включён глобальный блок регистраций. Следите за объявлениями в лобби." },
        { q: "Туториал", a: "При первом входе запускается обучение. Можно пройти снова через настройки, если доступно." },
        { q: "Тема оформления", a: "Переключатель светлой/тёмной темы в лобби (иконка солнца/луны)." },
      ],
    },
  ];

  static init() {
    this.injectFab();
    this.injectModal();
  }

  static injectFab() {
    if (document.getElementById("lobby-help-fab")) return;
    const fab = document.createElement("button");
    fab.id = "lobby-help-fab";
    fab.type = "button";
    fab.title = "Справочник и помощь";
    fab.innerHTML = `<img src="${this.EXCLAMATION_IMG}" alt="!">`;
    fab.onclick = () => this.open();
    document.body.appendChild(fab);
  }

  static injectModal() {
    if (document.getElementById("modal-help-guide")) return;
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modal-help-guide";
    modal.innerHTML = `
      <div class="modal-content glass-panel" style="width:min(720px,96vw); max-height:90vh; display:flex; flex-direction:column; padding:0; overflow:hidden;">
        <div style="padding:20px 22px 12px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${this.EXCLAMATION_IMG}" style="width:28px;height:28px;filter:grayscale(1) contrast(0);">
            <div>
              <h2 style="margin:0; font-size:20px;">Справочник COWIO</h2>
              <div style="font-size:12px; color:var(--text-muted);">Ответы на частые вопросы</div>
            </div>
          </div>
          <button class="secondary-btn" id="btn-close-help-guide" style="width:auto; padding:8px 12px;">✕</button>
        </div>
        <div style="display:flex; flex:1; min-height:0; overflow:hidden;">
          <div id="help-guide-nav" style="width:200px; flex-shrink:0; border-right:1px solid var(--border-light); overflow-y:auto; padding:10px;"></div>
          <div id="help-guide-body" style="flex:1; overflow-y:auto; padding:18px 22px;"></div>
        </div>
        <div style="padding:12px 22px; border-top:1px solid var(--border-light); display:flex; gap:10px; flex-wrap:wrap;">
          <button class="primary-btn" id="btn-help-support-chat" style="width:auto; flex:1; min-width:180px;">Чат с нами :)</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#btn-close-help-guide").onclick = () => modal.classList.remove("active");
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });
    modal.querySelector("#btn-help-support-chat").onclick = () => this.openSupportChat();
    this.renderNav();
    this.showTopic(this.TOPICS[0]?.id || "start");
  }

  static renderNav() {
    const nav = document.getElementById("help-guide-nav");
    if (!nav) return;
    nav.innerHTML = this.TOPICS.map(
      (t) => `<button type="button" class="secondary-btn help-topic-btn" data-topic="${t.id}" style="width:100%; text-align:left; margin-bottom:6px; font-size:12px; padding:8px 10px; display:flex; align-items:center; gap:8px;">
        <img src="${t.icon}" style="width:18px;height:18px;"> ${t.title}
      </button>`,
    ).join("");
    nav.querySelectorAll(".help-topic-btn").forEach((btn) => {
      btn.onclick = () => this.showTopic(btn.dataset.topic);
    });
  }

  static showTopic(topicId) {
    const topic = this.TOPICS.find((t) => t.id === topicId) || this.TOPICS[0];
    const body = document.getElementById("help-guide-body");
    if (!body || !topic) return;
    document.querySelectorAll(".help-topic-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.topic === topic.id);
    });
    const itemsHtml = topic.items
      .map(
        (item) => `
        <details class="help-faq-item" style="border:1px solid var(--border-light); border-radius:12px; padding:12px 14px; margin-bottom:10px; background:rgba(255,255,255,0.02);">
          <summary style="font-weight:700; cursor:pointer; font-size:14px; list-style:none; display:flex; align-items:center; gap:8px;">
            <img src="${topic.icon}" style="width:16px;height:16px; opacity:0.8;"> ${item.q}
          </summary>
          <p style="margin:12px 0 14px; font-size:13px; color:var(--text-muted); line-height:1.65;">${item.a}</p>
          <button type="button" class="secondary-btn help-support-link" style="width:100%; font-size:12px; padding:8px;">Не помогло? Обратитесь к нам!</button>
        </details>`,
      )
      .join("");
    body.innerHTML = `
      <h3 style="margin:0 0 16px; display:flex; align-items:center; gap:10px;">
        <img src="${topic.icon}" style="width:24px;height:24px;"> ${topic.title}
      </h3>
      ${itemsHtml}
      ${topic.id === "start" ? this.CREATOR_NOTE : ""}
    `;
    body.querySelectorAll(".help-support-link").forEach((btn) => {
      btn.onclick = () => this.openSupportChat();
    });
    body.scrollTop = 0;
  }

  static open() {
    const modal = document.getElementById("modal-help-guide");
    if (modal) modal.classList.add("active");
  }

  static async openSupportChat() {
    document.getElementById("modal-help-guide")?.classList.remove("active");
    if (window.AdminPanel && typeof AdminPanel.getDeveloperUid === "function") {
      try {
        const uid = await AdminPanel.getDeveloperUid();
        if (uid && window.DirectMessages) {
          const name = "COWIO Support";
          DirectMessages.openChat(uid, name);
          if (window.Utils?.toast) Utils.toast("Открыт чат с поддержкой", "success");
          return;
        }
      } catch (e) {}
    }
    if (window.Utils?.toast) Utils.toast("Напишите нам: cowiosupport@gmail.com или Telegram из футера", "info");
    window.open("mailto:cowiosupport@gmail.com?subject=COWIO%20Support", "_blank");
  }

  static setLobbyVisible(visible) {
    const fab = document.getElementById("lobby-help-fab");
    if (fab) fab.style.display = visible ? "flex" : "none";
  }
}

window.HelpGuideManager = HelpGuideManager;
