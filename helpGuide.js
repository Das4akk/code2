/**
 * Справочник COWIO: FAQ и помощь (только лобби)
 */
class HelpGuideManager {
  static EXCLAMATION_IMG =
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Exclamation%20Mark.webp";

  static CREATOR_NOTE = `
    <div style="border:1px dashed var(--border-light); border-radius:14px; padding:16px; margin-top:20px; background:rgba(255,255,255,0.03);">
      <div style="font-weight:800; margin-bottom:8px;">От создателей</div>
      <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin:0;">
        Привет! Тут собрали ответы на самые частые вопросы. Если что-то всё равно не работает,
        просто напишите в поддержку через меню слева. Мы правда читаем сообщения, и ваши отзывы помогают нам делать COWIO лучше.
      </p>
    </div>
  `;

  static TOPICS = [
    {
      id: "ai_assistant",
      title: "ИИ-Ассистент",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Robot.webp",
      items: [],
    },
    {
      id: "start",
      title: "Начало работы",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/Rocket.webp",
      items: [
        { q: "Как зарегистрироваться?", a: "Жмите «Регистрация», заполните имя, @ID, почту и пароль (минимум 6 символов), примите соглашение. После «Создать аккаунт» на почту упадёт код. Введите его, и всё, вы внутри." },
        { q: "Как войти в аккаунт?", a: "Вкладка «Вход», email, пароль, «Войти в систему». Или просто через Google, если так удобнее." },
        { q: "Что такое @ID?", a: "Это ваш уникальный ник: 3–15 символов, латиница, цифры и _. Показывается как @ваш_id. ID developer занят, его взять нельзя." },
        { q: "Код подтверждения не приходит", a: "Сначала гляньте «Спам». Подождите пару минут. Через 60 секунд можно жать «Отправить повторно». И проверьте, что email без опечаток." },
        { q: "Ошибка API send-code / HTTP 405", a: "Это косяк на стороне отправки писем. Попробуйте позже или напишите в поддержку, админы глянут SMTP на Vercel." },
      ],
    },
    {
      id: "auth",
      title: "Аккаунт и безопасность",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp",
      items: [
        { q: "Забыл пароль", a: "На экране входа жмите «Забыли пароль?», вводите почту, получаете код, ставите новый пароль (минимум 6 символов)." },
        { q: "Как сменить пароль?", a: "Настройки → Аккаунт и Безопасность → Смена пароля. Нужен текущий пароль и код с почты." },
        { q: "Как сменить email?", a: "В настройках вводите текущий пароль и новую почту, потом подтверждаете кодом на новый адрес." },
        { q: "Вышел из аккаунта сам", a: "Скорее всего, зашли с другого устройства или сессия протухла. Просто войдите снова. Если недавно меняли пароль, это тоже нормально." },
        { q: "Подозрительная активность", a: "Смените пароль, проверьте почту. И напишите в поддержку, что случилось, разберёмся." },
      ],
    },
    {
      id: "rooms",
      title: "Комнаты и видео",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp",
      items: [
        { q: "Как создать комнату?", a: "В лобби жмите «Создать комнату», дайте название, вставьте ссылку на видео (YouTube и др.). Хотите приват? Поставьте галочку и пароль." },
        { q: "Не могу войти в комнату", a: "Может быть приват с паролем, комната переполнена или уже удалена. Проверьте ссылку-приглашение." },
        { q: "Видео не воспроизводится", a: "Проверьте ссылку, интернет и блокировщики рекламы. Некоторые ролики режут по региону. Попробуйте другое видео для теста." },
        { q: "Видео тормозит или зависает", a: "Закройте лишние вкладки, проверьте скорость интернета. На телефоне лучше Wi‑Fi, чем мобильный интернет." },
        { q: "Создание комнат заблокировано", a: "Админ временно отключил создание. Подождите объявление или спросите в поддержке, когда откроют." },
        { q: "Как пригласить друзей в комнату?", a: "Скопируйте ID комнаты или ссылку из интерфейса и киньте другу в ЛС или любой мессенджер." },
      ],
    },
    {
      id: "chat",
      title: "Чат и сообщения",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp",
      items: [
        { q: "Сообщения не отправляются", a: "Может стоять глобальный lock чата, mute или shadowban. Проверьте интернет и обновите страницу." },
        { q: "Не вижу сообщения других", a: "Обновите страницу. Иногда Firebase чуть тупит. Ещё проверьте, не включили ли «Скрыть чат» в настройках." },
        { q: "Как писать в личные сообщения?", a: "Откройте профиль человека и жмите «Написать». Или через раздел друзей/ЛС в боковом меню." },
        { q: "Реакции не работают", a: "Админ мог временно вырубить реакции глобально. Попробуйте позже." },
        { q: "Спам и оскорбления", a: "Заблокируйте пользователя, напишите модератору или в поддержку. Укажите @ID нарушителя, так быстрее." },
      ],
    },
    {
      id: "friends",
      title: "Друзья и профиль",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp",
      items: [
        { q: "Как добавить в друзья?", a: "Откройте профиль → «Добавить в друзья». Ждите, пока человек примет заявку во вкладке «Друзья»." },
        { q: "Заявка не приходит", a: "Проверьте @ID. Может, человек отклонил или закрыл заявки. Обновите список заявок." },
        { q: "Как изменить аватар и био?", a: "Зайдите в настройки профиля или карточку профиля и отредактируйте. Не забудьте сохранить." },
        { q: "Что такое уровень и XP?", a: "XP капает за активность на сайте. Чем больше XP, тем выше уровень в профиле." },
        { q: "Ачивки и бейджи", a: "Получаются за достижения и ивенты. Смотрите в профиле, раздел достижений." },
      ],
    },
    {
      id: "shop",
      title: "Базар и рамки",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Shopping%20Bags.webp",
      items: [
        { q: "Как купить рамку?", a: "Откройте «Базар» в лобби, выберите товар и подтвердите покупку, если хватает валюты или выполнены условия." },
        { q: "Рамка не отображается", a: "Примените рамку в инвентаре профиля. Обновите страницу. Если URL рамки битый, напишите в поддержку." },
        { q: "Покупка не прошла", a: "Проверьте баланс и условия. Если списалось, а товара нет, напишите в поддержку с временем покупки." },
      ],
    },
    {
      id: "mobile",
      title: "Мобильная версия",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Mobile%20Phone.webp",
      items: [
        { q: "Меню не открывается", a: "Жмите «бургер» слева вверху. На некоторых телефонах помогает свайп от левого края." },
        { q: "Комнаты отображаются криво", a: "Обновите страницу. Мы уже подогнали сетку под узкие экраны, карточки должны быть на всю ширину." },
        { q: "Клавиатура перекрывает чат", a: "Прокрутите чат вверх. На iOS клавиатуру можно убрать свайпом вниз." },
        { q: "Видео в полноэкранном режиме", a: "Кнопка полноэкранного режима в плеере. На iOS иногда нужен тап по самому видео." },
      ],
    },
    {
      id: "tech",
      title: "Технические проблемы",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp",
      items: [
        { q: "Белый/чёрный экран", a: "Обновите страницу (Ctrl+F5). Очистите кэш. Попробуйте Chrome, Firefox или Edge." },
        { q: "Ошибка JSON / <!doctype", a: "Сервер вернул HTML вместо JSON. Обычно это сбой backend или кривой URL. Напишите в поддержку." },
        { q: "Firebase / permission denied", a: "Сессия протухла, перелогиньтесь. Если повторяется, возможен бан или правила безопасности." },
        { q: "Сайт очень медленный", a: "Проверьте интернет, отключите тяжёлые расширения. В режиме обслуживания часть функций может тормозить." },
        { q: "Звук не работает", a: "Разрешите автовоспроизведение в браузере. Проверьте громкость вкладки и системы. Кликните по странице, чтобы разблокировать звук." },
        { q: "Уведомления не приходят", a: "Разрешите уведомления в браузере. Проверьте, не включён ли «Не беспокоить» в системе." },
      ],
    },
    {
      id: "easter",
      title: "Пасхалки и команды",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Party%20Popper.webp",
      items: [
        { q: "Что такое пасхалки?", a: "Скрытые эффекты в чате комнаты. Команды: /moo, /grass, /milk, /popcorn, /dvd, /matrix, /nyan, /scream, /cheer и другие." },
        { q: "Пасхалка не сработала", a: "Вводите команду целиком в чат комнаты. Многие эффекты видят все в комнате. /matrix оставлен в классическом стиле." },
        { q: "Секретные слова", a: "Наберите на клавиатуре: COWIO, GLASS, CINEMA, POTATO, NINJA, ZOMBIE, SPACE, MIRROR (латиница)." },
      ],
    },
    {
      id: "rules",
      title: "Правила и модерация",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp",
      items: [
        { q: "За что могут забанить?", a: "Спам, оскорбления, NSFW, обход банов, взлом. Решение за модераторами и создателем." },
        { q: "Mute и shadowban", a: "Mute: не можете писать. Shadowban: сообщения видите только вы. Если кажется ошибкой, пишите в поддержку." },
        { q: "Как пожаловаться?", a: "Откройте поддержку в меню слева, опишите ситуацию, @ID нарушителя и скрины, если есть." },
        { q: "Пользовательское соглашение", a: "Ссылка при регистрации. Принимая его, вы соглашаетесь с правилами платформы." },
      ],
    },
    {
      id: "other",
      title: "Прочее",
      icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp",
      items: [
        { q: "Как удалить аккаунт?", a: "Напишите в поддержку с email аккаунта. Удаление делает администратор." },
        { q: "Предложить идею", a: "Ссылка «Предложка» внизу лобби или тикет в поддержке." },
        { q: "Регистрация отключена", a: "Включён глобальный блок регистраций. Следите за объявлениями в лобби." },
        { q: "Туториал", a: "При первом входе запускается обучение. Можно пройти снова через настройки, если доступно." },
        { q: "Тема оформления", a: "Переключатель светлой/тёмной темы в лобби, иконка солнца/луны." },
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
      <style>
        .help-guide-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }
        .help-guide-nav-area { width: 200px; flex-shrink: 0; border-right: 1px solid var(--border-light); overflow-y: auto; padding: 10px; }
        .help-guide-body-area { flex: 1; overflow-y: auto; padding: 18px 22px; }
        .help-ai-input-wrap { display: flex; gap: 10px; }
        @media (max-width: 768px) {
          .help-guide-layout { flex-direction: column; }
          .help-guide-nav-area { width: 100%; border-right: none; border-bottom: 1px solid var(--border-light); display: flex; flex-wrap: nowrap; overflow-x: auto; padding: 10px 10px 5px; min-height: 60px; }
          .help-guide-nav-area .help-topic-btn { flex-shrink: 0; white-space: nowrap; margin-bottom: 0; margin-right: 8px; width: auto !important; }
          .help-guide-body-area { padding: 14px 16px; }
          .help-ai-input-wrap { flex-direction: column; }
          .help-ai-input-wrap button { width: 100% !important; padding: 12px !important; }
        }
      </style>
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
        <div class="help-guide-layout">
          <div id="help-guide-nav" class="help-guide-nav-area"></div>
          <div id="help-guide-body" class="help-guide-body-area"></div>
        </div>
        <div style="padding:12px 22px; border-top:1px solid var(--border-light); display:flex; gap:10px; flex-wrap:wrap;">
          <button class="primary-btn" id="btn-help-support-chat" style="width:auto; flex:1; min-width:180px;">Написать в поддержку</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#btn-close-help-guide").onclick = () => modal.classList.remove("active");
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });
    modal.querySelector("#btn-help-support-chat").onclick = () => this.openSupport();
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

