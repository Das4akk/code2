class Utils {
  static $(id) {
    return document.getElementById(id);
  }

  static escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  static toast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.position = "fixed";
      container.style.bottom = "20px";
      container.style.right = "20px";
      container.style.zIndex = "999999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      document.body.appendChild(container);
    }
    const t = document.createElement("div");
    t.style.background = type === "error" ? "#e74c3c" : type === "success" ? "#2ecc71" : "#3498db";
    t.style.color = "#fff";
    t.style.padding = "10px 20px";
    t.style.borderRadius = "8px";
    t.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    t.style.fontSize = "14px";
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s";
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = "1");
    setTimeout(() => {
        t.style.opacity = "0";
        setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  static generateCryptoId(len = 20) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static formatExactDate(ts) {
    return new Date(ts).toLocaleString();
  }

  static formatLastSeen(ts) {
    if (!ts) return "Давно";
    const diff = Date.now() - ts;
    if (diff < 60000) return "Только что";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
    return new Date(ts).toLocaleDateString();
  }

  static formatDuration(totalSeconds) {
    let s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (s > 86400000) {
      s = Math.floor(s / 1000);
    }
    if (s === 0) return "0 мин.";
    if (s < 60) return `${s} сек.`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} мин.`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h < 24) {
      return remM === 0 ? `${h} ч.` : `${h} ч. ${remM} мин.`;
    }
    const days = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${days} д. ${remH} ч.` : `${days} д.`;
  }

  static getDistributedHeartLeft(x) {
    return x;
  }

  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }

  static bannerFileToBase64(file) {
      return this.fileToBase64(file);
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
  }

  static hashPassword(pwd) {
      // Very simple polyfill if needed, hopefully not used for real security client-side
      return btoa(encodeURIComponent(pwd));
  }

  static injectFixes() {
      // Stub
  }

  static hasInjectedAuthStyles() {
      return true;
  }

  static showBadgeModal(title, text, emojiSrc) {
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
    
    // allow closing by clicking overlay
    overlay.onclick = (e) => {
        if(e.target === overlay) {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 400);
        }
    };

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
    p.textContent = text;

    const btn = document.createElement("button");
    btn.textContent = "Понятно";
    btn.style.width = "100%";
    btn.style.padding = "14px 20px";
    btn.style.borderRadius = "14px";
    btn.style.fontSize = "16px";
    btn.style.fontWeight = "bold";
    btn.style.background = "linear-gradient(135deg, #ffffff, #d0d0d0)";
    btn.style.color = "#000000";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
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
    
    btn.onclick = () => {
      overlay.style.opacity = "0";
      modal.style.transform = "translateY(30px) scale(0.9)";
      setTimeout(() => overlay.remove(), 400);
    };

    modal.appendChild(emoji);
    modal.appendChild(h2);
    modal.appendChild(p);
    modal.appendChild(btn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      modal.style.transform = "translateY(0) scale(1)";
      modal.style.opacity = "1";
    });
  }

  static showScreen(id, push = true) {
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      const screen = document.getElementById(id);
      if (screen) screen.classList.add("active");
  }

  static alert(msg) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal active";
      modal.style.zIndex = "99999";
      modal.innerHTML = `
        <div class="modal-content glass-panel" style="max-width: 400px; text-align: center; border-radius: 20px; padding: 30px;">
          <h3 style="margin-bottom: 12px; font-weight: 800; font-size: 22px;">Внимание</h3>
          <p style="margin-bottom: 24px; color: var(--text-muted); font-size: 15px; line-height: 1.5;">${this.escapeHtml(msg)}</p>
          <button class="primary-btn" id="custom-alert-ok" style="width: 100%; border-radius: 12px; padding: 14px;">ОК</button>
        </div>
      `;
      document.body.appendChild(modal);
      const cleanup = () => {
        modal.classList.remove("active");
        setTimeout(() => modal.remove(), 400);
      };
      modal.querySelector("#custom-alert-ok").onclick = () => {
        cleanup();
        resolve();
      };
    });
  }

  static confirm(msg) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal active";
      modal.style.zIndex = "99999";
      modal.innerHTML = `
        <div class="modal-content glass-panel" style="max-width: 400px; text-align: center; border-radius: 20px; padding: 30px;">
          <h3 style="margin-bottom: 12px; font-weight: 800; font-size: 22px;">Подтверждение</h3>
          <p style="margin-bottom: 24px; color: var(--text-muted); font-size: 15px; line-height: 1.5;">${this.escapeHtml(msg)}</p>
          <div style="display: flex; gap: 10px;">
            <button class="secondary-btn" id="custom-confirm-cancel" style="flex: 1; border-radius: 12px; padding: 14px;">Отмена</button>
            <button class="primary-btn" id="custom-confirm-ok" style="flex: 1; border-radius: 12px; padding: 14px;">Да</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const cleanup = () => {
        modal.classList.remove("active");
        setTimeout(() => modal.remove(), 400);
      };
      modal.querySelector("#custom-confirm-cancel").onclick = () => {
        cleanup();
        resolve(false);
      };
      modal.querySelector("#custom-confirm-ok").onclick = () => {
        cleanup();
        resolve(true);
      };
    });
  }

  static prompt(msg, defaultVal = "") {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal active";
      modal.style.zIndex = "99999";
      modal.innerHTML = `
        <div class="modal-content glass-panel" style="max-width: 400px; text-align: center; border-radius: 20px; padding: 30px;">
          <h3 style="margin-bottom: 12px; font-weight: 800; font-size: 22px;">Ввод данных</h3>
          <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 15px; line-height: 1.5;">${Utils.escapeHtml(msg)}</p>
          <input type="text" id="custom-prompt-input" class="input" value="${Utils.escapeHtml(defaultVal)}" style="margin-bottom: 0px; width: 100%; border-radius: 12px; padding: 12px;">
          <div style="display: flex; gap: 10px; margin-top: 24px;">
            <button class="secondary-btn" id="custom-prompt-cancel" style="flex: 1;">Отмена</button>
            <button class="primary-btn" id="custom-prompt-ok" style="flex: 1;">ОК</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const input = modal.querySelector("#custom-prompt-input");
      input.focus();

      const cleanup = () => {
        modal.classList.remove("active");
        setTimeout(() => modal.remove(), 400);
      };

      modal.querySelector("#custom-prompt-cancel").onclick = () => {
        cleanup();
        resolve(null);
      };

      modal.querySelector("#custom-prompt-ok").onclick = () => {
        cleanup();
        resolve(input.value);
      };

      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          cleanup();
          resolve(input.value);
        }
      };
    });
  }

  static promptCode(email, onResendClick) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal active";
      modal.style.zIndex = "99999";
      modal.innerHTML = `
        <div class="modal-content glass-panel" style="max-width: 420px; text-align: center; border-radius: 24px; padding: 40px 30px; background: rgba(15, 15, 20, 0.85); box-shadow: 0 0 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1); backdrop-filter: blur(25px); position: relative; overflow: hidden; animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          
          <div style="position: relative; z-index: 1;">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width: 72px; height: 72px; margin-bottom: 20px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5)); animation: float 3s ease-in-out infinite;">
            <h3 style="margin-bottom: 12px; font-weight: 800; font-size: 26px; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">Код подтверждения</h3>
            <p style="margin-bottom: 30px; color: var(--text-muted); font-size: 15px; line-height: 1.5;">Мы отправили секретный код на<br><b style="color:#fff; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 6px;">${Utils.escapeHtml(email)}</b></p>
            
            <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 25px; perspective: 1000px;" id="code-inputs-container">
              ${[0, 1, 2, 3, 4, 5].map((i) => `<input type="text" inputmode="numeric" maxlength="1" data-index="${i}" style="width: 48px; height: 58px; padding: 0; margin: 0; text-align: center; font-size: 26px; font-family: monospace; font-weight: 800; border-radius: 14px; background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.15); color: #fff; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);" autocomplete="off" />`).join("")}
            </div>

            <div style="margin-bottom: 25px;">
              <button id="resend-code-btn" class="btn-text-link" disabled style="color: var(--text-muted); font-size: 13px; cursor: pointer; text-decoration: underline; transition: color 0.2s;">Отправить повторно (через <span id="resend-timer">60</span>с)</button>
            </div>

            <div style="display: flex; gap: 15px; margin-top: 10px;">
              <button class="secondary-btn" id="custom-prompt-cancel" style="flex: 1; padding: 14px; border-radius: 14px; font-weight: 600; font-size: 15px; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1);">Отмена</button>
              <button class="primary-btn" id="custom-prompt-ok" style="flex: 1; padding: 14px; border-radius: 14px; font-weight: 600; font-size: 15px; box-shadow: 0 5px 15px rgba(255,255,255,0.1); transition: all 0.2s;">Готово <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" style="width:16px;height:16px;vertical-align:text-bottom;"></button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      let timerVal = 60;
      let timerInt = setInterval(() => {
        timerVal--;
        const timerEl = modal.querySelector("#resend-timer");
        const btnEl = modal.querySelector("#resend-code-btn");
        if (timerVal <= 0) {
          clearInterval(timerInt);
          if (timerEl)
            timerEl.parentElement.innerHTML = "Отправить код повторно";
          if (btnEl) {
            btnEl.disabled = false;
            btnEl.style.color = "#fff";
          }
        } else {
          if (timerEl) timerEl.innerText = timerVal;
        }
      }, 1000);

      const resendBtn = modal.querySelector("#resend-code-btn");
      if (resendBtn && onResendClick) {
        resendBtn.onclick = async () => {
          resendBtn.disabled = true;
          resendBtn.style.color = "var(--text-muted)";
          resendBtn.innerHTML = `Отправка...`;
          await onResendClick();
          timerVal = 60;
          resendBtn.innerHTML = `Отправить повторно (через <span id="resend-timer">60</span>с)`;
          timerInt = setInterval(() => {
            timerVal--;
            const tEl = modal.querySelector("#resend-timer");
            if (timerVal <= 0) {
              clearInterval(timerInt);
              resendBtn.innerHTML = "Отправить код повторно";
              resendBtn.disabled = false;
              resendBtn.style.color = "#fff";
            } else {
              if (tEl) tEl.innerText = timerVal;
            }
          }, 1000);
        };
      }

      const inputs = Array.from(
        modal.querySelectorAll("#code-inputs-container input"),
      );
      inputs[0].focus();

      inputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
          if (e.target.value.length > 0) {
            input.style.borderColor = "#fff";
            input.style.boxShadow = "0 0 15px rgba(255,255,255,0.3)";
            if (index < inputs.length - 1) {
              inputs[index + 1].focus();
            }
          } else {
            input.style.borderColor = "rgba(255,255,255,0.15)";
            input.style.boxShadow = "none";
          }
        });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Backspace" && e.target.value === "" && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = "";
            inputs[index - 1].style.borderColor = "rgba(255,255,255,0.15)";
            inputs[index - 1].style.boxShadow = "none";
          }
          if (e.key === "Enter") {
            const code = inputs.map((i) => i.value).join("");
            if (code.length === 6) {
              cleanup();
              resolve(code);
            }
          }
        });

        input.addEventListener("paste", (e) => {
          e.preventDefault();
          const pastedData = (e.clipboardData || window.clipboardData)
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);
          if (pastedData.length > 0) {
            pastedData.split("").forEach((char, i) => {
              if (inputs[index + i]) {
                inputs[index + i].value = char;
                inputs[index + i].style.borderColor = "#fff";
                inputs[index + i].style.boxShadow =
                  "0 0 15px rgba(255,255,255,0.3)";
              }
            });
            const nextIndex = Math.min(5, index + pastedData.length);
            inputs[nextIndex].focus();
          }
        });
      });

      const cleanup = () => {
        if (typeof timerInt !== "undefined") clearInterval(timerInt);
        modal.classList.remove("active");
        setTimeout(() => modal.remove(), 400);
      };

      modal.querySelector("#custom-prompt-cancel").onclick = () => {
        cleanup();
        resolve(null);
      };

      modal.querySelector("#custom-prompt-ok").onclick = () => {
        const code = inputs.map((i) => i.value).join("");
        if (code.length === 6) {
          cleanup();
          resolve(code);
        } else {
          inputs.forEach((i) => {
            if (!i.value) {
              i.style.borderColor = "#ff4d4f";
            }
          });
          modal.animate(
            [
              { transform: "translateX(0px)" },
              { transform: "translateX(-5px)" },
              { transform: "translateX(5px)" },
              { transform: "translateX(-5px)" },
              { transform: "translateX(5px)" },
              { transform: "translateX(0px)" },
            ],
            { duration: 300 },
          );
        }
      };
    });
  }

  static escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (match) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[match];
    });
  }

  static closeModal(modalId) {
    const modal = typeof modalId === "string" ? Utils.$(modalId) : modalId;
    if (modal) {
      if (modal.id === "modal-dm-chat" && window.DirectMessages) DirectMessages.closeChat();
      else modal.classList.remove("active");
    }
  }

  static showScreen(screenId, pushState = true) {
    // Безопасный переход: если запрошена вкладка каталога или раздел внутри лобби
    if (screenId === "section-catalog" || screenId === "nav-catalog") {
      this.showScreen("lobby-screen", pushState);
      if (window.FriendsManager && window.FriendsManager.setNavActive) {
        FriendsManager.setNavActive("nav-catalog");
      }
      if (window.CatalogManager) {
        CatalogManager.renderCatalog();
      }
      return;
    }
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("active"));
    const screen = Utils.$(screenId);
    if (screen) screen.classList.add("active");

    // Показываем футер с ссылками ТОЛЬКО в лобби
    const footerLinks = Utils.$("bottom-footer-links");
    if (footerLinks) {
      footerLinks.style.display = screenId === "lobby-screen" ? "flex" : "none";
    }

    if (screenId === "room-screen" || screenId === "lobby-screen") {
      const uid = AppState.currentUser?.uid;
      const prof = uid ? AppState.usersCache.get(uid) : null;
      const lumens = Number(prof?.lumens) || 0;
      const rPill = Utils.$("room-lumens-count");
      if (rPill) rPill.textContent = lumens.toLocaleString();
      const lPill = Utils.$("header-lumens-count");
      if (lPill) lPill.textContent = lumens.toLocaleString();
    }

    // MPA Routing Emulation
    if (pushState) {
      let path = "/";
      if (screenId === "auth-screen") path = "/login";
      if (screenId === "lobby-screen") path = "/lobby";
      if (screenId === "room-screen")
        path = `/room/${AppState.currentRoomId || "current"}`;
      window.history.pushState({ screenId }, "", path);
    }
  }

  static generateCryptoId(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  static async hashPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 10000,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );
    return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  }

  static debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // [ADD] File to Base64 (Compressed for performance/DB)
  static fileToBase64(file, maxWidth = 800) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width,
            h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // [ADD] Banner File to Base64 (Full HD quality - uncompressed lossless or 2560px QHD)
  static bannerFileToBase64(file) {
    return new Promise((resolve) => {
      if (!file) return resolve("");
      // For images up to 8MB, keep 100% original lossless data URL without downsampling/compression
      if (file.size && file.size <= 8 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
        return;
      }
      // For extremely massive files (>8MB), scale to pristine 2560px QHD at 0.95 quality
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width,
            h = img.height;
          const maxWidth = 2560;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
          resolve(canvas.toDataURL(mime, 0.95));
        };
        img.onerror = () => resolve("");
        img.src = e.target.result;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  static heartDistributionState = new WeakMap(); // [NEW]

  static getGreatestCommonDivisor(a, b) {
    // [NEW]
    while (b) {
      // [NEW]
      const next = a % b; // [NEW]
      a = b; // [NEW]
      b = next; // [NEW]
    } // [NEW]
    return Math.abs(a || 1); // [NEW]
  } // [NEW]

  static getDistributedHeartLeft(layer, key = "default") {
    // [NEW]
    const width = Math.max(1, layer?.clientWidth || window.innerWidth || 1); // [NEW]
    const columns = Math.max(6, Math.min(16, Math.floor(width / 92))); // [NEW]
    let layerState = this.heartDistributionState.get(layer); // [NEW]
    if (!layerState) {
      // [NEW]
      layerState = {}; // [NEW]
      if (layer) this.heartDistributionState.set(layer, layerState); // [NEW]
    } // [NEW]
    let state = layerState[key]; // [NEW]
    if (!state || state.columns !== columns) {
      // [NEW]
      let step = Math.max(2, Math.floor(columns / 2)); // [NEW]
      while (this.getGreatestCommonDivisor(step, columns) !== 1) step += 1; // [NEW]
      state = { columns, cursor: Math.floor(Math.random() * columns), step }; // [NEW]
      layerState[key] = state; // [NEW]
    } // [NEW]
    const slot = state.cursor; // [NEW]
    state.cursor = (state.cursor + state.step) % columns; // [NEW]
    const spread = 84 / columns; // [NEW]
    const jitter = (Math.random() - 0.5) * Math.min(spread * 0.45, 6); // [NEW]
    return Math.max(6, Math.min(94, 8 + slot * spread + spread / 2 + jitter)); // [NEW]
  } // [NEW]

  static injectFixes() {
    const style = document.createElement("style");
    style.innerHTML = `
            body {
                transition: background 1s ease, background-color 1s ease, filter 1s ease, transform 1s ease, color 1s ease, text-shadow 1s ease;
            }

            /* Анимация левитации */
            @keyframes levitate {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
            .glass-panel, .room-card, .user-card, .msg-bubble, .friend-item {
                animation: levitate 10s ease-in-out infinite;
                will-change: transform;
            }
            .room-card { animation-delay: 1s; }
            .user-card { animation-delay: 2s; }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Фикс размеров плеера и Ambilight стили */
            .video-container {
                position: relative;
                min-height: 35vh;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
            }
            #native-player {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                border-radius: 16px;
                background: #000;
                position: relative;
                z-index: 2;
                transition: box-shadow 0.3s ease;
            }

            /* Тосты - МАКСИМАЛЬНЫЙ Z-INDEX */
            #toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999 !important;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .toast {
                background: rgba(15,15,15,0.95);
                color: #fff;
                padding: 12px 20px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
                transition: opacity 0.3s ease;
                pointer-events: all;
                border: 1px solid var(--border-light);
                z-index: 999999 !important;
                animation: levitate 6s ease-in-out infinite;
            }

            /* Фикс мобильного скролла и UI */
            @media (max-width: 1024px) {
                .rooms-grid {
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch;
                    max-height: 70vh;
                    padding-bottom: 120px;
                    grid-template-columns: 1fr !important;
                    gap: 16px !important;
                }
                .room-card {
                    min-height: 200px;
                    width: 100%;
                }
                .room-preview {
                    height: 130px !important;
                    min-height: 130px;
                    flex-shrink: 0;
                }
                .room-info h4 {
                    white-space: normal !important;
                    line-height: 1.3;
                }
                .logo { font-size: 28px !important; font-weight: 900; letter-spacing: 2px; background: linear-gradient(90deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; text-align: center; display: inline-block; }
            }
            
            /* Бело-серый бейдж онлайна в лобби */
            #custom-online-badge {
                background: transparent;
                color: #aaa;
                font-size: 14px;
                font-weight: 600;
                padding: 10px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #custom-online-badge::before {
                content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: #aaa; box-shadow: 0 0 8px rgba(255,255,255,0.5);
            }
            .original-badge { display: none !important; }

            /* ПЛАШКИ РОЛЕЙ */
            .role-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 800;
                padding: 4px 10px;
                border-radius: 8px;
                margin-left: 8px;
                text-transform: uppercase;
                vertical-align: middle;
                letter-spacing: 0.5px;
                transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            .role-badge::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transform: translateX(-100%); transition: 0.5s; }
            .role-badge:hover { transform: translateY(-2px) scale(1.05); }
            .role-badge:hover::before { transform: translateX(100%); }
            
            .badge-creator {
                background: linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 107, 129, 0.2));
                color: #ff4757;
                border: 1px solid rgba(255, 71, 87, 0.5);
                box-shadow: 0 4px 12px rgba(255, 71, 87, 0.25);
            }
            .badge-moderator {
                background: linear-gradient(135deg, rgba(255, 165, 2, 0.2), rgba(255, 195, 18, 0.2));
                color: #ffa502;
                border: 1px solid rgba(255, 165, 2, 0.5);
                box-shadow: 0 4px 12px rgba(255, 165, 2, 0.25);
            }
            .badge-hybrid {
                background: linear-gradient(135deg, rgba(93, 63, 211, 0.2), rgba(125, 95, 255, 0.2));
                color: #8d63ff;
                border: 1px solid rgba(141, 99, 255, 0.5);
                box-shadow: 0 4px 12px rgba(141, 99, 255, 0.3);
            }

            /* СТИЛИ ФУТЕРА С ССЫЛКАМИ */
            #bottom-footer-links {
                position: fixed;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 16px;
                background: rgba(15, 15, 15, 0.75);
                backdrop-filter: blur(10px);
                padding: 8px 24px;
                border-radius: 20px;
                border: 1px solid var(--border-light);
                z-index: 9998;
                font-size: 13px;
                font-weight: 600;
            }
            #bottom-footer-links a {
                color: var(--text-muted);
                text-decoration: none;
                transition: color 0.2s ease, transform 0.2s ease;
            }
            #bottom-footer-links a:hover {
                color: var(--accent);
                transform: translateY(-2px);
            }
            @media (max-width: 768px) {
                #bottom-footer-links {
                    bottom: 70px;
                    padding: 6px 14px;
                    font-size: 11px;
                    gap: 12px;
                }
            }

            /* UI polish layer: outlines, motion, light-input fix */
            button,
            .primary-btn,
            .secondary-btn,
            .danger-btn,
            .dm-btn,
            .add-friend-btn,
            .btn-small {
                outline: 1px solid rgba(255, 255, 255, 0.22);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
                transition: transform 0.35s ease, box-shadow 0.45s ease, filter 0.45s ease, background 0.45s ease;
            }
            button:hover,
            .primary-btn:hover,
            .secondary-btn:hover,
            .danger-btn:hover,
            .dm-btn:hover,
            .add-friend-btn:hover,
            .btn-small:hover {
                transform: translateY(-1px) scale(1.02);
                box-shadow: 0 0 16px rgba(255, 255, 255, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.35) inset;
            }
            button:active {
                transform: scale(0.98);
                filter: brightness(0.95);
            }
            .theme-light-global input,
            .theme-light-global textarea,
            .theme-light-global select {
                color: #111 !important;
                background: rgba(250, 246, 238, 0.96) !important;
                border: 2px solid rgba(0, 0, 0, 0.62) !important;
            }
            .theme-light-global input::placeholder,
            .theme-light-global textarea::placeholder {
                color: rgba(0, 0, 0, 0.46) !important;
            }
            .theme-light-global body,
            body.theme-light-global {
                background:
                    radial-gradient(1100px 520px at 8% -10%, rgba(139, 170, 255, 0.18) 0%, rgba(139, 170, 255, 0) 62%),
                    radial-gradient(900px 460px at 102% 8%, rgba(124, 236, 255, 0.16) 0%, rgba(124, 236, 255, 0) 58%),
                    linear-gradient(135deg, #edf3fb 0%, #e8eff8 48%, #dfe9f5 100%) !important;
                color: #2e271d !important;
            }
            .theme-light-global,
            html.theme-light-global,
            html[data-global-theme="light"] {
                --bg: #e8edf4 !important;
                --panel: rgba(246, 251, 255, 0.88) !important;
                --panel-hover: rgba(238, 246, 255, 0.96) !important;
                --border: rgba(0, 0, 0, 0.25) !important;
                --border-light: rgba(0, 0, 0, 0.42) !important;
                --text-main: #1f1a13 !important;
                --text-muted: #4b4135 !important;
                --accent: #1f1a13 !important;
                --accent-hover: #000000 !important;
            }
            .theme-light-global #auth-screen,
            .theme-light-global #lobby-screen,
            .theme-light-global #room-screen,
            .theme-light-global .screen,
            body.theme-light-global #auth-screen,
            body.theme-light-global #lobby-screen,
            body.theme-light-global #room-screen,
            body.theme-light-global .screen {
                background: transparent !important;
                background-color: transparent !important;
            }
            .theme-light-global #particle-canvas,
            body.theme-light-global #particle-canvas {
                filter: contrast(1.12) saturate(1.08) brightness(0) !important;
                display: block !important;
            }
            #particle-canvas {
                position: fixed !important;
                inset: 0 !important;
                z-index: 0 !important;
                pointer-events: none !important;
            }
            #auth-screen, #lobby-screen, #room-screen { position: relative; z-index: 2; }
            .theme-light-global .glass-panel,
            .theme-light-global .room-card,
            .theme-light-global .user-item,
            .theme-light-global .friend-item,
            .theme-light-global .chat-section,
            .theme-light-global .player-section,
            .theme-light-global .modal-content {
                border: 2px solid rgba(0, 0, 0, 0.56) !important;
                background: linear-gradient(180deg, rgba(248,253,255,0.9) 0%, rgba(241,248,255,0.86) 100%) !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset, 0 12px 28px rgba(32, 66, 112, 0.12);
            }
            .theme-light-global .bubble,
            .theme-light-global .friend-request-item,
            .theme-light-global .room-info,
            .theme-light-global .perm-controls {
                border: 2px solid rgba(0, 0, 0, 0.48) !important;
                background: rgba(251, 254, 255, 0.9) !important;
            }
            .theme-light-global button,
            .theme-light-global .primary-btn,
            .theme-light-global .secondary-btn,
            .theme-light-global .danger-btn,
            .theme-light-global .dm-btn,
            .theme-light-global .add-friend-btn,
            .theme-light-global .btn-small {
                border: 2px solid rgba(0, 0, 0, 0.68) !important;
                outline: none !important;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.82) inset;
            }

            .room-card {
                transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
            }
            .room-card:hover {
                transform: translateY(-3px) scale(1.01);
                box-shadow: 0 10px 28px rgba(255, 255, 255, 0.16);
                border-color: rgba(255, 255, 255, 0.45);
            }
            .room-preview video {
                transition: transform 0.7s ease, filter 0.7s ease;
            }
            .room-card:hover .room-preview video {
                transform: scale(1.06);
                filter: saturate(1.15);
            }
            .room-meta .avatars-stack {
                display: inline-flex;
                align-items: center;
                margin-left: 6px;
            }
            .room-meta .stack-avatar {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.45);
                margin-left: -7px;
                overflow: visible;
                background: rgba(255,255,255,0.08);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
            }

            .profile-open-link {
                cursor: pointer;
                transition: color 0.2s ease, text-shadow 0.2s ease;
            }
            .profile-open-link:hover {
                color: var(--accent);
                text-shadow: 0 0 8px rgba(46, 213, 115, 0.45);
            }

            .voice-wave {
                display: inline-flex;
                gap: 2px;
                margin-left: 8px;
                vertical-align: middle;
            }
            .voice-wave i {
                width: 2px;
                height: 8px;
                border-radius: 8px;
                background: #ffffff;
                opacity: 0.35;
                animation: voiceWave 1.8s ease-in-out infinite;
            }
            .voice-wave i:nth-child(2) { animation-delay: 0.1s; }
            .voice-wave i:nth-child(3) { animation-delay: 0.2s; }
            .voice-wave i:nth-child(4) { animation-delay: 0.3s; }
            .user-item.speaking .voice-wave i {
                opacity: 1;
            }
            @keyframes voiceWave {
                0%, 100% { transform: scaleY(0.5); }
                50% { transform: scaleY(1.6); }
            }

            .godmode-modal .modal-content {
                width: 100vw !important;
                height: 100dvh !important;
                max-width: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                display: grid;
                grid-template-columns: 260px minmax(0, 1fr);
                gap: 0;
                background: radial-gradient(circle at top, rgba(255, 255, 255, 0.09), rgba(9, 9, 9, 0.98));
            }
            @media (max-width: 1024px) {
                .godmode-modal .modal-content {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto 1fr;
                }
                .godmode-sidebar {
                    flex-direction: row !important;
                    overflow-x: auto;
                    padding: 8px !important;
                    gap: 8px !important;
                    scrollbar-width: none; /* Firefox */
                }
                .godmode-sidebar::-webkit-scrollbar {
                    display: none; /* Safari and Chrome */
                }
                .godmode-sidebar button {
                    font-size: 11px !important;
                    padding: 6px 12px !important;
                    white-space: nowrap !important;
                }
                .godmode-main {
                    padding: 10px !important;
                    overflow-x: hidden !important;
                }
                .godmode-main [style*="grid-template-columns"] {
                    grid-template-columns: 1fr !important;
                }
                .godmode-main [style*="justify-content:space-between"] {
                    flex-wrap: wrap;
                }
            }
            .godmode-sidebar {
                border-right: 1px solid rgba(255, 255, 255, 0.25);
                background: rgba(7, 7, 7, 0.92);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .godmode-sidebar button {
                width: 100%;
                text-align: left;
                padding: 10px 12px;
                font-family: Consolas, Menlo, Monaco, monospace;
            }
            .admin-form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .admin-form-label {
                font-size: 12px;
                color: var(--text-muted);
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .admin-color-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 10px;
                margin-top: 10px;
            }
            .admin-color-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 10px;
                border: 1px solid var(--border-light);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.03);
            }
            .admin-color-field input[type="color"] {
                width: 100%;
                height: 38px;
                margin: 0;
                border-radius: 8px;
                padding: 2px;
                border: 1px solid var(--border-light);
            }
            .admin-editor-block {
                border: 1px solid var(--border-light);
                border-radius: 12px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.02);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .godmode-main {
                overflow: auto;
                padding: 20px;
            }
            .godmode-section {
                display: none;
            }
            .godmode-section.active {
                display: block;
                animation: fadeInUp 0.45s ease;
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
    document.head.appendChild(style);

    const originalBadge = document.querySelector(".online-counter-badge");
    if (originalBadge) originalBadge.classList.add("original-badge");

    const roomsMain = document.querySelector(".rooms-main");
    if (roomsMain) {
      const customBadge = document.createElement("div");
      customBadge.id = "custom-online-badge";
      customBadge.innerHTML = `Live актив: <span id="custom-online-count" style="color:var(--accent);">0</span>`;
      roomsMain.insertBefore(customBadge, roomsMain.firstChild);

      const updateLiveActive = async () => {
        try {
          const now = Date.now();
          if (!window._usersOnlineCache || now - (window._usersOnlineCacheTime || 0) > 120000) {
            const { get, ref } =
              await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
            const snap = await get(ref(window.db || db, "users"));
            let activeNow = 0;
            if (snap.exists()) {
              const usersData = snap.val();
              for (let uid in usersData) {
                if (usersData[uid]?.status?.online === true) activeNow++;
              }
            }
            window._usersOnlineCache = activeNow;
            window._usersOnlineCacheTime = now;
          }
          const el = document.getElementById("custom-online-count");
          if (el) el.innerText = window._usersOnlineCache ?? 0;
        } catch (e) {
          console.warn("Live active error", e);
        }
      };
      updateLiveActive();
      setInterval(updateLiveActive, 60000);
    }

    if (!Utils.hasInjectedAuthStyles) {
      Utils.hasInjectedAuthStyles = true;
    }
  }
}

window.Utils = Utils;
export { Utils };
