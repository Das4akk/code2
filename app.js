/**
 * COWIO Core Engine - Modular Entry Point
 * Orchestrates all subsystems: Auth, Rooms, Media, Social, Profile, Admin, and Themes.
 */

// Core Infrastructure & Shared State
// window.Hls is provided by the global script tag or bundler
const Hls = typeof window !== "undefined" ? window.Hls : null;
import "./js/firebase.js";
import "./js/emojis.js";
import "./js/security.js";
import "./js/utils.js";
import "./js/settings.js";
import "./js/library.js";
import "./js/premium.js";
import "./js/media.js";
import "./js/players.js";
import "./js/effects.js";
import "./js/auth.js";
import "./js/lumens.js";
import "./js/profile.js";
import "./js/social.js";
import "./js/support.js";
import "./js/admin.js";
import "./js/room.js";
import "./js/catalog.js";
import "./js/fps.js";
import "./js/router.js";
import "./js/maintenance.js";

// Application Runner & Initialization
const runApp = () => {
  const initSystem = (name, initFn) => {
    try {
      if (initFn) initFn();
      console.log(`[System: ${name}] Initialized gracefully.`);
    } catch (e) {
      console.error(`[System: ${name}] Failed to initialize:`, e);
      if (window.Utils && window.Utils.toast) {
        window.Utils.toast(
          `Ошибка подсистемы ${name}! Остальной сайт продолжает работу.`,
          "error",
        );
      }
    }
  };

  initSystem("Router", () => window.Router?.init());
  initSystem("SecurityManager", () => SecurityManager.init());
  initSystem("TutorialManager", () => TutorialManager.init());
  initSystem("BadgeManager", () => BadgeManager.init());
  initSystem("GlobalThemeManager", () => GlobalThemeManager.init()); // [NEW]
  initSystem("AuthManager", () => AuthManager.init());
  initSystem("BackgroundFX", () => BackgroundFX.init());
  initSystem("EasterEggManager", () => EasterEggManager.init());
  initSystem("HashtagManager", () => HashtagManager.initHashtags());
  initSystem("MobileSwipeManager", () => MobileSwipeManager.init()); // [NEW] Mobile Swipes initialization
  initSystem("PremiumManager", () => PremiumManager.init());
  initSystem("LibraryManager", () => window.LibraryManager.init());
  initSystem("MysteryEventManager", () => MysteryEventManager.init());
  initSystem("FpsCounter", () => window.FpsCounter?.checkAndToggle());

  document.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (!modal) return;
      if (modal.id === "modal-dm-chat") DirectMessages.closeChat();
      else modal.classList.remove("active");
    });
  });

  const viewProfModal = Utils.$("modal-view-profile");
  if (viewProfModal) {
    const vpContent = viewProfModal.querySelector(".modal-content");
    // Removed 3D tilt
  }

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target !== modal) return;
      if (modal.id === "modal-dm-chat") DirectMessages.closeChat();
      else modal.classList.remove("active");
    });
  });
};


// Application Routing & Event Wiring
window.CatalogManager = CatalogManager;
window.ProfileManager = ProfileManager;
window.FriendsManager = FriendsManager;

// Initialize on load so it's visible to guests too
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => CatalogManager.init());
} else {
  CatalogManager.init();
}

