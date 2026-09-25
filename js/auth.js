class BadgeManager {
  static isRelationshipBadge(id, b) {
    if (!id && !b) return false;
    const strId = String(id || "").toLowerCase();
    if (strId.startsWith("rel_") || strId.startsWith("partner_")) return true;
    if (b) {
      const name = String(b.name || "").toLowerCase();
      const desc = String(b.desc || "").toLowerCase();
      if (
        name.includes("неделя") ||
        name.includes("месяц") ||
        name.includes("полгода") ||
        name.includes("отношен") ||
        name.includes("брак") ||
        name.includes("серьезка") ||
        desc.includes("вместе") ||
        desc.includes("отношен") ||
        desc.includes("любви")
      ) {
        return true;
      }
    }
    return false;
  }

  static async checkLevelBadges(uid, xpVal) {
    if (!uid) return;
    const math = ProfileManager.getExpMath(xpVal);
    const lvl = math.level;

    const lvlBadges = [];
    if (lvl >= 10) lvlBadges.push("lvl_10");
    if (lvl >= 25) lvlBadges.push("lvl_25");
    if (lvl >= 50) lvlBadges.push("lvl_50");
    if (lvl >= 100) lvlBadges.push("lvl_100");

    if (lvlBadges.length > 0) {
      const profSnap = await get(
        ref(db, `users/${uid}/profile/assignedBadges`),
      );
      let assigned = profSnap.val() || [];
      if (!Array.isArray(assigned)) assigned = [];

      let changed = false;
      lvlBadges.forEach((bId) => {
        if (!assigned.includes(bId)) {
          assigned.push(bId);
          changed = true;
          if (uid === AppState.currentUser?.uid) {
            setTimeout(
              () =>
                Utils.toast(
                  "🏆 Вы получили новый бейдж за уровень!",
                  "success",
                ),
              1000,
            );
          }
        }
      });

      if (changed) {
        await update(ref(db, `users/${uid}/profile`), {
          assignedBadges: assigned,
        });
      }
    }
  }

  static async checkRelationshipBadges(uid) {
    // Partner-related badges removed
    return;
  }

  static async grantEventBadgeToOnline() {
    if (!AdminPanel.requireAdmin()) return;
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель", "error");
    const badgeId = Utils.$("admin-event-badge-id")?.value.trim();
    if (!badgeId) return Utils.toast("Введите ID бейджа", "error");

    if (
      !(await Utils.confirm(
        `Точно выдать бейдж "${badgeId}" всем, кто сейчас онлайн?`,
      ))
    )
      return;

    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};

    let count = 0;
    const updates = {};

    let bXp =
      AppState.customBadges && AppState.customBadges[badgeId]
        ? Number(AppState.customBadges[badgeId].xp) || 0
        : 0;

    for (const [uid, uData] of Object.entries(usersData)) {
      if (uData.status && uData.status.online) {
        let assigned = (uData.profile && uData.profile.assignedBadges) || [];
        if (!Array.isArray(assigned)) assigned = [];
        if (!assigned.includes(badgeId)) {
          assigned.push(badgeId);
          updates[`users/${uid}/profile/assignedBadges`] = assigned;
          if (bXp > 0) {
            let curXp = Number(uData.profile?.xp) || 0;
            let newXp = curXp + bXp;
            let newLevel = ProfileManager.getExpMath(newXp).level;
            updates[`users/${uid}/profile/xp`] = newXp;
            updates[`users/${uid}/profile/level`] = newLevel;
          }
          count++;
        }
      }
    }

    if (count > 0) {
      await update(ref(db), updates);
      Utils.toast(`Бейдж выдан ${count} пользователям!`);
    } else {
      Utils.toast("Нет новых пользователей для выдачи.", "info");
    }
  }

  static init() {
    onValue(ref(db, "badges"), (snap) => {
      AppState.customBadges = snap.val() || {};
      this.renderBadgeList();
    });

    const presetEmojis = [
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Smiling%20Face%20With%20Horns.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Sleeping%20Face.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Partying%20Face.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Clown%20Face.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Smiling%20Face%20With%20Sunglasses.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Face%20Screaming%20In%20Fear.webp",
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Face%20Without%20Mouth.webp",
    ];

    setTimeout(() => {
      const presetContainer = Utils.$("admin-badge-preset-icons");
      if (presetContainer) {
        presetContainer.innerHTML = presetEmojis
          .map(
            (url) =>
              `<img src="${url}" style="width:32px; height:32px; cursor:pointer; border-radius:4px;" onclick="document.getElementById('admin-badge-edit-icon').value='${url}'" />`,
          )
          .join("");
      }
    }, 1000);
  }

  static async saveBadge() {
    if (!AdminPanel.requireAdmin()) return;
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель", "error");
    const id = Utils.$("admin-badge-edit-id")
      ?.value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const name = Utils.$("admin-badge-edit-name")?.value.trim();
    if (!id || !name) return Utils.toast("ID и название обязательны", "error");

    const payload = {
      name,
      desc: Utils.$("admin-badge-edit-desc")?.value.trim() || "",
      icon: Utils.$("admin-badge-edit-icon")?.value.trim() || "",
      xp: parseInt(Utils.$("admin-badge-edit-xp")?.value, 10) || 0,
      color: Utils.$("admin-badge-edit-color")?.value || "#ffffff",
      bg: Utils.$("admin-badge-edit-bg")?.value || "#5d3fd3",
      border: Utils.$("admin-badge-edit-border")?.value || "#8d63ff",
    };
    await set(ref(db, `badges/${id}`), payload);
    Utils.toast("Бейдж сохранен");
    this.renderBadgeList();
  }

  static async generateSystemBadges() {
    if (!AdminPanel.requireAdmin()) return;
    const badges = {
      lvl_10: {
        name: "Ветеран",
        desc: "Достиг 10 уровня",
        icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Star.webp",
        color: "#cddc39",
        xp: 0,
        bg: "rgba(205, 220, 57, 0.2)",
        border: "#cddc39",
      },
      lvl_25: {
        name: "Мастер",
        desc: "Достиг 25 уровня",
        icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp",
        color: "#ff9800",
        xp: 0,
        bg: "rgba(255, 152, 0, 0.2)",
        border: "#ff9800",
      },
      lvl_50: {
        name: "Легенда",
        desc: "Достиг 50 уровня",
        icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gem%20Stone.webp",
        color: "#2196f3",
        xp: 0,
        bg: "rgba(33, 150, 243, 0.2)",
        border: "#2196f3",
      },
      lvl_100: {
        name: "Божество",
        desc: "Достиг 100 уровня",
        icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Crown.webp",
        color: "#ffeb3b",
        xp: 0,
        bg: "rgba(255, 235, 59, 0.2)",
        border: "#ffeb3b",
      },
    };
    for (const [id, payload] of Object.entries(badges)) {
      await set(ref(db, `badges/${id}`), payload);
    }
    Utils.toast("Системные бейджи добавлены!");
    this.renderBadgeList();
  }

  static async deleteBadge(id) {
    if (!AdminPanel.requireAdmin()) return;
    if (!AdminPanel.isCurrentUserCreator())
      return Utils.toast("Только Создатель", "error");
    if (!(await Utils.confirm("Точно удалить бейдж?"))) return;
    await set(ref(db, `badges/${id}`), null);
    Utils.toast("Бейдж удален");
    this.renderBadgeList();
  }

  static renderBadgeList() {
    const container = Utils.$("admin-badges-list");
    if (!container) return;
    container.innerHTML = "";
    const badges = AppState.customBadges || {};
    const entries = Object.entries(badges).filter(([id, bdg]) => !this.isRelationshipBadge(id, bdg));
    if (entries.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">Нет бейджей</div>`;
      return;
    }

    container.style.display = "grid";
    container.style.gridTemplateColumns =
      "repeat(auto-fill, minmax(160px, 1fr))";
    container.style.gap = "15px";

    entries.forEach(([id, bdg]) => {
      const div = document.createElement("div");
      div.style.position = "relative";

      const iconHtml = bdg.icon
        ? bdg.icon.match(/^http/)
          ? `<img src="${Utils.escapeHtml(bdg.icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>`
          : `<span style="font-size:48px;">${Utils.escapeHtml(bdg.icon)}</span>`
        : "";

      const cardHtml = `
            <div class="ach-card admin-ach-item" data-id="${Utils.escapeHtml(id)}" style="
                width: 100%; 
                height: 180px;
                border-radius: 12px;
                background: ${bdg.bg || "rgba(0,0,0,0.2)"};
                border: 1px solid ${bdg.border || "rgba(255,255,255,0.1)"};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                position: relative;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.2s ease;
            ">
                <div style="position:absolute; top:5px; left:5px; background:rgba(0,0,0,0.6); padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; font-family:monospace; color:var(--text-muted); pointer-events:none; z-index:2;">${Utils.escapeHtml(id)}</div>
                <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px; z-index:1;">
                    ${iconHtml}
                </div>
                <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%; z-index:1;">
                    <div style="color: ${bdg.color || "#ffffff"}; font-weight: 800; font-size: 13px; line-height: 1.2;">${Utils.escapeHtml(bdg.name)}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${Utils.escapeHtml(bdg.desc)}</div>
                </div>
            </div>`;

      div.innerHTML = `
                ${cardHtml}
                <button class="danger-btn btn-small" data-id="${Utils.escapeHtml(id)}" style="margin-top:8px; width:100%;">Удалить</button>
            `;

      div.querySelector(".ach-card").onclick = () => {
        Utils.$("admin-badge-edit-id").value = id;
        Utils.$("admin-badge-edit-name").value = bdg.name;
        Utils.$("admin-badge-edit-desc").value = bdg.desc || "";
        Utils.$("admin-badge-edit-icon").value = bdg.icon || "";
        if (Utils.$("admin-badge-edit-xp"))
          Utils.$("admin-badge-edit-xp").value = bdg.xp || 0;
        Utils.$("admin-badge-edit-color").value = bdg.color;
        Utils.$("admin-badge-edit-bg").value = bdg.bg;
        Utils.$("admin-badge-edit-border").value = bdg.border;
        if (window.updateAdminBadgePreview) window.updateAdminBadgePreview();
      };

      div.querySelector("button").onclick = () => this.deleteBadge(id);
      container.appendChild(div);
    });
  }

  static renderUserEditorBadges(targetUid, userAssignedArray) {
    const container = Utils.$("admin-edit-badges-container");
    if (!container) return;
    container.innerHTML = "";
    const allBadges = AppState.customBadges || {};
    const entries = Object.entries(allBadges).filter(([id, b]) => !this.isRelationshipBadge(id, b));
    if (entries.length === 0) {
      container.innerHTML = `<div style="font-size:11px; color:var(--text-muted);">Нет созданных бейджей</div>`;
      return;
    }

    const currentSet = new Set(userAssignedArray || []);

    entries.forEach(([id, b]) => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "4px";
      label.style.fontSize = "12px";
      label.style.cursor = "pointer";
      label.style.padding = "4px 8px";
      label.style.borderRadius = "6px";
      label.style.background = currentSet.has(id)
        ? "rgba(255,255,255,0.1)"
        : "transparent";
      label.style.border = "1px solid rgba(255,255,255,0.1)";

      label.innerHTML = `
                <input type="checkbox" value="${Utils.escapeHtml(id)}" ${currentSet.has(id) ? "checked" : ""}>
                ${Utils.escapeHtml(b.name)}
            `;

      const cb = label.querySelector("input");
      cb.onchange = async () => {
        const checked = cb.checked;
        if (!AdminPanel.isCurrentUserCreator()) {
          cb.checked = !checked;
          return Utils.toast("Выдавать бейджи может только Создатель", "error");
        }
        label.style.background = checked
          ? "rgba(255,255,255,0.1)"
          : "transparent";

        if (checked) currentSet.add(id);
        else currentSet.delete(id);

        const newArr = Array.from(currentSet);
        const updates = { assignedBadges: newArr };
        let bXp =
          AppState.customBadges && AppState.customBadges[id]
            ? Number(AppState.customBadges[id].xp) || 0
            : 0;

        if (checked && bXp > 0) {
          const pSnap = await get(ref(db, `users/${targetUid}/profile`));
          const p = pSnap.val() || {};
          let curXp = Number(p.xp) || 0;
          let newXp = curXp + bXp;
          let newLevel = ProfileManager.getExpMath(newXp).level;
          updates.xp = newXp;
          updates.level = newLevel;
        }

        await update(ref(db, `users/${targetUid}/profile`), updates);
        AdminPanel.pushAuditLog("admin.badge.custom_assigned", {
          targetUid,
          badgeId: id,
          granted: checked,
        });
        Utils.toast(checked ? "Бейдж выдан" : "Бейдж снят");
        if (checked && bXp > 0) AdminPanel.loadUserEditor(targetUid);
      };
      container.appendChild(label);
    });
  }
}
window.BadgeManager = BadgeManager;

