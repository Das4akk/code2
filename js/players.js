class VkPlayerManager {
  static player = null;
  static iframe = null;
  static currentTime = 0;
  static duration = 0;
  static state = "unstarted";
  static isReady = false;
  static onStateChange = null;
  static pendingActions = [];
  static _initPingTimer = null;

  static destroy() {
    if (this._initPingTimer) {
      clearInterval(this._initPingTimer);
      this._initPingTimer = null;
    }
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.player = null;
    this.currentTime = 0;
    this.duration = 0;
    this.state = "unstarted";
    this.isReady = false;
    this.pendingActions = [];
    window.removeEventListener("message", this.handleMessage);
  }

  static post(method, params = {}) {
    if (!this.iframe || !this.iframe.contentWindow) return;
    const payload = { method, ...params };
    try {
      this.iframe.contentWindow.postMessage(payload, "*");
    } catch {}
    try {
      this.iframe.contentWindow.postMessage(JSON.stringify(payload), "*");
    } catch {}
  }

  static handleMessage = (e) => {
    try {
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;

      const evt = data.event || data.type || data.method;
      if (!evt) return;

      if (evt === "inited" || evt === "ready" || evt === "init") {
        this.isReady = true;
        if (this._initPingTimer) {
          clearInterval(this._initPingTimer);
          this._initPingTimer = null;
        }
        this.flushPendingActions();

        RoomManager.applyLocalPermissions();

        if (AppState.lastKnownSyncState) {
          const sync = AppState.lastKnownSyncState;
          const targetTime = Number(sync.time) || 0;
          if (targetTime > 0) {
            this.seek(targetTime);
          }
          const currentRoom = AppState.roomsCache?.get(AppState.currentRoomId) || AppState.currentRoomData || {};
          const pres = AppState.currentPresenceCache || currentRoom.presence || {};
          const otherUsers = Object.keys(pres).filter(u => u !== AppState.currentUser?.uid);
          const hostId = currentRoom.hostId || AppState.currentRoomData?.hostId;
          const isHostInRoom = hostId ? Boolean(pres[hostId]) : false;
          const preventAutoplay = !AppState.isHost && (otherUsers.length === 0 || !isHostInRoom || AppState.enteredEmptyRoomAsNonHost);

          if (sync.state === "paused" || preventAutoplay) {
            this.pause();
          } else if (sync.state === "playing") {
            this.play();
          }
        }
        return;
      }

      const prevTime = this.currentTime;
      if (typeof data.time === "number") {
        this.currentTime = data.time;
      }
      if (typeof data.duration === "number") {
        this.duration = data.duration;
      }

      // Check if seek event occurred or time jumped abnormally
      const isSeekEvent = evt === "seeked" || evt === "seek";
      const isTimeJump =
        typeof data.time === "number" &&
        Math.abs(data.time - prevTime) > 2.0 &&
        this.state !== "unstarted";

      if (isSeekEvent || isTimeJump) {
        if (typeof this.onStateChange === "function") {
          this.onStateChange("seeked", this.currentTime);
        }
      }

      let newState = null;
      if (
        evt === "started" ||
        evt === "resumed" ||
        evt === "play" ||
        evt === "playing"
      ) {
        newState = "playing";
      } else if (evt === "paused" || evt === "pause") {
        newState = "paused";
      } else if (evt === "ended") {
        newState = "ended";
      }

      if (newState) {
        this.state = newState;
        if (typeof this.onStateChange === "function") {
          this.onStateChange(newState, this.currentTime);
        }
      }
    } catch {}
  };

  static flushPendingActions() {
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions.shift();
      try {
        action();
      } catch {}
    }
  }

  static initPlayer(src, onStateChangeCallback) {
    this.destroy();
    this.onStateChange = onStateChangeCallback;

    const container = Utils.$("yt-player");
    if (!container) return Promise.resolve(null);
    container.innerHTML = "";

    let finalSrc = src;
    if (!finalSrc.includes("js_api=")) {
      finalSrc += (finalSrc.includes("?") ? "&" : "?") + "js_api=1";
    }
    if (!finalSrc.includes("autoplay=")) {
      finalSrc += "&autoplay=0";
    }
    if (!finalSrc.includes("hd=")) {
      finalSrc += "&hd=2";
    }

    this.iframe = document.createElement("iframe");
    this.iframe.id = "vk-player-iframe";
    this.iframe.src = finalSrc;
    this.iframe.frameBorder = "0";
    this.iframe.setAttribute("allowfullscreen", "true");
    this.iframe.setAttribute(
      "allow",
      "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write;",
    );
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    this.iframe.style.borderRadius = "16px";
    this.iframe.style.border = "none";

    const hasControl = RoomManager.hasPerm("player");
    this.iframe.style.pointerEvents = hasControl ? "auto" : "none";

    const overlay = Utils.$("room-video-overlay");
    if (overlay) {
      overlay.style.pointerEvents = hasControl ? "none" : "auto";
      overlay.style.cursor = hasControl ? "default" : "not-allowed";
    }

    window.addEventListener("message", this.handleMessage);

    let pingCount = 0;
    const sendInit = () => {
      this.post("init");
      pingCount++;
      if (pingCount > 12 && this._initPingTimer) {
        clearInterval(this._initPingTimer);
        this._initPingTimer = null;
        if (!this.isReady) {
          this.isReady = true;
          this.flushPendingActions();
        }
      }
    };

    this.iframe.onload = () => {
      sendInit();
      if (!this.isReady && !this._initPingTimer) {
        this._initPingTimer = setInterval(sendInit, 400);
      }
    };

    container.appendChild(this.iframe);

    this.player = {
      postMessage: (method, args) => this.post(method, args),
      setVolume: (vol) => this.setVolume(vol),
      seek: (time) => this.seek(time),
      play: () => this.play(),
      pause: () => this.pause(),
      setQuality: (q) => this.setQuality(q),
      getState: () => this.getState(),
      getCurrentTime: () => this.getCurrentTime(),
      getDuration: () => this.getDuration(),
    };
    return Promise.resolve(this.player);
  }

  static play() {
    if (!RoomManager.hasPerm("player") && !window._isSyncingVideo) return;
    this.state = "playing";
    if (!this.isReady) {
      this.pendingActions.push(() => this.play());
      return;
    }
    this.post("play");
  }

  static pause() {
    if (!RoomManager.hasPerm("player") && !window._isSyncingVideo) return;
    this.state = "paused";
    if (!this.isReady) {
      this.pendingActions.push(() => this.pause());
      return;
    }
    this.post("pause");
  }

  static seek(time) {
    if (!RoomManager.hasPerm("player") && !window._isSyncingVideo) return;
    const t = Math.max(0, Number(time) || 0);
    this.currentTime = t;
    if (!this.isReady) {
      this.pendingActions.push(() => this.seek(t));
      return;
    }
    this.post("seek", { time: t });
  }

  static setVolume(volume) {
    const vol = Math.max(0, Math.min(1, Number(volume)));
    this.post("set_volume", { volume: vol });
  }

  static setQuality(quality) {
    if (!RoomManager.hasPerm("player") && !window._isSyncingVideo) return;
    this.post("set_quality", { quality: String(quality) });
  }

  static getCurrentTime() {
    return this.currentTime || 0;
  }

  static getDuration() {
    return this.duration || 0;
  }

  static getState() {
    return this.state;
  }
}
window.VkPlayerManager = VkPlayerManager;

