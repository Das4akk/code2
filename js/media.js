class MediaResolverClient {
  static apiBase =
    typeof window !== "undefined" && window.COWIO_MEDIA_API
      ? String(window.COWIO_MEDIA_API).replace(/\/$/, "")
      : "";

  static pending = new Map();
  static RESOLVE_STALE_MS = 12 * 60 * 1000;

  static PLATFORM_RE =
    /rutube\.ru|youtube\.com|youtu\.be|vk\.com|vkvideo\.ru|vimeo\.com|twitch\.tv/i;

  static needsResolve(url = "") {
    const value = String(url || "").trim();
    if (!value) return false;
    if (this.PLATFORM_RE.test(value)) return true;
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host.includes("rutube.ru");
    } catch {
      return false;
    }
  }

  static extractYouTubeId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/i,
    );
    if (match && match[1] && match[1].length >= 10) return match[1];
    return null;
  }

  static extractVkInfo(url) {
    if (!url || typeof url !== "string") return null;
    let clean = url.trim();
    const iframeSrc = clean.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeSrc) clean = iframeSrc[1];

    let oid = null;
    let vid = null;
    let hash = null;

    if (/video_ext\.php/i.test(clean)) {
      const mOid = clean.match(/[?&]oid=(-?\d+)/i);
      const mId = clean.match(/[?&]id=([A-Za-z0-9]+)/i);
      const mHash = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (mOid) oid = mOid[1];
      if (mId) vid = mId[1];
      if (mHash) hash = mHash[1];
    }

    if (!oid || !vid) {
      const vMatch = clean.match(/(?:video|clip)(-?\d+)_([A-Za-z0-9]+)/i);
      if (vMatch) {
        oid = vMatch[1];
        vid = vMatch[2];
      }
    }

    if (!oid || !vid) {
      const zMatch = clean.match(/[?&]z=video(-?\d+)_([A-Za-z0-9]+)/i);
      if (zMatch) {
        oid = zMatch[1];
        vid = zMatch[2];
      }
    }

    if (!hash) {
      const hashMatch = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (hashMatch) hash = hashMatch[1];
    }

    if (oid && vid) {
      const vkId = `${oid}_${vid}`;
      const embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}${hash ? `&hash=${hash}` : ""}&hd=2&autoplay=1&js_api=1`;
      return { oid, vid, hash, vkId, embedUrl };
    }

    if (/vk\.com|vkvideo\.ru|vk\.ru/i.test(clean)) {
      let embedUrl = clean;
      if (!embedUrl.includes("js_api=")) {
        embedUrl += (embedUrl.includes("?") ? "&" : "?") + "js_api=1&autoplay=1&hd=2";
      }
      return {
        oid: "",
        vid: "",
        hash: "",
        vkId: clean,
        embedUrl,
      };
    }

    return null;
  }

  static extractVkId(url) {
    const info = this.extractVkInfo(url);
    return info ? info.vkId : null;
  }

  static extractVimeoId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (match) return match[1];
    return null;
  }

  static extractTwitchId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/twitch\.tv\/([^?]+)/i);
    if (match && match[1] !== "videos") return match[1];
    return null;
  }

  static extractRutubeId(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(
      /rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/i,
    );
    if (match && match[1]) return match[1];
    return null;
  }

  static isDirectMedia(url = "") {
    return /\.(mp4|webm|m4v|mov|mkv|m3u8)(\?|#|$)/i.test(String(url || ""));
  }

  static getErrorMessage(code, fallback = "") {
    const map = {
      INVALID_URL: "Некорректная ссылка",
      UNSUPPORTED_URL: "Платформа не поддерживается",
      TIMEOUT: "Превышено время ожидания извлечения",
      EXTRACTION_FAILED: "Не удалось извлечь видео",
      BOT_PROTECTION: "Видео защищено на сайте. Попробуйте другой сервис.",
      RATE_LIMITED: "Слишком много запросов, попробуйте позже",
      NETWORK:
        "Backend выключен (node server.js). Без него извлечение видео невозможно.",
    };
    return map[code] || fallback || "Ошибка извлечения видео";
  }

  static setModalStatus(state = "idle", message = "") {
    const el = Utils.$("room-media-status");
    if (!el) return;
    el.dataset.state = state;
    el.className = `room-media-status state-${state}`;
    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
  }

  static async fetchVideoInfo(url) {
    const normalized = String(url || "").trim();
    if (!normalized) return null;
    try {
      const res = await fetch(`/api/video/info?url=${encodeURIComponent(normalized)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) return data;
      }
    } catch (e) {
      console.warn("[MediaResolver] fetchVideoInfo failed:", e);
    }
    return null;
  }

  static async autoFetchAndSetRoomName(url, notify = true) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return;
    if (!this.needsResolve(trimmed) && !this.isDirectMedia(trimmed)) return;

    const nameInput = Utils.$("room-input-name");
    const indicator = Utils.$("room-url-loading-indicator");
    const hint = Utils.$("room-name-autofill-hint");
    const statusText = Utils.$("room-fetch-status-text");

    if (indicator) indicator.style.display = "inline-flex";
    if (statusText) statusText.textContent = "Извлекаем название...";

    try {
      const info = await this.fetchVideoInfo(trimmed);
      if (info && info.title) {
        if (nameInput) {
          nameInput.value = info.title;
          nameInput.classList.remove("room-input-highlight");
          void nameInput.offsetWidth;
          nameInput.classList.add("room-input-highlight");
          setTimeout(() => nameInput.classList.remove("room-input-highlight"), 2500);
        }
        if (hint) {
          hint.style.display = "inline-flex";
          hint.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"><span>Скопировано: ${Utils.escapeHtml(info.platformLabel || info.platform || "Видео")}</span>`;
        }
        if (statusText) statusText.textContent = "Название скопировано!";
        this.setModalStatus(
          "success",
          `${info.platformLabel || info.platform || "Видео"}: ${info.title}`,
        );
        if (notify) {
          Utils.toast(`Название комнаты скопировано: "${info.title}"`, "info");
        }
      }
    } catch (err) {
      console.warn("[MediaResolver] autoFetchAndSetRoomName error:", err);
      if (statusText) statusText.textContent = "";
    } finally {
      if (indicator) indicator.style.display = "none";
    }
  }

  static bindRoomUrlInput() {
    const input = Utils.$("room-input-url");
    const previewBtn = Utils.$("btn-preview-media");
    const ytNote = Utils.$("yt-create-note");
    if (!input) return;

    const checkYt = () => {
      if (!ytNote) return;
      const url = input.value.trim();
      const isYt =
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/i.test(
          url,
        );
      ytNote.style.display = isYt ? "block" : "none";
    };

    const runPreview = Utils.debounce(async () => {
      const url = input.value.trim();
      if (!url) {
        this.setModalStatus("idle", "");
        return;
      }
      if (!this.needsResolve(url) && !this.isDirectMedia(url)) {
        this.setModalStatus("idle", "Ссылка будет сохранена как есть");
        return;
      }
      await this.autoFetchAndSetRoomName(url, false);
    }, 300);

    input.addEventListener("paste", () => {
      setTimeout(() => {
        const val = input.value.trim();
        if (val) {
          checkYt();
          this.autoFetchAndSetRoomName(val, true);
        }
      }, 25);
    });

    input.addEventListener("input", () => {
      checkYt();
      runPreview();
    });

    // Also check on init in case of edit mode
    const observer = new MutationObserver((mutations) => {
      if (input.value) checkYt();
    });
    observer.observe(Utils.$("modal-room"), {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (previewBtn) {
      previewBtn.onclick = async () => {
        const url = input.value.trim();
        if (!url) return Utils.toast("Вставьте ссылку на видео", "error");
        await this.autoFetchAndSetRoomName(url, true);
      };
    }

    RoomVideoSearchManager.init();
  }

  static async resolve(url) {
    const normalized = String(url || "").trim();
    if (!normalized) {
      throw Object.assign(new Error("Пустая ссылка"), { code: "INVALID_URL" });
    }
    if (this.pending.has(normalized)) return this.pending.get(normalized);

    const info = await this.fetchVideoInfo(normalized);

    const ytId = this.extractYouTubeId(normalized);
    if (ytId) {
      return {
        source: normalized,
        title: info?.title || "YouTube Video",
        author: info?.author || "YouTube",
        duration: 0,
        thumbnail: info?.thumbnail || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        platform: "youtube",
        isHls: false,
        ext: "youtube",
        resolvedAt: Date.now(),
      };
    }

    const rutubeId = this.extractRutubeId(normalized);
    if (rutubeId) {
      return {
        source: normalized,
        title: info?.title || "Rutube Video",
        author: info?.author || "Rutube",
        duration: 0,
        thumbnail: info?.thumbnail || `https://rutube.ru/api/video/${rutubeId}/thumbnail/?format=json`,
        platform: "rutube",
        isHls: false,
        ext: "rutube",
        resolvedAt: Date.now(),
      };
    }

    const vkInfo = this.extractVkInfo(normalized);
    if (vkInfo) {
      return {
        source: info?.url || vkInfo.embedUrl,
        title: info?.title || "VK Video",
        author: info?.author || "VK Video",
        duration: 0,
        thumbnail: info?.thumbnail || "",
        platform: "vk",
        isHls: false,
        ext: "vk",
        vkInfo,
        resolvedAt: Date.now(),
      };
    }

    const vimeoId = this.extractVimeoId(normalized);
    if (vimeoId) {
      return {
        source: `https://player.vimeo.com/video/${vimeoId}?api=1`,
        title: info?.title || "Vimeo Video",
        author: info?.author || "Vimeo",
        duration: 0,
        thumbnail: info?.thumbnail || "",
        platform: "vimeo",
        isHls: false,
        ext: "vimeo",
        resolvedAt: Date.now(),
      };
    }

    const twitchId = this.extractTwitchId(normalized);
    if (twitchId) {
      return {
        source: `https://player.twitch.tv/?channel=${twitchId}&parent=localhost`,
        title: info?.title || `Стрим ${twitchId}`,
        author: twitchId,
        duration: 0,
        thumbnail: info?.thumbnail || "",
        platform: "twitch",
        isHls: false,
        ext: "twitch",
        resolvedAt: Date.now(),
      };
    }

    if (info && info.title) {
      return {
        source: info.url || normalized,
        title: info.title,
        author: info.author || "",
        duration: 0,
        thumbnail: info.thumbnail || "",
        platform: info.platform || "external",
        isHls: /\.m3u8/i.test(info.url || normalized),
        ext: info.platform || "",
        resolvedAt: Date.now(),
      };
    }

    const task = (async () => {
      this.setModalStatus("loading", "Извлекаем поток через yt-dlp…");
      let response;
      try {
        response = await fetch(`${this.apiBase}/api/resolve-media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized }),
        });
      } catch {
        throw Object.assign(new Error(this.getErrorMessage("NETWORK")), {
          code: "NETWORK",
        });
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw Object.assign(new Error("Некорректный ответ media resolver"), {
          code: "EXTRACTION_FAILED",
        });
      }

      if (!response.ok || !payload?.success) {
        const code =
          payload?.code ||
          (response.status === 504 ? "TIMEOUT" : "EXTRACTION_FAILED");
        throw Object.assign(
          new Error(this.getErrorMessage(code, payload?.error)),
          { code },
        );
      }

      return {
        source: payload.source,
        title: payload.title || "",
        duration: Number(payload.duration) || 0,
        thumbnail: payload.thumbnail || "",
        platform: payload.platform || "unknown",
        isHls: Boolean(payload.isHls),
        ext: payload.ext || "",
        resolvedAt: Number(payload.resolvedAt) || Date.now(),
      };
    })();

    this.pending.set(normalized, task);
    try {
      return await task;
    } finally {
      this.pending.delete(normalized);
      const input = Utils.$("room-input-url");
      if (input && !input.value.trim()) this.setModalStatus("idle", "");
    }
  }

  static async buildRoomVideoFields(inputUrl) {
    const trimmed = String(inputUrl || "").trim();
    if (!trimmed) {
      return {
        videoUrl: "",
        videoSourceUrl: "",
        videoPlatform: "",
        videoIsHls: false,
        videoResolvedAt: 0,
        videoTitle: "",
        videoThumbnail: "",
      };
    }

    if (this.needsResolve(trimmed)) {
      const resolved = await this.resolve(trimmed);
      return {
        videoUrl: resolved.source,
        videoSourceUrl: trimmed,
        videoPlatform: resolved.platform,
        videoIsHls: resolved.isHls,
        videoResolvedAt: resolved.resolvedAt,
        videoTitle: resolved.title,
        videoThumbnail: resolved.thumbnail,
      };
    }

    return {
      videoUrl: trimmed,
      videoSourceUrl: trimmed,
      videoPlatform: this.isDirectMedia(trimmed) ? "direct" : "external",
      videoIsHls: /\.m3u8(\?|#|$)/i.test(trimmed),
      videoResolvedAt: Date.now(),
      videoTitle: "",
      videoThumbnail: "",
    };
  }

  static shouldRefreshResolved(room = {}) {
    const source = room.videoSourceUrl || "";
    if (!source || !this.needsResolve(source)) return false;
    const resolvedAt = Number(room.videoResolvedAt || 0);
    if (!resolvedAt) return true;
    return Date.now() - resolvedAt > this.RESOLVE_STALE_MS;
  }
}

class RoomVideoSearchManager {
  static currentPlatform = "all";
  static lastQuery = "";
  static isSearching = false;

  static init() {
    const searchInput = Utils.$("room-search-video-input");
    const searchBtn = Utils.$("btn-room-search-video");
    const chips = Utils.$("room-search-platform-chips");

    if (!searchInput) return;

    if (chips) {
      chips.querySelectorAll(".platform-chip").forEach((chip) => {
        chip.onclick = () => {
          chips.querySelectorAll(".platform-chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          this.currentPlatform = chip.dataset.platform || "all";
          const q = searchInput.value.trim();
          if (q.length >= 2) {
            this.search(q, this.currentPlatform);
          }
        };
      });
    }

    const doDebouncedSearch = Utils.debounce(() => {
      const q = searchInput.value.trim();
      if (q.length >= 2) {
        this.search(q, this.currentPlatform);
      } else if (!q) {
        this.clearResults();
      }
    }, 450);

    searchInput.addEventListener("input", doDebouncedSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q) this.search(q, this.currentPlatform);
      }
    });

    if (searchBtn) {
      searchBtn.onclick = () => {
        const q = searchInput.value.trim();
        if (q) this.search(q, this.currentPlatform);
      };
    }
  }

  static clearResults() {
    const resultsContainer = Utils.$("room-video-search-results");
    const loading = Utils.$("room-search-loading");
    const empty = Utils.$("room-search-empty");
    if (resultsContainer) {
      resultsContainer.style.display = "none";
      resultsContainer.innerHTML = "";
    }
    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "none";
  }

  static reset() {
    const searchInput = Utils.$("room-search-video-input");
    if (searchInput) searchInput.value = "";
    this.currentPlatform = "all";
    const chips = Utils.$("room-search-platform-chips");
    if (chips) {
      chips.querySelectorAll(".platform-chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.platform === "all");
      });
    }
    this.clearResults();
  }

  static async search(query, platform = "all") {
    const trimmed = String(query || "").trim();
    if (!trimmed) return;
    this.lastQuery = trimmed;

    const resultsContainer = Utils.$("room-video-search-results");
    const loading = Utils.$("room-search-loading");
    const empty = Utils.$("room-search-empty");

    if (loading) loading.style.display = "flex";
    if (empty) empty.style.display = "none";
    if (resultsContainer) resultsContainer.style.display = "none";

    try {
      const res = await fetch(
        `/api/video/search?q=${encodeURIComponent(trimmed)}&platform=${encodeURIComponent(platform)}`,
      );
      if (!res.ok) throw new Error("Ошибка поиска видео");
      const data = await res.json();
      const items = data.results || [];

      if (loading) loading.style.display = "none";

      if (!items.length) {
        if (empty) {
          empty.style.display = "flex";
          empty.innerHTML = `<span>По запросу «${Utils.escapeHtml(trimmed)}» ничего не найдено</span>`;
        }
        if (resultsContainer) resultsContainer.style.display = "none";
        return;
      }

      if (resultsContainer) {
        resultsContainer.innerHTML = "";
        items.forEach((item) => {
          const card = document.createElement("div");
          card.className = "video-search-card";
          card.dataset.url = item.url;
          card.dataset.title = item.title;
          card.dataset.platform = item.platform;

          let platformBadgeHtml = "";
          if (item.platform === "youtube") {
            platformBadgeHtml = `<span class="video-platform-badge badge-youtube" title="YouTube"><img src="https://cdn-icons-png.flaticon.com/128/1384/1384060.png" alt="YouTube" style="width: 14px; height: 14px; object-fit: contain; display: block;"></span>`;
          } else if (item.platform === "rutube") {
            platformBadgeHtml = `<span class="video-platform-badge badge-rutube" title="Rutube"><img src="https://static.rtbcdn.ru/static/img/favicon-icons/v3/icon_180x180.png" alt="Rutube" style="width: 13px; height: 13px; border-radius: 2px; object-fit: contain; display: block;"></span>`;
          } else if (item.platform === "vk") {
            platformBadgeHtml = `<span class="video-platform-badge badge-vk" title="VK Video"><img src="https://cdn-icons-png.flaticon.com/128/145/145813.png" alt="VK" style="width: 13px; height: 13px; border-radius: 2px; object-fit: contain; display: block;"></span>`;
          } else {
            platformBadgeHtml = `<span class="video-platform-badge">${Utils.escapeHtml(item.platformLabel || item.platform)}</span>`;
          }

          const durBadge = item.duration
            ? `<span class="video-search-dur">${Utils.escapeHtml(item.duration)}</span>`
            : "";

          const authorAvatarHtml = item.authorAvatar
            ? `<img src="${Utils.escapeHtml(item.authorAvatar)}" alt="" class="video-channel-avatar" onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Bust%20In%20Silhouette.webp';">`
            : `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Bust%20In%20Silhouette.webp" class="video-channel-avatar" style="border:none; background:transparent;" alt="">`;

          card.innerHTML = `
            <div class="video-search-thumb-wrap">
              <img src="${Utils.escapeHtml(item.thumbnail || "")}" alt="" class="video-search-thumb" loading="lazy" onerror="this.style.opacity='0.4'">
              ${durBadge}
              ${platformBadgeHtml}
            </div>
            <div class="video-search-details">
              <div class="video-search-title">${Utils.escapeHtml(item.title)}</div>
              <div class="video-search-author">${authorAvatarHtml}<span>${Utils.escapeHtml(item.author || item.platformLabel || "Автор неизвестен")}</span></div>
            </div>
            <button type="button" class="video-search-select-btn">Выбрать</button>
          `;

          card.onclick = () => {
            this.selectVideo(item, card);
          };

          resultsContainer.appendChild(card);
        });

        resultsContainer.style.display = "flex";
      }
    } catch (err) {
      console.warn("[RoomVideoSearch] search error:", err);
      if (loading) loading.style.display = "none";
      if (empty) {
        empty.style.display = "flex";
        empty.innerHTML = `<span>Не удалось получить результаты поиска. Проверьте соединение.</span>`;
      }
    }
  }

  static selectVideo(video, cardEl) {
    const urlInput = Utils.$("room-input-url");
    const nameInput = Utils.$("room-input-name");
    const hint = Utils.$("room-name-autofill-hint");

    if (urlInput) urlInput.value = video.url;
    if (nameInput) {
      nameInput.value = video.title;
      nameInput.classList.remove("room-input-highlight");
      void nameInput.offsetWidth;
      nameInput.classList.add("room-input-highlight");
      setTimeout(() => nameInput.classList.remove("room-input-highlight"), 2500);
    }
    if (hint) {
      hint.style.display = "inline-flex";
      hint.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"><span>Скопировано: ${Utils.escapeHtml(video.platformLabel || video.platform || "Видео")}</span>`;
    }

    const resultsContainer = Utils.$("room-video-search-results");
    if (resultsContainer) {
      resultsContainer.querySelectorAll(".video-search-card").forEach((c) => {
        c.classList.remove("selected");
        const btn = c.querySelector(".video-search-select-btn");
        if (btn) btn.textContent = "Выбрать";
      });
      if (cardEl) {
        cardEl.classList.add("selected");
        const btn = cardEl.querySelector(".video-search-select-btn");
        if (btn) btn.textContent = "✓ Выбрано";
      }
    }

    MediaResolverClient.setModalStatus(
      "success",
      `${video.platformLabel || video.platform || "Видео"}: ${video.title}`,
    );
    Utils.toast(`✨ Выбрано: "${video.title}". Название и ссылка скопированы!`, "info");

    const ytNote = Utils.$("yt-create-note");
    if (ytNote) {
      ytNote.style.display = video.platform === "youtube" ? "block" : "none";
    }
  }
}

window.MediaResolverClient = MediaResolverClient;
window.RoomVideoSearchManager = RoomVideoSearchManager;
export { MediaResolverClient, RoomVideoSearchManager };
