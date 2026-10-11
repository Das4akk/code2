# COWIO — Платформа совместного просмотра видео и фильмов

Платформа совместного просмотра видео и фильмов с синхронизацией VK Video и YouTube, поддержкой комнат, голосовой связи, чата, профилей и системы подписки Premium.

---

## 🎨 Стандарты дизайна и интерфейса (UI / Design Constitution)

> **ВАЖНО ДЛЯ РАЗРАБОТЧИКОВ И ИИ-АГЕНТОВ**:
> При создании или изменении любых модальных окон, всплывающих меню, карточек, тултипов, уведомлений, шторок и доков **ОБЯЗАТЕЛЬНО** применять единый стиль **True Dark-Black Translucent Frosted Glass**.

### 1. Единый стиль полупрозрачного стекла (Frosted Glass)
* **Фон карточек и окон**: `rgba(6, 6, 9, 0.45)` (глубокий чистый чёрный цвет, без синих, серых или фиолетовых оттенков).
* **Блюр и насыщенность**: `backdrop-filter: blur(28px) saturate(190%) !important; -webkit-backdrop-filter: blur(28px) saturate(190%) !important;`
* **Тонкий бордер**: `border: 1px solid rgba(255, 255, 255, 0.14) !important;`
* **Скругление**: `border-radius: 22px !important;` (для меню и тостов `16px`).
* **Объёмная тень**: `box-shadow: 0 24px 70px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 1px 0 0 rgba(255, 255, 255, 0.2) inset !important;`
* **Затемнение оверлея (.modal)**: `background: rgba(0, 0, 0, 0.28) !important; backdrop-filter: blur(4px) !important;` (лёгкое полупрозрачное затемнение, чтобы звёзды, видео и фоновый интерфейс отчётливо просвечивали через размытое стекло).

### 2. Дизайн Технического Перерыва (Maintenance System)
* Оверлеи технического перерыва (как глобальный сайт, так и отдельные заблокированные разделы) **НЕ ДОЛЖНЫ** содержать тёмно-синих или непрозрачных прямоугольных карточек/рамок за текстом.
* Все тексты, анимированные эмодзи и заголовки отображаются **напрямую на фоне чистого глубокого размытия (Pure Backdrop Blur)**:
  * Фон: `rgba(0, 0, 0, 0.45)`
  * Блюр: `backdrop-filter: blur(30px) saturate(190%) !important; -webkit-backdrop-filter: blur(30px) saturate(190%) !important;`
  * Текст и анимированный стикер парят по центру без лишних подложек.

---

## 🔐 Политика разграничения прав в Админ-панели (Developer vs Moderator / Manager)

> **КРИТИЧЕСКИ ВАЖНО ДЛЯ ПОДДЕРЖКИ**:
> Абсолютно каждая функция, инструмент, кнопка и раздел в админ-панели, предназначенные для `@developer` / Создателя, **ОБЯЗАНЫ БЫТЬ ПОЛНОСТЬЮ СКРЫТЫ ОТ ГЛАЗ ОБЫЧНЫХ МОДЕРАТОРОВ И МЕНЕДЖЕРОВ**.

### 1. Доступные разделы по ролям:
* **Создатель / @developer** (`isCurrentUserCreator()` === true):
  * **Полный доступ ко ВСЕМ вкладкам**: `dashboard`, `people`, `rooms`, `library`, `badges`, `logs`, `security`, `automation`, `broadcast`, `integrations`, `backups`, `catalog`, `maintenance`.
  * Управление ролями (Модератор, Оператор, Менеджер) встроено прямо в карточку выбранного пользователя в разделе `people` (User Editor).
  * Массовые операции, управление Люменами, стрик, XP, создание аккаунтов, бейджи, системные локи, тех.перерыв.
* **Модераторы** (`isModeratorProfile()`):
  * Доступны **ТОЛЬКО** 4 раздела: `dashboard` (статистика), `people` (просмотр и модерация юзеров), `rooms` (просмотр комнат и кик), `library` (модерация видео).
  * **Все вкладки разработчика скрыты** (`display: none !important;` / атрибут `data-dev-only="true"`).
  * Внутри разрешенных разделов все инструменты Создателя (массовые операции, выдача бейджей/рамок на весь онлайн, изменение стриков, прямое начисление Люменов, удаление/обнуление аккаунтов, сброс всех комнат) скрыты.
* **Менеджеры** (`isManagerProfile()`):
  * Режим «Только для чтения» (Read-Only) по разделам `dashboard`, `people`, `rooms`, `library`.

### 2. Поддержка в дальнейшем:
* Любые новые кнопки, вкладки или инструменты, добавляемые в `js/admin.js`, должны помечаться атрибутом `data-dev-only="true"`, если они не предназначены для базовой модерации.
* Метод `AdminPanel.renderPanel()` автоматически скрывает все элементы `[data-dev-only="true"]` для пользователей без прав Создателя.

---

## 🔍 Правила поиска видео
* В поиске по названию используются **исключительно** платформы **VK Video** и **YouTube**.
* Поиск по Rutube, Twitch и сторонним платформам отключён.

---

## 📚 Правила доступа к Библиотеке (Library Access Rules)
* **Для всех пользователей**:
  * Просмотр вкладок «Публичная библиотека» и «Моя библиотека».
  * Поиск по видеотеке.
  * Открытие карточек и модального окна просмотра информации о добавленных видео (`modal-lib-view`).
  * Разворачивание описания («Читать полностью»).