class VimeoPlayerManager {
  static player = null;
  static iframe = null;
  static currentTime = 0;
  static duration = 0;
  static state = "unstarted";
  static onStateChange = null;

  static destroy() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.player = null;
    this.currentTime = 0;
    this.duration = 0;
    this.state = "unstarted";
    this.onStateChange = null;
    window.removeEventListener("message", this.handleMessage);
  }

  static handleMessage = (e) => {
    try {
      let data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (!data || typeof data !== "object") return;
      if (data.event === "playProgress") {
        if (data.data) {
          if (typeof data.data.seconds === "number") this.currentTime = data.data.seconds;
          if (typeof data.data.duration === "number") this.duration = data.data.duration;
        }
      } else if (data.event === "play") {
        this.state = "playing";
        if (this.onStateChange) this.onStateChange("playing", this.currentTime);
      } else if (data.event === "pause") {
        this.state = "paused";
        if (this.onStateChange) this.onStateChange("paused", this.currentTime);
      } else if (data.event === "finish") {
        this.state = "ended";
        if (this.onStateChange) this.onStateChange("ended", this.currentTime);
      }
    } catch {}
  };

  static initPlayer(src, onStateChangeCallback) {
    this.destroy();
    this.onStateChange = onStateChangeCallback;
    const container = Utils.$("yt-player");
    container.innerHTML = "";
    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.frameBorder = "0";
    this.iframe.allow = "autoplay; fullscreen; picture-in-picture";
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    container.appendChild(this.iframe);
    window.addEventListener("message", this.handleMessage);

    this.player = {
      postMessage: (method, value) => {
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage(
            JSON.stringify({ method, value }),
            "*",
          );
        }
      },
      getState: () => this.getState(),
      getCurrentTime: () => this.getCurrentTime(),
      getDuration: () => this.getDuration(),
      play: () => this.play(),
      pause: () => this.pause(),
      seek: (time) => this.seek(time),
    };
    return Promise.resolve(this.player);
  }
  static play() {
    this.state = "playing";
    if (this.player) this.player.postMessage("play");
  }
  static pause() {
    this.state = "paused";
    if (this.player) this.player.postMessage("pause");
  }
  static seek(time) {
    if (this.player) this.player.postMessage("seekTo", time);
  }
  static getCurrentTime() {
    return this.currentTime || 0;
  }
  static getDuration() {
    return this.duration || 0;
  }
  static getState() {
    return this.state;
  }
}
window.VimeoPlayerManager = VimeoPlayerManager;