setTimeout(() => {
  // Global listeners for the pushed events
  onValue(ref(db, "admin/actions/globalGhostWhispers"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `ghostWhispersSeen:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    const words = [
      "почему?",
      "ты слышишь?",
      "темнота...",
      "оно здесь",
      "не оборачивайся",
      "холодно",
      "тссс...",
      "беги",
      "мы видим",
    ];

    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const el = document.createElement("div");
        el.innerText = words[Math.floor(Math.random() * words.length)];
        el.style.cssText = `position:fixed; left:${Math.random() * 90}vw; top:${Math.random() * 90}vh; color:rgba(255,255,255,0.1); font-size:${10 + Math.random() * 20}px; z-index:999990; pointer-events:none; filter:blur(${Math.random() * 4}px); opacity:0; transition:opacity 2s ease, transform 4s ease; transform:scale(0.8) translateY(10px); text-shadow:0 0 10px rgba(255,255,255,0.2);`;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
          el.style.opacity = "0.7";
          el.style.transform = "scale(1) translateY(0px)";
          setTimeout(
            () => {
              el.style.opacity = "0";
              el.style.transform = "scale(1.1) translateY(-10px)";
              setTimeout(() => el.remove(), 2000);
            },
            2000 + Math.random() * 2000,
          );
        });
      }, Math.random() * 3000);
    }
  });

  // Teleport Listener (inside setTimout 1000 so AppState is ready)
  setTimeout(() => {
    if (!AppState.currentUser) return;
    onValue(
      ref(db, `admin/curses/teleport/${AppState.currentUser.uid}`),
      (snap) => {
        const data = snap.val();
        if (!data || !data.roomId || Date.now() - data.ts > 10000) return;
        const marker = `teleportSeen:${data.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, "1");
        Utils.toast("Вас телепортировали!", "info");
        if (AppState.currentRoomId) RoomManager.leaveRoom();
        setTimeout(() => {
          RoomManager.joinRoom(data.roomId);
        }, 500);
      },
    );
  }, 2000);

  onValue(ref(db, "admin/actions/globalGodVoice"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `godVoiceSeen:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    let el = document.getElementById("god-voice-el");
    if (!el) {
      el = document.createElement("div");
      el.id = "god-voice-el";
      el.className = "global-god-voice";
      el.innerHTML = `<div class="global-god-voice-text"></div>`;
      document.body.appendChild(el);
    }

    const txtEl = el.querySelector(".global-god-voice-text");
    txtEl.innerHTML = "";
    const totalDuration = payload.duration || 8000;
    el.style.setProperty("--gv-duration", totalDuration + "ms");
    el.classList.add("active");

    // Typewriter effect (slower and cinematic)
    const textToType = payload.text || "";
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < textToType.length) {
        const charSpan = document.createElement("span");
        charSpan.innerText = textToType.charAt(i);
        charSpan.style.opacity = "0";
        charSpan.style.transition = "opacity 1s filter 1s";
        charSpan.style.filter = "blur(4px)";
        txtEl.appendChild(charSpan);
        requestAnimationFrame(() => {
          charSpan.style.opacity = "1";
          charSpan.style.filter = "blur(0px)";
        });
        i++;
      } else {
        clearInterval(typeInterval);
      }
    }, 120); // 120ms per char

    // Remove slightly after finishing typing (e.g. 5 seconds after duration)
    setTimeout(() => {
      el.classList.remove("active");
      setTimeout(() => {
        txtEl.innerHTML = "";
      }, 1000); // clear after fade out
    }, totalDuration);
  });

  onValue(ref(db, "admin/actions/globalFlashbang"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `flashbangSeen:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    let el = document.createElement("div");
    el.className = "global-flashbang";
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
    }, 300);
    setTimeout(() => {
      el.remove();
    }, 4300);
  });

  onValue(ref(db, "admin/actions/showTutorial"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `tutorialSeenAdmin:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    if (payload.targetAll || payload.targetUid === AppState.currentUser?.uid) {
      if (typeof TutorialManager !== "undefined") {
        TutorialManager.startTutorial(true);
      }
    }
  });

  onValue(ref(db, "admin/actions/globalScreenShake"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `shakeSeen:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    document.body.classList.add("screen-shake-active");
    setTimeout(() => {
      document.body.classList.remove("screen-shake-active");
    }, 3000);
  });

  onValue(ref(db, "admin/actions/globalVideoHijack"), (snap) => {
    const payload = snap.val();
    if (!payload?.ts || Date.now() - Number(payload.ts) > 60000) return;
    const marker = `hijackSeen:${payload.ts}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    if (AppState.currentRoomId) {
      const syncRef = ref(db, `rooms/${AppState.currentRoomId}/sync`);
      set(syncRef, {
        type: "source",
        src: payload.url,
        mediaType: "youtube",
        ts: Date.now(),
      });
      Utils.toast("СИЛОВОЙ УГОН ВИДЕО СОВЕРШЕН!", "error");
    }
  });

  // Watch Party Draw System

  let drawLayer = document.createElement("canvas");
  drawLayer.id = "draw-canvas-layer";
  drawLayer.style.display = "none";
  const vc = document.querySelector(".video-container");
  if (vc) vc.appendChild(drawLayer);

  let isDrawing = false;
  let drawMode = false;
  if (drawLayer && vc) {
    // resize
    const rs = () => {
      drawLayer.width = vc.clientWidth;
      drawLayer.height = vc.clientHeight;
    };
    window.addEventListener("resize", rs);
    rs();

    const ctx = drawLayer.getContext("2d");
    const drawPx = (e) => {
      if (!isDrawing || !drawMode) return;
      const r = drawLayer.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (AppState.currentRoomId) {
        set(
          ref(db, `rooms/${AppState.currentRoomId}/drawEvents/${Date.now()}`),
          {
            x: x / drawLayer.width,
            y: y / drawLayer.height,
          },
        );
      }
    };
    drawLayer.onmousedown = () => (isDrawing = true);
    drawLayer.onmouseup = () => (isDrawing = false);
    drawLayer.onmousemove = drawPx;

    // Listener for remote draws (single subscription pattern to prevent leaks)
    let currentDrawListenerUnsub = null;
    let lastSubscribedRoomId = null;
    setInterval(() => {
      if (!AppState.currentRoomId) {
        if (currentDrawListenerUnsub) {
          currentDrawListenerUnsub();
          currentDrawListenerUnsub = null;
          lastSubscribedRoomId = null;
        }
        return;
      }
      if (lastSubscribedRoomId === AppState.currentRoomId) return;
      lastSubscribedRoomId = AppState.currentRoomId;
      if (currentDrawListenerUnsub) currentDrawListenerUnsub();
      currentDrawListenerUnsub = onValue(
        ref(db, `rooms/${AppState.currentRoomId}/drawEvents`),
        (snap) => {
          const vals = snap.val();
          ctx.clearRect(0, 0, drawLayer.width, drawLayer.height);
          if (!vals) return;
          ctx.fillStyle = "red";
          Object.values(vals).forEach((pt) => {
            ctx.beginPath();
            ctx.arc(
              pt.x * drawLayer.width,
              pt.y * drawLayer.height,
              3,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
        }
      );
    }, 1000);
  }

  // 20. Anonymous Roulette Button
  const rouletteTimer = setInterval(() => {
    const rf = document.querySelector(".lobby-header");
    if (rf && !rf.querySelector(".roulette-btn")) {
      const rb = document.createElement("button");
      rb.className = "primary-btn roulette-btn";
      rb.style.background = "#e91e63";
      rb.style.color = "#fff";
      rb.style.width = "auto";
      rb.innerText = "🎲 Случайная комната";
      rb.onclick = () => {
        get(ref(db, "rooms")).then((snap) => {
          const rs = snap.val();
          if (!rs) return;
          // filter private and roomless
          const keys = Object.keys(rs).filter((k) => !rs[k].isPrivate);
          if (keys.length === 0)
            return Utils.toast("Нет доступных публичных комнат", "error");
          const rKey = keys[Math.floor(Math.random() * keys.length)];
          RoomManager.attemptJoinRoom(rKey, rs[rKey]);
        });
      };
      rf.appendChild(rb);
      clearInterval(rouletteTimer);
    }
  }, 1000);
}, 3000);

window.triggerAdminAction = (action) => {
  const resolveAdminTarget = async (input) => {
    if (!input) return null;
    const val = input.trim();
    if (!val) return null;
    if (val.toLowerCase() === "all") return "all";
    const clean = val.replace(/^@/, "").toLowerCase();
    try {
      const snap = await get(ref(db, `usernames/${clean}`));
      if (snap && snap.exists()) return snap.val();
    } catch (e) {}
    return val.replace(/^@/, "");
  };

  const showAdminPrompt = (title, inputs, onSubmit) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;";

    // Modal container
    const modal = document.createElement("div");
    modal.style.cssText =
      "background:rgba(20,20,22,0.9); border:1px solid var(--accent); border-radius:16px; width:90%; max-width:400px; padding:24px; box-shadow:0 10px 40px rgba(0,0,0,0.5); transform:translateY(20px); transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);";

    // Title
    const titleEl = document.createElement("h3");
    titleEl.style.cssText =
      "color:#fff; margin:0 0 16px 0; font-size:18px; font-weight:700;";
    titleEl.innerText = title;
    modal.appendChild(titleEl);

    const inputEls = [];
    inputs.forEach((inp) => {
      const el = document.createElement("input");
      el.type = "text";
      el.placeholder = inp.placeholder;
      el.style.cssText =
        "width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px 16px; border-radius:8px; margin-bottom:12px; font-size:14px; outline:none; transition:border-color 0.2s;";
      el.onfocus = () => (el.style.borderColor = "var(--accent)");
      el.onblur = () => (el.style.borderColor = "rgba(255,255,255,0.1)");
      modal.appendChild(el);
      inputEls.push(el);
    });

    // Buttons row
    const btnsRow = document.createElement("div");
    btnsRow.style.cssText = "display:flex; gap:10px; margin-top:8px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "secondary-btn";
    cancelBtn.innerText = "Отмена";
    cancelBtn.style.flex = "1";
    cancelBtn.onclick = () => {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 200);
    };

    const submitBtn = document.createElement("button");
    submitBtn.className = "primary-btn";
    submitBtn.innerText = "Выполнить";
    submitBtn.style.flex = "1";
    submitBtn.onclick = () => {
      const vals = inputEls.map((el) => el.value.trim());
      onSubmit(vals);
      cancelBtn.onclick();
    };

    inputEls[inputEls.length - 1].onkeydown = (e) => {
      if (e.key === "Enter") submitBtn.click();
    };

    btnsRow.appendChild(cancelBtn);
    btnsRow.appendChild(submitBtn);
    modal.appendChild(btnsRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Open anim
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      modal.style.transform = "translateY(0)";
      if (inputEls.length) inputEls[0].focus();
    });
  };

  if (action === "flashbang") {
    set(ref(db, "admin/actions/globalFlashbang"), { ts: Date.now() });
  } else if (action === "shake") {
    set(ref(db, "admin/actions/globalScreenShake"), { ts: Date.now() });
  } else if (action === "forceTutorial") {
    showAdminPrompt(
      "Вызвать Туториал",
      [{ placeholder: "@id пользователя (или 'all')" }],
      async (vals) => {
        const target = await resolveAdminTarget(vals[0]);
        if (!target) return Utils.toast("Введите UID или 'all'", "error");
        set(ref(db, "admin/actions/showTutorial"), {
          ts: Date.now(),
          by: AppState.currentUser.uid,
          targetUid: target === "all" ? null : target,
          targetAll: target === "all",
        });
        Utils.toast("Команда на туториал отправлена", "success");
      },
    );
  } else if (action === "godVoice") {
    showAdminPrompt(
      "Голос Бога",
      [{ placeholder: "Введите текст для всех зрителей..." }],
      (vals) => {
        if (!vals[0]) return Utils.toast("Текст не может быть пустым", "error");
        set(ref(db, "admin/actions/globalGodVoice"), {
          ts: Date.now(),
          text: vals[0],
          duration: 8000,
        });
      },
    );
  } else if (action === "hijack") {
    showAdminPrompt(
      "Угон видео",
      [{ placeholder: "URL (YouTube) для угона..." }],
      (vals) => {
        if (!vals[0]) return Utils.toast("URL не может быть пустым", "error");
        set(ref(db, "admin/actions/globalVideoHijack"), {
          ts: Date.now(),
          url: vals[0],
        });
      },
    );
  } else if (action === "puppeteer") {
    showAdminPrompt(
      "Режим Кукловода",
      [{ placeholder: "@id пользователя (оставьте пустым для отключения)" }],
      async (vals) => {
        const puppetUid = await resolveAdminTarget(vals[0]);
        if (puppetUid) {
          window.puppeteerUid = puppetUid;
          Utils.toast(
            `Режим Кукловода активирован для UID: ${puppetUid}. Ваши сообщения в чате теперь будут отправляться от его лица.`,
            "success",
          );
        } else {
          window.puppeteerUid = null;
          Utils.toast("Режим Кукловода деактивирован", "info");
        }
      },
    );
  } else if (action === "incognito") {
    window.isIncognito = !window.isIncognito;
    Utils.toast(
      window.isIncognito
        ? "Инкогнито ВКЛЮЧЕН. Вы невидимы."
        : "Инкогнито ВЫКЛЮЧЕН.",
      "success",
    );
  } else if (action === "uwuCurse") {
    showAdminPrompt(
      "Проклятие UwU",
      [{ placeholder: "@id пользователя" }],
      async (vals) => {
        const curUid = await resolveAdminTarget(vals[0]);
        if (!curUid) return;
        set(ref(db, `admin/curses/uwu/${curUid}`), Date.now());
        Utils.toast("Проклятие наложено.", "success");
      },
    );
  } else if (action === "shadowClone") {
    window.isShadowCloneActive = !window.isShadowCloneActive;
    Utils.toast(
      window.isShadowCloneActive
        ? "Shadow Clone ВКЛЮЧЕН."
        : "Shadow Clone ВЫКЛЮЧЕН.",
      "success",
    );
  } else if (action === "ghostWhispers") {
    set(ref(db, "admin/actions/globalGhostWhispers"), { ts: Date.now() });
    Utils.toast("Шепот призраков отправлен.", "success");
  } else if (action === "thanosSnapROOM") {
    if (!AppState.currentRoomId) return Utils.toast("Вы не в комнате", "error");
    set(ref(db, `rooms/${AppState.currentRoomId}/chatAction`), {
      type: "thanosSnap",
      ts: Date.now(),
    });
  } else if (action === "teleport") {
    showAdminPrompt(
      "Random Teleport",
      [{ placeholder: "@id пользователя для телепортации" }],
      async (vals) => {
        const uid = await resolveAdminTarget(vals[0]);
        if (!uid) return;
        const roomsSnap = await get(ref(db, "rooms"));
        if (roomsSnap.exists()) {
          const rooms = Object.keys(roomsSnap.val() || {}).filter(
            (k) => roomsSnap.val()[k]?.type === "public",
          );
          if (rooms.length > 0) {
            const rndRoom = rooms[Math.floor(Math.random() * rooms.length)];
            set(ref(db, `admin/curses/teleport/${uid}`), {
              roomId: rndRoom,
              ts: Date.now(),
            });
            Utils.toast("Юзер телепортирован!", "success");
          } else Utils.toast("Нет публичных комнат", "error");
        }
      },
    );
  } else if (action === "cursorSync") {
    if (!AppState.currentRoomId) return Utils.toast("Вы не в комнате", "error");
    showAdminPrompt(
      "Режим Cursor Sync (0=Выкл, 1=Вкл)",
      [{ placeholder: "1" }],
      (vals) => {
        const v = vals[0].trim();
        set(ref(db, `rooms/${AppState.currentRoomId}/cursorSync`), v === "1");
        Utils.toast("Изменено", "success");
      },
    );
  }
};

window.addEventListener("pagehide", () => {
  if (AppState.currentRoomId && AppState.isHost) {
    let currentTime = 0;
    let isYt = !!YouTubePlayerManager.player;
    let isRt = !!RutubePlayerManager.player;
    let isVk = !!VkPlayerManager.player;
    if (isYt) currentTime = YouTubePlayerManager.getCurrentTime();
    else if (isRt) currentTime = RutubePlayerManager.getCurrentTime();
    else if (isVk) currentTime = VkPlayerManager.getCurrentTime();
    else {
      const vid = Utils.$("native-player");
      if (vid) currentTime = vid.currentTime;
    }
    try {
      set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
        type: "pause",
        state: "paused",
        time: currentTime,
        ts: Date.now(),
      }).catch(() => {});
    } catch (e) {}
  }
});

// ============================================================================
// MARKETPLACE
// ============================

window.MysteryEventManager = class MysteryEventManager {
  static RELEASE_AT = Date.parse("2026-06-10T19:46:00+03:00");
  static EVENT_END_AT = this.RELEASE_AT + 30 * 24 * 60 * 60 * 1000;
  static timer = null;

  static init() {
    this.render();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 1000);
  }

  static pad(value) {
    return String(value).padStart(2, "0");
  }

  static render() {
    const remaining = Math.max(0, this.EVENT_END_AT - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("mystery-days", String(days));
    setText("mystery-hours", this.pad(hours));
    setText("mystery-minutes", this.pad(minutes));
    setText("mystery-seconds", this.pad(seconds));
  }
};

window.openLegalModal = function (type) {
  const modal = document.getElementById("modal-legal-info");
  const title = document.getElementById("legal-modal-title");
  const body = document.getElementById("legal-modal-body");

  if (type === "contacts") {
    title.innerText = "Контакты и реквизиты";
    body.innerHTML =
      "<strong>Электронная почта:</strong> support@ais-preview.run.app<br><br>" +
      '<strong>Служба поддержки:</strong> Доступна через раздел "Поддержка" в приложении.<br><br>' +
      "<strong>Юридический адрес:</strong> г. Москва, ул. Примерная, д. 1, оф. 1";
  } else if (type === "delivery") {
    title.innerText = "Условия доставки";
    body.innerHTML =
      "Поскольку сервис предоставляет исключительно цифровые товары (статусы, бейджи, темы, премиум-подписки), " +
      "доставка осуществляется автоматически и моментально после успешной оплаты. " +
      "<br><br><strong>Регион доставки:</strong> Весь мир (WorldWide).";
  } else if (type === "refund") {
    title.innerText = "Условия возврата";
    body.innerHTML =
      "Возврат средств за цифровые покупки возможен только в случае технических неисправностей, " +
      "при которых вы не получили заявленную услугу в течение 24 часов после оплаты." +
      "<br><br>В остальных случаях, поскольку услуга оказывается в момент покупки, возврат не предусмотрен.";
  } else if (type === "privacy") {
    title.innerText = "Политика конфиденциальности";
    body.innerHTML = '      <style>      .oled-scroll::-webkit-scrollbar { width: 6px; }      .oled-scroll::-webkit-scrollbar-track { background: #000000; border-radius: 4px; }      .oled-scroll::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 4px; }      .oled-scroll::-webkit-scrollbar-thumb:hover { background: #cccccc; }      .legal-text-container {         text-align: left;          font-size: 14px;          line-height: 1.6;          color: #b0b0b0;          padding: 10px 15px;          background: #000;          border-radius: 12px;         border: 1px solid rgba(255,255,255,0.1);      }      .legal-text-container strong { color: #fff; font-size: 15px; display: block; margin-top: 15px; margin-bottom: 5px; }      .legal-text-container ul { margin-top: 5px; margin-bottom: 15px; padding-left: 20px; }      .legal-text-container li { margin-bottom: 4px; }      </style>      <div class="legal-text-container">        <p style="margin-bottom: 10px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Обновлено: 17 Сентября 2026</p>        <p style="margin-bottom: 15px; font-size: 15px; color: #fff;">Политика конфиденциальности регулирует сбор, использование и защиту информации пользователей сервиса. Собираются идентификаторы аккаунта, техническая информация и история взаимодействий. Данные используются для обеспечения работы сервиса, связи с пользователем и анализа. Передача информации третьим лицам возможна только в законодательно установленных случаях или с согласия пользователя. Хранение данных осуществляется в течение необходимого срока, их защита — в разумных пределах. Пользователь самостоятельно несёт ответственность за риски, связанные с передачей данных. Администрация вправе вносить изменения в Политику без уведомления — согласие считается принятым при дальнейшем использовании сервиса.</p>                <strong>1. Общие положения</strong>        <p>1.1. Настоящая Политика конфиденциальности (далее — «Политика») регулирует порядок обработки и защиты информации, которую Пользователь передаёт при использовании сервиса (далее — «Сервис»).</p>        <p style="margin-bottom: 15px;">1.2. Используя Сервис, Пользователь подтверждает своё согласие с условиями Политики. Если Пользователь не согласен с условиями — он обязан прекратить использование Сервиса.</p>        <strong>2. Сбор информации</strong>        <p>2.1. Сервис может собирать следующие типы данных:        <ul>          <li>Идентификаторы аккаунта (логин, ID, никнейм и т.п.);</li>          <li>Техническую информацию (IP-адрес, данные о браузере, устройстве и операционной системе);</li>          <li>Историю взаимодействий с Сервисом.</li>        </ul></p>        <p style="margin-bottom: 15px;">2.2. Сервис не требует от Пользователя предоставления паспортных данных, документов, фотографий или другой личной информации, кроме минимально необходимой для работы.</p>        <strong>3. Использование информации</strong>        <p>3.1. Сервис может использовать полученную информацию исключительно для:        <ul>          <li>Обеспечения работы функционала;</li>          <li>Связи с Пользователем (в том числе для уведомлений и поддержки);</li>          <li>Анализа и улучшения работы Сервиса.</li>        </ul></p>        <strong>4. Передача информации третьим лицам</strong>        <p>4.1. Администрация не передаёт полученные данные третьим лицам, за исключением случаев:        <ul>          <li>Если это требуется по закону;</li>          <li>Если это необходимо для исполнения обязательств перед Пользователем (например, при работе с платёжными системами);</li>          <li>Если Пользователь сам дал на это согласие.</li>        </ul></p>        <strong>5. Хранение и защита данных</strong>        <p>5.1. Данные хранятся в течение срока, необходимого для достижения целей обработки.</p>        <p style="margin-bottom: 15px;">5.2. Администрация принимает разумные меры для защиты данных, но не гарантирует абсолютную безопасность информации при передаче через интернет.</p>        <strong>6. Отказ от ответственности</strong>        <p>6.1. Пользователь понимает и соглашается, что передача информации через интернет всегда сопряжена с рисками.</p>        <p style="margin-bottom: 15px;">6.2. Администрация не несёт ответственности за утрату, кражу или раскрытие данных, если это произошло по вине третьих лиц или самого Пользователя.</p>        <strong>7. Изменения в Политике</strong>        <p>7.1. Администрация вправе изменять условия Политики без предварительного уведомления.</p>        <p>7.2. Продолжение использования Сервиса после внесения изменений означает согласие Пользователя с новой редакцией Политики.</p>      </div>';
    body.classList.add("oled-scroll");
  } else if (type === "offer") {
    title.innerText = "Пользовательское соглашение";
    body.innerHTML = '      <style>      .oled-scroll::-webkit-scrollbar { width: 6px; }      .oled-scroll::-webkit-scrollbar-track { background: #000000; border-radius: 4px; }      .oled-scroll::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 4px; }      .oled-scroll::-webkit-scrollbar-thumb:hover { background: #cccccc; }      .legal-text-container {         text-align: left;          font-size: 14px;          line-height: 1.6;          color: #b0b0b0;          padding: 10px 15px;          background: #000;          border-radius: 12px;         border: 1px solid rgba(255,255,255,0.1);      }      .legal-text-container strong { color: #fff; font-size: 15px; display: block; margin-top: 15px; margin-bottom: 5px; }      .legal-text-container ul { margin-top: 5px; margin-bottom: 15px; padding-left: 20px; }      .legal-text-container li { margin-bottom: 4px; }      </style>      <div class="legal-text-container">        <p style="margin-bottom: 15px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Обновлено: 17 Сентября 2026</p>                <strong>1. Общие положения</strong>        <p>1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует порядок использования онлайн-сервиса (далее — «Сервис»), предоставляемого Администрацией.</p>        <p>1.2. Используя Сервис, включая регистрацию, оплату услуг или получение доступа к материалам, Пользователь подтверждает, что полностью ознакомился с условиями настоящего Соглашения и принимает их в полном объёме.</p>        <p style="margin-bottom: 15px;">1.3. В случае несогласия с условиями Соглашения Пользователь обязан прекратить использование Сервиса.</p>        <strong>2. Характер услуг и цифровых товаров</strong>        <p>2.1. Сервис предоставляет цифровые товары и услуги нематериального характера, включая, но не ограничиваясь: информационные материалы, обучающие программы, консультации, цифровые продукты и сервисные услуги.</p>        <p>2.2. Материалы, предоставляемые через Сервис, могут включать:        <ul>          <li>Информацию из открытых источников;</li>          <li>Авторские материалы Администрации и/или третьих лиц;</li>          <li>Аналитические обзоры, подборки, рекомендации, структурированные данные.</li>        </ul></p>        <p>2.3. Пользователь осознаёт и соглашается, что ценность цифровых товаров и услуг Сервиса заключается в систематизации, анализе, форме подачи, сопровождении, поддержке и обновлениях, а не в эксклюзивности отдельных фрагментов информации.</p>        <p style="margin-bottom: 15px;">2.4. Сервис не заявляет и не гарантирует уникальность, исключительность или недоступность отдельных элементов материалов вне Сервиса.</p>        <strong>3. Отказ от гарантий и ответственности</strong>        <p>3.1. Сервис предоставляется на условиях «AS IS» («как есть»).</p>        <p>3.2. Администрация не гарантирует:        <ul>          <li>Соответствие Сервиса ожиданиям Пользователя;</li>          <li>Достижение каких-либо финансовых, коммерческих, профессиональных или иных результатов;</li>          <li>Бесперебойную и безошибочную работу Сервиса.</li>        </ul></p>        <p>3.3. Администрация не несёт ответственности за:        <ul>          <li>Любые прямые или косвенные убытки, включая упущенную выгоду;</li>          <li>Последствия применения Пользователем полученных материалов;</li>          <li>Действия или бездействие третьих лиц;</li>          <li>Временные технические сбои и ограничения доступа.</li>        </ul></p>        <p style="margin-bottom: 15px;">3.4. Все решения о применении материалов, рекомендаций и услуг принимаются Пользователем самостоятельно и на его риск.</p>        <strong>4. Законность использования</strong>        <p>4.1. Сервис не предназначен для поощрения, организации или содействия противоправной деятельности.</p>        <p>4.2. Пользователь обязуется использовать Сервис исключительно в рамках применимого законодательства и правил третьих сторон.</p>        <p style="margin-bottom: 15px;">4.3. Ответственность за законность использования материалов и услуг Сервиса полностью возлагается на Пользователя.</p>        <strong>5. Интеллектуальная собственность</strong>        <p>5.1. Все материалы, размещённые в Сервисе, охраняются законодательством об интеллектуальной собственности.</p>        <p>5.2. Пользователю запрещается копировать, распространять, перепродавать, передавать третьим лицам или иным образом использовать материалы Сервиса без разрешения правообладателя.</p>        <p style="margin-bottom: 15px;">5.3. Нарушение прав интеллектуальной собственности может повлечь ограничение доступа к Сервису без компенсации.</p>        <strong>6. Ограничение доступа</strong>        <p>6.1. Администрация вправе приостановить или ограничить доступ Пользователя к Сервису в случае:        <ul>          <li>Нарушения условий настоящего Соглашения;</li>          <li>Выявления злоупотреблений;</li>          <li>Требований законодательства или платёжных провайдеров.</li>        </ul></p>        <p>6.2. Ограничение доступа не освобождает Пользователя от обязательств, возникших ранее.</p>        <p style="margin-bottom: 15px;">6.3. Администрация оставляет за собой право отказывать в обслуживании Пользователям, чьи действия могут создавать повышенные риски для Сервиса, платёжных провайдеров или третьих лиц.</p>        <strong>7. Платежи и возвраты</strong>        <p>7.1. Оплата услуг и цифровых товаров производится на условиях, указанных в Сервисе до момента оплаты.</p>        <p>7.2. В связи с нематериальным характером цифровых товаров и услуг, возврат денежных средств после предоставления доступа не осуществляется, за исключением случаев, указанных ниже.</p>        <p>7.3. Возврат средств возможен только если:        <ul>          <li>Услуга не была оказана по технической вине Сервиса;</li>          <li>Доступ к цифровому товару фактически не был предоставлен.</li>        </ul></p>        <p>7.4. Для рассмотрения вопроса о возврате Пользователь обязан обратиться в службу поддержки в течение 24 часов с момента оплаты.</p>        <p>7.5. Решение о возврате принимается Администрацией индивидуально.</p>        <p style="margin-bottom: 15px;">7.6. Пользователь подтверждает, что обязуется не инициировать возврат платежа (chargeback) через платёжные системы без предварительного обращения в службу поддержки Сервиса.</p>        <strong>8. Конфиденциальность</strong>        <p>8.1. Администрация может собирать минимально необходимые технические данные для обеспечения работы Сервиса.</p>        <p style="margin-bottom: 15px;">8.2. Администрация принимает разумные меры для защиты данных, однако не гарантирует абсолютную безопасность передаваемой информации.</p>        <strong>9. Изменение условий</strong>        <p>9.1. Администрация вправе вносить изменения в настоящее Соглашение.</p>        <p>9.2. Актуальная версия Соглашения публикуется в Сервисе.</p>        <p style="margin-bottom: 15px;">9.3. Продолжение использования Сервиса означает согласие Пользователя с обновлёнными условиями.</p>        <strong>10. Контактная информация</strong>        <p>10.1. По всем вопросам Пользователь может обратиться в службу поддержки через форму на сайте.</p>        <p style="margin-top: 15px; font-weight: 500; color: #fff;">Используя Сервис, Пользователь подтверждает, что ознакомлен с настоящим Соглашением и принимает его условия в полном объёме.</p>      </div>';
    body.classList.add("oled-scroll");
  }

  modal.classList.add("active");
};
window.ShopController = class {
  static loadShop() {
    document.getElementById("nav-premium")?.click();
    if (window.PremiumManager) PremiumManager.renderPremiumSection();
  }
};

window.AppState = AppState;
window.Utils = Utils;
window.ProfileManager = ProfileManager;
window.ThemeManager = ThemeManager;
window.HashtagManager = HashtagManager;
window.RoomManager = RoomManager;
window.MediaResolverClient = MediaResolverClient;
window.SecurityManager = SecurityManager;


// Telegram Integration & Global Overlays
const initTelegram = async () => {
  // [INJECT TELEGRAM DM]
  await import("./telegram_dm_inject.js");
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTelegram);
} else {
  initTelegram();
}


window.activeLeaderboardCategory = "lumens";

window.switchLeaderboardCategory = function(cat) {
    window.activeLeaderboardCategory = cat;
    const btnLumens = Utils.$("leaderboard-tab-lumens");
    const btnLikes = Utils.$("leaderboard-tab-likes");
    const btnTime = Utils.$("leaderboard-tab-time");

    if (btnLumens) {
        if (cat === "lumens") {
            btnLumens.className = "primary-btn";
            btnLumens.style.background = "linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 170, 0, 0.25))";
            btnLumens.style.borderColor = "rgba(255, 215, 0, 0.4)";
            btnLumens.style.color = "#ffd700";
        } else {
            btnLumens.className = "secondary-btn";
            btnLumens.style.background = "transparent";
            btnLumens.style.borderColor = "rgba(255, 255, 255, 0.1)";
            btnLumens.style.color = "rgba(255, 255, 255, 0.6)";
        }
    }

    if (btnLikes) {
        if (cat === "likes") {
            btnLikes.className = "primary-btn";
            btnLikes.style.background = "rgba(255, 75, 75, 0.2)";
            btnLikes.style.borderColor = "rgba(255, 75, 75, 0.4)";
            btnLikes.style.color = "#ff6b6b";
        } else {
            btnLikes.className = "secondary-btn";
            btnLikes.style.background = "transparent";
            btnLikes.style.borderColor = "rgba(255, 255, 255, 0.1)";
            btnLikes.style.color = "rgba(255, 255, 255, 0.6)";
        }
    }

    if (btnTime) {
        if (cat === "time") {
            btnTime.className = "primary-btn";
            btnTime.style.background = "linear-gradient(135deg, rgba(96, 165, 250, 0.25), rgba(59, 130, 246, 0.25))";
            btnTime.style.borderColor = "rgba(96, 165, 250, 0.4)";
            btnTime.style.color = "#60a5fa";
        } else {
            btnTime.className = "secondary-btn";
            btnTime.style.background = "transparent";
            btnTime.style.borderColor = "rgba(255, 255, 255, 0.1)";
            btnTime.style.color = "rgba(255, 255, 255, 0.6)";
        }
    }

    window.loadLeaderboard();
};

window.loadLeaderboard = async function() {
    const listEl = Utils.$("leaderboard-list");
    if (!listEl) return;
    
    const cat = window.activeLeaderboardCategory || "lumens";
    listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 24px;">Загрузка рейтинга...</div>';
    
    try {
        const database = window.db || (typeof getDatabase === "function" ? getDatabase() : null);
        const getFn = window.get;
        const refFn = window.ref;

        if (!database || !getFn || !refFn) {
            throw new Error("Firebase database not initialized");
        }

        const snap = await getFn(refFn(database, "users"));
        if (!snap.exists()) {
            listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 24px;">Пока нет данных.</div>';
            return;
        }
        
        const allUsers = snap.val() || {};
        let usersArray = [];

        if (cat === "lumens") {
            for (const [uid, uData] of Object.entries(allUsers)) {
                if (!uData.profile) continue;
                const lumens = Number(uData.profile.lumens) || 0;
                if (lumens > 0) {
                    usersArray.push({ uid, profile: uData.profile, score: lumens, type: "lumens" });
                }
            }
            usersArray.sort((a, b) => b.score - a.score);
        } else if (cat === "likes") {
            for (const [uid, uData] of Object.entries(allUsers)) {
                if (!uData.profile) continue;
                const likedBy = uData.profile.likedBy || {};
                const likesCount = Object.keys(likedBy).length;
                if (likesCount > 0) {
                    usersArray.push({ uid, profile: uData.profile, score: likesCount, type: "likes" });
                }
            }
            usersArray.sort((a, b) => b.score - a.score);
        } else if (cat === "time") {
            for (const [uid, uData] of Object.entries(allUsers)) {
                if (!uData.profile) continue;
                const roomTime = Number(uData.profile.timeSpentInRooms) || 0;
                if (roomTime > 0) {
                    usersArray.push({ uid, profile: uData.profile, score: roomTime, type: "time" });
                }
            }
            usersArray.sort((a, b) => b.score - a.score);
        }

        const topUsers = usersArray.slice(0, 50);
        
        if (topUsers.length === 0) {
            const emptyLabel = cat === "lumens" ? "Люменов" : (cat === "likes" ? "лайков" : "проведённого времени в комнатах");
            listEl.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding: 32px 16px;">Пока ни у кого нет ${emptyLabel}.</div>`;
            return;
        }
        
        let html = "";
        topUsers.forEach((u, idx) => {
            let placeStyle = "color: var(--text-muted); font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center;";
            let placeText = `${idx + 1}`;
            
            if (idx === 0) { 
                placeStyle = "color: #FFD700; font-size: 20px; font-weight: 900; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); display: flex; align-items: center; justify-content: center; gap: 4px;"; 
                placeText = '1 <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp" style="width: 28px; height: 28px;" alt="1">'; 
            } else if (idx === 1) { 
                placeStyle = "color: #C0C0C0; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 4px;"; 
                placeText = '2 <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gem%20Stone.webp" style="width: 26px; height: 26px;" alt="2">'; 
            } else if (idx === 2) { 
                placeStyle = "color: #CD7F32; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 4px;"; 
                placeText = '3 <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Star.webp" style="width: 24px; height: 24px;" alt="3">'; 
            }
            
            const avHtml = ProfileManager.getAvatarHtml(u.profile);
            const isMe = AppState.currentUser?.uid === u.uid;
            
            let scoreContent = "";
            if (cat === "lumens") {
                scoreContent = `${u.score.toLocaleString()} <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width: 20px; height: 20px;" alt="✨">`;
            } else if (cat === "likes") {
                scoreContent = `${u.score.toLocaleString()} <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width: 20px; height: 20px;" alt="❤️">`;
            } else {
                scoreContent = `${Utils.formatDuration(u.score)} <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Hourglass%20Done.webp" style="width: 20px; height: 20px;" alt="⏳">`;
            }

            const scoreColor = cat === "lumens" ? "#ffd700" : (cat === "likes" ? "#ff4b4b" : "#60a5fa");

            html += `<div style="display:flex;align-items:center;padding:12px 16px;background:${isMe ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isMe ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.05)'};border-radius:12px;cursor:pointer;transition:transform 0.2s, background 0.2s;" onmouseover="this.style.background='${isMe ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${isMe ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)'}'" onclick="ProfileManager.openViewProfileModal('${u.uid}')">
                <div style="width: 60px; text-align:center; margin-right:16px; font-weight:bold; ${placeStyle}">${placeText}</div>
                <div style="width:46px;height:46px;margin-right:16px;border-radius:50%;overflow:visible;">${avHtml}</div>
                <div style="flex:1;display:flex;flex-direction:column;gap:2px;">
                    <div style="font-weight:700;font-size:16px;color:var(--text-main);display:flex;align-items:center;gap:6px;">
                        <span>${Utils.escapeHtml(u.profile.name || "Пользователь")}</span>
                        ${isMe ? '<span style="font-size:10px;padding:2px 6px;background:rgba(255,215,0,0.2);color:#ffd700;border-radius:4px;font-weight:800;">ВЫ</span>' : ''}
                    </div>
                    <span style="font-size:12px;color:var(--text-muted);">@${Utils.escapeHtml(u.profile.username || "")}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:16px;color:${scoreColor};">
                    ${scoreContent}
                </div>
            </div>`;
        });
        
        listEl.innerHTML = html;
        
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div style="color:red; text-align:center; padding:24px;">Ошибка загрузки рейтинга.</div>';
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("btn-chat-close-x");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            const layout = document.querySelector(".room-layout");
            if (layout) {
                layout.classList.toggle("chat-collapsed");
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btn-open-chat");
    if (openBtn) {
        openBtn.addEventListener("click", () => {
            const layout = document.querySelector(".room-layout");
            if (layout) {
                layout.classList.remove("chat-collapsed");
            }
        });
    }
});

// Initialize ReportManager
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => ReportManager.init());
} else {
  ReportManager.init();
}



// Bootstrapping
if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(runApp, 1);
} else {
  window.addEventListener("DOMContentLoaded", runApp);
}