class AuthManager {
  static init() {
    Utils.injectFixes();

    // Instant optimistic preload on F5
    try {
      const lastRaw = localStorage.getItem("cowio_last_profile");
      const savedAccounts = JSON.parse(
        localStorage.getItem("cowio_saved_accounts") || "[]",
      );
      if (lastRaw && savedAccounts.length > 0) {
        const cachedP = JSON.parse(lastRaw);
        const lastUid = cachedP.uid || savedAccounts[savedAccounts.length - 1]?.uid;
        if (lastUid && cachedP) {
          AppState.currentUser = { uid: lastUid, email: cachedP.email || savedAccounts[0]?.email };
          AppState.usersCache.set(lastUid, cachedP);
          if (window.ProfileManager && typeof ProfileManager.renderProfileUI === "function") {
            ProfileManager.renderProfileUI(lastUid, cachedP);
          }
          const pathname = window.location.pathname;
          if (pathname === "/login" || pathname === "/register" || pathname === "/") {
            Utils.showScreen("lobby-screen", false);
          }
        }
      }
    } catch (e) {}

    onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          if (!AppState.isRegistering) {
            TutorialManager.markDeviceUsed();
          }
          AppState.currentUser = user;
          
          if (window.MaintenanceSystem) {
            window.MaintenanceSystem.applyMaintenanceUI();
          }

          try {
            const dbase = window.db;
            if (dbase && window.ref && window.get && window.remove) {
              window.get(window.ref(dbase, `users/${user.uid}/force_tutorial`)).then((snap) => {
                if (snap.exists() && snap.val() === true) {
                  TutorialManager.startTutorial(true);
                  window.remove(window.ref(dbase, `users/${user.uid}/force_tutorial`));
                }
              });
            }
          } catch (e) {}
          
          // --- Like Notifications ---
          let initialLikesLoad = true;
          try {
            const dbase = window.db;
            if (dbase && window.ref && window.onChildAdded && window.get) {
              window.onChildAdded(window.ref(dbase, `users/${user.uid}/profile/likedBy`), (snap) => {
                if (initialLikesLoad) return;
                const likerUid = snap.key;
                window.get(window.ref(dbase, `users/${likerUid}/profile/name`)).then((nameSnap) => {
                  const likerName = nameSnap.val() || "Кто-то";
                  window.get(window.ref(dbase, `users/${user.uid}/profile/likedBy`)).then((likesSnap) => {
                    const count = likesSnap.exists() ? Object.keys(likesSnap.val()).length : 1;
                    Utils.toast(`Вы получили лайк от ${likerName} - теперь у вас ${count} лайков в профиле`, "info");
                  });
                });
              });
              setTimeout(() => (initialLikesLoad = false), 3000);
            }
          } catch (e) {}
          // --------------------------
          
          const savedAccounts = JSON.parse(
            localStorage.getItem("cowio_saved_accounts") || "[]",
          );
          const existingAcc = savedAccounts.find((a) => a.uid === user.uid);
          if (!existingAcc) {
            savedAccounts.push({ uid: user.uid, email: user.email });
            localStorage.setItem(
              "cowio_saved_accounts",
              JSON.stringify(savedAccounts),
            );
          }

          void AdminPanel.getDeveloperUid();

          // Authoritative routing via Router
          let pathname = window.location.pathname;
          const intended = sessionStorage.getItem("cowio_intended_route");
          if (intended && intended !== "/login" && intended !== "/") {
            pathname = intended;
            sessionStorage.removeItem("cowio_intended_route");
          }

          if (
            pathname === "/login" ||
            pathname === "/register" ||
            pathname === "/"
          ) {
            pathname = "/lobby";
            if (window.Router) window.Router.navigate("/lobby", true);
          }

          Utils.showScreen("lobby-screen", false);
          if (window.Router && typeof window.Router.handleRoute === "function") {
            window.Router.currentPath = null;
            window.Router.handleRoute(pathname, true);
          }

          ProfileManager.bindMyProfileListener();
          FriendsManager.initListeners();
          RoomManager.initLobbyListeners();
          DirectMessages.startNotifications();
          AdminPanel.init();
          if (window.PremiumManager) {
            PremiumManager.handlePostLoginReturn();
            PremiumManager.updateThemeButtons();
          }
          if (window.SupportSystem) window.SupportSystem.initGlobalListener();
          this.bindGlobalPresence();

          // Non-blocking background checks
          (async () => {
            try {
              if (!AppState.isRegistering) {
                await ProfileManager.ensureProfileExists(user);
              }
              const profSnap = await get(ref(db, `users/${user.uid}/profile`));
              if (profSnap.exists()) {
                await BadgeManager.checkLevelBadges(
                  user.uid,
                  Number(profSnap.val().xp) || 0,
                );
              }
              await BadgeManager.checkRelationshipBadges(user.uid);
            } catch (err) {
              console.warn("Background profile/badge checks:", err);
            }
          })();
        } else {
          this.handleLogoutCleanup();
        }
      } finally {
        this.finishAuthBootstrap();
      }
    });

    ThemeManager.init();
    this.bindUI();
  }

  static finishAuthBootstrap() {
    // Auth bootstrap done
  }

  static getApiBase() {
    return typeof window !== "undefined" && window.COWIO_MEDIA_API
      ? String(window.COWIO_MEDIA_API).replace(/\/$/, "")
      : "";
  }

  static lastAuthTokens = new Map();

  static async sendAuthCode(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const res = await fetch(`${this.getApiBase()}/api/custom-auth/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(
        "API send-code failed (HTTP " +
          res.status +
          "): " +
          (text ? text : "Empty body"),
      );
    }
    if (!data.success) throw new Error(data.error || "Ошибка отправки кода");
    if (data.token) {
      this.lastAuthTokens.set(normalizedEmail, data.token);
      try {
        sessionStorage.setItem("cowio_auth_token_" + normalizedEmail, data.token);
      } catch (e) {}
    }
    if (data.code) {
      console.log(`[COWIO] Секретный код для ${normalizedEmail}: ${data.code}`);
      if (window.Utils && typeof Utils.toast === "function") {
        Utils.toast(`Код подтверждения: ${data.code}`, "info");
      }
    }
    return data;
  }

  static async verifyAuthCode(email, code) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    let token = this.lastAuthTokens.get(normalizedEmail) || "";
    if (!token) {
      try {
        token = sessionStorage.getItem("cowio_auth_token_" + normalizedEmail) || "";
      } catch (e) {}
    }
    const res = await fetch(
      `${this.getApiBase()}/api/custom-auth/verify-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: String(code).trim(), token }),
      },
    );
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(
        "API verify-code failed (HTTP " +
          res.status +
          "): " +
          (text ? text : "Empty body"),
      );
    }
    if (!data.success) throw new Error(data.error || "Неверный код");
    return data;
  }

  static showRegVerifyPanel(email) {
    const authRight = document.querySelector(".auth-right");
    authRight?.classList.add("auth-verify-mode");
    Utils.$("login-form")?.classList.remove("active-form");
    Utils.$("reg-form")?.classList.remove("active-form");
    if (Utils.$("login-form")) Utils.$("login-form").style.display = "none";
    if (Utils.$("reg-form")) Utils.$("reg-form").style.display = "none";
    const vf = Utils.$("reg-verify-form");
    if (vf) {
      vf.style.display = "flex";
      vf.classList.add("active-form");
    }
    const emailEl = Utils.$("reg-verify-email-display");
    if (emailEl) emailEl.textContent = email;
    document.querySelectorAll(".reg-code-digit").forEach((inp) => {
      inp.value = "";
    });
    document.querySelector(".reg-code-digit")?.focus();
    this.startRegResendTimer();
  }

  static hideRegVerifyPanel() {
    const authRight = document.querySelector(".auth-right");
    authRight?.classList.remove("auth-verify-mode");
    const vf = Utils.$("reg-verify-form");
    if (vf) {
      vf.style.display = "none";
      vf.classList.remove("active-form");
    }
    if (Utils.$("login-form")) Utils.$("login-form").style.display = "";
    if (Utils.$("reg-form")) Utils.$("reg-form").style.display = "";
    Utils.$("reg-form")?.classList.add("active-form");
    if (AppState.regResendTimer) clearInterval(AppState.regResendTimer);
    AppState.pendingRegistration = null;
  }

  static startRegResendTimer() {
    if (AppState.regResendTimer) clearInterval(AppState.regResendTimer);
    let timerVal = 60;
    const btn = Utils.$("btn-reg-resend-code");
    const tick = () => {
      timerVal--;
      const span = Utils.$("reg-resend-timer");
      if (timerVal <= 0) {
        clearInterval(AppState.regResendTimer);
        AppState.regResendTimer = null;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "Отправить код повторно";
          btn.style.color = "#fff";
        }
      } else if (span) {
        span.textContent = String(timerVal);
      }
    };
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `Отправить повторно (через <span id="reg-resend-timer">60</span>с)`;
      btn.style.color = "var(--text-muted)";
    }
    AppState.regResendTimer = setInterval(tick, 1000);
  }

  static bindRegCodeInputs() {
    const inputs = Array.from(document.querySelectorAll(".reg-code-digit"));
    inputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        const v = e.target.value.replace(/\D/g, "").slice(-1);
        e.target.value = v;
        if (v && index < inputs.length - 1) inputs[index + 1].focus();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData("text") || "")
          .replace(/\D/g, "")
          .slice(0, 6);
        pasted.split("").forEach((ch, i) => {
          if (inputs[i]) inputs[i].value = ch;
        });
        if (pasted.length >= 6) inputs[5]?.focus();
        else inputs[pasted.length]?.focus();
      });
    });
  }

  static getRegCodeValue() {
    return Array.from(document.querySelectorAll(".reg-code-digit"))
      .map((i) => i.value)
      .join("");
  }

  static async completeRegistration(pending) {
    AppState.isRegistering = true;
    const creds = await createUserWithEmailAndPassword(
      auth,
      pending.email,
      pending.pass,
    );
    const savedAccounts = JSON.parse(
      localStorage.getItem("cowio_saved_accounts") || "[]",
    );
    savedAccounts.push({
      uid: creds.user.uid,
      email: pending.email,
      pass: pending.pass,
    });
    localStorage.setItem("cowio_saved_accounts", JSON.stringify(savedAccounts));
    await updateProfile(creds.user, { displayName: pending.name });
    await ProfileManager.createProfile(
      creds.user.uid,
      pending.name,
      pending.username,
      pending.email,
      { provider: "email", emailVerified: true },
      pending.gender,
    );
    TutorialManager.startTutorial();
    AppState.isRegistering = false;
    AuthManager.hideRegVerifyPanel();
    Utils.toast("Аккаунт создан! Добро пожаловать", "success");
  }

  static bindUI() {
    Utils.$("tab-login-btn").onclick = () => {
      Utils.$("tab-login-btn").classList.add("active");
      Utils.$("tab-reg-btn").classList.remove("active");
      Utils.$("login-form").classList.add("active-form");
      Utils.$("reg-form").classList.remove("active-form");
      const leftLogin = Utils.$("auth-left-login");
      const leftReg = Utils.$("auth-left-reg");
      if (leftLogin) leftLogin.style.display = "block";
      if (leftReg) leftReg.style.display = "none";
    };
    
    document.querySelectorAll('#login-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Utils.$("btn-do-login").click();
        });
    });
    document.querySelectorAll('#reg-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Utils.$("btn-do-reg").click();
        });
    });

    Utils.$("tab-reg-btn").onclick = () => {
      Utils.$("tab-reg-btn").classList.add("active");
      Utils.$("tab-login-btn").classList.remove("active");
      Utils.$("reg-form").classList.add("active-form");
      Utils.$("login-form").classList.remove("active-form");
      const leftLogin = Utils.$("auth-left-login");
      const leftReg = Utils.$("auth-left-reg");
      if (leftLogin) leftLogin.style.display = "none";
      if (leftReg) leftReg.style.display = "block";
    };

    if (Utils.$("btn-forgot-password")) {
      Utils.$("btn-forgot-password").onclick = async () => {
        const rawInput = Utils.$("login-email").value.trim();
        let email = rawInput;
        const isEmail = rawInput.includes("@") && rawInput.includes(".") && !rawInput.startsWith("@");
        if (!isEmail && rawInput) {
          const cleanName = rawInput.replace(/^@+/, "").toLowerCase().trim();
          try {
            const { get, ref, getDatabase } = await import(
              "firebase/database"
            );
            const dbase = getDatabase();
            let resolvedUid = null;
            if (cleanName === "developer") {
              const devSnap = await get(ref(dbase, "admin/creatorUid"));
              if (devSnap.exists()) resolvedUid = devSnap.val();
            }
            if (!resolvedUid) {
              const snap = await get(ref(dbase, `usernames/${cleanName}`));
              if (snap.exists()) resolvedUid = snap.val();
            }
            if (resolvedUid) {
              const profileSnap = await get(ref(dbase, `users/${resolvedUid}/profile/email`));
              if (profileSnap.exists() && profileSnap.val()) {
                email = profileSnap.val();
              }
            }
          } catch(e) {
            console.log("Could not resolve username to email", e);
          }
        }
        if (!email) return Utils.toast("Введите почту для сброса", "error");

        Utils.toast("Отправка кода...", "info");
        try {
          const apiBase =
            typeof window !== "undefined" && window.COWIO_MEDIA_API
              ? String(window.COWIO_MEDIA_API).replace(/\/$/, "")
              : "";

          const reqCode = async () => {
            return await AuthManager.sendAuthCode(email);
          };

          await reqCode();

          const code = await Utils.promptCode(email, async () => {
            try {
              await reqCode();
              Utils.toast("Код отправлен повторно", "success");
            } catch (ex) {
              Utils.toast(ex.message, "error");
            }
          });
          if (!code) return Utils.toast("Сброс отменен", "error");

          const newPassword = await Utils.prompt(
            "Введите новый пароль (минимум 6 символов):",
          );
          if (!newPassword || newPassword.length < 6)
            return Utils.toast(
              "Пароль слишком короткий или сброс отменен",
              "error",
            );

          const resetToken = AuthManager.lastAuthTokens.get(email.toLowerCase()) || sessionStorage.getItem("cowio_auth_token_" + email.toLowerCase()) || "";
          const resetRes = await fetch(
            `${apiBase}/api/custom-auth/reset-password`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, code, token: resetToken, newPassword }),
            },
          );
          let resetText = await resetRes.text();
          let resetData;
          try {
            resetData = JSON.parse(resetText);
          } catch (err) {
            throw new Error(
              "API reset-password failed (HTTP " +
                resetRes.status +
                "): " +
                (resetText ? resetText : "Empty body"),
            );
          }
          if (!resetData.success) throw new Error(resetData.error);

          Utils.toast(
            "Пароль успешно изменен! Теперь вы можете войти.",
            "success",
          );
        } catch (e) {
          Utils.toast(e.message || "Ошибка сброса", "error");
        }
      };
    }

    if (Utils.$("btn-settings-change-email")) {
      Utils.$("btn-settings-change-email").onclick = async () => {
        const oldPassword = Utils.$("settings-email-old-password").value;
        const newEmail = Utils.$("settings-new-email").value.trim();
        if (!oldPassword) return Utils.toast("Введите текущий пароль", "error");
        if (!newEmail || !newEmail.includes("@"))
          return Utils.toast("Введите корректную новую почту", "error");
        if (!AppState.currentUser || !AppState.currentUser.email)
          return Utils.toast("Вы не авторизованы", "error");

        try {
          await signInWithEmailAndPassword(
            auth,
            AppState.currentUser.email,
            oldPassword,
          );
        } catch (e) {
          return Utils.toast("Неверный текущий пароль", "error");
        }

        Utils.toast("Отправка кода на " + newEmail + "...", "info");
        try {
          const apiBase =
            typeof window !== "undefined" && window.COWIO_MEDIA_API
              ? String(window.COWIO_MEDIA_API).replace(/\/$/, "")
              : "";

          const reqCodeEmail = async () => {
            return await AuthManager.sendAuthCode(newEmail);
          };

          await reqCodeEmail();

          const code = await Utils.promptCode(newEmail, async () => {
            try {
              await reqCodeEmail();
              Utils.toast("Код отправлен повторно", "success");
            } catch (ex) {
              Utils.toast(ex.message, "error");
            }
          });
          if (!code) return;

          const changeToken = AuthManager.lastAuthTokens.get(newEmail.toLowerCase()) || sessionStorage.getItem("cowio_auth_token_" + newEmail.toLowerCase()) || "";
          const changeRes = await fetch(
            `${apiBase}/api/custom-auth/change-email`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                oldEmail: AppState.currentUser.email,
                newEmail,
                code,
                token: changeToken,
              }),
            },
          );
          let changeText = await changeRes.text();
          let changeData;
          try {
            changeData = JSON.parse(changeText);
          } catch (err) {
            throw new Error(
              "API change-email failed (HTTP " +
                changeRes.status +
                "): " +
                (changeText ? changeText : "Empty body"),
            );
          }
          if (!changeData.success) throw new Error(changeData.error);

          Utils.$("settings-email-old-password").value = "";
          Utils.$("settings-new-email").value = "";
          document.getElementById("security-email-form").style.display = "none";
          Utils.toast(
            "Почта успешно изменена! Рекомендуем перезайти в аккаунт.",
            "success",
          );
        } catch (e) {
          Utils.toast(e.message || "Ошибка", "error");
        }
      };
    }

    if (Utils.$("btn-settings-change-password")) {
      Utils.$("btn-settings-change-password").onclick = async () => {
        const oldPassword = Utils.$("settings-password-old").value;
        const newPassword = Utils.$("settings-new-password").value.trim();
        const confirmPassword = Utils.$(
          "settings-new-password-confirm",
        ).value.trim();

        if (!oldPassword) return Utils.toast("Введите текущий пароль", "error");
        if (!newPassword || newPassword.length < 6)
          return Utils.toast(
            "Введите новый пароль (не менее 6 символов)",
            "error",
          );
        if (newPassword !== confirmPassword)
          return Utils.toast("Новые пароли не совпадают", "error");
        if (!AppState.currentUser || !AppState.currentUser.email)
          return Utils.toast("Вы не авторизованы", "error");

        try {
          await signInWithEmailAndPassword(
            auth,
            AppState.currentUser.email,
            oldPassword,
          );
        } catch (e) {
          return Utils.toast("Неверный текущий пароль", "error");
        }

        const email = AppState.currentUser.email;
        Utils.toast("Отправка кода на вашу текущую почту...", "info");
        try {
          const apiBase =
            typeof window !== "undefined" && window.COWIO_MEDIA_API
              ? String(window.COWIO_MEDIA_API).replace(/\/$/, "")
              : "";

          const reqCodeReauth = async () => {
            return await AuthManager.sendAuthCode(email);
          };

          await reqCodeReauth();

          const code = await Utils.promptCode(email, async () => {
            try {
              await reqCodeReauth();
              Utils.toast("Код отправлен повторно", "success");
            } catch (ex) {
              Utils.toast(ex.message, "error");
            }
          });
          if (!code) return;

          const reauthToken = AuthManager.lastAuthTokens.get(email.toLowerCase()) || sessionStorage.getItem("cowio_auth_token_" + email.toLowerCase()) || "";
          const resetRes = await fetch(
            `${apiBase}/api/custom-auth/reset-password`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, code, token: reauthToken, newPassword }),
            },
          );
          let resetText = await resetRes.text();
          let resetData;
          try {
            resetData = JSON.parse(resetText);
          } catch (err) {
            throw new Error(
              "API reset-password failed (HTTP " +
                resetRes.status +
                "): " +
                (resetText ? resetText : "Empty body"),
            );
          }
          if (!resetData.success) throw new Error(resetData.error);

          Utils.$("settings-password-old").value = "";
          Utils.$("settings-new-password").value = "";
          Utils.$("settings-new-password-confirm").value = "";
          document.getElementById("security-password-form").style.display =
            "none";
          Utils.toast("Пароль успешно изменен!", "success");
        } catch (e) {
          Utils.toast(e.message || "Ошибка", "error");
        }
      };
    }

    Utils.$("btn-do-login").onclick = async () => {
      if (
        !SecurityManager.validateAction("auth_login", {
          count: 5,
          timeWindowMs: 30000,
        })
      )
        return;

      const rawInput = Utils.$("login-email").value.trim();
      let email = rawInput;

      // Handle username input (with or without @ prefix, e.g. @developer or developer)
      const isEmail = rawInput.includes("@") && rawInput.includes(".") && !rawInput.startsWith("@");
      if (!isEmail && rawInput) {
        const cleanName = rawInput.replace(/^@+/, "").toLowerCase().trim();
        try {
          const { get, ref, getDatabase } = await import(
            "firebase/database"
          );
          const dbase = getDatabase();
          let resolvedUid = null;

          if (cleanName === "developer") {
            const devSnap = await get(ref(dbase, "admin/creatorUid"));
            if (devSnap.exists()) resolvedUid = devSnap.val();
          }

          if (!resolvedUid) {
            const snap = await get(ref(dbase, `usernames/${cleanName}`));
            if (snap.exists()) resolvedUid = snap.val();
          }

          if (resolvedUid) {
            const profileSnap = await get(ref(dbase, `users/${resolvedUid}/profile/email`));
            if (profileSnap.exists() && profileSnap.val()) {
              email = profileSnap.val();
            }
          }
        } catch(e) {
          console.log("Could not resolve username to email", e);
        }
      }

      const pass = Utils.$("login-pass").value.trim();
      if (!email || !pass) return Utils.toast("Заполните все поля", "error");

      try {
        Utils.$("btn-do-login").disabled = true;
        const cred = await signInWithEmailAndPassword(auth, email, pass);

        // Reset password and enable button
        Utils.$("login-pass").value = "";
        Utils.$("btn-do-login").disabled = false;

        // save password for 1-click login
        const savedAccounts = JSON.parse(
          localStorage.getItem("cowio_saved_accounts") || "[]",
        );
        const existingAcc = savedAccounts.find((a) => a.email === email);
        if (existingAcc) existingAcc.pass = pass;
        else
          savedAccounts.push({ uid: cred.user.uid, email: email, pass: pass });
        localStorage.setItem(
          "cowio_saved_accounts",
          JSON.stringify(savedAccounts),
        );

        // Instant UI transition to lobby
        Utils.showScreen("lobby-screen", false);

        const intended = sessionStorage.getItem("cowio_intended_route");
        const nextRoute =
          intended && intended !== "/login" && intended !== "/"
            ? intended
            : "/lobby";
        if (intended) sessionStorage.removeItem("cowio_intended_route");

        if (window.Router && typeof window.Router.handleRoute === "function") {
          window.Router.currentPath = null;
          window.Router.navigate(nextRoute, true);
          window.Router.handleRoute(nextRoute, true);
        }
      } catch (e) {
        console.error("Login failed:", e);
        Utils.toast("Ошибка входа. Проверьте данные.", "error");
        Utils.$("btn-do-login").disabled = false;
      }
    };

    this.bindRegCodeInputs();

    if (Utils.$("btn-reg-verify-back")) {
      Utils.$("btn-reg-verify-back").onclick = () => {
        this.hideRegVerifyPanel();
        Utils.$("btn-do-reg").disabled = false;
      };
    }

    if (Utils.$("btn-reg-resend-code")) {
      Utils.$("btn-reg-resend-code").onclick = async () => {
        if (!AppState.pendingRegistration?.email) return;
        try {
          await this.sendAuthCode(AppState.pendingRegistration.email);
          Utils.toast("Код отправлен повторно", "success");
          this.startRegResendTimer();
        } catch (e) {
          Utils.toast(e.message, "error");
        }
      };
    }

    if (Utils.$("btn-reg-verify-submit")) {
      Utils.$("btn-reg-verify-submit").onclick = async () => {
        const pending = AppState.pendingRegistration;
        if (!pending) return Utils.toast("Сессия регистрации истекла", "error");
        const code = this.getRegCodeValue();
        if (code.length !== 6)
          return Utils.toast("Введите 6-значный код", "error");
        try {
          Utils.$("btn-reg-verify-submit").disabled = true;
          await this.verifyAuthCode(pending.email, code);
          await this.completeRegistration(pending);
        } catch (e) {
          Utils.toast(e.message || "Ошибка подтверждения", "error");
        } finally {
          Utils.$("btn-reg-verify-submit").disabled = false;
        }
      };
    }

    Utils.$("btn-do-reg").onclick = async () => {
      if (
        !SecurityManager.validateAction("auth_register", {
          count: 2,
          timeWindowMs: 60000,
        })
      )
        return;
      if (AppState.admin.settings.globalRegistrationsBlocked)
        return Utils.toast("Регистрация временно отключена", "error");
      const email = Utils.$("reg-email").value.trim();
      const pass = Utils.$("reg-pass").value.trim();
      const name = Utils.$("reg-name").value.trim();
      let username = Utils.$("reg-username")
        .value.toLowerCase()
        .trim()
        .replace("@", "");
      const agreementAccepted = Utils.$("reg-agreement")?.checked;
      const gender =
        document.querySelector('input[name="reg-gender"]:checked')?.value ||
        "male";

      if (!email || pass.length < 6 || !name || !username)
        return Utils.toast("Заполните поля. Пароль от 6 символов.", "error");
      if (!agreementAccepted)
        return Utils.toast("Примите пользовательское соглашение", "error");
      if (!/^[a-z0-9_]{3,15}$/.test(username))
        return Utils.toast("ID: 3-15 символов, только a-z, 0-9 и _", "error");
      if (username === "developer")
        return Utils.toast("ID developer зарезервирован!", "error");

      try {
        Utils.$("btn-do-reg").disabled = true;

        const isAvail =
          await ProfileManager.checkUsernameAvailability(username);
        if (!isAvail)
          throw new Error("Этот @ID уже занят другим пользователем!");

        
        AppState.pendingRegistration = { email, pass, name, username, gender };
        
        if (AppState.admin.settings.emailVerificationBlocked) {
           Utils.toast("Верификация отключена. Регистрация завершается...", "info");
           await this.completeRegistration(AppState.pendingRegistration);
        } else {
           Utils.toast("Отправка кода на почту...", "info");
           await this.sendAuthCode(email);
           this.showRegVerifyPanel(email);
           Utils.toast("Введите код из письма", "success");
        }

      } catch (e) {
        Utils.toast(e.message, "error");
        Utils.$("btn-do-reg").disabled = false;
      }
    };

    const handleGoogleAuth = async () => {
      try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const snap = await get(ref(db, `users/${result.user.uid}/profile`));
        if (!snap.exists()) {
          AppState.isRegistering = true;
          const baseName = result.user.displayName || "GoogleUser";
          const rand = Utils.generateCryptoId(4);
          await ProfileManager.createProfile(
            result.user.uid,
            baseName,
            `user_${rand}`,
            result.user.email,
            {
              provider: "google",
              emailVerified: Boolean(result.user.emailVerified),
            },
          );
          TutorialManager.startTutorial();
          AppState.isRegistering = false;
        }
      } catch (e) {
        Utils.toast("Ошибка входа через Google", "error");
      }
    };

    Utils.$("btn-google-login").onclick = handleGoogleAuth;
    Utils.$("btn-google-reg").onclick = handleGoogleAuth;

    Utils.$("btn-logout").onclick = () => signOut(auth);
  }

  static async bindGlobalPresence() {
    const uid = AppState.currentUser.uid;
    const connectedRef = ref(db, ".info/connected");
    const userStatusRef = ref(db, `users/${uid}/status`);

    let currentIp = "unavailable";
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json", {
        signal: AbortSignal.timeout(1200),
      });
      const ipData = await ipRes.json();
      if (ipData && ipData.ip) {
        currentIp = ipData.ip;
      }
    } catch (e) {
      // ignore
    }

    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(userStatusRef)
          .set({ online: false, lastActive: Date.now(), ip: currentIp })
          .then(() =>
            set(userStatusRef, {
              online: true,
              lastActive: Date.now(),
              ip: currentIp,
            }),
          );
      }
    });
  }

  static handleLogoutCleanup() {
    AppState.currentUser = null;
    if (window.location.pathname !== "/login") {
      sessionStorage.setItem("cowio_intended_route", window.location.pathname);
    }
    Utils.showScreen("auth-screen");
    Utils.$("login-pass").value = "";
    Utils.$("reg-pass").value = "";
    Utils.$("btn-do-login").disabled = false;
    Utils.$("btn-do-reg").disabled = false;
    AdminPanel.handleLogoutCleanup();
    RoomManager.leaveRoom();
    AppState.activeSubscriptions.forEach((unsub) => unsub());
    AppState.activeSubscriptions = [];
  }
}

window.BadgeManager = BadgeManager;
window.AuthManager = AuthManager;
export { BadgeManager, AuthManager };
