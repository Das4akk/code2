// FPS counter - visible ONLY to user @developer
(function () {
  class FpsCounter {
    static el = null;
    static isRunning = false;
    static rafId = null;
    static frameCount = 0;
    static lastTime = performance.now();
    static lastFps = 60;

    static isDeveloperUser() {
      try {
        const uid = window.AppState?.currentUser?.uid;
        if (!uid) return false;

        const profile =
          window.AppState?.usersCache?.get(uid) ||
          window.AppState?.myProfile ||
          {};

        const cleanUsername = String(
          profile.username ||
            profile.name ||
            window.AppState?.currentUser?.displayName ||
            "",
        )
          .toLowerCase()
          .trim()
          .replace(/^@/, "");

        if (cleanUsername === "developer") return true;

        if (
          window.AdminPanel &&
          typeof window.AdminPanel.isCurrentUserCreator === "function"
        ) {
          if (window.AdminPanel.isCurrentUserCreator()) return true;
        }

        if (
          window.AdminPanel &&
          typeof window.AdminPanel.isCreatorProfile === "function"
        ) {
          if (window.AdminPanel.isCreatorProfile(profile, uid)) return true;
        }

        return false;
      } catch (e) {
        return false;
      }
    }

    static checkAndToggle() {
      if (this.isDeveloperUser()) {
        this.start();
      } else {
        this.stop();
      }
    }

    static createEl() {
      if (this.el) return this.el;
      let el = document.getElementById("dev-fps-counter");
      if (!el) {
        el = document.createElement("div");
        el.id = "dev-fps-counter";
        el.style.cssText = `
          position: fixed;
          bottom: 16px;
          right: 18px;
          z-index: 999999;
          display: none;
          align-items: center;
          gap: 7px;
          background: rgba(12, 12, 16, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          padding: 5px 12px 5px 10px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          user-select: none;
          pointer-events: auto;
          cursor: default;
          transition: opacity 0.2s ease, transform 0.2s ease;
        `;
        el.title = "Тестовый счетчик FPS (виден только @developer)";
        document.body.appendChild(el);
      }
      this.el = el;
      return this.el;
    }

    static start() {
      if (this.isRunning) return;
      this.createEl();
      if (!this.el) return;

      this.isRunning = true;
      this.el.style.display = "inline-flex";
      this.frameCount = 0;
      this.lastTime = performance.now();
      this.updateView(60);

      const loop = (now) => {
        if (!this.isRunning) return;
        this.frameCount++;
        const delta = now - this.lastTime;
        if (delta >= 500) {
          const fps = Math.min(240, Math.round((this.frameCount * 1000) / delta));
          this.lastFps = fps;
          this.frameCount = 0;
          this.lastTime = now;
          this.updateView(fps);
        }
        this.rafId = requestAnimationFrame(loop);
      };

      this.rafId = requestAnimationFrame(loop);
    }

    static stop() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.el) {
        this.el.style.display = "none";
      }
    }

    static updateView(fps) {
      if (!this.el) return;
      const color = fps >= 55 ? "#2ed573" : fps >= 30 ? "#ffa502" : "#ff4757";
      this.el.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${color};"></span>
        <span style="color:${color}; font-variant-numeric:tabular-nums; font-family:monospace; font-size:12px; font-weight:800;">${fps}</span>
        <span style="color:rgba(255,255,255,0.45); font-size:9.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">FPS</span>
        <span style="color:rgba(255,255,255,0.3); font-size:9px; border-left:1px solid rgba(255,255,255,0.12); padding-left:6px; margin-left:2px;">@developer</span>
      `;
    }
  }

  window.FpsCounter = FpsCounter;

  // Periodic check & auth change listener
  setInterval(() => {
    FpsCounter.checkAndToggle();
  }, 2000);

  // Hook into DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      FpsCounter.checkAndToggle();
    });
  } else {
    FpsCounter.checkAndToggle();
  }
})();