class TwitchPlayerManager {
  static player = null;
  static iframe = null;
  static initPlayer(src) {
    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    const container = Utils.$("yt-player");
    container.innerHTML = "";
    container.appendChild(this.iframe);
    this.player = {};
    return Promise.resolve(this.player);
  }
}
window.TwitchPlayerManager = TwitchPlayerManager;

class RutubePlayerManager {
  static player = null;
  static apiReady = false;
  static iframe = null;
  static currentTime = 0;
  static duration = 0;
  static state = "unstarted";
  static onStateChange = null;

  static destroy() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.player = null;
    this.currentTime = 0;
    this.duration = 0;
    this.state = "unstarted";
    this.onStateChange = null;
    window.removeEventListener("message", this.handleMessage);
  }

  static handleMessage = (e) => {
    try {
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;

      const type = data.type || data.event;
      const payload = data.data || {};

      if (type === "player:currentTime") {
        if (typeof payload.time === "number") {
          this.currentTime = payload.time;
        }
        if (typeof payload.duration === "number") {
          this.duration = payload.duration;
        }
      } else if (type === "player:duration" || type === "player:changeDuration") {
        if (typeof payload.duration === "number") {
          this.duration = payload.duration;
        } else if (typeof payload.time === "number") {
          this.duration = payload.time;
        }
      } else if (type === "player:stateChange" || type === "player:changeState") {
        const rawState = payload.state || data.state;
        let normState = rawState;
        if (rawState === "playing" || rawState === "play") normState = "playing";
        else if (rawState === "paused" || rawState === "pause") normState = "paused";
        else if (rawState === "stopped" || rawState === "ended") normState = "ended";
        this.state = normState;
        if (this.onStateChange) this.onStateChange(normState, this.currentTime);
      }
    } catch {}
  };

  static initPlayer(rutubeId, onStateChangeCallback) {
    this.destroy();
    this.onStateChange = onStateChangeCallback;
    const container = Utils.$("yt-player");
    container.innerHTML = "";
    this.iframe = document.createElement("iframe");
    this.iframe.src = `https://rutube.ru/play/embed/${rutubeId}/?autoStart=false`;
    this.iframe.frameBorder = "0";
    this.iframe.allow = "clipboard-write; autoplay";
    this.iframe.webkitAllowFullScreen = true;
    this.iframe.mozallowfullscreen = true;
    this.iframe.allowFullscreen = true;
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    container.appendChild(this.iframe);

    window.addEventListener("message", this.handleMessage);

    this.player = {
      postMessage: (type, data) => {
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage(
            JSON.stringify({ type, data }),
            "*",
          );
        }
      },
      getState: () => this.getState(),
      getCurrentTime: () => this.getCurrentTime(),
      getDuration: () => this.getDuration(),
      play: () => this.play(),
      pause: () => this.pause(),
      seek: (time) => this.seek(time),
    };

    return Promise.resolve(this.player);
  }

  static play() {
    if (this.player) this.player.postMessage("player:play", {});
  }

  static pause() {
    if (this.player) this.player.postMessage("player:pause", {});
  }

  static getState() {
    return this.state || "unstarted";
  }

  static getDuration() {
    return this.duration || 0;
  }

  static seek(time) {
    if (this.player) this.player.postMessage("player:setCurrentTime", { time });
  }

  static getCurrentTime() {
    return this.currentTime || 0;
  }

  static setVolume(vol) {
    if (this.player)
      this.player.postMessage("player:setVolume", { volume: vol });
  }
}
window.RutubePlayerManager = RutubePlayerManager;

