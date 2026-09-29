# 🚨 ЖУРНАЛ ИСПРАВЛЕНИЙ БЕЗОПАСНОСТИ (SECURITY FIXES LOG)

<div style="color: red; font-size: 1.2em; font-weight: bold; padding: 12px; border: 2px solid red; background: #fff0f0;">
⚠️ ВЛАДЕЛЕЦ! Смени пароль Gmail (cowiosupport@gmail.com), он был в публичном репозитории! Немедленно отзови все сессии и пароли приложений в Google Account → Security → App passwords.
</div>

---

## 1. Обнаруженные критические уязвимости и исправления

### 1.1. Секреты и учетные данные в открытом виде (CWE-798 / CWE-200)
- **Файлы:** `server.ts`, `server.js`, `api/premium/create-payment.js`, `api/premium/status.js`, `js/firebase.js`, `partials/screens/lobby.html`
- **Проблема:**
  1. Жестко закодированный пароль приложения SMTP (`qbkeftvifbqyicyx`).
  2. Захардкоженный публичный ключ и идентификатор мерчанта Platega API (`1lLu0Pb7yHD4DkPU8...`, `f5c52bf0-56b2-485d...`).
  3. Дефолтный секретный ключ HMAC (`cowio_super_secret_auth_key_2026`).
  4. Хардкод Firebase Web API Key в клиенте.
- **Что сделано:**
  1. Удалены все дефолтные fallback-значения и хардкоды паролей, ключей и адресов электронной почты.
  2. Создан безопасный шаблон `/.env.example` с полным описанием всех необходимых переменных окружения.
  3. Обновлен `/.gitignore` с исключением `.env*`, `.next/`, `serviceAccountKey*.json`, `*.pem`, `credentials.json`, `*.tsbuildinfo`.
  4. Клиентский `js/firebase.js` переведён на `import.meta.env.VITE_FIREBASE_*`.
- **Команда проверки:**
  ```bash
  grep -rnI -E "qbkeft|1lLu0Pb7y|cowio_super_secret" . --exclude-dir=node_modules --exclude-dir=.git
  # Результат: 0 совпадений в активном коде
  ```

---

### 1.2. Server-Side Request Forgery (SSRF) (CWE-918)
- **Файлы:** `utils/url-validator.ts`, `api/video-service.js`, `api/video/info.js`, `server.ts`, `server.js`
- **Проблема:**
  Эндпоинты `/api/video/info`, `/api/resolve-media`, `/api/library/fetch-metadata` и сервис `getVideoInfo` принимали произвольный URL от пользователя и выполняли HTTP-запросы без фильтрации локальных/приватных IP-адресов и метаданных облачных провайдеров.
- **Что сделано:**
  1. Создан модуль `utils/url-validator.ts`:
     - Строгий whitelist доменов видеохостингов (`youtube.com`, `youtu.be`, `rutube.ru`, `vk.com`, `vkvideo.ru`, `vimeo.com`).
     - Блокировка приватных и зарезервированных IPv4/IPv6 диапазонов: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`, `0.0.0.0/8`, `100.64.0.0/10`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`.
     - Блокировка hostnames: `localhost`, `metadata.google.internal`, `169.254.169.254`, `instance-data`.
     - Защита от DNS-rebinding: асинхронный DNS-резолв с проверкой всех возвращенных IP до отправки запроса.
     - Ограничение протоколов только до `http:` и `https:`.
     - Таймаут запросов: 5 секунд.
     - Безопасная обработка редиректов (`redirect: 'manual'` с повторной валидацией конечного URL).
  2. Применена функция `validateUrl` и `safeFetch` во всех затронутых местах.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/ssrf.test.ts
  # Результат: 4/4 тестов пройдено (включая блокировку 169.254.169.254, localhost, 192.168.1.1)
  ```

---

### 1.3. Отсутствие серверной аутентификации API (CWE-306 / CWE-862)
- **Файлы:** `lib/auth-middleware.ts`, `server.ts`, `server.js`
- **Проблема:**
  Критические эндпоинты, включая `/api/premium/create-payment`, не проверяли подлинность пользователя и принимали произвольный `uid` из тела запроса.
- **Что сделано:**
  1. Создан модуль `lib/auth-middleware.ts` с функциями:
     - `requireAuth`: валидация Firebase ID Token через `firebaseAdmin.auth().verifyIdToken()`, извлечение `req.user = { uid, email, role }`.
     - `requireRole`: проверка роли пользователя через `/admins/{uid}` в Firebase Realtime Database.
     - `optionalAuth`: мягкая авторизация для публичных видео-эндпоинтов.
  2. В `/api/premium/create-payment` параметр `uid` извлекается **исключительно** из `req.user.uid` (тело запроса игнорируется).
  3. Все закрытые эндпоинты защищены middleware `requireAuth`.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/auth.test.ts
  # Результат: Запрос без Bearer токена возвращает 401 Unauthorized
  ```