* **Только для пользователей с COWIO Premium**:
  * Добавление новых видео в библиотеку (`#btn-lib-add-video`).
  * Создание комнат из библиотеки (`#btn-lib-create-room`).
  * Редактирование, удаление и управление авторами.

---

## 🚀 Запуск и разработка

```bash
# Установка зависимостей
npm install

# Запуск сервера разработки
npm run dev

# Сборка проекта
npm run build
```

---

## ⚡ Развертывание на Vercel (Hobby Plan & Лимиты Serverless Functions)

### 1. Лимит 12 функций на бесплатном тарифе (Hobby Plan)
На бесплатном тарифе Vercel Hobby действует строгое ограничение: **не более 12 Serverless Functions** на проект. Если в каталоге `api/` создать больше 12 отдельных `.js` файлов, Vercel выдаст ошибку:
> *No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan. Create a team (Pro plan) to deploy more.*

#### Как это решено в проекте:
- Все запросы `/api/*` объединены в **1 единый серверлесс-роутер** (`api/index.js`), использующий лишь 1 слот из 12 доступных.
- Все обработчики и хелперы вынесены в поддиректорию `api/_lib/`. По правилам Vercel папки с префиксом `_` считаются приватными библиотеками и **не учитываются** в лимит функций.
- В файле `vercel.json` настроен единый rewrite:
  ```json
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/((?!api/|assets/|css/|js/|partials/|public/|.*\\..*).*)", "destination": "/index.html" }
  ]
  ```

---

### 2. Настройка переменных окружения в Vercel

Чтобы почтовые коды подтверждения отправлялись пользователям, а Firebase авторизация работала корректно:

1. Откройте ваш проект на **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Перейдите в **Settings → Environment Variables**.
3. Добавьте переменные для почты:
   * **`SMTP_USER`** (или `SMPT_USER`): ваш email (например, `das4akk2@gmail.com`).
   * **`SMTP_PASS`** (или `SMPT_PASS`): 16-значный **Пароль приложения Google** (Google App Password), сгенерированный в Google Account → Безопасность → Двухэтапная аутентификация → Пароли приложений.
   * **`SMTP_HOST`**: `smtp.gmail.com` (для Gmail) или `smtp.yandex.ru` (для Яндекса).
   * **`SMTP_PORT`**: `465` (также поддерживается автопереключение на `587`).
4. **КРИТИЧЕСКИ ВАЖНО**: При сохранении каждой переменной **ОБЯЗАТЕЛЬНО отметьте галочками все 3 окружения**:
   * [x] **Production**
   * [x] **Preview**
   * [x] **Development**
5. **ВНИМАНИЕ**: После добавления или изменения переменных окружения Vercel **не обновляет уже развёрнутые версии автоматически**. Перейдите во вкладку **Deployments**, нажмите на три точки `...` напротив последней сборки и нажмите **Redeploy**.

---

### 3. Мгновенная проверка готовности на Vercel

После деплоя откройте в браузере:
```
https://ваш-проект.vercel.app/api/health
```
Эндпоинт вернёт диагностическую информацию:
- `smtp.hasUser: true` — Vercel передал логин почты;
- `smtp.hasPass: true` — Vercel передал пароль почты;
- `smtp.port: 465` — активный порт отправки.

---

## 🎭 Памятка: Анимированные Telegram Эмодзи (CDN & Каталог)

Все анимированные эмодзи в COWIO подключаются напрямую через публичный CDN репозитория **Telegram Animated Emojis**:

* **Официальный репозиторий**: `https://github.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis`
* **Базовый URL CDN (jsDelivr)**:
  `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/{Категория}/{Название%20Эмодзи}.webp`

### Доступные категории:
1. `Activity` (Медали, Конфетти, Звездочки, Игры, Магия, Трофеи):
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp`
2. `Animals and Nature` (Огонь, Звезды, Животные, Природа):
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp`
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Glowing%20Star.webp`
3. `Food and Drink` (Еда, Напитки, Торты, Попкорн)
4. `Objects` (Подарки, Сумки, Замки, Инструменты):
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Shopping%20Bags.webp`
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp`
5. `People` (Персонажи, Профессии, Жесты)
6. `Smileys` (Смайлы, Эмоции, Празднование):
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Partying%20Face.webp`
7. `Symbols` (Сердца, Галочки, Вопросительные знаки):
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Heart%20On%20Fire.webp`
   * Пример: `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Speech%20Balloon.webp`
8. `Travel and Places` (Ракеты, Транспорт, Локации)
9. `Flags` (Флаги)

### Важные правила использования:
* **Не скачивать и не хранить эмодзи локально** на сервере во избежание раздувания размера репозитория (все 600+ webp весят десятки мегабайт).
* **Не поднимать локальные прокси-серверы** для эмодзи (`/api/emoji-proxy`), так как jsDelivr CDN предоставляет неограниченный глобальный кэш и максимальную скорость отдачи прямо в браузере клиента.
* Для поиска названий файлов используйте дерево файлов в репозитории GitHub: `github.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis`. Все названия пишутся на английском в стиле Title Case (`Fire.webp`, `Sparkles.webp`, `Party%20Popper.webp`).

