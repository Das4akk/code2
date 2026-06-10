/**
 * COWIO Premium: доступ к каталогу, статус-эмодзи, привилегии, оплата
 */
class PremiumManager {
  static PRICE_RUB = 179;
  static PLAN_DAYS = 30;

  static STATUS_EMOJIS = {
    star: {
      label: "Звезда",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp",
    },
    sparkles: {
      label: "Искры",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp",
    },
    crown: {
      label: "Корона",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp",
    },
    gem: {
      label: "Алмаз",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gem%20Stone.webp",
    },
    rocket: {
      label: "Ракета",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/Rocket.webp",
    },
    fire: {
      label: "Огонь",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp",
    },
    butterfly: {
      label: "Бабочка",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Butterfly.webp",
    },
    rainbow: {
      label: "Радуга",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Rainbow.webp",
    },
    trophy: {
      label: "Кубок",
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Trophy.webp",
    },
  };

  static PREMIUM_DM_THEMES = ["vault-gold", "abyss-frost", "crimson-chalk", "noir-rose"];
  static BIO_LIMIT_DEFAULT = 200;
  static BIO_LIMIT_PREMIUM = 500;

  static PERKS = [
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Shopping%20Bags.webp", title: "Полный каталог", desc: "Рамки, звуки и акции только для Premium" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp", title: "Статус-эмодзи", desc: "10 эмодзи рядом с ником в чате и профиле" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Military%20Medal.webp", title: "10-й Уровень", desc: "Автоматическое повышение до 10 уровня при покупке" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkler.webp", title: "x2 XP", desc: "В два раза больше опыта за время в комнатах" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman%20Technologist.webp", title: "Приоритетная поддержка", desc: "Тикеты помечаются и обрабатываются быстрее" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Party%20Popper.webp", title: "Ранний доступ", desc: "Первыми видите горячие акции в каталоге" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Artist%20Palette.webp", title: "Эксклюзивные темы DM", desc: "4 премиальные темы оформления личных сообщений" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp", title: "Расширенное био", desc: "До 500 символов в описании профиля вместо 200" },
    { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp", title: "Premium-значок", desc: "Особый бейдж Premium в профиле и списках" },
  ];

  static init() {
    this.injectStyles();
    this.renderPremiumSection();
    this.checkReturnFromPayment();
    document.addEventListener("DOMContentLoaded", () => this.renderPremiumSection());
  }

