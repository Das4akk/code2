/**
 * COWIO System Maintenance Engine
 * Provides Real-Time Maintenance Mode for Global Site and Individual Sections.
 * Exclusively controlled by @developer / Creator.
 */
import { ref, set, update, get, onValue } from "./firebase.js";
import { db } from "./firebase.js";

class MaintenanceSystem {
  static state = {
    global: false,
    reason: "",
    updatedAt: 0,
    sections: {
      rooms: false,
      friends: false,
      support: false,
      library: false,
      leaderboard: false,
      catalog: false,
      mystery: false,
      premium: false,
      settings: false,
    },
  };

  static SECTION_CONFIG = {
    rooms: {
      title: "Комнаты",
      elementId: "section-rooms",
      navId: "nav-rooms",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Television.webp",
    },
    friends: {
      title: "Друзья и Сообщения",
      elementId: "section-friends",
      extraElements: ["section-find-friend"],
      navId: "nav-friends",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Handshake.webp",
    },
    support: {
      title: "Поддержка",
      elementId: "section-support",
      navId: "nav-support",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Incoming%20Envelope.webp",
    },
    library: {
      title: "Библиотека",
      elementId: "section-library",
      navId: "nav-library",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Books.webp",
    },
    leaderboard: {
      title: "Лидерборд",
      elementId: "section-leaderboard",
      navId: "nav-leaderboard",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Trophy.webp",
    },
    catalog: {
      title: "Каталог",
      elementId: "section-catalog",
      navId: "nav-catalog",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Shopping%20Bags.webp",
    },
    mystery: {
      title: "Мистери Бокс",
      elementId: "section-mystery",
      navId: "nav-mystery",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gift.webp",
    },
    premium: {
      title: "Премиум",
      elementId: "section-premium",
      navId: "nav-premium",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Crown.webp",
    },
    settings: {
      title: "Настройки",
      elementId: "section-settings",
      navId: "nav-settings",
      icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gear.webp",
    },
  };

  static isListening = false;
  static previewAsUser = false; // Dev tool to test user experience

  static init() {
    this.createGlobalOverlay();
    this.createDevTopBanner();
    this.listenMaintenance();
    this.applyMaintenanceUI();
  }

  static isCreator() {
    if (this.previewAsUser) return false;

    // Use server-backed AdminPanel creator validation
    if (typeof window.AdminPanel !== "undefined" && typeof window.AdminPanel.isCurrentUserCreator === "function") {
      try {
        return window.AdminPanel.isCurrentUserCreator();
      } catch (e) {}
    }

    const user = window.AppState?.currentUser;
    if (!user) return false;

    const myUid = user?.uid;
    const myProf = (myUid && window.AppState?.usersCache?.get(myUid)) || user.profile || {};
    const role = String(myProf?.role || "").toLowerCase().trim();
    return role === "creator";
  }