    if (topic.id === "ai_assistant") {
       body.innerHTML = `
         <h3 style="margin:0 0 16px; display:flex; align-items:center; gap:10px;">
           <img src="${topic.icon}" style="width:24px;height:24px;"> Контекстный ИИ-Ассистент
         </h3>
         <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:14px; padding:16px; color:#111827; box-shadow:0 18px 40px rgba(0,0,0,0.18);">
           <p style="font-size:13px; color:#4b5563; margin-bottom:15px;">Задайте свой вопрос, и я поищу ответ по всем разделам базы знаний COWIO.</p>
           <div class="help-ai-input-wrap">
             <input type="text" id="help-ai-input" placeholder="Например: как поменять пароль?" class="text-input" style="flex:1; padding:12px; border-radius:8px; font-size:16px; background:#f9fafb; color:#111827; border:1px solid #d1d5db;" />
             <button id="help-ai-send" class="primary-btn" style="width:auto; padding:10px 20px;">Спросить</button>
           </div>
         </div>
         <div id="help-ai-answers" style="margin-top:20px; display:flex; flex-direction:column; gap:12px;"></div>
       `;

       const input = document.getElementById("help-ai-input");
       const sendBtn = document.getElementById("help-ai-send");
       const answersBox = document.getElementById("help-ai-answers");

       const findLocalAnswer = (query, docs) => {
           const words = query.toLowerCase().replace(/[^\p{L}\p{N}\s@_-]+/gu, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 16);
           const entries = [];
           const entryRe = /В:\s*([^\n]+)\nО:\s*([\s\S]*?)(?=\nВ:|\n\nРаздел|$)/g;
           let match;
           while ((match = entryRe.exec(docs))) entries.push({ q: match[1].trim(), a: match[2].trim() });
           let best = null;
           entries.forEach((entry) => {
              const haystack = `${entry.q} ${entry.a}`.toLowerCase();
              const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
              if (!best || score > best.score) best = { ...entry, score };
           });
           return best && best.score > 0
             ? `Похоже, ближайший ответ из справочника: ${best.a}`
             : "Я не нашел точный ответ в справочнике COWIO. Откройте поддержку и опишите вопрос там, чтобы оператор проверил ситуацию точнее.";
       };

       const askAI = async () => {
            const query = input.value.trim();
            if (!query) return;
           
           const docs = this.TOPICS.map(t => 
             "Раздел " + t.title + ":\n" + t.items.map(i => "В: " + i.q + "\nО: " + i.a).join("\n")
           ).join("\n\n");
           
           input.value = "";
           
            const ansId = "ans_" + Date.now();
            const localFallback = findLocalAnswer(query, docs);
            sendBtn.disabled = true;
            sendBtn.style.opacity = "0.75";
            answersBox.innerHTML = `
              <div class="help-faq-item" style="border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:12px 14px; background:#ffffff; color:#111827; box-shadow:0 10px 28px rgba(0,0,0,0.14);" id="${ansId}">
                <div style="font-weight:700; font-size:14px; color:#111827; margin-bottom:8px;">${Utils.escapeHtml(query)}</div>
                <div class="ai-reply" style="font-size:13px; color:#1f2937; line-height:1.65;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:16px;vertical-align:middle;"> ИИ думает...</div>
              </div>` + answersBox.innerHTML;
              
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 9000);
                const res = await fetch('/api/ask-guide-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, docs }),
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const data = await res.json().catch(() => ({ success: true, answer: localFallback }));
                const answer = data?.answer || localFallback;
                document.getElementById(ansId).querySelector('.ai-reply').innerText = answer;
            } catch(e) {
                document.getElementById(ansId).querySelector('.ai-reply').innerText = localFallback;
            } finally {
                sendBtn.disabled = false;
                sendBtn.style.opacity = "";
            }
        };