class YouTubePlayerManager {
  static player = null;
  static apiReady = false;

  static _loadPromise = null;
  static loadApi() {
    if (window.YT && window.YT.Player) {
      this.apiReady = true;
      return Promise.resolve();
    }
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(check);
          this.apiReady = true;
          resolve();
        }
      }, 100);
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
    return this._loadPromise;
  }

  static async initPlayer(videoId, onStateChange) {
    await this.loadApi();
    return new Promise((resolve) => {
      if (this.player && this.playerReady) {
        try {
          const currentRoom = AppState.roomsCache?.get(AppState.currentRoomId) || AppState.currentRoomData || {};
          const pres = AppState.currentPresenceCache || currentRoom.presence || {};
          const otherUsers = Object.keys(pres).filter(u => u !== AppState.currentUser?.uid);
          const hostId = currentRoom.hostId || AppState.currentRoomData?.hostId;
          const isHostInRoom = hostId ? Boolean(pres[hostId]) : false;
          const preventAutoplay = !AppState.isHost && (otherUsers.length === 0 || !isHostInRoom || AppState.enteredEmptyRoomAsNonHost);

          if (preventAutoplay && typeof this.player.cueVideoById === "function") {
            this.player.cueVideoById(videoId);
          } else {
            this.player.loadVideoById(videoId);
            if (preventAutoplay && typeof this.player.pauseVideo === "function") {
              this.player.pauseVideo();
            }
          }
          this.player.getIframe().style.pointerEvents = "auto";
          setTimeout(
            () =>
              typeof RoomManager !== "undefined" &&
              RoomManager.forceSyncVideo(),
            800,
          );
        } catch (e) {
          console.error("Failed to load video on existing player", e);
        }
        resolve(this.player);
      } else {
        this.playerReady = false;
        this.player = new window.YT.Player("yt-player", {
          videoId: videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.playerReady = true;
              try {
                this.player.getIframe().style.pointerEvents = "auto";
              } catch (e) {}
              const currentRoom = AppState.roomsCache?.get(AppState.currentRoomId) || AppState.currentRoomData || {};
              const pres = AppState.currentPresenceCache || currentRoom.presence || {};
              const otherUsers = Object.keys(pres).filter(u => u !== AppState.currentUser?.uid);
              const hostId = currentRoom.hostId || AppState.currentRoomData?.hostId;
              const isHostInRoom = hostId ? Boolean(pres[hostId]) : false;
              const preventAutoplay = !AppState.isHost && (otherUsers.length === 0 || !isHostInRoom || AppState.enteredEmptyRoomAsNonHost);
              if (preventAutoplay && typeof this.player.pauseVideo === "function") {
                try { this.player.pauseVideo(); } catch (e) {}
              }
              setTimeout(() => {
                if (typeof RoomManager !== "undefined")
                  RoomManager.forceSyncVideo();
              }, 400);
              resolve(this.player);
            },
            onStateChange: (e) => onStateChange(e),
            onError: (e) => {
              console.error("YouTube Player Error:", e.data);
              Utils.toast(
                e.data === 150
                  ? "Владелец видео запретил его воспроизведение на других сайтах"
                  : "Ошибка YouTube плеера (Код " + e.data + ")",
                "error",
              );
              resolve(this.player);
            },
          },
        });
      }
    });
  }

  static play() {
    if (this.player && this.playerReady && this.player.playVideo)
      this.player.playVideo();
  }
  static pause() {
    if (this.player && this.playerReady && this.player.pauseVideo)
      this.player.pauseVideo();
  }
  static getState() {
    if (!this.player || !this.playerReady || !this.player.getPlayerState)
      return null;
    const state = this.player.getPlayerState();
    if (window.YT && window.YT.PlayerState) {
      if (state === window.YT.PlayerState.PLAYING) return "playing";
      if (state === window.YT.PlayerState.PAUSED) return "paused";
      if (state === window.YT.PlayerState.ENDED) return "ended";
      if (state === window.YT.PlayerState.BUFFERING) return "buffering";
    }
    if (state === 1) return "playing";
    if (state === 2) return "paused";
    if (state === 0) return "ended";
    if (state === 3) return "buffering";
    return null;
  }
  static seek(time) {
    if (this.player && this.playerReady && this.player.seekTo)
      this.player.seekTo(time, true);
  }
  static getCurrentTime() {
    return this.player && this.playerReady && this.player.getCurrentTime
      ? this.player.getCurrentTime()
      : 0;
  }
  static getDuration() {
    return this.player && this.playerReady && typeof this.player.getDuration === "function"
      ? (this.player.getDuration() || 0)
      : 0;
  }
  static destroy() {
    this.playerReady = false;
    if (this.player && typeof this.player.destroy === "function") {
      try {
        this.player.destroy();
      } catch (e) {}
      this.player = null;
    }
    const container = document.getElementById("yt-player-container");
    if (container) {
      container.innerHTML =
        '<div id="yt-player" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; aspect-ratio: 16/9; display: flex; justify-content: center; align-items: center;"></div>';
    }
  }
}
window.YouTubePlayerManager = YouTubePlayerManager;

