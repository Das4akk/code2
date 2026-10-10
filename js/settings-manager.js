/**
 * COWIO SettingsManager
 * Unified API for reading, writing, and dynamically applying application settings.
 */

class SettingsManager {
  static schema = {
    theme: {
      storageKey: "cowio:globalTheme",
      type: "string",
      default: "dark",
      apply: (val) => {
        const isLight = val === "light";
        document.documentElement.dataset.globalTheme = val;
        document.documentElement.classList.toggle("theme-light-global", isLight);
      }
    },
    particles: {
      storageKey: "siteParticles",
      type: "boolean",
      default: true,
      apply: (val) => {
        const canvas = document.getElementById("particle-canvas");
        if (canvas) {
          canvas.style.setProperty("display", val ? "block" : "none", "important");
        }
      }
    },
    particleBrightness: {
      storageKey: "siteParticleBrightness",
      type: "number",
      default: 1,
      apply: (val) => {
        const canvas = document.getElementById("particle-canvas");
        if (canvas) canvas.style.setProperty("opacity", String(val));
      }
    },
    neuroBackground: {
      storageKey: "siteNeuro",
      type: "boolean",
      default: true,
      apply: (val) => {
        const bg = document.getElementById("premium-black-bg");
        if (bg) bg.style.setProperty("display", val ? "block" : "none", "important");
      }
    },
    hideOnlineCounter: {
      storageKey: "hideOnlineCounter",
      type: "boolean",
      default: false,
      apply: (val) => {
        const counter = document.querySelector(".online-counter-badge");
        if (counter && counter.style) {
          counter.style.display = val ? "none" : "flex";
        }
      }
    },
    staticEmojis: {
      storageKey: "staticEmojis",
      type: "boolean",
      default: false,
      apply: (val) => {
        const useStatic = Boolean(val);
        window.__COWIO_USE_STATIC_EMOJIS = useStatic;
        document.documentElement.classList.toggle("use-static-emojis", useStatic);
        if (typeof window.applyStaticEmojisMode === "function") {
          window.applyStaticEmojisMode(useStatic);
        }
      }
    }
  };

  static listeners = new Map();

  /**
   * Retrieves a setting value from localStorage (with schema type parsing and default fallback).
   */
  static get(key) {
    const item = this.schema[key];
    if (!item) {
      return localStorage.getItem(key);
    }

    const raw = localStorage.getItem(item.storageKey);
    if (raw === null || raw === undefined) {
      return item.default;
    }

    if (item.type === "boolean") {
      return raw === "true";
    }
    if (item.type === "number") {
      const num = Number(raw);
      return isNaN(num) ? item.default : num;
    }
    return raw;
  }

  /**
   * Updates a setting in localStorage, executes its apply handler, and notifies listeners.
   */
  static set(key, value) {
    const item = this.schema[key];
    const storageKey = item ? item.storageKey : key;

    localStorage.setItem(storageKey, String(value));

    if (item && typeof item.apply === "function") {
      try {
        item.apply(value);
      } catch (err) {
        console.warn(`[SettingsManager] Error applying setting "${key}":`, err);
      }
    }

    if (this.listeners.has(key)) {
      for (const cb of this.listeners.get(key)) {
        try {
          cb(value);
        } catch (e) {}
      }
    }
  }

  /**
   * Applies all registered schema settings to the current DOM/environment.
   */
  static applyAll() {
    for (const [key, item] of Object.entries(this.schema)) {
      const val = this.get(key);
      if (typeof item.apply === "function") {
        try {
          item.apply(val);
        } catch (err) {
          console.warn(`[SettingsManager] Error applying setting "${key}":`, err);
        }
      }
    }
  }

  /**
   * Registers a change listener for a setting.
   */
  static onChange(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key)?.delete(callback);
  }
}

if (typeof window !== "undefined") {
  window.SettingsManager = SettingsManager;
}

export default SettingsManager;
