class SecurityManager {
  static requestLog = new Map();
  static anomalyScore = 0;

  static init() {
    console.log("[SECURITY] Defense Subsystem Initialized");
    this.monitorDOM();
  }

  static validateAction(
    actionName,
    limits = { count: 5, timeWindowMs: 10000 },
    silent = false,
  ) {
    const isSilent =
      silent ||
      actionName === "react_message" ||
      actionName === "reaction" ||
      actionName.startsWith("react");

    if (this.anomalyScore > 100) {
      if (!isSilent && typeof Utils !== "undefined")
        Utils.toast(
          "Система безопасности временно заблокировала ваши действия из-за подозрительной активности",
          "error",
        );
      return false;
    }
    const now = Date.now();
    if (!this.requestLog.has(actionName)) {
      this.requestLog.set(actionName, []);
    }
    let times = this.requestLog.get(actionName);
    times = times.filter((t) => now - t < limits.timeWindowMs);

    if (times.length >= limits.count) {
      if (!isSilent) {
        this.anomalyScore += 10;
        console.warn(
          `[SECURITY] Action blocked: ${actionName} (Rate limit exceeded)`,
        );
        if (typeof Utils !== "undefined")
          Utils.toast(
            `Пожалуйста, помедленнее. Действие ${actionName} временно ограничено (DDoS защита).`,
            "error",
          );
      }
      return false;
    }

    times.push(now);
    this.requestLog.set(actionName, times);

    // Decrement anomaly score over time if it's healthy
    if (this.anomalyScore > 0 && Math.random() > 0.8) {
      this.anomalyScore = Math.max(0, this.anomalyScore - 5);
    }

    return true;
  }

  static validateTextPayload(text, maxLength = 2000, context = "general") {
    if (!text) return true;
    if (text.length > maxLength) {
      console.warn(`[SECURITY] Payload too large for context: ${context}`);
      if (typeof Utils !== "undefined")
        Utils.toast("Текст слишком длинный", "error");
      return false;
    }
    const xssPattern = /<(script|iframe|object|embed|svg|math|base|link|meta)/i;
    if (xssPattern.test(text)) {
      console.warn(`[SECURITY] Potential XSS detected in context: ${context}`);
      this.anomalyScore += 50;
      if (typeof Utils !== "undefined")
        Utils.toast("Недопустимое содержимое", "error");
      return false;
    }
    return true;
  }

  static monitorDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === "SCRIPT" || node.tagName === "IFRAME") {
              const src = String(node.src || "").toLowerCase();
              const isPlayerChild =
                node.id === "vk-player-iframe" ||
                (typeof node.closest === "function" &&
                  (node.closest("#yt-player-container") ||
                    node.closest("#yt-player") ||
                    node.closest("#room-video-container"))) ||
                (node.parentElement &&
                  (node.parentElement.id === "yt-player" ||
                    node.parentElement.id === "yt-player-container" ||
                    node.parentElement.id === "room-video-container"));

              const isAllowed =
                isPlayerChild ||
                src.includes("gstatic.com") ||
                src.includes("googleapis.com") ||
                src.includes("firebase") ||
                src.includes("recaptcha") ||
                src.includes("youtube.com") ||
                src.includes("youtube-nocookie.com") ||
                src.includes("hls.js") ||
                src.includes("rutube.ru") ||
                src.includes("vk.com") ||
                src.includes("vkvideo.ru") ||
                src.includes("vk.ru") ||
                src.includes("vimeo.com") ||
                src.includes("twitch.tv") ||
                src.includes("vercel") ||
                src.includes("google") ||
                src.includes("run.app") ||
                src.includes("ai.studio") ||
                src.includes("localhost") ||
                src.includes("about:blank") ||
                src.startsWith("javascript:") ||
                src.trim() === "";

              if (!isAllowed) {
                console.error(
                  `[SECURITY] Blocked potentially unsafe DOM injection: ${node.tagName}`,
                );
                if (node.parentNode) {
                  try {
                    node.parentNode.removeChild(node);
                  } catch (err) {}
                }
              }
            }
          });
        }
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