class VideoPlaybackManager {
  static hlsInstance = null;
  static lastSignature = "";

  static getPlaybackSignature(room = {}) {
    return [
      room.videoUrl || "",
      room.videoSourceUrl || "",
      room.videoResolvedAt || "",
      room.videoIsHls ? "1" : "0",
    ].join("|");
  }

  static destroy() {
    const vid = Utils.$("native-player");
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch {
        /* ignore */
      }
      this.hlsInstance = null;
    }
    if (vid) {
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
      delete vid.dataset.playbackKey;
      delete vid.dataset.roomUrl;
      vid.onerror = null;
    }
    YouTubePlayerManager.destroy();
    RutubePlayerManager.destroy();
    VkPlayerManager.destroy();
    this.lastSignature = "";
    Ambilight.stop();
  }

  static detach(vid) {
    if (!vid) return;
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch {
        /* ignore */
      }
      this.hlsInstance = null;
    }
    vid.pause();
    vid.removeAttribute("src");
    vid.load();
    delete vid.dataset.playbackKey;
    delete vid.dataset.roomUrl;
    vid.onerror = null;

    YouTubePlayerManager.destroy();
    RutubePlayerManager.destroy();
    VkPlayerManager.destroy();
    this.lastSignature = "";
    Ambilight.stop();
    if (Utils.$("yt-player-container"))
      Utils.$("yt-player-container").style.display = "none";
    vid.style.display = "block";
  }

  static async resolvePlaybackSource(room = {}) {
    const sourceUrl = String(room.videoSourceUrl || room.videoUrl || "").trim();
    const playbackUrl = String(room.videoUrl || "").trim();

    if (!sourceUrl) return { source: "", isHls: false };

    if (MediaResolverClient.shouldRefreshResolved(room)) {
      Utils.toast("Обновляем ссылку на поток…", "info");
      const fresh = await MediaResolverClient.resolve(sourceUrl);
      return { source: fresh.source, isHls: fresh.isHls, meta: fresh };
    }

    if (MediaResolverClient.needsResolve(sourceUrl)) {
      if (playbackUrl) {
        return {
          source: playbackUrl,
          isHls:
            Boolean(room.videoIsHls) || /\.m3u8(\?|#|$)/i.test(playbackUrl),
        };
      }
      const resolved = await MediaResolverClient.resolve(sourceUrl);
      return { source: resolved.source, isHls: resolved.isHls, meta: resolved };
    }

    return {
      source: playbackUrl || sourceUrl,
      isHls:
        Boolean(room.videoIsHls) ||
        /\.m3u8(\?|#|$)/i.test(playbackUrl || sourceUrl),
    };
  }

  static attachSource(vid, source, isHls) {
    this.detach(vid);
    if (!source) return;

    const useHls = isHls || /\.m3u8(\?|#|$)/i.test(source);
    if (useHls && window.Hls && window.Hls.isSupported()) {
      this.hlsInstance = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 600,
        maxMaxBufferLength: 2400,
        maxBufferSize: 600 * 1024 * 1024,
        backBufferLength: 300,
        autoStartLoad: true,
        startLevel: -1,
        startFragPrefetch: true,
        fragLoadingTimeOut: 40000,
        manifestLoadingTimeOut: 40000,
        levelLoadingTimeOut: 40000,
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 10,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        enableSoftwareAES: true,
        capLevelToPlayerSize: false,

        levelLoadingTimeOut: 30000,
      });
      this.hlsInstance.loadSource(source);
      this.hlsInstance.attachMedia(vid);
      this.hlsInstance.on(window.Hls.Events.ERROR, (_evt, data) => {
        if (data && data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              Utils.toast(
                "Сетевая ошибка потока (вероятно CORS или недоступен сервер). Пробую восстановить...",
                "warn",
              );
              this.hlsInstance.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              Utils.toast("Медиа ошибка HLS, пробую восстановить...", "warn");
              this.hlsInstance.recoverMediaError();
              break;
            default:
              Utils.toast("Критическая ошибка HLS-потока", "error");
              this.hlsInstance.destroy();
              break;
          }
        }
      });
      return;
    }

    if (useHls && vid.canPlayType("application/vnd.apple.mpegurl")) {
      vid.src = source;
      vid.load();
      return;
    }

    if (useHls) {
      Utils.toast("HLS не поддерживается в этом браузере", "error");
      return;
    }

    vid.src = source;
    vid.load();
  }

  static async applyRoomVideo(room = {}) {
    const vid = Utils.$("native-player");
    if (!vid) return;

    vid.onloadedmetadata = () => {
      if (typeof RoomManager !== "undefined") RoomManager.forceSyncVideo();
    };

    const signature = this.getPlaybackSignature(room);
    let ytId = MediaResolverClient.extractYouTubeId(
      room.videoSourceUrl || room.videoUrl,
    );
    const rtId = MediaResolverClient.extractRutubeId(
      room.videoSourceUrl || room.videoUrl,
    );
    const vkInfo = MediaResolverClient.extractVkInfo(
      room.videoSourceUrl || room.videoUrl,
    );

    if (rtId && window.AppState && window.AppState.useProxy) {
      window.AppState.wasProxyEnabled = true;
      window.AppState.useProxy = false;
      Utils.toast("Прокси отключен для Rutube", "info");
    } else if (!rtId && window.AppState && window.AppState.wasProxyEnabled) {
      window.AppState.useProxy = true;
      window.AppState.wasProxyEnabled = false;
      Utils.toast("Прокси снова включен", "info");
    }

    if (ytId && window.AppState && window.AppState.useProxy) {
      try {
        const res = await fetch(`/api/proxy/yt/streams/${ytId}`);
        const data = await res.json();
        if (data.hls) {
          room.videoSourceUrl = `/api/proxy/stream?url=${encodeURIComponent(data.hls)}`;
          room.isHls = true;
          ytId = null;
        } else if (data.videoStreams && data.videoStreams.length > 0) {
          const stream =
            data.videoStreams.find((s) => s.quality === "1080p") ||
            data.videoStreams[0];
          room.videoSourceUrl = `/api/proxy/stream?url=${encodeURIComponent(stream.url)}`;
          room.isHls = false;
          ytId = null;
        }
      } catch (e) {
        console.error("Failed to proxy youtube", e);
      }
    }

    if (
      signature === this.lastSignature &&
      (vid.dataset.playbackKey ||
        (YouTubePlayerManager.player && ytId) ||
        (RutubePlayerManager.player && rtId) ||
        (VkPlayerManager.player && vkInfo))
    )
      return;

    try {
      if (ytId || rtId || vkInfo) {
        this.detach(vid);
        this.lastSignature = signature;
        if (Utils.$("yt-player-container"))
          Utils.$("yt-player-container").style.display = "block";
        vid.style.display = "none";

        const onStateChange = (e, time) => {
          if (window._isSyncingVideo) return; // ignore events during forceSync

          const isYT = ytId;
          const isRT = rtId;
          const isVK = vkInfo;
          const state = isYT ? e.data : e;
          const playingState = isYT
            ? window.YT
              ? window.YT.PlayerState.PLAYING
              : 1
            : "playing";
          const pausedState = isYT
            ? window.YT
              ? window.YT.PlayerState.PAUSED
              : 2
            : "paused";
          const Manager = isYT ? YouTubePlayerManager : (isRT ? RutubePlayerManager : VkPlayerManager);

          if (state === "seeked" || state === "seek") {
            if (AppState.ignoreVideoEvents || window._isSyncingVideo) return;
            if (!RoomManager.hasPerm("player")) return;
            const curTime = typeof time === "number" ? time : Manager.getCurrentTime();
            const curState = Manager.getState ? Manager.getState() : "playing";
            const normState = curState === "paused" ? "paused" : "playing";
            AppState.ignoreVideoEvents = true;
            set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
              type: "seek",
              state: normState,
              time: curTime,
              ts: Date.now(),
            }).catch(() => {});
            setTimeout(() => (AppState.ignoreVideoEvents = false), 600);
          } else if (state === playingState) {
            if (AppState.ignoreVideoEvents) return;
            if (!RoomManager.hasPerm("player")) return;
            if (AppState.enteredEmptyRoomAsNonHost && !AppState.isHost) {
              try { Manager.pause(); } catch (e) {}
              return;
            }
            if (
              Manager.getCurrentTime() === 0 &&
              AppState.lastKnownSyncState &&
              AppState.lastKnownSyncState.time > 2
            )
              return; // Prevent spurious 0:00 broadcasts on load

            AppState.ignoreVideoEvents = true;
            set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
              type: "play",
              state: "playing",
              time: Manager.getCurrentTime(),
              ts: Date.now(),
            });
            setTimeout(() => (AppState.ignoreVideoEvents = false), 1500);
          } else if (state === pausedState) {
            if (AppState.ignoreVideoEvents || window._isSyncingVideo) return;
            if (!RoomManager.hasPerm("player")) return;
            AppState.ignoreVideoEvents = true;
            set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
              type: "pause",
              state: "paused",
              time: Manager.getCurrentTime(),
              ts: Date.now(),
            });
            setTimeout(() => (AppState.ignoreVideoEvents = false), 1500);
          } else if (state === "ended" || (isYT && (state === 0 || (window.YT && state === window.YT.PlayerState?.ENDED)))) {
            if (AppState.ignoreVideoEvents || window._isSyncingVideo) return;
            if (!RoomManager.hasPerm("player")) return;
            AppState.ignoreVideoEvents = true;
            const endDuration = (Manager.getDuration && Manager.getDuration()) || Manager.getCurrentTime();
            set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
              type: "pause",
              state: "paused",
              time: endDuration,
              ts: Date.now(),
            }).catch(() => {});
            setTimeout(() => (AppState.ignoreVideoEvents = false), 1500);
          }
        };

        if (ytId) {
          await YouTubePlayerManager.initPlayer(ytId, onStateChange);
        } else if (rtId) {
          await RutubePlayerManager.initPlayer(rtId, onStateChange);
        } else if (vkInfo) {
          await VkPlayerManager.initPlayer(vkInfo.embedUrl, onStateChange);
        }
        vid.dataset.playbackKey = signature;
        RoomManager.applyLocalPermissions();
        return;
      }

      const playback = await this.resolvePlaybackSource(room);
      const source = String(playback.source || "").trim();

      this.lastSignature = signature;
      vid.dataset.playbackKey = signature;
      vid.dataset.roomUrl = source;

      if (Utils.$("yt-player-container"))
        Utils.$("yt-player-container").style.display = "none";
      vid.style.display = "block";

      this.attachSource(vid, source, playback.isHls);

      vid.controls = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.onerror = () => {
        Utils.toast(
          "Плеер не смог загрузить видео. Проверьте ссылку или пересоздайте комнату.",
          "error",
        );
      };

      Ambilight.start(vid);
    } catch (err) {
      Utils.toast(err.message || "Ошибка загрузки видео", "error");
    }
  }

  static syncRoomVideoIfChanged(room = {}) {
    if (!AppState.currentRoomId) return;
    const signature = this.getPlaybackSignature(room);
    if (signature !== this.lastSignature) {
      this.applyRoomVideo(room).catch(() => {});
    }
  }
}