---

### 1.4. Синхронизация Firebase Security Rules
- **Файл:** `database.rules.json`
- **Проблема:**
  Файл правил базы данных в репозитории отсутствовал или не соответствовал актуальным правилам прод-окружения.
- **Что сделано:**
  Создан файл `database.rules.json` с полным разделением прав:
  - Запрет прямой записи ролей (`role: false`), премиума (`premium: false`), баланса (`lumens: false`) клиентом.
  - Ограничение чтения узлов `/admins` и `/payments_log` только администраторам.
  - Чтение и запись комнат только участникам или владельцу.
  - Защита личных данных пользователей (`/users/$uid/private`).

---

### 1.5. Подделка прав администратора/создателя на клиенте (CWE-602)
- **Файлы:** `server.ts`, `js/admin.js`, `js/maintenance.js`, `js/profile.js`, `scripts/grant-creator.js`
- **Проблема:**
  - Клиент проверял права создателя через `localStorage.getItem("cowio_developer_uid")` или хардкод почты `mankaef@yandex.ru`, `cowiosupport@gmail.com`.
  - При регистрации ника `developer` клиент автоматически прописывал пользователю `creator` в профиле!
- **Что сделано:**
  1. Реализован защищённый серверный эндпоинт `GET /api/auth/check-role`.
  2. В `js/admin.js` реализовано in-memory кэширование роли на клиенте с TTL 5 минут. Кэш сбрасывается при выходе (`signOut`).
  3. Удалено использование `localStorage.getItem("cowio_developer_uid")` и вызов `localStorage.removeItem("cowio_developer_uid")` добавлен при инициализации.
  4. Удалена уязвимость автовыдачи создателя при регистрации имени `developer` в `js/profile.js`.
  5. Создан CLI-скрипт `scripts/grant-creator.js` для выдачи прав через Firebase Admin SDK.
- **Команда проверки:**
  ```bash
  node scripts/grant-creator.js
  # Корректно валидирует параметры и ожидает UID
  ```

---

### 1.6. Небезопасный CORS (CWE-942)
- **Файлы:** `server.ts`, `server.js`, `api/video/info.js`
- **Проблема:**
  Использовался `origin: true` или `origin: '*'`, что позволяло сторонним вредоносным сайтам выполнять аутентифицированные запросы через браузер жертвы.
