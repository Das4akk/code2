class FriendsManager {
  static sentFriendRequests = new Set();
  static pendingFriendRequestsMap = {};

  static async isFriendWith(targetUid) {
    if (!AppState.currentUser || !targetUid) return false;
    const uid = AppState.currentUser.uid;
    if (uid === targetUid) return false;
    try {
      const { get, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
      const dbInstance = getDatabase();
      const snap = await get(ref(dbInstance, `users/${uid}/friends/${targetUid}`));
      return snap.exists() && snap.val() !== null;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static initListeners() {
    const uid = AppState.currentUser.uid;
    const reqRef = ref(db, `users/${uid}/friend-requests`);
    const unsubReq = onValue(reqRef, (snap) => {
      const reqs = snap.val() || {};
      this.pendingFriendRequestsMap = reqs;
      this.renderRequests(reqs);
      if (AppState.currentRoomId) RoomManager.rerenderUsersList();
    });

    const frRef = ref(db, `users/${uid}/friends`);
    const unsubFr = onValue(frRef, (snap) => {
      this.renderFriends(snap.val() || {});
      if (AppState.currentRoomId) RoomManager.rerenderUsersList();
    });

    AppState.activeSubscriptions.push(
      () => off(reqRef, "value", unsubReq),
      () => off(frRef, "value", unsubFr),
    );

    const navItems = [
      "nav-profile",
      "nav-rooms",
      "nav-friends",
      "nav-find-friend",
      "nav-leaderboard",
      "nav-catalog",
      "nav-premium",
      "nav-mystery",
      "nav-shop",
      "nav-switch-account",
      "nav-support",
      "nav-support-staff",
      "nav-settings",
      "nav-other",
      "nav-library",
    ];
    const routeMap = {
      "nav-library": "/library",
      "nav-support": "/help",
      "nav-support-staff": "/help",
      "nav-catalog": "/catalog",
      "nav-leaderboard": "/leaderboard",
      "nav-find-friend": "/findfriends",
      "nav-friends": "/friends",
      "nav-settings": "/settings",
      "nav-other": "/other",
      "nav-premium": "/premium",
      "nav-profile": "/profile",
      "nav-rooms": "/lobby"
    };

    const navSectionMap = {
      "nav-friends": ["section-friends", "flex"],
      "nav-find-friend": ["section-find-friend", "flex"],
      "nav-rooms": ["section-rooms", "flex"],
      "nav-library": ["section-library", "flex"],
      "nav-leaderboard": ["section-leaderboard", "block"],
      "nav-catalog": ["section-catalog", "flex"],
      "nav-shop": ["section-shop", "flex"],
      "nav-settings": ["section-settings", "flex"],
      "nav-other": ["section-other", "flex"],
      "nav-premium": ["section-premium", "flex"],
      "nav-mystery": ["section-mystery", "flex"],
      "nav-support": ["section-support", "flex"],
      "nav-support-staff": ["section-support", "flex"],
      "nav-profile": ["section-profile", "flex"],
      "nav-switch-account": ["section-switch-account", "flex"]
    };

    let activeNavEl = null;

    const setNavActive = (id, skipHistory = false) => {
      if (!skipHistory) {
        const newPath = routeMap[id] || "/lobby";
        if (window.location.pathname !== newPath) {
          window.history.pushState({ screenId: "lobby-screen", navId: id }, "", newPath);
        }
      }

      // Fast active state update on nav items
      const targetNavEl = Utils.$(id);
      if (activeNavEl && activeNavEl !== targetNavEl) {
        activeNavEl.classList.remove("active");
      }
      if (targetNavEl) {
        targetNavEl.classList.add("active");
        activeNavEl = targetNavEl;
      }

      // Targeted section display toggle to avoid full-tree layout thrashing
      const targetConfig = navSectionMap[id];
      const targetSectionId = targetConfig ? targetConfig[0] : null;
      const targetDisplay = targetConfig ? targetConfig[1] : "flex";

      const allSections = document.querySelectorAll(".rooms-main");
      allSections.forEach((el) => {
        if (targetSectionId && el.id === targetSectionId) {
          if (el.style.display !== targetDisplay) el.style.display = targetDisplay;
        } else {
          if (el.style.display !== "none") el.style.display = "none";
        }
      });

      const lobbyContent = document.querySelector(".lobby-content");
      if (lobbyContent) {
        lobbyContent.scrollTop = 0;
        if (targetSectionId === "section-support") {
          lobbyContent.classList.add("support-active-view");
        } else {
          lobbyContent.classList.remove("support-active-view");
        }
      }
    };
    FriendsManager.setNavActive = setNavActive;

    Utils.$("nav-friends").onclick = () => setNavActive("nav-friends");
    Utils.$("nav-find-friend").onclick = () => setNavActive("nav-find-friend");
    Utils.$("nav-rooms").onclick = () => setNavActive("nav-rooms");
    if (Utils.$("nav-library"))
      Utils.$("nav-library").onclick = () => {
        setNavActive("nav-library");
        requestAnimationFrame(() => {
          if (window.LibraryManager) window.LibraryManager.renderGrid();
        });
      };
    if (Utils.$("nav-catalog"))
      Utils.$("nav-catalog").onclick = () => {
        setNavActive("nav-catalog");
        requestAnimationFrame(() => {
          if (window.CatalogManager) CatalogManager.renderCatalog();
        });
      };
    if (Utils.$("nav-shop"))
      Utils.$("nav-shop").onclick = () => {
        setNavActive("nav-shop");
        requestAnimationFrame(() => {
          window.ShopController?.loadShop();
        });
      };
    if (Utils.$("nav-leaderboard"))
      Utils.$("nav-leaderboard").onclick = () => {
        setNavActive("nav-leaderboard");
        requestAnimationFrame(() => {
          if (window.loadLeaderboard) window.loadLeaderboard();
        });
      };
    
    if (Utils.$("nav-settings"))
      Utils.$("nav-settings").onclick = () => setNavActive("nav-settings");
    if (Utils.$("nav-other"))
      Utils.$("nav-other").onclick = () => setNavActive("nav-other");
    if (Utils.$("nav-premium"))
      Utils.$("nav-premium").onclick = () => {
        setNavActive("nav-premium");
        requestAnimationFrame(() => {
          if (window.PremiumManager) PremiumManager.renderPremiumSection();
        });
      };
    if (Utils.$("nav-mystery"))
      Utils.$("nav-mystery").onclick = () => {
        setNavActive("nav-mystery");
        requestAnimationFrame(() => {
          window.MysteryEventManager?.render();
        });
      };
    if (Utils.$("nav-support"))
      Utils.$("nav-support").onclick = () => {
        setNavActive("nav-support");
        if (window.SupportSystem) SupportSystem.renderTickets();
      };
    if (Utils.$("nav-support-staff"))
      Utils.$("nav-support-staff").onclick = () => {
        setNavActive("nav-support-staff");
        if (window.SupportSystem) SupportSystem.renderTickets();
      };
    
    if (Utils.$("lobby-app-bar-profile")) {
      Utils.$("lobby-app-bar-profile").onclick = () => {
        const uid = AppState.currentUser?.uid;
        if (uid) {
          setNavActive("nav-profile");
          if (window.Router) {
            Router.navigate("/profile");
          }
          if (window.ProfileManager) {
            ProfileManager.openViewProfileModal(uid);
          }
        }
      };
    }
    if (Utils.$("nav-profile")) {
      Utils.$("nav-profile").onclick = () => {
        const uid = AppState.currentUser?.uid;
        if (uid) {
          setNavActive("nav-profile");
          if (window.Router) {
            Router.navigate("/profile");
          }
          if (window.ProfileManager) {
            ProfileManager.openViewProfileModal(uid);
          }
        }
      };
    }
    if (Utils.$("btn-switch-account")) {
      Utils.$("btn-switch-account").onclick = async () => {
        setNavActive("nav-switch-account");

        const listEl = Utils.$("saved-accounts-list");
        const saved = JSON.parse(
          localStorage.getItem("cowio_saved_accounts") || "[]",
        );

        if (saved.length === 0) {
          listEl.innerHTML =
            '<div style="color:var(--text-muted); font-size:14px;">Нет сохраненных аккаунтов.</div>';
          return;
        }

        listEl.innerHTML = "";
        for (const acc of saved) {
          const profile = await ProfileManager.loadUser(acc.uid); // Fetch profile data if needed, but it might be locally cached.
          const isCurrent = AppState.currentUser?.uid === acc.uid;
          const nameStr = profile ? profile.name : acc.email;
          const avatarStr = profile
            ? `<div style=\"width:40px;height:40px;\">${ProfileManager.getAvatarHtml(profile)}</div>`
            : `<div style=\"width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;\">${(nameStr || "?")[0]}</div>`;

          const item = document.createElement("div");
          item.style.cssText = `display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.3); padding:10px; border-radius:12px; cursor:${isCurrent ? "default" : "pointer"}; border:1px solid ${isCurrent ? "var(--brand)" : "rgba(255,255,255,0.1)"}; position: relative;`;
          item.innerHTML = `
                        ${avatarStr}
                        <div style="flex:1; text-align:left;">
                            <div style="font-weight:bold; font-size:16px;">${Utils.escapeHtml(nameStr)}</div>
                            <div style="color:var(--text-muted); font-size:12px;">${Utils.escapeHtml(acc.email)}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${isCurrent ? '<span style="font-size:12px; color:var(--brand); background:rgba(0,255,136,0.1); padding:4px 8px; border-radius:6px;">Текущий</span>' : '<button class="secondary-btn" style="padding:4px 12px; font-size:12px; width:auto; border-radius:6px;">Войти</button>'}
                            <button class="danger-btn rm-acc-btn" data-email="${Utils.escapeHtml(acc.email)}" style="width: auto; padding: 4px; font-size: 14px; border-radius: 6px; background: transparent; border: 1px solid rgba(255,0,0,0.4); color: rgba(255,0,0,0.8);" title="Удалить аккаунт из списка">✕</button>
                        </div>
                    `;

          const rmBtn = item.querySelector(".rm-acc-btn");
          if (rmBtn) {
            rmBtn.onclick = (e) => {
              e.stopPropagation();
              const newSaved = saved.filter((a) => a.email !== acc.email);
              localStorage.setItem(
                "cowio_saved_accounts",
                JSON.stringify(newSaved),
              );
              Utils.toast("Аккаунт удален из списка");
              if (isCurrent && newSaved.length === 0) {
                localStorage.removeItem("cowio_saved_accounts");
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(
                  ({ signOut, getAuth }) => {
                    signOut(getAuth());
                  },
                );
              } else {
                this.initNavActions(); // Trigger re-render by calling the button simulate maybe?
                // Better: just re-click the switch account button
                const switchBtn = Utils.$("nav-switch-account");
                if (switchBtn) switchBtn.click();
              }
            };
          }

          if (!isCurrent) {
            item.onclick = (e) => {
              if (e.target.tagName === "BUTTON") return;
              if (!acc.pass) {
                Utils.toast("Пароль не сохранен. Войдите вручную.");
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(
                  ({ signOut, getAuth }) => signOut(getAuth()),
                );
                return;
              }
              import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(
                ({ signInWithEmailAndPassword, getAuth }) => {
                  Utils.toast("Вход...");
                  signInWithEmailAndPassword(getAuth(), acc.email, acc.pass)
                    .then(() => {
                      Utils.toast("Успешно!", "success");
                      Utils.$("btn-switch-account").onclick(); // Refresh UI
                    })
                    .catch((e) => {
                      Utils.toast("Ошибка входа", "error");
                    });
                },
              );
            };
          }
          listEl.appendChild(item);
        }
      };
    }
    if (Utils.$("btn-do-switch-account")) {
      Utils.$("btn-do-switch-account").onclick = () => {
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(
          ({ signOut, getAuth }) => {
            signOut(getAuth());
          },
        );
      };
    }
    if (Utils.$("btn-do-switch-account-clear")) {
      Utils.$("btn-do-switch-account-clear").onclick = () => {
        localStorage.removeItem("cowio_saved_accounts");
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(
          ({ signOut, getAuth }) => {
            signOut(getAuth());
          },
        );
      };
    }
    if (Utils.$("btn-open-my-profile-modal")) {
      Utils.$("btn-open-my-profile-modal").onclick = () =>
        ProfileManager.openProfileModal(AppState.currentUser?.uid);
    }

    const doSearch = async () => {
      const val = Utils.$("find-friend-input").value.trim().toLowerCase();
      const resContainer = Utils.$("find-friend-results");
      if (!val) {
        resContainer.innerHTML =
          '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Введите username для поиска</div>';
        return;
      }
      resContainer.innerHTML =
        '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Поиск...</div>';
      try {
        const snap = await get(ref(db, "users"));
        if (snap.exists()) {
          const allUsers = snap.val();
          let foundHtml = "";
          let foundCount = 0;
          for (const [uid, udata] of Object.entries(allUsers)) {
            if (uid === AppState.currentUser.uid) continue;
            if (
              udata.profile &&
              ((udata.profile.username &&
                udata.profile.username.toLowerCase().includes(val)) ||
                (udata.profile.extraUsernames &&
                  udata.profile.extraUsernames.some((u) =>
                    u.toLowerCase().includes(val),
                  )))
            ) {
              foundCount++;
              const isFriend =
                udata.friends &&
                udata.friends[AppState.currentUser.uid] &&
                udata.friends[AppState.currentUser.uid].status === "accepted";
              const avatar = `<div style=\"width:40px;height:40px;\">${ProfileManager.getAvatarHtml(udata.profile)}</div>`;
              foundHtml += `
                            <div class="user-card" onclick="ProfileManager.openProfileModal('${uid}')" style="cursor:pointer; display:flex; align-items:center; space-between; gap:10px;">
                                ${avatar}
                                <div class="user-card-info" style="flex:1;">
                                    <div class="user-card-name">${Utils.escapeHtml(udata.profile.name)}</div>
                                    <div class="user-card-username">@${Utils.escapeHtml(udata.profile.username)}</div>
                                </div>
                                ${isFriend ? '<span style="font-size:12px; color:var(--accent);">✓ Друг</span>' : '<button class="secondary-btn" style="width:auto; padding:4px 8px; font-size:10px;" onclick="event.stopPropagation(); FriendsManager.sendFriendRequest(\'' + uid + "')\">Добавить</button>"}
                            </div>
                            `;
            }
          }
          if (foundCount > 0) resContainer.innerHTML = foundHtml;
          else
            resContainer.innerHTML =
              '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Ничего не найдено</div>';
        }
      } catch (e) {
        resContainer.innerHTML =
          '<div style="font-size: 12px; color: var(--text-error); text-align: center;">Ошибка поиска</div>';
      }
    };

    const searchBtn = Utils.$("btn-find-friend");
    if (searchBtn) searchBtn.onclick = doSearch;
    const searchInput = Utils.$("find-friend-input");
    if (searchInput)
      searchInput.onkeyup = (e) => {
        if (e.key === "Enter") doSearch();
      };
  }

  static async sendFriendRequest(targetUid) {
    if (
      !SecurityManager.validateAction("friend_request", {
        count: 3,
        timeWindowMs: 60000,
      })
    )
      return;
    if (targetUid === AppState.currentUser.uid) return;
    try {
      await set(
        ref(
          db,
          `users/${targetUid}/friend-requests/${AppState.currentUser.uid}`,
        ),
        { ts: Date.now() },
      );
      this.sentFriendRequests.add(targetUid);
      Utils.toast("Заявка отправлена");
      if (AppState.currentRoomId) RoomManager.rerenderUsersList();
    } catch (e) {
      Utils.toast("Ошибка отправки", "error");
    }
  }

  static async handleRequest(targetUid, accept) {
    const myUid = AppState.currentUser.uid;
    try {
      const updates = {};
      if (accept) {
        const ts = Date.now();
        updates[`users/${myUid}/friends/${targetUid}`] = {
          status: "accepted",
          ts,
        };
        updates[`users/${targetUid}/friends/${myUid}`] = {
          status: "accepted",
          ts,
        };
      }
      updates[`users/${myUid}/friend-requests/${targetUid}`] = null;
      await update(ref(db), updates);
      delete this.pendingFriendRequestsMap[targetUid];
      this.sentFriendRequests.delete(targetUid);
      Utils.toast(accept ? "Друг добавлен" : "Заявка отклонена");
      if (AppState.currentRoomId) RoomManager.rerenderUsersList();
    } catch (e) {
      Utils.toast("Ошибка", "error");
    }
  }

  static _lastRequestsKeys = [];
  static _initialRequestsLoaded = false;

  static _renderRequestsId = 0;

  static async renderRequests(requests) {
    const renderId = ++this._renderRequestsId;
    const container = Utils.$("friend-requests-list");
    const badge = Utils.$("friend-req-badge");
    const keys = Object.keys(requests);

    if (!this._initialRequestsLoaded) {
      this._lastRequestsKeys = keys;
      this._initialRequestsLoaded = true;
    } else {
      const newKeys = keys.filter((k) => !this._lastRequestsKeys.includes(k));
      this._lastRequestsKeys = keys;

      newKeys.forEach((uid) => {
        ProfileManager.loadUser(uid).then((profile) => {
          if (profile) this.showFriendRequestNotification(uid, profile);
        });
      });
    }

    if (keys.length > 0) {
      badge.innerText = keys.length;
      badge.classList.add("show");
    } else {
      badge.classList.remove("show");
      container.innerHTML =
        '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет новых заявок</div>';
      return;
    }

    const itemsHtml = [];
    for (const uid of keys) {
      const profile = await ProfileManager.loadUser(uid);
      if (!profile) continue;
      itemsHtml.push({ uid, profile });
    }

    if (renderId !== this._renderRequestsId) return;

    container.innerHTML = "";
    for (const { uid, profile } of itemsHtml) {
      const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
      const div = document.createElement("div");
      div.className = "friend-request-item";
      div.innerHTML = `
                <div style="font-size: 13px;"><strong>${Utils.escapeHtml(profile.name)}</strong> ${roleBadgeHtml} хочет в друзья</div>
                <div class="req-actions">
                    <button class="btn-small btn-accept">Принять</button>
                    <button class="btn-small btn-decline">Отклонить</button>
                </div>
            `;
      div.querySelector(".btn-accept").onclick = () =>
        this.handleRequest(uid, true);
      div.querySelector(".btn-decline").onclick = () =>
        this.handleRequest(uid, false);
      container.appendChild(div);
    }
  }

  static showFriendRequestNotification(uid, profile) {
    let container = Utils.$("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const div = document.createElement("div");
    div.className = "toast";
    div.style.borderLeft = `4px solid var(--accent)`;
    div.style.pointerEvents = "all";
    div.innerHTML = `
            <div style="margin-bottom:8px;"><strong>${Utils.escapeHtml(profile.name)}</strong> хочет в друзья.</div>
            <div style="display:flex; gap:8px;">
                <button class="secondary-btn btn-small btn-accept-toast" style="flex:1; padding:6px; font-size:11px;">Принять</button>
                <button class="secondary-btn btn-small btn-close-toast" style="padding:6px; font-size:11px;">✕</button>
            </div>
        `;

    div.querySelector(".btn-accept-toast").onclick = () => {
      this.handleRequest(uid, true);
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 300);
    };
    div.querySelector(".btn-close-toast").onclick = () => {
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 300);
    };

    container.appendChild(div);

    setTimeout(() => {
      if (div.parentNode) {
        div.style.opacity = "0";
        setTimeout(() => div.remove(), 300);
      }
    }, 12000);
  }

  static async renderFriends(friendsMap) {
    const container = Utils.$("friends-list");
    const keys = Object.keys(friendsMap).filter(
      (k) => friendsMap[k].status === "accepted",
    );

    if (keys.length === 0) {
      container.innerHTML =
        '<div style="font-size: 12px; color: var(--text-muted); padding: 5px; text-align: center;">Нет друзей. Общайтесь в комнатах!</div>';
      return;
    }

    Array.from(container.children).forEach((child) => {
      if (!keys.includes(child.dataset.uid)) child.remove();
    });

    for (const uid of keys) {
      const profile = await ProfileManager.loadUser(uid);
      if (!profile) continue;

      get(ref(db, `users/${uid}/status`)).then((snap) => {
        const status = snap.val() || { online: false };
        const isOnline = status.online;

        let div = Utils.$(`friend-${uid}`);
        if (!div) {
          div = document.createElement("div");
          div.className = "friend-item";
          div.id = `friend-${uid}`;
          div.dataset.uid = uid;
          div.onclick = () => ProfileManager.openViewProfileModal(uid);
          container.appendChild(div);
        }

        const relData = friendsMap[uid];
        const activeStreak = ProfileManager.getActiveStreak
          ? ProfileManager.getActiveStreak(profile)
          : profile.streak;
        const streakHTML =
          activeStreak && activeStreak > 0
            ? `<div style="position: absolute; bottom: 8px; right: 12px; background: rgba(0,0,0,0.4); border-radius: 12px; padding: 2px 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: rgba(255,255,255,0.8);" title="Стрик захода: ${activeStreak} дней"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width:14px; height:14px; margin-right:4px;">${activeStreak}</div>`
            : "";

        const isFriendPremium = window.PremiumManager
          ? PremiumManager.isPremiumActive(profile, uid)
          : false;
        if (isFriendPremium) {
          div.style.cssText =
            "position: relative; background: radial-gradient(circle at 20% 0%, rgba(255, 180, 60, 0.18), transparent 45%), radial-gradient(circle at 90% 100%, rgba(255, 120, 40, 0.12), transparent 40%), linear-gradient(145deg, rgba(24, 20, 14, 0.96), rgba(10, 10, 12, 0.98)); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 220, 140, 0.08); border: 1px solid rgba(255, 200, 100, 0.22); margin-bottom: 2px;";
        } else {
          div.style.cssText = "position: relative;";
        }

        const roleBadgeHtml = ProfileManager.getRoleBadgeHtml(profile, uid);
        div.innerHTML = `
                    <div class="avatar" style="position:relative; overflow:visible; background:transparent;">
                        ${ProfileManager.getAvatarHtml(profile)}
                    </div>
                    ${streakHTML}
                    <div class="friend-info-col" style="flex:1;">
                        <div class="friend-name">${Utils.escapeHtml(profile.name)} ${roleBadgeHtml}</div>
                        <div class="friend-status" style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                            <div class="status-dot ${isOnline ? "online" : ""}" style="display:inline-block;"></div>
                            ${isOnline ? "Онлайн" : status.lastSeen ? `Был(а) ${Utils.formatLastSeen(status.lastSeen)}` : "Офлайн"}
                        </div>
                    </div>
                `;
      });
    }
  }
}

class DirectMessages {
  static heartsTimer = null;
  static theme = "default";
  static themeOptions = [
    "default",
    "love",
    "light",
    "aurora",
    "sunset",
    "ocean",
  ];

  static getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  static closeChat() {
    if (this.unsubCurrent) {
      this.unsubCurrent();
      this.unsubCurrent = null;
    }
    AppState.currentDirectChat = null;
    const modal = Utils.$("modal-dm-chat");
    if (modal) modal.classList.remove("active");
    this.stopLoveHearts();
    if (Utils.$("dm-input")) Utils.$("dm-input").value = "";
    if (Utils.$("dm-messages")) Utils.$("dm-messages").innerHTML = "";
    if (Utils.$("dm-chat-title"))
      Utils.$("dm-chat-title").innerText = "Личный чат";
    Utils.$("dm-theme-controls")?.classList.remove("active");
  }

  static startNotifications() {
    if (!AppState.currentUser) return;
    const dmRoot = ref(db, "direct-messages");
    const unsub = onValue(dmRoot, (snap) => {
      const chats = snap.val() || {};
      // Update the sidebar whenever there's a new message or chat update
      if (AppState.currentDirectChat) {
        this.populateSidebar(AppState.currentDirectChat.uid, chats);
      }

      Object.entries(chats).forEach(([chatId, chat]) => {
        if (
          !chat?.participants?.[AppState.currentUser.uid] ||
          !chat.lastMessage
        )
          return;

        const marker = `dmSeen:${chatId}`;
        const seenTs = Number(localStorage.getItem(marker) || "0");
        const lastTs = Number(chat.lastMessage.ts || 0);

        if (
          lastTs <= seenTs ||
          chat.lastMessage.fromUid === AppState.currentUser.uid
        )
          return;
        if (AppState.currentDirectChat?.id === chatId) return;

        localStorage.setItem(marker, String(lastTs));
        EasterEggManager.playNotification();
        if (chat.lastMessage.type === "invite") {
          Utils.toast(
            `ЛС: ${chat.lastMessage.fromName} приглашает вас в комнату!`,
          );
        } else if (chat.lastMessage.type === "text") {
          Utils.toast(
            `ЛС от ${chat.lastMessage.fromName}: ${chat.lastMessage.text}`,
          );
        } else {
          Utils.toast(`ЛС от ${chat.lastMessage.fromName} отправил(а) медиа`);
        }
      });
    });
    AppState.activeSubscriptions.push(() => off(dmRoot, "value", unsub));
  }

  static async populateSidebar(activeTargetUid, chatsData = null) {
    const sidebar = Utils.$("dm-sidebar-list");
    if (!sidebar) return;

    // Build list of users with whom we have chats AND friends, to show in sidebar
    const myUid = AppState.currentUser.uid;

    let chats = chatsData;
    if (!chats) {
      const snap = await get(ref(db, "direct-messages"));
      chats = snap.val() || {};
    }

    const activeChats = Object.entries(chats)
      .filter(([id, c]) => c.participants && c.participants[myUid])
      .map(([id, c]) => ({
        id,
        partnerUid:
          Object.keys(c.participants).find((x) => x !== myUid) || myUid,
        lastMsg: c.lastMessage || {},
        updatedAt: c.updatedAt || 0,
      }));

    const friendsKeys = Object.keys(AppState.friendsCache || {}).filter(
      (k) => AppState.friendsCache[k].status === "accepted",
    );

    const combinedUids = new Set([
      ...activeChats.map((c) => c.partnerUid),
      ...friendsKeys,
      activeTargetUid,
    ]);

    let listItems = [];

    for (const uid of combinedUids) {
      if (!uid) continue;
      const profile = await ProfileManager.loadUser(uid);
      if (!profile) continue;

      const chatObj = activeChats.find((c) => c.partnerUid === uid);
      const ts = chatObj ? chatObj.updatedAt : 0;
      let lastText = "";
      if (chatObj && chatObj.lastMsg) {
        if (chatObj.lastMsg.type === "text") lastText = chatObj.lastMsg.text;
        else if (chatObj.lastMsg.type === "invite")
          lastText = "Приглашение в комнату";
        else lastText = "Медиа";
      }

      const isPinned = localStorage.getItem(`dmPin:${uid}`) === "1";

      listItems.push({
        uid,
        name: profile.name,
        avatar: profile.avatar,
        frame: profile.frame,
        lastText,
        ts,
        isPinned,
        isActive: activeTargetUid === uid,
      });
    }

    listItems.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.ts - a.ts;
    });

    // Ensure active user is present even if newly opened
    sidebar.innerHTML = "";
    listItems.forEach((item) => {
      const el = document.createElement("div");
      el.className = `dm-chat-item ${item.isActive ? "active" : ""} ${item.isPinned ? "pinned" : ""}`;
      el.innerHTML = `
                <div class="dm-chat-avatar">${ProfileManager.getAvatarHtml(item)}</div>
                <div class="dm-chat-info">
                    <div class="dm-chat-name">${Utils.escapeHtml(item.name)}</div>
                    <div class="dm-chat-last-msg">${Utils.escapeHtml(item.lastText) || "<i>Нет сообщений</i>"}</div>
                </div>
                <button class="dm-pin-btn" title="Закрепить">${item.isPinned ? '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Pushpin.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;opacity:0.5;">'}</button>
            `;

      el.onclick = (e) => {
        if (e.target.closest(".dm-pin-btn")) {
          if (item.isPinned) localStorage.removeItem(`dmPin:${item.uid}`);
          else localStorage.setItem(`dmPin:${item.uid}`, "1");
          const scrollP = sidebar.scrollTop;
          this.populateSidebar(activeTargetUid, chatsData).then(() => {
            const newSidebar = Utils.$("dm-sidebar-list");
            if (newSidebar) newSidebar.scrollTop = scrollP;
          });
          return;
        }
        if (!item.isActive) {
          this.openChat(item.uid, item.name);
        }
      };
      sidebar.appendChild(el);
    });
  }

  static openChat(targetUid, targetName) {
    if (this.unsubCurrent) this.unsubCurrent();
    
    // Clear the chat view before rendering a new chat
    const msgList = document.getElementById("dm-messages");
    if (msgList) msgList.innerHTML = "";

    const chatId = this.getChatId(AppState.currentUser.uid, targetUid);
    AppState.currentDirectChat = {
      uid: targetUid,
      name: targetName,
      id: chatId,
    };

    Utils.$("dm-chat-title").innerText = `Чат: ${targetName}`;

    // Fetch last seen for target
    get(ref(db, `users/${targetUid}/status`)).then((snap) => {
      const st = snap.val() || {};
      const isOnline = st.online;
      const subtitle = isOnline
        ? "Онлайн"
        : st.lastSeen
          ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}`
          : "Приватные сообщения";
      const subtitleEl = Utils.$("dm-chat-title").nextElementSibling;
      if (subtitleEl) subtitleEl.innerText = subtitle;
    });

    const typingRef = ref(db, `direct-messages/${chatId}/typing/${targetUid}`);
    const typingUnsub = onValue(typingRef, (snap) => {
      const isTyping = !!snap.val();
      const typingEl = Utils.$("dm-typing-status");
      if (typingEl) {
        typingEl.innerText = isTyping ? "печатает..." : "";
      }
    });

    const btnCloseSidebar = Utils.$("btn-dm-sidebar-close");
    if (btnCloseSidebar) {
      btnCloseSidebar.onclick = () => {
        Utils.$("modal-dm-chat").classList.remove("active");
      };
    }

    Utils.$("modal-dm-chat").classList.add("active");
    const dmContent = document.querySelector(".dm-modal-content");
    if (dmContent) dmContent.classList.add("chat-active");

    const btnBack = Utils.$("btn-dm-back");
    if (btnBack) {
      btnBack.style.display = window.innerWidth <= 1024 ? "block" : "none";
      btnBack.onclick = () => {
        if (dmContent) dmContent.classList.remove("chat-active");
      };
    }

    this.bindThemeControls();
    this.applyTheme(this.theme, false);
    this.populateSidebar(targetUid);

    const chatRef = ref(db, `direct-messages/${chatId}`);
    const origUnsub = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const dbTheme = this.normalizeTheme(data.theme || "default");
      if (dbTheme !== this.theme) this.applyTheme(dbTheme, false);
      const messages = Object.entries(data.messages || {})
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => a.ts - b.ts);
      this.renderMessages(messages);
      if (data.lastMessage?.ts)
        localStorage.setItem(`dmSeen:${chatId}`, String(data.lastMessage.ts));
    });

    this.unsubCurrent = () => {
      origUnsub();
      typingUnsub();
    };

    const sendBtn = Utils.$("btn-dm-send");
    const input = Utils.$("dm-input");

    const attachBtn = Utils.$("btn-dm-attach");
    const mediaPicker = Utils.$("dm-media-picker");
    const mediaInput = Utils.$("dm-media-input");
    const mediaSendBtn = Utils.$("btn-dm-media-send");
    const mediaCancelBtnTop = Utils.$("btn-dm-media-cancel-top");

    const attachMediaAction = () => {
      if (mediaPicker) {
        mediaPicker.style.display =
          mediaPicker.style.display === "none" ? "flex" : "none";
      }
    };

    const attachBtnFile = Utils.$("btn-dm-attach-file");
    if (attachBtnFile) {
      attachBtnFile.onclick = () => {
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

              const myProfile = AppState.usersCache.get(
                AppState.currentUser.uid,
              );
              const myName =
                myProfile?.name || AppState.currentUser.displayName || "User";

              const payload = {
                type: "media",
                fromUid: AppState.currentUser.uid,
                fromName: myName,
                url: compressedBase64,
                timestamp: Date.now(),
              };

              push(
                ref(
                  db,
                  `direct-messages/${AppState.currentDirectChat.id}/messages`,
                ),
                payload,
              );
              update(
                ref(db, `direct-messages/${AppState.currentDirectChat.id}`),
                {
                  lastMessage: "Картинка",
                  updatedAt: Date.now(),
                },
              );
            };
            img.src = re.target.result;
          };
          reader.readAsDataURL(file);
        };
        inputImg.click();
      };
    }

    if (attachBtn) attachBtn.onclick = attachMediaAction;
    if (mediaCancelBtnTop)
      mediaCancelBtnTop.onclick = () => (mediaPicker.style.display = "none");

    const performMediaSend = async (url) => {
      if (
        !SecurityManager.validateAction("dm_message", {
          count: 10,
          timeWindowMs: 10000,
        })
      )
        return;
      if (!url) return;
      if (AdminPanel.isSystemReadOnlyForUser())
        return Utils.toast("Система в режиме ReadOnly", "error");
      mediaInput.value = "";
      mediaPicker.style.display = "none";
      const myProfile = AppState.usersCache.get(AppState.currentUser.uid);
      const myName =
        myProfile?.name || AppState.currentUser.displayName || "User";

      const payload = {
        type: "media",
        url,
        fromUid: AppState.currentUser.uid,
        fromName: myName,
        ts: Date.now(),
      };
      await update(ref(db, `direct-messages/${chatId}`), {
        participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
        updatedAt: payload.ts,
        lastMessage: payload,
      });
      await push(ref(db, `direct-messages/${chatId}/messages`), payload);
    };

    if (mediaPicker) {
      const catContainer = Utils.$("dm-emoji-categories");
      const resultsContainer = Utils.$("dm-gif-results");
      if (catContainer && resultsContainer && !catContainer.hasChildNodes()) {
        const groupings = {};
        if (window.ANIMATED_EMOJIS) {
          window.ANIMATED_EMOJIS.forEach((url) => {
            const parts = url.split("/");
            const category = parts[parts.length - 2] || "Other";
            if (!groupings[category]) groupings[category] = [];
            groupings[category].push(url);
          });
        }

        let firstCat = null;
        for (const cat in groupings) {
          if (!firstCat) firstCat = cat;
          const btn = document.createElement("button");
          btn.className = "secondary-btn";
          btn.style.padding = "4px 8px";
          btn.style.fontSize = "12px";
          btn.innerText = cat;
          btn.onclick = () => {
            Array.from(catContainer.children).forEach(
              (c) => (c.style.background = "transparent"),
            );
            btn.style.background = "rgba(255,255,255,0.2)";
            renderEmojis(cat);
          };
          catContainer.appendChild(btn);
        }

        const renderEmojis = (cat) => {
          const urls = groupings[cat] || [];
          resultsContainer.innerHTML = urls
            .map(
              (url) =>
                `<img src="${url}" class="dm-preset-gif" loading="lazy" style="height:48px; width:48px; object-fit:contain; border-radius:6px; cursor:pointer; padding:2px;" title="${url.split("/").pop().split(".")[0]}" />`,
            )
            .join("");

          resultsContainer.querySelectorAll(".dm-preset-gif").forEach((img) => {
            img.onclick = () => performMediaSend(img.src);
          });
        };

        if (firstCat) {
          catContainer.firstChild.click();
        }
      }
    }

    const sendAction = async () => {
      if (
        !SecurityManager.validateAction("dm_message", {
          count: 10,
          timeWindowMs: 10000,
        })
      )
        return;
      const text = input.value.trim();
      if (!text) return;
      if (!SecurityManager.validateTextPayload(text, 2000, "dm")) return;
      if (AdminPanel.isSystemReadOnlyForUser())
        return Utils.toast("Система в режиме ReadOnly", "error");
      input.value = "";

      const myProfile = AppState.usersCache.get(AppState.currentUser.uid);
      const myName =
        myProfile?.name || AppState.currentUser.displayName || "User";
      const payload = {
        type: "text",
        fromUid: AppState.currentUser.uid,
        fromName: myName,
        text,
        ts: Date.now(),
      };

      await update(ref(db, `direct-messages/${chatId}`), {
        participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
        updatedAt: payload.ts,
        lastMessage: payload,
      });
      await push(ref(db, `direct-messages/${chatId}/messages`), payload);
    };

    sendBtn.onclick = sendAction;
    input.onkeydown = (e) => {
      if (e.key === "Enter") sendAction();
    };

    Utils.$("modal-dm-chat").querySelector(".btn-close-modal").onclick = () =>
      this.closeChat();
  }

  static renderMessages(messages) {
    const list = Utils.$("dm-messages");
    if (!messages.length) {
      list.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>`;
      return;
    }

    let _lastDateStr = null;

    list.innerHTML = messages
      .map((m) => {
        const isSelf = m.fromUid === AppState.currentUser.uid;
        let dateHeaderHtml = "";

        if (m.type !== "system") {
          const dateObj = new Date(m.ts);
          const dateStr = dateObj.toLocaleDateString();
          if (dateStr !== _lastDateStr) {
            dateHeaderHtml = `\n<div style="text-align:center; margin: 15px 0;"><span style="background:rgba(255,255,255,0.1); padding:4px 12px; border-radius:12px; font-size:12px; color:var(--text-muted);">${dateStr}</span></div>\n`;
            _lastDateStr = dateStr;
          }
        }

        if (m.type === "system") {
          return (
            dateHeaderHtml +
            `<div class="sys-msg">${Utils.escapeHtml(m.fromName || "Пользователь")} ${Utils.escapeHtml(m.text || "")}</div>`
          );
        }

        if (m.type === "invite") {
          return (
            dateHeaderHtml +
            `
                    <div class="m-line ${isSelf ? "self" : ""}">
                        <strong>${Utils.escapeHtml(isSelf ? "Вы" : m.fromName)}</strong>
                        <div class="bubble" style="border: 1px solid var(--accent); background: rgba(46,213,115,0.1);">
                            <div style="font-weight:bold; margin-bottom:5px;">Привет! Заходи к нам:</div>
                            <div style="font-size: 16px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> ${Utils.escapeHtml(m.roomName)}</div>
                            <div style="font-size: 12px; opacity:0.8; margin-bottom:8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Зрителей: ${m.membersCount || 1}</div>
                            ${
                              !isSelf
                                ? `
                                <div style="display:flex; gap:10px;">
                                    <button class="primary-btn" style="padding:6px; font-size:12px; width:auto;" onclick="window.acceptRoomInvite('${m.roomId}')">Принять</button>
                                    <button class="secondary-btn" style="padding:6px; font-size:12px; width:auto;" onclick="this.parentElement.innerHTML='Отклонено'">Отклонить</button>
                                </div>
                            `
                                : `<div style="font-size:11px; opacity:0.6; margin-top:5px;">Приглашение отправлено</div>`
                            }
                        </div>
                    </div>
                `
          );
        }

        if (m.type === "file" || m.type === "gif" || m.type === "media") {
          const isImg =
            m.type === "gif" ||
            String(m.url).match(/\.(gif|jpe?g|png|webp|bmp)$/i) ||
            String(m.url).match(/tenor\.com|giphy\.com|imgur\.com/i) ||
            String(m.url).startsWith("data:image/");
          return (
            dateHeaderHtml +
            `
                    <div class="m-line ${isSelf ? "self" : ""}">
                        <strong>${Utils.escapeHtml(isSelf ? "Вы" : m.fromName)}</strong>
                        <div class="bubble" style="padding: 4px;">
                            ${isImg ? `<img src="${Utils.escapeHtml(m.url)}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x150?text=Error';" />` : `<a href="${Utils.escapeHtml(m.url)}" target="_blank" style="color: var(--accent); padding: 8px; display: inline-block;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Paperclip.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">Прикрепленный файл</a>`}
                        </div>
                    </div>
                `
          );
        }

        return (
          dateHeaderHtml +
          `
                <div class="m-line ${isSelf ? "self" : ""}">
                    <strong>${Utils.escapeHtml(isSelf ? "Вы" : m.fromName)}</strong>
                    <div class="bubble">${Utils.escapeHtml(m.text)}</div>
                </div>
            `
        );
      })
      .join("");
    list.scrollTop = list.scrollHeight;
    if (this.theme === "love") this.startLoveHearts();
  }

  static bindThemeControls() {
    const toggle = Utils.$("btn-dm-theme-toggle");
    const carousel = Utils.$("dm-theme-carousel");
    if (!toggle || !carousel) return;

    toggle.onclick = () => {
      const uid = AppState?.currentUser?.uid;
      const profile = uid ? AppState.usersCache.get(uid) : null;
      const isPremium = profile
        ? PremiumManager.isPremiumActive(profile, uid) ||
          PremiumManager.isStaff(profile, uid)
        : false;

      if (!isPremium) {
        return Utils.toast("Смена темы доступна только с Premium!", "error");
      }
      carousel.classList.toggle("active");
      if (carousel.classList.contains("active")) {
        this.renderThemeCarousel();
      }
    };

    Utils.$("dm-theme-prev")?.addEventListener("click", () =>
      this.stepThemeCarousel(-1),
    );
    Utils.$("dm-theme-next")?.addEventListener("click", () =>
      this.stepThemeCarousel(1),
    );
  }

  static currentThemeFolder = "favorites";
  static themeIndex = 0;
  static selectedTheme = "default";

  static renderThemeCarousel() {
    if (!this.currentThemeFolder)
      this.currentThemeFolder = Object.keys(ThemeManager.FOLDERS)[0];

    // Render Folders
    const foldersContainer = Utils.$("dm-theme-folders");
    if (foldersContainer) {
      foldersContainer.innerHTML = "";
      const fKeys = Object.keys(ThemeManager.FOLDERS);
      fKeys.forEach((fKey, index) => {
        const btn = document.createElement("button");
        btn.className = `secondary-btn theme-folder-btn ${fKey === this.currentThemeFolder ? "active" : ""}`;
        btn.dataset.folder = fKey;
        btn.innerHTML = ThemeManager.FOLDERS[fKey].label;
        btn.style.padding = "6px 12px";
        btn.style.fontSize = "12px";
        btn.onclick = () => {
          foldersContainer
            .querySelectorAll(".theme-folder-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentThemeFolder = fKey;
          this.renderCarouselTrack(fKey);
        };
        foldersContainer.appendChild(btn);
      });
    }

    this.renderCarouselTrack(this.currentThemeFolder);
  }

  static renderCarouselTrack(fKey) {
    const track = Utils.$("dm-theme-track");
    if (!track) return;
    track.innerHTML = "";

    // Need to initialize selectedTheme to current theme
    this.selectedTheme = this.theme;

    const themesList = ThemeManager.FOLDERS[fKey]?.themes || [];
    if (fKey === "favorites" && !themesList.length) {
      track.innerHTML = `
                <div class="theme-card theme-card-empty">
                    <div class="theme-empty-msg">Нажмите ★ на любой теме,<br>чтобы добавить в любимые</div>
                </div>
            `;
      this.themeIndex = 0;
      this.updateThemeTransform();
      return;
    }

    themesList.forEach((themeKey) => {
      const t = ThemeManager.EXTENDED_THEMES[themeKey];
      if (!t) return;
      const isFav = ThemeManager.isFavorite(themeKey);
      const div = document.createElement("div");
      div.className = `theme-card ${this.selectedTheme === themeKey ? "active" : ""}`;
      div.dataset.theme = themeKey;
      div.innerHTML = `
                <button type="button" class="theme-fav-btn ${isFav ? "active" : ""}" data-theme="${themeKey}" title="${isFav ? "Убрать из любимых" : "В любимые"}">★</button>
                <div class="theme-rect ${themeKey}"></div>
                <div class="theme-name">${ThemeManager.getThemeLabel(themeKey)}</div>
                <div class="theme-check">✓</div>
            `;
      track.appendChild(div);
    });

    track.querySelectorAll(".theme-fav-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        ThemeManager.toggleFavorite(btn.dataset.theme);
        this.renderCarouselTrack(this.currentThemeFolder);
      };
    });

    const opts = ThemeManager.FOLDERS[this.currentThemeFolder]?.themes || [];
    const idx = opts.indexOf(this.selectedTheme);
    if (idx >= 0) this.themeIndex = idx;
    else
      this.themeIndex = Math.min(this.themeIndex, Math.max(0, opts.length - 1));
    this.updateThemeTransform();

    track.querySelectorAll(".theme-card").forEach((card) => {
      card.onclick = () => {
        const t = card.dataset.theme;
        if (!t) return;
        this.applyTheme(t, true);
        this.selectedTheme = t;
        const opts = ThemeManager.FOLDERS[this.currentThemeFolder].themes;
        this.themeIndex = Math.max(0, opts.indexOf(t));
        this.updateThemeTransform();
      };
    });
  }

  static stepThemeCarousel(direction = 1) {
    const opts = ThemeManager.FOLDERS[this.currentThemeFolder]?.themes || [];
    if (!opts.length) return;
    this.themeIndex = (this.themeIndex + direction + opts.length) % opts.length;
    this.updateThemeTransform();
  }

  static updateThemeTransform() {
    const track = Utils.$("dm-theme-track");
    if (!track) return;
    track.style.transform = `translateX(-${this.themeIndex * 100}%)`;
    track.querySelectorAll(".theme-card").forEach((card) => {
      card.classList.toggle(
        "active",
        card.dataset.theme === this.selectedTheme,
      );
    });
  }

  static normalizeTheme(theme = "default") {
    return ThemeManager.EXTENDED_THEMES[theme] ? theme : "default";
  }

  static applyTheme(theme = "default", persist = false) {
    const modal = Utils.$("modal-dm-chat");
    if (!modal) return;
    const uid = AppState?.currentUser?.uid;
    const profile = uid ? AppState.usersCache.get(uid) : null;
    if (
      window.PremiumManager &&
      !PremiumManager.canUseTheme(theme, profile, uid)
    ) {
      Utils.toast("Эта тема доступна только Premium-подписчикам", "info");
      return;
    }
    this.theme = this.normalizeTheme(theme);
    Object.keys(ThemeManager.EXTENDED_THEMES).forEach((k) =>
      modal.classList.remove("theme-" + k),
    );
    if (this.theme !== "default") modal.classList.add(`theme-${this.theme}`);
    Utils.$("dm-theme-controls")
      ?.querySelectorAll(".dm-theme-chip")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === this.theme);
      });
    if (this.theme === "love") this.startLoveHearts();
    else this.stopLoveHearts();

    if (persist && AppState.currentDirectChat?.id) {
      const profile = AppState.usersCache.get(AppState.currentUser.uid) || {};
      update(ref(db, `direct-messages/${AppState.currentDirectChat.id}`), {
        theme: this.theme,
        updatedAt: Date.now(),
      }).catch(() => {});
      push(
        ref(db, `direct-messages/${AppState.currentDirectChat.id}/messages`),
        {
          type: "system",
          fromUid: AppState.currentUser.uid,
          fromName:
            profile.name || AppState.currentUser.displayName || "Пользователь",
          text: `сменил тему чата на "${this.theme}"`,
          ts: Date.now(),
        },
      ).catch(() => {});
    }
  }

  static startLoveHearts() {
    if (this.theme !== "love") return;
    if (this.heartsTimer) return;

    const spawnHeart = () => {
      const layer = Utils.$("dm-love-hearts");
      if (!layer) return;
      const heart = document.createElement("div");
      const roll = Math.random();
      const mode = roll < 0.33 ? "far" : roll > 0.74 ? "near" : "mid";
      heart.className = `love-heart ${mode}`;
      heart.innerHTML =
        RoomManager.loveHeartEmojis[
          Math.floor(Math.random() * RoomManager.loveHeartEmojis.length)
        ];
      heart.style.left = `${Utils.getDistributedHeartLeft(layer, "dm-love")}%`; // [UPDATE]
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

    for (let i = 0; i < 8; i++) spawnHeart();
    this.heartsTimer = setInterval(spawnHeart, 1700);
  }

  static stopLoveHearts() {
    if (this.heartsTimer) {
      clearInterval(this.heartsTimer);
      this.heartsTimer = null;
    }
    const layer = Utils.$("dm-love-hearts");
    if (layer) layer.innerHTML = "";
  }

  static async sendRoomInvite(targetUid) {
    if (
      !AppState.currentRoomId ||
      !targetUid ||
      targetUid === AppState.currentUser.uid
    )
      return;
    if (AdminPanel.isSystemReadOnlyForUser())
      return Utils.toast("Система в режиме ReadOnly", "error");
    if (
      AppState.admin.settings.globalInvitesBlocked &&
      !AdminPanel.isCurrentUserAdmin()
    )
      return Utils.toast("Инвайты временно отключены администратором", "error");
    if (AppState.currentPresenceCache?.[targetUid])
      return Utils.toast("Пользователь уже находится в комнате", "error");

    const roomData = AppState.roomsCache.get(AppState.currentRoomId);
    if (!roomData) return Utils.toast("Комната больше не существует", "error");

    const cooldownKey = `${AppState.currentRoomId}:${targetUid}`;
    const lastInviteTs = AppState.inviteCooldowns.get(cooldownKey) || 0;
    if (Date.now() - lastInviteTs < 10000)
      return Utils.toast("Не спамьте инвайтами — подождите 10 секунд", "error");

    const chatId = this.getChatId(AppState.currentUser.uid, targetUid);
    const membersCount =
      Object.keys(AppState.currentPresenceCache || {}).length || 1;
    const senderProfile =
      AppState.usersCache.get(AppState.currentUser.uid) || {};

    const payload = {
      type: "invite",
      inviteId: Utils.generateCryptoId(8),
      roomId: AppState.currentRoomId,
      roomName: roomData.name,
      membersCount: membersCount,
      fromUid: AppState.currentUser.uid,
      fromName:
        senderProfile.name ||
        AppState.currentUser.displayName ||
        "Пользователь",
      text: `Приглашение в комнату: ${roomData.name}`,
      ts: Date.now(),
    };

    AppState.inviteCooldowns.set(cooldownKey, payload.ts);

    await update(ref(db, `direct-messages/${chatId}`), {
      participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
      updatedAt: payload.ts,
      lastMessage: payload,
    });
    await push(ref(db, `direct-messages/${chatId}/messages`), payload);
    Utils.toast("Приглашение отправлено");
  }
}

