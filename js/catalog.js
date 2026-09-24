class CatalogManager {
  static openLumensModal() {
    const modal = Utils.$("modal-lumens-info");
    if (!modal) {
      if (window.FriendsManager?.setNavActive) {
        FriendsManager.setNavActive("nav-catalog");
        if (window.CatalogManager) CatalogManager.renderCatalog();
      }
      return;
    }
    const uid = AppState.currentUser?.uid;
    const prof = uid ? AppState.usersCache.get(uid) : null;
    const lumens = Number(prof?.lumens) || 0;
    const walletVal = Utils.$("modal-lumens-wallet-val");
    if (walletVal) {
      walletVal.textContent = lumens.toLocaleString();
    }
    if (window.LumenManager) {
      LumenManager.switchModalTab("history");
    }
    modal.classList.add("active");
  }
  static items = [];
  static activeFilter = "all";
  static searchQuery = "";
  static sortBy = "featured";
  static filtersBound = false;

  static async init() {
    this.bindFilters();
    this.bindSearchAndSort();

    try {
      onValue(ref(db, "catalog"), (snap) => {
        if (snap.exists() && snap.val()) {
          const data = snap.val();
          this.items = Object.keys(data)
            .filter((k) => data[k] !== null)
            .map((k) => ({ id: k, ...data[k] }));
        } else {
          this.items = [];
        }

        // Авто-инициализация красивых стартовых рамок, если каталог в базе пуст
        if (this.items.length === 0 && AppState.currentUser) {
          this.seedDefaultItems();
        }

        this.renderCatalog();
        this.renderAdminCatalog();
      });
    } catch (e) {
      console.error(e);
    }
  }

  static async seedDefaultItems() {
    try {
      const { set, ref, getDatabase } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"
      );
      const dbRef = getDatabase();
      const initial = {
        item_neon_glow: {
          title: "Неоновое сияние",
          desc: "Футуристическая неоновая аура для активных зрителей комнат",
          price: "50",
          priceType: "paid",
          image: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp",
          type: "frame",
          isHot: true,
        },
        item_star_crown: {
          title: "Звёздная корона",
          desc: "Анимированная золотая корона признанного лидера комнат",
          price: "150",
          priceType: "paid",
          image: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Glowing%20Star.webp",
          type: "frame",
          isHot: true,
        },
        item_fire_aura: {
          title: "Огненная аура",
          desc: "Пламенное оформление для постоянных создателей стримов",
          price: "300",
          priceType: "paid",
          image: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp",
          type: "frame",
          isHot: false,
        },
        item_welcome_gift: {
          title: "Стартовая рамка COWIO",
          desc: "Бесплатный подарок в честь знакомства с платформой COWIO",
          price: "0",
          priceType: "free",
          image: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Partying%20Face.webp",
          type: "frame",
          isHot: false,
        },
      };
      await set(ref(dbRef, "catalog"), initial);
    } catch (e) {}
  }

  static addNewAdminItem() {
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель может управлять товарами", "error");
    const id = "item_" + Date.now();
    set(ref(db, `catalog/${id}`), {
      title: "Новый Товар",
      desc: "Описание",
      price: "100",
      priceType: "paid",
      image: "",
      type: "frame",
      isHot: false,
    });
  }

  static async grantFrameMass() {
    if (!AdminPanel.requireAdmin()) return;
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель может выдавать рамки", "error");
    const frameUrl = Utils.$("admin-event-frame-url")?.value.trim();

    if (!frameUrl) return Utils.toast("Укажите изображение (URL)", "error");

    if (!(await Utils.confirm("Точно ВЫДАТЬ РАМКУ ВСЕМ, кто сейчас онлайн?")))
      return;

    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    let count = 0;
    const updates = {};
    for (const [uid, uData] of Object.entries(usersData)) {
      if (uData.status && uData.status.online) {
        const currentInv = uData.profile?.inventory || [];
        if (!currentInv.includes(frameUrl)) {
          updates[`users/${uid}/profile/inventory`] = [...currentInv, frameUrl];
        }
        updates[`users/${uid}/profile/frame`] = frameUrl;
        count++;
      }
    }
    if (count > 0) {
      await update(ref(db), updates);
      Utils.toast(`Рамка выдана ${count} пользователям!`);
    } else {
      Utils.toast(
        "У всех онлайн-пользователей уже есть эта или никого нет онлайн.",
        "info",
      );
    }
  }

  static bindFilters() {
    const filterContainer = Utils.$("catalog-filters");
    if (!filterContainer) return;

    const filterBtns = filterContainer.querySelectorAll("[data-filter]");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active-filter"));
        btn.classList.add("active-filter");
        this.activeFilter = btn.dataset.filter || "all";
        this.renderCatalog();
      });
    });
  }

  static bindSearchAndSort() {
    if (this.filtersBound) return;
    this.filtersBound = true;

    const searchInput = Utils.$("catalog-search-input");
    const searchClear = Utils.$("catalog-search-clear");
    const sortWrapper = Utils.$("catalog-sort-custom");
    const sortTrigger = Utils.$("catalog-sort-trigger");
    const sortLabel = Utils.$("catalog-sort-label");
    const sortMenu = Utils.$("catalog-sort-menu");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = (e.target.value || "").trim().toLowerCase();
        if (searchClear) {
          searchClear.style.display = this.searchQuery ? "flex" : "none";
        }
        this.renderCatalog();
      });
    }

    if (searchClear) {
      searchClear.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        this.searchQuery = "";
        searchClear.style.display = "none";
        this.renderCatalog();
      });
    }

    // Custom Sort Dropdown Handler
    if (sortWrapper && sortTrigger && sortMenu) {
      sortTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = sortWrapper.classList.toggle("open");
        sortTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      const options = sortMenu.querySelectorAll(".catalog-select-option");
      options.forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = opt.getAttribute("data-value") || "featured";
          this.sortBy = val;

          options.forEach((o) => {
            o.classList.remove("active");
            o.setAttribute("aria-selected", "false");
          });
          opt.classList.add("active");
          opt.setAttribute("aria-selected", "true");

          const textEl = opt.querySelector("span");
          if (sortLabel && textEl) {
            sortLabel.textContent = textEl.textContent;
          }

          sortWrapper.classList.remove("open");
          sortTrigger.setAttribute("aria-expanded", "false");
          this.renderCatalog();
        });
      });

      // Close dropdown when clicking outside or pressing Escape
      document.addEventListener("click", (e) => {
        if (!sortWrapper.contains(e.target)) {
          sortWrapper.classList.remove("open");
          sortTrigger.setAttribute("aria-expanded", "false");
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sortWrapper.classList.contains("open")) {
          sortWrapper.classList.remove("open");
          sortTrigger.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  static renderUserStatus() {
    const uid = AppState.currentUser?.uid;
    const currentProf = uid ? AppState.usersCache.get(uid) : null;
    const levelEl = Utils.$("catalog-user-lvl-num");
    if (levelEl) {
      const userLevel = Number(currentProf?.level) || 0;
      levelEl.innerText = `${userLevel} ур.`;
    }
    const lumens = Number(currentProf?.lumens) || 0;
    const headerPill = Utils.$("header-lumens-count");
    if (headerPill) headerPill.textContent = lumens.toLocaleString();
    const myL = Utils.$("my-lumens-val");
    if (myL) myL.textContent = lumens.toLocaleString();
  }

  static renderCatalog() {
    const list = Utils.$("catalog-list");
    if (!list) return;

    const uid = AppState.currentUser?.uid;
    const currentProf = uid ? AppState.usersCache.get(uid) : null;

    this.renderUserStatus();

    const inv = currentProf?.inventory || [];
    const equippedFrame = currentProf?.frame || null;

    // Обновление счетчиков на табах
    const countAll = this.items.length;
    const countHot = this.items.filter((i) => i.isHot === true || i.isHot === "true").length;
    const countFree = this.items.filter(
      (i) => i.priceType === "free" || i.price === "БЕСПЛАТНО" || i.price === "0" || String(i.price).trim().toUpperCase() === "FREE"
    ).length;
    const countPaid = this.items.filter(
      (i) => i.priceType === "paid" && i.price !== "БЕСПЛАТНО" && i.price !== "0" && String(i.price).trim().toUpperCase() !== "FREE"
    ).length;

    if (Utils.$("cat-count-all")) Utils.$("cat-count-all").innerText = countAll;
    if (Utils.$("cat-count-hot")) Utils.$("cat-count-hot").innerText = countHot;
    if (Utils.$("cat-count-free")) Utils.$("cat-count-free").innerText = countFree;
    if (Utils.$("cat-count-paid")) Utils.$("cat-count-paid").innerText = countPaid;

    // Фильтрация по табам
    let filtered = [...this.items];
    if (this.activeFilter === "hot") {
      filtered = filtered.filter((i) => i.isHot === true || i.isHot === "true");
    } else if (this.activeFilter === "free") {
      filtered = filtered.filter(
        (i) => i.priceType === "free" || i.price === "БЕСПЛАТНО" || i.price === "0" || String(i.price).trim().toUpperCase() === "FREE"
      );
    } else if (this.activeFilter === "paid") {
      filtered = filtered.filter(
        (i) => i.priceType === "paid" && i.price !== "БЕСПЛАТНО" && i.price !== "0" && String(i.price).trim().toUpperCase() !== "FREE"
      );
    }

    // Фильтрация по поиску
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter((i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.desc && i.desc.toLowerCase().includes(q))
      );
    }

    // Сортировка
    if (this.sortBy === "price-asc" || this.sortBy === "level-asc") {
      filtered.sort((a, b) => {
        const aPrice = (a.priceType === "free" || a.price === "БЕСПЛАТНО" || a.price === "0" || String(a.price).trim().toUpperCase() === "FREE") ? 0 : parseInt(a.price, 10) || 0;
        const bPrice = (b.priceType === "free" || b.price === "БЕСПЛАТНО" || b.price === "0" || String(b.price).trim().toUpperCase() === "FREE") ? 0 : parseInt(b.price, 10) || 0;
        return aPrice - bPrice;
      });
    } else if (this.sortBy === "price-desc" || this.sortBy === "level-desc") {
      filtered.sort((a, b) => {
        const aPrice = (a.priceType === "free" || a.price === "БЕСПЛАТНО" || a.price === "0" || String(a.price).trim().toUpperCase() === "FREE") ? 0 : parseInt(a.price, 10) || 0;
        const bPrice = (b.priceType === "free" || b.price === "БЕСПЛАТНО" || b.price === "0" || String(b.price).trim().toUpperCase() === "FREE") ? 0 : parseInt(b.price, 10) || 0;
        return bPrice - aPrice;
      });
    } else if (this.sortBy === "title-asc") {
      filtered.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
    } else {
      // featured
      filtered.sort((a, b) => {
        const aHot = a.isHot === true || a.isHot === "true" ? 1 : 0;
        const bHot = b.isHot === true || b.isHot === "true" ? 1 : 0;
        if (bHot !== aHot) return bHot - aHot;
        return (b.id || "").localeCompare(a.id || "");
      });
    }

    // Рендеринг пустого состояния или карточек
    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="catalog-empty-state">
          <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Shopping%20Bags.webp" alt="Empty" class="catalog-empty-emoji">
          <h3 class="catalog-empty-title">Ничего не найдено</h3>
          <p class="catalog-empty-desc">
            ${this.searchQuery ? `По запросу "${Utils.escapeHtml(this.searchQuery)}" предложений не обнаружено.` : "В выбранном разделе каталога сейчас нет доступных предложений."}
          </p>
          ${this.searchQuery || this.activeFilter !== "all" ? `
            <button class="secondary-btn" onclick="CatalogManager.resetFilters()" style="margin-top: 6px; padding: 8px 18px; border-radius: 10px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);">
              Сбросить фильтры
            </button>
          ` : ""}
        </div>
      `;
    } else {
      const userLumens = Number(currentProf?.lumens) || 0;
      const fakeProf = currentProf
        ? { ...currentProf, frame: null }
        : {
            name: "User",
            avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png",
          };
      const userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);

      list.innerHTML = filtered.map((item, idx) => {
        const isOwned = inv.includes(item.id) || (item.image && inv.includes(item.image));
        const isEquipped = equippedFrame === item.id || (item.image && equippedFrame === item.image);
        const isHot = item.isHot === true || item.isHot === "true";
        const isFree = item.priceType === "free" || item.price === "БЕСПЛАТНО" || item.price === "0" || String(item.price).trim().toUpperCase() === "FREE";
        const price = isFree ? 0 : (parseInt(item.price, 10) || 0);
        const canAfford = userLumens >= price;

        let actionBtnHtml = "";
        if (isEquipped) {
          actionBtnHtml = `
            <button class="catalog-card-action-btn btn-equipped" onclick="event.stopPropagation(); window.openCatalogItemModal('${item.id}')">
              ✓ Надето
            </button>
          `;
        } else if (isOwned) {
          actionBtnHtml = `
            <button class="catalog-card-action-btn btn-apply" onclick="event.stopPropagation(); CatalogManager.equipItem('${item.id}')">
              Надеть
            </button>
          `;
        } else if (isFree) {
          actionBtnHtml = `
            <button class="catalog-card-action-btn btn-claim" onclick="event.stopPropagation(); window.openCatalogItemModal('${item.id}')">
              Забрать
            </button>
          `;
        } else if (canAfford) {
          actionBtnHtml = `
            <button class="catalog-card-action-btn btn-apply" onclick="event.stopPropagation(); window.openCatalogItemModal('${item.id}')">
              Купить
            </button>
          `;
        } else {
          actionBtnHtml = `
            <button class="catalog-card-action-btn btn-locked" onclick="event.stopPropagation(); window.openCatalogItemModal('${item.id}')">
              ${price} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">
            </button>
          `;
        }

        return `
          <div class="catalog-item-card ${isHot ? "is-hot" : ""} ${isEquipped ? "is-equipped" : ""}"
               onclick="window.openCatalogItemModal('${item.id}')"
               style="animation: fadeIn 0.3s ease ${idx * 0.025}s both;">
            
            <div class="catalog-card-stage">
              ${item.image ? `<div class="catalog-card-ambient-glow" style="background-image: url('${Utils.escapeHtml(item.image)}');"></div>` : ""}
              
              <div class="catalog-card-badges-top">
                ${isHot ? `
                  <div class="catalog-badge-fire">
                    <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp" alt="Акция">
                    <span>Акция</span>
                  </div>
                ` : `<div></div>`}

                ${isEquipped ? `
                  <div class="catalog-badge-status equipped">Надето</div>
                ` : isFree ? `
                  <div class="catalog-badge-status free">Бесплатно</div>
                ` : `<div></div>`}
              </div>

              <div class="catalog-avatar-showcase">
                <div class="catalog-avatar-core">
                  ${userAvatarInner}
                </div>
                ${item.image ? `
                  <img src="${Utils.escapeHtml(item.image)}" class="catalog-frame-overlay" alt="${Utils.escapeHtml(item.title || "Рамка")}" />
                ` : ""}
              </div>
            </div>

            <div class="catalog-card-body">
              <div class="catalog-card-text-group">
                <span class="catalog-card-type-sub">Временный оффер</span>
                <h3 class="catalog-card-title">${Utils.escapeHtml(item.title || "Без названия")}</h3>
                <p class="catalog-card-desc">${Utils.escapeHtml(item.desc || "Эксклюзивный предмет каталога")}</p>
              </div>

              <div class="catalog-card-footer">
                <div class="catalog-card-price-block">
                  <div class="catalog-price-tag">
                    ${isFree ? `
                      <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="catalog-price-emoji" alt="Free">
                      <span>Бесплатно</span>
                    ` : `
                      <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="catalog-price-emoji" alt="Люмены">
                      <span>${price}</span>
                    `}
                  </div>
                  <div class="catalog-price-status-hint ${canAfford ? "can-buy" : "need-lvl"}">
                    ${canAfford ? "Доступно к покупке" : `Нужно еще ${price - userLumens} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">`}
                  </div>
                </div>

                ${actionBtnHtml}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  static resetFilters() {
    this.searchQuery = "";
    this.activeFilter = "all";
    const searchInput = Utils.$("catalog-search-input");
    if (searchInput) searchInput.value = "";
    const searchClear = Utils.$("catalog-search-clear");
    if (searchClear) searchClear.style.display = "none";

    const filterContainer = Utils.$("catalog-filters");
    if (filterContainer) {
      filterContainer.querySelectorAll("[data-filter]").forEach((b) => {
        if (b.dataset.filter === "all") b.classList.add("active-filter");
        else b.classList.remove("active-filter");
      });
    }

    this.renderCatalog();
  }

  static async equipItem(itemId) {
    if (!AppState.currentUser) return Utils.toast("Авторизуйтесь в профиль", "error");
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;

    const uid = AppState.currentUser.uid;
    const currentProf = AppState.usersCache.get(uid) || {};
    const frameVal = item.image || item.id;

    await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(
      ({ update, ref, getDatabase }) =>
        update(ref(getDatabase()), {
          [`users/${uid}/profile/frame`]: frameVal,
        })
    );

    currentProf.frame = frameVal;
    AppState.usersCache.set(uid, currentProf);

    Utils.toast("Рамка аватара применена!", "success");
    this.renderCatalog();
  }

  static renderAdminCatalog() {
    const list = Utils.$("admin-catalog-list");
    if (!list) return;

    list.innerHTML = this.items
      .map(
        (item) => `
            <div style="border: 1px solid var(--border-light); padding: 10px; border-radius: 8px;">
                <input type="text" id="admin-cat-title-${item.id}" value="${item.title}" class="admin-form-input" placeholder="Название" style="margin-bottom: 4px;"/>
                <input type="text" id="admin-cat-desc-${item.id}" value="${item.desc}" class="admin-form-input" placeholder="Описание" style="margin-bottom: 4px;"/>
                <div style="display:flex; gap: 4px; margin-bottom: 4px;">
                    <select id="admin-cat-pricetype-${item.id}" class="admin-form-input" style="flex:1;" onchange="document.getElementById('admin-cat-price-${item.id}').style.display = this.value === 'free' ? 'none' : 'block';">
                        <option value="free" ${item.priceType === "free" ? "selected" : ""}>Бесплатно</option>
                        <option value="paid" ${item.priceType === "paid" ? "selected" : ""}>За Люмены (✨)</option>
                    </select>
                    <input type="text" id="admin-cat-price-${item.id}" value="${item.price}" class="admin-form-input" placeholder="Цена в Люменах (✨)" style="flex:1; display: ${item.priceType === "free" ? "none" : "block"};"/>
                </div>
                <input type="text" id="admin-cat-img-${item.id}" value="${item.image}" class="admin-form-input" placeholder="URL Картинки/Рамки/Звука" style="margin-bottom: 4px;"/>
                <select id="admin-cat-type-${item.id}" class="admin-form-input" style="margin-bottom: 4px;">
                    <option value="frame" ${item.type === "frame" ? "selected" : ""}>Рамка</option>
                </select>
                <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 8px;">
                    <input type="checkbox" id="admin-cat-ishot-${item.id}" ${item.isHot === true || item.isHot === "true" ? "checked" : ""} style="margin:0; width:16px; height:16px;">
                    <label style="font-size: 12px; color: var(--text-muted); cursor:pointer;" for="admin-cat-ishot-${item.id}">Огненный фон (Акция)</label>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="primary-btn" onclick="CatalogManager.saveAdminItem('${item.id}')" style="flex:1; padding:6px;">Сохранить</button>
                    <button class="danger-btn" onclick="CatalogManager.deleteAdminItem('${item.id}')" style="flex:1; padding:6px;">Удалить</button>
                </div>
            </div>
        `,
      )
      .join("");
  }

  static saveAdminItem(id) {
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель может управлять товарами", "error");
    const isHotCb = Utils.$(`admin-cat-ishot-${id}`);
    const updates = {
      title: Utils.$(`admin-cat-title-${id}`).value,
      desc: Utils.$(`admin-cat-desc-${id}`).value,
      price: Utils.$(`admin-cat-price-${id}`).value,
      priceType: Utils.$(`admin-cat-pricetype-${id}`).value,
      image: Utils.$(`admin-cat-img-${id}`).value,
      type: Utils.$(`admin-cat-type-${id}`).value,
      isHot: isHotCb ? isHotCb.checked : false,
    };
    update(ref(db, `catalog/${id}`), updates).then(() =>
      Utils.toast("Товар сохранен", "success"),
    );
  }

  static async deleteAdminItem(id) {
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель может управлять товарами", "error");
    if (await Utils.confirm("Удалить товар?")) {
      await remove(ref(db, `catalog/${id}`));
      Utils.toast("Товар удален");
    }
  }
}

window.openCatalogItemModal = function (itemId) {
  const item = CatalogManager.items.find((i) => i.id === itemId);
  const modal = Utils.$("modal-catalog-item");
  if (!modal || !item) return;

  Utils.$("catalog-item-title").innerText = item.title || "Без названия";
  Utils.$("catalog-item-desc").innerText = item.desc || "Эксклюзивный предмет каталога";

  const isFree =
    item.priceType === "free" ||
    item.price === "БЕСПЛАТНО" ||
    item.price === "0" ||
    String(item.price).trim().toUpperCase() === "FREE";

  const price = isFree ? 0 : (parseInt(item.price, 10) || 0);

  const priceEl = Utils.$("catalog-item-price");
  if (priceEl) priceEl.innerHTML = isFree ? "БЕСПЛАТНО" : `${price} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon large" alt="✨">`;

  const priceIcon = Utils.$("catalog-item-price-icon");
  if (priceIcon) priceIcon.style.display = isFree ? "none" : "inline-block";

  Utils.$("catalog-item-type-label").innerText = "УКРАШЕНИЕ АВАТАРА";

  const imageSolo = Utils.$("catalog-item-image-solo");
  const avatarBg = Utils.$("catalog-item-avatar-bg");
  const audioSolo = Utils.$("catalog-item-audio-solo");
  const blurObj = Utils.$("catalog-item-bg-blur");

  const uid = AppState.currentUser?.uid;
  let currentProf = uid ? AppState.usersCache.get(uid) : null;
  const userLumens = Number(currentProf?.lumens) || 0;

  const fakeProf = currentProf
    ? { ...currentProf, frame: null }
    : {
        name: "User",
        avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png",
      };
  const userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);

  if (imageSolo) {
    imageSolo.style.display = "block";
    imageSolo.src = item.image || "";
    imageSolo.style.transform = "scale(1)";
  }

  if (avatarBg) {
    avatarBg.style.display = "flex";
    avatarBg.innerHTML = userAvatarInner;
  }

  if (blurObj) {
    blurObj.style.backgroundImage = item.image ? `url('${item.image}')` : "none";
  }

  if (audioSolo) {
    audioSolo.style.display = "none";
    audioSolo.src = "";
  }

  // Настройка тумблера "Примерить" / "Только рамка"
  const btnTryOn = Utils.$("btn-modal-view-tryon");
  const btnSolo = Utils.$("btn-modal-view-solo");

  if (btnTryOn && btnSolo) {
    btnTryOn.classList.add("active");
    btnSolo.classList.remove("active");

    btnTryOn.onclick = () => {
      btnTryOn.classList.add("active");
      btnSolo.classList.remove("active");
      if (avatarBg) avatarBg.style.display = "flex";
      if (imageSolo) {
        imageSolo.style.width = "146px";
        imageSolo.style.height = "146px";
        imageSolo.style.transform = "scale(1)";
      }
    };

    btnSolo.onclick = () => {
      btnSolo.classList.add("active");
      btnTryOn.classList.remove("active");
      if (avatarBg) avatarBg.style.display = "none";
      if (imageSolo) {
        imageSolo.style.width = "170px";
        imageSolo.style.height = "170px";
        imageSolo.style.transform = "scale(1.15)";
      }
    };
  }

  // Обновление плашки баланса в модалке
  const userLumensVal = Utils.$("catalog-modal-user-lumens-val");
  if (userLumensVal) {
    userLumensVal.innerHTML = `${userLumens} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">`;
    userLumensVal.style.color = (isFree || userLumens >= price) ? "#34d399" : "#f87171";
  }

  const userLvlVal = Utils.$("catalog-modal-user-level-val");
  if (userLvlVal) {
    if (isFree || userLumens >= price) {
      userLvlVal.innerHTML = `${userLumens} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨"> (Доступно)`;
      userLvlVal.style.color = "#34d399";
    } else {
      userLvlVal.innerHTML = `${userLumens} / ${price} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨"> (Не хватает)`;
      userLvlVal.style.color = "var(--text-muted)";
    }
  }

  const statusPill = Utils.$("catalog-item-status-pill");
  const inv = currentProf?.inventory || [];
  const isOwned = inv.includes(item.id) || (item.image && inv.includes(item.image));
  const isEquipped = currentProf?.frame === item.id || (item.image && currentProf?.frame === item.image);

  if (statusPill) {
    statusPill.innerText = isEquipped ? "Надето" : item.isHot ? "Акция" : isFree ? "Бесплатно" : "Временный оффер";
    statusPill.style.color = "#ffffff";
    statusPill.style.background = isEquipped ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)";
    statusPill.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  }

  modal.classList.add("active");

  const buyBtn = Utils.$("btn-buy-catalog-item");
  if (buyBtn) {
    if (isEquipped) {
      buyBtn.innerText = "✓ НАДЕТО";
      buyBtn.style.background = "rgba(255, 255, 255, 0.1)";
      buyBtn.style.color = "#ffffff";
      buyBtn.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      buyBtn.style.cursor = "default";
      buyBtn.onclick = null;
    } else if (isOwned) {
      buyBtn.innerText = "НАДЕТЬ РАМКУ";
      buyBtn.style.background = "#ffffff";
      buyBtn.style.color = "#000000";
      buyBtn.style.border = "none";
      buyBtn.style.cursor = "pointer";

      buyBtn.onclick = async () => {
        await CatalogManager.equipItem(item.id);
        modal.classList.remove("active");
      };
    } else if (isFree) {
      buyBtn.innerText = "ЗАБРАТЬ БЕСПЛАТНО";
      buyBtn.style.background = "#ffffff";
      buyBtn.style.color = "#000000";
      buyBtn.style.border = "none";
      buyBtn.style.cursor = "pointer";

      buyBtn.onclick = async () => {
        if (!AppState.currentUser) return Utils.toast("Авторизуйтесь для получения", "error");
        const freshProf = AppState.usersCache.get(uid) || {};
        const currentInv = freshProf?.inventory ? [...freshProf.inventory] : [];
        if (!currentInv.includes(item.id)) currentInv.push(item.id);
        if (item.image && !currentInv.includes(item.image)) currentInv.push(item.image);

        const frameVal = item.image || item.id;
        const { update, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        await update(ref(getDatabase()), {
          [`users/${uid}/profile/inventory`]: currentInv,
          [`users/${uid}/profile/frame`]: frameVal,
        });

        freshProf.inventory = currentInv;
        freshProf.frame = frameVal;
        AppState.usersCache.set(uid, freshProf);

        Utils.toast("Товар получен и надет!", "success");
        CatalogManager.renderCatalog();
        modal.classList.remove("active");
      };
    } else {
      const canAfford = userLumens >= price;
      if (canAfford) {
        buyBtn.innerHTML = `КУПИТЬ ЗА ${price} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">`;
        buyBtn.style.background = "#ffffff";
        buyBtn.style.color = "#000000";
        buyBtn.style.border = "none";
        buyBtn.style.cursor = "pointer";

        buyBtn.onclick = async () => {
          if (!AppState.currentUser) return Utils.toast("Авторизуйтесь для покупки", "error");
          
          const freshProf = AppState.usersCache.get(uid) || {};
          const curLumens = Number(freshProf.lumens) || 0;
          if (curLumens < price) {
            return Utils.toast(`Недостаточно Люменов! Нужно ${price} ✨ (у вас ${curLumens})`, "error");
          }

          const currentInv = freshProf?.inventory ? [...freshProf.inventory] : [];
          if (!currentInv.includes(item.id)) currentInv.push(item.id);
          if (item.image && !currentInv.includes(item.image)) currentInv.push(item.image);

          const frameVal = item.image || item.id;
          const newLumens = curLumens - price;

          const { update, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
          await update(ref(getDatabase()), {
            [`users/${uid}/profile/inventory`]: currentInv,
            [`users/${uid}/profile/frame`]: frameVal,
            [`users/${uid}/profile/lumens`]: newLumens,
          });

          freshProf.inventory = currentInv;
          freshProf.frame = frameVal;
          freshProf.lumens = newLumens;
          AppState.usersCache.set(uid, freshProf);

          if (window.LumenManager) {
            LumenManager.updateBalance(newLumens, {
              diff: -price,
              reason: `Покупка: ${item.title || "Рамка в каталоге"}`,
              source: "catalog",
              animate: true,
              showFloater: true,
              saveTx: true,
              txType: "expense",
              txIcon: "bag"
            });
          } else {
            const hp = Utils.$("header-lumens-count");
            if (hp) hp.textContent = newLumens.toLocaleString();
            const myL = Utils.$("my-lumens-val");
            if (myL) myL.textContent = newLumens.toLocaleString();
          }

          Utils.toast(`Поздравляем! Куплено за ${price} ✨. Рамка надета.`, "success");
          CatalogManager.renderCatalog();
          modal.classList.remove("active");
        };
      } else {
        const needMore = price - userLumens;
        buyBtn.innerHTML = `НЕ ХВАТАЕТ ${needMore} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨"> (У ВАС ${userLumens})`;
        buyBtn.style.background = "rgba(255, 255, 255, 0.06)";
        buyBtn.style.color = "rgba(255, 255, 255, 0.4)";
        buyBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        buyBtn.style.cursor = "pointer";

        buyBtn.onclick = () => {
          Utils.toast(`Для покупки нужно еще ${needMore} Люменов ✨. Смотрите видео в комнатах для заработка!`, "info");
        };
      }
    }
  }

  const previewBtn = Utils.$("btn-preview-catalog-item");
  if (previewBtn) {
    previewBtn.style.display = "none";
  }
};

window.CatalogManager = CatalogManager;
export { CatalogManager };
