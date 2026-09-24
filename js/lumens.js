class HashtagManager {
  static defaultTags = [
    "#music",
    "#movies",
    "#gaming",
    "#love",
    "#chill",
    "#anime",
    "#coding",
    "#friends",
  ];

  static initHashtags() {
    this.bindHashtagInput(
      "edit-hashtags",
      "profile-hashtag-suggestions",
      false,
    );
    this.bindHashtagInput(
      "room-input-hashtag",
      "room-hashtag-suggestions",
      true,
    );
  }

  static parseHashtags(rawValue = "", single = false) {
    const tokens = String(rawValue || "")
      .split(/\s+/)
      .map((token) => this.normalizeTag(token))
      .filter(Boolean);
    const unique = Array.from(new Set(tokens));
    return single ? unique.slice(0, 1) : unique.slice(0, 10);
  }

  static normalizeTag(value = "") {
    const clean = String(value || "")
      .replace(/#/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-я0-9_]/gi, "");
    return clean ? `#${clean}` : "";
  }

  static collectTags() {
    const tags = new Set(this.defaultTags);
    AppState.usersCache.forEach((profile) => {
      if (!Array.isArray(profile?.hashtags)) return;
      profile.hashtags.forEach((tag) => {
        const normalized = this.normalizeTag(tag);
        if (normalized) tags.add(normalized);
      });
    });
    AppState.roomsCache.forEach((room) => {
      if (!Array.isArray(room?.hashtags)) return;
      room.hashtags.forEach((tag) => {
        const normalized = this.normalizeTag(tag);
        if (normalized) tags.add(normalized);
      });
    });
    return Array.from(tags);
  }

  static bindHashtagInput(inputId, suggestionsId, single = false) {
    const input = Utils.$(inputId);
    const suggestions = Utils.$(suggestionsId);
    if (!input || !suggestions) return;

    const updateSuggestions = () => {
      const current = input.value.trim().toLowerCase().replace("#", "");
      const pool = this.collectTags();
      const filtered = pool
        .filter((tag) => !current || tag.includes(current))
        .slice(0, 6);

      if (!filtered.length) {
        suggestions.classList.remove("active");
        suggestions.innerHTML = "";
        return;
      }

      suggestions.innerHTML = filtered
        .map(
          (tag) =>
            `<button class="hashtag-suggestion-item" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}</button>`,
        )
        .join("");
      suggestions.classList.add("active");

      suggestions
        .querySelectorAll(".hashtag-suggestion-item")
        .forEach((btn) => {
          btn.onclick = () => {
            const tag = btn.dataset.tag || "";
            if (single) input.value = tag;
            else {
              const existing = this.parseHashtags(input.value, false).filter(
                (t) => t !== tag,
              );
              input.value = [...existing, tag].join(" ");
            }
            suggestions.classList.remove("active");
          };
        });
    };

    input.addEventListener("focus", updateSuggestions);
    input.addEventListener("input", updateSuggestions);
    input.addEventListener("blur", () =>
      setTimeout(() => suggestions.classList.remove("active"), 120),
    );
  }
}


class LumenManager {
  static activeAnimations = new Map();
  static currentFilter = "all";

  static formatTxDate(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    if (isToday) return `Сегодня в ${hours}:${minutes}`;
    if (isYesterday) return `Вчера в ${hours}:${minutes}`;

    const months = [
      "янв", "фев", "мар", "апр", "май", "июн",
      "июл", "авг", "сен", "окт", "ноя", "дек"
    ];
    return `${date.getDate()} ${months[date.getMonth()]}, ${hours}:${minutes}`;
  }

  // Smooth counter animation with ease-out cubic
  static animateCounter(elementOrId, startVal, targetVal, duration = 650) {
    const el = typeof elementOrId === "string" ? Utils.$(elementOrId) : elementOrId;
    if (!el) return;

    if (this.activeAnimations.has(el)) {
      cancelAnimationFrame(this.activeAnimations.get(el));
      this.activeAnimations.delete(el);
    }

    if (startVal === targetVal) {
      el.textContent = targetVal.toLocaleString();
      return;
    }

    const startTime = performance.now();
    const diff = targetVal - startVal;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * ease);
      el.textContent = current.toLocaleString();

      if (progress < 1) {
        const handle = requestAnimationFrame(step);
        this.activeAnimations.set(el, handle);
      } else {
        el.textContent = targetVal.toLocaleString();
        this.activeAnimations.delete(el);
      }
    };

    const handle = requestAnimationFrame(step);
    this.activeAnimations.set(el, handle);
  }

  // Floating +N ✨ or -N ✨ delta badge over the pill
  static spawnFloater(anchorEl, amount, isPositive = true) {
    if (!anchorEl) return;
    const floater = document.createElement("div");
    floater.className = `lumen-floating-delta ${isPositive ? "positive" : "negative"}`;
    const sign = isPositive ? "+" : "-";
    floater.innerHTML = `${sign}${Math.abs(amount).toLocaleString()} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 14px; height: 14px; vertical-align: middle; pointer-events: none;" alt="✨">`;

    anchorEl.style.position = "relative";
    anchorEl.appendChild(floater);

    setTimeout(() => {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 1500);
  }

  // Floating HUD toast inside active room (Matches Player Chat Overlay)
  static showRoomHudReward(amount, reason = "Просмотр видео") {
    const roomScreen = Utils.$("room-screen");
    if (!roomScreen || !roomScreen.classList.contains("active")) return;

    let container = Utils.$("chat-overlay-container");
    if (!container) {
      const targetParent = Utils.$("room-video-container") || roomScreen;
      container = document.createElement("div");
      container.id = "chat-overlay-container";
      container.style.cssText = "position: absolute; top: 15%; left: 50%; transform: translateX(-50%); width: 80%; pointer-events: none; z-index: 10; display: flex; flex-direction: column; gap: 8px; align-items: center;";
      targetParent.appendChild(container);
    }

    const item = document.createElement("div");
    item.className = "room-player-lumen-toast";
    const amountStr = Math.abs(amount).toLocaleString();
    const absAmt = Math.abs(amount);
    const suffix = absAmt === 1 ? "" : (absAmt % 10 >= 2 && absAmt % 10 <= 4 && (absAmt < 10 || absAmt > 20)) ? "а" : "ов";
    item.innerHTML = `
      <div class="toast-sparkle-icon">
        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" alt="✨">
      </div>
      <div class="toast-text-col">
        <span class="toast-lumen-amount">+${amountStr} Люмен${suffix}</span>
        <span class="toast-lumen-desc">${Utils.escapeHtml(reason)}</span>
      </div>
    `;
    container.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 4000);
  }

  // Central balance updater
  static updateBalance(newLumens, options = {}) {
    const {
      diff = null,
      reason = "",
      source = "lobby",
      animate = true,
      showFloater = true,
      saveTx = false,
      saveDb = false,
      txType = null,
      txIcon = "sparkles"
    } = options;

    const uid = AppState.currentUser?.uid;
    const cached = uid ? AppState.usersCache.get(uid) : null;
    const oldLumens = cached && typeof cached.lumens === "number" ? cached.lumens : 0;
    const numLumens = Math.max(0, Number(newLumens) || 0);
    const calculatedDiff = diff !== null ? diff : (numLumens - oldLumens);

    if (cached) {
      cached.lumens = numLumens;
    }

    if (saveDb && uid) {
      try {
        const profRef = ref(db, `users/${uid}/profile`);
        update(profRef, { lumens: numLumens }).catch((err) => {
          console.error("[LumenManager] Failed to persist lumens balance in Firebase:", err);
        });
      } catch (err) {
        console.error("[LumenManager] Exception saving lumens balance:", err);
      }
    }

    const targets = [
      { el: Utils.$("header-lumens-count"), pill: Utils.$("lobby-header-lumens-pill") },
      { el: Utils.$("room-lumens-count"), pill: Utils.$("room-header-lumens-pill") },
      { el: Utils.$("my-lumens-val"), pill: null },
      { el: Utils.$("modal-lumens-wallet-val"), pill: null }
    ];

    targets.forEach(({ el, pill }) => {
      if (!el) return;
      const currentDisplayed = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;
      if (animate && Math.abs(numLumens - currentDisplayed) > 0) {
        this.animateCounter(el, currentDisplayed, numLumens, 650);
      } else {
        el.textContent = numLumens.toLocaleString();
      }

      if (pill && calculatedDiff !== 0) {
        const isPos = calculatedDiff > 0;
        pill.classList.remove("glow-increase", "glow-decrease");
        void pill.offsetWidth;
        pill.classList.add(isPos ? "glow-increase" : "glow-decrease");

        if (showFloater) {
          this.spawnFloater(pill, calculatedDiff, isPos);
        }

        setTimeout(() => {
          pill.classList.remove("glow-increase", "glow-decrease");
        }, 1100);
      }
    });

    const catalogUserVal = Utils.$("catalog-modal-user-lumens-val");
    if (catalogUserVal) {
      catalogUserVal.innerHTML = `${numLumens.toLocaleString()} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">`;
    }

    if (source === "room" && calculatedDiff > 0) {
      this.showRoomHudReward(calculatedDiff, reason || "Просмотр видео");
    }

    if (saveTx && uid && calculatedDiff !== 0) {
      this.recordTransaction(uid, {
        type: txType || (calculatedDiff > 0 ? "income" : "expense"),
        amount: Math.abs(calculatedDiff),
        reason: reason || (calculatedDiff > 0 ? "Начисление Люменов" : "Списание Люменов"),
        icon: txIcon
      });
    }
  }

  // Records transaction in Firebase RTDB, localStorage and AppState
  static async recordTransaction(uid, { type, amount, reason, icon = "sparkles", meta = {} }) {
    if (!uid || !amount) return;
    const txId = "tx_" + Date.now() + "_" + Utils.generateCryptoId(4);
    const txData = {
      id: txId,
      type: type || "income",
      amount: Number(amount) || 0,
      reason: reason || "Операция с Люменами",
      icon: icon || "sparkles",
      timestamp: Date.now(),
      meta: meta || {}
    };

    if (!AppState.lumenTransactions) AppState.lumenTransactions = [];
    AppState.lumenTransactions.unshift(txData);

    try {
      const localKey = "cowio_lumen_tx_" + uid;
      const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
      existing.unshift(txData);
      localStorage.setItem(localKey, JSON.stringify(existing.slice(0, 100)));
    } catch (e) {}

    try {
      await set(ref(db, `users/${uid}/lumenTransactions/${txId}`), txData);
    } catch (e) {
      console.warn("Could not save lumen transaction in Firebase:", e);
    }

    const modal = Utils.$("modal-lumens-info");
    if (modal && modal.classList.contains("active")) {
      this.renderTransactions(uid, this.currentFilter);
    }
  }

  // Fetches transaction history from RTDB & localStorage
  static async getTransactions(uid) {
    if (!uid) return [];
    let localTxs = [];
    try {
      const localKey = "cowio_lumen_tx_" + uid;
      localTxs = JSON.parse(localStorage.getItem(localKey) || "[]");
    } catch (e) {}

    try {
      const snap = await get(ref(db, `users/${uid}/lumenTransactions`));
      if (snap.exists()) {
        const val = snap.val() || {};
        const serverTxs = Object.values(val);
        const map = new Map();
        [...localTxs, ...serverTxs].forEach((tx) => {
          if (tx && tx.id) map.set(tx.id, tx);
        });
        const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        AppState.lumenTransactions = merged;
        return merged;
      }
    } catch (e) {
      console.warn("Could not fetch lumen transactions:", e);
    }

    AppState.lumenTransactions = localTxs;
    return localTxs;
  }

  // Modal tab switcher
  static switchModalTab(tab) {
    const tabHistory = Utils.$("lumens-tab-history");
    const tabTop = Utils.$("lumens-tab-top");
    const tabGuide = Utils.$("lumens-tab-guide");
    const btnTx = Utils.$("tab-btn-lumens-tx");
    const btnTop = Utils.$("tab-btn-lumens-top");
    const btnEarn = Utils.$("tab-btn-lumens-earn");

    const tabs = [
      { id: "history", el: tabHistory, btn: btnTx },
      { id: "leaderboard", el: tabTop, btn: btnTop },
      { id: "guide", el: tabGuide, btn: btnEarn }
    ];

    tabs.forEach((t) => {
      const isActive = t.id === tab;
      if (t.el) t.el.style.display = isActive ? "flex" : "none";
      if (t.btn) {
        if (isActive) {
          t.btn.classList.add("active");
          t.btn.style.background = "rgba(255, 255, 255, 0.12)";
          t.btn.style.color = "#ffffff";
        } else {
          t.btn.classList.remove("active");
          t.btn.style.background = "transparent";
          t.btn.style.color = "rgba(255, 255, 255, 0.55)";
        }
      }
    });

    if (tab === "history") {
      this.renderTransactions(AppState.currentUser?.uid, this.currentFilter);
    } else if (tab === "leaderboard") {
      this.renderLumensLeaderboard();
    }
  }

  // Render Top Lumens inside modal
  static async renderLumensLeaderboard() {
    const listEl = Utils.$("lumens-leaderboard-list");
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="text-align: center; padding: 26px 12px; color: rgba(255, 255, 255, 0.45); font-size: 13px;">
        Загрузка рейтинга Люменов...
      </div>
    `;

    try {
      const { get, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
      const dbInstance = getDatabase();
      const snap = await get(ref(dbInstance, "users"));
      if (!snap.exists()) {
        listEl.innerHTML = `<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.4); font-size:13px;">Пока нет данных.</div>`;
        return;
      }

      const allUsers = snap.val() || {};
      const list = [];
      for (const [uid, uData] of Object.entries(allUsers)) {
        if (!uData.profile) continue;
        const lumens = Number(uData.profile.lumens) || 0;
        if (lumens > 0) {
          list.push({ uid, profile: uData.profile, lumens });
        }
      }

      list.sort((a, b) => b.lumens - a.lumens);
      const topUsers = list.slice(0, 30);

      if (topUsers.length === 0) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:32px 16px; color:rgba(255,255,255,0.45);">
            <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 36px; height: 36px; margin: 0 auto 8px; display: block;" alt="✨">
            <div style="font-weight: 700; color: #ffffff; font-size: 13.5px; margin-bottom: 4px;">Пока ни у кого нет Люменов</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.55);">Смотрите видео в комнатах, чтобы стать первым в рейтинге!</div>
          </div>
        `;
        return;
      }

      const myUid = AppState.currentUser?.uid;

      listEl.innerHTML = topUsers.map((item, idx) => {
        const rank = idx + 1;
        const isMe = item.uid === myUid;
        let rankBadge = `<span style="font-weight: 800; font-size: 12px; color: rgba(255,255,255,0.5); width: 24px; text-align: center;">#${rank}</span>`;
        if (rank === 1) {
          rankBadge = `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Crown.webp" style="width: 22px; height: 22px; object-fit: contain;" alt="1">`;
        } else if (rank === 2) {
          rankBadge = `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gem%20Stone.webp" style="width: 20px; height: 20px; object-fit: contain;" alt="2">`;
        } else if (rank === 3) {
          rankBadge = `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Star.webp" style="width: 20px; height: 20px; object-fit: contain;" alt="3">`;
        }

        const name = Utils.escapeHtml(item.profile.name || "Пользователь");
        const username = item.profile.username ? `@${Utils.escapeHtml(item.profile.username)}` : "";
        const avatar = item.profile.avatar || "assets/avatars/default.png";

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: ${isMe ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isMe ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.06)'}; border-radius: 12px; cursor: pointer; transition: all 0.15s ease;" onclick="Utils.closeModal('modal-lumens-info'); ProfileManager.openViewProfileModal('${item.uid}')">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; justify-content: center; width: 24px; flex-shrink: 0;">
                ${rankBadge}
              </div>
              <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0;" onerror="this.src='assets/avatars/default.png'">
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <div style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">
                  <span>${name}</span>
                  ${isMe ? '<span style="font-size: 9.5px; padding: 1px 5px; background: rgba(255,215,0,0.2); color: #ffd700; border-radius: 4px; font-weight: 800;">ВЫ</span>' : ''}
                </div>
                ${username ? `<div style="font-size: 11px; color: rgba(255, 255, 255, 0.45); line-height: 1.1;">${username}</div>` : ''}
              </div>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #ffd700; display: flex; align-items: center; gap: 5px; margin-left: 8px; flex-shrink: 0;">
              <span>${item.lumens.toLocaleString()}</span>
              <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" class="inline-sparkles-icon" alt="✨">
            </div>
          </div>
        `;
      }).join("");
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div style="text-align: center; padding: 20px; color: #f87171; font-size: 12px;">Ошибка при загрузке рейтинга</div>`;
    }
  }

  // Filter transactions
  static filterTransactions(filter) {
    this.currentFilter = filter;
    ["all", "income", "expense"].forEach((f) => {
      const chip = Utils.$(`lumen-filter-${f}`);
      if (chip) {
        if (f === filter) {
          chip.classList.add("active");
          chip.style.background = "rgba(255, 255, 255, 0.14)";
          chip.style.borderColor = "rgba(255, 255, 255, 0.22)";
          chip.style.color = "#ffffff";
        } else {
          chip.classList.remove("active");
          chip.style.background = "rgba(255, 255, 255, 0.04)";
          chip.style.borderColor = "rgba(255, 255, 255, 0.08)";
          chip.style.color = "rgba(255, 255, 255, 0.6)";
        }
      }
    });
    this.renderTransactions(AppState.currentUser?.uid, filter);
  }

  // Render transactions inside modal
  static async renderTransactions(uid, filter = "all") {
    const listEl = Utils.$("lumens-transactions-list");
    if (!listEl) return;

    if (!uid) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: rgba(255, 255, 255, 0.4); font-size: 13px;">
          Авторизуйтесь, чтобы видеть историю операций
        </div>
      `;
      return;
    }

    const txs = await this.getTransactions(uid);

    let filtered = txs;
    if (filter === "income") {
      filtered = txs.filter((t) => t.type === "income");
    } else if (filter === "expense") {
      filtered = txs.filter((t) => t.type === "expense");
    }

    if (!filtered || filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: rgba(255, 255, 255, 0.5);">
          <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 36px; height: 36px; margin: 0 auto 8px; display: block;" alt="✨">
          <div style="font-weight: 700; font-size: 13.5px; color: #ffffff; margin-bottom: 4px;">История пока пуста</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.55); line-height: 1.4;">Зарабатывайте Люмены за просмотр видео в комнатах, ежедневный вход или подарки от друзей!</div>
        </div>
      `;
      return;
    }

    const iconMap = {
      fire: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp",
      tv: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Television.webp",
      gift: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Heart%20With%20Ribbon.webp",
      bag: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Shopping%20Bags.webp",
      crown: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Crown.webp",
      sparkles: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp"
    };

    listEl.innerHTML = filtered
      .map((tx) => {
        const isIncome = tx.type === "income";
        const iconUrl = iconMap[tx.icon] || iconMap.sparkles;
        const sign = isIncome ? "+" : "-";
        const amtStr = (Number(tx.amount) || 0).toLocaleString();
        const dateStr = this.formatTxDate(tx.timestamp);

        return `
          <div class="lumen-tx-item ${isIncome ? "income" : "expense"}">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              <div class="lumen-tx-icon-wrap">
                <img src="${iconUrl}" alt="" style="width: 20px; height: 20px; object-fit: contain;">
              </div>
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <div style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${Utils.escapeHtml(tx.reason || (isIncome ? "Начисление Люменов" : "Списание"))}
                </div>
                <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 1px;">
                  ${dateStr}
                </div>
              </div>
            </div>
            <div class="lumen-tx-amount-badge ${isIncome ? "income" : "expense"}" style="flex-shrink: 0; margin-left: 12px;">
              <span>${sign}${amtStr}</span>
              <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 15px; height: 15px; object-fit: contain;" alt="✨">
            </div>
          </div>
        `;
      })
      .join("");
  }
}
window.LumenManager = LumenManager;

window.HashtagManager = HashtagManager;
window.LumenManager = LumenManager;
export { HashtagManager, LumenManager };
