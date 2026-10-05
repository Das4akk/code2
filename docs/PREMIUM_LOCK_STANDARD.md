# Стандарт оформления Premium-ограничений в COWIO

## Когда применять
Каждый раз, когда функция должна быть доступна только Premium-пользователям.

## Визуал (ОБЯЗАТЕЛЬНО использовать)
Все закрытые функции оформляются ЕДИНООБРАЗНО:

- **Полупрозрачный блюр** поверх элемента: 
  `background: rgba(6, 6, 9, 0.55); backdrop-filter: blur(14px) saturate(180%)`.
- **Анимированный эмодзи замка** 🔒 — покачивание ±8° каждые 2 секунды.
- **Жирный текст** `font-weight: 700`, белый, с тенью:
  "Доступно с COWIO Premium".

## Как применить (3 шага)

### Шаг 1. Обернуть элемент
HTML:
```html
<div class="premium-locked-wrapper" data-feature="имя-функции">
  <button id="...">...</button>
</div>
```

### Шаг 2. Применить оверлей в JS
```javascript
PremiumManager.applyLockUI('имя-функции');
```

### Шаг 3. Проверка в обработчике (защита от F12)
```javascript
if (!PremiumManager.isCurrentUserPremium()) {
  PremiumManager.showPremiumLock('имя-функции');
  return;
}
```

## CSS-классы (готовые, находятся в css/premium-lock.css)
- `.premium-locked-wrapper` — обёртка (`position: relative;`).
- `.premium-lock-overlay` — оверлей с блюром и frosted-glass эффектом.
- `.premium-lock-overlay.premium-lock-small` — для компактных элементов/кнопок.
- `.premium-lock-inner` — контейнер содержимого замка.
- `.premium-lock-emoji` — анимированный замок (keyframe bounce).
- `.premium-lock-text` — жирный текст с тенью.
- `.premium-lock-modal` — модальное окно (при клике).

## Что НЕ менять
- Не удалять существующий элемент.
- Не менять его размер и позицию.
- Не ломать функционал для Premium-пользователей.
- Premium-пользователь видит элемент БЕЗ оверлея и БЕЗ изменений.

## Защита на сервере (обязательно!)
Клиентский readOnly/disabled можно обойти через консоль F12. Любая Premium-функция, которая меняет данные, ДОЛЖНА проверять premium и на сервере (API или Firebase Rules).

Пример проверки в API:
```javascript
const premiumSnap = await admin.database()
  .ref(`users/${uid}/profile/premium`).once('value');
const premium = premiumSnap.val();
const isPremium = typeof premium === 'boolean' 
  ? premium 
  : (premium?.active !== false && (!premium?.expiresAt || premium.expiresAt > Date.now()));
if (!isPremium) return res.status(403).json({ error: 'Premium required' });
```

Пример правила Firebase:
```json
"videoUrl": {
  ".write": "auth != null && (root.child('users').child(auth.uid).child('profile').child('premium').val() === true || root.child('admins').child(auth.uid).exists())"
}
```

## Примеры
- Кнопка "Создать комнату" → `data-feature="create-room"`.
- Поле ссылки VK Video → `data-feature="vk-link-edit"`.
- Поле массовой выдачи бейджей → `data-feature="bulk-badges"`.
- Добавление видео в библиотеку → `data-feature="lib-add-video"`.