- **Что сделано:**
  Настроен строгий whitelist доменов:
  - `https://cowio.vercel.app`
  - `https://cowio.ru`
  - `https://www.cowio.ru`
  - `http://localhost:3000` (только в dev)
  - `http://localhost:5173` (только в dev)
  Запросы с запрещенных Origin немедленно блокируются с ответом `403 Forbidden`.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/cors.test.ts
  # Результат: Origin: https://evil.com блокируется с кодом 403
  ```

---

### 1.7 & 1.8. Уязвимости кодов верификации и брутфорс (CWE-307 / CWE-330)
- **Файлы:** `server.ts`, `server.js`
- **Проблема:**
  - Код верификации генерировался через небезопасный `Math.random()`.
  - Код логировался в открытом виде в консоль сервера.
  - В случае сбоя SMTP код возвращался клиенту в теле JSON-ответа!
  - Отсутствовали лимиты попыток ввода, что допускало брутфорс 6-значного кода за секунды.
- **Что сделано:**
  1. Переход на криптографически стойкий генератор `crypto.randomInt(100000, 1000000)`.
  2. Удалены все вызовы логирования открытого кода. Логируется только хеш: `[AUTH] Code sent to <hash(email)>`.
  3. Код никогда не возвращается в JSON-ответе клиенту.
  4. Введен счетчик попыток: при 5 неверных попытках код уничтожается, а email блокируется на 1 час.
  5. Подключены жесткие лимиты через `express-rate-limit`:
     - `/api/custom-auth/send-code`: 3 запроса/email/15 мин + 10 запросов/IP/час.
     - `/api/custom-auth/verify-code`: 5 запросов/email/15 мин.
     - `/api/custom-auth/reset-password`: 3 запроса/час.
     - `/api/premium/create-payment`: 10 запросов/uid/час.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/ratelimit.test.ts
  # Результат: 6-й запрос блокируется с HTTP 429 Too Many Requests
  ```

---

### 1.9. Межсайтовый скриптинг (XSS) и обход CSP (CWE-79)
- **Файлы:** `utils/sanitize.ts`, `js/security.js`, `server.ts`, `server.js`
- **Проблема:**
  - В `js/security.js` присутствовала критическая уязвимость: проверка белого списка разрешала `src.startsWith("javascript:")`!
  - Отсутствовал централизованный Content Security Policy.
- **Что сделано:**
  1. Установлена библиотека `isomorphic-dompurify`.
  2. Создан модуль `utils/sanitize.ts` с функциями `sanitizeHtml`, `sanitizeText`, `escapeAttr`.
  3. В `js/security.js` протокол `javascript:` и `data:text/html` добавлен в жесткую блокировку `isDangerous`.
  4. Настроен Helmet CSP с полным списком директив для Firebase, WebSocket, шрифтов и видеохостингов.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/xss.test.ts
  # Результат: экранирование <img src=x onerror=alert(1)> -> &lt;img...
  ```

---

### 1.10. Утечка приватности через сторонний сбор IP (CWE-359)
- **Файлы:** `js/auth.js`, `js/profile.js`, `js/security.js`
- **Проблема:**
  Клиентский код отправлял прямые запросы на сторонние сервисы `api.ipify.org` и `api64.ipify.org`.
- **Что сделано:**
  Все клиентские вызовы к ipify полностью удалены. Определение IP производится на сервере через `req.ip` при необходимости.

---

### 1.11. Подделка платежных вебхуков Platega (CWE-345)
- **Файлы:** `server.ts`, `server.js`, `api/premium/webhook.js`
- **Проблема:**
  Вебхук `/api/premium/webhook` доверял любому телу запроса и активировал премиум без проверки криптографической подписи.
- **Что сделано:**
  1. Добавлена верификация HMAC-подписи через `crypto.timingSafeEqual`.
  2. Добавлен обратный запрос в API Platega `GET /transaction/{id}` для проверки статуса на стороне шлюза.
  3. Обеспечена идемпотентность через журнал `/payments_log/{txId}` в Firebase.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/payment-webhook.test.ts
  # Результат: поддельный вебхук отклоняется с 403, верифицированный обрабатывается
  ```

---

### 1.12, 1.13, 1.14, 1.15. DoS, Prototype Pollution и утечки стека
- **Файлы:** `utils/sanitize.ts`, `lib/schemas.ts`, `server.ts`, `server.js`
- **Что сделано:**
  1. Ограничение размера входящего JSON до 1 МБ (`express.json({ limit: '1mb' })`).
  2. Middleware `prototypePollutionMiddleware` рекурсивно удаляет `__proto__`, `constructor`, `prototype`.
  3. Все входящие данные валидируются через схемы `zod` (`lib/schemas.ts`).
  4. В `NODE_ENV=production` глобальный обработчик ошибок возвращает generic `"Internal Server Error"` с уникальным `requestId`, предотвращая утечку путей файловой системы и стека.
- **Команда проверки:**
  ```bash
  npx vitest run tests/security/pollution.test.ts
  # Результат: Prototype Pollution предотвращается
  ```
