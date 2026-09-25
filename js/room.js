class RoomManager {
  static themeIndex = 0;
  static heartsTimer = null;
  static loveHeartEmojis = [
    "<img src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Red%20Heart.webp' style='width:1em;height:1em;'>",
    "<img src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Heart%20With%20Arrow.webp' style='width:1em;height:1em;'>",
    "<img src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Revolving%20Hearts.webp' style='width:1em;height:1em;'>",
    "<img src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Two%20Hearts.webp' style='width:1em;height:1em;'>",
    "<img src='https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Sparkling%20Heart.webp' style='width:1em;height:1em;'>",
  ];

  static closeUserMiniature() {
    if (window.ProfileManager && typeof ProfileManager.closeProfileOverlay === "function") {
      ProfileManager.closeProfileOverlay();
    }
    const modal = document.getElementById("modal-room-user-miniature");
    if (modal) modal.classList.remove("active");
  }

  static async showUserMiniature(uid) {
    if (!uid) return;
    if (window.ProfileManager && typeof ProfileManager.openViewProfileModal === "function") {
      return ProfileManager.openViewProfileModal(uid, true);
    }
  }

  static syncDeveloperControls(profile = {}) {
    AdminPanel.syncSidebarButton(profile);
  }

  static applyCreateRoomAvailability() {
    const btn = Utils.$("btn-open-create-room");
    if (!btn) return;

    const blockedForUser =
      (AppState.admin.settings.roomCreationBlocked ||
        AppState.admin.settings.maintenanceMode) &&
      !AdminPanel.isCurrentUserAdmin();
    btn.disabled = blockedForUser;
    btn.title = blockedForUser
      ? "Создание комнат временно отключено администратором"
      : "";
  }

  static initLobbyListeners() {
    if (!RoomManager._hasWindowUnloadListener) {
      RoomManager._hasWindowUnloadListener = true;
      window.addEventListener("beforeunload", () => {
        if (AppState.currentRoomId) RoomManager.flushPendingRoomTime();
      });
      window.addEventListener("pagehide", () => {
        if (AppState.currentRoomId) RoomManager.flushPendingRoomTime();
      });
    }

    const roomsRef = ref(db, "rooms");
    const unsub = onValue(roomsRef, (snap) => {
      const data = snap.val() || {};
      const oldKeys = Array.from(AppState.roomsCache.keys());
      AppState.roomsCache.clear();
      for (const key in data) AppState.roomsCache.set(key, data[key]);
      oldKeys.forEach((k) => {
        if (!data[k]) Utils.$(`room-card-${k}`)?.remove();
      });
      if (!AppState.currentRoomId) {
        if (!this._debouncedUpdateRooms) {
          this._debouncedUpdateRooms = Utils.debounce(() => this.updateRoomsDOM(), 150);
        }
        this._debouncedUpdateRooms();
      }

      // Автоматическая синхронизация тем
      if (AppState.currentRoomId) {
        if (!data[AppState.currentRoomId]) {
          // Комната была удалена
          Utils.toast("Комната была удалена", "info");
          this.leaveRoom();
        } else {
          const currentRoom = data[AppState.currentRoomId];
          const newTheme = this.normalizeRoomTheme(
            currentRoom.theme || "default",
          );
          if (AppState.currentTheme !== newTheme) {
            AppState.currentTheme = newTheme;
            this.applyRoomTheme(newTheme);
          }
          VideoPlaybackManager.syncRoomVideoIfChanged(currentRoom);
        }
      }

      let totalOnline = 0;
      for (const r in data) {
        if (data[r].presence)
          totalOnline += Object.keys(data[r].presence).length;
      }
      if (Utils.$("global-online-count"))
        Utils.$("global-online-count").innerText = totalOnline;
      AdminPanel.renderIfOpen();
    });
    AppState.activeSubscriptions.push(() => off(roomsRef, "value", unsub));

    Utils.$("btn-open-create-room").onclick = () => this.openRoomModal();
    Utils.$("btn-save-room").onclick = () => this.saveRoom();
    Utils.$("search-rooms").oninput = Utils.debounce(
      () => this.updateRoomsDOM(),
      300,
    );

    Utils.$("room-input-private").onchange = (e) => {
      Utils.$("room-input-password").style.display = e.target.checked
        ? "block"
        : "none";
    };
    Utils.$("btn-leave-room").onclick = () => this.leaveRoom();
    if (Utils.$("btn-fullscreen-toggle")) {
      Utils.$("btn-fullscreen-toggle").onclick = () => {
        const vidContainer = Utils.$("native-player")?.parentElement;
        if (!vidContainer) return;
        if (!document.fullscreenElement) {
          vidContainer
            .requestFullscreen()
            .catch(() =>
              Utils.toast("Не удалось открыть полный экран", "error"),
            );
        } else {
          document.exitFullscreen();
        }
      };
      
      const exitFsBtn = Utils.$("btn-exit-fullscreen");
      if (exitFsBtn) {
        exitFsBtn.onclick = () => document.exitFullscreen();
      }

      document.onfullscreenchange = () => {
        if (exitFsBtn) {
           exitFsBtn.style.display = document.fullscreenElement ? "flex" : "none";
        }
        const vidContainer = Utils.$("native-player")?.parentElement;
        if (vidContainer) {
            vidContainer.style.borderRadius = document.fullscreenElement ? "0" : "20px";
        }
      };
    }
    this.initThemes();
    MediaResolverClient.bindRoomUrlInput();
    this.applyCreateRoomAvailability();
  }

  static currentThemeFolder = "classic";
  static selectedTheme = "default";

  static initThemes() {}

  static stepThemeCarousel() {}

  static syncThemeCarouselActive() {}

  static setRoomModalTheme() {}

  static updateThemeTransform() {}

  static normalizeRoomTheme() {
    return "default";
  }

  static getActorLabel() {
    const uid = AppState.currentUser?.uid || "";
    const profile = AppState.usersCache.get(uid) || {};
    const name = profile.name || AppState.currentUser?.displayName || "Unknown";
    const username = profile.username || uid || "unknown";
    const isHostLike = AppState.isHost || AdminPanel.isCurrentUserCreator();
    return `${isHostLike ? "ХОСТ" : "ADMIN"} ${name}(@${username})`;
  }

  static async pushRoomSystemMessage(roomId, text, extra = {}) {
    if (!roomId || !text) return;
    await push(ref(db, `rooms/${roomId}/chat`), {
      type: "system",
      uid: AppState.currentUser?.uid || "system",
      name: "SYSTEM",
      text: `${text}`,
      ts: Date.now(),
      ...extra,
    }).catch(() => {});
  }

  static async kickUserFromCurrentRoom(targetUid) {
    if (!targetUid || !AppState.currentRoomId) return;
    if (!(AppState.isHost || AdminPanel.isCurrentUserCreator()))
      return Utils.toast("Недостаточно прав", "error");
    const targetPresence = AppState.currentPresenceCache?.[targetUid];
    if (!targetPresence) return Utils.toast("Пользователь уже вышел", "error");
    const roomId = AppState.currentRoomId;
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/presence/${targetUid}`)),
      remove(ref(db, `rooms/${roomId}/rtc/participants/${targetUid}`)),
      set(ref(db, `admin/actions/forceLeaveRoom/${targetUid}`), {
        ts: Date.now(),
        byUid: AppState.currentUser.uid,
        roomId,
        reason: "kicked-by-host",
      }),
    ]);
    await this.pushRoomSystemMessage(
      roomId,
      `${this.getActorLabel()} кикнул ${targetPresence.name || targetUid}`,
    );
  }

  static getRoomAvatarsStack(room = {}) {
    const ids = Object.keys(room?.presence || {}).slice(0, 4);
    if (!ids.length) return `<span class="stack-avatar">0</span>`;
    return ids
      .map((uid) => {
        const profile = AppState.usersCache.get(uid) || {};
        return `<span class=\"stack-avatar\">${ProfileManager.getAvatarHtml(profile)}</span>`;
      })
      .join("");
  }

  static updateRoomsDOM() {
    if (AppState.currentRoomId) return;
    const grid = Utils.$("rooms-grid");
    if (!grid) return;
    const search = Utils.$("search-rooms") ? Utils.$("search-rooms").value.toLowerCase().trim() : "";
    let count = 0;

    AppState.roomsCache.forEach((room, id) => {
      if (search && !(room.name || "").toLowerCase().includes(search)) {
        Utils.$(`room-card-${id}`)?.remove();
        return;
      }

      const lock = room.isPrivate ? "🔒 " : "";
      const membersCount = room.presence
        ? Object.keys(room.presence).length
        : 0;
      const isYt = MediaResolverClient.extractYouTubeId(
        room.videoSourceUrl || room.videoUrl,
      );
      const platformBadge = isYt
        ? `<span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px; vertical-align:middle;">YouTube</span>`
        : "";

      let card = Utils.$(`room-card-${id}`);

      if (!card) {
        card = document.createElement("div");
        card.className = "room-card";
        card.id = `room-card-${id}`;
        card.onclick = () => this.attemptJoinRoom(id, room);
        const isYtUrl = MediaResolverClient.extractYouTubeId(
          room.videoSourceUrl || room.videoUrl,
        );
        const ytHtml = isYtUrl
          ? `<img src="https://i.ytimg.com/vi/${isYtUrl}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;">`
          : "";
        const vidHtml =
          room.videoUrl && !isYtUrl
            ? `<video src="${Utils.escapeHtml(room.videoUrl)}" preload="metadata" muted playsinline></video>`
            : ytHtml;
        card.innerHTML = `
                    <div class="room-preview">${vidHtml}<div class="room-preview-overlay"></div></div>
                    <div class="room-info"><h4 class="rm-title"></h4><div class="room-meta"><span class="rm-host"></span><span class="rm-count"></span></div></div>
                `;
        grid.appendChild(card);
        const video = card.querySelector("video");
        if (video) {
          video.addEventListener(
            "loadedmetadata",
            () => {
              video.currentTime = Math.min(10, video.duration / 2);
              card.querySelector(".room-preview").classList.add("loaded");
            },
            { once: true },
          );
        }
        if (isYtUrl) {
          card.querySelector(".room-preview").classList.add("loaded");
        }
      }
      card.querySelector(".rm-title").innerHTML =
        `${platformBadge}${lock}${Utils.escapeHtml(room.name)}`;
      if (Array.isArray(room.hashtags) && room.hashtags[0]) {
        card.querySelector(".rm-title").innerHTML =
          `${platformBadge}${lock}${Utils.escapeHtml(room.name)} <span style="opacity:0.7;font-size:0.9em">${Utils.escapeHtml(room.hashtags[0])}</span>`;
      }
      card.querySelector(".rm-host").innerText =
        `Хост: ${room.hostName || "Неизвестно"}`;
      card.querySelector(".rm-count").innerHTML =
        `<span class="avatars-stack">${this.getRoomAvatarsStack(room)}</span>`;
      count++;
    });

    if (count === 0 && !Utils.$("empty-rooms-msg")) {
      const msg = document.createElement("div");
      msg.id = "empty-rooms-msg";
      msg.style.cssText =
        "color:var(--text-muted); padding:20px; grid-column: 1 / -1;";
      msg.innerText = search ? "Ничего не найдено" : "Нет активных комнат";
      grid.appendChild(msg);
    } else if (count > 0 && Utils.$("empty-rooms-msg"))
      Utils.$("empty-rooms-msg").remove();
  }

  static openRoomModal(roomId = null) {
    if (!roomId && AdminPanel.isSystemReadOnlyForUser()) {
      return Utils.toast("Система в режиме ReadOnly", "error");
    }
    if (
      !roomId &&
      AppState.admin.settings.roomCreationBlocked &&
      !AdminPanel.isCurrentUserAdmin()
    ) {
      return Utils.toast(
        "Создание комнат временно отключено администратором",
        "error",
      );
    }

    if (!roomId) {
      const myUid = AppState.currentUser?.uid;
      const myProfile = myUid ? (AppState.usersCache.get(myUid) || AppState.myProfile) : null;
      const isPrem = window.PremiumManager ? PremiumManager.isPremiumActive(myProfile, myUid) : false;
      let myRoomsCount = 0;
      if (myUid && AppState.roomsCache) {
        AppState.roomsCache.forEach((r) => {
          if (r && r.hostId === myUid) myRoomsCount++;
        });
      }
      if (!isPrem && myRoomsCount >= 1) {
        Utils.toast("Создание 2 комнат и более доступно только с COWIO Premium!", "error");
        if (window.PremiumManager) PremiumManager.openPremiumPurchaseModal();
        return;
      }
    }

    const modal = Utils.$("modal-room");
    const isEdit = !!roomId;
    Utils.$("room-modal-title").innerText = isEdit
      ? "Настройки комнаты"
      : "Создать комнату";
    Utils.$("btn-delete-room").style.display = isEdit ? "block" : "none";

    if (isEdit) {
      const r = AppState.roomsCache.get(roomId);
      Utils.$("room-input-name").value = r.name || "";
      Utils.$("room-input-url").value = r.videoSourceUrl || r.videoUrl || "";
      MediaResolverClient.setModalStatus(
        r.videoTitle ? "success" : "idle",
        r.videoTitle ? `${r.videoPlatform || "video"}: ${r.videoTitle}` : "",
      );
      Utils.$("room-input-private").checked = r.isPrivate;
      Utils.$("room-input-password").style.display = r.isPrivate
        ? "block"
        : "none";
      Utils.$("room-input-hashtag").value = Array.isArray(r.hashtags)
        ? r.hashtags[0] || ""
        : "";
      RoomVideoSearchManager.reset();
      const hint = Utils.$("room-name-autofill-hint");
      if (hint) hint.style.display = "none";
      Utils.$("btn-delete-room").onclick = async () => {
        if (await Utils.confirm("Точно удалить комнату навсегда?")) {
          modal.classList.remove("active");
          this.leaveRoom();
          await remove(ref(db, `rooms/${roomId}`));
        }
      };
    } else {
      Utils.$("room-input-name").value = "";
      Utils.$("room-input-url").value = "";
      Utils.$("room-input-private").checked = false;
      Utils.$("room-input-password").style.display = "none";
      Utils.$("room-input-password").value = "";
      Utils.$("room-input-hashtag").value = "";
      MediaResolverClient.setModalStatus("idle", "");
      RoomVideoSearchManager.reset();
      const hint = Utils.$("room-name-autofill-hint");
      if (hint) hint.style.display = "none";
      const statusText = Utils.$("room-fetch-status-text");
      if (statusText) statusText.textContent = "";
      const indicator = Utils.$("room-url-loading-indicator");
      if (indicator) indicator.style.display = "none";
    }
    modal.classList.add("active");
    modal.dataset.editingId = isEdit ? roomId : "";
  }

  static async saveRoom() {
    if (
      !SecurityManager.validateAction("room_create", {
        count: 3,
        timeWindowMs: 60000,
      })
    )
      return;
    const name = Utils.$("room-input-name").value.trim();
    const videoInputUrl = Utils.$("room-input-url").value.trim();
    const isPrivate = Utils.$("room-input-private").checked;
    const password = Utils.$("room-input-password").value.trim();
    const hashtags = HashtagManager.parseHashtags(
      Utils.$("room-input-hashtag").value,
      true,
    );
    const roomId = Utils.$("modal-room").dataset.editingId;

    if (!roomId && AdminPanel.isSystemReadOnlyForUser()) {
      return Utils.toast("Система в режиме ReadOnly", "error");
    }
    if (
      !roomId &&
      AppState.admin.settings.roomCreationBlocked &&
      !AdminPanel.isCurrentUserAdmin()
    ) {
      return Utils.toast(
        "Создание комнат временно отключено администратором",
        "error",
      );
    }

    if (!roomId) {
      const myUid = AppState.currentUser?.uid;
      const myProfile = myUid ? (AppState.usersCache.get(myUid) || AppState.myProfile) : null;
      const isPrem = window.PremiumManager ? PremiumManager.isPremiumActive(myProfile, myUid) : false;
      let myRoomsCount = 0;
      if (myUid && AppState.roomsCache) {
        AppState.roomsCache.forEach((r) => {
          if (r && r.hostId === myUid) myRoomsCount++;
        });
      }
      if (!isPrem && myRoomsCount >= 1) {
        Utils.toast("Создание 2 комнат и более доступно только с COWIO Premium!", "error");
        if (window.PremiumManager) PremiumManager.openPremiumPurchaseModal();
        return;
      }
    }

    if (!name) return Utils.toast("Название не может быть пустым", "error");
    if (isPrivate && password.length < 4 && !roomId)
      return Utils.toast("Пароль минимум 4 символа", "error");

    Utils.$("btn-save-room").disabled = true;
    try {
      const previousRoom = roomId
        ? AppState.roomsCache.get(roomId) || {}
        : null;
      let videoFields = {
        videoUrl: "",
        videoSourceUrl: "",
        videoPlatform: "",
        videoIsHls: false,
        videoResolvedAt: 0,
        videoTitle: "",
        videoThumbnail: "",
      };

      const prevInput = previousRoom
        ? previousRoom.videoSourceUrl || previousRoom.videoUrl || ""
        : "";

      if (videoInputUrl) {
        if (previousRoom && videoInputUrl === prevInput) {
          videoFields = {
            videoUrl: previousRoom.videoUrl || "",
            videoSourceUrl: previousRoom.videoSourceUrl || "",
            videoPlatform: previousRoom.videoPlatform || "",
            videoIsHls: previousRoom.videoIsHls || false,
            videoResolvedAt: previousRoom.videoResolvedAt || 0,
            videoTitle: previousRoom.videoTitle || "",
            videoThumbnail: previousRoom.videoThumbnail || "",
          };
        } else {
          try {
            videoFields =
              await MediaResolverClient.buildRoomVideoFields(videoInputUrl);
          } catch (err) {
            Utils.toast(err.message || "Ошибка извлечения видео", "error");
            return;
          }
        }
      }

      const roomData = {
        name,
        videoUrl: videoFields.videoUrl,
        videoSourceUrl: videoFields.videoSourceUrl,
        videoPlatform: videoFields.videoPlatform,
        videoIsHls: videoFields.videoIsHls,
        videoResolvedAt: videoFields.videoResolvedAt,
        videoTitle: videoFields.videoTitle,
        videoThumbnail: videoFields.videoThumbnail,
        isPrivate,
        hashtags,
        theme: "default",
        hostId: AppState.currentUser.uid,
        hostName:
          AppState.usersCache.get(AppState.currentUser.uid)?.name ||
          AppState.currentUser.displayName ||
          "Хост",
        updatedAt: Date.now(),
      };
      if (isPrivate && password) {
        roomData.salt = Utils.generateCryptoId(16);
        roomData.hash = await Utils.hashPassword(password, roomData.salt);
      }

      if (roomId) {
        if (isPrivate && !password) {
          const oldR = AppState.roomsCache.get(roomId);
          roomData.salt = oldR.salt;
          roomData.hash = oldR.hash;
        }
        await update(ref(db, `rooms/${roomId}`), roomData);
        Utils.toast("Настройки сохранены");
        const mergedRoom = {
          ...(AppState.roomsCache.get(roomId) || {}),
          ...roomData,
        };
        AppState.roomsCache.set(roomId, mergedRoom);
        const actor = this.getActorLabel();
        if (
          previousRoom &&
          this.normalizeRoomTheme(previousRoom.theme || "default") !==
            roomData.theme
        ) {
          await this.pushRoomSystemMessage(
            roomId,
            `${actor} поменял тему комнаты`,
          );
        }
        if (
          previousRoom &&
          Boolean(previousRoom.isPrivate) !== Boolean(roomData.isPrivate)
        ) {
          await this.pushRoomSystemMessage(
            roomId,
            `${actor} ${roomData.isPrivate ? "сделал комнату приватной" : "сделал комнату публичной"}`,
          );
        }
      } else {
        roomData.createdAt = Date.now();
        const newRef = push(ref(db, "rooms"));
        await set(newRef, roomData);
        Utils.toast("Комната создана");
        this.enterRoomFinal(newRef.key, roomData);
      }
      Utils.$("modal-room").classList.remove("active");
    } catch (e) {
      Utils.toast("Ошибка сохранения", "error");
    } finally {
      Utils.$("btn-save-room").disabled = false;
    }
  }

  static async joinRoom(roomId) {
    if (!roomId) return;
    try {
      import("firebase/database").then(
        ({ getDatabase, ref, get }) => {
          get(ref(getDatabase(), `rooms/${roomId}`)).then((snap) => {
            if (snap.exists()) {
              this.attemptJoinRoom(roomId, snap.val());
            } else {
              Utils.toast("Комната не найдена", "error");
            }
          });
        },
      );
    } catch (e) {}
  }

  static async attemptJoinRoom(roomId, roomData) {
    if (
      !SecurityManager.validateAction("room_join", {
        count: 10,
        timeWindowMs: 60000,
      })
    )
      return;
    if (
      AppState.admin.settings.maintenanceMode &&
      !AdminPanel.isCurrentUserAdmin()
    ) {
      return Utils.toast(
        "Сервис в режиме обслуживания, доступ временно ограничен",
        "error",
      );
    }
    if (
      roomData.isPrivate &&
      roomData.hostId !== AppState.currentUser.uid &&
      !window.isIncognito
    ) {
      AppState.pendingJoinRoomId = roomId;
      Utils.$("join-room-password").value = "";
      Utils.$("modal-password").classList.add("active");
      Utils.$("btn-submit-password").onclick = async () => {
        const input = Utils.$("join-room-password").value;
        const hashAttempt = await Utils.hashPassword(input, roomData.salt);
        if (hashAttempt === roomData.hash) {
          Utils.$("modal-password").classList.remove("active");
          this.enterRoomFinal(roomId, roomData);
        } else Utils.toast("Неверный пароль", "error");
      };
    } else {
      this.enterRoomFinal(roomId, roomData);
    }
  }

  static enterRoomFinal(roomId, roomData) {
    AppState.ignoreVideoEvents = true;
    RTCManager.destroy();
    AppState.currentRoomId = roomId;
    AppState.currentRoomData = roomData;
    AppState.lastKnownSyncState = null;
    AppState.currentRoomJoinTs = Date.now(); // ФИКС: Запоминаем время входа, чтобы не смотреть старые пасхалки
    // Фикс изначального хоста (только владелец получает тру isHost глобально)
    AppState.isHost = roomData.hostId === AppState.currentUser.uid;
    const initialPres = roomData.presence || {};
    const otherInitialUsers = Object.keys(initialPres).filter(
      (u) => u !== AppState.currentUser.uid,
    );
    AppState.enteredEmptyRoomAsNonHost =
      !AppState.isHost && otherInitialUsers.length === 0;
    AppState.currentPresenceCache = {};
    AppState.usersListRenderToken++;
    AppState.roomSubscriptions.forEach((fn) => fn());
    AppState.roomSubscriptions = [];

    RoomManager.startRoomExperienceTimer();

    const roomTag =
      Array.isArray(roomData.hashtags) && roomData.hashtags[0]
        ? ` ${roomData.hashtags[0]}`
        : "";
    
    Utils.$("room-title-text").innerText = Utils.escapeHtml(`${roomData.name}${roomTag}`);
    
    // Set author info
    const authorNameEl = Utils.$("room-author-name");
    const authorAvatarEl = Utils.$("room-author-avatar");
    if (authorNameEl && authorAvatarEl) {
        // Reset and add pointer cursor
        authorNameEl.style.cursor = "pointer";
        authorAvatarEl.style.cursor = "pointer";
        const openHostProfile = () => {
            RoomManager.showUserMiniature(roomData.hostId);
        };
        authorNameEl.onclick = openHostProfile;
        authorAvatarEl.onclick = openHostProfile;

        import("firebase/database").then(({get, ref, getDatabase}) => {
            // First check profile, then fallback
            get(ref(getDatabase(), `users/${roomData.hostId}/profile`)).then(snap => {
                let name = "Неизвестно";
                let photo = "";
                let pData = {};
                if (snap.exists()) {
                    const p = snap.val();
                    name = p.name || p.username || "Неизвестно";
                    photo = p.photoURL || p.avatar || "";
                    pData = p;
                } else {
                    // Fallback to top level
                    get(ref(getDatabase(), `users/${roomData.hostId}`)).then(snap2 => {
                        if (snap2.exists()) {
                            const p2 = snap2.val();
                            name = p2.name || p2.username || "Неизвестно";
                            photo = p2.photoURL || p2.avatar || "";
                            pData = p2;
                        }
                        renderHost(name, photo, pData);
                    });
                    return;
                }
                renderHost(name, photo, pData);
            });
        });
        
        function renderHost(name, photo) {
            authorNameEl.innerText = Utils.escapeHtml(name);
            
            if (photo) {
                authorAvatarEl.innerHTML = `<img src="${Utils.escapeHtml(photo)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                authorAvatarEl.innerHTML = `<div style="width:100%; height:100%; background: #555; border-radius: 50%;"></div>`;
            }
        }
    }

    VideoPlaybackManager.applyRoomVideo(roomData).catch(() => {});

    if (
      MediaResolverClient.extractYouTubeId(
        roomData.videoSourceUrl || roomData.videoUrl,
      )
    ) {
      const ytVpnNotice = document.createElement("div");
      ytVpnNotice.style.cssText =
        "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border: 2px solid #ff4757; border-radius: 16px; padding: 24px; z-index: 10000; color: #fff; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-width: 90%; width: 320px;";
      ytVpnNotice.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px;">🔴</div>
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Внимание: YouTube</div>
                <div style="font-size: 14px; opacity: 0.9; line-height: 1.5; margin-bottom: 20px;">Для корректной загрузки и синхронизации видео с YouTube <b>обязательно включите VPN</b>.</div>
                <button class="primary-btn" style="width: 100%;" onclick="this.parentElement.remove()">Я включил VPN</button>
            `;
      document.body.appendChild(ytVpnNotice);
    }

    let shareBtn = Utils.$("btn-share-room");
    if (!shareBtn) {
      shareBtn = document.createElement("button");
      shareBtn.id = "btn-share-room";
      shareBtn.className = "primary-btn";
      shareBtn.style.width = "auto";
      shareBtn.style.padding = "10px 16px";
      shareBtn.innerText = "Поделиться";
      Utils.$("btn-room-settings").parentNode.appendChild(shareBtn);
    }
    shareBtn.onclick = () => {
      if (window._setRoomTab) window._setRoomTab("users");
      Utils.toast('Нажмите "Пригласить" рядом с другом в списке', "info");
    };

    // Кнопка настроек доступна оригинальному хосту и Разработчику
    const settingsBtn = Utils.$("btn-room-settings");
    if (settingsBtn) {
      settingsBtn.style.display =
        AppState.isHost || AdminPanel.isCurrentUserCreator() ? "inline-flex" : "none";
      if (AppState.isHost || AdminPanel.isCurrentUserCreator())
        settingsBtn.onclick = () => this.openRoomModal(roomId);
    }

    const videoVolSlider = Utils.$("video-volume-slider");
    if (videoVolSlider) {
      videoVolSlider.oninput = () => {
        this.setPlayerVolume(parseFloat(videoVolSlider.value) || 0);
      };
    }

    Utils.showScreen("room-screen");
    Utils.$("chat-messages").innerHTML =
      '<div class="sys-msg">Вы вошли в комнату</div>';
    Utils.$("users-list").innerHTML = "";

    AppState.currentTheme = this.normalizeRoomTheme(
      roomData.theme || "default",
    ); // [UPDATE]
    this.applyRoomTheme(AppState.currentTheme);

    this.initRoomServicesFinal(roomId);
    RTCManager.init(roomId);
    
  }

  static getDefaultPerms(isHost = false) {
    return { chat: true, voice: true, player: !!isHost, reactions: true };
  }

  static getPlayerVolume() {
    const videoVolSlider = Utils.$("video-volume-slider");
    if (
      videoVolSlider &&
      videoVolSlider.value !== undefined &&
      videoVolSlider.value !== ""
    ) {
      return parseFloat(videoVolSlider.value) || 0;
    }
    const nativePlayer = Utils.$("native-player");
    if (nativePlayer) return nativePlayer.volume;
    return 1;
  }

  static setPlayerVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    const nativePlayer = Utils.$("native-player");
    if (nativePlayer) {
      nativePlayer.volume = clamped;
      nativePlayer.muted = clamped === 0;
    }
    if (
      YouTubePlayerManager.player &&
      typeof YouTubePlayerManager.player.setVolume === "function"
    ) {
      try {
        YouTubePlayerManager.player.setVolume(clamped * 100);
        if (clamped === 0) {
          if (typeof YouTubePlayerManager.player.mute === "function") {
            YouTubePlayerManager.player.mute();
          }
        } else {
          if (typeof YouTubePlayerManager.player.unMute === "function") {
            YouTubePlayerManager.player.unMute();
          }
        }
      } catch (e) {}
    }
    if (RutubePlayerManager.player) {
      try {
        RutubePlayerManager.player.postMessage("player:setVolume", {
          volume: clamped,
        });
      } catch (e) {}
    }
    if (VkPlayerManager.player) {
      try {
        VkPlayerManager.setVolume(clamped);
      } catch (e) {}
    }
    const videoVolSlider = Utils.$("video-volume-slider");
    if (videoVolSlider) {
      videoVolSlider.value = clamped;
    }
  }

  static initRoomServicesFinal(roomId) {
    const uid = AppState.currentUser.uid;
    const presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
    const presListRef = ref(db, `rooms/${roomId}/presence`);
    const syncRef = ref(db, `rooms/${roomId}/sync`);
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const reactionsRef = ref(db, `rooms/${roomId}/reactions`);
    const typingRef = ref(db, `rooms/${roomId}/typing`);

    const typingUnsub = onValue(typingRef, (snap) => {
      const typings = snap.val() || {};
      const typingIds = Object.keys(typings).filter(
        (id) => id !== AppState.currentUser.uid && typings[id] === true,
      );
      const el = Utils.$("room-typing-status");
      if (el) {
        if (typingIds.length === 0) {
          el.innerText = "";
        } else if (typingIds.length === 1) {
          const p = AppState.currentPresenceCache?.[typingIds[0]];
          el.innerText = (p ? p.name : "Кто-то") + " печатает...";
        } else {
          el.innerText = "Несколько человек печатают...";
        }
      }
    });

    let presenceBootstrapped = false;

    const myName =
      AppState.usersCache.get(AppState.currentUser.uid)?.name ||
      AppState.currentUser.displayName ||
      "Пользователь";
    const isHostLike = AppState.isHost || AdminPanel.isCurrentUserCreator();
    if (!window.isIncognito) {
      set(presenceRef, { uid, name: myName, perms: this.getDefaultPerms(isHostLike) });
      onDisconnect(presenceRef).remove();
    } else {
      // Still allow chatting, just don't list presence
      Utils.toast("ИНКОГНИТО АКТИВЕН. Вас не видно в списке.", "info");
    }

    const pUnsub = onValue(presListRef, (snap) => {
      const prevCache = AppState.currentPresenceCache || {};
      AppState.currentPresenceCache = snap.val() || {};
      const otherPresUsers = Object.keys(AppState.currentPresenceCache).filter(
        (u) => u !== AppState.currentUser?.uid,
      );
      if (otherPresUsers.length > 0) {
        AppState.enteredEmptyRoomAsNonHost = false;
      }
      this.rerenderUsersList();
      this.applyLocalPermissions();
      if (RTCManager.isMicActive) {
        RTCManager.broadcastToParticipants();
      }
      if (!presenceBootstrapped) {
        presenceBootstrapped = true;
        return;
      }
      if (AppState.isHost || AdminPanel.isCurrentUserCreator()) {
        const prevIds = new Set(Object.keys(prevCache));
        const nextIds = new Set(Object.keys(AppState.currentPresenceCache));
        nextIds.forEach((joinedUid) => {
          if (!prevIds.has(joinedUid)) {
            const joinedName =
              AppState.currentPresenceCache[joinedUid]?.name || joinedUid;
            this.pushRoomSystemMessage(roomId, `${joinedName} зашел в комнату`);
          }
        });
        prevIds.forEach((leftUid) => {
          if (!nextIds.has(leftUid)) {
            const leftName = prevCache[leftUid]?.name || leftUid;
            this.pushRoomSystemMessage(roomId, `${leftName} вышел из комнаты`);
          }
        });
      }
    });
    AppState.roomSubscriptions.push(() => {
      pUnsub();
      remove(presenceRef);
    });

    const vid = Utils.$("native-player");
    if (vid) {
      vid.onplay = () => {
        if (
          !AppState.ignoreVideoEvents &&
          !window._isSyncingVideo &&
          this.hasPerm("player")
        )
          set(syncRef, {
            type: "play",
            state: "playing",
            time: vid.currentTime,
            ts: Date.now(),
          });
      };
      vid.onpause = () => {
        if (
          !AppState.ignoreVideoEvents &&
          !window._isSyncingVideo &&
          this.hasPerm("player")
        )
          set(syncRef, {
            type: "pause",
            state: "paused",
            time: vid.currentTime,
            ts: Date.now(),
          });
      };
      vid.onseeked = () => {
        if (
          !AppState.ignoreVideoEvents &&
          !window._isSyncingVideo &&
          this.hasPerm("player")
        )
          set(syncRef, {
            type: "seek",
            state: vid.paused ? "paused" : "playing",
            time: vid.currentTime,
            ts: Date.now(),
          });
      };
      vid.ontimeupdate = () => {
        if (vid.duration > 0) {
          AppState.currentVideoCurrentTime = vid.currentTime;
          AppState.currentVideoDuration = vid.duration;
          AppState.currentVideoProgress = Math.min(1, Math.max(0, vid.currentTime / vid.duration));
        }
      };
      vid.onended = () => {
        if (
          !AppState.ignoreVideoEvents &&
          !window._isSyncingVideo &&
          this.hasPerm("player")
        ) {
          set(syncRef, {
            type: "pause",
            state: "paused",
            time: vid.duration || vid.currentTime,
            ts: Date.now(),
          }).catch(() => {});
        }
      };
    }

    const sUnsub = onValue(syncRef, (snap) => {
      const d = snap.val();
      if (!d) {
        setTimeout(() => (AppState.ignoreVideoEvents = false), 1000);
        return;
      }

      if (AppState.enteredEmptyRoomAsNonHost && !AppState.isHost) {
        if (d.state === "playing" || d.type === "play") {
          d.state = "paused";
          d.type = "pause";
        }
      }

      AppState.lastKnownSyncState = d;
      RoomManager.forceSyncVideo(d);
    });
    AppState.roomSubscriptions.push(sUnsub);

    const hostHeartbeatTimer = setInterval(() => {
      if (
        !AppState.isHost ||
        !AppState.currentRoomId ||
        window._isSyncingVideo ||
        AppState.ignoreVideoEvents
      )
        return;
      const currentRoom =
        AppState.roomsCache.get(AppState.currentRoomId) || {};
      const isYt = MediaResolverClient.extractYouTubeId(
        currentRoom.videoSourceUrl || currentRoom.videoUrl,
      );
      const isRt = MediaResolverClient.extractRutubeId(
        currentRoom.videoSourceUrl || currentRoom.videoUrl,
      );
      const isVk = MediaResolverClient.extractVkInfo(
        currentRoom.videoSourceUrl || currentRoom.videoUrl,
      );
      const Manager = isYt
        ? YouTubePlayerManager
        : isRt
          ? RutubePlayerManager
          : isVk
            ? VkPlayerManager
            : null;
      const nativeVid = Utils.$("native-player");

      let isPlaying = false;
      let curTime = 0;
      if (Manager && Manager.player) {
        isPlaying = Manager.getState
          ? Manager.getState() === "playing"
          : false;
        curTime = Manager.getCurrentTime ? Manager.getCurrentTime() : 0;
      } else if (nativeVid && nativeVid.src) {
        isPlaying = !nativeVid.paused;
        curTime = nativeVid.currentTime || 0;
      }

      if (isPlaying && curTime > 0) {
        set(syncRef, {
          type: "heartbeat",
          state: "playing",
          time: curTime,
          ts: Date.now(),
        }).catch(() => {});
      }
    }, 3500);
    AppState.roomSubscriptions.push(() => clearInterval(hostHeartbeatTimer));

    const chatActionRef = ref(db, `rooms/${roomId}/chatAction`);
    const caUnsub = onValue(chatActionRef, (snap) => {
      const data = snap.val();
      if (data?.type === "thanosSnap" && Date.now() - data.ts < 10000) {
        const marker = `thanosSeen:${data.ts}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, "1");

        document.querySelectorAll(".m-line").forEach((el) => {
          el.style.transition = `transform ${1 + Math.random()}s cubic-bezier(.36,.07,.19,.97), opacity 1s, filter 1s`;
          el.style.transform = `translateX(${Math.random() > 0.5 ? 50 : -50}px) translateY(-20px) rotate(${Math.random() * 20 - 10}deg) scale(0.9)`;
          el.style.filter = `blur(${2 + Math.random() * 5}px)`;
          el.style.opacity = "0";
          setTimeout(() => el.remove(), 2000);
        });

        if (AppState.isHost) {
          setTimeout(() => {
            set(chatRef, null); // Actually clear DB chat
          }, 500);
        }
      }
    });
    AppState.roomSubscriptions.push(caUnsub);

    let myCursorSyncInterval = null;
    const screenEl = document.getElementById("room-screen");
    const updateMyCursor = (e) => {
      if (!screenEl) return;
      const rect = screenEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      window._myLastCursorPos = { x, y };
    };
    const csUnsub = onValue(ref(db, `rooms/${roomId}/cursorSync`), (snap) => {
      const isActive = !!snap.val();
      if (isActive) {
        document.addEventListener("mousemove", updateMyCursor);
        myCursorSyncInterval = setInterval(() => {
          if (window._myLastCursorPos) {
            set(ref(db, `rooms/${roomId}/cursors/${uid}`), {
              x: window._myLastCursorPos.x,
              y: window._myLastCursorPos.y,
              ts: Date.now(),
            });
          }
        }, 200);
      } else {
        document.removeEventListener("mousemove", updateMyCursor);
        if (myCursorSyncInterval) clearInterval(myCursorSyncInterval);
        set(ref(db, `rooms/${roomId}/cursors/${uid}`), null);
        document
          .querySelectorAll(".quantum-cursor")
          .forEach((el) => el.remove());
      }
    });
    AppState.roomSubscriptions.push(csUnsub);
    AppState.roomSubscriptions.push(() => {
      document.removeEventListener("mousemove", updateMyCursor);
      if (myCursorSyncInterval) clearInterval(myCursorSyncInterval);
      document.querySelectorAll(".quantum-cursor").forEach((el) => el.remove());
    });

    const curUnsub = onValue(ref(db, `rooms/${roomId}/cursors`), (snap) => {
      const activeCursors = snap.val() || {};
      const screen = document.getElementById("room-screen");
      if (!screen) return;
      const rect = screen.getBoundingClientRect();

      Object.keys(activeCursors).forEach((cId) => {
        let el = document.getElementById(`cursor-${cId}`);
        if (cId === uid || Date.now() - activeCursors[cId].ts > 3000) {
          if (el) el.remove();
          return;
        }
        if (!el) {
          el = document.createElement("div");
          el.id = `cursor-${cId}`;
          el.className = "quantum-cursor";
          const fallbackChar = (AppState.usersCache.get(cId)?.name ||
            "?")[0].toUpperCase();
          el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" style="position:absolute; top:-12px; left:-12px; z-index:1;"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><div style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.8); color:#0ff; font-size:10px; border-radius:10px; padding:2px 6px; white-space:nowrap; border:1px solid rgba(0,255,255,0.3); z-index:2;">${AppState.usersCache.get(cId)?.name || "Анон"}</div>`;
          el.style.cssText = `position:absolute; pointer-events:none; z-index:500; transition: transform 0.2s linear;`;
          screen.appendChild(el);
        }
        const px = activeCursors[cId].x * rect.width;
        const py = activeCursors[cId].y * rect.height;
        el.style.transform = `translate(${px}px, ${py}px)`;
      });
      // Cleanup obsolete
      document.querySelectorAll(".quantum-cursor").forEach((el) => {
        const id = el.id.replace("cursor-", "");
        if (!activeCursors[id]) el.remove();
      });
    });
    AppState.roomSubscriptions.push(curUnsub);

    const roomJoinTime = Date.now();
    let processedMsgs = new Set();
    const cUnsub = onChildAdded(chatRef, (snap) => {
      const msg = snap.val();
      const id = snap.key;
      if (processedMsgs.has(id)) return;
      processedMsgs.add(id);
      if (
        msg?.shadowbanned &&
        msg.uid !== uid &&
        !AdminPanel.isCurrentUserAdmin()
      )
        return;
      if (msg?.type === "system") {
        const systemLine = document.createElement("div");
        systemLine.className = "sys-msg";
        systemLine.innerText = msg.text || "";
        const chatBox = Utils.$("chat-messages");
        if (chatBox) {
          chatBox.appendChild(systemLine);
          if (chatBox.childElementCount > 200) chatBox.firstElementChild?.remove();
          chatBox.scrollTop = chatBox.scrollHeight;
        }
        return;
      }

      const isMe = msg.uid === uid;
      const line = document.createElement("div");
      line.className = `m-line ${isMe ? "self" : ""}`;

      let content = "";
      if (msg.type === "media" && msg.url) {
        const isImg =
          String(msg.url).match(/\.(gif|jpe?g|png|webp|bmp)$/i) ||
          String(msg.url).match(/tenor\.com|giphy\.com|imgur\.com/i) ||
          String(msg.url).startsWith("data:image/");
        content = isImg
          ? `<div style="padding:4px;"><img src="${Utils.escapeHtml(msg.url)}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x150?text=Error';" /></div>`
          : `<div style="padding:4px;"><a href="${Utils.escapeHtml(msg.url)}" target="_blank" style="color: var(--accent); padding: 8px; display: inline-block;"><img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Paperclip.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">Прикрепленный файл</a></div>`;
      } else {
        content = Utils.escapeHtml(msg.text || "");
        content = content.replace(
          /(\d{1,2}:\d{2})/g,
          '<span class="timecode-btn" data-time="$1">$1</span>',
        );
      }

      const fallbackChar = (msg.name || "?")[0].toUpperCase();

      const avatarHtml = `<div class="chat-avatar-placeholder" style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${fallbackChar}</div>`;

      // Overlay display
      const overlayContainer = Utils.$("chat-overlay-container");
      if (overlayContainer && !isMe && msg.ts >= roomJoinTime) {
        const overlayEl = document.createElement("div");
        const avHtml = ProfileManager.getAvatarHtml(
          AppState.usersCache.get(msg.uid) || { name: msg.name, avatar: null },
        );

        overlayEl.style.cssText = `
                    background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
                    padding: 8px 12px; display: flex; align-items: center; gap: 8px;
                    color: #fff; font-size: 14px; animation: chatOverlayFade 4s forwards;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4); pointer-events: none;
                `;
        overlayEl.innerHTML = `
                    <div style="width:28px; height:28px; border-radius: 50%; overflow:visible; flex-shrink:0;">${avHtml}</div>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="font-size:11px; font-weight:bold; color: var(--accent);">${Utils.escapeHtml(msg.name)}</span>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 250px;">${content}</span>
                    </div>
                `;
        overlayContainer.appendChild(overlayEl);
        setTimeout(() => {
          if (overlayEl.parentNode) overlayEl.remove();
        }, 4000);
      }

      line.innerHTML = `
                <div style="display:flex; gap:8px; align-items:flex-end; max-width:100%; ${isMe ? "flex-direction:row-reverse;" : ""}">
                    <div class="chat-profile-link" data-uid="${Utils.escapeHtml(msg.uid || "")}" style="width:26px; height:26px; border-radius:50%; flex-shrink:0; cursor:pointer; overflow:visible; border:1px solid var(--border-light); background:rgba(255,255,255,0.05); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 0 8px rgba(255,255,255,0.2)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
                        ${avatarHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; ${isMe ? "align-items:flex-end;" : "align-items:flex-start;"} max-width:85%;">
                        <strong class="profile-open-link chat-profile-link ${window.PremiumManager ? PremiumManager.getChatNameClass(AppState.usersCache.get(msg.uid) || {}, msg.uid) : ""}" data-uid="${Utils.escapeHtml(msg.uid || "")}" style="font-size:11px; margin-bottom:4px; opacity:0.75; padding:0 4px;">${window.PremiumManager ? PremiumManager.getStatusEmojiHtml(AppState.usersCache.get(msg.uid) || {}, msg.uid) : ""}${Utils.escapeHtml(msg.name)}</strong>
                        <div class="bubble" style="max-width:100%;">${content}</div>
                    </div>
                </div>
            `;

      ProfileManager.loadUser(msg.uid).then((uProfile) => {
        if (uProfile) {
          line
            .querySelectorAll(".chat-profile-link[data-uid]")
            .forEach((container) => {
              if (container.tagName === "STRONG") return;
              container.innerHTML = ProfileManager.getAvatarHtml(uProfile);
            });
          const nameEl = line.querySelector("strong.profile-open-link");
          if (nameEl && window.PremiumManager) {
            nameEl.className = `profile-open-link chat-profile-link ${PremiumManager.getChatNameClass(uProfile, msg.uid)}`;
            nameEl.innerHTML = `${PremiumManager.getStatusEmojiHtml(uProfile, msg.uid)}${Utils.escapeHtml(msg.name)}`;
          }
        }
      });

      line.querySelectorAll(".timecode-btn").forEach((btn) => {
        btn.onclick = () => {
          if (!this.hasPerm("player"))
            return Utils.toast("Нет прав на управление плеером", "error");
          const parts = btn.dataset.time.split(":");
          const secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          AppState.ignoreVideoEvents = true;
          if (YouTubePlayerManager.player) {
            YouTubePlayerManager.seek(secs);
            YouTubePlayerManager.play();
          } else if (RutubePlayerManager.player) {
            RutubePlayerManager.seek(secs);
            RutubePlayerManager.play();
          } else if (VkPlayerManager.player) {
            VkPlayerManager.seek(secs);
            VkPlayerManager.play();
          } else if (vid) {
            vid.currentTime = secs;
            vid.play().catch(() => {});
          }
          setTimeout(() => (AppState.ignoreVideoEvents = false), 500);
          set(syncRef, { type: "seek", state: "playing", time: secs, ts: Date.now() });
        };
      });
      line.querySelectorAll(".chat-profile-link").forEach((btn) => {
        if (msg.uid)
          btn.onclick = () => RoomManager.showUserMiniature(msg.uid);
      });

      const chatBox = Utils.$("chat-messages");
      if (chatBox) {
        chatBox.appendChild(line);
        if (chatBox.childElementCount > 200) chatBox.firstElementChild?.remove();
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    });
    AppState.roomSubscriptions.push(cUnsub);

    const roomAttachBtn = Utils.$("btn-room-attach");
    if (roomAttachBtn) {
      roomAttachBtn.onclick = () => {
        if (!this.hasPerm("chat")) return;
        if (AdminPanel.isSystemReadOnlyForUser())
          return Utils.toast("Система в режиме ReadOnly", "error");

        const inputImg = document.createElement("input");
        inputImg.type = "file";
        inputImg.accept = "image/*";
        inputImg.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          Utils.toast("Обработка картинки...", "info");
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = new Image();
            img.onload = async () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              canvas.getContext("2d").drawImage(img, 0, 0);
              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);

              let sendUid = uid;
              let sendName =
                AppState.usersCache.get(AppState.currentUser.uid)?.name ||
                AppState.currentUser.displayName ||
                "Пользователь";

              if (window.puppeteerUid && AdminPanel.isCurrentUserAdmin()) {
                sendUid = window.puppeteerUid;
                sendName = AppState.usersCache.get(sendUid)?.name || sendUid;
              }

              await push(chatRef, {
                uid: sendUid,
                name: sendName,
                text: "",
                type: "media",
                url: compressedBase64,
                ts: Date.now(),
                badges: AppState.usersCache.get(sendUid)?.badges || [],
              });
            };
            img.src = re.target.result;
          };
          reader.readAsDataURL(file);
        };
        inputImg.click();
      };
    }

    Utils.$("send-btn").onclick = async () => {
      if (
        !SecurityManager.validateAction("chat_message", {
          count: 10,
          timeWindowMs: 10000,
        })
      )
        return;
      const input = Utils.$("chat-input");
      if (!input.value.trim() || !this.hasPerm("chat")) return;
      if (
        !SecurityManager.validateTextPayload(input.value.trim(), 2000, "chat")
      )
        return;
      if (AdminPanel.isSystemReadOnlyForUser())
        return Utils.toast("Система в режиме ReadOnly", "error");
      if (
        AppState.admin.settings.globalChatLocked &&
        !AdminPanel.isCurrentUserAdmin()
      )
        return Utils.toast("Глобальный чат временно заблокирован", "error");
      const text = input.value.trim();
      const meModerationSnap = await get(ref(db, `users/${uid}/moderation`));
      const meModeration = meModerationSnap.val() || {};
      if (meModeration.muted && !AdminPanel.isCurrentUserAdmin())
        return Utils.toast("Вы заглушены модератором", "error");
      const wasHandled = await EasterEggManager.handleChatInput(
        text,
        chatRef,
        uid,
      );
      if (!wasHandled) {
        if (text.startsWith("/bet ")) {
          const parts = text.split(" ");
          const xpAmount = parseInt(parts[1], 10);
          if (!isNaN(xpAmount) && xpAmount > 0) {
            const betDesc = parts.slice(2).join(" ") || "неопределенный исход";
            await push(chatRef, {
              uid: "system_bet",
              name: "СИСТЕМА СТАВОК",
              text: `🎰 ${AppState.usersCache.get(uid)?.name || "Пользователь"} ставит ${xpAmount} XP на: "${betDesc}" !`,
              ts: Date.now(),
            });
            input.value = "";
            return;
          }
        } else if (text.startsWith("/roll")) {
          const roll = Math.floor(Math.random() * 100) + 1;
          await push(chatRef, {
            uid: "system_dice",
            name: "СИСТЕМА КОСТЕЙ",
            text: `🎲 ${AppState.usersCache.get(uid)?.name || "Пользователь"} бросает кости и выбивает: ${roll} из 100!`,
            ts: Date.now(),
          });
          input.value = "";
          return;
        }

        let sendUid = uid;
        let sendName =
          AppState.usersCache.get(AppState.currentUser.uid)?.name ||
          AppState.currentUser.displayName ||
          "Пользователь";

        if (window.puppeteerUid && AdminPanel.isCurrentUserAdmin()) {
          sendUid = window.puppeteerUid;
          sendName =
            AppState.usersCache.get(sendUid)?.name || "Аноним (Кукловод)";
        }

        let finalOutput = text;
        try {
          const curseSnap = await get(ref(db, `admin/curses/uwu/${sendUid}`));
          const curseTime = curseSnap.val();
          // 5 minutes
          if (curseTime && Date.now() - curseTime < 300000) {
            finalOutput =
              finalOutput
                .replace(/[рл]/g, "w")
                .replace(/[РЛ]/g, "W")
                .replace(/ч/g, "c") + " uwu :3";
          }
        } catch (e) {}

        if (window.isShadowCloneActive && AdminPanel.isCurrentUserAdmin()) {
          await push(chatRef, {
            uid: sendUid,
            name: sendName,
            text: finalOutput,
            ts: Date.now(),
          });
          const roomKeys = Object.keys(AppState.currentPresenceCache || {});
          if (roomKeys.length > 0) {
            for (let i = 0; i < 5; i++) {
              const rUid =
                roomKeys[Math.floor(Math.random() * roomKeys.length)];
              const rName = AppState.currentPresenceCache[rUid]?.name || "Клон";
              await push(chatRef, {
                uid: rUid,
                name: rName,
                text: finalOutput,
                ts: Date.now() + i + 1,
              });
            }
          }
        } else {
          await push(chatRef, {
            uid: sendUid,
            name: sendName,
            text: finalOutput,
            ts: Date.now(),
            shadowbanned: Boolean(meModeration.shadowban),
          });
        }
      }
      input.value = "";
    };
    let roomTypingTimeout = null;
    Utils.$("chat-input").oninput = () => {
      if (!AppState.currentRoomId || !AppState.currentUser) return;
      const refT = ref(
        db,
        `rooms/${AppState.currentRoomId}/typing/${AppState.currentUser.uid}`,
      );
      set(refT, true);
      if (roomTypingTimeout) clearTimeout(roomTypingTimeout);
      roomTypingTimeout = setTimeout(() => {
        set(refT, null);
      }, 3000);
    };

    Utils.$("chat-input").onkeydown = (e) => {
      if (e.key === "Enter") Utils.$("send-btn").click();
    };

    document.querySelectorAll(".react-btn").forEach((btn) => {
      btn.onclick = () => {
        if (
          !SecurityManager.validateAction(
            "react_message",
            {
              count: 15,
              timeWindowMs: 4000,
            },
            true,
          )
        )
          return;
        if (!this.hasPerm("reactions")) return;
        if (AdminPanel.isSystemReadOnlyForUser())
          return Utils.toast("Система в режиме ReadOnly", "error");
        if (
          AppState.admin.settings.globalReactionsBlocked &&
          !AdminPanel.isCurrentUserAdmin()
        )
          return Utils.toast("Глобальные реакции временно отключены", "error");
        push(reactionsRef, { emoji: btn.dataset.emoji, ts: Date.now() });
      };
    });
    const rUnsub = onChildAdded(reactionsRef, (snap) => {
      const rx = snap.val();
      if (Date.now() - rx.ts > 5000) return;
      const el = document.createElement("div");
      el.className = "floating-emoji";
      const imgMap = {
        "🔥": "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp",
        "😂": "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Face%20With%20Tears%20Of%20Joy.webp",
        "😱": "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Face%20Screaming%20In%20Fear.webp",
        "❤️": "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Red%20Heart.webp",
        "👏": "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Clapping%20Hands.webp",
      };
      if (imgMap[rx.emoji]) {
        el.innerHTML = `<img src="${imgMap[rx.emoji]}" style="width: 48px; height: 48px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));">`;
      } else {
        el.innerText = rx.emoji;
      }
      el.style.left = `${Math.random() * 80 + 10}%`;
      
    const overlay = Utils.$("room-video-overlay");
    if (overlay) overlay.appendChild(el);
    else document.body.appendChild(el);

      setTimeout(() => el.remove(), 3000);
    });
    AppState.roomSubscriptions.push(rUnsub);
    EasterEggManager.bindRoom(roomId);

    
    const rcChat = Utils.$("chat-messages");
    const rcUsers = Utils.$("users-list");
    const btnTabChat = Utils.$("btn-tab-chat");
    const btnTabUsers = Utils.$("btn-tab-users");
    let currentTab = "chat";

    const setRoomTab = (name) => {
      currentTab = name;
      if (rcChat) rcChat.style.display = name === "chat" ? "flex" : "none";
      if (rcUsers) rcUsers.style.display = name === "users" ? "flex" : "none";
      
      const inputArea = document.querySelector(".chat-input-area");
      if (inputArea) inputArea.style.display = name === "chat" ? "flex" : "none";

      if (btnTabChat) {
          btnTabChat.style.background = name === "chat" ? "rgba(255,255,255,0.1)" : "transparent";
          btnTabChat.style.color = name === "chat" ? "#fff" : "rgba(255,255,255,0.6)";
      }
      if (btnTabUsers) {
          btnTabUsers.style.background = name === "users" ? "rgba(255,255,255,0.1)" : "transparent";
          btnTabUsers.style.color = name === "users" ? "#fff" : "rgba(255,255,255,0.6)";
      }
    };
    
    if (btnTabChat) btnTabChat.onclick = () => setRoomTab("chat");
    if (btnTabUsers) btnTabUsers.onclick = () => setRoomTab("users");

    const micBtn = Utils.$("btn-toggle-mic");
    if (micBtn) {
      micBtn.onclick = () => {
        RTCManager.toggleMic();
      };
    }

    window._setRoomTab = setRoomTab;

    
  }

  static hasPerm(permName) {
    if (AppState.isHost || AdminPanel.isCurrentUserCreator()) return true;
    const myData = AppState.currentPresenceCache[AppState.currentUser.uid];
    return myData && myData.perms && myData.perms[permName] === true;
  }

  static applyLocalPermissions() {
    const pPlayer = this.hasPerm("player");
    const pChat = this.hasPerm("chat");
    const pVoice = this.hasPerm("voice");
    const pReactions = this.hasPerm("reactions");

    const vid = Utils.$("native-player");
    if (vid) {
      vid.controls = pPlayer;
    }

    const overlay = Utils.$("room-video-overlay");
    if (overlay) {
      overlay.style.pointerEvents = pPlayer ? "none" : "auto";
      overlay.style.cursor = pPlayer ? "default" : "not-allowed";
      overlay.onclick = (e) => {
        if (!this.hasPerm("player")) {
          e.preventDefault();
          e.stopPropagation();
          Utils.toast("Управление воспроизведением доступно только хосту", "info");
        }
      };
    }

    const ytContainer = Utils.$("yt-player-container");
    if (ytContainer) {
      const iframe = ytContainer.querySelector("iframe");
      if (iframe) {
        iframe.style.pointerEvents = pPlayer ? "auto" : "none";
      }
    }
    if (VkPlayerManager.iframe) {
      VkPlayerManager.iframe.style.pointerEvents = pPlayer ? "auto" : "none";
    }

    Utils.$("chat-input").disabled = !pChat;
    Utils.$("send-btn").disabled = !pChat;

    document
      .querySelectorAll(".react-btn")
      .forEach((b) => (b.disabled = !pReactions));
    document.querySelectorAll(".timecode-btn").forEach((b) => {
      if (pPlayer) b.classList.remove("disabled");
      else b.classList.add("disabled");
    });

    const micBtn = Utils.$("btn-toggle-mic");
    if (micBtn) {
      micBtn.style.display = pVoice ? "inline-flex" : "none";
    }

    if (!pVoice && RTCManager.isMicActive) RTCManager.toggleMic(true);
  }

  static rerenderUsersList() {
    const container = Utils.$("users-list");
    const cache = AppState.currentPresenceCache || {};
    const ids = Object.keys(cache);
    let outsideFriendsHtml = "";
    const renderToken = ++AppState.usersListRenderToken;
    const renderRoomId = AppState.currentRoomId;

    this.updateUsersTabButton(ids, cache);
    container.innerHTML = "";

    const ensureActualRender = () => {
      if (renderToken !== AppState.usersListRenderToken) return false;
      if (!AppState.currentRoomId || AppState.currentRoomId !== renderRoomId)
        return false;
      return true;
    };

    if (AppState.currentUser) {
      get(ref(db, `users/${AppState.currentUser.uid}/friends`)).then((snap) => {
        if (!ensureActualRender()) return;

        const fr = snap.val() || {};
        const friendsIds = Object.keys(fr).filter(
          (k) => fr[k].status === "accepted" && !ids.includes(k),
        );
        if (friendsIds.length > 0) {
          let inviteHtml = `<div style="font-size:11px; color:var(--text-muted); margin: 15px 0 5px; text-transform:uppercase;">Друзья вне комнаты</div>`;
          friendsIds.forEach((fid) => {
            const cachedP = AppState.usersCache.get(fid);
            const initName = cachedP ? Utils.escapeHtml(cachedP.name) : "Загрузка...";
            inviteHtml += `
                            <div class="user-item" style="background: rgba(46,213,115,0.05); border: 1px solid rgba(46,213,115,0.2);">
                                <div class="user-main" style="flex:1;"><span class="user-name" id="inv-name-${fid}">${initName}</span></div>
                                <button class="primary-btn" style="width:auto; padding:4px 8px; font-size:11px;" onclick="DirectMessages.sendRoomInvite('${fid}')">Пригласить</button>
                            </div>
                        `;
            ProfileManager.loadUser(fid).then(async (p) => {
              if (!ensureActualRender() || !p) return;
              const st =
                (await get(ref(db, `users/${fid}/status`))).val() || {};
              if (!ensureActualRender()) return;
              const isOnline = st.online;
              const statusText = isOnline
                ? "Онлайн"
                : st.lastSeen
                  ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}`
                  : "Офлайн";
              if (Utils.$(`inv-name-${fid}`)) {
                Utils.$(`inv-name-${fid}`).innerHTML =
                  `<div style="display:flex; flex-direction:column;"><div style="display:flex; align-items:center;"><div class="indicator ${isOnline ? "online" : ""}" style="width:8px;height:8px;border-radius:50%;background:${isOnline ? "#4caf50" : "#888"};margin-right:6px;"></div>${Utils.escapeHtml(p.name)}</div><span style="font-size:10px; color:var(--text-muted); margin-top:2px;">${statusText}</span></div>`;
              }
            });
          });
          outsideFriendsHtml = inviteHtml;
        }
        renderRoomUsers(fr);
      });
    } else {
      renderRoomUsers({});
    }

    function renderRoomUsers(myFriends = {}) {
      if (!ensureActualRender()) return;
      container.innerHTML += `<div style="font-size:11px; color:var(--text-muted); margin: 10px 0 5px; text-transform:uppercase;">В комнате</div>`;
      ids.forEach((uid) => {
        const user = cache[uid];
        const isLocal = uid === AppState.currentUser.uid;

        // Проверяем, является ли юзер оригинальным хостом ИЛИ создателем (Developer)
        const profile = AppState.usersCache.get(uid) || {};
        const isTargetHost =
          AppState.roomsCache.get(AppState.currentRoomId)?.hostId === uid ||
          AdminPanel.isCreatorProfile(profile, uid);
        const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);

        let html = `<div class="user-wrapper" style="margin-bottom:8px;">`;
        let premiumStyle = "";
        const isPremium = window.PremiumManager
          ? PremiumManager.isPremiumActive(profile, uid)
          : false;
        if (isPremium) {
          premiumStyle = `background: radial-gradient(circle at 20% 0%, rgba(255, 180, 60, 0.18), transparent 45%), radial-gradient(circle at 90% 100%, rgba(255, 120, 40, 0.12), transparent 40%), linear-gradient(145deg, rgba(24, 20, 14, 0.96), rgba(10, 10, 12, 0.98)); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 220, 140, 0.08); border: 1px solid rgba(255, 200, 100, 0.22);`;
        }
        const isSpeaking =
          user.speaking ||
          (typeof RTCManager !== "undefined" &&
            (RTCManager.isUserSpeaking(uid) || RTCManager.currentSpeakerUid === uid));
        let speakingClass = isSpeaking ? " speaking" : "";
        html += `<div class="user-item${speakingClass}" data-uid="${uid}" style="${premiumStyle}">`;
        html += `<div class="indicator online" style="margin-right:8px;"></div>`;
        html += `<div class="room-user-avatar-wrap room-user-profile-link" data-uid="${uid}" style="width:24px;height:24px;flex-shrink:0;margin-right:8px;border-radius:50%;cursor:pointer;">${ProfileManager.getAvatarHtml(profile)}</div>`;
        html += `<div class="user-main" style="flex:1;display:flex;align-items:center;gap:4px;"><span class="user-name profile-open-link room-user-profile-link" data-uid="${uid}" style="cursor:pointer;">${Utils.escapeHtml(user.name)}</span>${roleBadgeHtml}<span class="voice-wave"><i></i><i></i><i></i><i></i></span></div>`;
        if (isTargetHost) html += `<span class="host-label">Host</span>`;
        if (isLocal) html += `<span class="you-label">(Вы)</span>`;

        if (!isLocal) {
          
        }
        html += `</div>`;

        html += `<div class="user-card-actions">`;
        if (!isLocal) {
          html += `<button class="dm-btn" data-uid="${uid}">ЛС</button>`;
          const fStatus = myFriends[uid]?.status;
          if (fStatus === "accepted") {
            // Already friends
          } else if (FriendsManager.pendingFriendRequestsMap[uid]) {
            html += `<button class="add-friend-btn accept-friend-btn" data-uid="${uid}" style="background:var(--accent); color:#000;">✓ Принять</button>`;
          } else if (FriendsManager.sentFriendRequests.has(uid)) {
            html += `<button class="add-friend-btn" data-uid="${uid}" disabled style="opacity:0.5;">Запрос отправлен</button>`;
          } else {
            html += `<button class="add-friend-btn" data-uid="${uid}">+Друг</button>`;
          }
        }
        if (
          (AppState.isHost || AdminPanel.isCurrentUserCreator()) &&
          !isLocal
        ) {
          html += `<button class="viewer-settings-btn" data-uid="${uid}" title="Настройки зрителя">Настр.</button>`;
        }
        html += `</div>`;

        // Управление пермиссиями доступно хосту и разработчику
        if (
          (AppState.isHost || AdminPanel.isCurrentUserCreator()) &&
          !isLocal
        ) {
          const perms = user.perms || {};
          html += `
                        <div class="viewer-settings-panel" id="viewer-settings-${uid}">
                            <div class="perm-controls" style="margin-top:0; padding-top:0; border-top:none;">
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="chat" ${perms.chat ? "checked" : ""}> Чат</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="voice" ${perms.voice ? "checked" : ""}> Микрофон</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="player" ${perms.player ? "checked" : ""}> Плеер</label>
                                <label><input type="checkbox" class="p-toggle" data-uid="${uid}" data-p="reactions" ${perms.reactions ? "checked" : ""}> Реакции</label>
                            </div>
                            <button class="danger-btn room-kick-btn" data-uid="${uid}" style="margin-top:8px;">Кикнуть из комнаты</button>
                        </div>
                    `;
        }
        html += `</div>`;
        container.innerHTML += html;
      });
      if (outsideFriendsHtml) {
        container.innerHTML += outsideFriendsHtml;
      }

      container.querySelectorAll(".dm-btn").forEach((btn) => {
        btn.onclick = () => {
          const name = btn
            .closest(".user-item")
            .querySelector(".user-name").innerText;
          DirectMessages.openChat(btn.dataset.uid, name);
        };
      });
      container.querySelectorAll(".room-user-profile-link").forEach((node) => {
        node.onclick = () =>
          RoomManager.showUserMiniature(node.dataset.uid);
      });
      container.querySelectorAll(".add-friend-btn").forEach((btn) => {
        btn.onclick = () => {
          if (btn.classList.contains("accept-friend-btn")) {
            FriendsManager.handleRequest(btn.dataset.uid, true);
          } else if (btn.disabled) {
            return;
          } else {
            FriendsManager.sendFriendRequest(btn.dataset.uid);
          }
        };
      });
      
      container.querySelectorAll(".viewer-settings-btn").forEach((btn) => {
        btn.onclick = () => {
          const panel = Utils.$(`viewer-settings-${btn.dataset.uid}`);
          if (panel) panel.classList.toggle("open");
        };
      });
      container.querySelectorAll(".p-toggle").forEach((t) => {
        t.onchange = async (e) => {
          const targetUid = e.target.dataset.uid;
          const perm = e.target.dataset.p;
          const val = e.target.checked;
          await set(
            ref(
              db,
              `rooms/${AppState.currentRoomId}/presence/${targetUid}/perms/${perm}`,
            ),
            val,
          );
          const targetName =
            AppState.currentPresenceCache?.[targetUid]?.name || targetUid;
          await this.pushRoomSystemMessage(
            AppState.currentRoomId,
            `${this.getActorLabel()} ${val ? "разрешил" : "запретил"} "${perm}" для ${targetName}`,
          );
        };
      });
      container.querySelectorAll(".room-kick-btn").forEach((btn) => {
        btn.onclick = async () => {
          const targetUid = btn.dataset.uid;
          const targetName =
            AppState.currentPresenceCache?.[targetUid]?.name || targetUid;
          if (!(await Utils.confirm(`Кикнуть ${targetName} из комнаты?`)))
            return;
          await this.kickUserFromCurrentRoom(targetUid);
        };
      });
    }
  }

  static updateUsersTabButton(ids = [], cache = {}) {
    const list = Array.isArray(ids) ? ids : [];
    const count = list.length;
    const countEl = document.getElementById("users-count");
    if (countEl) {
       countEl.innerText = count.toString();
    }
  }


  static forceSyncVideo(d = AppState.lastKnownSyncState) {
    if (!d) return;
    const vid = Utils.$("native-player");

    const ageSec = (Date.now() - d.ts) / 1000;
    let state = d.state || (d.type === "play" ? "playing" : "paused");
    let targetTime = d.time;

    if (state === "playing" && ageSec > 1.0) {
      targetTime += ageSec;
    }

    const currentRoom =
      AppState.roomsCache.get(AppState.currentRoomId) ||
      AppState.currentRoomData ||
      {};

    // Prevent auto-play when entering an empty room as a non-host
    const pres = AppState.currentPresenceCache || currentRoom.presence || {};
    const otherPresIds = Object.keys(pres).filter((u) => u !== AppState.currentUser?.uid);
    const roomIsEmpty = otherPresIds.length === 0;
    const hostId = currentRoom.hostId || currentRoom.hostUid || AppState.currentRoomData?.hostId;
    const isHostInRoom = hostId ? Boolean(pres[hostId]) : false;

    if (!AppState.isHost && (roomIsEmpty || !isHostInRoom || AppState.enteredEmptyRoomAsNonHost)) {
      if (state === "playing") {
        state = "paused";
        if (AppState.lastKnownSyncState) {
          AppState.lastKnownSyncState.state = "paused";
        }
      }
    }

    const isYt = MediaResolverClient.extractYouTubeId(
      currentRoom.videoSourceUrl || currentRoom.videoUrl,
    );
    const isRt = MediaResolverClient.extractRutubeId(
      currentRoom.videoSourceUrl || currentRoom.videoUrl,
    );
    const isVk = MediaResolverClient.extractVkInfo(
      currentRoom.videoSourceUrl || currentRoom.videoUrl,
    );

    if (
      (YouTubePlayerManager.player && isYt) ||
      (RutubePlayerManager.player && isRt) ||
      (VkPlayerManager.player && isVk)
    ) {
      if (AppState.isHost && d.type !== "seek") {
        return;
      }

      window._isSyncingVideo = true;
      AppState.ignoreVideoEvents = true;
      const Manager = isYt
        ? YouTubePlayerManager
        : isRt
          ? RutubePlayerManager
          : VkPlayerManager;
      const currentState = Manager.getState ? Manager.getState() : null;
      const curTime = Manager.getCurrentTime ? Manager.getCurrentTime() : 0;
      const isDirectSeek = d.type === "seek";
      const timeDiff = Math.abs(curTime - targetTime);

      if (isDirectSeek || timeDiff > 1.2) {
        Manager.seek(targetTime);
      }
      if (state === "playing" && currentState !== "playing") {
        Manager.play();
      } else if (state === "paused" && currentState !== "paused") {
        Manager.pause();
      }

      setTimeout(() => {
        AppState.ignoreVideoEvents = false;
        window._isSyncingVideo = false;
      }, 600);
      return;
    }

    if (!vid) return;

    const executeNativeSync = () => {
      window._isSyncingVideo = true;
      AppState.ignoreVideoEvents = true;

      if (Math.abs(vid.currentTime - targetTime) > 1.5) {
        vid.currentTime = targetTime;
      }

      if (state === "playing" && vid.paused) {
        vid.play().catch(() => {
          vid.muted = true;
          vid.play().catch(() => {});
          Utils.toast(
            "Браузер заблокировал автовоспроизведение со звуком. Звук отключен.",
            "warn",
          );
        });
      } else if (state === "paused" && !vid.paused) {
        vid.pause();
      }

      setTimeout(() => {
        AppState.ignoreVideoEvents = false;
        window._isSyncingVideo = false;
      }, 1500);
    };

    if (vid.readyState >= 1) {
      executeNativeSync();
    } else {
      const onLoadedMetadata = () => {
        executeNativeSync();
        vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
      vid.addEventListener("loadedmetadata", onLoadedMetadata);
    }
  }


  static isRoomVideoPlaying() {
    if (!AppState.currentRoomId) return false;

    // 1. YouTube Player
    const yt = typeof YouTubePlayerManager !== "undefined" ? YouTubePlayerManager : window.YouTubePlayerManager;
    if (yt && yt.player) {
      if (typeof yt.getState === "function") {
        const st = yt.getState();
        if (st === "playing") return true;
        if (st === "paused" || st === "ended") return false;
      }
      if (typeof yt.player.getPlayerState === "function") {
        try {
          const pState = yt.player.getPlayerState();
          if (pState === 1) return true;
          if (pState === 2 || pState === 0) return false;
        } catch (e) {}
      }
    }

    // 2. Rutube Player
    const rt = typeof RutubePlayerManager !== "undefined" ? RutubePlayerManager : window.RutubePlayerManager;
    if (rt && rt.player) {
      if (typeof rt.getState === "function") {
        const rState = rt.getState();
        if (rState === "playing") return true;
        if (rState === "paused" || rState === "stopped" || rState === "ended") return false;
      }
    }

    // 3. VK Player
    const vk = typeof VkPlayerManager !== "undefined" ? VkPlayerManager : window.VkPlayerManager;
    if (vk && vk.player) {
      if (typeof vk.getState === "function") {
        const vState = vk.getState();
        if (vState === "playing") return true;
        if (vState === "paused" || vState === "ended") return false;
      }
    }

    // 4. Vimeo Player
    const vm = typeof VimeoPlayerManager !== "undefined" ? VimeoPlayerManager : window.VimeoPlayerManager;
    if (vm && vm.player) {
      if (typeof vm.getState === "function") {
        const vmState = vm.getState();
        if (vmState === "playing") return true;
        if (vmState === "paused" || vmState === "ended") return false;
      }
    }

    // 5. Native HTML5 Video (direct stream, mp4, screen share)
    const nativeVid = Utils.$("native-player") || Utils.$("room-video-player");
    if (nativeVid && nativeVid.src && nativeVid.style.display !== "none") {
      if (!nativeVid.paused && !nativeVid.ended) {
        return true;
      }
      if (nativeVid.paused || nativeVid.ended) return false;
    }

    // 6. Synced room player state in AppState (fallback when local player state is unknown)
    if (AppState.lastKnownSyncState) {
      if (AppState.lastKnownSyncState.state === "playing") {
        return true;
      } else if (AppState.lastKnownSyncState.state === "paused" || AppState.lastKnownSyncState.state === "ended") {
        return false;
      }
    }

    // 7. Current room data player status (fallback)
    if (AppState.currentRoomData?.player?.state === "playing") {
      return true;
    } else if (AppState.currentRoomData?.player?.state === "paused" || AppState.currentRoomData?.player?.state === "ended") {
      return false;
    }

    return false;
  }

  static getVideoCurrentTime() {
    const yt = typeof YouTubePlayerManager !== "undefined" ? YouTubePlayerManager : window.YouTubePlayerManager;
    if (yt && yt.player && typeof yt.getCurrentTime === "function") {
      const t = yt.getCurrentTime();
      if (typeof t === "number" && !isNaN(t) && t >= 0) return t;
    }
    const rt = typeof RutubePlayerManager !== "undefined" ? RutubePlayerManager : window.RutubePlayerManager;
    if (rt && rt.player && typeof rt.getCurrentTime === "function") {
      const t = rt.getCurrentTime();
      if (typeof t === "number" && !isNaN(t) && t >= 0) return t;
    }
    const vk = typeof VkPlayerManager !== "undefined" ? VkPlayerManager : window.VkPlayerManager;
    if (vk && vk.player && typeof vk.getCurrentTime === "function") {
      const t = vk.getCurrentTime();
      if (typeof t === "number" && !isNaN(t) && t >= 0) return t;
    }
    const vm = typeof VimeoPlayerManager !== "undefined" ? VimeoPlayerManager : window.VimeoPlayerManager;
    if (vm && vm.player && typeof vm.getCurrentTime === "function") {
      const t = vm.getCurrentTime();
      if (typeof t === "number" && !isNaN(t) && t >= 0) return t;
    }
    const vid = Utils.$("native-player") || Utils.$("room-video-player");
    if (vid && typeof vid.currentTime === "number" && !isNaN(vid.currentTime) && vid.currentTime >= 0) {
      return vid.currentTime;
    }
    if (AppState.lastKnownSyncState && typeof AppState.lastKnownSyncState.time === "number") {
      let t = AppState.lastKnownSyncState.time;
      if (AppState.lastKnownSyncState.state === "playing" && AppState.lastKnownSyncState.ts) {
        t += (Date.now() - AppState.lastKnownSyncState.ts) / 1000;
      }
      return Math.max(0, t);
    }
    return 0;
  }

  static getVideoDuration() {
    const yt = typeof YouTubePlayerManager !== "undefined" ? YouTubePlayerManager : window.YouTubePlayerManager;
    if (yt && yt.player && typeof yt.getDuration === "function") {
      const d = yt.getDuration();
      if (typeof d === "number" && !isNaN(d) && isFinite(d) && d > 0) return d;
    }
    const rt = typeof RutubePlayerManager !== "undefined" ? RutubePlayerManager : window.RutubePlayerManager;
    if (rt && rt.player && typeof rt.getDuration === "function") {
      const d = rt.getDuration();
      if (typeof d === "number" && !isNaN(d) && isFinite(d) && d > 0) return d;
    }
    const vk = typeof VkPlayerManager !== "undefined" ? VkPlayerManager : window.VkPlayerManager;
    if (vk && vk.player && typeof vk.getDuration === "function") {
      const d = vk.getDuration();
      if (typeof d === "number" && !isNaN(d) && isFinite(d) && d > 0) return d;
    }
    const vm = typeof VimeoPlayerManager !== "undefined" ? VimeoPlayerManager : window.VimeoPlayerManager;
    if (vm && vm.player && typeof vm.getDuration === "function") {
      const d = vm.getDuration();
      if (typeof d === "number" && !isNaN(d) && isFinite(d) && d > 0) return d;
    }
    const vid = Utils.$("native-player") || Utils.$("room-video-player");
    if (vid && typeof vid.duration === "number" && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
      return vid.duration;
    }
    if (AppState.currentRoomData?.videoDuration) {
      const vd = Number(AppState.currentRoomData.videoDuration);
      if (vd > 0) return vd;
    }
    if (AppState.currentRoomId) {
      const r = AppState.roomsCache.get(AppState.currentRoomId);
      if (r && r.videoDuration) {
        const vd = Number(r.videoDuration);
        if (vd > 0) return vd;
      }
    }
    return 0;
  }

  static getVideoProgress() {
    const curTime = this.getVideoCurrentTime();
    const duration = this.getVideoDuration();
    if (duration > 0 && curTime >= 0) {
      return Math.min(1, Math.max(0, curTime / duration));
    }
    return 0;
  }

  static async awardPlaybackLumens({ uid, mult = 1, minutes = 1, currentTime = 0, duration = 0, progress = 0, progressPct = 0 }) {
    if (!uid || RoomManager._isAwardingLumens) return;
    RoomManager._isAwardingLumens = true;

    try {
      const profRef = ref(db, `users/${uid}/profile`);
      const snap = await get(profRef);
      const data = snap.exists() ? (snap.val() || {}) : {};

      const curLumens = typeof data.lumens === "number" ? data.lumens : (Number(data.lumens) || 0);
      const minCount = Math.max(1, Math.floor(minutes) || 1);
      const addLumens = Math.max(1, Math.round(minCount * mult));
      const newLumens = curLumens + addLumens;

      // 1. Explicitly persist new Lumens balance to Firebase RTDB and ensure it is saved
      await update(profRef, { lumens: newLumens });

      // 2. Update local user cache
      const cached = AppState.usersCache.get(uid);
      if (cached) {
        cached.lumens = newLumens;
      }

      // 3. Reason text accurately reflecting watch progress relative to total video duration
      let progressStr = "";
      if (duration > 0) {
        progressStr = ` (${progressPct}%)`;
      }
      const reasonText = mult > 1
        ? `${minCount} мин. просмотра (+${addLumens} x${mult} Premium)${progressStr}`
        : `${minCount} мин. просмотра видео${progressStr}`;

      // 4. Update UI and trigger HUD notification once (without duplicate toasts)
      if (window.LumenManager) {
        LumenManager.updateBalance(newLumens, {
          diff: addLumens,
          reason: reasonText,
          source: "room",
          animate: true,
          showFloater: true,
          saveTx: true,
          saveDb: false, // already updated profRef above
          txType: "income",
          txIcon: "tv"
        });
      } else {
        const hp = Utils.$("header-lumens-count");
        if (hp) hp.textContent = newLumens.toLocaleString();
        const rp = Utils.$("room-lumens-count");
        if (rp) rp.textContent = newLumens.toLocaleString();
        const myL = Utils.$("my-lumens-val");
        if (myL) myL.textContent = newLumens.toLocaleString();
      }

      console.log(`[RoomManager] Lumens awarded: +${addLumens} (${minCount} min), new balance: ${newLumens}, video progress: ${progressPct}% (${Math.round(currentTime)}s / ${Math.round(duration)}s)`);
    } catch (e) {
      console.error("[RoomManager] Failed to persist lumens to Firebase:", e);
    } finally {
      RoomManager._isAwardingLumens = false;
    }
  }

  static async flushPendingRoomTime() {
    if (!AppState.currentUser || !AppState.pendingRoomSeconds) return;
    const uid = AppState.currentUser.uid;
    const addSeconds = AppState.pendingRoomSeconds;
    AppState.pendingRoomSeconds = 0;
    AppState.pendingRoomExp = 0;
    try {
      const profRef = ref(db, `users/${uid}/profile`);
      const snap = await get(profRef);
      if (snap.exists()) {
        const data = snap.val() || {};
        let curTime = Number(data.timeSpentInRooms) || 0;
        let newTime = curTime + addSeconds;
        await update(profRef, { timeSpentInRooms: newTime });
        const cached = AppState.usersCache.get(uid);
        if (cached) cached.timeSpentInRooms = newTime;
      }
    } catch (e) {
      console.error("[RoomManager] Error flushing pending room time:", e);
    }
  }

  static startRoomExperienceTimer() {
    if (AppState.roomExpTimer) clearInterval(AppState.roomExpTimer);

    AppState.pendingRoomExp = 0;
    AppState.pendingRoomPlaybackSeconds = 0;
    AppState.pendingRoomSeconds = 0;
    AppState.lastTrackedVideoTime = -1;
    RoomManager._isRoomSyncBusy = false;
    RoomManager._isAwardingLumens = false;
    RoomManager._lastRoomTickTs = Date.now();

    AppState.roomExpTimer = setInterval(async () => {
      if (!AppState.currentRoomId || !AppState.currentUser) return;

      const now = Date.now();
      const lastTs = RoomManager._lastRoomTickTs || now;
      RoomManager._lastRoomTickTs = now;
      const elapsedSec = Math.max(1, Math.min(10, Math.round((now - lastTs) / 1000)));

      const uid = AppState.currentUser.uid;
      const profile = AppState.usersCache.get(uid) || {};
      const mult = window.PremiumManager
        ? PremiumManager.getXpMultiplier(profile, uid)
        : 1;

      // 1. General room activity XP & room time tracking (every elapsed second in room)
      if (!AppState.pendingRoomExp) AppState.pendingRoomExp = 0;
      AppState.pendingRoomExp += elapsedSec;
      if (!AppState.pendingRoomSeconds) AppState.pendingRoomSeconds = 0;
      AppState.pendingRoomSeconds += elapsedSec;

      // Periodically flush XP and timeSpentInRooms to Firebase (every >= 10s)
      if (AppState.pendingRoomExp >= 10 && !RoomManager._isRoomSyncBusy) {
        const addXp = AppState.pendingRoomExp * mult;
        const addRoomSeconds = AppState.pendingRoomSeconds;
        AppState.pendingRoomExp = 0;
        AppState.pendingRoomSeconds = 0;
        RoomManager._isRoomSyncBusy = true;

        (async () => {
          try {
            const profRef = ref(db, `users/${uid}/profile`);
            const snap = await get(profRef);
            if (snap.exists()) {
              const data = snap.val() || {};
              let curXp = Number(data.xp) || 0;
              let newXp = curXp + addXp;
              let curRoomTime = Number(data.timeSpentInRooms) || 0;
              let newRoomTime = curRoomTime + addRoomSeconds;
              await update(profRef, { xp: newXp, timeSpentInRooms: newRoomTime });
              if (window.BadgeManager && typeof BadgeManager.checkLevelBadges === "function") {
                await BadgeManager.checkLevelBadges(uid, newXp);
              }
              const cached = AppState.usersCache.get(uid);
              if (cached) {
                cached.xp = newXp;
                cached.timeSpentInRooms = newRoomTime;
              }
            }
          } catch (e) {
            console.error("[RoomManager] Error updating room XP/time in Firebase:", e);
          } finally {
            RoomManager._isRoomSyncBusy = false;
          }
        })();
      }

      // 2. Lumens & Video Progress: calculated when room video is playing
      try {
        const isPlaying = RoomManager.isRoomVideoPlaying();

        if (isPlaying) {
          const currentTime = RoomManager.getVideoCurrentTime();
          const duration = RoomManager.getVideoDuration();
          const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
          const progressPct = duration > 0 ? Math.min(100, Math.round(progress * 100)) : 0;

          AppState.currentVideoCurrentTime = currentTime;
          AppState.currentVideoDuration = duration;
          AppState.currentVideoProgress = progress;
          AppState.currentVideoProgressPct = progressPct;

          const isEnded = duration > 0 && currentTime >= duration - 0.5;

          if (!isEnded) {
            if (!AppState.pendingRoomPlaybackSeconds) AppState.pendingRoomPlaybackSeconds = 0;
            AppState.pendingRoomPlaybackSeconds += elapsedSec;

            if (AppState.pendingRoomPlaybackSeconds >= 60) {
              const minutesToAward = Math.floor(AppState.pendingRoomPlaybackSeconds / 60);
              AppState.pendingRoomPlaybackSeconds = AppState.pendingRoomPlaybackSeconds % 60;
              await RoomManager.awardPlaybackLumens({
                uid,
                mult,
                minutes: minutesToAward,
                currentTime,
                duration,
                progress,
                progressPct
              });
            }
          } else {
            // Video reached end - handle completion if user watched sufficient portion
            if (AppState.pendingRoomPlaybackSeconds >= 30) {
              AppState.pendingRoomPlaybackSeconds = 0;
              await RoomManager.awardPlaybackLumens({
                uid,
                mult,
                minutes: 1,
                currentTime,
                duration,
                progress: 1,
                progressPct: 100
              });
            }
          }
          AppState.lastTrackedVideoTime = currentTime;
        }
      } catch (err) {
        console.error("[RoomManager] Error in room experience tick:", err);
      }
    }, 1000);
  }

  static stopRoomExperienceTimer() {
    RoomManager.flushPendingRoomTime();
    if (AppState.roomExpTimer) clearInterval(AppState.roomExpTimer);
    AppState.roomExpTimer = null;
    AppState.pendingRoomPlaybackSeconds = 0;
    AppState.pendingRoomSeconds = 0;
    AppState.pendingRoomExp = 0;
    AppState.roomWatchEarnings = 0;
    AppState.roomWatchTicks = 0;
    AppState.lastTrackedVideoTime = -1;
    RoomManager._isRoomSyncBusy = false;
    RoomManager._isAwardingLumens = false;
  }

  static leaveRoom() {
    if (!AppState.currentRoomId) return;

    RoomManager.stopRoomExperienceTimer();

    const remainingPresCount = Object.keys(AppState.currentPresenceCache || {}).length;
    if (AppState.isHost || remainingPresCount <= 1) {
      const currentTime = RoomManager.getVideoCurrentTime();
      try {
        set(ref(db, `rooms/${AppState.currentRoomId}/sync`), {
          type: "pause",
          state: "paused",
          time: currentTime,
          ts: Date.now(),
        }).catch(() => {});
      } catch (e) {}
    }

    AppState.roomSubscriptions.forEach((fn) => fn());
    AppState.roomSubscriptions = [];
    RTCManager.destroy();
    EasterEggManager.cleanupAllEffects();

    const vid = Utils.$("native-player");
    if (vid) {
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
      delete vid.dataset.roomUrl;
      delete vid.dataset.playbackKey;
      vid.onplay = null;
      vid.onpause = null;
      vid.onseeked = null;
      vid.ontimeupdate = null;
      vid.onended = null;
      vid.onerror = null;
    }

    VideoPlaybackManager.destroy();

    AppState.currentPresenceCache = {};
    AppState.usersListRenderToken++;
    AppState.currentRoomId = null;
    AppState.currentRoomData = null;
    AppState.lastKnownSyncState = null;
    AppState.currentRoomJoinTs = 0; // Сбрасываем время при выходе
    AppState.currentTheme = null;
    this.applyRoomTheme("default");
    AppState.isHost = false;
    if (Utils.$("users-list")) Utils.$("users-list").innerHTML = "";
    this.updateUsersTabButton([], {});
    if (window.ProfileManager && ProfileManager.closeProfileOverlay) {
      ProfileManager.closeProfileOverlay();
    }
    Utils.showScreen("lobby-screen");
    if (window.resumeBackgroundFX) window.resumeBackgroundFX();
    this.updateRoomsDOM();
  }

  static applyRoomTheme(theme = "default") {
    const roomScreen = Utils.$("room-screen");
    if (!roomScreen) return;
    document.body.classList.remove(
      "theme-love-room",
      "theme-inverted-room",
      "theme-light-room",
    );
    this.stopLoveHearts();
  }

  static startLoveHearts() {
    if (this.heartsTimer) return;

    const spawnHeart = (layer, mode = "mid") => {
      if (!layer) return;
      const heart = document.createElement("div");
      heart.className = `love-heart ${mode}`;
      heart.innerHTML =
        this.loveHeartEmojis[
          Math.floor(Math.random() * this.loveHeartEmojis.length)
        ];
      heart.style.left = `${Utils.getDistributedHeartLeft(layer, "room-love")}%`; // [UPDATE]
      const scaleBase = mode === "far" ? 0.45 : mode === "near" ? 1.15 : 0.78;
      const scale = scaleBase + Math.random() * (mode === "near" ? 0.35 : 0.25);
      const drift = -12 + Math.random() * 24;
      const duration =
        mode === "near" ? 34 + Math.random() * 10 : 30 + Math.random() * 10;
      const opacity =
        mode === "far"
          ? 0.18 + Math.random() * 0.12
          : mode === "near"
            ? 0.34 + Math.random() * 0.18
            : 0.25 + Math.random() * 0.14;
      const travel = (layer.clientHeight || 620) + 120;
      heart.style.setProperty("--heart-scale", String(scale));
      heart.style.setProperty("--heart-drift", `${drift}px`);
      heart.style.setProperty("--heart-opacity", String(opacity));
      heart.style.setProperty("--heart-travel", `${travel}px`);
      heart.style.animationDuration = `${duration}s`;
      layer.appendChild(heart);
      setTimeout(() => heart.remove(), 46000);
    };

    const primeLayer = (layer, amount = 14) => {
      if (!layer) return;
      for (let i = 0; i < amount; i++) {
        const roll = Math.random();
        const mode = roll < 0.33 ? "far" : roll > 0.74 ? "near" : "mid";
        spawnHeart(layer, mode);
      }
    };

    const layer = Utils.$("room-love-hearts");
    primeLayer(layer, 10);

    this.heartsTimer = setInterval(() => {
      const sharedLayer = Utils.$("room-love-hearts");
      const roll = Math.random();
      const mode = roll < 0.33 ? "far" : roll > 0.74 ? "near" : "mid";
      spawnHeart(sharedLayer, mode);
    }, 1700);
  }

  static stopLoveHearts() {
    if (this.heartsTimer) {
      clearInterval(this.heartsTimer);
      this.heartsTimer = null;
    }
    const layer = Utils.$("room-love-hearts");
    if (layer) layer.innerHTML = "";
  }
}

