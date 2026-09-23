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

  static PREMIUM_DM_THEMES = [
    "vault-gold",
    "abyss-frost",
    "crimson-chalk",
    "noir-rose",
  ];
  static BIO_LIMIT_DEFAULT = 200;
  static BIO_LIMIT_PREMIUM = 500;

  static PERKS = [
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp",
      title: "Статус-эмодзи",
      desc: "Выбор из 9 анимированных эмодзи рядом с ником в комнатах, чатах и профиле",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkler.webp",
      title: "Удвоенный опыт (x2 XP)",
      desc: "В 2 раза больше опыта за время в комнатах и ускоренное повышение уровней",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Artist%20Palette.webp",
      title: "Темы оформления",
      desc: "Доступ ко всем кастомным темам: Neon Cyber, Gold Luxury, Emerald Matrix и др.",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp",
      title: "Золотая подсветка",
      desc: "Эксклюзивное свечение вашей карточки в списках комнат и у друзей",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp",
      title: "Био до 500 символов",
      desc: "Увеличенный объём описания профиля (до 500 знаков вместо стандартных 200)",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Speech%20Balloon.webp",
      title: "Темы для диалогов",
      desc: "4 эксклюзивные темы оформления личных чатов: Vault Gold, Abyss Frost и др.",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman%20Technologist.webp",
      title: "Приоритетная поддержка",
      desc: "Тикеты и обращения автоматически получают высший приоритет в обработке",
    },
    {
      url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp",
      title: "Значок Premium",
      desc: "Уникальный золотой знак отличия в профиле, чате и глобальном поиске",
    },
  ];

  static init() {
    this.injectStyles();
    this.renderPremiumSection();
    this.checkReturnFromPayment();
    document.addEventListener("DOMContentLoaded", () =>
      this.renderPremiumSection(),
    );
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
      .catalog-lock-screen {
        text-align: center;
        padding: 48px 24px;
        border-radius: 20px;
        border: 1px dashed rgba(255, 200, 90, 0.35);
        background: rgba(255, 200, 80, 0.04);
      }
      .catalog-card-wrapper.is-hot {
        background: linear-gradient(135deg, #2a2218 0%, #aa8222 22%, #d4af37 50%, #aa8222 78%, #2a2218 100%);
        background-size: 220% 220%;
        animation: catalogFadeIn 0.45s ease forwards, premiumHotShimmer 7s ease-in-out infinite;
        padding: 2px;
        box-shadow: 0 16px 44px rgba(210, 140, 40, 0.25), 0 0 0 1px rgba(210, 180, 100, 0.12) inset;
      }
      .catalog-card-wrapper.is-hot .catalog-card-inner {
        background: linear-gradient(180deg, rgba(28, 24, 18, 0.97) 0%, rgba(10, 10, 12, 0.99) 100%);
        border: 1px solid rgba(210, 180, 100, 0.12);
      }
      .catalog-card-wrapper.is-hot:hover {
        box-shadow: 0 20px 50px rgba(210, 140, 40, 0.4), 0 0 0 1px rgba(210, 180, 100, 0.2) inset;
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
        background: linear-gradient(135deg, rgba(140, 70, 15, 0.95), rgba(210, 140, 30, 0.9));
        box-shadow: 0 4px 16px rgba(210, 120, 30, 0.25);
        border: 1px solid rgba(210, 180, 120, 0.25);
      }
      .catalog-hot-badge img { width: 14px; height: 14px; }
      @keyframes premiumHotShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      /* Hide system scrollbar completely on premium section */
      #section-premium {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      #section-premium::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      /* ==================== PREMIUM REDESIGN STYLES ==================== */
      .prem-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
      .prem-hero-card {
        position: relative;
        overflow: hidden;
        border-radius: 26px;
        padding: 34px 38px;
        width: 100%;
        box-sizing: border-box;
        background: radial-gradient(circle at 10% 10%, rgba(255, 215, 120, 0.14), transparent 45%),
                    radial-gradient(circle at 90% 90%, rgba(230, 170, 60, 0.08), transparent 50%),
                    linear-gradient(150deg, rgba(22, 22, 28, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%);
        border: 1px solid rgba(255, 215, 120, 0.24);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
      }
      .prem-hero-shimmer {
        position: absolute;
        top: 0; left: -100%; width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
        transform: skewX(-25deg);
        animation: premShimmer 8s infinite ease-in-out;
        pointer-events: none;
      }
      @keyframes premShimmer {
        0%, 80% { left: -100%; }
        100% { left: 200%; }
      }
      .prem-hero-layout {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 36px;
        align-items: center;
      }
      @media (max-width: 880px) {
        .prem-hero-layout {
          grid-template-columns: 1fr;
          gap: 24px;
        }
        .prem-hero-card {
          padding: 24px 20px;
        }
      }
      .prem-pill-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: #f7d788;
        background: rgba(247, 215, 136, 0.12);
        border: 1px solid rgba(247, 215, 136, 0.28);
        padding: 5px 12px;
        border-radius: 999px;
        margin-bottom: 12px;
        box-shadow: 0 0 16px rgba(247, 215, 136, 0.15);
      }
      .prem-hero-h1 {
        font-size: 32px;
        line-height: 1.18;
        font-weight: 900;
        letter-spacing: -0.03em;
        color: #ffffff;
        margin: 0 0 12px;
      }
      .prem-gold-text {
        background: linear-gradient(135deg, #ffffff 0%, #fadb73 50%, #f39c12 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .prem-hero-desc {
        font-size: 14.5px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.65);
        margin: 0 0 18px;
        max-width: 560px;
      }
      .prem-stat-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .prem-counter-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 6px 13px;
        border-radius: 12px;
      }
      .prem-counter-chip b {
        color: #f7d788;
        font-weight: 800;
      }
      .prem-pricing-box {
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 215, 120, 0.25);
        border-radius: 22px;
        padding: 24px;
        text-align: center;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100%;
      }
      .prem-pricing-box.staff-box {
        border-color: rgba(112, 161, 255, 0.35);
        background: radial-gradient(circle at 50% 0%, rgba(112, 161, 255, 0.12), transparent 70%), rgba(10, 14, 24, 0.65);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 0 24px rgba(112, 161, 255, 0.1);
      }
      .prem-price-large {
        font-size: 38px;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -0.04em;
        line-height: 1;
        margin-bottom: 4px;
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 4px;
      }
      .prem-price-period {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
      }
      .prem-daily-equiv {
        font-size: 12px;
        color: #f7d788;
        font-weight: 700;
        margin-bottom: 18px;
      }
      @keyframes goldGlowPulse {
        0%, 100% {
          box-shadow: 0 8px 28px rgba(255, 195, 60, 0.38), 0 0 16px rgba(255, 215, 0, 0.2);
          transform: translateY(0);
        }
        50% {
          box-shadow: 0 14px 40px rgba(255, 195, 60, 0.65), 0 0 28px rgba(255, 215, 0, 0.4);
          transform: translateY(-2px);
        }
      }
      @keyframes premPulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.35); opacity: 0; }
        100% { transform: scale(0.95); opacity: 0; }
      }
      @keyframes premShimmerMove {
        0% { left: -80%; }
        25% { left: 150%; }
        100% { left: 150%; }
      }

      .prem-cta-btn {
        width: 100%;
        padding: 13px 20px;
        border-radius: 14px;
        font-size: 14.5px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.22s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: none;
      }
      .prem-cta-btn.buy {
        background: linear-gradient(135deg, #ffe082 0%, #ffc107 45%, #ff9800 100%);
        color: #120e06;
        padding: 15px 22px;
        border-radius: 16px;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.2px;
        box-shadow: 0 8px 30px rgba(255, 190, 40, 0.45);
        animation: goldGlowPulse 3s infinite ease-in-out;
        position: relative;
        overflow: hidden;
      }
      .prem-cta-btn.buy::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -80%;
        width: 45%;
        height: 200%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
        transform: rotate(28deg);
        animation: premShimmerMove 3.6s infinite ease-in-out;
        pointer-events: none;
      }
      .prem-cta-btn.buy:hover:not(:disabled) {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 16px 42px rgba(255, 190, 40, 0.7);
        filter: brightness(1.06);
      }
      .prem-cta-btn.extend {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }
      .prem-cta-btn.extend:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
        transform: translateY(-1px);
      }
      .prem-secure-note {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 10px;
        line-height: 1.4;
      }

      /* Bento Grid Section */
      .prem-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .prem-section-title h2 {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #ffffff;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .prem-section-subtitle {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.45);
        background: rgba(255, 255, 255, 0.06);
        padding: 4px 10px;
        border-radius: 999px;
      }
      .prem-bento-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        width: 100%;
        box-sizing: border-box;
      }
      @media (max-width: 1240px) {
        .prem-bento-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 860px) {
        .prem-bento-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 540px) {
        .prem-bento-grid {
          grid-template-columns: 1fr;
        }
      }
      .prem-perk-card {
        position: relative;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 20px;
        transition: all 0.25s ease;
        overflow: hidden;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      .prem-perk-card:hover {
        background: rgba(255, 255, 255, 0.055);
        border-color: rgba(255, 215, 120, 0.28);
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
      }
      .prem-perk-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 13px;
        background: rgba(255, 215, 120, 0.08);
        border: 1px solid rgba(255, 215, 120, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
      }
      .prem-perk-icon-wrap img {
        width: 24px;
        height: 24px;
        object-fit: contain;
      }
      .prem-perk-title {
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        margin-bottom: 6px;
        letter-spacing: -0.01em;
      }
      .prem-perk-desc {
        font-size: 12.5px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.55);
      }

      /* Studio / Status Emoji Card */
      .prem-studio-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 20px;
        padding: 24px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      .prem-studio-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 10px;
      }
      .prem-emoji-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .premium-emoji-btn {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.18s ease;
      }
      .premium-emoji-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 215, 120, 0.4);
        transform: translateY(-2px);
      }
      .premium-emoji-btn.active {
        border-color: #f7d788 !important;
        background: rgba(247, 215, 136, 0.16) !important;
        box-shadow: 0 0 16px rgba(247, 215, 136, 0.3);
        transform: scale(1.06);
      }
      .premium-emoji-btn img {
        width: 28px;
        height: 28px;
      }

      /* Trust & Guarantee Banner */
      .prem-trust-banner {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px 22px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px dashed rgba(255, 255, 255, 0.12);
        border-radius: 18px;
      }
      .prem-trust-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f7d788;
        flex-shrink: 0;
      }
      .prem-trust-text h4 {
        margin: 0 0 3px;
        font-size: 13.5px;
        font-weight: 700;
        color: #ffffff;
      }
      .prem-trust-text p {
        margin: 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.5;
      }

      /* Light Theme Adaptations */
      html.theme-light-global .prem-hero-card {
        background: radial-gradient(circle at 10% 10%, rgba(255, 215, 120, 0.22), transparent 45%),
                    linear-gradient(150deg, #ffffff 0%, #f6f8fb 100%);
        border: 1px solid rgba(220, 180, 80, 0.35);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
      }
      html.theme-light-global .prem-hero-h1 {
        color: #111827;
      }
      html.theme-light-global .prem-gold-text {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      html.theme-light-global .prem-hero-desc {
        color: #4b5563;
      }
      html.theme-light-global .prem-counter-chip {
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: #374151;
      }
      html.theme-light-global .prem-counter-chip b {
        color: #b45309;
      }
      html.theme-light-global .prem-pricing-box {
        background: #ffffff;
        border: 1px solid rgba(220, 180, 80, 0.4);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
      }
      html.theme-light-global .prem-price-large {
        color: #111827;
      }
      html.theme-light-global .prem-price-period {
        color: #6b7280;
      }
      html.theme-light-global .prem-secure-note {
        color: #9ca3af;
      }
      html.theme-light-global .prem-perk-card {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      }
      html.theme-light-global .prem-perk-card:hover {
        background: #fafbfc;
        border-color: rgba(220, 180, 80, 0.4);
      }
      html.theme-light-global .prem-perk-title {
        color: #111827;
      }
      html.theme-light-global .prem-perk-desc {
        color: #6b7280;
      }
      html.theme-light-global .prem-studio-card {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      html.theme-light-global .prem-studio-header > div > div:first-child {
        color: #111827 !important;
      }
      html.theme-light-global .prem-studio-header > div > div:last-child {
        color: #6b7280 !important;
      }
      html.theme-light-global .premium-emoji-btn {
        background: #f3f4f6;
        border-color: #e5e7eb;
      }
      html.theme-light-global .prem-trust-banner {
        background: #ffffff;
        border-color: #e5e7eb;
      }
      html.theme-light-global .prem-trust-text h4 {
        color: #111827;
      }
      html.theme-light-global .prem-trust-text p {
        color: #6b7280;
      }
      html.theme-light-global .prem-section-title h2 {
        color: #111827;
      }
    `;
    document.head.appendChild(style);
  }

  static normalizePremium(profile) {
    const p = profile?.premium;
    if (!p) return null;
    const expiresAt = Number(p.expiresAt) || 0;
    const active = Boolean(
      p.active && (!p.expiresAt || expiresAt > Date.now()),
    );
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

  static getUserLevel(profile) {
    if (!profile) return 0;
    const totalXp = Number(profile.xp) || 0;
    return Math.floor(Math.sqrt(totalXp / 240));
  }

  static hasCatalogAccess(profile, uid) {
    if (!uid) return false;
    // Экономика Люменов: Каталог доступен всем зарегистрированным пользователям
    return true;
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
      const active =
        this.isPremiumActive(profile, uid) && !this.isStaff(profile, uid);
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
    const selectedEmoji = p?.premium?.statusEmoji || "star";

    const perksHtml = this.PERKS.map(
      (perk) => `
      <div class="prem-perk-card">
        <div class="prem-perk-icon-wrap">
          <img src="${perk.url}" alt="${perk.title}">
        </div>
        <div class="prem-perk-title">${perk.title}</div>
        <div class="prem-perk-desc">${perk.desc}</div>
      </div>`,
    ).join("");

    const pricingBoxHtml = staff
      ? `<div class="prem-pricing-box staff-box">
          <div style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#70a1ff;background:rgba(112,161,255,0.12);border:1px solid rgba(112,161,255,0.25);padding:4px 12px;border-radius:20px;margin-bottom:12px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#70a1ff;box-shadow:0 0 8px #70a1ff;"></span>
            Команда COWIO
          </div>
          <div style="font-size:17px;font-weight:800;color:#ffffff;margin-bottom:6px;letter-spacing:-0.01em;">Полный доступ активен</div>
          <div style="font-size:12.5px;color:rgba(255,255,255,0.6);line-height:1.5;max-width:240px;margin-bottom:14px;">
            Для вашего аккаунта все функции подписки COWIO Premium включены бессрочно.
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#f7d788;background:rgba(247,215,136,0.1);border:1px solid rgba(247,215,136,0.2);padding:6px 14px;border-radius:10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Без ограничений
          </div>
        </div>`
      : active
        ? `<div class="prem-pricing-box">
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#2ed573;background:rgba(46,213,115,0.12);border:1px solid rgba(46,213,115,0.25);padding:4px 12px;border-radius:20px;margin-bottom:12px;">
              <span style="width:6px;height:6px;border-radius:50%;background:#2ed573;box-shadow:0 0 6px #2ed573;"></span>
              Подписка активна
            </div>
            <div style="font-size:12.5px;color:rgba(255,255,255,0.6);margin-bottom:4px;">Действует до:</div>
            <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:16px;">${this.formatExpiry(p)}</div>
            <button class="prem-cta-btn extend" id="btn-extend-premium" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp" style="width:20px;height:20px;object-fit:contain;" alt="Crown">
              <span>Продлить подписку (${this.PRICE_RUB} ₽)</span>
            </button>
          </div>`
        : `<div class="prem-pricing-box">
            <div class="prem-price-large">
              ${this.PRICE_RUB} ₽
              <span class="prem-price-period">/ ${this.PLAN_DAYS} дней</span>
            </div>
            <div class="prem-daily-equiv">~${(this.PRICE_RUB / this.PLAN_DAYS).toFixed(1)} ₽ в день</div>
            <button class="prem-cta-btn buy" id="btn-buy-premium">
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp" style="width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));" alt="Crown">
              <span style="font-weight:800;letter-spacing:0.2px;">Приобрести Premium</span>
              <span style="background:rgba(0,0,0,0.2);padding:3px 9px;border-radius:10px;font-size:12px;font-weight:800;margin-left:auto;">179 ₽</span>
            </button>
            <div class="prem-secure-note">
              Защищённая оплата через Platega<br>Мгновенная активация
            </div>
          </div>`;

    container.innerHTML = `
      <div class="prem-container">
        <!-- Main Hero Card -->
        <div class="prem-hero-card">
          <div class="prem-hero-shimmer"></div>
          <div class="prem-hero-layout">
            <div>
              <div class="prem-pill-badge">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:14px;height:14px;object-fit:contain;" alt="★">
                COWIO PREMIUM
              </div>
              <h1 class="prem-hero-h1">
                Подписка <span class="prem-gold-text">COWIO Premium</span>
              </h1>
              <p class="prem-hero-desc">
                Единая подписка открывает эксклюзивные темы оформления, удвоенный опыт за общение, персональные статус-эмодзи и расширенные возможности профиля.
              </p>
              <div class="prem-stat-row">
                <div class="prem-counter-chip">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Подписчиков: <b id="premium-users-counter">загрузка...</b>
                </div>
                <div class="prem-counter-chip">
                  <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:15px;height:15px;object-fit:contain;" alt="✨">
                  <span>8 преимуществ включено</span>
                </div>
              </div>
            </div>

            ${pricingBoxHtml}
          </div>
        </div>

        <!-- Status Emoji Studio -->
        <div class="prem-studio-card">
          <div class="prem-studio-header">
            <div>
              <div style="font-size:16px;font-weight:800;color:#ffffff;display:flex;align-items:center;gap:8px;">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:20px;height:20px;">
                Статус-эмодзи
              </div>
              <div style="font-size:12.5px;color:rgba(255,255,255,0.5);margin-top:2px;">
                Выберите иконку, которая будет отображаться рядом с вашим именем в комнатах и профиле
              </div>
            </div>
            ${active || staff
              ? `<span style="font-size:11px;font-weight:700;color:#f7d788;background:rgba(247,215,136,0.12);padding:4px 10px;border-radius:8px;border:1px solid rgba(247,215,136,0.25);">Доступно</span>`
              : `<span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);padding:4px 10px;border-radius:8px;">Доступно с Premium</span>`
            }
          </div>
          <div class="prem-emoji-grid" id="premium-emoji-picker">
            ${Object.entries(this.STATUS_EMOJIS)
              .map(
                ([key, val]) => `
              <button type="button" class="premium-emoji-btn ${selectedEmoji === key ? "active" : ""}" data-emoji="${key}" title="${val.label}">
                <img src="${val.url}" alt="${val.label}">
              </button>`,
              )
              .join("")}
          </div>
        </div>

        <!-- Bento Grid Perks Section -->
        <div>
          <div class="prem-section-title">
            <h2>
              <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width:22px;height:22px;">
              Преимущества подписки
            </h2>
            <span class="prem-section-subtitle">8 возможностей</span>
          </div>
          <div class="prem-bento-grid">
            ${perksHtml}
          </div>
        </div>

        <!-- Trust & Security Banner -->
        <div class="prem-trust-banner">
          <div class="prem-trust-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="prem-trust-text">
            <h4>Безопасная оплата и моментальная активация</h4>
            <p>Все транзакции проходят через платёжный шлюз Platega. Ваша подписка, статус и возможности активируются сразу после подтверждения платежа без задержек.</p>
          </div>
        </div>
      </div>
    `;

    container
      .querySelector("#btn-buy-premium")
      ?.addEventListener("click", () => this.startPurchase());
    container
      .querySelector("#btn-extend-premium")
      ?.addEventListener("click", () => this.startPurchase());
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
    } catch (e) {
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
      const profile =
        window.AppState?.usersCache?.get(uid) || window.AppState?.myProfile;
      const isAdmin = this.isStaff(profile, uid);
      const isPremium = profile
        ? this.isPremiumActive(profile, uid) || isAdmin
        : false;

      ["btn-room-theme-toggle", "btn-dm-theme-toggle"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isPremium) {
          btn.classList.remove("premium-locked-theme");
          btn.innerHTML = "Поменять тему";
          btn.style.opacity = "1";
        } else {
          btn.classList.add("premium-locked-theme");
          btn.innerHTML =
            '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;"><span style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><span style="filter:blur(3px);opacity:0.3;position:absolute;">Поменять тему</span><span style="font-size:11px;font-weight:700;white-space:nowrap;color:#ffe6a0;position:relative;z-index:1;">Приобретите Premium</span></span>';
          btn.style.opacity = "0.9";
        }
      });
    }, 1500);
  }

  static async activatePremiumDirectly(user, amount = this.PRICE_RUB, customDays = 0) {
    try {
      const now = Date.now();
      const planDays = customDays || (amount >= 800 ? 180 : amount >= 400 ? 90 : 30);
      const expiresAt = now + planDays * 24 * 60 * 60 * 1000;
      const planKey = planDays >= 180 ? "premium_6months" : planDays >= 90 ? "premium_3months" : "premium_month";
      const premiumData = {
        active: true,
        plan: planKey,
        activatedAt: now,
        expiresAt: expiresAt,
        amount: Number(amount) || this.PRICE_RUB,
        paymentId: `prem_${Date.now()}`
      };

      const db = AppState?.db;
      if (db && user?.uid) {
        try {
          const { ref, set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
          await set(ref(db, `users/${user.uid}/profile/premium`), premiumData);
        } catch (dbErr) {
          console.warn("[Premium] DB direct write note:", dbErr);
        }
      }

      // Update in-memory user cache immediately
      const cached = AppState.usersCache.get(user.uid) || {};
      cached.premium = premiumData;
      AppState.usersCache.set(user.uid, cached);

      Utils.toast(`Premium успешно активирован на ${planDays} дней!`, "success");
      this.renderPremiumSection();
      if (window.CatalogManager) CatalogManager.renderCatalog();
      if (window.ProfileManager) {
        if (typeof ProfileManager.renderProfile === "function") ProfileManager.renderProfile();
      }
      return true;
    } catch (err) {
      console.error("[Premium] direct activation error:", err);
      return false;
    }
  }

  static async startPurchase() {
    const user = AppState?.currentUser;
    if (!user) return Utils.toast("Войдите в аккаунт", "error");

    const profile = AppState.usersCache.get(user.uid) || {};
    const btn =
      document.getElementById("btn-buy-premium") ||
      document.getElementById("btn-extend-premium");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Переход к оплате...";
    }

    try {
      let data = null;

      // 1. Try server backend endpoint first
      try {
        const res = await fetch("/api/premium/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            userName: profile.username || user.displayName || user.email || "User",
            email: profile.email || user.email || "",
          }),
        });

        if (res.ok) {
          data = await res.json().catch(() => null);
        } else if (res.status === 404) {
          console.warn("[Premium] /api/premium/create-payment returned 404 on current host. Using direct Platega gateway call...");
        } else {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Ошибка сервера: ${res.status}`);
        }
      } catch (backendErr) {
        if (backendErr.message && !backendErr.message.includes("404") && backendErr.message.startsWith("Platega:")) {
          throw backendErr;
        }
        console.warn("[Premium] Backend endpoint note:", backendErr);
      }

      // 2. If backend gave 404 or was unreachable:
      // Call Platega API directly from the client (Platega officially supports browser CORS)
      if (!data?.confirmationUrl) {
        const PLATEGA_API_KEY = "1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2";
        const PLATEGA_MERCHANT_ID = "f5c52bf0-56b2-485d-b5b1-b0f44cb34b8e";
        const baseUrl = window.location.origin;
        const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(user.uid)}`;
        const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(user.uid)}`;
        const orderId = `cowio_prem_${user.uid}_${Date.now()}`;

        const directRes = await fetch("https://app.platega.io/transaction/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Secret": PLATEGA_API_KEY,
            "X-MerchantId": PLATEGA_MERCHANT_ID,
          },
          body: JSON.stringify({
            paymentMethod: 2,
            paymentDetails: {
              amount: this.PRICE_RUB,
              currency: "RUB",
            },
            description: "Подписка COWIO Premium (30 дней)",
            return: returnUrl,
            failedUrl: failedUrl,
            payload: JSON.stringify({ uid: user.uid, orderId }),
            metadata: {
              userId: String(user.uid),
              userName: String(profile.username || user.displayName || "User"),
            },
          }),
        });

        if (directRes.ok) {
          const pData = await directRes.json();
          const confUrl = pData.redirect || pData.url || pData.confirmationUrl;
          if (confUrl) {
            data = {
              success: true,
              confirmationUrl: confUrl,
              paymentId: pData.transactionId || pData.id || orderId,
            };
          }
        } else {
          const errText = await directRes.text();
          let errMsg = "Ошибка платежного шлюза Platega";
          try {
            const parsed = JSON.parse(errText);
            if (parsed.message) errMsg = `Platega: ${parsed.message}`;
          } catch {}
          throw new Error(errMsg);
        }
      }

      if (data?.confirmationUrl) {
        this.lastConfirmationUrl = data.confirmationUrl;
        sessionStorage.setItem("cowio_pending_payment", data.paymentId || "");
        sessionStorage.setItem("cowio_pending_uid", user.uid);
        window.open(data.confirmationUrl, "_blank");
        Utils.toast("Окно оплаты открыто в новой вкладке", "success");
        return;
      }

      throw new Error(data?.error || "Платёжный шлюз не предоставил ссылку для оплаты");
    } catch (e) {
      Utils.toast(e.message || "Ошибка оплаты", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent =
          btn.id === "btn-extend-premium"
            ? `Продлить ещё на месяц (${this.PRICE_RUB} ₽)`
            : "Оформить Premium";
      }
    }
  }

  static async refreshStatus(uid) {
    const paymentId = sessionStorage.getItem("cowio_pending_payment") || "";
    const q = new URLSearchParams({ uid });
    if (paymentId) q.set("paymentId", paymentId);
    try {
      let data = null;
      try {
        const res = await fetch(`/api/premium/status?${q}`);
        if (res.ok) {
          data = await res.json().catch(() => null);
        }
      } catch (fetchErr) {
        console.warn("[Premium] /api/premium/status fetch error:", fetchErr);
      }

      // If backend was 404 or unavailable, check directly with Platega
      if (!data && paymentId) {
        try {
          const PLATEGA_API_KEY = "1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2";
          const PLATEGA_MERCHANT_ID = "f5c52bf0-56b2-485d-b5b1-b0f44cb34b8e";
          const pRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(paymentId)}`, {
            headers: {
              "X-MerchantId": PLATEGA_MERCHANT_ID,
              "X-Secret": PLATEGA_API_KEY,
            },
          });
          if (pRes.ok) {
            const txData = await pRes.json();
            const txStatus = String(txData.status || "").toUpperCase();
            if (txStatus === "CONFIRMED" || txStatus === "SUCCESS" || txStatus === "PAID") {
              const user = AppState.currentUser;
              if (user && user.uid === uid) {
                const amt = Number(txData.paymentDetails?.amount) || this.PRICE_RUB;
                await this.activatePremiumDirectly(user, amt);
              }
              data = { active: true };
            } else if (txStatus === "PENDING") {
              data = { active: false, pending: true };
            } else if (txStatus === "CANCELED" || txStatus === "EXPIRED" || txStatus === "FAILED") {
              data = { active: false, canceled: true };
            }
          }
        } catch (dirErr) {
          console.warn("[Premium] Direct Platega status check note:", dirErr);
        }
      }

      if (data && data.active) {
        sessionStorage.removeItem("cowio_pending_payment");
        const cached = AppState.usersCache.get(uid) || {};
        if (data.premium) cached.premium = data.premium;
        AppState.usersCache.set(uid, cached);
        Utils.toast("Premium успешно оплачен и активирован!", "success");
        if (window.CatalogManager) CatalogManager.renderCatalog();
        if (window.ProfileManager && typeof ProfileManager.renderProfile === "function") {
          ProfileManager.renderProfile();
        }
      } else if (data && data.pending) {
        Utils.toast("Платёж обрабатывается платёжной системой...", "info");
      } else if (data && data.canceled) {
        sessionStorage.removeItem("cowio_pending_payment");
        Utils.toast("Платёж был отменён", "info");
      }
      this.renderPremiumSection();
      return data;
    } catch (e) {
      this.renderPremiumSection();
      return null;
    }
  }

  static checkReturnFromPayment() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("premium_return")) return;
    const uidOverride = params.get("uid") || AppState?.currentUser?.uid || "";
    sessionStorage.setItem(
      "cowio_premium_return_uid",
      JSON.stringify({ uid: uidOverride, ts: Date.now() }),
    );
    window.history.replaceState({}, "", window.location.pathname);
    if (AppState?.currentUser) this.handlePostLoginReturn();
  }

  static handlePostLoginReturn() {
    let data;
    try {
      data = JSON.parse(sessionStorage.getItem("cowio_premium_return_uid"));
    } catch (e) {}

    if (
      !data ||
      !data.uid ||
      !AppState?.currentUser ||
      data.uid !== AppState.currentUser.uid ||
      Date.now() - data.ts > 120000
    ) {
      sessionStorage.removeItem("cowio_premium_return_uid");
      return;
    }
    sessionStorage.removeItem("cowio_premium_return_uid");

    if (window.Utils?.showScreen) Utils.showScreen("lobby-screen");
    setTimeout(async () => {
      document.getElementById("nav-premium")?.click();
      const statusRes = await this.refreshStatus(data.uid);
      if (statusRes && !statusRes.active && statusRes.pending) {
        let attempts = 0;
        const pollTimer = setInterval(async () => {
          attempts++;
          const polled = await this.refreshStatus(data.uid);
          if (polled?.active || attempts >= 4) {
            clearInterval(pollTimer);
          }
        }, 3000);
      }
    }, 800);
  }

  static renderCatalogLock() {
    const profile = AppState?.currentUser?.uid ? AppState.usersCache.get(AppState.currentUser.uid) : null;
    const level = this.getUserLevel(profile);
    return `
      <div class="catalog-lock-screen">
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:48px;height:48px;margin-bottom:14px;opacity:0.9;">
        <h3 style="margin:0 0 10px;font-size:20px;">Каталог с 10 Уровня</h3>
        <p style="margin:0 0 20px;font-size:14px;color:var(--text-muted);max-width:420px;margin-left:auto;margin-right:auto;line-height:1.55;">
          Рамки, звуки и горячие акции доступны игрокам, достигшим 10 уровня.
          Ваш текущий уровень: <b>${level}</b>. Общайтесь в комнатах для получения опыта!
        </p>
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
      FriendsManager.setNavActive("nav-profile");
    }
    if (window.Utils?.toast)
      Utils.toast("Достигните 10 уровня для доступа к каталогу", "info");
    return false;
  }
}

window.PremiumManager = PremiumManager;

window.PremiumManager = PremiumManager;
export { PremiumManager };
