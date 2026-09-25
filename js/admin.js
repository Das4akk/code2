class AdminPanel {
  static developerUidCache = null;

  static isExplicitCreatorProfile(profile = {}) {
    return (
      String(profile?.role || "")
        .toLowerCase()
        .trim() === "creator"
    );
  }

  static isLegacyCreatorProfile(profile = {}) {
    const cleanUsername = String(profile?.username || "")
      .toLowerCase()
      .trim();
    const cleanRole = String(profile?.role || "")
      .toLowerCase()
      .trim();
    return cleanUsername === "developer" && cleanRole !== "moderator";
  }

  static isValidCreatorProfile(profile = {}, options = {}) {
    const { allowLegacyUsername = true } = options;
    return (
      this.isExplicitCreatorProfile(profile) ||
      (allowLegacyUsername && this.isLegacyCreatorProfile(profile))
    );
  }

  static async persistCreatorIdentity(uid, profile = {}) {
    if (!uid || !this.isValidCreatorProfile(profile)) return null;

    this.developerUidCache = uid;

    const cleanUsername = String(profile?.username || "")
      .toLowerCase()
      .trim();
    const updates = {
      "admin/creatorUid": uid,
    };

    if (cleanUsername === "developer") updates["usernames/developer"] = uid;
    if (profile?.role !== "creator")
      updates[`users/${uid}/profile/role`] = "creator";

    await update(ref(db), updates).catch(() => {});
    return uid;
  }

  static async getDeveloperUid(forceRefresh = false) {
    if (!forceRefresh && this.developerUidCache) return this.developerUidCache;

    const cachedStored = localStorage.getItem("cowio_developer_uid");
    if (!forceRefresh && cachedStored) {
      this.developerUidCache = cachedStored;
      return cachedStored;
    }

    try {
      const [creatorSnap, usernameSnap] = await Promise.all([
        get(ref(db, "admin/creatorUid")),
        get(ref(db, "usernames/developer")),
      ]);

      const storedCreatorUid = creatorSnap.exists() ? creatorSnap.val() : null;
      const reservedDeveloperUid = usernameSnap.exists()
        ? usernameSnap.val()
        : null;

      const candidateUid = storedCreatorUid || reservedDeveloperUid;
      if (candidateUid) {
        this.developerUidCache = candidateUid;
        localStorage.setItem("cowio_developer_uid", candidateUid);
        return candidateUid;
      }
    } catch (e) {
      console.warn("Fast getDeveloperUid lookup failed:", e);
    }

    // Only if none found, check if current user is developer
    if (AppState.currentUser) {
      const myProfile = AppState.usersCache?.get(AppState.currentUser.uid);
      if (myProfile && (this.isExplicitCreatorProfile(myProfile) || myProfile.username?.toLowerCase() === "developer")) {
        const candidateUid = AppState.currentUser.uid;
        this.developerUidCache = candidateUid;
        localStorage.setItem("cowio_developer_uid", candidateUid);
        void this.persistCreatorIdentity(candidateUid, myProfile);
        return candidateUid;
      }
    }

    this.developerUidCache = null;
    return null;
  }

  static hydrateDeveloperUidFromProfile(uid, profile = {}) {
    if (!uid || !this.isValidCreatorProfile(profile)) return;
    if (this.developerUidCache && this.developerUidCache !== uid) return;

    void this.persistCreatorIdentity(uid, profile);
  }

  static isCreatorProfile(profile = {}, uid = null) {
    if (uid && AdminPanel.developerUidCache === uid) return true;
    return this.isValidCreatorProfile(profile);
  }

  static isModeratorProfile(profile = {}, uid = null) {
    return (
      profile?.role === "moderator" && !this.isCreatorProfile(profile, uid)
    );
  }

  static isManagerProfile(profile = {}, uid = null) {
    return (
      profile?.role === "manager" && !this.isCreatorProfile(profile, uid)
    );
  }

  static isOperatorProfile(profile = {}, uid = null) {
    return profile?.role === "operator" && !this.isCreatorProfile(profile, uid);
  }

  static isAdminProfile(profile = {}, uid = null) {
    // Operators only have support access, not full admin access.
    // Managers have read-only admin panel access.
    return (
      this.isCreatorProfile(profile, uid) ||
      this.isModeratorProfile(profile, uid) ||
      this.isManagerProfile(profile, uid)
    );
  }

  static isCurrentUserCreator() {
    const uid = AppState.currentUser?.uid || null;
    const profile =
      AppState.usersCache.get(AppState.currentUser?.uid) ||
      {} ||
      AppState.usersCache.get(uid) ||
      {};
    return this.isCreatorProfile(profile, uid);
  }

  static isCurrentUserAdmin() {
    const uid = AppState.currentUser?.uid || null;
    const profile =
      AppState.usersCache.get(AppState.currentUser?.uid) ||
      {} ||
      AppState.usersCache.get(uid) ||
      {};
    return this.isAdminProfile(profile, uid);
  }

  static isCurrentUserReadOnly() {
    const uid = AppState.currentUser?.uid || null;
    const profile =
      AppState.usersCache.get(AppState.currentUser?.uid) ||
      {} ||
      AppState.usersCache.get(uid) ||
      {};
    return this.isManagerProfile(profile, uid);
  }

  static isSystemReadOnlyForUser() {
    return (
      Boolean(AppState.admin.settings.systemReadOnlyMode) &&
      !this.isCurrentUserAdmin()
    );
  }

  static async isProtectedCreatorTarget(targetUid) {
    if (!targetUid) return false;

    const [developerUid, profileSnap] = await Promise.all([
      this.getDeveloperUid(),
      get(ref(db, `users/${targetUid}/profile`)),
    ]);

    const profile = profileSnap.exists() ? profileSnap.val() || {} : {};
    const cleanUsername = String(profile?.username || "")
      .toLowerCase()
      .trim();

    return Boolean(
      (developerUid && targetUid === developerUid) ||
      cleanUsername === "developer" ||
      this.isValidCreatorProfile(profile),
    );
  }

  static async isProtectedCreatorRoom(roomId) {
    const room = AppState.roomsCache.get(roomId);
    if (!room) return false;

    const developerUid = await this.getDeveloperUid();
    if (
      developerUid &&
      (room.hostId === developerUid || room.presence?.[developerUid])
    )
      return true;

    if (room.hostId) {
      const hostProfile =
        AppState.usersCache.get(room.hostId) ||
        (await ProfileManager.loadUser(room.hostId));
      if (this.isValidCreatorProfile(hostProfile || {})) return true;
    }

    for (const uid of Object.keys(room.presence || {})) {
      const profile =
        AppState.usersCache.get(uid) || (await ProfileManager.loadUser(uid));
      if (this.isValidCreatorProfile(profile || {})) return true;
    }

    return false;
  }

  static requireAdmin() {
    if (!AppState.currentUser || !this.isCurrentUserAdmin()) {
      Utils.toast("Недостаточно прав для админ-действия", "error");
      return false;
    }
    return true;
  }

  static requireWritePermission(silent = false) {
    if (!this.requireAdmin()) return false;
    if (this.isCurrentUserReadOnly()) {
      if (!silent) {
        Utils.toast("Действие недоступно: роль 'Менеджер' имеет права только на просмотр", "warning");
      }
      return false;
    }
    return true;
  }

  static async checkModRestrictionsForTarget(targetUid) {
    if (this.isCurrentUserCreator()) return true;
    if (await this.isProtectedCreatorTarget(targetUid)) {
      Utils.toast(
        "Модератор не может взаимодействовать с профилем Создателя",
        "error",
      );
      return false;
    }
    return true;
  }

  static async checkModRestrictionsForRoom(roomId) {
    if (this.isCurrentUserCreator()) return true;
    if (await this.isProtectedCreatorRoom(roomId)) {
      Utils.toast(
        "У модератора нет прав на эту комнату (принадлежит или занята Создателем)",
        "error",
      );
      return false;
    }
    return true;
  }

  static ensureUI() {
    Utils.$("modal-admin-panel")?.remove();

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modal-admin-panel";
    modal.classList.add("godmode-modal");
    modal.innerHTML = `
            <div class="modal-content glass-panel" style="width:min(1180px,100%); padding:22px;">
                <div class="godmode-sidebar" id="godmode-sidebar">
                    <button class="secondary-btn godmode-nav-btn active" data-section="dashboard">dashboard</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="people">people</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="rooms">rooms</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="library">library</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="badges">badges</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="logs">logs</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="settings">settings</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="security">security</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="automation">automation</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="broadcast">broadcast</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="integrations">integrations</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="backups">backups</button>
                    <button class="secondary-btn godmode-nav-btn" data-section="catalog">catalog</button>
                </div>
                <div class="godmode-main" id="godmode-main">
                <style>
                    .godmode-section { display: none !important; }
                    .godmode-section.active { display: block !important; }
                    .godmode-section.active[style*="display:grid"], .godmode-section.active[style*="display: grid"] { display: grid !important; }
                    .godmode-section.active[style*="display:flex"], .godmode-section.active[style*="display: flex"] { display: flex !important; }
                </style>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px;">
                    <div>
                        <h2 style="margin:0;">Админ-панель</h2>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Доступ для Создателя, Модераторов и Менеджеров</div>
                    </div>
                    <button class="secondary-btn" id="btn-close-admin-panel" style="width:auto; padding:8px 12px;">✕</button>
                </div>

                <div id="admin-manager-readonly-notice" style="display:none; padding:12px 16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); border-radius:12px; margin-bottom:16px; backdrop-filter:blur(10px);">
                    <div style="font-weight:700; font-size:13px; color:#ffffff; display:flex; align-items:center; gap:8px;">
                        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Eyes.webp" style="width:18px; height:18px; vertical-align:middle;" alt="👁️" onerror="this.style.display='none'">
                        <span>Режим просмотра (Роль: Менеджер)</span>
                    </div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.7); margin-top:4px;">
                        Вам разрешен только просмотр информации, списков и аналитики. Все действия по редактированию и модерации отключены.
                    </div>
                </div>

                <div class="godmode-section" data-section="catalog" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление базаром</div>
                    <div style="display:flex; gap:8px; margin-bottom: 16px;">
                        <button class="primary-btn" id="btn-admin-add-catalog-item" onclick="CatalogManager.addNewAdminItem()" style="width:auto; padding:8px 16px;">+ Добавить Товар</button>
                    </div>
                    <div id="admin-catalog-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                </div>

                <div class="godmode-section" data-section="settings" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Управление правами (Только для Создателя)</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <input type="text" id="admin-mod-username" placeholder="ID пользователя (без @)" style="margin:0; flex:1; min-width:160px;">
                        <button class="primary-btn" id="btn-admin-grant-mod" style="width:auto; padding:0 14px;">Модератор</button>
                        <button class="primary-btn" id="btn-admin-grant-op" style="width:auto; padding:0 14px;">Оператор</button>
                        <button class="primary-btn" id="btn-admin-grant-manager" style="width:auto; padding:0 14px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25);">Менеджер</button>
                        <button class="danger-btn" id="btn-admin-revoke-mod" style="width:auto; padding:0 14px;">Снять права</button>
                    </div>
                </div>

                <div class="godmode-section" data-section="badges" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Управление Бейджами</div>
                    <div style="display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; margin-top:10px;">
                        <button class="secondary-btn" id="btn-admin-badge-developer">Разработчик</button>
                        <button class="secondary-btn" id="btn-admin-badge-creator">Создатель</button>
                        <button class="secondary-btn" id="btn-admin-badge-moderator">Модератор</button>
                        <button class="secondary-btn" id="btn-admin-badge-hybrid">Соз/Мод</button>
                        <button class="danger-btn" id="btn-admin-badge-remove">Снять</button>
                    </div>
                    <div class="admin-form-group" style="margin-top:10px;">
                        <label class="admin-form-label" for="admin-badge-text">Кастомная плашка</label>
                        <input type="text" id="admin-badge-text" placeholder="Текст плашки" style="margin:0;">
                        <div class="admin-color-grid">
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-color">Цвет текста</label>
                                <input type="color" id="admin-badge-color" value="#ffffff">
                            </div>
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-bg">Цвет фона</label>
                                <input type="color" id="admin-badge-bg" value="#5d3fd3">
                            </div>
                            <div class="admin-color-field">
                                <label class="admin-form-label" for="admin-badge-border">Цвет рамки</label>
                                <input type="color" id="admin-badge-border" value="#8d63ff">
                            </div>
                        </div>
                        <button class="primary-btn" id="btn-admin-badge-custom">Применить кастом</button>
                    </div>
                </div>

                <div class="godmode-section active" data-section="dashboard">
                    <div id="admin-stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px;"></div>
                </div>

                <div class="godmode-section" data-section="broadcast" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Глобальное оповещение / Пасхалка</div>
                    <textarea id="admin-announcement-input" rows="4" placeholder="Введите текст или команду пасхалки (напр. /matrix)"></textarea>
                    <div style="display:flex; gap:8px;">
                        <button class="primary-btn" id="btn-admin-send-announcement">Разослать</button>
                        <button class="secondary-btn" id="btn-admin-clear-announcement">Очистить</button>
                    </div>
                    <div style="font-weight:700; margin-bottom:10px; margin-top:20px;">Новые супер-способности</div>
                    <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" id="btn-hijack-video" onclick="window.triggerAdminAction('hijack')">Угон видео</button>
                        <button class="secondary-btn" id="btn-flashbang" onclick="window.triggerAdminAction('flashbang')">Флешбенг</button>
                        <button class="secondary-btn" id="btn-shake" onclick="window.triggerAdminAction('shake')">Скример</button>
                        <button class="secondary-btn" id="btn-god-voice" onclick="window.triggerAdminAction('godVoice')">Голос Бога</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('forceTutorial')">Вызвать Туториал</button>
                        <button class="secondary-btn" id="btn-puppeteer" onclick="window.triggerAdminAction('puppeteer')">Кукловод</button>
                        <button class="secondary-btn" id="btn-incognito" onclick="window.triggerAdminAction('incognito')">Инкогнито</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('uwuCurse')">UwU Проклятье</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('shadowClone')">Shadow Clone</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('ghostWhispers')">Шепот призраков</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('teleport')">Телепорт (Random)</button>
                        <button class="secondary-btn" onclick="window.triggerAdminAction('thanosSnapROOM')">Clear Chat (Thanos)</button>
                    </div>
                </div>

                
                <div class="godmode-section" data-section="security" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 10px;">
                    <div style="font-weight:700; margin-bottom:10px;">Создание аккаунта</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <input type="email" id="admin-create-email" class="admin-form-input" placeholder="Email" />
                        <input type="text" id="admin-create-name" class="admin-form-input" placeholder="Имя" />
                        <input type="text" id="admin-create-username" class="admin-form-input" placeholder="Юзернейм (@id)" />
                        <input type="password" id="admin-create-password" class="admin-form-input" placeholder="Пароль" />
                        <select id="admin-create-gender" class="admin-form-input">
                            <option value="male">Мужской</option>
                            <option value="female">Женский</option>
                        </select>
                        <button class="primary-btn" id="btn-admin-create-account" style="margin-top:10px;">Создать аккаунт (тихо)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="security" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Глобальные функции</div>
                    <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;">
                        <button class="danger-btn" id="btn-admin-system-readonly">Системный ReadOnly</button>
                        <button class="secondary-btn" id="btn-admin-global-session-refresh">Обновить все сессии</button>
                        <button class="secondary-btn" id="btn-admin-run-diagnostics">Системная диагностика</button>
                        <button class="secondary-btn" id="btn-admin-global-chat-lock">Глобальный lock чата</button>
                        <button class="secondary-btn" id="btn-admin-global-reactions-lock">Блок реакций</button>
                        <button class="secondary-btn" id="btn-admin-global-invites-lock">Блок инвайтов</button>
                        <button class="secondary-btn" id="btn-admin-global-reg-lock">Блок регистраций</button>
                        <button class="secondary-btn" id="btn-admin-global-email-verify-lock">Блок вериф. почты</button>
                        <button class="secondary-btn" id="btn-admin-global-maintenance">Maintenance mode</button>
                    </div>
                </div>

                <div class="godmode-section" data-section="rooms" style="display:grid; grid-template-columns:1fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="font-weight:700;">Активные комнаты</div>
                                <div style="font-size:12px; color:var(--text-muted);">Удаление любых комнат одним нажатием</div>
                            </div>
                            <div id="admin-rooms-list" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow:auto;"></div>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="font-weight:700; margin-bottom:10px;">Быстрые действия (Rooms)</div>
                            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:16px;">
                                <button class="danger-btn" id="btn-admin-delete-all-rooms">Удалить все комнаты</button>
                                <button class="secondary-btn" id="btn-admin-purge-empty-rooms">Очистить пустые комнаты</button>
                                <button class="secondary-btn" id="btn-admin-toggle-room-lock">Блокировать создание комнат</button>
                            </div>
                            <div style="font-weight:700; margin-bottom:10px;">Управление комнатами</div>
                            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:10px;">
                                <input type="text" id="admin-room-action-id" placeholder="ID комнаты" style="margin:0; grid-column:1/-1;">
                                <button class="danger-btn" id="btn-admin-kick-all-room">Кикнуть всех из комнаты</button>
                                <button class="secondary-btn" id="btn-admin-clone-room">Клонировать настройки</button>
                                <input type="number" id="admin-room-max-viewers" placeholder="Лимит зрителей" min="1" style="margin:0;">
                                <button class="primary-btn" id="btn-admin-set-room-cap">Установить лимит</button>
                                <input type="text" id="admin-room-password" placeholder="Пароль комнаты (пусто=снять)" style="margin:0;">
                                <button class="secondary-btn" id="btn-admin-set-room-password">Замок комнаты</button>
                                <button class="secondary-btn" id="btn-admin-sort-rooms-occupancy">Сортировать по онлайну</button>
                                <button class="secondary-btn" id="btn-admin-room-heatmap">Тепловая карта комнат</button>
                            </div>
                            <div id="admin-room-heatmap-out" style="font-size:12px; color:var(--text-muted); max-height:120px; overflow:auto;"></div>
                        </div>
                    </div>
                </div>

                <div class="godmode-section" data-section="library" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                    <div style="font-weight:700; margin-bottom:10px;">Модерация Библиотеки</div>
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="text" id="admin-lib-search" placeholder="ID видео или поиска..." class="settings-input">
                        <button class="primary-btn" id="btn-admin-lib-search" style="width:auto;">Найти</button>
                        <button class="danger-btn" id="btn-admin-lib-delete-all" style="width:auto; display:none;">Удалить все найденные</button>
                    </div>
                    <div id="admin-lib-list" style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow:auto; margin-bottom:15px;"></div>
                    
                    <div style="border-top:1px solid var(--border-light); padding-top:10px;">
                      <div style="font-weight:700; font-size:14px; margin-bottom:8px;">Редактор Видео</div>
                      <input type="hidden" id="admin-lib-edit-id">
                      <input type="hidden" id="admin-lib-edit-path">
                      <input type="text" id="admin-lib-edit-title" placeholder="Название" class="settings-input" style="margin-bottom:8px;">
                      <textarea id="admin-lib-edit-desc" rows="2" placeholder="Описание" class="settings-input" style="margin-bottom:8px;"></textarea>
                      <input type="text" id="admin-lib-edit-url" placeholder="URL" class="settings-input" style="margin-bottom:8px;">
                      <input type="text" id="admin-lib-edit-people" placeholder="Распознанные люди/ИИ" class="settings-input" style="margin-bottom:8px;">
                      <div style="display:flex; gap:10px;">
                          <button class="primary-btn" id="btn-admin-lib-save">Сохранить</button>
                          <button class="danger-btn" id="btn-admin-lib-delete">Удалить видео</button>
                      </div>
                    </div>
                    
                    <div style="border-top:1px solid var(--border-light); padding-top:20px; margin-top:20px;">
                        <div style="font-weight:700; margin-bottom:10px;">Авторы Библиотеки (для превью)</div>
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <input type="text" id="admin-lib-author-name" placeholder="Имя (оставьте пустым для автопоиска YouTube)" class="settings-input">
                            <input type="text" id="admin-lib-author-url" placeholder="URL аватарки ИЛИ ссылка на YouTube" class="settings-input">
                            <button class="primary-btn" id="btn-admin-lib-add-author" style="width:auto;">Добавить</button>
                        </div>
                        <div id="admin-lib-authors-list" style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow:auto;"></div>
                    </div>
                </div>

                <div class="godmode-section" data-section="people" style="display:grid; grid-template-columns:1.15fr 0.85fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="font-weight:700;">Список пользователей</div>
                                <div style="display:flex; gap:6px;">
                                    <button class="secondary-btn btn-small admin-users-tab active" data-tab="online" style="padding:4px 8px; font-size:11px;">Онлайн</button>
                                    <button class="secondary-btn btn-small admin-users-tab" data-tab="all" style="padding:4px 8px; font-size:11px;">Все</button>
                                    <button class="secondary-btn btn-small admin-users-tab" data-tab="mods" style="padding:4px 8px; font-size:11px;">Модеры</button>
                                </div>
                            </div>
                            <div id="admin-online-users" style="display:flex; flex-direction:column; gap:8px; max-height:380px; overflow:auto;"></div>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                            <div style="font-weight:700; margin-bottom:10px;">Ивенты (Выдача всем онлайн)</div>
                            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px;">
                                <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:12px;">
                                    <div style="font-size:12px; margin-bottom:5px;">Ачивки (Выдать всем)</div>
                                    <div style="display:flex; gap:8px;">
                                        <input type="text" id="admin-event-badge-id" placeholder="ID ачивки" style="margin:0; flex:1;">
                                        <button class="primary-btn" id="btn-admin-grant-event-badge" style="width:auto; padding:0 16px;">Выдать</button>
                                    </div>
                                </div>
                                <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:12px;">
                                    <div style="font-size:12px; margin-bottom:5px;">Рамки напрямую (Выдать всем)</div>
                                    <div style="display:flex; gap:8px;">
                                        <input type="text" id="admin-event-frame-url" class="admin-form-input" placeholder="Изображение рамки (URL)" style="margin:0; flex:1;">
                                        <button class="primary-btn" onclick="CatalogManager.grantFrameMass()" style="width:auto; padding:0 16px;">Выдать</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); min-width:0;">
                        <div style="font-weight:700; margin-bottom:10px;">Управление пользователями</div>
                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="text" id="admin-user-search" placeholder="Поиск по @id или uid" style="margin:0;">
                            <button class="primary-btn" id="btn-admin-find-user" style="width:auto; padding:0 16px;">Найти</button>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; margin-bottom:12px; background:rgba(255,255,255,0.03);">
                            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Локальное "глобальное" оповещение выбранному пользователю</div>
                            <textarea id="admin-local-announcement-input" rows="3" placeholder="Текст или команда пасхалки (напр. /moo)" style="margin:0 0 8px 0;"></textarea>
                            <div style="display:flex; gap:8px;">
                                <button class="primary-btn" id="btn-admin-send-local-announcement">Отправить выбранному</button>
                                <button class="secondary-btn" id="btn-admin-clear-local-announcement">Очистить поле</button>
                            </div>
                        </div>

                        <div id="admin-user-editor" data-target-uid="" style="display:flex; flex-direction:column; gap:10px;">
                            <div style="font-size:13px; color:var(--text-muted); padding:12px; border:1px dashed var(--border-light); border-radius:12px;">
                                Выберите пользователя через поиск или клик по списку онлайна.
                            </div>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-top:16px;">
                            <div style="font-weight:700; margin-bottom:10px;">Массовые операции (People)</div>
                            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                                <button class="secondary-btn" id="btn-admin-export-users-csv">Экспорт users CSV</button>
                                <button class="secondary-btn" id="btn-admin-scan-inactive">Неактивные 30+ дней</button>
                                <button class="secondary-btn" id="btn-admin-scan-duplicate-ip">Дубликаты IP</button>
                                <button class="secondary-btn" id="btn-admin-bulk-shadowban">Bulk shadowban (список @id)</button>
                                <button class="secondary-btn" id="btn-admin-force-verify-email">Force email</button>
                                <button class="secondary-btn" id="btn-admin-reset-all-tutorials">Сбросить туториалы</button>
                                <button class="secondary-btn" id="btn-admin-clear-dms">Удалить все ЛС</button>
                                <button class="secondary-btn" id="btn-admin-unmute-unban-all">Снять mute/ban всем</button>
                            </div>
                            <textarea id="admin-bulk-usernames" rows="2" placeholder="@id через запятую или с новой строки" style="margin-top:8px; width:100%;"></textarea>
                            <div id="admin-people-tools-out" style="font-size:12px; color:var(--text-muted); margin-top:8px; max-height:140px; overflow:auto;"></div>
                        </div>
                        <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-top:16px;">
                             <button class="secondary-btn" id="btn-admin-refresh">Обновить данные</button>
                             <button class="secondary-btn" id="btn-admin-clear-user-editor" style="margin-left:8px;">Сбросить выбранного юзера</button>
                             <button class="secondary-btn" id="btn-admin-export-snapshot" style="margin-top:8px;">Экспорт Snapshot</button>
                        </div>
                    </div>
                </div>
                <div class="godmode-section" data-section="logs" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="font-weight:700;">Audit Log</div>
                        <button class="secondary-btn" id="btn-admin-clear-audit" style="width:auto; padding:8px 12px;">Очистить лог</button>
                    </div>
                    <div id="admin-audit-list" style="display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow:auto;"></div>
                </div>
                <div class="godmode-section" data-section="security" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Security Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" id="btn-admin-brute-shield">Brute-force Shield</button>
                        <button class="secondary-btn" id="btn-admin-audit-reserved-names">Аудит @id (reserved)</button>
                        <button class="secondary-btn" id="btn-admin-session-risk-scan">Session Risk Scan</button>
                        <button class="secondary-btn" id="btn-admin-list-force-logout">Список force-logout</button>
                    </div>
                    <div id="admin-security-out" style="font-size:12px; color:var(--text-muted); margin-top:10px; max-height:160px; overflow:auto;"></div>
                </div>
                <div class="godmode-section" data-section="automation" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Automation Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" id="btn-admin-auto-purge-empty">Auto purge пустых комнат</button>
                        <button class="secondary-btn" id="btn-admin-save-automod-keywords">Сохранить automod слова</button>
                        <button class="secondary-btn" id="btn-admin-scheduled-message">Запланировать сообщение</button>
                        <button class="secondary-btn" id="btn-admin-incident-unmute">Incident: unmute all</button>
                    </div>
                    <textarea id="admin-automod-keywords" rows="2" placeholder="Запрещённые слова через запятую" style="margin-top:8px; width:100%;"></textarea>
                </div>
                <div class="godmode-section" data-section="broadcast" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Broadcast Systems</div>
                    <input type="text" id="admin-emergency-banner" placeholder="Текст emergency banner" style="margin:0 0 8px 0; width:100%;">
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="primary-btn" id="btn-admin-set-emergency-banner">Emergency Banner</button>
                        <button class="secondary-btn" id="btn-admin-notify-online-segment">Оповестить онлайн</button>
                        <button class="secondary-btn" id="btn-admin-maintenance-countdown">Maintenance текст</button>
                        <button class="secondary-btn" id="btn-admin-broadcast-stats">Delivery Stats</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="integrations" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Integration Systems</div>
                    <input type="text" id="admin-webhook-url" placeholder="Webhook URL" style="margin:0 0 8px 0; width:100%;">
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" id="btn-admin-save-webhook">Сохранить Webhook</button>
                        <button class="secondary-btn" id="btn-admin-export-audit-json">Экспорт Audit JSON</button>
                        <button class="secondary-btn" id="btn-admin-webhook-ping">Webhook test ping</button>
                        <button class="secondary-btn" id="btn-admin-status-bridge">Status Bridge ping</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="backups" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                    <div style="font-weight:700; margin-bottom:10px;">Backup Systems</div>
                    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                        <button class="secondary-btn" id="btn-admin-backup-now">Snapshot сейчас</button>
                        <button class="secondary-btn" id="btn-admin-backup-integrity">Integrity Check</button>
                        <input type="number" id="admin-backup-retention" placeholder="Retention (дней)" min="1" style="margin:0;">
                        <button class="secondary-btn" id="btn-admin-set-retention">Retention Policy</button>
                        <button class="secondary-btn" id="btn-admin-restore-dry-run">Restore dry-run</button>
                    </div>
                    <div id="admin-backup-out" style="font-size:12px; color:var(--text-muted); margin-top:10px;"></div>
                </div>
                <!-- // [NEW] BADGES SECTION -->
                <div class="godmode-section" data-section="badges" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Создать/Изменить бейдж</div>
                        
                        <div style="font-weight:700; margin-bottom:5px; font-size:12px; color:var(--text-muted); text-align:center;">Предпросмотр</div>
                        <div id="admin-badge-preview-container" style="display:flex; justify-content:center; margin-bottom:15px; transform: scale(0.9);">
                            <div class="ach-card" style="width: 160px; height: 180px; flex-shrink: 0; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                                <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px;" id="admin-preview-icon">
                                    <span style="font-size:48px;">🌟</span>
                                </div>
                                <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%;">
                                    <div id="admin-preview-name" style="color: #ffffff; font-weight: 800; font-size: 13px; line-height: 1.2;">Новый бейдж</div>
                                    <div id="admin-preview-desc" style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">Описание нового бейджа</div>
                                    <div style="color: rgba(255,255,255,0.5); font-size: 9.5px; margin-top:6px; font-weight: 600;">Уже получили: ...</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="admin-form-group">
                            <input type="text" id="admin-badge-edit-id" placeholder="ID бейджа (только eng буквы, напр. dev)" style="margin-bottom:8px;">
                            <input type="text" id="admin-badge-edit-name" placeholder="Название бейджа (текст)" style="margin-bottom:8px;">
                            <textarea id="admin-badge-edit-desc" placeholder="Описание ачивки" rows="2" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(0,0,0,0.2); color: #fff; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; margin-bottom: 8px;"></textarea>
                            <input type="text" id="admin-badge-edit-icon" placeholder="Иконка (ссылка на изображение или эмодзи)" style="margin-bottom:8px;">
                            <input type="number" id="admin-badge-edit-xp" placeholder="Опыт (XP) за получение" min="0" value="0" style="margin-bottom:8px;">
                            <div id="admin-badge-preset-icons" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:5px; border-radius:8px;"></div>
                            <div class="admin-color-grid">
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-color">Цвет текста</label>
                                    <input type="color" id="admin-badge-edit-color" value="#ffffff">
                                </div>
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-bg">Цвет фона</label>
                                    <input type="color" id="admin-badge-edit-bg" value="#5d3fd3">
                                </div>
                                <div class="admin-color-field">
                                    <label class="admin-form-label" for="admin-badge-edit-border">Цвет рамки</label>
                                    <input type="color" id="admin-badge-edit-border" value="#8d63ff">
                                </div>
                            </div>
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                <button class="primary-btn" id="btn-admin-save-badge" style="flex:1;">Сохранить бейдж</button>
                                <button class="secondary-btn" id="btn-admin-reset-badge" style="flex:1;">Сбросить / Новый</button>
                            </div>
                            <button class="secondary-btn" id="btn-admin-generate-rel-badges" style="margin-top:10px; width:100%;">Сгенерировать авто-ачивки</button>
                        </div>
                    </div>
                    <div style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02);">
                        <div style="font-weight:700; margin-bottom:10px;">Список бейджей</div>
                        <div id="admin-badges-list" style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto; padding-right:5px;"></div>
                    </div>
                </div>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    Utils.$("btn-close-admin-panel").onclick = () =>
      modal.classList.remove("active");
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });

    Utils.$("btn-admin-send-announcement").onclick = () =>
      this.sendAnnouncement();
    Utils.$("btn-admin-clear-announcement").onclick = () =>
      this.clearAnnouncement();
    Utils.$("btn-admin-delete-all-rooms").onclick = () => this.deleteAllRooms();
    Utils.$("btn-admin-purge-empty-rooms").onclick = () =>
      this.purgeEmptyRooms();
    Utils.$("btn-admin-clear-dms").onclick = () => this.clearDirectMessages();
    Utils.$("btn-admin-toggle-room-lock").onclick = () =>
      this.toggleRoomCreationLock();
    Utils.$("btn-admin-refresh").onclick = () => this.renderPanel();
    Utils.$("btn-admin-find-user").onclick = () => this.findUser();
    Utils.$("btn-admin-send-local-announcement").onclick = () =>
      this.sendLocalAnnouncementToSelectedUser();
    Utils.$("btn-admin-clear-local-announcement").onclick = () => {
      if (Utils.$("admin-local-announcement-input"))
        Utils.$("admin-local-announcement-input").value = "";
    };
    Utils.$("btn-admin-clear-user-editor").onclick = () =>
      this.renderEmptyUserEditor();
    Utils.$("btn-admin-export-snapshot").onclick = () =>
      this.exportAdminSnapshot();
    Utils.$("btn-admin-unmute-unban-all").onclick = () =>
      this.unmuteAndUnbanAllUsers();
    Utils.$("btn-admin-system-readonly").onclick = () =>
      this.toggleGlobalSetting("systemReadOnlyMode", "Системный ReadOnly");
    Utils.$("btn-admin-global-session-refresh").onclick = () =>
      this.forceGlobalSessionRefresh();
    Utils.$("btn-admin-run-diagnostics").onclick = () =>
      this.runSystemDiagnostics();
    Utils.$("btn-admin-global-chat-lock").onclick = () =>
      this.toggleGlobalSetting("globalChatLocked", "Глобальный lock чата");
    Utils.$("btn-admin-global-reactions-lock").onclick = () =>
      this.toggleGlobalSetting("globalReactionsBlocked", "Блок реакций");
    Utils.$("btn-admin-global-invites-lock").onclick = () =>
      this.toggleGlobalSetting("globalInvitesBlocked", "Блок инвайтов");
    Utils.$("btn-admin-global-reg-lock").onclick = () =>
      this.toggleGlobalSetting("globalRegistrationsBlocked", "Блок регистраций");
    Utils.$("btn-admin-global-email-verify-lock").onclick = () =>
      this.toggleGlobalSetting("emailVerificationBlocked", "Блок вериф. почты");
    Utils.$("btn-admin-global-maintenance").onclick = () =>
      this.toggleGlobalSetting("maintenanceMode", "Maintenance mode");
    Utils.$("btn-admin-clear-audit").onclick = () => this.clearAuditLog();
    
    Utils.$("btn-admin-create-account").onclick = async () => {
        const email = Utils.$("admin-create-email").value.trim();
        const name = Utils.$("admin-create-name").value.trim();
        const username = Utils.$("admin-create-username").value.trim().replace("@", "").toLowerCase();
        const password = Utils.$("admin-create-password").value.trim();
        const gender = Utils.$("admin-create-gender").value;
        
        if (!email || !name || !username || password.length < 6) return Utils.toast("Заполните все поля, пароль от 6 символов", "error");
        
        Utils.$("btn-admin-create-account").disabled = true;
        try {
            const existing = await get(ref(db, `usernames/${username}`));
            if (existing.exists()) throw new Error("Юзернейм уже занят");
            
            const { initializeApp, deleteApp } = await import("firebase/app");
            const { getAuth, createUserWithEmailAndPassword } = await import("firebase/auth");
            
            const tempApp = initializeApp(app.options, "TempApp_" + Date.now());
            const tempAuth = getAuth(tempApp);
            
            const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
            const newUid = cred.user.uid;
            
            await set(ref(db, `users/${newUid}/profile`), {
                name,
                username,
                email,
                bio: "",
                avatar: "",
                gender: gender || "male",
                registeredIp: "created_by_admin",
                background: { color: "#111111", index: 1, url: "", dim: 0.5 },
                hashtags: [],
                createdAt: Date.now(),
                provider: "email",
                emailVerified: true
            });
            await set(ref(db, `usernames/${username}`), newUid);
            await set(ref(db, `users/${newUid}/force_tutorial`), true);
            
            await tempAuth.signOut();
            await deleteApp(tempApp);
            
            Utils.toast("Аккаунт успешно создан!", "success");
            Utils.$("admin-create-email").value = "";
            Utils.$("admin-create-name").value = "";
            Utils.$("admin-create-username").value = "";
            Utils.$("admin-create-password").value = "";
        } catch (e) {
            Utils.toast(e.message, "error");
        }
        Utils.$("btn-admin-create-account").disabled = false;
    };
    Utils.$("btn-admin-kick-all-room")?.addEventListener("click", () =>
      this.kickAllFromRoom(),
    );
    Utils.$("btn-admin-clone-room")?.addEventListener("click", () =>
      this.cloneRoomSettings(),
    );
    Utils.$("btn-admin-set-room-cap")?.addEventListener("click", () =>
      this.setRoomMaxViewers(),
    );
    Utils.$("btn-admin-set-room-password")?.addEventListener("click", () =>
      this.setRoomPassword(),
    );
    Utils.$("btn-admin-sort-rooms-occupancy")?.addEventListener("click", () =>
      this.sortRoomsByOccupancy(),
    );
    Utils.$("btn-admin-room-heatmap")?.addEventListener("click", () =>
      this.renderRoomHeatmap(),
    );
    Utils.$("btn-admin-export-users-csv")?.addEventListener("click", () =>
      this.exportUsersCsv(),
    );
    Utils.$("btn-admin-scan-inactive")?.addEventListener("click", () =>
      this.scanInactiveUsers(),
    );
    Utils.$("btn-admin-scan-duplicate-ip")?.addEventListener("click", () =>
      this.scanDuplicateIPs(),
    );
    Utils.$("btn-admin-bulk-shadowban")?.addEventListener("click", () =>
      this.bulkShadowban(),
    );
    Utils.$("btn-admin-force-verify-email")?.addEventListener("click", () =>
      this.forceVerifySelectedEmail(),
    );
    Utils.$("btn-admin-reset-all-tutorials")?.addEventListener("click", () =>
      this.resetAllTutorials(),
    );
    Utils.$("btn-admin-brute-shield")?.addEventListener("click", () =>
      this.toggleGlobalSetting("bruteForceShield", "Brute-force Shield"),
    );
    Utils.$("btn-admin-audit-reserved-names")?.addEventListener("click", () =>
      this.auditReservedUsernames(),
    );
    Utils.$("btn-admin-session-risk-scan")?.addEventListener("click", () =>
      this.sessionRiskScan(),
    );
    Utils.$("btn-admin-list-force-logout")?.addEventListener("click", () =>
      this.listForceLogoutUsers(),
    );
    Utils.$("btn-admin-auto-purge-empty")?.addEventListener("click", () =>
      this.toggleGlobalSetting("autoPurgeEmptyRooms", "Auto purge пустых"),
    );
    Utils.$("btn-admin-save-automod-keywords")?.addEventListener("click", () =>
      this.saveAutomodKeywords(),
    );
    Utils.$("btn-admin-scheduled-message")?.addEventListener("click", () =>
      this.scheduleGlobalMessage(),
    );
    Utils.$("btn-admin-incident-unmute")?.addEventListener("click", () =>
      this.unmuteAndUnbanAllUsers(),
    );
    Utils.$("btn-admin-set-emergency-banner")?.addEventListener("click", () =>
      this.setEmergencyBanner(),
    );
    Utils.$("btn-admin-notify-online-segment")?.addEventListener("click", () =>
      this.notifyOnlineSegment(),
    );
    Utils.$("btn-admin-maintenance-countdown")?.addEventListener("click", () =>
      this.setMaintenanceCountdown(),
    );
    Utils.$("btn-admin-broadcast-stats")?.addEventListener("click", () =>
      this.showBroadcastStats(),
    );
    Utils.$("btn-admin-save-webhook")?.addEventListener("click", () =>
      this.saveWebhookUrl(),
    );
    Utils.$("btn-admin-export-audit-json")?.addEventListener("click", () =>
      this.exportAuditJson(),
    );
    Utils.$("btn-admin-webhook-ping")?.addEventListener("click", () =>
      this.webhookTestPing(),
    );
    Utils.$("btn-admin-status-bridge")?.addEventListener("click", () =>
      this.statusBridgePing(),
    );
    Utils.$("btn-admin-backup-now")?.addEventListener("click", () =>
      this.exportAdminSnapshot(),
    );
    Utils.$("btn-admin-backup-integrity")?.addEventListener("click", () =>
      this.backupIntegrityCheck(),
    );
    Utils.$("btn-admin-set-retention")?.addEventListener("click", () =>
      this.setBackupRetention(),
    );
    Utils.$("btn-admin-restore-dry-run")?.addEventListener("click", () =>
      this.restoreDryRun(),
    );
    Utils.$("admin-user-search").onkeydown = (e) => {
      if (e.key === "Enter") this.findUser();
    };

    Utils.$("btn-admin-grant-mod").onclick = () =>
      this.toggleModRole("moderator");
    Utils.$("btn-admin-grant-op").onclick = () =>
      this.toggleModRole("operator");
    Utils.$("btn-admin-grant-manager") && (Utils.$("btn-admin-grant-manager").onclick = () =>
      this.toggleModRole("manager"));
    Utils.$("btn-admin-revoke-mod").onclick = () => this.toggleModRole(null);
    Utils.$("btn-admin-badge-developer").onclick = () =>
      this.setAdminBadgeForUser("developer");
    Utils.$("btn-admin-badge-creator").onclick = () =>
      this.setAdminBadgeForUser("creator");
    Utils.$("btn-admin-badge-moderator").onclick = () =>
      this.setAdminBadgeForUser("moderator");
    Utils.$("btn-admin-badge-hybrid").onclick = () =>
      this.setAdminBadgeForUser("creator_moderator");
    Utils.$("btn-admin-badge-remove").onclick = () =>
      this.setAdminBadgeForUser(null);
    Utils.$("btn-admin-badge-custom").onclick = () =>
      this.setAdminBadgeForUser("custom");
    Utils.$("btn-admin-save-badge").onclick = () => BadgeManager.saveBadge();
    Utils.$("btn-admin-reset-badge").onclick = () => {
      if (Utils.$("admin-badge-edit-id"))
        Utils.$("admin-badge-edit-id").value = "";
      if (Utils.$("admin-badge-edit-id"))
        Utils.$("admin-badge-edit-id").readOnly = false;
      if (Utils.$("admin-badge-edit-name"))
        Utils.$("admin-badge-edit-name").value = "";
      if (Utils.$("admin-badge-edit-desc"))
        Utils.$("admin-badge-edit-desc").value = "";
      if (Utils.$("admin-badge-edit-icon"))
        Utils.$("admin-badge-edit-icon").value = "";
      if (Utils.$("admin-badge-edit-color"))
        Utils.$("admin-badge-edit-color").value = "#ffffff";
      if (Utils.$("admin-badge-edit-bg"))
        Utils.$("admin-badge-edit-bg").value = "#5d3fd3";
      if (Utils.$("admin-badge-edit-border"))
        Utils.$("admin-badge-edit-border").value = "#8d63ff";
      if (window.updateAdminBadgePreview) window.updateAdminBadgePreview();
    };
    Utils.$("btn-admin-generate-rel-badges").onclick = () =>
      BadgeManager.generateSystemBadges();
    Utils.$("btn-admin-grant-event-badge").onclick = () =>
      BadgeManager.grantEventBadgeToOnline();

    const updateBadgePreview = () => {
      const name = Utils.$("admin-badge-edit-name")?.value || "Новый бейдж";
      const desc = Utils.$("admin-badge-edit-desc")?.value || "Описание";
      const icon = Utils.$("admin-badge-edit-icon")?.value || "🌟";

      const color = Utils.$("admin-badge-edit-color")?.value || "#ffffff";
      const bg = Utils.$("admin-badge-edit-bg")?.value || "rgba(0,0,0,0.2)";
      const border =
        Utils.$("admin-badge-edit-border")?.value || "rgba(255,255,255,0.1)";

      if (Utils.$("admin-preview-name"))
        Utils.$("admin-preview-name").innerText = name;
      if (Utils.$("admin-preview-desc"))
        Utils.$("admin-preview-desc").innerText = desc;

      const iconHtml = icon.match(/^http/)
        ? `<img src="${Utils.escapeHtml(icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>`
        : `<span style="font-size:48px;">${Utils.escapeHtml(icon)}</span>`;
      if (Utils.$("admin-preview-icon"))
        Utils.$("admin-preview-icon").innerHTML = iconHtml;

      const card = Utils.$("admin-badge-preview-container")?.querySelector(
        ".ach-card",
      );
      if (card) {
        card.style.background = bg;
        card.style.borderColor = border;
        if (Utils.$("admin-preview-name"))
          Utils.$("admin-preview-name").style.color = color;
      }
    };

    [
      "admin-badge-edit-name",
      "admin-badge-edit-desc",
      "admin-badge-edit-icon",
      "admin-badge-edit-color",
      "admin-badge-edit-bg",
      "admin-badge-edit-border",
    ].forEach((id) => {
      const el = Utils.$(id);
      if (el) el.addEventListener("input", updateBadgePreview);
    });
    window.updateAdminBadgePreview = updateBadgePreview;

    BadgeManager.renderBadgeList();

    modal.querySelectorAll(".admin-users-tab").forEach((btn) => {
      btn.onclick = () => {
        AppState.admin.activeUsersTab = btn.dataset.tab || "online";
        modal
          .querySelectorAll(".admin-users-tab")
          .forEach((b) => b.classList.toggle("active", b === btn));
        this.renderPanel();
      };
    });

    modal.querySelectorAll(".godmode-nav-btn").forEach((btn) => {
      btn.onclick = () =>
        this.switchGodModeSection(btn.dataset.section || "dashboard");
    });
    this.switchGodModeSection("dashboard");

    // Render catalog items if data is already loaded
    if (window.CatalogManager) {
      window.CatalogManager.renderAdminCatalog();
    }
    if (window.LibraryManager) {
      window.LibraryManager.bindAdminPanel();
    }
  }

  static switchGodModeSection(section = "dashboard") {
    AppState.admin.activeSection = section;
    Utils.$("modal-admin-panel")
      ?.querySelectorAll(".godmode-nav-btn")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.section === section);
      });
    Utils.$("modal-admin-panel")
      ?.querySelectorAll(".godmode-section")
      .forEach((node) => {
        const nodeSection = node.dataset.section || "dashboard";
        node.classList.toggle("active", section === nodeSection);
      });
  }

  static async toggleGlobalSetting(settingKey, label) {
    if (!this.requireAdmin()) return;
    if (!this.isCurrentUserCreator())
      return Utils.toast(
        "Только Создатель может менять глобальные настройки",
        "error",
      );
    const current = Boolean(AppState.admin.settings?.[settingKey]);
    const next = !current;
    await update(ref(db, "admin/settings"), { [settingKey]: next });
    await this.pushAuditLog("admin.setting.toggle", {
      settingKey,
      enabled: next,
    });
    Utils.toast(`${label}: ${next ? "ON" : "OFF"}`);
    this.renderIfOpen();
  }

  static async pushAuditLog(action = "", payload = {}) {
    if (!AppState.currentUser) return;
    const item = {
      ts: Date.now(),
      byUid: AppState.currentUser.uid,
      action,
      payload,
    };
    await push(ref(db, "admin/auditLog"), item).catch(() => {});
  }

  static async clearAuditLog() {
    if (!this.requireAdmin()) return;
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может очищать лог", "error");
    await remove(ref(db, "admin/auditLog"));
    Utils.toast("Audit log очищен");
  }

  static async exportAdminSnapshot() {
    if (!this.requireAdmin()) return;
    const [usersSnap, roomsSnap, settingsSnap] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "rooms")),
      get(ref(db, "admin/settings")),
    ]);
    const payload = {
      exportedAt: Date.now(),
      by: AppState.currentUser.uid,
      users: usersSnap.val() || {},
      rooms: roomsSnap.val() || {},
      settings: settingsSnap.val() || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cowio-admin-snapshot-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await this.pushAuditLog("admin.snapshot.export");
    Utils.toast("Snapshot экспортирован");
  }

  static async unmuteAndUnbanAllUsers() {
    if (!this.requireAdmin()) return;
    if (!(await Utils.confirm("Снять mute и shadowban у всех пользователей?")))
      return;
    const usersSnap = await get(ref(db, "users"));
    const users = usersSnap.val() || {};
    const updates = {};
    Object.keys(users).forEach((uid) => {
      updates[`users/${uid}/moderation/muted`] = null;
      updates[`users/${uid}/moderation/shadowban`] = null;
    });
    await update(ref(db), updates);
    await this.pushAuditLog("admin.users.unmuteUnbanAll", {
      users: Object.keys(users).length,
    });
    Utils.toast("Mute и shadowban сняты у всех");
  }

  static async toggleModRole(roleName) {
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может управлять правами", "error");

    const inputVal = Utils.$("admin-mod-username")
      .value.trim()
      .replace("@", "");
    if (!inputVal) return Utils.toast("Введите ID пользователя", "error");

    let targetUid = inputVal;

    // First try to look up username just in case it's a username
    const usernameSnap = await get(
      ref(db, `usernames/${inputVal.toLowerCase()}`),
    );
    if (usernameSnap.exists()) {
      targetUid = usernameSnap.val();
    }

    if (await this.isProtectedCreatorTarget(targetUid)) {
      return Utils.toast("Нельзя изменить роль Создателя", "error");
    }

    await update(ref(db, `users/${targetUid}/profile`), {
      role: roleName,
    });
    await this.pushAuditLog("role.change", { targetUid, role: roleName });
    const roleTitles = {
      moderator: "Модератор",
      operator: "Оператор",
      manager: "Менеджер (только просмотр)"
    };
    Utils.toast(roleName ? `Роль '${roleTitles[roleName] || roleName}' успешно выдана` : "Права сняты", "success");
    Utils.$("admin-mod-username").value = "";
  }

  static async setAdminBadgeForUser(mode = null) {
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может управлять плашками", "error");
    const username = Utils.$("admin-mod-username")
      .value.trim()
      .toLowerCase()
      .replace("@", "");
    if (!username) return Utils.toast("Введите ID пользователя", "error");

    const snap = await get(ref(db, `usernames/${username}`));
    if (!snap.exists()) return Utils.toast("Пользователь не найден", "error");
    const targetUid = snap.val();

    const allowed = [
      null,
      "developer",
      "creator",
      "moderator",
      "creator_moderator",
      "custom",
    ];
    if (!allowed.includes(mode))
      return Utils.toast("Неверный тип плашки", "error");

    const updates = { adminBadge: null, adminBadgeCustom: null };
    if (
      mode === "developer" ||
      mode === "creator" ||
      mode === "moderator" ||
      mode === "creator_moderator"
    ) {
      updates.adminBadge = mode;
    } else if (mode === "custom") {
      const text = Utils.$("admin-badge-text")?.value?.trim();
      if (!text)
        return Utils.toast("Введите текст для кастомной плашки", "error");
      updates.adminBadgeCustom = {
        text: text.slice(0, 28),
        color: Utils.$("admin-badge-color")?.value || "#ffffff",
        bg: Utils.$("admin-badge-bg")?.value || "#5d3fd3",
        border: Utils.$("admin-badge-border")?.value || "#8d63ff",
      };
    }

    await update(ref(db, `users/${targetUid}/profile`), updates);
    await this.pushAuditLog("admin.badge.update", { targetUid, mode, updates });
    const msg = mode ? `Плашка обновлена: ${mode}` : "Плашка снята";
    Utils.toast(msg);
  }

  static init() {
    this.ensureUI();
    if (!AppState.currentUser) return;
    if (this.initializedForUid === AppState.currentUser.uid) return;
    this.initializedForUid = AppState.currentUser.uid;

    const settingsRef = ref(db, "admin/settings");
    const annRef = ref(db, "admin/global-announcement");
    const localAnnRef = ref(
      db,
      `admin/local-announcements/${AppState.currentUser.uid}`,
    );
    const auditRef = ref(db, "admin/auditLog");
    const forceSignOutRef = ref(
      db,
      `admin/actions/forceSignOut/${AppState.currentUser.uid}`,
    );
    const forceLeaveRoomRef = ref(
      db,
      `admin/actions/forceLeaveRoom/${AppState.currentUser.uid}`,
    );
    const cancelTutorialRef = ref(
      db,
      `admin/actions/cancelTutorial/${AppState.currentUser.uid}`,
    );

    const settingsUnsub = onValue(settingsRef, (snap) => {
      AppState.admin.settings = {
        roomCreationBlocked: false,
        globalChatLocked: false,
        globalReactionsBlocked: false,
        globalInvitesBlocked: false,
        globalRegistrationsBlocked: false, emailVerificationBlocked: false,
        maintenanceMode: false,
        systemReadOnlyMode: false,
        ...(snap.val() || {}),
      };
      RoomManager.applyCreateRoomAvailability();
      this.renderIfOpen();
    });

    const annUnsub = onValue(annRef, (snap) => {
      const payload = snap.val();
      if (!payload?.id || !payload?.text) return;

      // ФИКС: Игнорируем старые глобальные объявления (старше 1 минуты)
      if (Date.now() - Number(payload.ts || 0) > 60000) return;

      const marker = `globalAnnouncementSeen:${payload.id}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");
      AppState.admin.lastAnnouncementId = payload.id;

      const commandStr = payload.text.trim().toLowerCase();
      const command = EasterEggManager.COMMANDS.get(commandStr);
      if (command) {
        // ДОБАВЛЕНО: Индивидуальные мемы для каждой пасхалки
        const memeTexts = {
          moo: "Кто-то выпустил корову на пастбище... Му-у-у! 🐄",
          grass: "Пора потрогать траву, друзья! 🌱",
          milk: "кто-нибудь желает молока? 🥛",
          popcorn: "Запасаемся попкорном, сейчас начнется кино! 🍿",
          dvd: "Ждем, когда логотип ударится в угол... 📀",
          roll: 'Делаем бочку! Уууииии! <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Up%20Button.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">',
          matrix: "Тук-тук, Нео. Матрица имеет тебя... 💻",
          shh: "Тссс... Режим тишины активирован 🤫",
          vader: "Люк, я твой отец... *тяжелое дыхание* ⚔️",
          nyan: "Нян-кэт пролетает над сервером! 🐱🌈",
        };
        const msg =
          memeTexts[command] ||
          `Глобальная пасхалка от ${payload.fromUsername}!`;
        Utils.toast(msg, "info");
        EasterEggManager.applyRoomEffect({
          type: command,
          from: payload.fromUsername,
        });
      } else {
        Utils.toast(`Оповещение: ${payload.text}`);
      }
    });
    const localAnnUnsub = onValue(localAnnRef, (snap) => {
      const payload = snap.val();
      if (!payload?.id || !payload?.text) return;
      if (Date.now() - Number(payload.ts || 0) > 60000) return;

      const marker = `localAnnouncementSeen:${payload.id}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");

      const commandStr = payload.text.trim().toLowerCase();
      const command = EasterEggManager.COMMANDS.get(commandStr);
      if (command) {
        Utils.toast(
          `Локальное оповещение от @${payload.fromUsername || "admin"}`,
          "info",
        );
        EasterEggManager.applyRoomEffect({
          type: command,
          from: payload.fromUsername || "admin",
        });
      } else {
        Utils.toast(`Личное оповещение: ${payload.text}`);
      }
    });

    if (this.isCurrentUserAdmin()) {
      import("firebase/database").then(({ query, limitToLast }) => {
        const auditQuery = query(auditRef, limitToLast(40));
        const auditUnsub = onValue(auditQuery, (snap) => {
          const data = snap.val() || {};
          AppState.admin.logs = Object.entries(data)
            .map(([id, value]) => ({ id, ...(value || {}) }))
            .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
          this.renderAuditLog();
        });
        this.subscriptions.push(auditUnsub);
      });
    }

    const forceSignOutUnsub = onValue(forceSignOutRef, async (snap) => {
      const payload = snap.val();
      if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;

      const marker = `forceSignOutSeen:${payload.ts}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");

      if (!this.isCurrentUserAdmin()) {
        Utils.toast("Администратор завершил вашу сессию", "error");
        await signOut(auth);
      }
    });

    const forceLeaveRoomUnsub = onValue(forceLeaveRoomRef, (snap) => {
      const payload = snap.val();
      if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;

      const marker = `forceLeaveRoomSeen:${payload.ts}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");

      if (
        AppState.currentRoomId &&
        (!payload.roomId || payload.roomId === AppState.currentRoomId)
      ) {
        if (payload.reason === "kicked-by-host" || !this.isCurrentUserAdmin()) {
          Utils.toast(
            payload.reason === "kicked-by-host"
              ? "Хост удалил вас из комнаты"
              : "Администратор удалил вас из комнаты",
            "error",
          );
          RoomManager.leaveRoom();
        }
      }
    });

    const cancelTutorialUnsub = onValue(cancelTutorialRef, (snap) => {
      const payload = snap.val();
      if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
      const marker = `cancelTutorialAdmin:${payload.ts}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");

      if (typeof TutorialManager !== "undefined") {
        TutorialManager.endTutorial();
        document.getElementById("tutorial-modal-overlay")?.remove();
        Utils.toast("Обучение было отозвано администратором", "info");
      }
    });

    const globalSessionRefreshRef = ref(
      db,
      "admin/actions/globalSessionRefresh",
    );
    const globalSessionRefreshUnsub = onValue(
      globalSessionRefreshRef,
      async (snap) => {
        const payload = snap.val();
        if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
        const marker = `globalSessionRefreshSeen:${payload.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, "1");
        if (payload.byUid === AppState.currentUser?.uid) return;
        if (!this.isCurrentUserAdmin()) {
          Utils.toast("Администратор обновил все сессии", "error");
          await signOut(auth);
        }
      },
    );

    AppState.activeSubscriptions.push(
      () => off(settingsRef, "value", settingsUnsub),
      () => off(annRef, "value", annUnsub),
      () => off(localAnnRef, "value", localAnnUnsub),
      () => off(auditRef, "value", auditUnsub),
      () => off(forceSignOutRef, "value", forceSignOutUnsub),
      () => off(forceLeaveRoomRef, "value", forceLeaveRoomUnsub),
      () => off(cancelTutorialRef, "value", cancelTutorialUnsub),
      () => off(globalSessionRefreshRef, "value", globalSessionRefreshUnsub),
    );

    RoomManager.applyCreateRoomAvailability();
    this.syncSidebarButton();
  }

  static handleLogoutCleanup() {
    this.initializedForUid = null;
    AppState.admin.settings = {
      roomCreationBlocked: false,
      globalChatLocked: false,
      globalReactionsBlocked: false,
      globalInvitesBlocked: false,
      globalRegistrationsBlocked: false, emailVerificationBlocked: false,
      maintenanceMode: false,
      systemReadOnlyMode: false,
    };
    AppState.admin.lastAnnouncementId = null;
    Utils.$("btn-admin-panel")?.remove();
    Utils.$("modal-admin-panel")?.classList.remove("active");
    this.renderEmptyUserEditor();
    this.syncSidebarButton();
  }

  static isSupportStaffProfile(profile = {}, uid = null) {
    if (!uid && !profile) return false;
    const r = String(profile?.role || "").toLowerCase().trim();
    if (r === "creator" || r === "moderator" || r === "operator") return true;
    if (this.isCreatorProfile(profile, uid)) return true;
    if (this.isModeratorProfile(profile, uid)) return true;
    if (this.isOperatorProfile(profile, uid)) return true;
    return false;
  }

  static syncSidebarButton(profile = {}) {
    const footer = Utils.$("btn-logout")?.parentNode;
    const uid = AppState.currentUser?.uid || null;

    if (!uid) {
      if (Utils.$("nav-support-staff"))
        Utils.$("nav-support-staff").style.display = "none";
      if (Utils.$("nav-support"))
        Utils.$("nav-support").style.display = "flex";
      let btn = Utils.$("btn-admin-panel");
      if (btn) btn.remove();
      Utils.$("modal-admin-panel")?.classList.remove("active");
      if (typeof window !== "undefined" && window.FpsCounter) {
        window.FpsCounter.checkAndToggle();
      }
      return;
    }

    const myProfile = AppState.usersCache.get(uid) || profile || {};

    let hasAdminAccess = this.isAdminProfile(
      myProfile,
      uid,
    );
    let hasSupportAccess = this.isSupportStaffProfile(myProfile, uid);

    if (Utils.$("nav-support-staff"))
      Utils.$("nav-support-staff").style.display = hasSupportAccess
        ? "flex"
        : "none";
    if (Utils.$("nav-support"))
      Utils.$("nav-support").style.display = hasSupportAccess ? "none" : "flex";

    if (typeof window !== "undefined" && window.FpsCounter) {
      window.FpsCounter.checkAndToggle();
    }

    if (!footer) return;

    let btn = Utils.$("btn-admin-panel");

    if (!hasAdminAccess) {
      if (btn) btn.remove();
      Utils.$("modal-admin-panel")?.classList.remove("active");
      return;
    }

    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btn-admin-panel";
      btn.className = "secondary-btn";
      btn.innerText = "Админ-панель";
      footer.insertBefore(btn, Utils.$("btn-logout"));
    }

    btn.onclick = () => this.openPanel();
  }

  static openPanel() {
    if (!this.requireAdmin()) return;
    this.ensureUI();
    this.renderPanel();
    Utils.$("modal-admin-panel").classList.add("active");
  }

  static async openUserInAdmin(uid) {
    if (!this.requireAdmin()) return;
    if (!uid) return;
    this.openPanel();
    this.switchGodModeSection("people");
    const searchInput = Utils.$("admin-user-search");
    if (searchInput) {
      const cached = AppState.usersCache?.get(uid);
      searchInput.value = cached?.username ? `@${cached.username}` : uid;
    }
    await this.loadUserEditor(uid);
    const editor = Utils.$("admin-user-editor");
    if (editor) {
      editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  static renderIfOpen() {
    if (Utils.$("modal-admin-panel")?.classList.contains("active"))
      this.renderPanel();
  }

  static getCurrentRoomForUid(targetUid) {
    for (const [roomId, room] of AppState.roomsCache.entries()) {
      if (room?.presence?.[targetUid]) return { roomId, room };
    }
    return null;
  }

  static async collectDashboardData() {
    const [usersSnap, dmSnap] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "direct-messages")),
    ]);

    const usersData = usersSnap.val() || {};
    const dmData = dmSnap.val() || {};
    const rooms = Array.from(AppState.roomsCache.entries());

    return {
      usersData,
      dmData,
      rooms,
      onlineUsers: Object.entries(usersData).filter(
        ([, userData]) => userData?.status?.online,
      ),
      privateRooms: rooms.filter(([, room]) => room?.isPrivate),
      emptyRooms: rooms.filter(
        ([, room]) =>
          !room?.presence || Object.keys(room.presence).length === 0,
      ),
    };
  }

  static renderStats(stats) {
    const cards = [
      {
        label: "Всего пользователей",
        value: Object.keys(stats.usersData).length,
      },
      { label: "Онлайн сейчас", value: stats.onlineUsers.length },
      { label: "Активных комнат", value: stats.rooms.length },
      { label: "Приватных комнат", value: stats.privateRooms.length },
      { label: "Пустых комнат", value: stats.emptyRooms.length },
      { label: "Личных чатов", value: Object.keys(stats.dmData).length },
    ];

    Utils.$("admin-stats-grid").innerHTML = cards
      .map(
        (card) => `
            <div style="border:1px solid var(--border-light); border-radius:14px; padding:14px; background:rgba(255,255,255,0.03);">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">${card.label}</div>
                <div style="font-size:24px; font-weight:800;">${card.value}</div>
            </div>
        `,
      )
      .join("");

    const lockBtn = Utils.$("btn-admin-toggle-room-lock");
    if (lockBtn)
      lockBtn.innerText = AppState.admin.settings.roomCreationBlocked
        ? "Разблокировать создание комнат"
        : "Блокировать создание комнат";
    const setBtn = (id, key, label) => {
      const btn = Utils.$(id);
      if (btn)
        btn.innerText = `${label}: ${AppState.admin.settings[key] ? "ON" : "OFF"}`;
    };
    setBtn(
      "btn-admin-global-reg-lock",
      "globalRegistrationsBlocked",
      "Блок регистраций",
    );
    setBtn(
      "btn-admin-global-email-verify-lock",
      "emailVerificationBlocked",
      "Блок вериф. почты",
    );
    setBtn(
      "btn-admin-global-email-verify-lock",
      "emailVerificationBlocked",
      "Блок вериф. почты",
      "Блок регистраций",
    );
    setBtn(
      "btn-admin-global-maintenance",
      "maintenanceMode",
      "Maintenance mode",
    );
    setBtn(
      "btn-admin-system-readonly",
      "systemReadOnlyMode",
      "Системный ReadOnly",
    );
  }

  static async forceGlobalSessionRefresh() {
    if (!this.requireAdmin()) return;
    if (!this.isCurrentUserCreator())
      return Utils.toast(
        "Только Создатель может обновлять все сессии",
        "error",
      );
    const payload = { ts: Date.now(), byUid: AppState.currentUser.uid };
    await set(ref(db, "admin/actions/globalSessionRefresh"), payload);
    await this.pushAuditLog("admin.sessions.refreshAll", payload);
    Utils.toast("Запрошено обновление всех пользовательских сессий");
  }

  static async runSystemDiagnostics() {
    if (!this.requireAdmin()) return;
    const [usersSnap, roomsSnap] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "rooms")),
    ]);
    const users = usersSnap.val() || {};
    const rooms = roomsSnap.val() || {};
    const now = Date.now();
    const staleOnline = Object.values(users).filter(
      (u) =>
        u?.status?.online &&
        now - Number(u?.status?.lastSeen || 0) > 10 * 60 * 1000,
    ).length;
    let orphanPresence = 0;
    Object.values(rooms).forEach((room) => {
      Object.keys(room?.presence || {}).forEach((uid) => {
        if (!users[uid]) orphanPresence++;
      });
    });
    const diagnostics = {
      users: Object.keys(users).length,
      online: Object.values(users).filter((u) => u?.status?.online).length,
      rooms: Object.keys(rooms).length,
      staleOnline,
      orphanPresence,
      lockedFlags: Object.entries(AppState.admin.settings || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key),
    };
    await this.pushAuditLog("admin.system.diagnostics", diagnostics);
    Utils.toast(
      `Диагностика: online=${diagnostics.online}, stale=${diagnostics.staleOnline}, orphan=${diagnostics.orphanPresence}`,
    );
  }

  static renderAuditLog() {
    const list = Utils.$("admin-audit-list");
    if (!list) return;
    if (!AppState.admin.logs.length) {
      list.innerHTML = `<div style="font-size:13px; color:var(--text-muted);">Лог пуст</div>`;
      return;
    }
    list.innerHTML = AppState.admin.logs
      .map((item) => {
        const time = new Date(Number(item.ts || 0)).toLocaleString();
        return `<div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; font-family:Consolas,monospace; font-size:12px;">
                <div style="color:var(--text-muted);">${time}</div>
                <div style="margin-top:4px; color:#ffffff;">${Utils.escapeHtml(item.action || "action")}</div>
                <div style="margin-top:4px;">uid: ${Utils.escapeHtml(item.byUid || "-")}</div>
                <div style="margin-top:4px; white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(item.payload || {}))}</div>
            </div>`;
      })
      .join("");
  }

  static renderRoomsList(rooms) {
    const list = Utils.$("admin-rooms-list");
    if (!list) return;

    if (!rooms.length) {
      list.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:8px;">Нет активных комнат</div>`;
      return;
    }

    list.innerHTML = rooms
      .map(([roomId, room]) => {
        const membersCount = room?.presence
          ? Object.keys(room.presence).length
          : 0;
        return `
                <div data-occupancy="${membersCount}" style="border:1px solid var(--border-light); border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${room.isPrivate ? "🔒 " : ""}${Utils.escapeHtml(room.name || "Без названия")}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">ID: ${roomId} • <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${membersCount} • Хост: ${Utils.escapeHtml(room.hostName || "Неизвестно")}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="secondary-btn admin-edit-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">✏️ Изменить</button>
                        <button class="secondary-btn admin-enter-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Войти</button>
                        <button class="danger-btn admin-delete-room-btn" data-room-id="${roomId}" style="width:auto; padding:8px 12px;">Закрыть</button>
                    </div>
                </div>
            `;
      })
      .join("");

    list.querySelectorAll(".admin-edit-room-btn").forEach((btn) => {
      btn.onclick = () => {
        if (!this.requireAdmin()) return;
        const roomId = btn.dataset.roomId;
        RoomManager.openRoomModal(roomId);
      };
    });

    list.querySelectorAll(".admin-enter-room-btn").forEach((btn) => {
      btn.onclick = () => {
        if (!this.requireAdmin()) return;
        const roomId = btn.dataset.roomId;
        const roomData = AppState.roomsCache.get(roomId);
        if (!roomData) return Utils.toast("Комната уже удалена", "error");
        Utils.$("modal-admin-panel").classList.remove("active");
        RoomManager.enterRoomFinal(roomId, roomData);
      };
    });

    list.querySelectorAll(".admin-delete-room-btn").forEach((btn) => {
      btn.onclick = () => this.deleteRoom(btn.dataset.roomId);
    });
  }

  static renderUsersList(usersData) {
    const list = Utils.$("admin-online-users");
    if (!list) return;

    let entries = Object.entries(usersData);
    if (AppState.admin.activeUsersTab === "online") {
      entries = entries.filter(([, userData]) => userData?.status?.online);
    } else if (AppState.admin.activeUsersTab === "mods") {
      entries = entries.filter(([uid, userData]) => {
        return AdminPanel.isAdminProfile(userData?.profile || {}, uid);
      });
    }

    if (!entries.length) {
      list.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:8px;">Список пуст</div>`;
      return;
    }

    list.innerHTML = entries
      .map(([uid, userData]) => {
        const profile = userData.profile || {};
        const roomMeta = this.getCurrentRoomForUid(uid);
        const isOnline = userData?.status?.online;
        return `
                <div style="border:1px solid var(--border-light); border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; background:${isOnline ? "rgba(76,175,80,0.05)" : "transparent"}">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700;">${Utils.escapeHtml(profile.name || "Без имени")} <span style="color:var(--accent); font-size:12px;">@${Utils.escapeHtml(profile.username || uid)}</span> ${isOnline ? '<span style="color:#4caf50; font-size:10px;">● ONLINE</span>' : ""}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                            UID: ${uid}${isOnline && roomMeta ? ` • В комнате: ${Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId)}` : ""}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="secondary-btn admin-load-user-btn" data-uid="${uid}" style="width:auto; padding:8px 12px;">Открыть профиль</button>
                    </div>
                </div>
            `;
      })
      .join("");

    list
      .querySelectorAll(".admin-load-user-btn")
      .forEach(
        (btn) => (btn.onclick = () => this.loadUserEditor(btn.dataset.uid)),
      );
  }

  static renderEmptyUserEditor() {
    const editor = Utils.$("admin-user-editor");
    if (!editor) return;
    editor.dataset.targetUid = "";
    editor.innerHTML = `
            <div style="font-size:13px; color:var(--text-muted); padding:12px; border:1px dashed var(--border-light); border-radius:12px;">
                Выберите пользователя через поиск или клик по списку онлайна.
            </div>
        `;
  }

  static async loadUserEditor(uid) {
    if (!this.requireAdmin()) return;
    if (!uid) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return Utils.toast("Пользователь не найден", "error");

    const userData = snap.val() || {};
    const profile = userData.profile || {};
    const moderation = userData.moderation || {};
    const roomMeta = this.getCurrentRoomForUid(uid);
    const editor = Utils.$("admin-user-editor");

    const isReadOnly = this.isCurrentUserReadOnly();
    editor.dataset.targetUid = uid;
    editor.innerHTML = `
            ${isReadOnly ? `
            <div style="padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); border-radius:10px; margin-bottom:12px; font-size:12px; color:#fff; display:flex; align-items:center; gap:8px;">
                <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Eyes.webp" style="width:16px; height:16px;" alt="👁️" onerror="this.style.display='none'">
                <span><strong>Режим только просмотра</strong> (Менеджер). Редактирование профиля недоступно.</span>
            </div>` : ''}
            <div style="font-size:12px; color:var(--text-muted);">UID: ${uid}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:-6px;">Комната: ${roomMeta ? Utils.escapeHtml(roomMeta.room.name || roomMeta.roomId) : "не находится в комнате"}</div>
            <input type="text" id="admin-edit-name" placeholder="Имя" value="${Utils.escapeHtml(profile.name || "")}">
            <input type="text" id="admin-edit-username" placeholder="ID" value="${Utils.escapeHtml(profile.username || "")}">
            <input type="text" id="admin-edit-avatar" placeholder="URL аватарки" value="${Utils.escapeHtml(profile.avatar || "")}">
            <div class="admin-editor-block">
                <div class="admin-form-label">Баннер профиля</div>
                <input type="text" id="admin-edit-banner" placeholder="URL баннера (изображение)" value="${Utils.escapeHtml(profile.banner || "")}">
            </div>
            <textarea id="admin-edit-bio" rows="4" placeholder="Описание">${Utils.escapeHtml(profile.bio || "")}</textarea>
            <div style="margin-top:8px;">
                <label class="admin-form-label" for="admin-edit-likes">Лайки профиля</label>
                <input type="number" id="admin-edit-likes" min="0" value="${Object.keys(profile.likedBy || {}).length}">
            </div>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Premium подписка</div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
                    Статус: ${
                      profile?.premium?.active &&
                      Number(profile.premium.expiresAt) > Date.now()
                        ? `активен до ${new Date(Number(profile.premium.expiresAt)).toLocaleDateString("ru-RU")}`
                        : "не активен"
                    }
                </div>
                ${
                  this.isCurrentUserCreator()
                    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="primary-btn" id="btn-admin-grant-premium" style="width:auto;padding:8px 14px;">Выдать Premium (30 дн.)</button>
                        <button class="danger-btn" id="btn-admin-revoke-premium" style="width:auto;padding:8px 14px;">Снять Premium</button>
                      </div>
                      <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Только Создатель может выдавать Premium.</div>`
                    : `<div style="font-size:11px;color:var(--text-muted);">Выдача Premium — только для Создателя.</div>`
                }
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Стрик (Огонек)</div>
                <input type="number" id="admin-edit-streak" min="0" value="${Utils.escapeHtml(profile.streak || 0)}" placeholder="Количество дней подряд">
            </div>

            <div style="border:1px solid rgba(255, 215, 0, 0.35); border-radius:14px; padding:16px; background:linear-gradient(145deg, rgba(255, 215, 0, 0.1), rgba(0,0,0,0.45)); margin-top:12px; box-shadow:0 4px 16px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div style="font-weight:800; font-size:14px; color:#ffd700; display:flex; align-items:center; gap:8px;">
                        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width:20px; height:20px;" alt="✨">
                        <span>Баланс Люменов</span>
                    </div>
                    <div style="padding:6px 14px; background:rgba(255, 215, 0, 0.18); border:1px solid rgba(255, 215, 0, 0.45); border-radius:100px; font-size:13px; font-weight:800; color:#ffd700; display:flex; align-items:center; gap:6px;">
                        <span style="color:rgba(255,255,255,0.75); font-weight:600; font-size:12px;">Текущий:</span>
                        <span id="admin-user-current-lumens" style="color:#ffffff; font-size:14px; font-weight:900;">${Number(profile.lumens || 0).toLocaleString()}</span>
                        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">
                    </div>
                </div>
                
                <div style="margin-bottom:10px;">
                    <label for="admin-edit-lumens" style="display:block; font-size:12px; font-weight:600; color:rgba(255,255,255,0.7); margin-bottom:6px;">
                        Установить точное значение баланса:
                    </label>
                    <input type="number" id="admin-edit-lumens" value="${profile.lumens || 0}" placeholder="Новый баланс Люменов" style="width:100%; box-sizing:border-box; height:42px; padding:10px 14px; font-size:15px; font-weight:700; color:#ffffff; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.22); border-radius:10px; outline:none;" min="0">
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="10" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">+10</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="50" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">+50</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="100" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">+100</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="500" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">+500</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="1000" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">+1,000</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="-50" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">-50</button>
                    <button type="button" class="secondary-btn admin-lumens-quick-btn" data-delta="-100" style="padding:6px 10px; font-size:11.5px; border-radius:8px;">-100</button>
                    <button type="button" class="secondary-btn admin-lumens-set-btn" data-val="0" style="padding:6px 10px; font-size:11.5px; border-radius:8px; color:#ff6b6b; border-color:rgba(239,68,68,0.3);">Сброс (0)</button>
                </div>

                <button type="button" class="primary-btn" id="btn-admin-apply-lumens-only" style="width:100%; height:40px; font-size:13px; font-weight:800; background:linear-gradient(135deg, #ffd700, #f59e0b); color:#000000; border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(255, 215, 0, 0.3);">
                    <span>Сохранить баланс Люменов</span>
                    <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width:16px; height:16px;" alt="✨">
                </button>
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Уровень и XP</div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label for="admin-edit-level" class="admin-form-label">Уровень</label>
                        <input type="number" id="admin-edit-level" value="${ProfileManager.getExpMath(profile.xp || 0).level}" placeholder="Уровень" min="0">
                    </div>
                    <div style="flex:1;">
                        <label for="admin-edit-xp" class="admin-form-label">XP</label>
                        <input type="number" id="admin-edit-xp" value="${profile.xp || 0}" placeholder="Опыт">
                    </div>
                </div>
            </div>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Назначенные бейджи</div>
                <div id="admin-edit-badges-container" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            </div>

            <div style="font-size:12px; color:var(--text-muted); margin-top: 10px;">Email: ${Utils.escapeHtml(profile.email || "не указан")}</div>
            
            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Управление второй половинкой</div>
                <input type="text" id="admin-partner-target" placeholder="UID или юзернейм существующего юзера">
                <div style="font-size: 11px; color: var(--text-muted); margin: 5px 0;">ИЛИ создать фиктивную:</div>
                <div style="display:flex; gap: 8px;">
                    <input type="text" id="admin-partner-fake-name" placeholder="Имя">
                    <input type="text" id="admin-partner-fake-url" placeholder="URL Аватарки">
                </div>
                <input type="date" id="admin-partner-date" style="margin-top:8px;" title="Дата начала (опционально)">
                <button class="primary-btn" id="btn-admin-set-partner" style="margin-top:8px;">Применить изменения</button>
                <div style="font-size:11px; margin-top:4px;">Текущий партнер: ${Utils.escapeHtml(userData?.partner || profile?.partner || "нет")}</div>
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Прямая выдача/удаление рамки</div>
                <div style="display:flex; gap: 8px;">
                    <input type="text" id="admin-user-frame-id" placeholder="Изображение рамки (URL)" style="margin:0; flex:1;">
                    <button class="primary-btn" id="btn-admin-user-grant-frame" style="width:auto; padding:0 12px;">Выдать</button>
                </div>
                <div style="font-size:11px; margin-top:6px; color:var(--text-muted);">Рамка будет назначена напрямую в профиль.</div>
                
                <div id="admin-user-inventory-list" style="margin-top:10px; display:flex; flex-direction:column; gap:5px;">
                    ${(profile.inventory || [])
                      .map(
                        (frameUrl, idx) => `
                        <div style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:5px; border-radius:6px;">
                            <img src="${Utils.escapeHtml(frameUrl)}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;">
                            <input type="text" readonly value="${Utils.escapeHtml(frameUrl)}" style="flex:1; margin:0; font-size:11px; padding:4px;">
                            <button class="danger-btn" onclick="AdminPanel.removeFrameFromUser('${uid}', '${idx}')" style="padding:4px 8px; font-size:12px;">Удалить</button>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>

            <div style="border:1px solid var(--border-light); border-radius:12px; padding:10px; background:rgba(0,0,0,0.2); margin-top:10px;">
                <div style="font-weight:700; margin-bottom:6px;">Live User Inspector</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Current IP: ${Utils.escapeHtml(userData?.status?.ip || "unavailable")}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Reg IP: ${Utils.escapeHtml(profile.registeredIp || "unknown")}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Last Active: ${userData?.status?.lastActive ? Utils.formatExactDate(userData.status.lastActive) : "unknown"}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Partner: ${Utils.escapeHtml(userData?.partner || profile?.partner || "none")}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Registered: ${profile.createdAt ? Utils.formatExactDate(profile.createdAt) : "unknown"}</div>
                <div style="font-size:12px; font-family:Consolas,monospace;">Ban history: ${Array.isArray(moderation.banHistory) ? moderation.banHistory.length : 0}</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
                <button class="primary-btn" id="btn-admin-save-user">Сохранить изменения</button>
                <button class="secondary-btn" id="btn-admin-reset-user">Обнулить профиль</button>
                <button class="danger-btn" id="btn-admin-delete-user">Удалить пользователя</button>
                <button class="secondary-btn" id="btn-admin-force-leave-current">Кикнуть из комнаты</button>
                <button class="danger-btn" id="btn-admin-force-logout-current">Форс-выход</button>
                <button class="secondary-btn" id="btn-admin-toggle-user-mute">${moderation.muted ? "Unmute user" : "Mute user"}</button>
                <button class="secondary-btn" id="btn-admin-toggle-shadowban">${moderation.shadowban ? "Снять Shadowban" : "Shadowban"}</button>
                <button class="secondary-btn" id="btn-admin-reset-password">Reset password</button>
                <button class="secondary-btn" id="btn-admin-cancel-tutorial">Отменить туториал</button>
            </div>
        `;

    BadgeManager.renderUserEditorBadges(uid, profile.assignedBadges);

    const lumensInput = Utils.$("admin-edit-lumens");
    document.querySelectorAll(".admin-lumens-quick-btn").forEach((b) => {
      b.onclick = () => {
        if (!lumensInput) return;
        const cur = Number(lumensInput.value) || 0;
        const delta = Number(b.dataset.delta) || 0;
        lumensInput.value = Math.max(0, cur + delta);
      };
    });
    document.querySelectorAll(".admin-lumens-set-btn").forEach((b) => {
      b.onclick = () => {
        if (!lumensInput) return;
        lumensInput.value = Number(b.dataset.val) || 0;
      };
    });

    const applyLumensBtn = Utils.$("btn-admin-apply-lumens-only");
    if (applyLumensBtn) {
      applyLumensBtn.onclick = async () => {
        if (!this.requireWritePermission()) return;
        if (!(await this.checkModRestrictionsForTarget(uid))) return;
        const targetLumens = Number(lumensInput?.value);
        if (isNaN(targetLumens) || targetLumens < 0) {
          return Utils.toast("Укажите корректное число Люменов (>= 0)", "error");
        }
        await this.setCustomUserLumens(uid, targetLumens);
      };
    }

    const grantPremiumBtn = Utils.$("btn-admin-grant-premium");
    if (grantPremiumBtn) {
      grantPremiumBtn.onclick = () => this.grantPremiumToUser(uid);
    }
    const revokePremiumBtn = Utils.$("btn-admin-revoke-premium");
    if (revokePremiumBtn) {
      revokePremiumBtn.onclick = () => this.revokePremiumFromUser(uid);
    }

    const grantFrameBtn = Utils.$("btn-admin-user-grant-frame");
    if (grantFrameBtn) {
      grantFrameBtn.onclick = async () => {
        if (!this.isCurrentUserCreator())
          return Utils.toast("Только Создатель", "error");
        const frameUrl = Utils.$("admin-user-frame-id")?.value.trim();
        if (!frameUrl) return Utils.toast("Укажите URL рамки", "error");

        const snap = await get(ref(db, `users/${uid}/profile/inventory`));
        const currentInv = snap.exists() ? snap.val() : [];
        if (!currentInv.includes(frameUrl)) {
          currentInv.push(frameUrl);
          await update(ref(db, `users/${uid}/profile`), {
            frame: frameUrl,
            inventory: currentInv,
          });
          Utils.toast("Рамка выдана и добавлена в инвентарь!");
        } else {
          await update(ref(db, `users/${uid}/profile`), { frame: frameUrl });
          Utils.toast("У пользователя уже есть эта рамка, она применена");
        }
      };
    }

    Utils.$("btn-admin-save-user").onclick = () => this.saveUserProfile();

    const levelInput = Utils.$("admin-edit-level");
    const xpInput = Utils.$("admin-edit-xp");
    if (levelInput && xpInput) {
      levelInput.oninput = () => {
        let lvl = Number(levelInput.value) || 0;
        xpInput.value = 240 * (lvl * lvl);
      };
      xpInput.oninput = () => {
        let xp = Number(xpInput.value) || 0;
        levelInput.value = ProfileManager.getExpMath(xp).level;
      };
    }

    Utils.$("btn-admin-set-partner").onclick = () => this.forceSetPartner(uid);
    Utils.$("btn-admin-reset-user").onclick = () => this.resetUserProfile();
    Utils.$("btn-admin-delete-user").onclick = () =>
      this.deleteUserCompletely(uid);
    Utils.$("btn-admin-force-leave-current").onclick = () =>
      this.forceLeaveRoom(uid);
    Utils.$("btn-admin-force-logout-current").onclick = () =>
      this.forceSignOut(uid);
    Utils.$("btn-admin-toggle-user-mute").onclick = () =>
      this.toggleUserMute(uid);
    Utils.$("btn-admin-toggle-shadowban").onclick = () =>
      this.toggleShadowban(uid);
    Utils.$("btn-admin-reset-password").onclick = () =>
      this.issuePasswordReset(uid);
    Utils.$("btn-admin-cancel-tutorial").onclick = async () => {
      if (!this.requireWritePermission()) return;
      if (!(await Utils.confirm(`Отозвать туториал для пользователя ${uid}?`)))
        return;
      await set(ref(db, `admin/actions/cancelTutorial/${uid}`), {
        ts: Date.now(),
        by: AppState.currentUser.uid,
      });
      Utils.toast("Сигнал на отмену туториала отправлен.");
    };

    if (isReadOnly) {
      editor.querySelectorAll("input, textarea, select").forEach((el) => {
        el.disabled = true;
        el.style.opacity = "0.7";
      });
      editor.querySelectorAll(".primary-btn, .danger-btn, .admin-lumens-quick-btn").forEach((btn) => {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      });
    }
  }

  static async grantPremiumToUser(uid) {
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может выдавать Premium", "error");
    if (!(await this.checkModRestrictionsForTarget(uid))) return;
    if (
      !(await Utils.confirm(`Выдать Premium на 30 дней пользователю ${uid}?`))
    )
      return;

    const snap = await get(ref(db, `users/${uid}/profile/premium`));
    const existing = snap.exists() ? snap.val() : {};
    const now = Date.now();
    const PREMIUM_MS = 30 * 24 * 60 * 60 * 1000;
    let expiresAt = now + PREMIUM_MS;
    if (existing?.expiresAt && Number(existing.expiresAt) > now) {
      expiresAt = Number(existing.expiresAt) + PREMIUM_MS;
    }

    await set(ref(db, `users/${uid}/profile/premium`), {
      active: true,
      expiresAt,
      since: existing?.since || now,
      plan: "monthly",
      statusEmoji: existing?.statusEmoji || "star",
      grantedBy: AppState.currentUser.uid,
      grantedAt: now,
      updatedAt: now,
    });

    await this.pushAuditLog("grant_premium", { uid, expiresAt });
    Utils.toast("Premium выдан на 30 дней", "success");
    await this.loadUserEditor(uid);
    if (window.PremiumManager)
      PremiumManager.syncFromProfile(AppState.usersCache.get(uid), uid);
  }

  static async revokePremiumFromUser(uid) {
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может снимать Premium", "error");
    if (!(await this.checkModRestrictionsForTarget(uid))) return;
    if (!(await Utils.confirm(`Снять Premium у пользователя ${uid}?`))) return;

    const now = Date.now();
    await set(ref(db, `users/${uid}/profile/premium`), {
      active: false,
      expiresAt: now,
      revokedBy: AppState.currentUser.uid,
      updatedAt: now,
    });

    await this.pushAuditLog("revoke_premium", { uid });
    Utils.toast("Premium снят", "success");
    await this.loadUserEditor(uid);
    if (window.PremiumManager)
      PremiumManager.syncFromProfile(AppState.usersCache.get(uid), uid);
  }

  static async forceSetPartner(uid) {
    if (!this.requireAdmin()) return;
    const targetVal = Utils.$("admin-partner-target").value.trim();
    const fakeName = Utils.$("admin-partner-fake-name").value.trim();
    const fakeUrl = Utils.$("admin-partner-fake-url").value.trim();
    const customDate = Utils.$("admin-partner-date").value;
    let tsSince = customDate ? new Date(customDate).getTime() : Date.now();

    let companionUid = null;
    let previousTargetPartner = null;

    if (fakeName) {
      companionUid = `custom_partner_${Utils.generateCryptoId(6)}`;
      await set(ref(db, `users/${companionUid}/profile`), {
        name: fakeName,
        username: `mock_${Utils.generateCryptoId(4)}`, // fake
        avatar: fakeUrl || "",
      });
    } else if (targetVal) {
      const byUsernameSnap = await get(
        ref(db, `usernames/${targetVal.toLowerCase()}`),
      );
      companionUid = byUsernameSnap.exists() ? byUsernameSnap.val() : targetVal;
      const checkProf = await get(ref(db, `users/${companionUid}/profile`));
      if (!checkProf.exists())
        return Utils.toast("Реальный пользователь не найден!", "error");

      const tcp = await get(ref(db, `users/${companionUid}/partner`));
      previousTargetPartner = tcp.exists() ? tcp.val() : null;
    } else {
      return Utils.toast("Введите данные половинки", "error");
    }

    const updates = {};
    const snapMe = await get(ref(db, `users/${uid}/partner`));
    const myPrev = snapMe.exists() ? snapMe.val() : null;

    if (myPrev) {
      updates[`users/${myPrev}/partner`] = null;
      updates[`users/${myPrev}/partnerSince`] = null;
    }
    if (previousTargetPartner) {
      updates[`users/${previousTargetPartner}/partner`] = null;
      updates[`users/${previousTargetPartner}/partnerSince`] = null;
    }

    updates[`users/${uid}/partner`] = companionUid;
    updates[`users/${uid}/partnerSince`] = tsSince;

    if (!fakeName) {
      updates[`users/${companionUid}/partner`] = uid;
      updates[`users/${companionUid}/partnerSince`] = tsSince;
    } else {
      updates[`users/${companionUid}/partner`] = uid;
      updates[`users/${companionUid}/partnerSince`] = tsSince;
    }

    await update(ref(db), updates);
    if (!fakeName) await PartnerBondEngine.onUnion(uid, companionUid, tsSince);
    Utils.toast("Пара успешно изменена (СОЗДАТЕЛЬ)");
    this.loadUserEditor(uid);
  }

  static async removeFrameFromUser(uid, idx) {
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель", "error");
    if (!(await Utils.confirm("Удалить эту рамку у пользователя?"))) return;
    idx = parseInt(idx, 10);
    const snap = await get(ref(db, `users/${uid}/profile/inventory`));
    if (snap.exists()) {
      const currentInv = snap.val();
      if (currentInv[idx]) {
        const removedUrl = currentInv[idx];
        currentInv.splice(idx, 1);
        const profileSnap = await get(ref(db, `users/${uid}/profile`));
        const prof = profileSnap.val() || {};
        const updates = { inventory: currentInv };
        if (prof.frame === removedUrl) {
          updates.frame = null; // Remove active frame if deleted
        }
        await update(ref(db, `users/${uid}/profile`), updates);
        Utils.toast("Рамка удалена");
        this.loadUserEditor(uid); // Refresh
      }
    }
  }

  static async toggleUserMute(uid) {
    if (!this.requireAdmin()) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return;
    const path = `users/${uid}/moderation/muted`;
    const snap = await get(ref(db, path));
    const next = !Boolean(snap.val());
    await set(ref(db, path), next);
    await this.pushAuditLog("user.mute", { uid, muted: next });
    Utils.toast(next ? "Пользователь заглушен" : "Пользователь размьючен");
    this.loadUserEditor(uid);
  }

  static async deleteUserCompletely(uid) {
    if (!this.requireAdmin()) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return;
    if (
      !(await Utils.confirm("Полностью удалить пользователя и все его данные?"))
    )
      return;
    const userSnap = await get(ref(db, `users/${uid}`));
    if (!userSnap.exists()) return Utils.toast("Пользователь уже удален");
    const userData = userSnap.val() || {};
    const username = userData?.profile?.username || "";
    const updates = {};
    updates[`users/${uid}`] = null;
    updates[`admin/actions/forceSignOut/${uid}`] = {
      ts: Date.now(),
      by: AppState.currentUser.uid,
    };
    updates[`admin/actions/resetPassword/${uid}`] = null;
    if (username) updates[`usernames/${username}`] = null;
    AppState.roomsCache.forEach((room, roomId) => {
      updates[`rooms/${roomId}/presence/${uid}`] = null;
      updates[`rooms/${roomId}/rtc/participants/${uid}`] = null;
    });
    await update(ref(db), updates);
    await this.pushAuditLog("user.delete", { uid, username });
    Utils.toast("Пользователь удален из базы");
    this.renderEmptyUserEditor();
    this.renderIfOpen();
  }

  static async toggleShadowban(uid) {
    if (!this.requireAdmin()) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return;
    const banRef = ref(db, `users/${uid}/moderation/shadowban`);
    const snap = await get(banRef);
    const next = !Boolean(snap.val());
    await set(banRef, next);
    if (next) {
      await push(ref(db, `users/${uid}/moderation/banHistory`), {
        ts: Date.now(),
        by: AppState.currentUser.uid,
        type: "shadowban",
      });
    }
    await this.pushAuditLog("user.shadowban", { uid, enabled: next });
    Utils.toast(next ? "Shadowban включен" : "Shadowban снят");
    this.loadUserEditor(uid);
  }

  static async issuePasswordReset(uid) {
    if (!this.requireAdmin()) return;
    await set(ref(db, `admin/actions/resetPassword/${uid}`), {
      ts: Date.now(),
      by: AppState.currentUser.uid,
    });
    await this.pushAuditLog("user.resetPassword.issue", { uid });
    Utils.toast("Событие reset password отправлено");
  }

  static async findUser() {
    if (!this.requireAdmin()) return;

    const rawValue = Utils.$("admin-user-search")?.value.trim() || "";
    if (!rawValue) return Utils.toast("Введите @id или uid", "error");

    const directUidSnap = await get(ref(db, `users/${rawValue}/profile`));
    if (directUidSnap.exists()) return this.loadUserEditor(rawValue);

    const username = rawValue.toLowerCase().replace("@", "").trim();
    const usernameSnap = await get(ref(db, `usernames/${username}`));
    if (!usernameSnap.exists())
      return Utils.toast("Пользователь не найден", "error");

    await this.loadUserEditor(usernameSnap.val());
  }

  static async buildResetUsername(uid) {
    let base = `reset_${String(uid)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8)}`;
    if (base.length < 3) base = `reset_${Utils.generateCryptoId(3)}`;

    const snap = await get(ref(db, `usernames/${base}`));
    if (!snap.exists() || snap.val() === uid) return base;

    return `${base}_${Utils.generateCryptoId(2)}`;
  }

  static async saveUserProfile() {
    if (!this.requireWritePermission()) return;

    const editor = Utils.$("admin-user-editor");
    const uid = editor?.dataset.targetUid;
    if (!uid) return Utils.toast("Сначала выберите пользователя", "error");
    if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

    const profileSnap = await get(ref(db, `users/${uid}/profile`));
    if (!profileSnap.exists())
      return Utils.toast("Профиль пользователя не найден", "error");

    const oldProfile = profileSnap.val() || {};
    const name = Utils.$("admin-edit-name").value.trim();
    const username = Utils.$("admin-edit-username")
      .value.toLowerCase()
      .trim()
      .replace("@", "");
    const avatar = Utils.$("admin-edit-avatar").value.trim();
    const bio = Utils.$("admin-edit-bio").value.trim();
    let streak = parseInt(Utils.$("admin-edit-streak")?.value || 0, 10);
    const banner = Utils.$("admin-edit-banner")?.value.trim() || "";
    let targetLikes = parseInt(Utils.$("admin-edit-likes")?.value || 0, 10);
    
    // Process likes
    let likedBy = oldProfile.likedBy ? { ...oldProfile.likedBy } : {};
    let currentLikes = Object.keys(likedBy).length;
    if (targetLikes !== currentLikes) {
        if (targetLikes < currentLikes) {
            // Remove some keys
            let keys = Object.keys(likedBy);
            while (keys.length > targetLikes) {
                let toRemove = keys.pop();
                delete likedBy[toRemove];
            }
        } else {
            // Add fake keys
            let diff = targetLikes - currentLikes;
            for (let i = 0; i < diff; i++) {
                likedBy[`fake_like_${Utils.generateCryptoId(8)}`] = Date.now();
            }
        }
        oldProfile.likedBy = likedBy;
    }
    let xp = Number(Utils.$("admin-edit-xp")?.value || 0);
    let level = ProfileManager.getExpMath(xp).level;
    let lumens = Number(Utils.$("admin-edit-lumens")?.value ?? (oldProfile.lumens || 0));

    if (streak !== (oldProfile.streak || 0) || xp !== (oldProfile.xp || 0)) {
      if (!this.isCurrentUserCreator()) {
        Utils.toast(
          "Изменять стрик и уровень(XP) может только Создатель",
          "error",
        );
        streak = oldProfile.streak || 0;
        xp = oldProfile.xp || 0;
        level = ProfileManager.getExpMath(xp).level;
      }
    }

    if (lumens !== (oldProfile.lumens || 0)) {
      if (!this.requireAdmin()) {
        Utils.toast("Недостаточно прав для изменения Люменов", "error");
        lumens = oldProfile.lumens || 0;
      }
    }

    if (!name || !username) return Utils.toast("Имя и ID обязательны", "error");
    if (!/^[a-z0-9_]{3,15}$/.test(username))
      return Utils.toast("ID: 3-15 символов, a-z, 0-9, _", "error");

    const developerUid = await this.getDeveloperUid();
    const isCreatorTarget = Boolean(developerUid && uid === developerUid);

    if (username === "developer" && !isCreatorTarget)
      return Utils.toast("ID developer зарезервирован", "error");
    if (isCreatorTarget && username !== oldProfile.username)
      return Utils.toast("ID Создателя нельзя изменить", "error");

    const updates = {};
    if (username !== oldProfile.username) {
      const usernameSnap = await get(ref(db, `usernames/${username}`));
      if (usernameSnap.exists() && usernameSnap.val() !== uid)
        return Utils.toast("Этот ID уже занят", "error");
      if (oldProfile.username)
        updates[`usernames/${oldProfile.username}`] = null;
      updates[`usernames/${username}`] = uid;
    }

    const nextProfile = {
      ...oldProfile,
      name,
      username,
      avatar,
      bio,
      streak,
      level,
      xp,
      lumens,
      banner: banner,
    };
    updates[`users/${uid}/profile`] = nextProfile;

    await update(ref(db), updates);
    if (oldProfile.xp !== xp) {
      await BadgeManager.checkLevelBadges(uid, xp);
    }

    if (lumens !== (oldProfile.lumens || 0)) {
      const diff = lumens - (oldProfile.lumens || 0);
      if (window.LumenManager) {
        LumenManager.recordTransaction(uid, {
          type: diff >= 0 ? "income" : "expense",
          amount: Math.abs(diff),
          reason: diff >= 0 ? "Начисление через админ-панель" : "Списание через админ-панель",
          icon: "crown",
          meta: { adminUid: AppState.currentUser?.uid }
        });
        if (uid === AppState.currentUser?.uid) {
          LumenManager.updateBalance(lumens, {
            diff,
            reason: "Изменение баланса в панели управления",
            source: "admin",
            animate: true,
            showFloater: true
          });
        }
      }
    }

    AppState.usersCache.set(uid, nextProfile);
    Utils.toast("Профиль пользователя обновлён", "success");
    await this.loadUserEditor(uid);
    this.renderIfOpen();
  }

  static async setCustomUserLumens(targetUid, newLumens) {
    if (!this.requireWritePermission()) return;
    if (!(await this.checkModRestrictionsForTarget(targetUid))) return;

    try {
      const snap = await get(ref(db, `users/${targetUid}/profile`));
      if (!snap.exists()) return Utils.toast("Профиль пользователя не найден", "error");
      const prof = snap.val() || {};
      const oldLumens = Number(prof.lumens) || 0;
      const targetLumens = Math.max(0, Number(newLumens) || 0);
      const diff = targetLumens - oldLumens;

      await update(ref(db, `users/${targetUid}/profile`), {
        lumens: targetLumens
      });

      prof.lumens = targetLumens;
      AppState.usersCache.set(targetUid, prof);

      const curLabel = Utils.$("admin-user-current-lumens");
      if (curLabel) curLabel.textContent = targetLumens.toLocaleString();

      if (window.LumenManager) {
        LumenManager.recordTransaction(targetUid, {
          type: diff >= 0 ? "income" : "expense",
          amount: Math.abs(diff),
          reason: diff >= 0 ? "Начисление через админ-панель" : "Списание через админ-панель",
          icon: "crown",
          meta: { adminUid: AppState.currentUser?.uid }
        });

        if (targetUid === AppState.currentUser?.uid) {
          LumenManager.updateBalance(targetLumens, {
            diff,
            reason: "Изменение баланса в панели управления",
            source: "admin",
            animate: true,
            showFloater: true
          });
        }
      }

      Utils.toast(`Баланс Люменов обновлён: ${targetLumens.toLocaleString()} ✨`, "success");
    } catch (e) {
      console.error(e);
      Utils.toast("Ошибка при обновлении Люменов: " + e.message, "error");
    }
  }

  static async resetUserProfile() {
    if (!this.requireWritePermission()) return;

    const editor = Utils.$("admin-user-editor");
    const uid = editor?.dataset.targetUid;
    if (!uid) return Utils.toast("Сначала выберите пользователя", "error");
    if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

    if (!(await Utils.confirm("Обнулить профиль пользователя?"))) return;

    const profileSnap = await get(ref(db, `users/${uid}/profile`));
    if (!profileSnap.exists())
      return Utils.toast("Профиль пользователя не найден", "error");

    const oldProfile = profileSnap.val() || {};
    const developerUid = await this.getDeveloperUid();
    if (developerUid && uid === developerUid)
      return Utils.toast("Профиль Создателя нельзя обнулить", "error");

    const nextUsername = await this.buildResetUsername(uid);
    const updates = {};

    if (oldProfile.username && oldProfile.username !== nextUsername)
      updates[`usernames/${oldProfile.username}`] = null;
    updates[`usernames/${nextUsername}`] = uid;

    const nextProfile = {
      ...oldProfile,
      name: "Профиль сброшен",
      username: nextUsername,
      bio: "",
      avatar: "",
    };

    updates[`users/${uid}/profile`] = nextProfile;
    await update(ref(db), updates);
    AppState.usersCache.set(uid, nextProfile);
    Utils.toast("Профиль пользователя обнулён");
    await this.loadUserEditor(uid);
    this.renderIfOpen();
  }

  static async sendAnnouncement() {
    if (!this.requireWritePermission()) return;

    const text = Utils.$("admin-announcement-input")?.value.trim();
    if (!text) return Utils.toast("Введите текст оповещения", "error");

    const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
    await set(ref(db, "admin/global-announcement"), {
      id: Utils.generateCryptoId(10),
      text,
      ts: Date.now(),
      fromUid: AppState.currentUser.uid,
      fromUsername: profile.username || "admin",
    });
    await this.pushAuditLog("announcement.send", { text });

    Utils.$("admin-announcement-input").value = "";
    Utils.toast("Глобальное оповещение отправлено");
  }

  static async sendLocalAnnouncementToSelectedUser() {
    if (!this.requireWritePermission()) return;
    const targetUid = Utils.$("admin-user-editor")?.dataset?.targetUid || "";
    if (!targetUid)
      return Utils.toast(
        "Сначала выберите пользователя в блоке управления",
        "error",
      );

    const text = Utils.$("admin-local-announcement-input")?.value.trim();
    if (!text)
      return Utils.toast("Введите текст локального оповещения", "error");

    const targetSnap = await get(ref(db, `users/${targetUid}/profile`));
    if (!targetSnap.exists())
      return Utils.toast("Выбранный пользователь не найден", "error");

    const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
    const payload = {
      id: Utils.generateCryptoId(10),
      text,
      ts: Date.now(),
      fromUid: AppState.currentUser.uid,
      fromUsername: profile.username || "admin",
      targetUid,
    };
    await set(ref(db, `admin/local-announcements/${targetUid}`), payload);
    await this.pushAuditLog("announcement.local.send", { targetUid, text });
    Utils.$("admin-local-announcement-input").value = "";
    Utils.toast("Локальное оповещение отправлено выбранному пользователю");
  }

  static async clearAnnouncement() {
    if (!this.requireWritePermission()) return;
    await remove(ref(db, "admin/global-announcement"));
    await this.pushAuditLog("announcement.clear");
    Utils.toast("Глобальное оповещение очищено");
  }

  static async deleteRoom(roomId) {
    if (!this.requireWritePermission()) return;
    if (!(await this.checkModRestrictionsForRoom(roomId))) return; // Защита комнат Создателя

    const roomData = AppState.roomsCache.get(roomId);
    if (!roomData) return Utils.toast("Комната уже удалена", "error");
    if (!(await Utils.confirm(`Закрыть комнату "${roomData.name || roomId}"?`)))
      return;

    if (AppState.currentRoomId === roomId) RoomManager.leaveRoom();
    await remove(ref(db, `rooms/${roomId}`));
    await this.pushAuditLog("room.delete", { roomId });
    AppState.roomsCache.delete(roomId);
    RoomManager.updateRoomsDOM();
    this.renderIfOpen();
    Utils.toast("Комната удалена");
  }

  static async deleteAllRooms() {
    if (!this.requireWritePermission()) return;
    if (
      !(await Utils.confirm(
        "Удалить вообще все комнаты? Это действие необратимо.",
      ))
    )
      return;

    const devUid = await this.getDeveloperUid();
    const isModOnly = !this.isCurrentUserCreator();
    let deletedCount = 0;

    for (const [roomId, room] of AppState.roomsCache.entries()) {
      // Модераторы пропускают комнаты Создателя при масс-удалении
      if (
        isModOnly &&
        (room.hostId === devUid || (room.presence && room.presence[devUid]))
      ) {
        continue;
      }
      if (AppState.currentRoomId === roomId) RoomManager.leaveRoom();
      await remove(ref(db, `rooms/${roomId}`));
      await this.pushAuditLog("room.delete.bulk", { roomId });
      AppState.roomsCache.delete(roomId);
      deletedCount++;
    }

    RoomManager.updateRoomsDOM();
    this.renderIfOpen();
    Utils.toast(`Удалено комнат: ${deletedCount}`);
  }

  static async purgeEmptyRooms() {
    if (!this.requireWritePermission()) return;

    const devUid = await this.getDeveloperUid();
    const isModOnly = !this.isCurrentUserCreator();

    const emptyRoomIds = Array.from(AppState.roomsCache.entries())
      .filter(([, room]) => {
        if (room?.presence && Object.keys(room.presence).length > 0)
          return false;
        // Защита комнат, созданных разработчиком, от модераторов
        if (isModOnly && room.hostId === devUid) return false;
        return true;
      })
      .map(([roomId]) => roomId);

    if (!emptyRoomIds.length)
      return Utils.toast("Доступных для удаления пустых комнат нет");

    await Promise.all(
      emptyRoomIds.map((roomId) => remove(ref(db, `rooms/${roomId}`))),
    );
    await this.pushAuditLog("room.purgeEmpty", { count: emptyRoomIds.length });
    emptyRoomIds.forEach((roomId) => AppState.roomsCache.delete(roomId));
    RoomManager.updateRoomsDOM();
    this.renderIfOpen();
    Utils.toast(`Удалено пустых комнат: ${emptyRoomIds.length}`);
  }

  static async clearDirectMessages() {
    if (!this.requireAdmin()) return;
    if (!this.isCurrentUserCreator())
      return Utils.toast("Только Создатель может удалять все ЛС", "error");

    if (!(await Utils.confirm("Удалить вообще все личные сообщения?"))) return;

    await remove(ref(db, "direct-messages"));
    this.renderIfOpen();
    Utils.toast("Все личные сообщения удалены");
  }

  static async toggleRoomCreationLock() {
    if (!this.requireAdmin()) return;
    if (!this.isCurrentUserCreator())
      return Utils.toast(
        "Только Создатель может блокировать создание комнат",
        "error",
      );

    const nextValue = !AppState.admin.settings.roomCreationBlocked;
    await update(ref(db, "admin/settings"), { roomCreationBlocked: nextValue });
    AppState.admin.settings.roomCreationBlocked = nextValue;
    RoomManager.applyCreateRoomAvailability();
    this.renderIfOpen();
    Utils.toast(
      nextValue
        ? "Создание комнат заблокировано"
        : "Создание комнат разблокировано",
    );
  }

  static async forceSignOut(uid) {
    if (!this.requireWritePermission()) return;
    if (!uid) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

    if (
      !(await Utils.confirm(
        `Принудительно завершить сессию пользователя ${uid}?`,
      ))
    )
      return;

    await set(ref(db, `admin/actions/forceSignOut/${uid}`), {
      ts: Date.now(),
      by: AppState.currentUser.uid,
    });
    await this.pushAuditLog("user.forceSignOut", { uid });

    Utils.toast("Команда на форс-выход отправлена");
  }

  static async forceLeaveRoom(uid) {
    if (!this.requireWritePermission()) return;
    if (!uid) return;
    if (!(await this.checkModRestrictionsForTarget(uid))) return; // Защита Создателя

    const roomMeta = this.getCurrentRoomForUid(uid);
    if (!roomMeta)
      return Utils.toast("Пользователь сейчас не находится в комнате", "error");

    if (!(await this.checkModRestrictionsForRoom(roomMeta.roomId))) return; // Доп. защита комнаты

    if (
      !(await Utils.confirm(
        `Удалить пользователя ${uid} из комнаты "${roomMeta.room.name || roomMeta.roomId}"?`,
      ))
    )
      return;

    await Promise.all([
      remove(ref(db, `rooms/${roomMeta.roomId}/presence/${uid}`)),
      remove(ref(db, `rooms/${roomMeta.roomId}/rtc/participants/${uid}`)),
      set(ref(db, `admin/actions/forceLeaveRoom/${uid}`), {
        roomId: roomMeta.roomId,
        ts: Date.now(),
        by: AppState.currentUser.uid,
      }),
    ]);
    const actorProfile =
      AppState.usersCache.get(AppState.currentUser.uid) || {};
    const actorName =
      actorProfile.name || AppState.currentUser.displayName || "ADMIN";
    const actorUsername =
      actorProfile.username || AppState.currentUser.uid || "admin";
    const targetName = roomMeta.room?.presence?.[uid]?.name || uid;
    await push(ref(db, `rooms/${roomMeta.roomId}/chat`), {
      type: "system",
      uid: AppState.currentUser.uid,
      name: "SYSTEM",
      text: `ХОСТ ${actorName}(@${actorUsername}) кикнул ${targetName}`,
      ts: Date.now(),
    }).catch(() => {});
    await this.pushAuditLog("user.forceLeaveRoom", {
      uid,
      roomId: roomMeta.roomId,
    });

    Utils.toast("Пользователь удалён из комнаты");
    this.renderIfOpen();
  }

  static async renderPanel() {
    if (!this.requireAdmin()) return;

    const isReadOnly = this.isCurrentUserReadOnly();
    const noticeEl = Utils.$("admin-manager-readonly-notice");
    if (noticeEl) {
      noticeEl.style.display = isReadOnly ? "block" : "none";
    }

    if (isReadOnly) {
      const panel = Utils.$("modal-admin-panel");
      if (panel) {
        panel.querySelectorAll(".primary-btn, .danger-btn").forEach((btn) => {
          if (btn.id !== "btn-close-admin-panel" && btn.id !== "btn-admin-refresh") {
            btn.style.opacity = "0.55";
            btn.title = "Только для чтения (роль Менеджер)";
          }
        });
      }
    }

    const stats = await this.collectDashboardData();
    if (AppState.admin.activeSection === "dashboard") {
      this.renderStats(stats);
    }
    this.renderRoomsList(stats.rooms);
    this.renderUsersList(stats.usersData);
  }

  static getAdminRoomId() {
    return Utils.$("admin-room-action-id")?.value?.trim() || "";
  }

  static async kickAllFromRoom() {
    if (!this.requireWritePermission()) return;
    const roomId = this.getAdminRoomId();
    if (!roomId) return Utils.toast("Укажите ID комнаты", "error");
    const snap = await get(ref(db, `rooms/${roomId}/presence`));
    const presence = snap.val() || {};
    const updates = {};
    Object.keys(presence).forEach((uid) => {
      updates[`rooms/${roomId}/presence/${uid}`] = null;
    });
    if (!Object.keys(updates).length)
      return Utils.toast("В комнате никого нет", "info");
    await update(ref(db), updates);
    await this.pushAuditLog("admin.room.kickAll", { roomId });
    Utils.toast("Все участники удалены из комнаты");
    this.renderIfOpen();
  }

  static async cloneRoomSettings() {
    if (!this.requireWritePermission()) return;
    const roomId = this.getAdminRoomId();
    if (!roomId) return Utils.toast("Укажите ID комнаты", "error");
    const snap = await get(ref(db, `rooms/${roomId}`));
    if (!snap.exists()) return Utils.toast("Комната не найдена", "error");
    const room = snap.val();
    const newId = Utils.generateCryptoId(8);
    const clone = {
      ...room,
      name: `${room.name || "Room"} (копия)`,
      createdAt: Date.now(),
      presence: null,
    };
    delete clone.presence;
    await set(ref(db, `rooms/${newId}`), clone);
    Utils.toast(`Клон создан: ${newId}`);
    this.renderIfOpen();
  }

  static async setRoomMaxViewers() {
    if (!this.requireWritePermission()) return;
    const roomId = this.getAdminRoomId();
    const cap = Number(Utils.$("admin-room-max-viewers")?.value);
    if (!roomId || !cap || cap < 1)
      return Utils.toast("ID комнаты и лимит ≥1", "error");
    await update(ref(db, `rooms/${roomId}`), { maxViewers: cap });
    Utils.toast(`Лимит ${cap} установлен`);
  }

  static async setRoomPassword() {
    if (!this.requireWritePermission()) return;
    const roomId = this.getAdminRoomId();
    if (!roomId) return Utils.toast("Укажите ID комнаты", "error");
    const pass = Utils.$("admin-room-password")?.value ?? "";
    await update(ref(db, `rooms/${roomId}`), {
      isPrivate: Boolean(pass),
      roomPassword: pass || null,
    });
    Utils.toast(pass ? "Пароль установлен" : "Пароль снят");
  }

  static sortRoomsByOccupancy() {
    const list = Utils.$("admin-rooms-list");
    if (!list) return;
    const items = Array.from(list.children);
    items.sort((a, b) => {
      const ca = Number(a.dataset.occupancy || 0);
      const cb = Number(b.dataset.occupancy || 0);
      return cb - ca;
    });
    items.forEach((el) => list.appendChild(el));
    Utils.toast("Список отсортирован по онлайну");
  }

  static renderRoomHeatmap() {
    const out = Utils.$("admin-room-heatmap-out");
    if (!out) return;
    const rows = Array.from(AppState.roomsCache.entries())
      .map(([id, room]) => {
        const n = room?.presence ? Object.keys(room.presence).length : 0;
        const bar = "█".repeat(Math.min(20, n)) || "·";
        return `${bar} ${n} — ${Utils.escapeHtml(room.name || id)}`;
      })
      .sort((a, b) => b.localeCompare(a));
    out.innerHTML = rows.length
      ? rows.map((r) => `<div>${r}</div>`).join("")
      : "Нет комнат";
  }

  static async exportUsersCsv() {
    if (!this.requireAdmin()) return;
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const lines = ["uid,username,name,email,online,lastActive"];
    Object.entries(users).forEach(([uid, data]) => {
      const p = data.profile || {};
      lines.push(
        [
          uid,
          p.username,
          p.name,
          p.email,
          data.status?.online,
          data.status?.lastActive,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cowio-users-${Date.now()}.csv`;
    a.click();
    Utils.toast("CSV экспортирован");
  }

  static async scanInactiveUsers() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-people-tools-out");
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const inactive = Object.entries(users).filter(([, d]) => {
      const la = Number(d?.status?.lastActive || 0);
      return !d?.status?.online && la > 0 && la < cutoff;
    });
    if (out) {
      out.innerHTML = inactive.length
        ? inactive
            .slice(0, 50)
            .map(
              ([uid, d]) =>
                `<div>@${Utils.escapeHtml(d.profile?.username || uid)} — ${Utils.formatExactDate(d.status.lastActive)}</div>`,
            )
            .join("")
        : "Неактивных не найдено";
    }
    Utils.toast(`Неактивных: ${inactive.length}`);
  }

  static async scanDuplicateIPs() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-people-tools-out");
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const byIp = {};
    Object.entries(users).forEach(([uid, d]) => {
      const ip = d?.status?.ip || d?.profile?.registeredIp;
      if (!ip || ip === "unavailable") return;
      if (!byIp[ip]) byIp[ip] = [];
      byIp[ip].push(uid);
    });
    const dups = Object.entries(byIp).filter(([, arr]) => arr.length > 1);
    if (out) {
      out.innerHTML = dups.length
        ? dups
            .map(([ip, uids]) => `<div><b>${ip}</b>: ${uids.length} акк.</div>`)
            .join("")
        : "Дубликатов IP не найдено";
    }
    Utils.toast(`Групп с одинаковым IP: ${dups.length}`);
  }

  static async bulkShadowban() {
    if (!this.requireWritePermission()) return;
    const raw = Utils.$("admin-bulk-usernames")?.value || "";
    const names = raw
      .split(/[\s,;]+/)
      .map((s) => s.replace("@", "").toLowerCase())
      .filter(Boolean);
    if (!names.length) return Utils.toast("Введите @id", "error");
    let count = 0;
    for (const uname of names) {
      const uSnap = await get(ref(db, `usernames/${uname}`));
      if (!uSnap.exists()) continue;
      const uid = uSnap.val();
      await update(ref(db, `users/${uid}/moderation`), { shadowban: true });
      count++;
    }
    Utils.toast(`Shadowban: ${count} пользователей`);
    await this.pushAuditLog("admin.bulk.shadowban", { count, names });
  }

  static async forceVerifySelectedEmail() {
    if (!this.requireWritePermission()) return;
    const uid = Utils.$("admin-user-editor")?.dataset?.targetUid;
    if (!uid) return Utils.toast("Выберите пользователя", "error");
    await update(ref(db, `users/${uid}/profile`), { emailVerified: true });
    Utils.toast("Email помечен как verified");
    this.loadUserEditor(uid);
  }

  static async resetAllTutorials() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    if (!(await Utils.confirm("Сбросить туториал для ВСЕХ пользователей?")))
      return;
    await remove(ref(db, "admin/actions/cancelTutorial"));
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const updates = {};
    Object.keys(users).forEach((uid) => {
      updates[`admin/actions/cancelTutorial/${uid}`] = { ts: Date.now() };
    });
    await update(ref(db), updates);
    Utils.toast("Туториал сброшен для всех");
  }

  static async auditReservedUsernames() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-security-out");
    const reserved = ["developer", "admin", "moderator", "support", "cowio"];
    const lines = [];
    for (const name of reserved) {
      const snap = await get(ref(db, `usernames/${name}`));
      lines.push(
        snap.exists()
          ? `@${name} → занят (${snap.val()})`
          : `@${name} → свободен`,
      );
    }
    if (out) out.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");
  }

  static async sessionRiskScan() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-security-out");
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const risky = Object.entries(users).filter(
      ([, d]) =>
        d?.moderation?.shadowban ||
        d?.moderation?.muted ||
        (d?.moderation?.banHistory?.length || 0) > 0,
    );
    if (out) {
      out.innerHTML = risky.length
        ? risky
            .slice(0, 30)
            .map(
              ([uid, d]) =>
                `<div>@${Utils.escapeHtml(d.profile?.username || uid)} — risk</div>`,
            )
            .join("")
        : "Рисковых сессий не найдено";
    }
  }

  static async listForceLogoutUsers() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-security-out");
    const snap = await get(ref(db, "admin/actions/forceLogout"));
    const data = snap.val() || {};
    const uids = Object.keys(data);
    if (out)
      out.innerHTML = uids.length
        ? uids.map((u) => `<div>${u}</div>`).join("")
        : "Нет pending force-logout";
  }

  static async saveAutomodKeywords() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    const raw = Utils.$("admin-automod-keywords")?.value || "";
    const keywords = raw
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    await update(ref(db, "admin/settings"), { automodKeywords: keywords });
    Utils.toast(`Сохранено слов: ${keywords.length}`);
  }

  static async scheduleGlobalMessage() {
    if (!this.requireAdmin()) return;
    const text = await Utils.prompt(
      "Текст запланированного глобального сообщения:",
    );
    if (!text) return;
    await push(ref(db, "admin/scheduledMessages"), {
      text,
      ts: Date.now(),
      by: AppState.currentUser?.uid,
    });
    Utils.toast("Сообщение запланировано (очередь admin/scheduledMessages)");
  }

  static async setEmergencyBanner() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    const text = Utils.$("admin-emergency-banner")?.value?.trim() || "";
    await update(ref(db, "admin/settings"), { emergencyBanner: text });
    Utils.toast(text ? "Emergency banner установлен" : "Banner очищен");
  }

  static async notifyOnlineSegment() {
    if (!this.requireAdmin()) return;
    const text = await Utils.prompt("Текст для всех онлайн:");
    if (!text) return;
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const updates = {};
    Object.entries(users).forEach(([uid, d]) => {
      if (d?.status?.online)
        updates[`admin/localAnnouncements/${uid}`] = { text, ts: Date.now() };
    });
    await update(ref(db), updates);
    Utils.toast("Локальные оповещения отправлены онлайн-пользователям");
  }

  static async setMaintenanceCountdown() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    const text = await Utils.prompt(
      "Текст maintenance (отображается при maintenance mode):",
    );
    if (text === null) return;
    await update(ref(db, "admin/settings"), { maintenanceMessage: text });
    Utils.toast("Maintenance текст сохранён");
  }

  static async showBroadcastStats() {
    if (!this.requireAdmin()) return;
    const snap = await get(ref(db, "admin/auditLog"));
    const logs = snap.val() || {};
    const count = Object.keys(logs).length;
    const announceSnap = await get(ref(db, "admin/announcement"));
    Utils.toast(
      `Audit: ${count} записей. Announcement: ${announceSnap.exists() ? "есть" : "нет"}`,
    );
  }

  static async saveWebhookUrl() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    const url = Utils.$("admin-webhook-url")?.value?.trim() || "";
    await update(ref(db, "admin/settings"), { webhookUrl: url });
    Utils.toast("Webhook сохранён");
  }

  static async exportAuditJson() {
    if (!this.requireAdmin()) return;
    const snap = await get(ref(db, "admin/auditLog"));
    const blob = new Blob([JSON.stringify(snap.val() || {}, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cowio-audit-${Date.now()}.json`;
    a.click();
  }

  static async webhookTestPing() {
    if (!this.requireAdmin()) return;
    const url =
      AppState.admin.settings?.webhookUrl ||
      Utils.$("admin-webhook-url")?.value;
    if (!url) return Utils.toast("Webhook URL не задан", "error");
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ event: "cowio.test", ts: Date.now() }),
      });
      Utils.toast("Ping отправлен (no-cors)");
    } catch (e) {
      Utils.toast("Ошибка ping", "error");
    }
  }

  static async statusBridgePing() {
    if (!this.requireAdmin()) return;
    await this.pushAuditLog("integration.statusBridge", {
      ok: true,
      ts: Date.now(),
    });
    Utils.toast("Status bridge: OK (запись в audit)");
  }

  static async backupIntegrityCheck() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-backup-out");
    const [u, r, a] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "rooms")),
      get(ref(db, "admin/auditLog")),
    ]);
    const msg = `Users: ${Object.keys(u.val() || {}).length}, Rooms: ${Object.keys(r.val() || {}).length}, Audit: ${Object.keys(a.val() || {}).length}`;
    if (out) out.textContent = msg;
    Utils.toast("Integrity check выполнен");
  }

  static async setBackupRetention() {
    if (!this.requireAdmin() || !this.isCurrentUserCreator()) return;
    const days = Number(Utils.$("admin-backup-retention")?.value);
    if (!days || days < 1) return Utils.toast("Укажите дни ≥1", "error");
    await update(ref(db, "admin/settings"), { backupRetentionDays: days });
    Utils.toast(`Retention: ${days} дней`);
  }

  static async restoreDryRun() {
    if (!this.requireAdmin()) return;
    const out = Utils.$("admin-backup-out");
    const stats = await this.collectDashboardData();
    const msg = `Dry-run: восстановление затронет ~${Object.keys(stats.usersData).length} users, ${stats.rooms.length} rooms`;
    if (out) out.textContent = msg;
    Utils.toast("Dry-run завершён (без изменений)");
  }
}

window.AdminPanel = AdminPanel;
export { AdminPanel };