  static createDevTopBanner() {
    if (document.getElementById("dev-maintenance-top-banner")) return;

    const banner = document.createElement("div");
    banner.id = "dev-maintenance-top-banner";
    banner.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000000;
      background: rgba(220, 38, 38, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffffff;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      align-items: center;
      justify-content: space-between;
      box-sizing: border-box;
      animation: slideDown 0.3s ease-out;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Stop%20Sign.webp" style="width: 22px; height: 22px; object-fit: contain;" alt="🛑">
        <span><strong>ВНИМАНИЕ:</strong> Сайт закрыт на Тех.Перерыв для пользователей (Вы вошли как @developer).</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" id="btn-banner-preview-toggle" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); color: #fff; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(8px);">
          <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Eyes.webp" style="width: 14px; height: 14px; vertical-align: middle;">
          <span>Превью пользователя</span>
        </button>
        <button type="button" id="btn-banner-open-admin" style="background: #ffffff; color: #b91c1c; border: none; padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
          <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gear.webp" style="width: 14px; height: 14px; vertical-align: middle;">
          <span>Управление</span>
        </button>
        <button type="button" id="btn-banner-disable-maint" style="background: rgba(0,0,0,0.35); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width: 14px; height: 14px; vertical-align: middle;">
          <span>Снять тех.перерыв</span>
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    const openAdminBtn = banner.querySelector("#btn-banner-open-admin");
    if (openAdminBtn) {
      openAdminBtn.onclick = () => {
        if (typeof window.AdminPanel !== "undefined") {
          window.AdminPanel.openPanel();
          window.AdminPanel.switchGodModeSection("maintenance");
        }
      };
    }

    const disableBtn = banner.querySelector("#btn-banner-disable-maint");
    if (disableBtn) {
      disableBtn.onclick = () => {
        this.setGlobalMaintenance(false);
      };
    }

    const previewBtn = banner.querySelector("#btn-banner-preview-toggle");
    if (previewBtn) {
      previewBtn.onclick = () => {
        this.previewAsUser = !this.previewAsUser;
        const textSpan = previewBtn.querySelector("span");
        if (textSpan) {
          textSpan.innerText = this.previewAsUser ? "Выйти из превью" : "Превью пользователя";
        }
        this.applyMaintenanceUI();
      };
    }
  }

  static createGlobalOverlay() {
    if (document.getElementById("global-maintenance-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "global-maintenance-overlay";
    overlay.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999999;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(32px) saturate(190%);
      -webkit-backdrop-filter: blur(32px) saturate(190%);
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      pointer-events: all;
    `;

    overlay.innerHTML = `
      <div style="
        max-width: 540px;
        width: 100%;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
        animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" 
             style="width: 88px; height: 88px; margin: 0 auto 24px; display: block; object-fit: contain;" 
             alt="🔒">
        <h1 style="font-size: 28px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; letter-spacing: -0.02em; line-height: 1.25; text-shadow: 0 2px 20px rgba(0,0,0,0.8);">
          Сайт закрыт на Тех.Перерыв
        </h1>
        <p style="font-size: 15px; color: rgba(255, 255, 255, 0.85); margin: 0; line-height: 1.6; font-weight: 500; text-shadow: 0 2px 12px rgba(0,0,0,0.7);">
          Приносим извинения за предоставленные неудобства, в скором времени все скоро наладится!
        </p>
        <div id="maintenance-preview-exit-wrap" style="margin-top: 26px; display: none;">
          <button type="button" class="secondary-btn" id="btn-exit-preview" style="padding: 10px 22px; font-size: 13px; font-weight: 700; border-radius: 12px; color: #fff; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(12px); display: inline-flex; align-items: center; gap: 8px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
            <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width: 14px; height: 14px; vertical-align: middle;">
            <span>Выйти из режима предпросмотра</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const exitPreviewBtn = overlay.querySelector("#btn-exit-preview");
    if (exitPreviewBtn) {
      exitPreviewBtn.onclick = () => {
        this.previewAsUser = false;
        this.applyMaintenanceUI();
      };
    }
  }

  static listenMaintenance() {
    if (this.isListening) return;
    this.isListening = true;

    try {
      const maintRef = ref(db, "system/maintenance");
      onValue(maintRef, (snap) => {
        const val = snap.val();
        if (val) {
          this.state = {
            global: Boolean(val.global),
            reason: val.reason || "",
            updatedAt: val.updatedAt || 0,
            sections: val.sections || {},
          };
        } else {
          this.state = {
            global: false,
            reason: "",
            updatedAt: 0,
            sections: {},
          };
        }
        this.applyMaintenanceUI();
        this.renderAdminMaintenanceUI();
      });
    } catch (e) {
      console.warn("[Maintenance] Listen error:", e);
    }
  }

  static applyMaintenanceUI() {
    const isDev = this.isCreator();
    const globalOverlay = document.getElementById("global-maintenance-overlay");
    const devTopBanner = document.getElementById("dev-maintenance-top-banner");
    const previewExitWrap = document.getElementById("maintenance-preview-exit-wrap");

    // 1. Global site maintenance
    if (this.state.global) {
      if (isDev) {
        if (globalOverlay) globalOverlay.style.display = "none";
        if (devTopBanner) devTopBanner.style.display = "flex";
      } else {
        if (globalOverlay) {
          globalOverlay.style.display = "flex";
          if (previewExitWrap) {
            previewExitWrap.style.display = this.previewAsUser ? "block" : "none";
          }
        }
        if (devTopBanner) devTopBanner.style.display = "none";
      }
    } else {
      if (globalOverlay) globalOverlay.style.display = "none";
      if (devTopBanner) devTopBanner.style.display = "none";
    }

    // 2. Section maintenance & navigation indicators
    this.applySectionOverlays(isDev);
    this.updateNavigationBadges();
  }

  static updateNavigationBadges() {
    for (const [key, conf] of Object.entries(this.SECTION_CONFIG)) {
      const navEl = document.getElementById(conf.navId);
      if (!navEl) continue;

      const isLocked = Boolean(this.state.sections?.[key]);
      let badge = navEl.querySelector(".nav-maint-badge");

      if (isLocked) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "nav-maint-badge";
          badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 700;
            background: rgba(239, 68, 68, 0.85);
            backdrop-filter: blur(8px);
            color: #ffffff;
            border-radius: 6px;
            margin-left: 6px;
            line-height: 1;
          `;
          badge.innerHTML = `
            <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" style="width: 10px; height: 10px; object-fit: contain;">
            <span>тех.перерыв</span>
          `;
          navEl.appendChild(badge);
        } else {
          badge.style.display = "inline-flex";
        }
      } else {
        if (badge) badge.style.display = "none";
      }
    }
  }

  static applySectionOverlays(isDev = this.isCreator()) {
    for (const [sectionKey, conf] of Object.entries(this.SECTION_CONFIG)) {
      const elementIds = [conf.elementId, ...(conf.extraElements || [])];

      for (const elemId of elementIds) {
        const sectionEl = document.getElementById(elemId);
        if (!sectionEl) continue;

        const isLocked = Boolean(this.state.sections?.[sectionKey]);
        let overlay = sectionEl.querySelector(".section-maintenance-overlay");
        let devNotice = sectionEl.querySelector(".section-dev-maintenance-notice");

        if (isLocked) {
          if (!isDev) {
            // Regular user view: pure blur blocking overlay without opaque rectangular boxes
            if (devNotice) devNotice.style.display = "none";
            if (!overlay) {
              overlay = document.createElement("div");
              overlay.className = "section-maintenance-overlay";
              overlay.style.cssText = `
                position: absolute;
                inset: 0;
                z-index: 99999;
                background: rgba(0, 0, 0, 0.45);
                backdrop-filter: blur(28px) saturate(180%);
                -webkit-backdrop-filter: blur(28px) saturate(180%);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
                border-radius: inherit;
              `;
              overlay.innerHTML = `
                <div style="
                  max-width: 480px;
                  width: 100%;
                  text-align: center;
                  padding: 20px;
                  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                ">
                  <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" 
                       style="width: 72px; height: 72px; margin: 0 auto 18px; display: block; object-fit: contain;" 
                       alt="🔒">
                  <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; line-height: 1.3; text-shadow: 0 2px 16px rgba(0,0,0,0.8);">
                    Раздел "${conf.title}" закрыт на Тех.Перерыв
                  </h2>
                  <p style="font-size: 14px; color: rgba(255, 255, 255, 0.85); margin: 0; line-height: 1.6; font-weight: 500; text-shadow: 0 2px 10px rgba(0,0,0,0.7);">
                    Приносим извинения за предоставленные неудобства, в скором времени все скоро наладится!
                  </p>
                </div>
              `;
              if (getComputedStyle(sectionEl).position === "static") {
                sectionEl.style.position = "relative";
              }
              sectionEl.appendChild(overlay);
            } else {
              overlay.style.display = "flex";
            }
          } else {
            // Developer view: visible content + sleek translucent glass notice
            if (overlay) overlay.style.display = "none";
            if (!devNotice) {
              devNotice = document.createElement("div");
              devNotice.className = "section-dev-maintenance-notice";
              devNotice.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: rgba(239, 68, 68, 0.18);
                border: 1px solid rgba(239, 68, 68, 0.4);
                backdrop-filter: blur(12px);
                border-radius: 12px;
                margin: 12px 16px;
                color: #fca5a5;
                font-size: 12.5px;
                font-weight: 700;
              `;
              devNotice.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Stop%20Sign.webp" style="width: 16px; height: 16px; object-fit: contain;">
                  <span>Этот раздел закрыт на Тех.Перерыв (Видно только вам как @developer)</span>
                </div>
                <button type="button" class="danger-btn" style="padding:4px 10px; font-size:11px; width:auto; border-radius:6px;" onclick="MaintenanceSystem.setSectionMaintenance('${sectionKey}', false)">
                  Открыть раздел
                </button>
              `;
              sectionEl.insertBefore(devNotice, sectionEl.firstChild);
            } else {
              devNotice.style.display = "flex";
            }
          }
        } else {
          if (overlay) overlay.style.display = "none";
          if (devNotice) devNotice.style.display = "none";
        }
      }
    }
  }

  static async _saveToServerMaintenance(payload) {
    const authObj = window.auth || (await import("./firebase.js")).auth;
    const token = authObj?.currentUser ? await authObj.currentUser.getIdToken() : "";
    if (!token) throw new Error("Пользователь не авторизован");
    const res = await fetch("/api/admin?action=set-maintenance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error(`Сервер ответил ошибкой (${res.status}): ${text.slice(0, 120)}`);
    }
    if (!res.ok || data.error) {
      throw new Error(data.error || "Ошибка сохранения на сервере");
    }
    return data;
  }

  static async setGlobalMaintenance(active, reason = "") {
    if (!this.isCreator()) {
      window.Utils?.toast?.("Доступно исключительно для @developer", "error");
      return;
    }

    try {
      try {
        await update(ref(db, "system/maintenance"), {
          global: Boolean(active),
          reason: reason || "",
          updatedAt: Date.now(),
        });
      } catch (clientErr) {
        console.warn("[Maintenance] Client write to /system/maintenance failed, trying server API fallback:", clientErr);
        await this._saveToServerMaintenance({
          type: "global",
          global: Boolean(active),
          reason: reason || "",
        });
      }

      this.state.global = Boolean(active);
      this.applyMaintenanceUI();
      this.renderAdminMaintenanceUI();

      window.Utils?.toast?.(
        active ? "Сайт успешно закрыт на Тех.Перерыв для пользователей!" : "Сайт снова открыт для всех пользователей!",
        "success"
      );
    } catch (e) {
      console.error("[Maintenance] setGlobal error:", e);
      window.Utils?.toast?.("Ошибка при сохранении: " + e.message, "error");
    }
  }

  static async setSectionMaintenance(sectionKey, active) {
    if (!this.isCreator()) {
      window.Utils?.toast?.("Доступно исключительно для @developer", "error");
      return;
    }

    try {
      const conf = this.SECTION_CONFIG[sectionKey];
      const title = conf?.title || sectionKey;

      try {
        await update(ref(db, `system/maintenance/sections`), {
          [sectionKey]: Boolean(active),
        });
      } catch (clientErr) {
        console.warn("[Maintenance] Client write to /system/maintenance/sections failed, trying server API fallback:", clientErr);
        await this._saveToServerMaintenance({
          type: "section",
          sectionKey,
          active: Boolean(active),
        });
      }

      if (!this.state.sections) this.state.sections = {};
      this.state.sections[sectionKey] = Boolean(active);

      this.applyMaintenanceUI();
      this.renderAdminMaintenanceUI();

      window.Utils?.toast?.(
        active ? `Раздел "${title}" переведён в Тех.Перерыв` : `Раздел "${title}" открыт для пользователей`,
        "success"
      );
    } catch (e) {
      console.error("[Maintenance] setSection error:", e);
      window.Utils?.toast?.("Ошибка при сохранении: " + e.message, "error");
    }
  }

  static renderAdminMaintenanceUI() {
    const isGlobal = Boolean(this.state.global);

    // Global toggle card in Admin Panel
    const globalCard = document.getElementById("admin-maint-global-card");
    if (globalCard) {
      globalCard.style.background = isGlobal ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.04)";
      globalCard.style.borderColor = isGlobal ? "rgba(239, 68, 68, 0.45)" : "rgba(255, 255, 255, 0.14)";
      globalCard.style.backdropFilter = "blur(12px)";
    }

    const globalStatusText = document.getElementById("admin-maint-global-status-text");
    if (globalStatusText) {
      globalStatusText.innerHTML = isGlobal
        ? `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;">Сайт ЗАКРЫТ на тех.перерыв для обычных пользователей`
        : `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Check%20Mark%20Button.webp" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;">Сайт ОТКРЫТ и полностью доступен`;
      globalStatusText.style.color = isGlobal ? "#fca5a5" : "#86efac";
    }

    const globalActionBtn = document.getElementById("btn-admin-toggle-global-maint-action");
    if (globalActionBtn) {
      globalActionBtn.innerHTML = isGlobal
        ? `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Check%20Mark%20Button.webp" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;">Открыть сайт`
        : `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;">Закрыть весь сайт`;
      globalActionBtn.className = isGlobal ? "danger-btn" : "primary-btn";
      globalActionBtn.style.background = isGlobal ? "#ef4444 !important" : "#ffffff !important";
      globalActionBtn.style.color = isGlobal ? "#ffffff !important" : "#000000 !important";
    }

    // Update section cards in the grid
    for (const [key, conf] of Object.entries(this.SECTION_CONFIG)) {
      const card = document.querySelector(`.admin-maint-sec-card[data-key="${key}"]`);
      if (!card) continue;

      const isLocked = Boolean(this.state.sections?.[key]);
      card.style.background = isLocked ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.03)";
      card.style.borderColor = isLocked ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 255, 255, 0.1)";
      card.style.backdropFilter = "blur(12px)";

      const statusEl = card.querySelector(".admin-maint-sec-status");
      if (statusEl) {
        statusEl.innerHTML = isLocked
          ? `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Cross%20Mark.webp" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;">Закрыт на тех.перерыв`
          : `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Check%20Mark%20Button.webp" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;">Открыт для всех`;
        statusEl.style.color = isLocked ? "#fca5a5" : "rgba(255,255,255,0.55)";
      }

      const btn = card.querySelector(".admin-maint-sec-btn");
      if (btn) {
        btn.className = isLocked ? "danger-btn admin-maint-sec-btn" : "secondary-btn admin-maint-sec-btn";
        btn.innerText = isLocked ? "Разблокировать" : "Закрыть";
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.MaintenanceSystem = MaintenanceSystem;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MaintenanceSystem.init());
  } else {
    MaintenanceSystem.init();
  }
}

export default MaintenanceSystem;
export { MaintenanceSystem };