       sendBtn.onclick = askAI;
       input.onkeypress = (e) => { if(e.key === 'Enter') askAI(); };
       return;
    }

    const itemsHtml = topic.items
      .map(
        (item) => `
        <details class="help-faq-item" style="border:1px solid var(--border-light); border-radius:12px; padding:12px 14px; margin-bottom:10px; background:rgba(255,255,255,0.02);">
          <summary style="font-weight:700; cursor:pointer; font-size:14px; list-style:none; display:flex; align-items:center; gap:8px;">
            <img src="${topic.icon}" style="width:16px;height:16px; opacity:0.8;"> ${item.q}
          </summary>
          <p style="margin:12px 0 14px; font-size:13px; color:var(--text-muted); line-height:1.65;">${item.a}</p>
          <button type="button" class="secondary-btn help-support-link" style="width:100%; font-size:12px; padding:8px;">Не помогло? Напишите в поддержку</button>
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
      btn.onclick = () => this.openSupport();
    });
    body.scrollTop = 0;
  }

  static open() {
    const modal = document.getElementById("modal-help-guide");
    if (modal) modal.classList.add("active");
  }

  static openSupport() {
    document.getElementById("modal-help-guide")?.classList.remove("active");

    if (window.Utils?.showScreen) {
      Utils.showScreen("lobby-screen");
    }

    if (window.innerWidth <= 1024) {
      document.getElementById("main-sidebar")?.classList.add("open");
      document.getElementById("sidebar-overlay")?.classList.add("open");
    }

    setTimeout(() => {
      const staffNav = document.getElementById("nav-support-staff");
      const userNav = document.getElementById("nav-support");
      const target =
        staffNav && staffNav.style.display !== "none" ? staffNav : userNav;

      if (target) {
        target.click();
      } else if (window.SupportSystem) {
        SupportSystem.renderTickets();
        const section = document.getElementById("section-support");
        if (section) section.style.display = "flex";
      }

      if (window.Utils?.toast) Utils.toast("Открыта поддержка", "success");
    }, 120);
  }

  static setLobbyVisible(visible) {
    const fab = document.getElementById("lobby-help-fab");
    if (fab) fab.style.display = visible ? "flex" : "none";
  }
}

window.HelpGuideManager = HelpGuideManager;
