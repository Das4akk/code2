/**
 * COWIO System Maintenance Engine
 * Provides Real-Time Maintenance Mode for Global Site and Individual Sections.
 * Exclusively controlled by @developer / Creator (mankaef@yandex.ru).
 */

import { ref, set, update, get, onValue } from "firebase/database";
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
      title: "Каталог (Базар)",
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

    const user = window.AppState?.currentUser;
    const userEmail = String(user?.email || "").toLowerCase().trim();
    if (userEmail === "mankaef@yandex.ru" || userEmail === "cowiosupport@gmail.com") return true;

    if (typeof AdminPanel !== "undefined") {
      if (typeof AdminPanel.isCurrentUserCreator === "function" && AdminPanel.isCurrentUserCreator()) return true;
      if (typeof AdminPanel.isCurrentUserAdmin === "function" && AdminPanel.isCurrentUserAdmin()) return true;
    }
    const myUid = user?.uid;
    if (!myUid) return false;

    const myProf = window.AppState?.usersCache?.get(myUid) || {};
    const username = String(myProf?.username || "").toLowerCase().trim();
    const role = String(myProf?.role || "").toLowerCase().trim();

    if (username === "developer" || username === "creator") return true;
    if (role === "developer" || role === "creator" || myProf?.isOwner === true) return true;

    return false;
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
      background: linear-gradient(90deg, #ff3333, #e60000, #ff5500);
      color: #ffffff;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 20px rgba(255, 0, 0, 0.45);
      align-items: center;
      justify-content: space-between;
      box-sizing: border-box;
      animation: slideDown 0.3s ease-out;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">🛑</span>
        <span><strong>ВНИМАНИЕ:</strong> Сайт закрыт на Тех.Перерыв для пользователей (Вы вошли как разработчик).</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" id="btn-banner-preview-toggle" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 4px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
          👁️ Превью пользователя
        </button>
        <button type="button" id="btn-banner-open-admin" style="background: #ffffff; color: #cc0000; border: none; padding: 4px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer;">
          ⚙️ Управление
        </button>
        <button type="button" id="btn-banner-disable-maint" style="background: rgba(0,0,0,0.3); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
          ✕ Снять тех.перерыв
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    const openAdminBtn = banner.querySelector("#btn-banner-open-admin");
    if (openAdminBtn) {
      openAdminBtn.onclick = () => {
        if (typeof AdminPanel !== "undefined") {
          AdminPanel.openPanel();
          AdminPanel.switchGodModeSection("maintenance");
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
        previewBtn.innerText = this.previewAsUser ? "Выйти из превью" : "👁️ Превью пользователя";
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
      background: rgba(4, 4, 8, 0.78);
      backdrop-filter: blur(36px) saturate(200%);
      -webkit-backdrop-filter: blur(36px) saturate(200%);
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      pointer-events: all;
    `;

    overlay.innerHTML = `
      <div style="
        width: 100%;
        max-width: 520px;
        background: rgba(10, 10, 14, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 28px;
        padding: 44px 32px;
        text-align: center;
        box-shadow: 0 32px 90px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        box-sizing: border-box;
        animation: modalPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      ">
        <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" 
             style="width: 82px; height: 82px; margin: 0 auto 22px; display: block; filter: drop-shadow(0 0 28px rgba(255, 215, 0, 0.45)); object-fit: contain;" 
             alt="🔒">
        <h1 style="font-size: 27px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; letter-spacing: -0.02em; line-height: 1.25;">
          Сайт закрыт на Тех.Перерыв
        </h1>
        <p style="font-size: 14px; color: rgba(255, 255, 255, 0.74); margin: 0; line-height: 1.6; font-weight: 400;">
          Приносим извинения за предоставленные неудобства, в скором времени все скоро наладится!
        </p>
        <div id="maintenance-preview-exit-wrap" style="margin-top: 24px; display: none;">
          <button type="button" class="secondary-btn" id="btn-exit-preview" style="padding: 8px 18px; font-size: 12.5px; border-radius: 10px; color: #fff; background: rgba(255,255,255,0.15);">
            ✕ Выйти из режима предпросмотра
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
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 700;
            background: rgba(255, 75, 75, 0.85);
            color: #ffffff;
            border-radius: 6px;
            margin-left: 6px;
            line-height: 1;
          `;
          badge.innerText = "тех.перерыв";
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
            // Regular user view: full blur blocking overlay
            if (devNotice) devNotice.style.display = "none";
            if (!overlay) {
              overlay = document.createElement("div");
              overlay.className = "section-maintenance-overlay";
              overlay.style.cssText = `
                position: absolute;
                inset: 0;
                z-index: 99999;
                background: rgba(6, 6, 10, 0.78);
                backdrop-filter: blur(30px) saturate(190%);
                -webkit-backdrop-filter: blur(30px) saturate(190%);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
                border-radius: inherit;
              `;
              overlay.innerHTML = `
                <div style="
                  width: 100%;
                  max-width: 460px;
                  background: rgba(12, 12, 16, 0.72);
                  border: 1px solid rgba(255, 255, 255, 0.18);
                  border-radius: 22px;
                  padding: 36px 26px;
                  text-align: center;
                  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
                  animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                ">
                  <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" 
                       style="width: 66px; height: 66px; margin: 0 auto 18px; display: block; filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.35)); object-fit: contain;" 
                       alt="🔒">
                  <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; line-height: 1.3;">
                    Раздел "${conf.title}" закрыт на Тех.Перерыв
                  </h2>
                  <p style="font-size: 13.5px; color: rgba(255, 255, 255, 0.74); margin: 0; line-height: 1.6;">
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
            // Developer view: visible content + distinct top notice banner
            if (overlay) overlay.style.display = "none";
            if (!devNotice) {
              devNotice = document.createElement("div");
              devNotice.className = "section-dev-maintenance-notice";
              devNotice.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: rgba(255, 75, 75, 0.15);
                border: 1px solid rgba(255, 75, 75, 0.4);
                border-radius: 12px;
                margin: 12px 16px;
                color: #ff9999;
                font-size: 12.5px;
                font-weight: 600;
              `;
              devNotice.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Locked%20With%20Key.webp" style="width:16px;height:16px;">
                  <span>⚠️ Этот раздел закрыт на Тех.Перерыв (Видно только вам как разработчику)</span>
                </div>
                <button type="button" class="danger-btn" style="padding:4px 10px; font-size:11px; width:auto; border-radius:6px;" onclick="MaintenanceSystem.setSectionMaintenance('${sectionKey}', false)">
                  Разблокировать
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

  static async setGlobalMaintenance(active) {
    if (!this.isCreator()) {
      if (window.Utils) window.Utils.toast("Доступно исключительно для @developer", "error");
      return;
    }

    try {
      await set(ref(db, "system/maintenance/global"), Boolean(active));
      await set(ref(db, "system/maintenance/updatedAt"), Date.now());
      if (window.Utils) {
        window.Utils.toast(
          active ? "Сайт успешно закрыт на Тех.Перерыв для пользователей!" : "Сайт снова открыт для всех пользователей!",
          active ? "warning" : "success"
        );
      }
      this.state.global = Boolean(active);
      this.applyMaintenanceUI();
      this.renderAdminMaintenanceUI();
    } catch (e) {
      console.error("[Maintenance] Set global error:", e);
      if (window.Utils) window.Utils.toast("Ошибка обновления статуса", "error");
    }
  }

  static async setSectionMaintenance(sectionKey, active) {
    if (!this.isCreator()) {
      if (window.Utils) window.Utils.toast("Доступно исключительно для @developer", "error");
      return;
    }

    try {
      await set(ref(db, `system/maintenance/sections/${sectionKey}`), Boolean(active));
      await set(ref(db, "system/maintenance/updatedAt"), Date.now());
      const title = this.SECTION_CONFIG[sectionKey]?.title || sectionKey;
      if (window.Utils) {
        window.Utils.toast(
          active ? `Раздел "${title}" переведён в Тех.Перерыв` : `Раздел "${title}" открыт для пользователей`,
          active ? "warning" : "success"
        );
      }
      this.state.sections = this.state.sections || {};
      this.state.sections[sectionKey] = Boolean(active);
      this.applyMaintenanceUI();
      this.renderAdminMaintenanceUI();
    } catch (e) {
      console.error("[Maintenance] Set section error:", e);
      if (window.Utils) window.Utils.toast("Ошибка обновления раздела", "error");
    }
  }

  static renderAdminMaintenanceUI() {
    const isGlobal = Boolean(this.state.global);
    const globalCard = document.getElementById("admin-maint-global-card");
    const globalIcon = document.getElementById("admin-maint-global-icon");
    const globalStatusBadge = document.getElementById("admin-maint-global-status-badge");
    const globalDesc = document.getElementById("admin-maint-global-desc");
    const globalBtn = document.getElementById("btn-admin-toggle-global-maint-action");

    if (globalCard) {
      globalCard.style.background = isGlobal ? "rgba(255, 75, 75, 0.12)" : "rgba(255, 255, 255, 0.04)";
      globalCard.style.borderColor = isGlobal ? "rgba(255, 75, 75, 0.45)" : "rgba(255, 255, 255, 0.14)";
    }
    if (globalIcon) {
      globalIcon.innerText = isGlobal ? "🔒" : "🌐";
      globalIcon.style.background = isGlobal ? "rgba(255, 75, 75, 0.2)" : "rgba(255, 255, 255, 0.08)";
    }
    if (globalStatusBadge) {
      globalStatusBadge.innerText = isGlobal ? "АКТИВЕН" : "ОТКЛЮЧЕН";
      globalStatusBadge.style.background = isGlobal ? "#ff4b4b" : "rgba(255,255,255,0.1)";
    }
    if (globalDesc) {
      globalDesc.innerText = isGlobal
        ? "Сайт полностью заблокирован и размыт для всех пользователей и гостей."
        : "Сайт работает в обычном режиме для всех посетителей.";
    }
    if (globalBtn) {
      globalBtn.innerText = isGlobal ? "✕ Отключить тех.перерыв" : "🔒 Закрыть весь сайт";
      globalBtn.style.setProperty("background", isGlobal ? "#ff4b4b" : "#ffffff", "important");
      globalBtn.style.setProperty("color", isGlobal ? "#ffffff" : "#000000", "important");
    }

    // Update section cards in the grid
    for (const [key, conf] of Object.entries(this.SECTION_CONFIG)) {
      const card = document.querySelector(`.admin-maint-sec-card[data-key="${key}"]`);
      if (!card) continue;

      const isLocked = Boolean(this.state.sections?.[key]);
      card.style.background = isLocked ? "rgba(255, 75, 75, 0.08)" : "rgba(255, 255, 255, 0.03)";
      card.style.borderColor = isLocked ? "rgba(255, 75, 75, 0.4)" : "rgba(255, 255, 255, 0.1)";

      const statusEl = card.querySelector(".admin-maint-sec-status");
      if (statusEl) {
        statusEl.innerText = isLocked ? "🔴 Закрыт на тех.перерыв" : "🟢 Открыт для всех";
        statusEl.style.color = isLocked ? "#ff6b6b" : "rgba(255,255,255,0.45)";
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