window.DirectMessages = DirectMessages;

window.acceptRoomInvite = async (roomId) => {
  if (!roomId) return;
  try {
    const snap = await get(ref(db, `rooms/${roomId}`));
    if (!snap.exists())
      return Utils.toast("Комната больше не существует", "error");

    const roomData = snap.val();
    AppState.roomsCache.set(roomId, roomData);

    if (AppState.currentRoomId === roomId) {
      DirectMessages.closeChat();
      return Utils.toast("Вы уже находитесь в этой комнате");
    }

    DirectMessages.closeChat();
    RoomManager.enterRoomFinal(roomId, roomData);
  } catch (e) {
    Utils.toast("Не удалось открыть приглашение", "error");
  }
};

// ============================================================================
// 4.5. СИСТЕМА ЖАЛОБ НА ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================================

class ReportManager {
  static currentTargetUid = null;
  static selectedCategory = null;
  static _initialized = false;

  static init() {
    if (this._initialized) return;
    this._initialized = true;

    const modal = Utils.$("modal-report-profile");
    if (!modal) return;

    // Close buttons
    const closeBtns = modal.querySelectorAll(
      ".btn-close-modal, #btn-close-report-profile-modal, #btn-cancel-profile-report"
    );
    closeBtns.forEach((btn) => {
      btn.onclick = () => this.closeModal();
    });

    // Category click handling
    const categoryItems = modal.querySelectorAll(".report-category-item");
    categoryItems.forEach((item) => {
      item.onclick = () => {
        const cat = item.dataset.category;
        this.selectCategory(cat, item);
      };
    });

    // Comment input handling
    const commentInput = Utils.$("report-profile-comment");
    if (commentInput) {
      commentInput.oninput = () => {
        this.validateForm();
      };
    }

    // Submit button
    const submitBtn = Utils.$("btn-submit-profile-report");
    if (submitBtn) {
      submitBtn.onclick = () => {
        this.submitReport();
      };
    }
  }