// Адаптивный Ambilight для плеера
class Ambilight {
  static loopId = null;
  static canvas = document.createElement("canvas");
  static ctx = this.canvas.getContext("2d", { willReadFrequently: true });

  static start(videoEl) {
    this.stop();
    if (!videoEl) return;

    let glowEl = Utils.$("ambilight-glow");
    if (!glowEl) {
      glowEl = document.createElement("div");
      glowEl.id = "ambilight-glow";
      glowEl.style.cssText =
        "position:absolute; top:5%; left:5%; width:90%; height:90%; z-index:0; filter:blur(40px); opacity:0.85; transition: background 0.5s ease, box-shadow 0.5s ease; border-radius: 20px; pointer-events:none; transform: translateZ(0);";
      videoEl.parentNode.insertBefore(glowEl, videoEl);
    }

    this.canvas.width = 64;
    this.canvas.height = 64;

    const draw = () => {
      if (!AppState.currentRoomId) return this.stop();

      if (AppState.currentTheme === "love") {
        glowEl.style.background = "rgba(255, 105, 180, 0.9)";
        glowEl.style.boxShadow = "0 0 100px rgba(255, 105, 180, 0.8)";
      } else {
        // Adaptive color reading from video
        if (!videoEl.paused && !videoEl.ended && videoEl.readyState > 2) {
          try {
            this.ctx.drawImage(videoEl, 0, 0, 64, 64);
            const data = this.ctx.getImageData(0, 0, 64, 64).data;
            let r = 0,
              g = 0,
              b = 0,
              count = 0;
            for (let i = 0; i < data.length; i += 16) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              count++;
            }
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            const color = `rgb(${r}, ${g}, ${b})`;
            glowEl.style.background = color;
            glowEl.style.boxShadow = `0 0 80px ${color}, 0 0 120px ${color}`;
          } catch (e) {
            // Fallback on CORS errors
            glowEl.style.background = "rgba(255, 255, 255, 0.05)";
            glowEl.style.boxShadow = "none";
          }
        }
      }
      this.loopId = requestAnimationFrame(draw);
    };
    draw();
  }

  static updateTheme(theme) {
    const glowEl = Utils.$("ambilight-glow");
    if (glowEl && theme === "love") {
      glowEl.style.background = "rgba(255, 105, 180, 0.9)";
      glowEl.style.boxShadow = "0 0 100px rgba(255, 105, 180, 0.8)";
    }
  }

  static stop() {
    if (this.loopId) cancelAnimationFrame(this.loopId);
    const glowEl = Utils.$("ambilight-glow");
    if (glowEl) {
      glowEl.style.background = "transparent";
      glowEl.style.boxShadow = "none";
    }
  }
}

/** Общая «связь» пары: тепло, серия дней, моменты — без трекинга комнат */
window.VkPlayerManager = VkPlayerManager;
window.VimeoPlayerManager = VimeoPlayerManager;
window.TwitchPlayerManager = TwitchPlayerManager;
window.RutubePlayerManager = RutubePlayerManager;
window.YouTubePlayerManager = YouTubePlayerManager;
window.VideoPlaybackManager = VideoPlaybackManager;
window.Ambilight = Ambilight;
export {
  VkPlayerManager,
  VimeoPlayerManager,
  TwitchPlayerManager,
  RutubePlayerManager,
  YouTubePlayerManager,
  VideoPlaybackManager,
  Ambilight
};