// ============================================================================
// 6. NEW STABLE WEBRTC SYSTEM (PRODUCTION ROCK-SOLID ENGINE)
class RTCManager {
  static isMicActive = false;
  static roomId = null;
  static localStream = null;
  static savedVolumeBeforeMic = null;
  static heartbeatTimer = null;
  static keepAliveTimer = null;
  static watchdogTimer = null;
  static activeSessionId = null;

  // Active speakers cache: Map<uid, speakerData> (supports up to 2 simultaneous speakers)
  static activeSpeakers = new Map();

  // Speaker side: listenerUid -> { pc, dc }
  static peerConnections = new Map();

  // Listener side: speakerUid -> { speakerUid, sessionId, pc, dc, incomingOfferUnsub, candidateUnsubs, queuedCandidates, handledCandidateKeys, audioEl }
  static listenerSessions = new Map();

  static speakerListenerUnsub = null;
  static audioCtx = null;

  static iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:openrelay.metered.ca:80" },
  ];

  static rtcConfig = {
    iceServers: RTCManager.iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };

  static isUserSpeaking(uid) {
    if (this.isMicActive && AppState.currentUser?.uid === uid) return true;
    return this.activeSpeakers.has(uid);
  }

  static get currentSpeakerUid() {
    const keys = Array.from(this.activeSpeakers.keys());
    return keys.length > 0 ? keys[0] : null;
  }

  static isGlobalUnblockerAttached = false;

  static getActiveSpeakers() {
    return Array.from(this.activeSpeakers.values());
  }

  static init(roomId) {
    this.destroy();
    this.roomId = roomId;
    console.log("[RTCManager] Initialized for room:", roomId);

    this.attachUserInteractionUnblocker();
    this.unlockAudio();
    this.bindSpeakerListener();
    this.startWatchdog();
  }

  static attachUserInteractionUnblocker() {
    if (this.isGlobalUnblockerAttached) return;
    this.isGlobalUnblockerAttached = true;
    const unblock = () => {
      RTCManager.unlockAudio();
    };
    window.addEventListener("click", unblock, { passive: true, capture: true });
    window.addEventListener("touchstart", unblock, { passive: true, capture: true });
    window.addEventListener("keydown", unblock, { passive: true, capture: true });
    window.addEventListener("pointerdown", unblock, { passive: true, capture: true });
  }

  static unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx || this.audioCtx.state === "closed") {
          this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }
        if (this.audioCtx.state === "running") {
          try {
            const buffer = this.audioCtx.createBuffer(1, 1, 22050);
            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioCtx.destination);
            source.start(0);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Resume any remote audio elements that might be paused
    this.listenerSessions.forEach((session, spUid) => {
      const audio = document.getElementById(`room-webrtc-audio-${spUid}`);
      if (audio && audio.srcObject && audio.paused) {
        audio.play().catch(() => {});
      }
    });
  }

  static startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.activeSpeakers.forEach((speaker, uid) => {
        const lastPing = speaker.lastPing || speaker.startedAt || 0;
        if (now - lastPing > 25000) {
          console.warn(`[RTCManager] Speaker ${uid} timeout (25s expired)`);
          this.activeSpeakers.delete(uid);
          this.closeSingleListenerSession(uid);
          changed = true;
        }
      });

      if (changed) {
        this.updateSpeakerUI(Array.from(this.activeSpeakers.values()));
        if (typeof RoomManager !== "undefined" && RoomManager.rerenderUsersList) {
          RoomManager.rerenderUsersList();
        }
      }
    }, 3000);
  }

  static bindSpeakerListener() {
    if (!this.roomId) return;
    const speakersRef = ref(db, `rooms/${this.roomId}/voice/speakers`);

    this.speakerListenerUnsub = onValue(speakersRef, (snap) => {
      const rawSpeakers = snap.val() || {};
      const now = Date.now();
      const currentUid = AppState.currentUser?.uid;

      const newActiveMap = new Map();
      Object.keys(rawSpeakers).forEach((uid) => {
        const item = rawSpeakers[uid];
        if (!item || !item.sessionId) return;
        const lastPing = item.lastPing || item.startedAt || 0;
        if (now - lastPing < 20000) {
          newActiveMap.set(uid, item);
        }
      });

      this.activeSpeakers = newActiveMap;
      const activeArray = Array.from(newActiveMap.values());

      this.updateSpeakerUI(activeArray);

      if (typeof RoomManager !== "undefined" && RoomManager.rerenderUsersList) {
        RoomManager.rerenderUsersList();
      }

      // If we are actively speaking, broadcast to any new participants or the other speaker
      if (this.isMicActive && this.localStream) {
        this.broadcastToParticipants();
      }

      // 1. Remove sessions for speakers that are no longer active
      this.listenerSessions.forEach((session, spUid) => {
        if (!newActiveMap.has(spUid)) {
          this.closeSingleListenerSession(spUid);
        }
      });

      // 2. Setup or maintain sessions for active speakers (other than self)
      newActiveMap.forEach((spData, spUid) => {
        if (spUid === currentUid) return; // Never listen to self

        const existingSession = this.listenerSessions.get(spUid);
        if (existingSession) {
          // If sessionId is identical and connection is healthy, keep it intact
          if (
            existingSession.sessionId === spData.sessionId &&
            existingSession.pc &&
            (existingSession.pc.connectionState === "connected" ||
              existingSession.pc.connectionState === "connecting" ||
              existingSession.pc.connectionState === "new")
          ) {
            return;
          }
          this.closeSingleListenerSession(spUid);
        }

        // Establish connection to hear this speaker
        this.setupListenerSession(spUid, spData.sessionId);
      });
    });

    AppState.roomSubscriptions.push(this.speakerListenerUnsub);
  }

  static updateSpeakerUI(activeSpeakers = []) {
    const badge = Utils.$("room-voice-speaker-badge");
    const text = Utils.$("room-voice-speaker-text");
    const micBtn = Utils.$("btn-toggle-mic");
    const currentUid = AppState.currentUser?.uid;

    let effectiveSpeakers = Array.isArray(activeSpeakers) ? [...activeSpeakers] : [];
    if (this.isMicActive && currentUid) {
      if (!effectiveSpeakers.some((s) => s.uid === currentUid)) {
        const myProfile = AppState.usersCache.get(currentUid) || {};
        effectiveSpeakers.unshift({
          uid: currentUid,
          name: myProfile.name || AppState.currentUser.displayName || "Вы",
          avatar: myProfile.avatar || AppState.currentUser.photoURL || "",
          sessionId: this.activeSessionId,
        });
      }
    } else if (!this.isMicActive && currentUid) {
      effectiveSpeakers = effectiveSpeakers.filter((s) => s.uid !== currentUid);
    }

    this.updatePlayerSpeakerAvatars(effectiveSpeakers);

    if (effectiveSpeakers.length === 0) {
      if (badge) badge.style.display = "none";
      if (micBtn && !this.isMicActive) {
        micBtn.classList.remove("active");
        micBtn.title = "Микрофон (нажмите, чтобы говорить)";
      }
      return;
    }

    const isSelfSpeaking = this.isMicActive || effectiveSpeakers.some((s) => s.uid === currentUid);

    if (badge && text) {
      badge.style.display = "inline-flex";
      if (effectiveSpeakers.length === 1) {
        const s = effectiveSpeakers[0];
        const sName = s.name || (s.uid === currentUid ? (AppState.currentUser?.displayName || "Вы") : "пользователь");
        text.innerText = `Говорит: ${sName}`;
      } else {
        const name1 = effectiveSpeakers[0]?.name || (effectiveSpeakers[0]?.uid === currentUid ? (AppState.currentUser?.displayName || "Вы") : "пользователь");
        const name2 = effectiveSpeakers[1]?.name || (effectiveSpeakers[1]?.uid === currentUid ? (AppState.currentUser?.displayName || "Вы") : "пользователь");
        text.innerText = `Говорят: ${name1} и ${name2}`;
      }
    }

    if (micBtn) {
      if (isSelfSpeaking) {
        micBtn.classList.add("active");
        micBtn.title = "Микрофон включен (нажмите, чтобы выключить)";
      } else {
        micBtn.classList.remove("active");
        if (effectiveSpeakers.length >= 2) {
          micBtn.title = "Микрофон занят: говорят двое (максимум)";
        } else if (effectiveSpeakers.length === 1) {
          micBtn.title = `Говорит ${effectiveSpeakers[0].name || "участник"} (нажмите, чтобы говорить вдвоём)`;
        } else {
          micBtn.title = "Микрофон (нажмите, чтобы говорить)";
        }
      }
    }
  }

  static updatePlayerSpeakerAvatars(activeSpeakers = []) {
    const container = Utils.$("room-player-speakers-overlay");
    if (!container) return;

    if (!activeSpeakers || activeSpeakers.length === 0) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";
    const currentUid = AppState.currentUser?.uid;
    // Display up to two speaking users in the corner of the player
    const speakersToShow = activeSpeakers.slice(0, 2);

    let html = "";
    speakersToShow.forEach((sp) => {
      const cached = AppState.usersCache.get(sp.uid) || {};
      const name = sp.name || cached.name || (sp.uid === currentUid ? (AppState.currentUser?.displayName || "Вы") : "Пользователь");
      const avatar = sp.avatar || cached.avatar || (sp.uid === currentUid ? (AppState.currentUser?.photoURL || "") : "");

      const initial = (name[0] || "?").toUpperCase();
      let avatarContent = "";
      if (avatar) {
        avatarContent = `<img src="${Utils.escapeHtml(avatar)}" alt="${Utils.escapeHtml(name)}" class="player-speaker-avatar-img" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'player-speaker-avatar-fallback\\'>${Utils.escapeHtml(initial)}</div>';">`;
      } else {
        avatarContent = `<div class="player-speaker-avatar-fallback">${Utils.escapeHtml(initial)}</div>`;
      }

      html += `
        <div class="player-speaker-item" data-uid="${Utils.escapeHtml(sp.uid)}" title="Говорит: ${Utils.escapeHtml(name)}">
          <div class="player-speaker-avatar-wrap">
            ${avatarContent}
          </div>
          <span class="player-speaker-name">${Utils.escapeHtml(name)}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  static async toggleMic(forceOff = false) {
    if (!this.roomId || !AppState.currentUser) return;

    if (this.isMicActive || forceOff) {
      await this.stopBroadcasting();
      return;
    }

    if (!RoomManager.hasPerm("voice")) {
      return Utils.toast("У вас нет прав на использование микрофона", "error");
    }

    const currentUid = AppState.currentUser.uid;
    const speakersRef = ref(db, `rooms/${this.roomId}/voice/speakers`);

    // Verify how many participants are speaking (maximum 2 simultaneously)
    try {
      const snap = await get(speakersRef);
      const rawSpeakers = snap.val() || {};
      const now = Date.now();
      const activeList = [];

      Object.keys(rawSpeakers).forEach((uid) => {
        const item = rawSpeakers[uid];
        if (!item) return;
        const lastPing = item.lastPing || item.startedAt || 0;
        if (now - lastPing < 20000) {
          activeList.push(item);
        }
      });

      const isAlreadyActive = activeList.some((s) => s.uid === currentUid);
      if (!isAlreadyActive && activeList.length >= 2) {
        const names = activeList.map((s) => s.name || "участник").join(" и ");
        return Utils.toast(
          `Микрофон занят: уже говорят ${names} (максимум 2 человека одновременно)`,
          "warning",
        );
      }
    } catch (e) {
      console.warn("[RTCManager] Check speakers error:", e);
    }

    // Request microphone access with professional audio filters
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: false,
      });
      // Ensure all tracks are unmuted and active
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    } catch (err) {
      console.error("[RTCManager] Microphone access denied:", err);
      return Utils.toast(
        "Не удалось получить доступ к микрофону: " + (err.message || err.name),
        "error",
      );
    }

    this.isMicActive = true;
    this.activeSessionId = "voice_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    // USER REQUIREMENT:
    // "Только во время использования микрофона необходимо убирать громкость на 0 плеера,у пользователя который пользуется микрофоном."
    this.savedVolumeBeforeMic = RoomManager.getPlayerVolume();
    RoomManager.setPlayerVolume(0);

    const myProfile = AppState.usersCache.get(currentUid) || {};
    const myName =
      myProfile.name ||
      AppState.currentUser.displayName ||
      "Пользователь";
    const myAvatar =
      myProfile.avatar ||
      AppState.currentUser.photoURL ||
      "";

    // Clean any old signals from previous sessions for self
    const mySignalsRef = ref(db, `rooms/${this.roomId}/voice/signals/${currentUid}`);
    await set(mySignalsRef, null);

    const speakerData = {
      uid: currentUid,
      name: myName,
      avatar: myAvatar,
      sessionId: this.activeSessionId,
      startedAt: Date.now(),
      lastPing: Date.now(),
    };

    const mySpeakerRef = ref(db, `rooms/${this.roomId}/voice/speakers/${currentUid}`);
    await set(mySpeakerRef, speakerData);
    onDisconnect(mySpeakerRef).remove();
    onDisconnect(mySignalsRef).remove();

    // Heartbeat to keep speaker lease alive every 3 seconds
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.isMicActive || !this.roomId) return;
      set(ref(db, `rooms/${this.roomId}/voice/speakers/${currentUid}/lastPing`), Date.now());
    }, 3000);

    // NAT keepalive timer across all active data channels
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      if (!this.isMicActive) return;
      this.peerConnections.forEach((entry) => {
        if (entry.dc && entry.dc.readyState === "open") {
          try {
            entry.dc.send("ka");
          } catch (e) {}
        }
      });
    }, 3000);

    const micBtn = Utils.$("btn-toggle-mic");
    if (micBtn) micBtn.classList.add("active");
    Utils.toast("Микрофон включен (звук видео у вас приглушён)", "success");

    // Close any listener session for self
    this.closeSingleListenerSession(currentUid);

    // Broadcast audio to all participants (listeners + other active speaker)
    this.broadcastToParticipants();
    this.updateSpeakerUI(Array.from(this.activeSpeakers.values()));
  }

  static broadcastToParticipants() {
    if (!this.isMicActive || !this.localStream || !this.roomId) return;
    const cache = AppState.currentPresenceCache || {};
    const currentUid = AppState.currentUser?.uid;
    if (!currentUid) return;

    // Connect to all users in room presence
    Object.keys(cache).forEach((uid) => {
      if (uid === currentUid) return;
      const existing = this.peerConnections.get(uid);
      const isDead =
        !existing ||
        !existing.pc ||
        existing.pc.connectionState === "failed" ||
        existing.pc.connectionState === "closed";

      if (isDead) {
        if (existing?.pc) {
          try {
            existing.pc.close();
          } catch (e) {}
        }
        this.peerConnections.delete(uid);
        this.initiateSpeakerPeer(uid);
      }
    });

    // Also ensure connection to the other active speaker if present
    this.activeSpeakers.forEach((spData, spUid) => {
      if (spUid === currentUid) return;
      const existing = this.peerConnections.get(spUid);
      const isDead =
        !existing ||
        !existing.pc ||
        existing.pc.connectionState === "failed" ||
        existing.pc.connectionState === "closed";

      if (isDead) {
        if (existing?.pc) {
          try {
            existing.pc.close();
          } catch (e) {}
        }
        this.peerConnections.delete(spUid);
        this.initiateSpeakerPeer(spUid);
      }
    });
  }

  static async initiateSpeakerPeer(listenerUid) {
    if (!this.isMicActive || !this.localStream || !this.roomId) return;
    const currentUid = AppState.currentUser.uid;
    const sessionId = this.activeSessionId;

    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      let dc = null;

      try {
        // Data channel keeps NAT mapping alive and delivers instantaneous ping/pong
        dc = pc.createDataChannel("voice_keepalive", { ordered: false, maxRetransmits: 0 });
        dc.onmessage = () => {};
      } catch (e) {
        console.warn("[RTCManager] Could not create data channel:", e);
      }

      this.peerConnections.set(listenerUid, { pc, dc });

      // Add microphone audio tracks
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, this.localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && this.isMicActive && this.activeSessionId === sessionId) {
          push(
            ref(
              db,
              `rooms/${this.roomId}/voice/signals/${currentUid}/${listenerUid}/speakerCandidates`,
            ),
            event.candidate.toJSON(),
          );
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[RTCManager] Speaker peer to ${listenerUid} state:`, pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          try {
            pc.close();
          } catch (e) {}
          this.peerConnections.delete(listenerUid);
        } else if (pc.connectionState === "disconnected") {
          setTimeout(() => {
            const entry = this.peerConnections.get(listenerUid);
            if (entry && entry.pc && entry.pc.connectionState === "disconnected") {
              try {
                entry.pc.close();
              } catch (e) {}
              this.peerConnections.delete(listenerUid);
              if (this.isMicActive) {
                this.broadcastToParticipants();
              }
            }
          }, 2500);
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      await set(
        ref(
          db,
          `rooms/${this.roomId}/voice/signals/${currentUid}/${listenerUid}/offer`,
        ),
        {
          sdp: offer.sdp,
          type: offer.type,
          sessionId: sessionId,
          ts: Date.now(),
        },
      );

      const queuedCandidates = [];
      let isRemoteDescriptionSet = false;

      // Listen for remote answer
      const answerRef = ref(
        db,
        `rooms/${this.roomId}/voice/signals/${currentUid}/${listenerUid}/answer`,
      );
      const unsubAnswer = onValue(answerRef, async (snap) => {
        const answer = snap.val();
        if (
          answer &&
          answer.sdp &&
          answer.sessionId === sessionId &&
          pc.signalingState === "have-local-offer"
        ) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            isRemoteDescriptionSet = true;

            // Flush any queued listener candidates that arrived before the answer
            while (queuedCandidates.length > 0) {
              const cand = queuedCandidates.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {}
            }
          } catch (e) {
            console.warn("[RTCManager] Set remote answer error:", e);
          }
        }
      });
      AppState.roomSubscriptions.push(unsubAnswer);

      // Listen for listener ICE candidates with queueing
      const candRef = ref(
        db,
        `rooms/${this.roomId}/voice/signals/${currentUid}/${listenerUid}/listenerCandidates`,
      );
      const unsubCand = onChildAdded(candRef, async (snapVal) => {
        const candidate = snapVal.val();
        if (!candidate) return;
        if (pc.remoteDescription && isRemoteDescriptionSet) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {}
        } else {
          queuedCandidates.push(candidate);
        }
      });
      AppState.roomSubscriptions.push(unsubCand);
    } catch (err) {
      console.warn(`[RTCManager] Failed to connect to listener ${listenerUid}:`, err);
    }
  }

  static async stopBroadcasting() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((entry) => {
      try {
        if (entry.dc) entry.dc.close();
        entry.pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();

    const currentUid = AppState.currentUser?.uid;
    if (this.roomId && currentUid) {
      set(ref(db, `rooms/${this.roomId}/voice/speakers/${currentUid}`), null);
      set(ref(db, `rooms/${this.roomId}/voice/signals/${currentUid}`), null);
    }

    this.isMicActive = false;
    this.activeSessionId = null;

    // RESTORE PLAYER VOLUME FOR THE USER WHO WAS USING THE MICROPHONE
    if (this.savedVolumeBeforeMic !== null) {
      RoomManager.setPlayerVolume(this.savedVolumeBeforeMic);
      this.savedVolumeBeforeMic = null;
    }

    const micBtn = Utils.$("btn-toggle-mic");
    if (micBtn) {
      micBtn.classList.remove("active");
      micBtn.title = "Микрофон (нажмите, чтобы говорить)";
    }

    this.updateSpeakerUI(Array.from(this.activeSpeakers.values()));
    Utils.toast("Микрофон выключен (громкость видео восстановлена)", "info");
  }

  static setupListenerSession(speakerUid, sessionId) {
    if (!this.roomId || !AppState.currentUser) return;
    const currentUid = AppState.currentUser.uid;
    if (speakerUid === currentUid) return;

    this.closeSingleListenerSession(speakerUid);

    const session = {
      speakerUid,
      sessionId,
      pc: null,
      incomingOfferUnsub: null,
      candidateUnsubs: [],
      queuedCandidates: [],
      handledCandidateKeys: new Set(),
      audioEl: null,
    };

    this.listenerSessions.set(speakerUid, session);

    const offerRef = ref(
      db,
      `rooms/${this.roomId}/voice/signals/${speakerUid}/${currentUid}/offer`,
    );

    session.incomingOfferUnsub = onValue(offerRef, async (snap) => {
      const offer = snap.val();
      if (!offer || !offer.sdp) return;
      if (offer.sessionId && offer.sessionId !== sessionId) return;

      try {
        if (session.pc) {
          try {
            session.pc.close();
          } catch (e) {}
        }

        // Clean any previous candidate unsubs if offer changes
        if (session.candidateUnsubs && session.candidateUnsubs.length > 0) {
          session.candidateUnsubs.forEach((unsub) => {
            if (typeof unsub === "function") unsub();
          });
          session.candidateUnsubs = [];
        }
        session.queuedCandidates = [];
        session.handledCandidateKeys.clear();

        const pc = new RTCPeerConnection(this.rtcConfig);
        session.pc = pc;

        // Ensure audio receiver transceiver is configured
        try {
          pc.addTransceiver("audio", { direction: "recvonly" });
        } catch (e) {}

        // DataChannel for continuous NAT keep-alive
        pc.ondatachannel = (e) => {
          const dc = e.channel;
          dc.onmessage = (msg) => {
            if (msg.data === "ka" && dc.readyState === "open") {
              try {
                dc.send("ack");
              } catch (err) {}
            }
          };
        };

        pc.ontrack = (event) => {
          console.log(`[RTCManager] Audio track received from speaker ${speakerUid}`);
          let stream = event.streams && event.streams[0] ? event.streams[0] : null;
          if (!stream && event.track) {
            stream = new MediaStream([event.track]);
          }
          if (stream) {
            RTCManager.playRemoteAudio(stream, speakerUid);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log(`[RTCManager] Listener peer for ${speakerUid} state:`, pc.connectionState);
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            console.warn(`[RTCManager] Connection to speaker ${speakerUid} ${pc.connectionState}, reconnecting...`);
            setTimeout(() => {
              if (
                this.activeSpeakers.has(speakerUid) &&
                this.activeSpeakers.get(speakerUid)?.sessionId === sessionId
              ) {
                this.setupListenerSession(speakerUid, sessionId);
              }
            }, 1200);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            push(
              ref(
                db,
                `rooms/${this.roomId}/voice/signals/${speakerUid}/${currentUid}/listenerCandidates`,
              ),
              event.candidate.toJSON(),
            );
          }
        };

        // Listen for speaker ICE candidates
        const speakerCandRef = ref(
          db,
          `rooms/${this.roomId}/voice/signals/${speakerUid}/${currentUid}/speakerCandidates`,
        );
        const unsubSpCand = onChildAdded(speakerCandRef, async (snapVal) => {
          const candidate = snapVal.val();
          if (!candidate) return;
          const candKey = candidate.candidate || JSON.stringify(candidate);
          if (session.handledCandidateKeys.has(candKey)) return;
          session.handledCandidateKeys.add(candKey);

          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {}
          } else {
            session.queuedCandidates.push(candidate);
          }
        });
        session.candidateUnsubs.push(unsubSpCand);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush any queued candidates
        while (session.queuedCandidates.length > 0) {
          const cand = session.queuedCandidates.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await set(
          ref(
            db,
            `rooms/${this.roomId}/voice/signals/${speakerUid}/${currentUid}/answer`,
          ),
          {
            sdp: answer.sdp,
            type: answer.type,
            sessionId: sessionId,
            ts: Date.now(),
          },
        );
      } catch (err) {
        console.warn(`[RTCManager] Error setting up listener peer for ${speakerUid}:`, err);
      }
    });

    AppState.roomSubscriptions.push(session.incomingOfferUnsub);
  }

  static playRemoteAudio(stream, speakerUid) {
    const audioId = `room-webrtc-audio-${speakerUid}`;
    let audio = document.getElementById(audioId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = audioId;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = false;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("autoplay", "");
      // Positioned offscreen without display:none so browser does not throttle audio decode
      audio.style.cssText =
        "position: fixed; left: -9999px; bottom: 0; width: 1px; height: 1px; opacity: 0.001; pointer-events: none; z-index: -100;";
      document.body.appendChild(audio);

      audio.onpause = () => {
        if (RTCManager.activeSpeakers.has(speakerUid) && audio.srcObject) {
          audio.play().catch(() => {});
        }
      };
    }

    this.unlockAudio();

    audio.srcObject = stream;
    audio.volume = 1.0;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[RTCManager] Audio autoplay blocked for speaker ${speakerUid}:`, err);
        const unblock = () => {
          RTCManager.unlockAudio();
          if (audio) audio.play().catch(() => {});
          window.removeEventListener("click", unblock, true);
          window.removeEventListener("touchstart", unblock, true);
          window.removeEventListener("keydown", unblock, true);
          window.removeEventListener("pointerdown", unblock, true);
        };
        window.addEventListener("click", unblock, { once: true, capture: true });
        window.addEventListener("touchstart", unblock, { once: true, capture: true });
        window.addEventListener("keydown", unblock, { once: true, capture: true });
        window.addEventListener("pointerdown", unblock, { once: true, capture: true });
      });
    }
  }

  static closeSingleListenerSession(speakerUid) {
    const session = this.listenerSessions.get(speakerUid);
    if (!session) return;

    if (session.incomingOfferUnsub && typeof session.incomingOfferUnsub === "function") {
      session.incomingOfferUnsub();
      session.incomingOfferUnsub = null;
    }

    if (session.candidateUnsubs) {
      session.candidateUnsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
      session.candidateUnsubs = [];
    }

    if (session.pc) {
      try {
        session.pc.close();
      } catch (e) {}
      session.pc = null;
    }

    const audio = document.getElementById(`room-webrtc-audio-${speakerUid}`);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
    }

    this.listenerSessions.delete(speakerUid);
  }

  static closeAllListenerConnections() {
    Array.from(this.listenerSessions.keys()).forEach((spUid) => {
      this.closeSingleListenerSession(spUid);
    });
    this.listenerSessions.clear();
  }

  static destroy() {
    if (this.isMicActive) {
      this.stopBroadcasting();
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.speakerListenerUnsub) {
      if (typeof this.speakerListenerUnsub === "function") {
        this.speakerListenerUnsub();
      }
      this.speakerListenerUnsub = null;
    }
    this.closeAllListenerConnections();
    this.activeSpeakers.clear();
    this.roomId = null;
    this.updateSpeakerUI([]);
    console.log("[RTCManager] WebRTC Subsystem Destroyed");
  }
}

// 7. МОБИЛЬНЫЕ СВАЙПЫ (Bottom Sheets, Chat swipe)
// ============================================================================

class MobileSwipeManager {
  static init() {
    if (window.innerWidth > 1024) return; // Only mobile

    // Setup modal swipe to close
    document.querySelectorAll(".modal").forEach((modal) => {
      let startY = 0;
      let currentY = 0;
      const content = modal.querySelector(".modal-content");
      if (!content) return;

      content.addEventListener(
        "touchstart",
        (e) => {
          if (content.scrollTop > 0) return; // Only if at top
          startY = e.touches[0].clientY;
        },
        { passive: true },
      );

      content.addEventListener(
        "touchmove",
        (e) => {
          if (startY === 0) return;
          currentY = e.touches[0].clientY;
          const dy = currentY - startY;
          if (dy > 0) {
            content.style.transform = `translateY(${dy}px)`;
          }
        },
        { passive: true },
      );

      content.addEventListener("touchend", (e) => {
        if (startY === 0) return;
        const dy = currentY - startY;
        if (dy > 120) {
          // swipe down close
          if (modal.id === "modal-dm-chat") DirectMessages.closeChat();
          else modal.classList.remove("active");
        }
        content.style.transform = "";
        startY = 0;
        currentY = 0;
      });
    });

    // Chat vs Users swipe inside Room
    const chatSection = Utils.$("chat-messages")?.parentElement;
    if (chatSection) {
      let startX = 0;
      chatSection.addEventListener(
        "touchstart",
        (e) => {
          startX = e.touches[0].clientX;
        },
        { passive: true },
      );
      chatSection.addEventListener("touchend", (e) => {
        const endX = e.changedTouches[0].clientX;
        const dx = endX - startX;
        if (Math.abs(dx) > 80) {
          if (dx < 0 && Utils.$("chat-messages").style.display !== "none") {
            // Swipe left -> open users
            if (window._setRoomTab) window._setRoomTab("users");
          } else if (dx > 0 && Utils.$("users-list").style.display !== "none") {
            // Swipe right -> open chat
            if (window._setRoomTab) window._setRoomTab("chat");
          }
        }
      });
    }

    // Sidebar swipe to close
    const sidebar = Utils.$("main-sidebar");
    const sidebarOverlay = Utils.$("sidebar-overlay");

    if (sidebar) {
      let startX = 0;
      sidebar.addEventListener(
        "touchstart",
        (e) => {
          startX = e.touches[0].clientX;
        },
        { passive: true },
      );
      sidebar.addEventListener("touchend", (e) => {
        const endX = e.changedTouches[0].clientX;
        if (startX - endX > 60) {
          if (localStorage.getItem("tutorial_active") === "true") return;
          // swipe left
          sidebar.classList.remove("open");
          if (sidebarOverlay) sidebarOverlay.classList.remove("open");
        }
      });
    }

    // Edge swipe right to open sidebar
    document.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches[0].clientX < 30 && window.innerWidth <= 1024) {
          // Edge of screen
          this.edgeStartX = e.touches[0].clientX;
        } else {
          this.edgeStartX = null;
        }
      },
      { passive: true },
    );

    document.addEventListener("touchend", (e) => {
      if (this.edgeStartX !== null && window.innerWidth <= 1024) {
        const endX = e.changedTouches[0].clientX;
        if (endX - this.edgeStartX > 50 && sidebar) {
          sidebar.classList.add("open");
          if (sidebarOverlay) sidebarOverlay.classList.add("open");
        }
      }
    });
  }
}
window.RoomManager = RoomManager;
window.RTCManager = RTCManager;
window.MobileSwipeManager = MobileSwipeManager;
window.showProfileModal = (uid) => RoomManager.showUserMiniature(uid);
export { RoomManager, RTCManager, MobileSwipeManager };