  static injectStyles() {
    if (document.getElementById("cowio-premium-styles")) return;
    const style = document.createElement("style");
    style.id = "cowio-premium-styles";
    style.textContent = `
      .badge-premium {
        background: linear-gradient(135deg, rgba(255, 200, 80, 0.25), rgba(255, 140, 40, 0.2));
        color: #ffd56a;
        border: 1px solid rgba(255, 200, 90, 0.55);
        box-shadow: 0 4px 14px rgba(255, 170, 50, 0.22);
      }
      .premium-status-emoji {
        width: 1.05em;
        height: 1.05em;
        vertical-align: -0.15em;
        margin-right: 3px;
        display: inline-block;
        filter: drop-shadow(0 0 4px rgba(255, 200, 80, 0.45));
      }
      .nav-item.nav-locked {
        opacity: 0.72;
      }
      .nav-lock-badge {
        font-size: 10px;
        margin-left: 6px;
        opacity: 0.7;
      }
      .premium-hero {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        padding: 28px 26px;
        margin-bottom: 22px;
        border: 1px solid rgba(255, 200, 100, 0.22);
        background:
          radial-gradient(circle at 20% 0%, rgba(255, 180, 60, 0.18), transparent 45%),
          radial-gradient(circle at 90% 100%, rgba(255, 120, 40, 0.12), transparent 40%),
          linear-gradient(145deg, rgba(24, 20, 14, 0.96), rgba(10, 10, 12, 0.98));
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 220, 140, 0.08);
      }
      .premium-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(105deg, transparent 40%, rgba(255, 220, 140, 0.06) 50%, transparent 60%);
        animation: premiumHeroShine 5s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes premiumHeroShine {
        0%, 100% { transform: translateX(-30%); opacity: 0; }
        50% { transform: translateX(30%); opacity: 1; }
      }
      .premium-price-tag {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        font-size: 32px;
        font-weight: 900;
        color: #ffe6a0;
        letter-spacing: -0.5px;
      }
      .premium-price-tag small {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
      }
      .premium-perk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
        margin: 18px 0 22px;
      }
      .premium-perk-card {
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 200, 100, 0.12);
        background: rgba(255, 255, 255, 0.03);
      }
      .premium-emoji-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .premium-emoji-btn {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        border: 1px solid var(--border-light);
        background: rgba(255,255,255,0.04);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.15s, transform 0.15s;
      }
      .premium-emoji-btn.active {
        border-color: rgba(255, 200, 90, 0.8);
        box-shadow: 0 0 12px rgba(255, 180, 60, 0.25);
        transform: scale(1.05);
      }
      .premium-emoji-btn img { width: 24px; height: 24px; }
      .catalog-lock-screen {
        text-align: center;
        padding: 48px 24px;
        border-radius: 20px;
        border: 1px dashed rgba(255, 200, 90, 0.35);
        background: rgba(255, 200, 80, 0.04);
      }
      .catalog-card-wrapper.is-hot {
        background: linear-gradient(135deg, #2a2218 0%, #c9a227 22%, #fff0c8 50%, #c9a227 78%, #2a2218 100%);
        background-size: 220% 220%;
        animation: catalogFadeIn 0.45s ease forwards, premiumHotShimmer 7s ease-in-out infinite;
        padding: 2px;
        box-shadow: 0 16px 44px rgba(255, 170, 60, 0.32), 0 0 0 1px rgba(255, 220, 140, 0.18) inset;
      }
      .catalog-card-wrapper.is-hot .catalog-card-inner {
        background: linear-gradient(180deg, rgba(28, 24, 18, 0.97) 0%, rgba(10, 10, 12, 0.99) 100%);
        border: 1px solid rgba(255, 200, 100, 0.14);
      }
      .catalog-card-wrapper.is-hot:hover {
        box-shadow: 0 20px 50px rgba(255, 170, 60, 0.5), 0 0 0 1px rgba(255, 220, 140, 0.25) inset;
      }
      .catalog-hot-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 6;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.9px;
        text-transform: uppercase;
        color: #fff8e7;
        background: linear-gradient(135deg, rgba(180, 90, 20, 0.95), rgba(255, 170, 50, 0.9));
        box-shadow: 0 4px 16px rgba(255, 140, 40, 0.35);
        border: 1px solid rgba(255, 230, 160, 0.35);
      }
      .catalog-hot-badge img { width: 14px; height: 14px; }
      @keyframes premiumHotShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
    `;
    document.head.appendChild(style);
  }

  static normalizePremium(profile) {
    const p = profile?.premium;
    if (!p) return null;
    const expiresAt = Number(p.expiresAt) || 0;
    const active = Boolean(p.active && expiresAt > Date.now());
    return { ...p, expiresAt, active };
  }

  static isStaff(profile, uid) {
    if (!window.AdminPanel) return false;
    return (
      AdminPanel.isCreatorProfile(profile, uid) ||
      AdminPanel.isModeratorProfile(profile, uid) ||
      AdminPanel.isAdminProfile(profile, uid)
    );
  }

  static isPremiumActive(profile, uid) {
    if (this.isStaff(profile, uid)) return true;
    const prem = this.normalizePremium(profile);
    return Boolean(prem?.active);
  }

  static hasCatalogAccess(profile, uid) {
    if (!uid) return false;
    if (window.AdminPanel) {
      if (AdminPanel.isCreatorProfile(profile || {}, uid)) return true;
      if (AdminPanel.isModeratorProfile(profile || {}, uid)) return true;
    }
    const prem = this.normalizePremium(profile);
    return Boolean(prem?.active);
  }

  static hasPaidPremium(profile, uid) {
    const prem = this.normalizePremium(profile);
    return Boolean(prem?.active);
  }

  static getBioLimit(profile, uid) {
    return this.isPremiumActive(profile, uid)
      ? this.BIO_LIMIT_PREMIUM
      : this.BIO_LIMIT_DEFAULT;
  }

