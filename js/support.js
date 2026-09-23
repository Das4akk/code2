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

  static initGlobalListener() {
    const uid = AppState.currentUser?.uid;
    if (!uid) return;
    const profile = AppState.usersCache.get(uid) || {};
    const isAdmin =
      AdminPanel.isCreatorProfile(profile, uid) ||
      AdminPanel.isOperatorProfile(profile, uid);

    // Use implicit import for onValue/ref
    if (typeof onValue !== "undefined") {
      onValue(ref(db, "support_bans"), (snap) => {
        this.BANNED_USERS = new Set(Object.keys(snap.val() || {}));
      });
      onValue(ref(db, "support_templates"), (snap) => {
        if (snap.exists())
          this.TEMPLATES = {
            Приветствие: "Здравствуйте! Чем я могу вам помочь?",
            Ожидание: "Пожалуйста, подождите, мы уточняем информацию.",
            Закрытие: "Рады были помочь! Тикет закрывается.",
            ...snap.val(),
          };
      });
    }

    if (this.globalUnsub) this.globalUnsub();

    this.globalUnsub = onValue(ref(db, "support_tickets"), (snap) => {
      const val = snap.val() || {};
      let hasUnread = false;

      Object.entries(val).forEach(([id, t]) => {
        if (!isAdmin && t.creatorUid !== uid) return;

        if (
          !isAdmin &&
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
              (!isAdmin && lastMsg.isAdmin) ||
              (isAdmin && !lastMsg.isAdmin)
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

      const navIcon = Utils.$("nav-support") || Utils.$("nav-support-staff");
      if (navIcon) {
        let badge = navIcon.querySelector(".support-badge");
        if (hasUnread) {
          if (!badge) {
            badge = document.createElement("div");
            badge.className = "support-badge";
            badge.style.cssText =
              "position: absolute; top: 10px; right: 10px; width: 10px; height: 10px; background: red; border-radius: 50%;";
            navIcon.style.position = "relative";
            navIcon.appendChild(badge);
          }
        } else if (badge) {
          badge.remove();
        }
      }
    });
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

  static async renderTickets() {
    const uid = AppState.currentUser?.uid;
    if (!uid) return;
    const profile =
      AppState.usersCache.get(AppState.currentUser?.uid) || {} || {};
    const isAdmin =
      AdminPanel.isCreatorProfile(profile, uid) ||
      AdminPanel.isOperatorProfile(profile, uid);
    const isCreator = AdminPanel.isCreatorProfile(profile, uid);
    const list = Utils.$("support-tickets-list");

    const panelBtn = Utils.$("btn-support-creator-panel");
    if (panelBtn) {
      panelBtn.style.display = isCreator ? "block" : "none";
      panelBtn.onclick = () => this.openCreatorPanel();
    }

    const btnOpenCreate = Utils.$("btn-open-create-ticket-modal");
    if (btnOpenCreate)
      btnOpenCreate.onclick = () => {
        if (this.BANNED_USERS.has(uid))
          return Utils.toast("Вы заблокированы в системе поддержки", "error");
        const m = Utils.$("modal-create-ticket");
        if (m) m.classList.add("active");
      };

    if (this.unsubList) this.unsubList();
    const dbRef = ref(db, "support_tickets");
    this.unsubList = onValue(dbRef, (snap) => {
      const val = snap.val() || {};
      let tickets = Object.entries(val).map(([id, t]) => ({ id, ...t }));
      if (!isAdmin) {
        tickets = tickets.filter((t) => t.creatorUid === uid);
        tickets = tickets.filter((t) => t.status !== "closed"); // Hide for creator visually
      }
      if (tickets.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">Тикетов нет</div>`;
        return;
      }
      tickets.sort((a, b) => {
        const priorityOrder = {
          Срочный: 3,
          Высокий: 2,
          Средний: 1,
          Обычный: 0,
        };
        const pA = priorityOrder[a.priority] || 0;
        const pB = priorityOrder[b.priority] || 0;
        if (pA !== pB) return pB - pA;
        return b.createdAt - a.createdAt;
      });
      list.innerHTML = tickets
        .map((t) => {
          const titleStr = Utils.escapeHtml(t.title || "Без темы");
          const titleEscaped = titleStr
            .replace(/'/g, "\\'")
            .replace(/"/g, "&quot;"); // escape to insert to onclick
          const isOpen = t.status === "open";
          const statusText = isOpen
            ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);padding:1px 7px;border-radius:100px;"><span style="width:5px;height:5px;border-radius:50%;background:#ffffff;box-shadow:0 0 6px #fff;display:inline-block;"></span>В работе</span>'
            : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.45);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:1px 7px;border-radius:100px;">Закрыт</span>';
          let priorityHtml = t.priority
            ? `<span class="ticket-priority-label" style="margin-left:6px;font-size:10px;padding:2px 7px;border-radius:100px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.85);font-weight:600;">${t.priority}</span>`
            : "";
          if (t.isPremium) {
            priorityHtml = `<span style="margin-left:6px;font-size:10px;padding:2px 8px;border-radius:100px;background:#ffffff;color:#000000;font-weight:800;">${t.priority || "PRO"}</span>`;
          }
          const premiumMark = t.isPremium
            ? `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:14px;height:14px;margin-left:6px;vertical-align:middle;" title="Premium">`
            : "";
          const unreadDot =
            t.lastActivity &&
            t.lastActivity > (t.readReceipts?.[uid] || 0) &&
            t.lastSender !== uid &&
            (isAdmin || t.lastSenderIsAdmin)
              ? `<div style="width:7px;height:7px;border-radius:50%;background:#ffffff;margin-left:8px;flex-shrink:0;box-shadow:0 0 8px #ffffff;" title="Новые сообщения"></div>`
              : "";

          const isReportTicket = Boolean(t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба");
          const categoryEmoji =
            t.category === "Баг"
              ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Bug.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">'
              : t.category === "Вопрос"
                ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Question%20Mark.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">'
                : isReportTicket
                  ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">'
                  : '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">';

          const reportBadge = isReportTicket
            ? `<span style="margin-left:6px;font-size:10px;padding:2px 7px;border-radius:100px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);color:#ffffff;font-weight:700;">Жалоба</span>`
            : "";

          return `
                <div class="dm-chat-item ${this.activeTicketId === t.id ? "active" : ""}" onclick="SupportSystem.openTicket('${t.id}')">
                    <div class="dm-chat-avatar" style="width:38px;height:38px;border-radius:12px;background:rgba(255, 255, 255, 0.05);border:1px solid rgba(255, 255, 255, 0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${categoryEmoji}
                    </div>
                    <div class="dm-chat-info" style="min-width:0;flex:1;">
                        <div class="dm-chat-name" style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:4px;">
                           <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px;font-weight:700;color:#ffffff;">${titleStr}${premiumMark}</span>
                           ${unreadDot}
                        </div>
                        <div class="dm-chat-last-msg" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${statusText}${reportBadge}${isAdmin ? priorityHtml : ""}</div>
                    </div>
                </div>`;
        })
        .join("");
    });

    const btnNew = Utils.$("btn-new-ticket");
    if (btnNew)
      btnNew.onclick = async () => {
        if (this.BANNED_USERS.has(uid))
          return Utils.toast("Вы заблокированы в системе поддержки", "error");
        const inputEl = Utils.$("support-new-ticket-title");
        const priorityEl = Utils.$("support-new-ticket-priority");
        const textEl = Utils.$("support-new-ticket-text");
        const title = inputEl ? inputEl.value.trim() : "";
        const priority = priorityEl ? priorityEl.value : "Средний";
        const text = textEl ? textEl.value.trim() : "";

        if (!title || !text) return;
        const newRef = push(ref(db, "support_tickets"));
        const ts = Date.now();
        const profile = AppState.usersCache.get(uid) || {};
        const isPremiumUser =
          window.PremiumManager &&
          PremiumManager.isPremiumActive(profile, uid) &&
          !PremiumManager.isStaff(profile, uid);
        await set(newRef, {
          title,
          priority:
            isPremiumUser && priority !== "Срочный" ? "Высокий" : priority,
          creatorUid: uid,
          status: "open",
          createdAt: ts,
          lastActivity: ts,
          lastSender: uid,
          problemDescription: text,
          isPremium: Boolean(isPremiumUser),
        });
        await push(ref(db, `support_tickets/${newRef.key}/messages`), {
          text: text,
          uid,
          name: profile?.name || "Пользователь",
          username: profile?.username || uid,
          avatar: profile?.avatar || "",
          isAdmin: false,
          timestamp: ts,
        });

        if (inputEl) inputEl.value = "";
        if (textEl) textEl.value = "";
        document
          .getElementById("modal-create-ticket")
          ?.classList.remove("active");
        SupportSystem.openTicket(newRef.key);
      };
  }

  static async openTicket(id) {
    const uid = AppState.currentUser?.uid;
    this.activeTicketId = id;

    set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());

    const items = document.querySelectorAll(
      "#support-tickets-list .dm-chat-item",
    );
    items.forEach((el) => el.classList.remove("active"));
    const clickedItem = Array.from(items).find((el) =>
      el.getAttribute("onclick").includes(id),
    );
    if (clickedItem) clickedItem.classList.add("active");

    const layoutContainer = Utils.$("support-grid-container");
    if (layoutContainer) layoutContainer.classList.add("chat-active");

    const btnBack = Utils.$("btn-support-back");
    if (btnBack) {
      btnBack.style.display = window.innerWidth <= 1024 ? "inline-flex" : "none";
      btnBack.onclick = () => {
        if (layoutContainer) layoutContainer.classList.remove("chat-active");
        SupportSystem.activeTicketId = null;
        const activeItem = document.querySelector("#support-tickets-list .dm-chat-item.active");
        if (activeItem) activeItem.classList.remove("active");
        if (Utils.$("support-active-ticket")) Utils.$("support-active-ticket").style.display = "none";
        if (Utils.$("support-no-ticket")) Utils.$("support-no-ticket").style.display = "flex";
      };
    }

    Utils.$("support-no-ticket").style.display = "none";
    Utils.$("support-active-ticket").style.display = "flex";

    const profile =
      AppState.usersCache.get(AppState.currentUser?.uid) || {} || {};
    const isAdmin =
      AdminPanel.isCreatorProfile(profile, uid) ||
      AdminPanel.isOperatorProfile(profile, uid);

    if (this.unsub) this.unsub();
    this.unsub = onValue(ref(db, `support_tickets/${id}`), async (snap) => {
      const t = snap.val();
      if (!t) return;
      if (this.activeTicketId !== id) return;

      // Setup auto-read if we are watching this chat
      if (!t.readReceipts || t.readReceipts[uid] < (t.lastActivity || 0)) {
        set(ref(db, `support_tickets/${id}/readReceipts/${uid}`), Date.now());
      }

      const templateContainer = Utils.$("support-inline-templates");
      if (templateContainer) {
        if (isAdmin) {
          templateContainer.style.display = "flex";
          templateContainer.innerHTML = Object.keys(this.TEMPLATES)
            .map(
              (k) =>
                `<button class="secondary-btn" style="padding:5px 12px; width:auto; flex-shrink:0; font-size:11.5px; font-weight:600; border-radius:100px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#ffffff; cursor:pointer;" onclick="SupportSystem.useTemplate('${k}', '${id}')">${k}</button>`,
            )
            .join("");
        } else {
          templateContainer.style.display = "none";
        }
      }

      Utils.$("support-ticket-title-text").innerText = t.title || "Без темы";
      const isClosed = t.status === "closed";
      const openTimeStr = Math.floor(
        (Date.now() - (t.createdAt || Date.now())) / 3600000,
      );
      Utils.$("st-status").innerHTML = isClosed
        ? '<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);display:inline-block;"></span>Закрыт</span>'
        : `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.22);color:#ffffff;font-size:12px;font-weight:700;"><span style="width:6px;height:6px;border-radius:50%;background:#ffffff;box-shadow:0 0 8px rgba(255,255,255,0.9);display:inline-block;"></span>В работе</span> ${isAdmin ? `<span style="opacity:0.5;font-weight:500;font-size:11px;margin-left:4px;">(${openTimeStr} ч. назад)</span>` : ""}`;

      if (t.category) {
        Utils.$("st-tag").style.display = "inline-block";
        Utils.$("st-tag").innerText = t.category;
      } else {
        Utils.$("st-tag").style.display = "none";
      }

      const opInfo = Utils.$("support-operator-ticket-info");
      const isReport = Boolean(
        t.isReport || t.targetUid || t.reportType === "profile" || t.category === "Жалоба",
      );
      if (opInfo) {
        if (isReport && t.targetUid) {
          opInfo.style.display = "block";
          const reporterUid = t.reporterUid || t.creatorUid;
          const targetUid = t.targetUid;
          const reporterProf =
            AppState.usersCache.get(reporterUid) || t.reporterInfo || {};
          const targetProf =
            AppState.usersCache.get(targetUid) || t.targetInfo || {};

          opInfo.innerHTML = `
            <div style="background: rgba(255, 75, 75, 0.08); border: 1px solid rgba(255, 75, 75, 0.25); border-radius: 14px; padding: 14px 16px; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 11px; font-weight: 800; color: #ff4757; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px;">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" style="width: 16px; height: 16px;" alt="🚩">
                    Жалоба на содержание профиля
                  </span>
                  <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255, 75, 75, 0.18); color: #ff6b81; font-weight: 600;">
                    ${Utils.escapeHtml(t.reportCategory || "Нарушение")}
                  </span>
                </div>
                ${isAdmin ? `
                  <div style="display: flex; gap: 6px;">
                    <button class="secondary-btn" style="padding: 4px 10px; font-size: 11px; border-radius: 6px; border: 1px solid rgba(255, 75, 75, 0.35); color: #ff6b81; cursor: pointer;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(targetUid)}')">
                      Профиль нарушителя
                    </button>
                    <button class="danger-btn" style="padding: 4px 10px; font-size: 11px; border-radius: 6px; cursor: pointer;" onclick="AdminPanel.loadUserEditor('${Utils.escapeHtml(targetUid)}')">
                      В панель управления
                    </button>
                  </div>
                ` : ""}
              </div>

              <!-- Two Clickable Accounts: Reporter and Reported -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <!-- 1. Отправитель жалобы -->
                <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 12px;">
                  <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.4px;">
                    Отправитель жалобы:
                  </div>
                  <div class="report-user-card-pill" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.15s;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(reporterUid)}')">
                    <div style="width: 36px; height: 36px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #111; border: 1px solid rgba(255,255,255,0.15);">
                      ${ProfileManager.getAvatarHtml(reporterProf)}
                    </div>
                    <div style="overflow: hidden; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${Utils.escapeHtml(reporterProf.name || "Пользователь")}
                      </div>
                      <div style="font-size: 11px; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        @${Utils.escapeHtml(reporterProf.username || reporterUid)}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 2. На кого пожаловались -->
                <div style="background: rgba(255, 75, 75, 0.07); border: 1px solid rgba(255, 75, 75, 0.28); border-radius: 12px; padding: 10px 12px;">
                  <div style="font-size: 10px; color: #ff6b81; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.4px;">
                    На кого пожаловались:
                  </div>
                  <div class="report-user-card-pill target" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.15s;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(targetUid)}')">
                    <div style="width: 36px; height: 36px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #111; border: 1px solid rgba(255,75,75,0.4);">
                      ${ProfileManager.getAvatarHtml(targetProf)}
                    </div>
                    <div style="overflow: hidden; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 700; color: #ff6b81; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${Utils.escapeHtml(targetProf.name || "Пользователь")}
                      </div>
                      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        @${Utils.escapeHtml(targetProf.username || targetUid)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Описание сути жалобы -->
              <div style="background: rgba(0, 0, 0, 0.35); border-radius: 8px; padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.06);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">
                  Суть жалобы от пользователя:
                </div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.9); line-height: 1.45; white-space: pre-wrap;">
                  ${Utils.escapeHtml(t.problemDescription || "Описание не указано")}
                </div>
              </div>
            </div>
          `;
        } else if (isAdmin) {
          opInfo.style.display = "block";
          opInfo.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px 16px;">
              <div style="font-size: 10.5px; color: rgba(255, 255, 255, 0.55); font-weight: 700; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                Сведения о проблеме (Для оператора)
              </div>
              <div id="support-operator-ticket-desc" style="font-size: 13px; color: rgba(255, 255, 255, 0.88); white-space: pre-wrap; line-height: 1.45;">
                ${Utils.escapeHtml(t.problemDescription || "Пользователь не оставил описания")}
              </div>
            </div>
          `;
        } else {
          opInfo.style.display = "none";
        }
      }

      // handle blur and lock for closed
      const overlay = Utils.$("support-closed-overlay");
      const dmCompose = Utils.$("support-active-ticket").querySelector(
        ".dm-compose",
      );
      const inlineTmplate = Utils.$("support-inline-templates");
      const closedBanner = Utils.$("support-closed-banner");
      const chatArea = Utils.$("support-ticket-chat");

      if (isClosed) {
        if (overlay) overlay.style.display = "flex";
        if (dmCompose) dmCompose.style.display = "none";
        if (closedBanner) closedBanner.style.display = "block";
        if (inlineTmplate) inlineTmplate.style.display = "none";
        if (chatArea) {
          chatArea.style.filter = "blur(4px)";
          chatArea.style.pointerEvents = "none";
        }
      } else {
        if (overlay) overlay.style.display = "none";
        if (dmCompose) dmCompose.style.display = "flex";
        if (closedBanner) closedBanner.style.display = "none";
        if (isAdmin && inlineTmplate) inlineTmplate.style.display = "flex";
        if (chatArea) {
          chatArea.style.filter = "none";
          chatArea.style.pointerEvents = "auto";
        }
      }

      const btnReopenOverlay = Utils.$("btn-support-reopen-overlay");
      if (btnReopenOverlay) {
        btnReopenOverlay.style.display = "block";
        btnReopenOverlay.onclick = () => this.reopenTicket(id);
      }

      if (isAdmin) {
        Utils.$("btn-support-close-ticket").style.display = isClosed
          ? "none"
          : "block";
        Utils.$("btn-support-reopen-ticket").style.display = isClosed
          ? "block"
          : "none";
        Utils.$("btn-support-close-ticket").onclick = () =>
          this.closeTicket(id);
        Utils.$("btn-support-reopen-ticket").onclick = () =>
          this.reopenTicket(id);

        const quickActionsBtn = Utils.$("btn-support-quick-actions");
        const quickMenu = Utils.$("support-quick-actions-menu");
        if (quickActionsBtn) {
          quickActionsBtn.style.display = "block";
          quickActionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (quickMenu) {
              if (quickMenu.style.display === "flex") {
                quickMenu.style.display = "none";
              } else {
                quickMenu.style.display = "flex";
                quickMenu.innerHTML = `
                  <div style="font-size:10.5px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Теги:</div>
                  <button class="secondary-btn" style="text-align:left; padding:8px 10px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#fff; cursor:pointer;" onclick="SupportSystem.setCategory('${id}', 'Баг')">🐛 Баг</button>
                  <button class="secondary-btn" style="text-align:left; padding:8px 10px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#fff; cursor:pointer;" onclick="SupportSystem.setCategory('${id}', 'Вопрос')">❔ Вопрос</button>
                  <div style="border-top:1px solid rgba(255,255,255,0.08); margin: 4px 0;"></div>
                  <button class="secondary-btn" style="text-align:left; padding:8px 10px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#fff; cursor:pointer;" onclick="SupportSystem.exportTicket('${id}')">📥 Экспорт как .txt</button>
                  <button class="danger-btn" style="text-align:left; padding:8px 10px; font-size:12px; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; margin-top:2px; cursor:pointer;" onclick="SupportSystem.adminBan('${t.creatorUid}')">🚫 Заблокировать автора</button>
                `;
              }
            }
          };
        }
        // Ensure we remove previous event listeners or avoid duplicate globals, using onmousedown instead of addEventListener for simplicity
        document.onmousedown = (ev) => {
          if (
            quickMenu &&
            !quickMenu.contains(ev.target) &&
            ev.target !== quickActionsBtn
          ) {
            quickMenu.style.display = "none";
          }
        };
      }

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

      await Promise.all(
        Array.from(uidsToLoad)
          .filter((uUid) => !AppState.usersCache.has(uUid))
          .map((uUid) => ProfileManager.loadUser(uUid)),
      );

      chat.innerHTML = Object.values(msgs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((m) => {
          try {
            const sentDate = new Date(m.timestamp || Date.now());
            const timeStr =
              sentDate.getHours().toString().padStart(2, "0") +
              ":" +
              sentDate.getMinutes().toString().padStart(2, "0");

            if (m.isReportNotice) {
              const repUid = m.reporterUid || m.uid || t.reporterUid || t.creatorUid;
              const tarUid = m.targetUid || t.targetUid;
              const repUser = (AppState.usersCache ? AppState.usersCache.get(repUid) : null) || t.reporterInfo || {};
              const tarUser = (AppState.usersCache ? AppState.usersCache.get(tarUid) : null) || t.targetInfo || {};
              const repName = Utils.escapeHtml(repUser.name || m.name || "Пользователь");
              const repNick = Utils.escapeHtml(repUser.username || m.username || repUid);
              const tarName = Utils.escapeHtml(tarUser.name || "Пользователь");
              const tarNick = Utils.escapeHtml(tarUser.username || tarUid);

              return `
                <div style="width: 100%; margin: 6px 0 10px; background: linear-gradient(135deg, rgba(255, 75, 75, 0.12), rgba(28, 20, 24, 0.9)); border: 1px solid rgba(255, 75, 75, 0.35); border-radius: 16px; padding: 14px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.45);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255, 75, 75, 0.2); padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Flags/Triangular%20Flag.webp" style="width: 20px; height: 20px;" alt="🚩">
                      <span style="font-size: 13px; font-weight: 800; color: #ff6b81;">Жалоба на содержание профиля</span>
                      <span style="font-size: 10px; padding: 2px 7px; border-radius: 4px; background: rgba(255,75,75,0.25); color: #fff; font-weight:600;">${Utils.escapeHtml(m.reportCategory || t.reportCategory || "Нарушение")}</span>
                    </div>
                    <span style="font-size: 11px; color: rgba(255,255,255,0.45);">${timeStr}</span>
                  </div>

                  <!-- Two Clickable Accounts: Reporter and Reported -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                    <!-- 1. Отправитель жалобы -->
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 8px 10px;">
                      <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 5px;">
                        Отправитель жалобы:
                      </div>
                      <div class="report-user-card-pill" style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(repUid)}')">
                        <div style="width: 32px; height: 32px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #222; border: 1px solid rgba(255,255,255,0.2);">
                          ${ProfileManager.getAvatarHtml(repUser)}
                        </div>
                        <div style="overflow: hidden; min-width: 0;">
                          <div style="font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${repName}</div>
                          <div style="font-size: 11px; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">@${repNick}</div>
                        </div>
                      </div>
                    </div>

                    <!-- 2. На кого пожаловались -->
                    <div style="background: rgba(255, 75, 75, 0.1); border: 1px solid rgba(255, 75, 75, 0.3); border-radius: 10px; padding: 8px 10px;">
                      <div style="font-size: 10px; color: #ff6b81; text-transform: uppercase; font-weight: 700; margin-bottom: 5px;">
                        На кого пожаловались:
                      </div>
                      <div class="report-user-card-pill target" style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="ProfileManager.openViewProfileModal('${Utils.escapeHtml(tarUid)}')">
                        <div style="width: 32px; height: 32px; border-radius: 50%; overflow: visible; flex-shrink: 0; background: #222; border: 1px solid rgba(255,75,75,0.4);">
                          ${ProfileManager.getAvatarHtml(tarUser)}
                        </div>
                        <div style="overflow: hidden; min-width: 0;">
                          <div style="font-size: 12px; font-weight: 700; color: #ff6b81; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tarName}</div>
                          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">@${tarNick}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style="background: rgba(0, 0, 0, 0.32); border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.45; color: #fff; white-space: pre-wrap; word-break: break-word;">${Utils.escapeHtml(m.text || "")}</div>
                </div>
              `;
            }

            const mUid = m.uid || "unknown";
            const cachedUser = AppState.usersCache
              ? AppState.usersCache.get(mUid)
              : null;
            const mName = Utils.escapeHtml(
              cachedUser
                ? cachedUser.name || "Пользователь"
                : m.name || "Пользователь",
            );
            const mUsername = Utils.escapeHtml(
              cachedUser ? cachedUser.username || mUid : m.username || mUid,
            );
            const mAvatar = Utils.escapeHtml(
              cachedUser ? cachedUser.avatar || "" : m.avatar || "",
            );
            const isMe = mUid === uid;
            const bg = isMe
              ? "rgba(255, 255, 255, 0.12)"
              : m.isInternal
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(255, 255, 255, 0.04)";
            const borderCol = isMe
              ? "rgba(255, 255, 255, 0.22)"
              : m.isInternal
                ? "rgba(255, 255, 255, 0.18)"
                : "rgba(255, 255, 255, 0.08)";
            const avatarHtml = !isMe
              ? `<div style="width:34px;height:34px;border-radius:12px;background-image:url('${mAvatar}');background-size:cover;background-position:center;background-color:#1c1c22;flex-shrink:0;cursor:pointer;border:1px solid rgba(255,255,255,0.12);" onclick="ProfileManager.openProfileModal('${Utils.escapeHtml(mUid)}')"></div>`
              : "";
            const internalTag = m.isInternal
              ? '<span style="color:#ffffff; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; letter-spacing:0.5px;">[Внутренняя заметка]</span><br>'
              : "";
            if (m.isInternal && !isAdmin) return "";

            const senderIdentity = m.isAdmin
              ? `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Briefcase.webp" style="width:1.1em;height:1.1em;vertical-align:bottom;"> ` +
                (isMe ? `Вы (Поддержка) (${mName})` : `Поддержка (${mName})`)
              : `<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Bust%20In%20Silhouette.webp" style="width:1.1em;height:1.1em;vertical-align:bottom;"> ` +
                (isMe ? `Вы` : `${mName} @${mUsername}`);

            return `
                   <div style="display:flex; gap:10px; align-self: ${isMe ? "flex-end" : "flex-start"}; max-width: 82%; margin-bottom: 2px;">
                       ${avatarHtml}
                       <div style="background: ${bg}; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 11px 16px; border-radius: 18px; border-bottom-${isMe ? "right" : "left"}-radius: 4px; border: 1px solid ${borderCol}; position:relative; min-width: 120px; box-shadow: 0 4px 18px rgba(0,0,0,0.3);">
                           <div style="font-size: 11px; opacity: 0.65; margin-bottom: 5px; font-weight: 600; cursor:pointer;" onclick="ProfileManager.openProfileModal('${Utils.escapeHtml(mUid)}')">
                               ${senderIdentity}
                           </div>
                           <div style="line-height: 1.5; font-size:13.5px; color: #ffffff; word-wrap: break-word; white-space: pre-wrap; margin-bottom:12px;">${internalTag}${Utils.escapeHtml(m.text || "")}</div>
                           ${m.image ? `<img src="${Utils.escapeHtml(m.image)}" style="max-width: 100%; border-radius: 10px; margin-top: 5px; margin-bottom: 12px; cursor:pointer; border: 1px solid rgba(255,255,255,0.12);" onclick="window.open(this.src)">` : ""}
                           <div style="position:absolute; bottom:6px; right:12px; font-size:10px; color:rgba(255,255,255,0.4); font-weight: 500;">
                              ${timeStr}
                           </div>
                       </div>
                   </div>`;
          } catch (e) {
            console.error("Error rendering message:", e);
            return '<div style="color:red; font-size:12px;">Ошибка загрузки сообщения</div>';
          }
        })
        .join("");
      setTimeout(() => {
        chat.scrollTop = chat.scrollHeight;
      }, 50);
    });

    if (this.typingUnsub) this.typingUnsub();
    this.typingUnsub = onValue(
      ref(db, `support_tickets_typing/${id}`),
      (snap) => {
        const val = snap.val() || {};
        const othersTyping = Object.keys(val).filter(
          (k) => k !== uid && Date.now() - val[k] < 3000,
        );
        Utils.$("support-typing-indicator").style.display =
          othersTyping.length > 0 ? "block" : "none";
      },
    );

    const btnSend = Utils.$("btn-support-send");
    const input = Utils.$("support-msg-input");
    if (btnSend)
      btnSend.onclick = () =>
        this.sendMessage(id, !!(isAdmin && window._internalNoteToggle));
    if (input) {
      input.onkeypress = (e) => {
        if (e.key === "Enter")
          this.sendMessage(id, !!(isAdmin && window._internalNoteToggle));
      };
      input.oninput = () => {
        if (this.typingTimer) clearTimeout(this.typingTimer);
        set(ref(db, `support_tickets_typing/${id}/${uid}`), Date.now());
        this.typingTimer = setTimeout(
          () => remove(ref(db, `support_tickets_typing/${id}/${uid}`)),
          3000,
        );
      };
    }

    const btnAttach = Utils.$("btn-support-attach");
    if (btnAttach) {
      btnAttach.onclick = () => {
        const inputImg = document.createElement("input");
        inputImg.type = "file";
        inputImg.accept = "image/*";
        inputImg.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          Utils.toast("Обработка картинки...", "info");
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = new Image();
            img.onload = async () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              canvas.getContext("2d").drawImage(img, 0, 0);
              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
              await this.sendMessage(id, false, "", compressedBase64);
            };
            img.src = re.target.result;
          };
          reader.readAsDataURL(file);
        };
        inputImg.click();
      };
    }
  }

  static async sendMessage(
    ticketId,
    isInternal = false,
    textOverride = "",
    imageBase64 = null,
  ) {
    if (this.BANNED_USERS.has(AppState.currentUser?.uid))
      return Utils.toast("Вы заблокированы в поддержке!", "error");
    const input = Utils.$("support-msg-input");
    const msg = textOverride || (input ? input.value.trim() : "");
    if (!msg && !imageBase64) return;
    const uid = AppState.currentUser?.uid;
    const profile = AppState.usersCache.get(AppState.currentUser?.uid) || {};
    const isAdmin =
      AdminPanel.isOperatorProfile(profile, uid) ||
      AdminPanel.isCreatorProfile(profile, uid);
    const ts = Date.now();
    await push(ref(db, `support_tickets/${ticketId}/messages`), {
      text: msg,
      image: imageBase64 || null,
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
    if (input) input.value = "";
    if (this.typingTimer) clearTimeout(this.typingTimer);
    remove(ref(db, `support_tickets_typing/${ticketId}/${uid}`));
    Utils.$("support-quick-actions-menu").style.display = "none"; // Close quick menu if open
  }

  static async closeTicket(id) {
    if (!(await Utils.confirm("Закрыть этот тикет?"))) return;
    await update(ref(db, `support_tickets/${id}`), { status: "closed" });
  }

  static async reopenTicket(id) {
    await update(ref(db, `support_tickets/${id}`), { status: "open" });
  }

  static async setCategory(id, cat) {
    await update(ref(db, `support_tickets/${id}`), { category: cat });
    Utils.toast("Категория установлена: " + cat, "success");
    Utils.$("support-quick-actions-menu").style.display = "none";
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
    const blob = new Blob([str], { type: "text/plain" });
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
    const blob = new Blob([str], { type: "text/plain" });
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
    this.openCreatorPanel(); // Just calls the opening which refreshes stats
    Utils.toast("Данные обновлены", "success");
  }

  static async deleteTicketLocally() {
    if (!this.activeTicketId) return;
    if (!(await Utils.confirm("Точно удалить этот тикет?"))) return;
    const id = this.activeTicketId;
    const uid = AppState.currentUser?.uid;

    // Hide visually right now
    Utils.$("support-active-ticket").style.display = "none";
    Utils.$("support-no-ticket").style.display = "flex";

    if (typeof remove !== "undefined" && typeof ref !== "undefined") {
      await remove(ref(db, `support_tickets/${id}`));
      Utils.toast("Тикет удален", "success");
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
        update(ref(db, `support_tickets/${k}`), { status: "closed" });
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
    if (!(await Utils.confirm("Вы абсолютно уверены?"))) return; // double check
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
    Utils.toast("Все пользователи разблокированы", "success");
  }
}
window.SupportSystem = SupportSystem;

window.SupportSystem = SupportSystem;
export { SupportSystem };
