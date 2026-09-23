import { db, ref, set, get, push, onValue, remove, update, off } from "./firebase.js";

class SupportSystem {
  static activeTicketId = null;
  static unsubList = null;
  static unsub = null;
  static globalUnsub = null;
  static typingUnsub = null;
  static lastMessageDates = {};
  static lastStatuses = {};
  static typingTimer = null;
  static BANNED_USERS = new Set();
  static TEMPLATES = {
    Приветствие: "Здравствуйте! Чем я могу вам помочь?",
    Ожидание: "Пожалуйста, подождите, мы уточняем информацию.",
    Закрытие: "Рады были помочь! Тикет закрывается.",
  };

  static isStaff(profile = null, uid = null) {
    const currentUid = uid || AppState.currentUser?.uid;
    if (!currentUid) return false;
    const p = profile || (AppState.usersCache ? AppState.usersCache.get(currentUid) : null) || {};
    if (window.AdminPanel && typeof AdminPanel.isSupportStaffProfile === "function") {
      return AdminPanel.isSupportStaffProfile(p, currentUid);
    }
    const r = String(p.role || "").toLowerCase().trim();
    return r === "creator" || r === "moderator" || r === "operator";
  }

  static initGlobalListener() {
    const uid = AppState.currentUser?.uid;
    if (!uid) return;
    const profile = (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
    const isStaff = this.isStaff(profile, uid);
    const isCreator = window.AdminPanel
      ? AdminPanel.isCreatorProfile(profile, uid)
      : false;

    // Use implicit import for onValue/ref
    if (typeof onValue !== "undefined") {
      onValue(ref(db, "support_bans"), (snap) => {
        this.BANNED_USERS = new Set(Object.keys(snap.val() || {}));
      }, (err) => { console.warn("[Support] bans listener note:", err); });
      onValue(ref(db, "support_templates"), (snap) => {
        if (snap.exists())
          this.TEMPLATES = {
            Приветствие: "Здравствуйте! Чем я могу вам помочь?",
            Ожидание: "Пожалуйста, подождите, мы уточняем информацию.",
            Закрытие: "Рады были помочь! Тикет закрывается.",
            ...snap.val(),
          };
      }, (err) => { console.warn("[Support] templates listener note:", err); });
    }

    if (this.globalUnsub) this.globalUnsub();

    this.globalUnsub = onValue(ref(db, "support_tickets"), (snap) => {
      const val = snap.val() || {};
      let hasUnread = false;

      Object.entries(val).forEach(([id, t]) => {
        if (!isStaff) {
          const isSender = t.creatorUid === uid || t.reporterUid === uid;
          if (!isSender || t.targetUid === uid) return;
        } else {
          if (!isCreator && t.targetUid === uid) return;
        }

        if (
          !isStaff &&
          this.lastStatuses[id] &&
          this.lastStatuses[id] !== t.status
        ) {
          if (t.status === "open")
            Utils.toast(`Ваш тикет "${t.title}" был открыт`, "info");
          if (t.status === "closed")
            Utils.toast(`Ваш тикет "${t.title}" был закрыт`, "info");
        }
        this.lastStatuses[id] = t.status;

        const msgs = t.messages || {};
        const msgKeys = Object.keys(msgs);
        if (msgKeys.length > 0) {
          const lastMsg = msgs[msgKeys[msgKeys.length - 1]];

          if (
            this.lastMessageDates[id] &&
            lastMsg.timestamp > this.lastMessageDates[id]
          ) {
            if (
              (!isStaff && lastMsg.isAdmin) ||
              (isStaff && !lastMsg.isAdmin)
            ) {
              if (this.activeTicketId !== id) {
                hasUnread = true;
                Utils.toast(`Новое сообщение в тикете "${t.title}"`, "info");
              }
            }
          }
          this.lastMessageDates[id] = lastMsg.timestamp;
        }
      });

      ["nav-support", "nav-support-staff"].forEach((navId) => {
        const navIcon = Utils.$(navId);
        if (navIcon) {
          let badge = navIcon.querySelector(".support-badge");
          if (hasUnread) {
            if (!badge) {
              badge = document.createElement("div");
              badge.className = "support-badge";
              badge.style.cssText =
                "position: absolute; top: 10px; right: 10px; width: 8px; height: 8px; background: #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ffffff;";
              navIcon.style.position = "relative";
              navIcon.appendChild(badge);
            }
          } else if (badge) {
            badge.remove();
          }
        }
      });
    }, (err) => {
      console.warn("[Support] Global tickets listener note:", err);
    });
  }

  static viewImage(src) {
    if (!src) return;
    let overlay = document.getElementById("support-image-lightbox");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "support-image-lightbox";
      overlay.style.cssText =
        "position: fixed; inset: 0; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 100002; display: flex; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out;";
      overlay.onclick = () => { overlay.style.display = "none"; };
      const img = document.createElement("img");
      img.id = "support-image-lightbox-img";
      img.style.cssText =
        "max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); cursor: default; border: 1px solid rgba(255,255,255,0.15);";
      img.onclick = (e) => e.stopPropagation();
      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "✕";
      closeBtn.style.cssText =
        "position: absolute; top: 20px; right: 20px; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;";
      closeBtn.onclick = () => { overlay.style.display = "none"; };
      overlay.appendChild(img);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);
    }
    const imgEl = document.getElementById("support-image-lightbox-img");
    if (imgEl) imgEl.src = src;
    overlay.style.display = "flex";
  }

  static async openCreatorPanel() {
    const modal = Utils.$("modal-support-creator-panel");
    if (modal) modal.classList.add("active");

    try {
      let total = 0,
        open = 0,
        closed = 0;
      if (typeof get !== "undefined" && typeof ref !== "undefined") {
        const snap = await get(ref(db, "support_tickets"));
        const val = snap.val() || {};
        Object.values(val).forEach((t) => {
          total++;
          if (t.status === "closed") closed++;
          else open++;
        });
      }

      const elTotal = Utils.$("stat-total-tickets");
      if (elTotal) elTotal.innerText = total;
      const elOpen = Utils.$("stat-open-tickets");
      if (elOpen) elOpen.innerText = open;
      const elClosed = Utils.$("stat-closed-tickets");
      if (elClosed) elClosed.innerText = closed;

      this.renderCreatorTemplates();
    } catch (e) {
      console.error("Error in openCreatorPanel:", e);
    }
  }

  static renderCreatorTemplates() {
    const list = Utils.$("support-creator-templates-list");
    if (!list) return;
    if (Object.keys(this.TEMPLATES).length === 0) {
      list.innerHTML = `<div style="color:var(--text-muted); font-size:12px; text-align:center;">Нет шаблонов</div>`;
      return;
    }
    list.innerHTML = Object.entries(this.TEMPLATES)
      .map(
        ([name, text]) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px;">
                <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                    <div style="font-size:12px; font-weight:bold; color:var(--accent);">${name}</div>
                    <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${text}</div>
                </div>
                <button class="danger-btn" style="width:auto; padding:4px 8px; font-size:11px;" onclick="SupportSystem.removeGlobalTemplate('${name}')">Удалить</button>
            </div>
        `,
      )
      .join("");
  }

  static async addGlobalTemplate() {
    const nInput = Utils.$("new-template-name");
    const tInput = Utils.$("new-template-text");
    if (!nInput || !tInput) return;
    const name = nInput.value.trim();
    const text = tInput.value.trim();
    if (!name || !text) return Utils.toast("Заполните все поля", "error");
    if (typeof update !== "undefined" && typeof ref !== "undefined") {
      await update(ref(db, "support_templates"), { [name]: text });
      Utils.toast("Шаблон добавлен", "success");
      nInput.value = "";
      tInput.value = "";
      this.TEMPLATES[name] = text;
      this.renderCreatorTemplates();
      const tContainer = Utils.$("support-inline-templates");
      if (
        tContainer &&
        tContainer.style.display !== "none" &&
        this.activeTicketId
      ) {
        SupportSystem.openTicket(this.activeTicketId);
      }
    }
  }

  static async removeGlobalTemplate(name) {
    if (!(await Utils.confirm('Удалить шаблон "' + name + '"?'))) return;
    if (typeof update !== "undefined" && typeof ref !== "undefined") {
      await update(ref(db, "support_templates"), { [name]: null });
      delete this.TEMPLATES[name];
      this.renderCreatorTemplates();
      const tContainer = Utils.$("support-inline-templates");
      if (
        tContainer &&
        tContainer.style.display !== "none" &&
        this.activeTicketId
      ) {
        SupportSystem.openTicket(this.activeTicketId);
      }
    }
  }

  static async useTemplate(name, id) {
    if (!this.TEMPLATES[name]) return;
    const text = this.TEMPLATES[name];
    await this.sendMessage(id, false, text);
  }

  static currentFilter = "all";
  static searchQuery = "";
  static cachedTickets = [];
  static pendingAttachment = null;
  static modalAttachment = null;
  static isInitialized = false;

  static formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const diff = Date.now() - timestamp;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "только что";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} мин. назад`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  }

  static getCategoryBadgeHtml(cat, isReport = false) {
    if (cat === "Баг") {
      return '<span class="support-card-tag tag-bug"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Bug.webp" class="emoji-animated-xs" alt=""> Баг</span>';
    } else if (cat === "Вопрос") {
      return '<span class="support-card-tag tag-question"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp" class="emoji-animated-xs" alt=""> Вопрос</span>';
    } else if (cat === "Идея") {
      return '<span class="support-card-tag tag-idea"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp" class="emoji-animated-xs" alt=""> Идея</span>';
    } else if (cat === "Жалоба" || isReport) {
      return '<span class="support-card-tag tag-report"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" class="emoji-animated-xs" alt=""> Жалоба</span>';
    }
    return `<span class="support-card-tag"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp" class="emoji-animated-xs" alt=""> ${Utils.escapeHtml(cat || "Тикет")}</span>`;
  }

  static getPriorityBadgeHtml(priority, isPremium = false) {
    if (isPremium) {
      return '<span class="support-card-priority pro"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" class="emoji-animated-xs" alt=""> PRO</span>';
    }
    if (priority === "Высокий" || priority === "Срочный") {
      return `<span class="support-card-priority high"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Heart%20On%20Fire.webp" class="emoji-animated-xs" alt=""> ${Utils.escapeHtml(priority)}</span>`;
    }
    if (priority === "Средний") {
      return `<span class="support-card-priority medium"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Yellow%20Heart.webp" class="emoji-animated-xs" alt=""> ${Utils.escapeHtml(priority)}</span>`;
    }
    return `<span class="support-card-priority low"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Green%20Heart.webp" class="emoji-animated-xs" alt=""> ${Utils.escapeHtml(priority || "Обычный")}</span>`;
  }

  static getCategoryIconUrl(cat, isReport = false) {
    if (cat === "Баг") {
      return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Bug.webp";
    } else if (cat === "Вопрос") {
      return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Question%20Mark.webp";
    } else if (cat === "Идея") {
      return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp";
    } else if (cat === "Жалоба" || isReport) {
      return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp";
    }
    return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp";
  }

  static openCreateModal(defaultCategory = "") {
    const uid = AppState.currentUser?.uid;
    if (this.BANNED_USERS.has(uid)) {
      return Utils.toast("Вы заблокированы в системе поддержки", "error");
    }
    const modal = Utils.$("modal-create-ticket");
    if (!modal) return;

    if (defaultCategory) {
      const catInput = Utils.$("support-new-ticket-category");
      if (catInput) catInput.value = defaultCategory;
      const chips = document.querySelectorAll("#create-ticket-category-chips .category-chip");
      chips.forEach((c) => {
        if (c.getAttribute("data-cat") === defaultCategory) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
    }

    modal.classList.add("active");
    setTimeout(() => {
      const titleInput = Utils.$("support-new-ticket-title");
      if (titleInput) titleInput.focus();
    }, 100);
  }

  static bindUIEvents() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Sidebar header create button
    const btnOpenCreate = Utils.$("btn-open-create-ticket-modal");
    if (btnOpenCreate) {
      btnOpenCreate.onclick = () => this.openCreateModal();
    }

    // Search input
    const searchInput = Utils.$("support-search-input");
    const searchClear = Utils.$("support-search-clear");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim();
        if (searchClear) {
          searchClear.style.display = this.searchQuery ? "block" : "none";
        }
        this.renderFilteredTickets();
      });
    }
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        this.searchQuery = "";
        searchClear.style.display = "none";
        this.renderFilteredTickets();
        if (searchInput) searchInput.focus();
      });
    }

    // Filter tabs
    const filterTabs = document.querySelectorAll("#support-filter-tabs .support-filter-tab");
    filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        filterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.currentFilter = tab.getAttribute("data-filter") || "all";
        this.renderFilteredTickets();
      });
    });

    // Create modal category chips
    const catChips = document.querySelectorAll("#create-ticket-category-chips .category-chip");
    catChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        catChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const val = chip.getAttribute("data-cat");
        const input = Utils.$("support-new-ticket-category");
        if (input) input.value = val;
      });
    });

    // Create modal priority chips
    const priChips = document.querySelectorAll("#create-ticket-priority-chips .priority-chip");
    priChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        priChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const val = chip.getAttribute("data-pri");
        const input = Utils.$("support-new-ticket-priority");
        if (input) input.value = val;
      });
    });

    // Create modal attachment
    const modalAttachBtn = Utils.$("btn-modal-ticket-attach");
    if (modalAttachBtn) {
      modalAttachBtn.onclick = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              let w = img.width, h = img.height;
              const maxDim = 1200;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              canvas.width = w; canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              SupportSystem.modalAttachment = canvas.toDataURL("image/jpeg", 0.65);

              const preview = Utils.$("modal-ticket-attach-preview");
              const previewImg = Utils.$("modal-ticket-preview-img");
              if (preview && previewImg) {
                previewImg.src = SupportSystem.modalAttachment;
                preview.style.display = "inline-flex";
              }
              if (Utils.$("modal-ticket-attach-label")) {
                Utils.$("modal-ticket-attach-label").innerText = "Заменить";
              }
            };
            img.src = re.target.result;
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      };
    }

    const modalRemoveAttach = Utils.$("btn-modal-remove-attach");
    if (modalRemoveAttach) {
      modalRemoveAttach.onclick = () => {
        SupportSystem.modalAttachment = null;
        const preview = Utils.$("modal-ticket-attach-preview");
        if (preview) preview.style.display = "none";
        if (Utils.$("modal-ticket-attach-label")) {
          Utils.$("modal-ticket-attach-label").innerText = "Прикрепить картинку";
        }
      };
    }

    // Ticket creation button handler
    const btnNew = Utils.$("btn-new-ticket");
    if (btnNew) {
      btnNew.onclick = async () => {
        const uid = AppState.currentUser?.uid;
        if (!uid) return Utils.toast("Вы не авторизованы", "error");
        if (this.BANNED_USERS.has(uid)) {
          return Utils.toast("Вы заблокированы в системе поддержки", "error");
        }

        const inputTitle = Utils.$("support-new-ticket-title");
        const inputCategory = Utils.$("support-new-ticket-category");
        const inputPriority = Utils.$("support-new-ticket-priority");
        const inputText = Utils.$("support-new-ticket-text");

        const title = inputTitle ? inputTitle.value.trim() : "";
        const category = inputCategory ? inputCategory.value.trim() : "Вопрос";
        const priority = inputPriority ? inputPriority.value.trim() : "Средний";
        const text = inputText ? inputText.value.trim() : "";

        if (!title) {
          Utils.toast("Пожалуйста, укажите тему обращения", "warning");
          if (inputTitle) inputTitle.focus();
          return;
        }
        if (!text) {
          Utils.toast("Пожалуйста, подробно опишите ваш вопрос или проблему", "warning");
          if (inputText) inputText.focus();
          return;
        }

        btnNew.disabled = true;
        btnNew.innerHTML = "<span>Создание...</span>";

        try {
          const newRef = push(ref(db, "support_tickets"));
          const ts = Date.now();
          const profile = (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
          const isPremiumUser =
            window.PremiumManager &&
            PremiumManager.isPremiumActive(profile, uid) &&
            !PremiumManager.isStaff(profile, uid);

          await set(newRef, {
            title,
            category,
            priority: isPremiumUser && priority !== "Срочный" ? "Высокий" : priority,
            creatorUid: uid,
            status: "open",
            createdAt: ts,
            lastActivity: ts,
            lastSender: uid,
            lastSenderIsAdmin: false,
            problemDescription: text,
            isPremium: Boolean(isPremiumUser),
          });

          await push(ref(db, `support_tickets/${newRef.key}/messages`), {
            text: text,
            image: SupportSystem.modalAttachment || null,
            uid,
            name: profile?.name || "Пользователь",
            username: profile?.username || uid,
            avatar: profile?.avatar || "",
            isAdmin: false,
            timestamp: ts,
          });

          // Reset inputs
          if (inputTitle) inputTitle.value = "";
          if (inputText) inputText.value = "";
          SupportSystem.modalAttachment = null;
          const preview = Utils.$("modal-ticket-attach-preview");
          if (preview) preview.style.display = "none";
          if (Utils.$("modal-ticket-attach-label")) {
            Utils.$("modal-ticket-attach-label").innerText = "Прикрепить картинку";
          }

          document.getElementById("modal-create-ticket")?.classList.remove("active");
          Utils.toast("Обращение успешно создано!", "success");

          // Open the newly created ticket immediately
          SupportSystem.openTicket(newRef.key);
        } catch (err) {
          console.error("Error creating ticket:", err);
          Utils.toast("Не удалось создать тикет: " + err.message, "error");
        } finally {
          btnNew.disabled = false;
          btnNew.innerHTML = "Создать";
        }
      };
    }
  }

  static async renderTickets() {
    const uid = AppState.currentUser?.uid;
    if (!uid) return;
    const profile =
      (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
    const isStaff = this.isStaff(profile, uid);
    const isCreator = window.AdminPanel
      ? AdminPanel.isCreatorProfile(profile, uid)
      : false;

    // Creator panel button
    const panelBtn = Utils.$("btn-support-creator-panel");
    if (panelBtn) {
      panelBtn.style.display = isCreator ? "inline-flex" : "none";
      panelBtn.onclick = () => this.openCreatorPanel();
    }

    // Reports filter tab is only visible to staff
    const reportsTab = Utils.$("tab-filter-reports");
    if (reportsTab) {
      reportsTab.style.display = isStaff ? "inline-flex" : "none";
    }

    // Bind search and filter events once
    this.bindUIEvents();

    if (this.unsubList) this.unsubList();
    const dbRef = ref(db, "support_tickets");
    this.unsubList = onValue(dbRef, (snap) => {
      const val = snap.val() || {};
      let tickets = Object.entries(val).map(([id, t]) => ({ id, ...t }));

      if (!isStaff) {
        // Regular user: can ONLY see tickets they created/reported, and NEVER tickets where they are accused!
        tickets = tickets.filter((t) => {
          const isSender = t.creatorUid === uid || t.reporterUid === uid;
          const isTarget = t.targetUid === uid;
          return isSender && !isTarget;
        });
      } else {
        // Staff: can see all tickets, but not complaints where they are the accused target (unless creator of the app)
        if (!isCreator) {
          tickets = tickets.filter((t) => t.targetUid !== uid);
        }
      }

      this.cachedTickets = tickets;
      this.updateCountsAndBadges();
      this.renderFilteredTickets();
    }, (err) => {
      console.warn("[Support] Tickets list listener note:", err);
    });
  }

  static updateCountsAndBadges() {
    const tickets = this.cachedTickets || [];
    const allCount = tickets.length;
    const openCount = tickets.filter((t) => t.status !== "closed").length;
    const closedCount = tickets.filter((t) => t.status === "closed").length;
    const reportsCount = tickets.filter((t) =>
      Boolean(t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба")
    ).length;

    const bAll = Utils.$("badge-count-all");
    if (bAll) bAll.innerText = allCount;
    const bOpen = Utils.$("badge-count-open");
    if (bOpen) bOpen.innerText = openCount;
    const bClosed = Utils.$("badge-count-closed");
    if (bClosed) bClosed.innerText = closedCount;
    const bReports = Utils.$("badge-count-reports");
    if (bReports) bReports.innerText = reportsCount;
  }

  static renderFilteredTickets() {
    const list = Utils.$("support-tickets-list");
    if (!list) return;
    const uid = AppState.currentUser?.uid;
    const profile = (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
    const isStaff = this.isStaff(profile, uid);
    const isAdmin = isStaff;

    let tickets = [...(this.cachedTickets || [])];

    // Filter by tab
    if (this.currentFilter === "open") {
      tickets = tickets.filter((t) => t.status !== "closed");
    } else if (this.currentFilter === "closed") {
      tickets = tickets.filter((t) => t.status === "closed");
    } else if (this.currentFilter === "reports") {
      tickets = tickets.filter((t) =>
        Boolean(t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба")
      );
    }

    // Filter by search query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tickets = tickets.filter((t) => {
        const titleMatch = (t.title || "").toLowerCase().includes(q);
        const descMatch = (t.problemDescription || "").toLowerCase().includes(q);
        const catMatch = (t.category || "").toLowerCase().includes(q);
        let msgMatch = false;
        if (t.messages) {
          msgMatch = Object.values(t.messages).some((m) =>
            (m.text || "").toLowerCase().includes(q)
          );
        }
        return titleMatch || descMatch || catMatch || msgMatch;
      });
    }

    if (tickets.length === 0) {
      const emptyMsg = this.searchQuery
        ? "По запросу ничего не найдено"
        : this.currentFilter === "open"
          ? "Нет открытых обращений"
          : this.currentFilter === "closed"
            ? "Нет закрытых обращений"
            : this.currentFilter === "reports"
              ? "Жалоб нет"
              : "У вас пока нет обращений";

      list.innerHTML = `
        <div class="support-empty-list">
          <div class="empty-list-icon">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp" style="width: 28px; height: 28px; opacity: 0.6;">
          </div>
          <div class="empty-list-title">${emptyMsg}</div>
          <div class="empty-list-desc">Создайте новое обращение, если вам нужна помощь</div>
          <button type="button" class="primary-btn empty-list-btn" onclick="SupportSystem.openCreateModal()">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Pen.webp" style="width: 13px; height: 13px;">
            <span>Создать обращение</span>
          </button>
        </div>
      `;
      return;
    }

    // Sort: open first, then by priority, then by lastActivity or createdAt
    tickets.sort((a, b) => {
      const isOpenA = a.status !== "closed" ? 1 : 0;
      const isOpenB = b.status !== "closed" ? 1 : 0;
      if (isOpenA !== isOpenB) return isOpenB - isOpenA;

      const priorityOrder = {
        Срочный: 4,
        Высокий: 3,
        Средний: 2,
        Обычный: 1,
        Низкий: 0,
      };
      const pA = priorityOrder[a.priority] || 1;
      const pB = priorityOrder[b.priority] || 1;
      if (pA !== pB) return pB - pA;

      const timeA = a.lastActivity || a.createdAt || 0;
      const timeB = b.lastActivity || b.createdAt || 0;
      return timeB - timeA;
    });

    list.innerHTML = tickets
      .map((t) => {
        const titleStr = Utils.escapeHtml(t.title || "Без темы");
        const isOpen = t.status !== "closed";
        const isReport = Boolean(
          t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба"
        );
        const isActive = this.activeTicketId === t.id;

        // Last message snippet
        let lastSnippet = "";
        if (t.messages) {
          const msgsArr = Object.values(t.messages);
          if (msgsArr.length > 0) {
            const lastM = msgsArr[msgsArr.length - 1];
            const senderPrefix = lastM.isAdmin ? "Оператор: " : "";
            lastSnippet = Utils.escapeHtml(senderPrefix + (lastM.text || (lastM.image ? "[Изображение]" : "")));
          }
        }
        if (!lastSnippet && t.problemDescription) {
          lastSnippet = Utils.escapeHtml(t.problemDescription);
        }

        // Unread dot
        const hasUnread =
          t.lastActivity &&
          t.lastActivity > (t.readReceipts?.[uid] || 0) &&
          t.lastSender !== uid &&
          (isAdmin || t.lastSenderIsAdmin);

        const timeStr = this.formatRelativeTime(t.lastActivity || t.createdAt);
        const categoryBadge = this.getCategoryBadgeHtml(t.category, isReport);
        const categoryIcon = this.getCategoryIconUrl(t.category, isReport);

        const priorityBadge =
          t.priority && (isAdmin || t.priority === "Высокий" || t.priority === "Срочный")
            ? this.getPriorityBadgeHtml(t.priority, t.isPremium)
            : "";

        return `
          <div class="support-ticket-card ${isActive ? "active" : ""} ${isOpen ? "" : "closed"}" onclick="SupportSystem.openTicket('${t.id}')">
            <div class="support-card-icon">
              <img src="${categoryIcon}" alt="">
            </div>
            <div class="support-card-main">
              <div class="support-card-header-row">
                <span class="support-card-title">${titleStr}</span>
                <div class="support-card-meta">
                  <span class="support-card-time">${timeStr}</span>
                  ${hasUnread ? '<span class="support-card-unread" title="Новые сообщения"></span>' : ""}
                </div>
              </div>
              <div class="support-card-sub-row">
                <span class="support-status-chip ${isOpen ? "open" : "closed"}">
                  <span class="status-dot"></span>
                  <span>${isOpen ? "В работе" : "Решён"}</span>
                </span>
                ${categoryBadge}
                ${priorityBadge}
                ${lastSnippet ? `<span class="support-card-snippet">${lastSnippet}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  static async openTicket(id) {
    const uid = AppState.currentUser?.uid;
    if (!uid) return;
    this.activeTicketId = id;

    // Mark as read in RTDB
    set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());

    // Highlight active item in left tickets feed
    this.renderFilteredTickets();

    const layoutContainer = Utils.$("support-grid-container");
    if (layoutContainer) layoutContainer.classList.add("chat-active");

    const btnBack = Utils.$("btn-support-back");
    if (btnBack) {
      btnBack.style.display = window.innerWidth <= 1024 ? "inline-flex" : "none";
      btnBack.onclick = () => {
        if (layoutContainer) layoutContainer.classList.remove("chat-active");
        SupportSystem.activeTicketId = null;
        if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "none";
        if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "flex";
        SupportSystem.renderFilteredTickets();
      };
    }

    if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "none";
    if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "flex";

    const profile = (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
    const isStaff = SupportSystem.isStaff(profile, uid);
    const isAdmin = isStaff;

    if (this.unsub) this.unsub();
    this.unsub = onValue(ref(db, `support_tickets/${id}`), async (snap) => {
      const t = snap.val();
      if (!t) return;
      if (this.activeTicketId !== id) return;

      // Access verification:
      if (!isStaff) {
        const isSender = t.creatorUid === uid || t.reporterUid === uid;
        const isTarget = t.targetUid === uid;
        if (!isSender || isTarget) {
          Utils.toast("У вас нет доступа к данному тикету", "error");
          SupportSystem.activeTicketId = null;
          if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "none";
          if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "flex";
          return;
        }
      } else {
        const isCreator = window.AdminPanel ? AdminPanel.isCreatorProfile(profile, uid) : false;
        if (!isCreator && t.targetUid === uid) {
          Utils.toast("Вы не можете просматривать жалобу на самого себя", "error");
          SupportSystem.activeTicketId = null;
          if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "none";
          if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "flex";
          return;
        }
      }

      // Mark read
      if (!t.readReceipts || t.readReceipts[uid] < (t.lastActivity || 0)) {
        set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());
      }

      // Header info
      const titleEl = Utils.$("support-ticket-title-text");
      if (titleEl) titleEl.innerText = t.title || "Без темы";

      const idChip = Utils.$("support-ticket-id-chip");
      if (idChip) idChip.innerText = "#" + id.slice(-6).toUpperCase();

      const catIcon = Utils.$("support-ticket-category-icon");
      const isReport = Boolean(t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба");
      if (catIcon) {
        catIcon.innerHTML = `<img src="${SupportSystem.getCategoryIconUrl(t.category, isReport)}" style="width: 20px; height: 20px;">`;
      }

      const isClosed = t.status === "closed";
      const statusEl = Utils.$("st-status");
      if (statusEl) {
        statusEl.className = `support-status-chip ${isClosed ? "closed" : "open"}`;
        statusEl.innerHTML = `
          <span class="status-dot"></span>
          <span>${isClosed ? "Решён" : "В работе"}</span>
        `;
      }

      const tagEl = Utils.$("st-tag");
      if (tagEl) {
        if (t.category) {
          tagEl.style.display = "inline-flex";
          tagEl.innerHTML = this.getCategoryBadgeHtml(t.category, isReport);
        } else {
          tagEl.style.display = "none";
        }
      }

      const priEl = Utils.$("st-priority");
      if (priEl) {
        if (t.priority && (isAdmin || t.priority === "Высокий" || t.priority === "Срочный")) {
          priEl.style.display = "inline-flex";
          priEl.innerHTML = this.getPriorityBadgeHtml(t.priority, t.isPremium);
        } else {
          priEl.style.display = "none";
        }
      }

      // Operator report card or problem description details
      const opInfo = Utils.$("support-operator-ticket-info");
      if (opInfo) {
        if (isReport && t.targetUid) {
          opInfo.style.display = "block";
          const reporterUid = t.reporterUid || t.creatorUid;
          const targetUid = t.targetUid;
          const reporterProf =
            (AppState.usersCache ? AppState.usersCache.get(reporterUid) : null) || t.reporterInfo || {};
          const targetProf =
            (AppState.usersCache ? AppState.usersCache.get(targetUid) : null) || t.targetInfo || {};

          opInfo.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 14px; padding: 14px 16px; margin: 12px 20px 0; backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px;">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" style="width: 16px; height: 16px;" alt="🚩">
                    Жалоба на пользователя
                  </span>
                  <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #ffffff; font-weight: 600;">
                    ${Utils.escapeHtml(t.reportCategory || "Нарушение")}
                  </span>
                </div>
                ${isAdmin ? `
                  <div style="display: flex; gap: 8px;">
                    <button class="secondary-btn" style="padding: 6px 12px; font-size: 11.5px; font-weight: 600; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.06); color: #ffffff; cursor: pointer;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(targetUid)}')">
                      Профиль нарушителя
                    </button>
                    <button class="primary-btn" style="padding: 6px 14px; font-size: 11.5px; font-weight: 700; border-radius: 8px; cursor: pointer; background: #ffffff; color: #000000; border: none; box-shadow: 0 4px 14px rgba(255, 255, 255, 0.18);" onclick="AdminPanel.openUserInAdmin('${Utils.escapeHtml(targetUid)}')">
                      Панель управления
                    </button>
                  </div>
                ` : ""}
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 12px;">
                  <div style="font-size: 10px; color: rgba(255, 255, 255, 0.45); text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.4px;">
                    Отправитель жалобы:
                  </div>
                  <div class="report-user-card-pill" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 8px;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(reporterUid)}')">
                    <div style="width: 34px; height: 34px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #111; border: 1px solid rgba(255,255,255,0.15);">
                      ${ProfileManager.getAvatarHtml(reporterProf)}
                    </div>
                    <div style="overflow: hidden; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${Utils.escapeHtml(reporterProf.name || "Пользователь")}
                      </div>
                      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        @${Utils.escapeHtml(reporterProf.username || reporterUid)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 10px 12px;">
                  <div style="font-size: 10px; color: rgba(255, 255, 255, 0.7); text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.4px;">
                    На кого пожаловались:
                  </div>
                  <div class="report-user-card-pill target" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 8px;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(targetUid)}')">
                    <div style="width: 34px; height: 34px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #111; border: 1px solid rgba(255,255,255,0.3);">
                      ${ProfileManager.getAvatarHtml(targetProf)}
                    </div>
                    <div style="overflow: hidden; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${Utils.escapeHtml(targetProf.name || "Пользователь")}
                      </div>
                      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        @${Utils.escapeHtml(targetProf.username || targetUid)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
                <div style="font-size: 10px; color: rgba(255, 255, 255, 0.45); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">
                  Суть жалобы:
                </div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.9); line-height: 1.45; white-space: pre-wrap;">
                  ${Utils.escapeHtml(t.problemDescription || "Описание не указано")}
                </div>
              </div>
            </div>
          `;
        } else if (isAdmin && t.problemDescription) {
          opInfo.style.display = "block";
          opInfo.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px 16px; margin: 12px 20px 0;">
              <div style="font-size: 10.5px; color: rgba(255, 255, 255, 0.55); font-weight: 700; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                Сведения о проблеме
              </div>
              <div style="font-size: 13px; color: rgba(255, 255, 255, 0.88); white-space: pre-wrap; line-height: 1.45;">
                ${Utils.escapeHtml(t.problemDescription)}
              </div>
            </div>
          `;
        } else {
          opInfo.style.display = "none";
        }
      }

      // Inline templates for staff
      const templateContainer = Utils.$("support-inline-templates");
      if (templateContainer) {
        if (isAdmin && !isClosed) {
          templateContainer.style.display = "flex";
          templateContainer.innerHTML = Object.keys(this.TEMPLATES)
            .map(
              (k) =>
                `<button type="button" class="support-template-btn" onclick="SupportSystem.useTemplate('${k}', '${id}')">${k}</button>`
            )
            .join("");
        } else {
          templateContainer.style.display = "none";
        }
      }

      // Closed resolution bar and composer dock toggles
      const composeDock = Utils.$("support-compose-dock");
      const closedBanner = Utils.$("support-closed-banner");

      if (isClosed) {
        if (composeDock) composeDock.style.display = "none";
        if (closedBanner) closedBanner.style.display = "block";
      } else {
        if (composeDock) composeDock.style.display = "block";
        if (closedBanner) closedBanner.style.display = "none";
      }

      // Reopen overlay CTA button
      const btnReopenOverlay = Utils.$("btn-support-reopen-overlay");
      if (btnReopenOverlay) {
        btnReopenOverlay.onclick = () => this.reopenTicket(id);
      }

      // Action buttons in header
      const btnClose = Utils.$("btn-support-close-ticket");
      const btnReopen = Utils.$("btn-support-reopen-ticket");
      const quickActionsBtn = Utils.$("btn-support-quick-actions");
      const quickMenu = Utils.$("support-quick-actions-menu");

      if (isAdmin) {
        if (btnClose) {
          btnClose.style.display = isClosed ? "none" : "inline-flex";
          btnClose.onclick = () => this.closeTicket(id);
        }
        if (btnReopen) {
          btnReopen.style.display = isClosed ? "inline-flex" : "none";
          btnReopen.onclick = () => this.reopenTicket(id);
        }
        if (quickActionsBtn) {
          quickActionsBtn.style.display = "inline-flex";
          quickActionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (quickMenu) {
              if (quickMenu.style.display === "flex") {
                quickMenu.style.display = "none";
              } else {
                quickMenu.style.display = "flex";
                quickMenu.innerHTML = `
                  <div style="font-size:10px; color:rgba(255,255,255,0.45); margin-bottom:4px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Сменить категорию:</div>
                  <button class="support-popover-item" onclick="SupportSystem.setCategory('${id}', 'Вопрос')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp" class="emoji-animated-sm" alt="">
                    <span>Вопрос</span>
                  </button>
                  <button class="support-popover-item" onclick="SupportSystem.setCategory('${id}', 'Баг')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Bug.webp" class="emoji-animated-sm" alt="">
                    <span>Баг</span>
                  </button>
                  <button class="support-popover-item" onclick="SupportSystem.setCategory('${id}', 'Жалоба')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" class="emoji-animated-sm" alt="">
                    <span>Жалоба</span>
                  </button>
                  <button class="support-popover-item" onclick="SupportSystem.setCategory('${id}', 'Идея')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Light%20Bulb.webp" class="emoji-animated-sm" alt="">
                    <span>Идея</span>
                  </button>
                  <div class="support-popover-divider"></div>
                  <button class="support-popover-item" onclick="SupportSystem.exportTicket('${id}')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Package.webp" class="emoji-animated-sm" alt="">
                    <span>Экспорт как .txt</span>
                  </button>
                  <button class="support-popover-item danger" onclick="SupportSystem.adminBan('${t.creatorUid}')">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Cross%20Mark.webp" class="emoji-animated-sm" alt="">
                    <span>Блокировка в поддержке</span>
                  </button>
                `;
              }
            }
          };
        }
      } else {
        if (btnClose) btnClose.style.display = "none";
        if (btnReopen) btnReopen.style.display = "none";
        if (quickActionsBtn) quickActionsBtn.style.display = "none";
        if (quickMenu) quickMenu.style.display = "none";
      }

      document.onmousedown = (ev) => {
        if (quickMenu && !quickMenu.contains(ev.target) && ev.target !== quickActionsBtn) {
          quickMenu.style.display = "none";
        }
      };

      // Render Messages
      const chat = Utils.$("support-ticket-chat");
      const msgs = t.messages || {};

      const uidsToLoad = new Set();
      if (t.creatorUid) uidsToLoad.add(t.creatorUid);
      if (t.reporterUid) uidsToLoad.add(t.reporterUid);
      if (t.targetUid) uidsToLoad.add(t.targetUid);
      Object.values(msgs).forEach((m) => {
        if (m.uid) uidsToLoad.add(m.uid);
        if (m.reporterUid) uidsToLoad.add(m.reporterUid);
        if (m.targetUid) uidsToLoad.add(m.targetUid);
      });

      if (typeof ProfileManager !== "undefined" && ProfileManager.loadUser) {
        await Promise.all(
          Array.from(uidsToLoad)
            .filter((uUid) => !AppState.usersCache?.has(uUid))
            .map((uUid) => ProfileManager.loadUser(uUid).catch(() => null))
        );
      }

      const sortedMsgs = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp);

      if (sortedMsgs.length === 0) {
        chat.innerHTML = `
          <div class="support-chat-empty">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Speech%20Balloon.webp" style="width: 42px; height: 42px; object-fit: contain;" alt="">
            <div class="support-chat-empty-title">Диалог начат</div>
            <div class="support-chat-empty-desc">Напишите сообщение ниже — специалист поддержки ответит вам в ближайшее время</div>
          </div>
        `;
      } else {
        let lastDatePill = "";
        chat.innerHTML = sortedMsgs
          .map((m) => {
            try {
              const sentDate = new Date(m.timestamp || Date.now());
              const datePillStr = sentDate.toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              });
              let dateHeaderHtml = "";
              if (datePillStr !== lastDatePill) {
                dateHeaderHtml = `
                  <div class="support-date-divider">
                    <span class="support-date-pill">${datePillStr}</span>
                  </div>
                `;
                lastDatePill = datePillStr;
              }

              const timeStr =
                sentDate.getHours().toString().padStart(2, "0") +
                ":" +
                sentDate.getMinutes().toString().padStart(2, "0");

              const mUid = m.uid || "unknown";
              const cachedUser = AppState.usersCache ? AppState.usersCache.get(mUid) : null;
              const userProfile = cachedUser || {
                name: m.name || "Пользователь",
                username: m.username || mUid,
                avatar: m.avatar || "",
                frame: cachedUser?.frame || "",
              };
              const mName = Utils.escapeHtml(userProfile.name || "Пользователь");
              const mUsername = Utils.escapeHtml(userProfile.username || mUid);

              const isMe = mUid === uid;
              const isMsgAdmin = Boolean(m.isAdmin);

              if (isMe) {
                // Outgoing message (my own message):
                // Clean right-aligned bubble, NO avatar, NO name header.
                return dateHeaderHtml + `
                  <div class="support-msg-row me">
                    <div class="support-msg-bubble">
                      <div class="support-msg-body">${Utils.escapeHtml(m.text || "")}</div>
                      ${m.image ? `<img src="${Utils.escapeHtml(m.image)}" class="support-msg-image" alt="Вложение" onclick="SupportSystem.viewImage(this.src)">` : ""}
                      <div class="support-msg-time">${timeStr}</div>
                    </div>
                  </div>
                `;
              } else if (isMsgAdmin) {
                // Incoming message from operator:
                const avatarHtml = ProfileManager.getAvatarHtml(userProfile);
                return dateHeaderHtml + `
                  <div class="support-msg-row operator">
                    <div class="support-msg-avatar" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(mUid)}')" title="${mName}">
                      ${avatarHtml}
                    </div>
                    <div class="support-msg-bubble">
                      <div class="support-msg-header">
                        <span class="support-operator-badge">
                          <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Briefcase.webp" class="emoji-animated-xs" alt="">
                          Поддержка COWIO
                        </span>
                        <span class="support-msg-sender" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(mUid)}')">${mName}</span>
                      </div>
                      <div class="support-msg-body">${Utils.escapeHtml(m.text || "")}</div>
                      ${m.image ? `<img src="${Utils.escapeHtml(m.image)}" class="support-msg-image" alt="Вложение" onclick="SupportSystem.viewImage(this.src)">` : ""}
                      <div class="support-msg-time">${timeStr}</div>
                    </div>
                  </div>
                `;
              } else {
                // Incoming message from user:
                const avatarHtml = ProfileManager.getAvatarHtml(userProfile);
                return dateHeaderHtml + `
                  <div class="support-msg-row user">
                    <div class="support-msg-avatar" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(mUid)}')" title="${mName}">
                      ${avatarHtml}
                    </div>
                    <div class="support-msg-bubble">
                      <div class="support-msg-header">
                        <span class="support-msg-sender" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(mUid)}')">${mName}</span>
                        <span class="support-msg-handle">@${mUsername}</span>
                      </div>
                      <div class="support-msg-body">${Utils.escapeHtml(m.text || "")}</div>
                      ${m.image ? `<img src="${Utils.escapeHtml(m.image)}" class="support-msg-image" alt="Вложение" onclick="SupportSystem.viewImage(this.src)">` : ""}
                      <div class="support-msg-time">${timeStr}</div>
                    </div>
                  </div>
                `;
              }
            } catch (e) {
              console.error("Error rendering message:", e);
              return "";
            }
          })
          .join("");
      }

      setTimeout(() => {
        chat.scrollTop = chat.scrollHeight;
      }, 50);
    }, (err) => {
      console.warn("[Support] Active ticket listener note:", err);
    });

    // Realtime Typing Indicator
    if (this.typingUnsub) this.typingUnsub();
    this.typingUnsub = onValue(ref(db, `support_tickets_typing/${id}`), (snap) => {
      const val = snap.val() || {};
      const othersTyping = Object.keys(val).filter((k) => k !== uid && Date.now() - val[k] < 3500);
      const indicator = Utils.$("support-typing-indicator");
      if (indicator) {
        indicator.style.display = othersTyping.length > 0 ? "inline-flex" : "none";
      }
    }, (err) => {
      console.warn("[Support] Typing listener note:", err);
    });

    // Composer Input & Send setup
    const btnSend = Utils.$("btn-support-send");
    const input = Utils.$("support-msg-input");

    if (btnSend) {
      btnSend.onclick = () => this.sendMessage(id);
    }

    if (input) {
      input.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage(id);
        }
      };
      input.oninput = () => {
        // Auto grow textarea
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";

        if (this.typingTimer) clearTimeout(this.typingTimer);
        set(ref(db, `support_tickets_typing/${id}/${uid}`), Date.now());
        this.typingTimer = setTimeout(
          () => remove(ref(db, `support_tickets_typing/${id}/${uid}`)),
          3000
        );
      };
    }

    // Composer Attachment
    const btnAttach = Utils.$("btn-support-attach");
    if (btnAttach) {
      btnAttach.onclick = () => {
        const inputImg = document.createElement("input");
        inputImg.type = "file";
        inputImg.accept = "image/*";
        inputImg.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              let w = img.width, h = img.height;
              const maxDim = 1200;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              canvas.width = w; canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              SupportSystem.pendingAttachment = canvas.toDataURL("image/jpeg", 0.65);

              const attachWrap = Utils.$("support-pending-attachment");
              const attachImg = Utils.$("support-pending-attachment-img");
              const attachName = Utils.$("support-pending-attachment-name");
              if (attachWrap && attachImg) {
                attachImg.src = SupportSystem.pendingAttachment;
                if (attachName) attachName.innerText = file.name || "screenshot.png";
                attachWrap.style.display = "inline-flex";
              }
            };
            img.src = re.target.result;
          };
          reader.readAsDataURL(file);
        };
        inputImg.click();
      };
    }

    const btnRemovePendingAttach = Utils.$("btn-support-remove-pending-attachment");
    if (btnRemovePendingAttach) {
      btnRemovePendingAttach.onclick = () => {
        SupportSystem.pendingAttachment = null;
        const attachWrap = Utils.$("support-pending-attachment");
        if (attachWrap) attachWrap.style.display = "none";
      };
    }
  }

  static async sendMessage(
    ticketId,
    isInternal = false,
    textOverride = "",
    imageBase64 = null
  ) {
    const uid = AppState.currentUser?.uid;
    if (!uid) return Utils.toast("Вы не авторизованы", "error");
    if (this.BANNED_USERS.has(uid)) {
      return Utils.toast("Вы заблокированы в поддержке!", "error");
    }

    const input = Utils.$("support-msg-input");
    const msg = textOverride || (input ? input.value.trim() : "");
    const imgToSend = imageBase64 || SupportSystem.pendingAttachment || null;

    if (!msg && !imgToSend) return;

    const profile = (AppState.usersCache ? AppState.usersCache.get(uid) : null) || {};
    const isAdmin = SupportSystem.isStaff(profile, uid);
    const ts = Date.now();

    try {
      await push(ref(db, `support_tickets/${ticketId}/messages`), {
        text: msg,
        image: imgToSend,
        uid,
        name: profile?.name || "Пользователь",
        username: profile?.username || uid,
        avatar: profile?.avatar || "",
        isAdmin,
        isInternal,
        timestamp: ts,
      });

      await update(ref(db, `support_tickets/${ticketId}`), {
        lastActivity: ts,
        lastSender: uid,
        lastSenderIsAdmin: isAdmin,
      });

      if (input) {
        input.value = "";
        input.style.height = "42px";
      }

      SupportSystem.pendingAttachment = null;
      const attachWrap = Utils.$("support-pending-attachment");
      if (attachWrap) attachWrap.style.display = "none";

      if (this.typingTimer) clearTimeout(this.typingTimer);
      remove(ref(db, `support_tickets_typing/${ticketId}/${uid}`));

      const chat = Utils.$("support-ticket-chat");
      if (chat) {
        setTimeout(() => {
          chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
        }, 40);
      }
    } catch (e) {
      console.error("Send message error:", e);
      Utils.toast("Ошибка отправки: " + e.message, "error");
    }
  }

  static async closeTicket(id) {
    if (!(await Utils.confirm("Закрыть это обращение?"))) return;
    await update(ref(db, `support_tickets/${id}`), { status: "closed", closedAt: Date.now() });
    Utils.toast("Тикет закрыт", "info");
  }

  static async reopenTicket(id) {
    await update(ref(db, `support_tickets/${id}`), { status: "open", lastActivity: Date.now() });
    Utils.toast("Тикет возобновлен", "success");
  }

  static async setCategory(id, cat) {
    await update(ref(db, `support_tickets/${id}`), { category: cat });
    Utils.toast("Категория обновлена: " + cat, "success");
    if (Utils.$("support-quick-actions-menu")) {
      Utils.$("support-quick-actions-menu").style.display = "none";
    }
  }

  static async exportTicket(id) {
    try {
      const snap = await get(ref(db, `support_tickets/${id}`));
      const t = snap.val();
      if (!t) return Utils.toast("Тикет не найден", "error");
      let str = `=== ТИКЕТ: ${t.title || "Без темы"} ===\n`;
      str += `ID: ${id}\n`;
      str += `Категория: ${t.category || "Общее"}\n`;
      str += `Приоритет: ${t.priority || "Обычный"}\n`;
      str += `Статус: ${t.status || "open"}\n`;
      str += `Создан: ${new Date(t.createdAt || Date.now()).toLocaleString()}\n`;
      str += `Автор UID: ${t.creatorUid || "—"}\n\n`;
      str += `--- ОПИСАНИЕ ---\n${t.problemDescription || "—"}\n\n`;
      str += `--- ПЕРЕПИСКА ---\n`;
      const msgs = Object.values(t.messages || {}).sort((a, b) => a.timestamp - b.timestamp);
      msgs.forEach((m) => {
        const time = new Date(m.timestamp || Date.now()).toLocaleString();
        const sender = m.isAdmin ? `[Поддержка] ${m.name || "Оператор"}` : `${m.name || "Пользователь"} (@${m.username || m.uid})`;
        str += `[${time}] ${sender}:\n${m.text || ""}\n`;
        if (m.image) str += `[Вложение: изображение включено]\n`;
        str += `\n`;
      });
      const blob = new Blob([str], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ticket_${id.slice(-6)}_${Date.now()}.txt`;
      a.click();
      Utils.toast("Тикет экспортирован в .txt", "success");
    } catch (e) {
      console.error("Export ticket error:", e);
      Utils.toast("Ошибка экспорта", "error");
    }
  }

  static async adminBan(uid) {
    if (!uid) return;
    const isBanned = this.BANNED_USERS.has(uid);
    const action = isBanned ? "Разблокировать" : "Заблокировать";
    if (!(await Utils.confirm(`${action} пользователя в поддержке?`))) return;
    if (isBanned) {
      await remove(ref(db, `support_bans/${uid}`));
      this.BANNED_USERS.delete(uid);
      Utils.toast("Пользователь разблокирован в поддержке", "success");
    } else {
      await set(ref(db, `support_bans/${uid}`), {
        bannedAt: Date.now(),
        bannedBy: AppState.currentUser?.uid || "admin",
      });
      this.BANNED_USERS.add(uid);
      Utils.toast("Пользователь заблокирован в поддержке", "success");
    }
    if (Utils.$("support-quick-actions-menu")) {
      Utils.$("support-quick-actions-menu").style.display = "none";
    }
  }

  static async exportArchiveTickets() {
    const snap = await get(ref(db, "support_tickets"));
    const val = snap.val() || {};
    let str = "=== ЭКСПОРТ АРХИВНЫХ (ЗАКРЫТЫХ) ТИКЕТОВ ===\n\n";
    Object.values(val).forEach((t) => {
      if (t.status === "open") return;
      str += `[ID: ${t.id}] ${t.title} (от ${t.creatorUid})\n`;
      Object.values(t.messages || {}).forEach((m) => {
        str += `  - ${m.name}: ${m.text}\n`;
      });
      str += "\n";
    });
    const blob = new Blob([str], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `archived_tickets_${Date.now()}.txt`;
    a.click();
  }

  static async exportAllTickets() {
    const snap = await get(ref(db, "support_tickets"));
    const val = snap.val() || {};
    let str = "=== ЭКСПОРТ ВСЕХ АКТИВНЫХ ТИКЕТОВ ===\n\n";
    Object.values(val).forEach((t) => {
      if (t.status !== "open") return;
      str += `[ID: ${t.id}] ${t.title} (от ${t.creatorUid})\n`;
      Object.values(t.messages || {}).forEach((m) => {
        str += `  - ${m.name}: ${m.text}\n`;
      });
      str += "\n";
    });
    const blob = new Blob([str], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `active_tickets_${Date.now()}.txt`;
    a.click();
  }

  static async forceSyncAllTickets(filter = "all") {
    const confirmMsg =
      filter === "old"
        ? "Удалить все закрытые тикеты старше 7 дней?"
        : "Удалить все закрытые тикеты?";
    if (!(await Utils.confirm(confirmMsg))) return;
    const snap = await get(ref(db, "support_tickets"));
    const val = snap.val() || {};
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const [id, t] of Object.entries(val)) {
      if (t.status === "closed") {
        if (filter === "old" && t.createdAt && now - Number(t.createdAt) < sevenDays) {
          continue;
        }
        await remove(ref(db, `support_tickets/${id}`));
        count++;
      }
    }
    Utils.toast(`Удалено тикетов: ${count}`, "success");
    this.openCreatorPanel();
  }

  static refreshCreatorStats() {
    this.openCreatorPanel();
    Utils.toast("Данные обновлены", "success");
  }

  static async deleteTicketLocally() {
    if (!this.activeTicketId) return;
    if (!(await Utils.confirm("Точно удалить это обращение?"))) return;
    const id = this.activeTicketId;

    try {
      this.activeTicketId = null;
      if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "none";
      if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "flex";

      const layoutContainer = Utils.$("support-grid-container");
      if (layoutContainer) layoutContainer.classList.remove("chat-active");

      await remove(ref(db, `support_tickets/${id}`));
      Utils.toast("Тикет удален", "success");
    } catch (e) {
      console.error("Error deleting ticket:", e);
      Utils.toast("Ошибка при удалении: " + e.message, "error");
    }
  }

  static async closeAllActiveTickets() {
    if (
      !(await Utils.confirm(
        "Закрыть все открытые тикеты? Это действие нельзя отменить.",
      ))
    )
      return;
    const snap = await get(ref(db, "support_tickets"));
    const val = snap.val() || {};
    let c = 0;
    Object.keys(val).forEach((k) => {
      if (val[k].status === "open") {
        update(ref(db, `support_tickets/${k}`), { status: "closed", closedAt: Date.now() });
        c++;
      }
    });
    Utils.toast(`Закрыто тикетов: ${c}`);
    this.openCreatorPanel();
  }

  static async deleteAllTickets() {
    if (
      !(await Utils.confirm(
        "ВНИМАНИЕ! Это действие удалит все тикеты без возможности восстановления. Продолжить?",
      ))
    )
      return;
    if (!(await Utils.confirm("Вы абсолютно уверены?"))) return;
    await remove(ref(db, "support_tickets"));
    Utils.toast("Все тикеты успешно удалены", "success");
    this.openCreatorPanel();
  }

  static async resetTemplates() {
    if (
      !(await Utils.confirm(
        "Удалить все текущие шаблоны и сбросить на стандартные?",
      ))
    )
      return;
    const defaults = {
      Приветствие: "Здравствуйте! Чем я могу вам помочь?",
      Ожидание: "Пожалуйста, подождите, мы уточняем информацию.",
      Закрытие: "Рады были помочь! Тикет закрывается.",
    };
    await set(ref(db, "support_templates"), defaults);
    this.TEMPLATES = defaults;
    Utils.toast("Шаблоны сброшены", "success");
    this.renderCreatorTemplates();
  }

  static async clearAllBans() {
    if (
      !(await Utils.confirm(
        "Разблокировать всех пользователей в модуле поддержки?",
      ))
    )
      return;
    await remove(ref(db, "support_bans"));
    this.BANNED_USERS.clear();
    Utils.toast("Все пользователи разблокированы", "success");
  }
}
window.SupportSystem = SupportSystem;
export { SupportSystem };