class TutorialManager {
  static init() {
    if (!localStorage.getItem("device_account_created")) {
      // Not created yet, do nothing on init
    }
    if (localStorage.getItem("tutorial_active") === "true") {
      const step = localStorage.getItem("tutorial_step");
      if (step && step !== "0") {
        // To avoid immediately blurring before UI load, we wait
        setTimeout(() => {
          if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById("main-sidebar");
            const overlay = document.getElementById("sidebar-overlay");
            if (sidebar) sidebar.classList.add("open");
            if (overlay) overlay.classList.add("open");
          }
          this.applyBlur();
          this.highlightNav(step);
        }, 1500);
      }
    }
  }

  static markDeviceUsed() {
    localStorage.setItem("device_account_created", "true");
  }

  static startTutorial(force = false) {
    if (!force && localStorage.getItem("device_account_created") === "true")
      return;

    if (!force) {
      localStorage.setItem("device_account_created", "true");
    }
    localStorage.setItem("tutorial_active", "true");
    localStorage.setItem("tutorial_step", "0");

    setTimeout(() => this.showWelcome(), 100);

    // Check IP in the background to prevent abuse later, without blocking UI
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ip) {
          const ipKey = data.ip.replace(/\./g, "_").replace(/:/g, "_");
          const ipRef = ref(db, `tutorial_ips/${ipKey}`);
          get(ipRef).then((snap) => {
            if (!snap.exists()) set(ipRef, true);
          });
        }
      })
      .catch((e) => console.warn("Could not check IP for tutorial", e));
  }

  static showWelcome() {
    this.renderModal(
      "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Waving%20Hand.webp",
      "Добро пожаловать!",
      "Хей, добро пожаловать! Спасибо, что решил(а) присоединиться к нашей платформе. Мы тут постарались создать уютное место для общения, поиска друзей и просто хорошего времяпровождения. Давай я быстро покажу тебе, что к чему? Это не займёт много времени!",
      "Поехали!",
      () => this.startNavigationTour(),
      true
    );
  }

  static applyBlur() {
    const els = Array.from(document.querySelectorAll(".lobby-layout > *"));
    const mobileHeader = document.querySelector(".mobile-header");
    if (mobileHeader) els.push(mobileHeader);

    els.forEach((el) => {
      if (
        el &&
        el.id !== "main-sidebar" &&
        el.id !== "tutorial-modal-overlay"
      ) {
        el.style.filter = "blur(6px)";
        el.style.pointerEvents = "none";
        el.style.transition = "filter 0.3s ease";
      }
    });

    const navPanel = document.getElementById("main-sidebar");
    if (navPanel) {
      if (window.innerWidth <= 1024) {
        navPanel.classList.add("open");
        const sidebarOverlay = document.getElementById("sidebar-overlay");
        if (sidebarOverlay) sidebarOverlay.classList.add("open");
      } else {
        navPanel.style.position = "relative";
      }
      navPanel.style.zIndex = "100001";
      navPanel.style.transition = "all 0.4s ease";
      navPanel.style.background = "var(--bg-main)";
      navPanel.style.borderRadius = "16px";
      navPanel.style.boxShadow = "0 0 50px rgba(255, 255, 255, 0.4)";
      navPanel.style.border = "1px solid rgba(255, 255, 255, 0.3)";
      navPanel.style.transform = "scale(1.02)";
    }
  }

  static removeBlur() {
    const els = Array.from(document.querySelectorAll(".lobby-layout > *"));
    const mobileHeader = document.querySelector(".mobile-header");
    if (mobileHeader) els.push(mobileHeader);

    els.forEach((el) => {
      if (el) {
        el.style.filter = "";
        el.style.pointerEvents = "";
      }
    });
    const navPanel = document.getElementById("main-sidebar");
    if (navPanel) {
      navPanel.style.zIndex = "";
      navPanel.style.position = "";
      navPanel.style.transition = "";
      navPanel.style.background = "";
      navPanel.style.borderRadius = "";
      navPanel.style.boxShadow = "";
      navPanel.style.border = "";
      navPanel.style.transform = "";
    }
  }

  static navPointers = {
    profile: {
      id: "nav-profile",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Bust%20In%20Silhouette.webp",
      title: "Твой профиль",
      text: "Твоя личная крепость! Здесь ты можешь красиво оформить свою страничку - поставить крутую аватарку, написать пару слов о себе и даже поменять фон. Люди любят, когда профиль заполнен с душой, так проще найти общие интересы.",
      next: "settings",
    },
    settings: {
      id: "nav-settings",
      emoji: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp",
      title: "Настройки",
      text: "Здесь ты можешь настроить свой аккаунт, сменить пароль или добавить дополнительные юзернеймы.",
      next: "friends",
    },
    friends: {
      id: "nav-friends",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Handshake.webp",
      title: "Друзья",
      text: "Твой круг общения. Тут будут отображаться все, с кем ты подружился. Отсюда удобно сразу переходить к переписке, смотреть кто онлайн и управлять запросами в друзья. Не стесняйся заводить новые знакомства!",
      next: "search",
    },
    search: {
      id: "nav-find-friend",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Magnifying%20Glass%20Tilted%20Left.webp",
      title: "Найти друга",
      text: "Не с кем поболтать? Загляни сюда. Здесь можно найти других ребят, посмотреть их профили и отправить запрос в друзья. Если кто-то показался интересным - смело пиши, тут все рады новому общению.",
      next: "leaderboard",
    },
    leaderboard: {
      id: "nav-leaderboard",
      emoji: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp",
      title: "Список лучших",
      text: "В этом разделе собираются самые активные ребята нашего комьюнити! Смотри топы лайков и стремись занять первые места на доске почета.",
      next: "catalog",
    },
    catalog: {
      id: "nav-catalog",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp",
      title: "Каталог",
      text: "Местная сокровищница! В каталоге мы собираем классные темы оформления, рамки, значки и другие штуки для кастомизации. Доступ к нему открывается при достижении 10-го уровня. Заглядывай сюда периодически, чтобы обновить свой стиль и выделиться из толпы.",
      next: "library",
    },
    library: {
      id: "nav-library",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Open%20Book.webp",
      title: "Библиотека",
      text: "Настоящая кинобаза от наших пользователей! Здесь можно искать классные ролики и фильмы, смотреть, кто есть на превьюшках, и, самое главное — моментально создавать комнаты для просмотра с друзьями прямо из карточки видео. Заглядывай и делись своими находками!",
      next: "rooms",
    },
    rooms: {
      id: "nav-rooms",
      emoji:
        "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/House.webp",
      title: "Комнаты",
      text: "А вот здесь происходит магия общения! Заходи в комнаты чтобы общаться с людьми, смотреть видео вместе или обмениваться сообщениями вживую. Можешь даже создать свою уютную комнату и собрать там компанию!",
      next: "support",
    },
    support: {
      id: "nav-support",
      emoji: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman%20Technologist.webp",
      title: "Поддержка",
      text: "Возникли проблемы или есть предложения? Смело пиши в поддержку! Наши администраторы всегда на связи и готовы помочь с любым вопросом.",
      next: null,
    },
  };
  static currentHole = null;

  static startNavigationTour() {
    localStorage.setItem("tutorial_step", "profile");
    if (window.innerWidth <= 1024) {
      const sidebar = document.getElementById("main-sidebar");
      const overlay = document.getElementById("sidebar-overlay");
      if (sidebar) sidebar.classList.add("open");
      if (overlay) overlay.classList.add("open");
    }
    this.applyBlur();
    this.highlightNav("profile");
  }

  static highlightNav(step) {
    if (this.currentHole)
      this.currentHole.classList.remove("tutorial-highlightpulse");
      
    const oldPointer = document.getElementById("tutorial-pointer");
    if (oldPointer) oldPointer.remove();

    const data = this.navPointers[step];
    if (!data) return this.endTutorial();

    // Lock other nav items
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.style.transition = "all 0.3s ease";
      if (item.id !== data.id) {
        item.style.pointerEvents = "none";
        item.style.opacity = "0.15";
        item.style.filter = "brightness(0.3)";
      } else {
        item.style.pointerEvents = "auto";
        item.style.opacity = "1";
        item.style.filter =
          "brightness(1.5) drop-shadow(0 0 10px rgba(255,255,255,0.4))";
      }
    });

    const btn = document.getElementById(data.id);
    if (btn) {
      const container = btn.closest('.nav-menu') || btn.parentElement;
      if (container) {
        const targetPos = btn.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 2 + btn.clientHeight / 2;
        const startPos = container.scrollTop;
        const distance = targetPos - startPos;
        let startTime = null;
        const duration = 800;
        const animation = (currentTime) => {
          if (!startTime) startTime = currentTime;
          const timeElapsed = currentTime - startTime;
          const progress = Math.min(timeElapsed / duration, 1);
          const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          container.scrollTop = startPos + distance * ease;
          if (timeElapsed < duration) {
            requestAnimationFrame(animation);
          }
        };
        requestAnimationFrame(animation);
      } else {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      
      btn.classList.add("tutorial-highlightpulse");
      
      const pointer = document.createElement("div");
      pointer.id = "tutorial-pointer";
      pointer.innerHTML = '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Backhand%20Index%20Pointing%20Left.webp" style="width: 48px; height: 48px;">';
      pointer.style.position = "absolute";
      pointer.style.right = "0px";
      pointer.style.top = "50%";
      pointer.style.transform = "translateY(-50%)";
      pointer.style.pointerEvents = "none";
      pointer.style.zIndex = "100002";
      pointer.style.animation = "tutorialPointerAnim 0.6s infinite alternate";
      
      if (window.getComputedStyle(btn).position === "static") {
          btn.style.position = "relative";
      }
      btn.appendChild(pointer);

      this.currentHole = btn;

      const handler = (e) => {
        if (!e.isTrusted) return;
        btn.classList.remove("tutorial-highlightpulse");
        if (pointer) pointer.remove();
        btn.removeEventListener("click", handler);
        setTimeout(() => this.showStepModal(step), 300);
      };
      btn.addEventListener("click", handler);
    } else {
      this.highlightNav(data.next);
    }
  }

  static showStepModal(step) {
    const data = this.navPointers[step];
    this.renderModal(data.emoji, data.title, data.text, "Понял(а)", () => {
      if (data.next) {
        localStorage.setItem("tutorial_step", data.next);
        this.highlightNav(data.next);
      } else {
        this.endTutorial();
      }
    });
  }

  static endTutorial(showFinal = true) {
    localStorage.removeItem("tutorial_active");
    localStorage.removeItem("tutorial_step");
    this.removeBlur();

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.style.pointerEvents = "";
      item.style.opacity = "";
      item.style.filter = "";
    });

    const oldPointer = document.getElementById("tutorial-pointer");
    if (oldPointer) oldPointer.remove();

    if (this.currentHole)
      this.currentHole.classList.remove("tutorial-highlightpulse");

    if (showFinal) {
        this.renderModal(
          "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Party%20Popper.webp",
          "Готово!",
          "Вот и всё! Теперь ты знаешь самое важное. Желаем отличного настроения и классного общения на нашей платформе!",
          "Завершить",
          () => {},
          false
        );
    }
  }

  static renderModal(emojiSrc, title, text, btnText, onConfirm, showSkip = false) {
    const existing = document.getElementById("tutorial-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "tutorial-modal-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.backgroundColor = "rgba(0,0,0,0.7)";
    overlay.style.backdropFilter = "blur(12px)";
    overlay.style.zIndex = "100005";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "20px";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.6s ease";

    const modal = document.createElement("div");
    modal.style.background = "linear-gradient(145deg, #222222 0%, #111111 100%)";
    modal.style.border = "1px solid rgba(255,255,255,0.08)";
    modal.style.borderRadius = "28px";
    modal.style.padding = "40px 30px";
    modal.style.maxWidth = "400px";
    modal.style.width = "100%";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.alignItems = "center";
    modal.style.textAlign = "center";
    modal.style.boxShadow = "0 30px 80px rgba(0,0,0,0.8), inset 0 2px 20px rgba(255,255,255,0.05)";
    modal.style.transform = "translateY(40px) scale(0.9)";
    modal.style.opacity = "0";
    modal.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease";

    const emoji = document.createElement("img");
    emoji.src = emojiSrc;
    emoji.style.width = "80px";
    emoji.style.height = "80px";
    emoji.style.marginBottom = "20px";
    emoji.style.animation = "pulse 1.5s infinite alternate ease-in-out";
    emoji.style.filter = "drop-shadow(0 10px 20px rgba(0,0,0,0.5))";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.style.margin = "0 0 12px 0";
    h2.style.fontSize = "26px";
    h2.style.fontWeight = "800";
    h2.style.color = "#ffffff";
    h2.style.letterSpacing = "-0.5px";

    const p = document.createElement("p");
    p.style.margin = "0 0 30px 0";
    p.style.fontSize = "15px";
    p.style.lineHeight = "1.6";
    p.style.color = "rgba(255,255,255,0.75)";
    p.style.minHeight = "140px";

    const btn = document.createElement("button");
    btn.textContent = btnText;
    btn.style.width = "100%";
    btn.style.padding = "14px 20px";
    btn.style.borderRadius = "14px";
    btn.style.fontSize = "16px";
    btn.style.fontWeight = "bold";
    btn.style.background = "linear-gradient(135deg, #ffffff, #d0d0d0)";
    btn.style.color = "#000000";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.opacity = "0";
    btn.style.transform = "translateY(10px)";
    btn.style.transition = "all 0.4s ease";
    btn.style.boxShadow = "0 8px 20px rgba(255,255,255,0.2)";
    btn.onmouseover = () => {
        btn.style.background = "#ffffff";
        btn.style.transform = "translateY(-2px)";
        btn.style.boxShadow = "0 12px 25px rgba(255,255,255,0.3)";
    };
    btn.onmouseout = () => {
        btn.style.background = "linear-gradient(135deg, #ffffff, #d0d0d0)";
        btn.style.transform = "translateY(0)";
        btn.style.boxShadow = "0 8px 20px rgba(255,255,255,0.2)";
    };
    
    let btnSkip;
    if (showSkip) {
        btnSkip = document.createElement("button");
        btnSkip.textContent = "Пропустить туториал";
        btnSkip.style.width = "100%";
        btnSkip.style.padding = "12px 20px";
        btnSkip.style.borderRadius = "14px";
        btnSkip.style.fontSize = "14px";
        btnSkip.style.fontWeight = "600";
        btnSkip.style.background = "rgba(255,255,255,0.05)";
        btnSkip.style.color = "rgba(255,255,255,0.5)";
        btnSkip.style.border = "1px solid rgba(255,255,255,0.1)";
        btnSkip.style.cursor = "pointer";
        btnSkip.style.opacity = "0";
        btnSkip.style.transform = "translateY(10px)";
        btnSkip.style.transition = "all 0.3s ease";
        btnSkip.style.marginTop = "10px";
        btnSkip.onmouseover = () => {
            btnSkip.style.background = "rgba(255,255,255,0.1)";
            btnSkip.style.color = "rgba(255,255,255,0.8)";
        };
        btnSkip.onmouseout = () => {
            btnSkip.style.background = "rgba(255,255,255,0.05)";
            btnSkip.style.color = "rgba(255,255,255,0.5)";
        };
        btnSkip.onclick = () => {
            overlay.style.opacity = "0";
            modal.style.transform = "translateY(30px) scale(0.9)";
            setTimeout(() => {
                overlay.remove();
                this.endTutorial(false);
            }, 500);
        };
    }

    let typingInterval;
    let isTyping = false;

    const skipTyping = () => {
      if (isTyping) {
        clearInterval(typingInterval);
        p.textContent = text;
        isTyping = false;
        btn.style.opacity = "1";
        btn.style.transform = "translateY(0)";
        if (btnSkip) {
            btnSkip.style.opacity = "1";
            btnSkip.style.transform = "translateY(0)";
        }
        return true;
      }
      return false;
    };

    const handleSkip = (e) => {
        if (isTyping) {
            e.preventDefault();
            e.stopPropagation();
            skipTyping();
        }
    };
    
    overlay.addEventListener("mousedown", handleSkip, true);
    overlay.addEventListener("touchstart", handleSkip, true);

    btn.onclick = (e) => {
      if (skipTyping()) {
          e.preventDefault();
          return;
      }
      
      overlay.style.opacity = "0";
      modal.style.opacity = "0";
      modal.style.transform = "translateY(30px) scale(0.9)";
      setTimeout(() => {
        overlay.remove();
        if (onConfirm) onConfirm();
      }, 500);
    };

    modal.appendChild(emoji);
    modal.appendChild(h2);
    modal.appendChild(p);
    modal.appendChild(btn);
    if (btnSkip) modal.appendChild(btnSkip);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      modal.style.transform = "translateY(0) scale(1)";
      modal.style.opacity = "1";
      setTimeout(() => {
        let i = 0;
        isTyping = true;
        typingInterval = setInterval(() => {
          if (i < text.length) {
            p.textContent += text.charAt(i);
            i++;
          } else {
            clearInterval(typingInterval);
            isTyping = false;
            btn.style.opacity = "1";
            btn.style.transform = "translateY(0)";
            if (btnSkip) {
                btnSkip.style.opacity = "1";
                btnSkip.style.transform = "translateY(0)";
            }
          }
        }, 12);
      }, 400); 
    });
  }
}

window.SecurityManager = SecurityManager;
window.TutorialManager = TutorialManager;
export { SecurityManager, TutorialManager };