  static selectCategory(category, element) {
    this.selectedCategory = category;

    const modal = Utils.$("modal-report-profile");
    if (!modal) return;

    modal.querySelectorAll(".report-category-item").forEach((el) => {
      el.classList.remove("selected");
    });
    if (element) {
      element.classList.add("selected");
    }

    const commentWrap = Utils.$("report-step-comment-wrap");
    if (commentWrap) {
      commentWrap.style.display = "block";
      commentWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const commentInput = Utils.$("report-profile-comment");
    if (commentInput) {
      commentInput.focus();
    }

    this.validateForm();
  }

  static validateForm() {
    const submitBtn = Utils.$("btn-submit-profile-report");
    if (!submitBtn) return false;

    const commentInput = Utils.$("report-profile-comment");
    const commentVal = commentInput ? commentInput.value.trim() : "";
    const isValid = Boolean(this.selectedCategory && commentVal.length >= 5);

    submitBtn.disabled = !isValid;
    if (isValid) {
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
    } else {
      submitBtn.style.opacity = "0.5";
      submitBtn.style.cursor = "not-allowed";
    }

    const hint = Utils.$("report-profile-comment-hint");
    if (hint) {
      if (commentVal.length === 0) {
        hint.textContent = "Минимум 5 символов";
        hint.style.color = "var(--text-muted)";
      } else if (commentVal.length < 5) {
        hint.textContent = `Ещё ${5 - commentVal.length} симв.`;
        hint.style.color = "#ff6b81";
      } else {
        hint.textContent = `Готово (${commentVal.length} симв.)`;
        hint.style.color = "var(--accent)";
      }
    }

    return isValid;
  }

  static async openProfileReportModal(rawTargetUid) {
    this.init();

    if (!AppState.currentUser) {
      Utils.toast("Войдите в аккаунт, чтобы отправить жалобу", "warning");
      return;
    }

    const reporterUid = AppState.currentUser.uid;
    const targetUid =
      typeof rawTargetUid === "object" && rawTargetUid !== null
        ? rawTargetUid.uid || rawTargetUid.id
        : rawTargetUid;

    if (!targetUid) {
      Utils.toast("Не удалось определить профиль пользователя", "error");
      return;
    }

    if (reporterUid === targetUid) {
      Utils.toast("Вы не можете пожаловаться на собственный профиль", "info");
      return;
    }

    if (
      window.SupportSystem &&
      SupportSystem.BANNED_USERS &&
      SupportSystem.BANNED_USERS.has(reporterUid)
    ) {
      Utils.toast("Вы заблокированы в системе поддержки", "error");
      return;
    }

    this.currentTargetUid = targetUid;
    this.selectedCategory = null;

    // Load target user profile
    let targetProfile = AppState.usersCache ? AppState.usersCache.get(targetUid) : null;
    if (!targetProfile) {
      try {
        targetProfile = await ProfileManager.loadUser(targetUid);
      } catch (e) {
        console.warn("Failed to load target profile for report:", e);
      }
    }
    targetProfile = targetProfile || {};

    // Populate preview card
    const targetNameEl = Utils.$("report-target-name-preview");
    const targetUserEl = Utils.$("report-target-username-preview");
    const targetAvatarEl = Utils.$("report-target-avatar-preview");

    if (targetNameEl) targetNameEl.textContent = targetProfile.name || "Пользователь";
    if (targetUserEl) targetUserEl.textContent = `@${targetProfile.username || targetUid}`;
    if (targetAvatarEl) targetAvatarEl.innerHTML = ProfileManager.getAvatarHtml(targetProfile);

    // Reset categories and comment
    const modal = Utils.$("modal-report-profile");
    if (modal) {
      modal
        .querySelectorAll(".report-category-item")
        .forEach((el) => el.classList.remove("selected"));
      const commentWrap = Utils.$("report-step-comment-wrap");
      if (commentWrap) commentWrap.style.display = "none";
      const commentInput = Utils.$("report-profile-comment");
      if (commentInput) commentInput.value = "";
      this.validateForm();
      modal.classList.add("active");
    }
  }

  static closeModal() {
    const modal = Utils.$("modal-report-profile");
    if (modal) {
      modal.classList.remove("active");
    }
    this.currentTargetUid = null;
    this.selectedCategory = null;
  }

  static async submitReport() {
    if (!this.currentTargetUid) return;
    if (!this.selectedCategory) {
      Utils.toast("Выберите категорию нарушения", "warning");
      return;
    }

    const commentInput = Utils.$("report-profile-comment");
    const commentVal = commentInput ? commentInput.value.trim() : "";
    if (commentVal.length < 5) {
      Utils.toast("Пожалуйста, опишите конкретно проблему (не менее 5 символов)", "warning");
      if (commentInput) commentInput.focus();
      return;
    }

    const reporterUid = AppState.currentUser?.uid;
    if (!reporterUid) {
      Utils.toast("Необходимо авторизоваться", "error");
      return;
    }

    const targetUid = this.currentTargetUid;
    const submitBtn = Utils.$("btn-submit-profile-report");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Отправка...</span>`;
    }

    try {
      const reporterProfile = (AppState.usersCache ? AppState.usersCache.get(reporterUid) : null) || {};
      let targetProfile = AppState.usersCache ? AppState.usersCache.get(targetUid) : null;
      if (!targetProfile) {
        targetProfile = await ProfileManager.loadUser(targetUid);
      }
      targetProfile = targetProfile || {};

      const reporterName = reporterProfile.name || "Пользователь";
      const reporterUsername = reporterProfile.username || reporterUid;
      const targetName = targetProfile.name || "Пользователь";
      const targetUsername = targetProfile.username || targetUid;

      const ticketsRef = ref(db, "support_tickets");
      const newTicketRef = push(ticketsRef);
      const ticketId = newTicketRef.key;
      const ts = Date.now();

      const ticketPayload = {
        title: `Жалоба на профиль @${targetUsername}`,
        category: "Жалоба",
        priority: "Высокий",
        status: "open",
        creatorUid: reporterUid,
        reporterUid: reporterUid,
        targetUid: targetUid,
        reportCategory: this.selectedCategory,
        problemDescription: commentVal,
        createdAt: ts,
        lastActivity: ts,
        lastSender: reporterUid,
        isReport: true,
        reportType: "profile",
        reporterInfo: {
          uid: reporterUid,
          name: reporterName,
          username: reporterUsername,
          avatar: reporterProfile.avatar || ""
        },
        targetInfo: {
          uid: targetUid,
          name: targetName,
          username: targetUsername,
          avatar: targetProfile.avatar || ""
        }
      };

      await set(newTicketRef, ticketPayload);

      // Add the opening message to support_tickets/${ticketId}/messages
      const messagesRef = ref(db, `support_tickets/${ticketId}/messages`);
      await push(messagesRef, {
        text: `🚩 Жалоба на содержание профиля пользователя ${targetName} (@${targetUsername})\n\nКатегория: ${this.selectedCategory}\n\nОписание проблемы от заявителя:\n${commentVal}`,
        uid: reporterUid,
        name: reporterName,
        username: reporterUsername,
        avatar: reporterProfile.avatar || "",
        isAdmin: false,
        timestamp: ts,
        isReportNotice: true,
        reporterUid: reporterUid,
        targetUid: targetUid,
        reportCategory: this.selectedCategory
      });

      this.closeModal();
      Utils.toast("Жалоба на профиль успешно отправлена в поддержку!", "success");
    } catch (err) {
      console.error("Error creating report ticket:", err);
      Utils.toast("Ошибка при отправке жалобы. Попробуйте снова.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Отправить жалобу</span>`;
      }
    }
  }
}
window.ReportManager = ReportManager;

window.FriendsManager = FriendsManager;
window.DirectMessages = DirectMessages;
window.ReportManager = ReportManager;
export { FriendsManager, DirectMessages, ReportManager };