  static canUseTheme(themeKey, profile, uid) {
    if (themeKey === "default") return true;
    return this.isPremiumActive(profile, uid);
  }

  static getXpMultiplier(profile, uid) {
    if (this.isPremiumActive(profile, uid)) return 2;
    return 1;
  }

  static getStatusEmojiHtml(profile, uid) {
    if (!this.isPremiumActive(profile, uid)) return "";
    const key = profile?.premium?.statusEmoji || "star";
    const preset = this.STATUS_EMOJIS[key] || this.STATUS_EMOJIS.star;
    return `<img class="premium-status-emoji" src="${preset.url}" alt="" title="Premium">`;
  }

  static getChatNameClass() {
    return "";
  }

  static formatExpiry(profile) {
    const prem = this.normalizePremium(profile);
    if (!prem?.active) return "Не активен";
    return new Date(prem.expiresAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  static syncFromProfile(profile, uid) {
    document.body.classList.remove("user-is-premium");
    this.syncNav(profile, uid);
    this.renderPremiumSection(profile, uid);
  }

  static syncNav(profile, uid) {
    const catalogNav = document.getElementById("nav-catalog");
    const hasAccess = this.hasCatalogAccess(profile, uid);
    if (catalogNav) {
      catalogNav.classList.toggle("nav-locked", !hasAccess);
      let lock = catalogNav.querySelector(".nav-lock-badge");
      if (!hasAccess) {
        if (!lock) {
          lock = document.createElement("span");
          lock.className = "nav-lock-badge";
          lock.textContent = "🔒";
          catalogNav.querySelector("span")?.appendChild(lock);
        }
      } else if (lock) {
        lock.remove();
      }
    }
    const premNav = document.getElementById("nav-premium");
    if (premNav) {
      const active = this.isPremiumActive(profile, uid) && !this.isStaff(profile, uid);
      premNav.classList.toggle("premium-active-nav", active);
    }
  }

  static renderPremiumSection(profile, uid) {
    const container = document.getElementById("premium-dynamic-content");
    if (!container) return;

    const p =
      profile ||
      (window.AppState?.currentUser
        ? AppState.usersCache.get(AppState.currentUser.uid)
        : null);
    const userId = uid || AppState?.currentUser?.uid;
    const active = this.isPremiumActive(p, userId);
    const staff = this.isStaff(p, userId);

    const perksHtml = this.PERKS.map(
      (perk) => `
      <div class="premium-perk-card">
        <img src="${perk.url}" style="width:22px;height:22px;margin-bottom:8px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:4px;">${perk.title}</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.45;">${perk.desc}</div>
      </div>`,
    ).join("");

    const emojiPicker = active
      ? `<div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--border-light);">
          <div style="font-weight:800;margin-bottom:6px;">Статус-эмодзи</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Выберите эмодзи, которое будет рядом с вашим именем</div>
          <div class="premium-emoji-picker" id="premium-emoji-picker">
            ${Object.entries(this.STATUS_EMOJIS)
              .map(
                ([key, val]) => `
              <button type="button" class="premium-emoji-btn ${p?.premium?.statusEmoji === key || (!p?.premium?.statusEmoji && key === "star") ? "active" : ""}" data-emoji="${key}" title="${val.label}">
                <img src="${val.url}" alt="">
              </button>`,
              )
              .join("")}
          </div>
        </div>`
      : "";

    container.innerHTML = `
      <div class="premium-hero">
        <div style="position:relative;z-index:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:32px;height:32px;">
              <div>
                <div style="font-size:22px;font-weight:900;letter-spacing:0.3px;">COWIO Premium</div>
                <div style="font-size:13px;color:var(--text-muted);">Месяц привилегий за ${this.PRICE_RUB} ₽</div>
              </div>
            </div>
          </div>
          <div style="margin-bottom:14px;display:flex;align-items:center;gap:6px;font-size:13px;color:#ffb347;background:rgba(255,179,71,0.1);padding:6px 12px;border-radius:12px;width:fit-content;">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:16px;height:16px;">
            Уже владеют: <b id="premium-users-counter">загрузка...</b>
          </div>
          ${
            staff
              ? `<div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.05);font-size:13px;color:var(--text-muted);margin-bottom:12px;">У вас доступ персонала: каталог и все Premium-функции уже открыты.</div>`
              : active
                ? `<div style="font-size:14px;color:#ffe6a0;margin-bottom:8px;">✓ Premium активен до ${this.formatExpiry(p)}</div>`
                : `<div class="premium-price-tag">${this.PRICE_RUB} ₽ <small>/ ${this.PLAN_DAYS} дней</small></div>`
          }
          <div class="premium-perk-grid">${perksHtml}</div>
          ${
            !staff && !active
              ? `<button class="primary-btn" id="btn-buy-premium" style="width:100%;max-width:320px;padding:14px;font-size:15px;border-radius:14px;background:linear-gradient(135deg,#ffe6a0,#ffb347);color:#1a1208;border:none;font-weight:800;">
                  Оформить Premium
                </button>
                <div style="font-size:11px;color:var(--text-muted);margin-top:10px;max-width:420px;line-height:1.5;">
                  Оплата через LAVA. После успешной оплаты Premium активируется автоматически.
                </div>`
              : !staff && active
                ? `<button class="secondary-btn" id="btn-extend-premium" style="width:auto;padding:10px 18px;">Продлить ещё на месяц (${this.PRICE_RUB} ₽)</button>`
                : ""
          }
          ${emojiPicker}
        </div>
      </div>
    `;

    container.querySelector("#btn-buy-premium")?.addEventListener("click", () => this.startPurchase());
    container.querySelector("#btn-extend-premium")?.addEventListener("click", () => this.startPurchase());
    container.querySelectorAll(".premium-emoji-btn").forEach((btn) => {
      btn.onclick = () => this.saveStatusEmoji(btn.dataset.emoji);
    });

    const counterSpan = container.querySelector("#premium-users-counter");
    if (counterSpan) {
      this.getPremiumUsersCount().then((count) => {
        counterSpan.innerText = count;
      });
    }
    this.updateThemeButtons();
  }

  static async getPremiumUsersCount() {
    if (!window.db) return 0;
    try {
      let count = 0;
      AppState.usersCache.forEach((u, uid) => {
        if (this.isPremiumActive(u, uid) || this.isStaff(u, uid)) count++;
      });
      return count;
    } catch(e) {
      return "~";
    }
  }

  static async saveStatusEmoji(key) {
    const uid = AppState?.currentUser?.uid;
    if (!uid) return;
    const profile = AppState.usersCache.get(uid);
    if (!this.isPremiumActive(profile, uid)) {
      return Utils.toast("Статус-эмодзи доступны только Premium", "error");
    }
    if (!window.db || !window.firebaseRef || !window.firebaseUpdate) {
      return Utils.toast("Подождите, сайт ещё загружается", "info");
    }
    await window.firebaseSet(
      window.firebaseRef(window.db, `users/${uid}/profile/premium/statusEmoji`),
      key,
    );
    document.querySelectorAll(".premium-emoji-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.emoji === key);
    });
    if (profile?.premium) profile.premium.statusEmoji = key;
    AppState.usersCache.set(uid, profile);
    Utils.toast("Статус-эмодзи обновлён", "success");
  }

  static updateThemeButtons() {
    setTimeout(() => {
      const uid = window.AppState?.currentUser?.uid;
      if (!uid) return;
      const profile = window.AppState?.usersCache?.get(uid) || window.AppState?.myProfile;
      const isAdmin = this.isStaff(profile, uid);
      const isPremium = profile ? (this.isPremiumActive(profile, uid) || isAdmin) : false;
      
      ['btn-room-theme-toggle', 'btn-dm-theme-toggle'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isPremium) {
           btn.classList.remove("premium-locked-theme");
           btn.innerHTML = "Поменять тему";
           btn.style.opacity = "1";
        } else {
           btn.classList.add("premium-locked-theme");
           btn.innerHTML = '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;"><span style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><span style="filter:blur(3px);opacity:0.3;position:absolute;">Поменять тему</span><span style="font-size:11px;font-weight:700;white-space:nowrap;color:#ffe6a0;position:relative;z-index:1;">Приобретите Premium</span></span>';
           btn.style.opacity = "0.9";
        }
      });
    }, 1500);
  }

  static async startPurchase() {
    const user = AppState?.currentUser;
    if (!user) return Utils.toast("Войдите в аккаунт", "error");

    const profile = AppState.usersCache.get(user.uid) || {};
    const btn = document.getElementById("btn-buy-premium") || document.getElementById("btn-extend-premium");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Переход к оплате...";
    }

    try {
      const res = await fetch("/api/premium/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: profile.email || user.email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать платёж");
      }

      if (data.sandbox && data.activated) {
        Utils.toast("Premium активирован (sandbox)", "success");
        await this.refreshStatus(user.uid);
        return;
      }

      if (data.confirmationUrl) {
        sessionStorage.setItem("cowio_pending_payment", data.paymentId || "");
        window.location.href = data.confirmationUrl;
        return;
      }

      throw new Error("Не получена ссылка на оплату");
    } catch (e) {
      Utils.toast(e.message || "Ошибка оплаты", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.id === "btn-extend-premium"
          ? `Продлить ещё на месяц (${this.PRICE_RUB} ₽)`
          : "Оформить Premium";
      }
    }
  }

  static async refreshStatus(uid) {
    const paymentId = sessionStorage.getItem("cowio_pending_payment") || "";
    const q = new URLSearchParams({ uid });
    if (paymentId) q.set("paymentId", paymentId);
    const res = await fetch(`/api/premium/status?${q}`);
    const data = await res.json();
    if (data.active) {
      sessionStorage.removeItem("cowio_pending_payment");
      Utils.toast("Premium успешно активирован!", "success");
      if (window.CatalogManager) CatalogManager.renderCatalog();
    }
    this.renderPremiumSection();
    return data;
  }

  static checkReturnFromPayment() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("premium_return")) return;
    sessionStorage.setItem(
      "cowio_premium_return_uid",
      params.get("uid") || AppState?.currentUser?.uid || "",
    );
    window.history.replaceState({}, "", window.location.pathname);
    if (AppState?.currentUser) this.handlePostLoginReturn();
  }

  static handlePostLoginReturn() {
    const uid =
      sessionStorage.getItem("cowio_premium_return_uid") ||
      AppState?.currentUser?.uid;
    if (!uid || !AppState?.currentUser) return;
    sessionStorage.removeItem("cowio_premium_return_uid");

    if (window.Utils?.showScreen) Utils.showScreen("lobby-screen");
    setTimeout(async () => {
      document.getElementById("nav-premium")?.click();
      await this.refreshStatus(uid);
    }, 800);
  }

  static renderCatalogLock() {
    return `
      <div class="catalog-lock-screen">
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:48px;height:48px;margin-bottom:14px;opacity:0.9;">
        <h3 style="margin:0 0 10px;font-size:20px;">Каталог только для Premium</h3>
        <p style="margin:0 0 20px;font-size:14px;color:var(--text-muted);max-width:420px;margin-left:auto;margin-right:auto;line-height:1.55;">
          Рамки, звуки и горячие акции доступны подписчикам COWIO Premium.
          Модераторы и создатель заходят без ограничений.
        </p>
        <button class="primary-btn" id="catalog-unlock-premium-btn" style="width:auto;padding:12px 24px;border-radius:12px;background:linear-gradient(135deg,#ffe6a0,#ffb347);color:#1a1208;border:none;font-weight:800;">
          Premium за ${this.PRICE_RUB} ₽ / месяц
        </button>
      </div>`;
  }

  static openCatalogOrUpsell(navigate = true) {
    const uid = AppState?.currentUser?.uid;
    const profile = uid ? AppState.usersCache.get(uid) : null;
    if (this.hasCatalogAccess(profile, uid)) {
      if (navigate && window.FriendsManager?.setNavActive) {
        FriendsManager.setNavActive("nav-catalog");
        if (window.CatalogManager) CatalogManager.renderCatalog();
      }
      return true;
    }
    if (navigate && window.FriendsManager?.setNavActive) {
      FriendsManager.setNavActive("nav-premium");
      this.renderPremiumSection(profile, uid);
    }
    if (window.Utils?.toast) Utils.toast("Оформите Premium для доступа к каталогу", "info");
    return false;
  }
}

window.PremiumManager = PremiumManager;
