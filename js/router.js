/**
 * COWIO Hard Router - Authoritative URL-to-View Navigation Engine
 * Guarantees that every route change (pushState, replaceState, popstate, or direct link)
 * strictly and immediately updates the visible screen, section, and navigation state
 * with ZERO flicker or delay.
 */

class Router {
  static routes = {
    "/lobby": "nav-rooms",
    "/profile": "nav-profile",
    "/catalog": "nav-catalog",
    "/library": "nav-library",
    "/friends": "nav-friends",
    "/findfriends": "nav-find-friend",
    "/leaderboard": "nav-leaderboard",
    "/settings": "nav-settings",
    "/other": "nav-other",
    "/premium": "nav-premium",
    "/mystery": "nav-mystery",
    "/help": "nav-support"
  };

  static isHandlingRoute = false;
  static currentPath = "";

  static init() {
    // Intercept pushState and replaceState to turn browser navigation into instant reactive routing
    const originalPushState = window.history.pushState;
    window.history.pushState = function (state, title, url) {
      originalPushState.apply(this, arguments);
      if (state && state._silent) return;
      const pathname = typeof url === "string" ? (url.startsWith("http") ? new URL(url).pathname : url) : window.location.pathname;
      Router.handleRoute(pathname);
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (state, title, url) {
      originalReplaceState.apply(this, arguments);
      if (state && state._silent) return;
      const pathname = typeof url === "string" ? (url.startsWith("http") ? new URL(url).pathname : url) : window.location.pathname;
      Router.handleRoute(pathname);
    };

    window.addEventListener("popstate", () => {
      Router.handleRoute(window.location.pathname);
    });

    // Handle initial route immediately on DOMContentLoaded or right away
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        Router.handleRoute(window.location.pathname, true);
      });
    } else {
      Router.handleRoute(window.location.pathname, true);
    }
  }

  static navigate(path, replace = false) {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
  }

  static async handleRoute(rawPathname, isInitial = false) {
    const pathname = (rawPathname || window.location.pathname).split("?")[0].split("#")[0] || "/lobby";
    if (!isInitial && this.currentPath === pathname) {
      return;
    }
    this.currentPath = pathname;

    // Remove anti-flicker class from html root
    document.documentElement.classList.remove("route-non-lobby");

    // 1. If currently in a room and moving to a lobby or external route
    if (!pathname.startsWith("/room/") && window.AppState && window.AppState.currentRoomId) {
      if (window.RoomManager && typeof window.RoomManager.leaveRoom === "function") {
        window.RoomManager.leaveRoom();
      }
    }

    // 2. Close profile overlay backdrop if open in room
    const pBackdrop = document.getElementById("profile-overlay-backdrop");
    if (pBackdrop) pBackdrop.style.display = "none";
    const pClose = document.getElementById("profile-overlay-close");
    if (pClose) pClose.style.display = "none";

    // 3. Route matching
    if (pathname === "/" || pathname === "/lobby") {
      this.showLobbySection("nav-rooms", "section-rooms");
      return;
    }

    if (pathname === "/login" || pathname === "/register") {
      if (window.AppState && window.AppState.currentUser) {
        this.navigate("/lobby", true);
        return;
      }
      if (window.Utils && window.Utils.showScreen) {
        window.Utils.showScreen("auth-screen", false);
      }
      return;
    }

    if (pathname.startsWith("/room/")) {
      const roomId = pathname.slice(6);
      if (roomId && roomId !== "current") {
        if (window.RoomManager && typeof window.RoomManager.joinRoom === "function") {
          window.RoomManager.joinRoom(roomId);
        } else if (window.Utils) {
          window.Utils.showScreen("room-screen", false);
        }
      } else {
        this.navigate("/lobby", true);
      }
      return;
    }

    if (pathname === "/profile") {
      this.showLobbySection("nav-profile", "section-profile");
      this.loadMyProfile();
      return;
    }

    if (pathname.startsWith("/@")) {
      const targetUsername = pathname.slice(2).trim();
      this.showLobbySection("nav-profile", "section-profile");
      this.loadUsernameProfile(targetUsername);
      return;
    }

    const navId = this.routes[pathname];
    if (navId) {
      const sectionId = this.getSectionIdForNav(navId);
      this.showLobbySection(navId, sectionId);
      this.triggerSectionInit(navId);
      return;
    }

    // Fallback: unknown path redirects strictly to /lobby
    this.navigate("/lobby", true);
  }

  static getSectionIdForNav(navId) {
    const map = {
      "nav-rooms": "section-rooms",
      "nav-friends": "section-friends",
      "nav-find-friend": "section-find-friend",
      "nav-library": "section-library",
      "nav-leaderboard": "section-leaderboard",
      "nav-catalog": "section-catalog",
      "nav-shop": "section-shop",
      "nav-settings": "section-settings",
      "nav-other": "section-other",
      "nav-premium": "section-premium",
      "nav-mystery": "section-mystery",
      "nav-support": "section-support",
      "nav-support-staff": "section-support",
      "nav-profile": "section-profile"
    };
    return map[navId] || "section-rooms";
  }

  static showLobbySection(navId, sectionId) {
    // 1. Ensure lobby-screen is the active screen
    const screens = document.querySelectorAll(".screen");
    screens.forEach((s) => {
      if (s.id === "lobby-screen") {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });

    const footerLinks = document.getElementById("bottom-footer-links");
    if (footerLinks) footerLinks.style.display = "flex";

    // 2. Synchronously switch sections with ZERO flash
    const allSections = document.querySelectorAll(".rooms-main");
    allSections.forEach((el) => {
      if (el.id === sectionId) {
        el.style.display = sectionId === "section-leaderboard" ? "block" : "flex";
      } else {
        el.style.display = "none";
      }
    });

    // 3. Update active state on sidebar navigation
    const allNavs = document.querySelectorAll(".nav-item");
    allNavs.forEach((el) => {
      if (el.id === navId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    // 4. Scroll lobby content to top and toggle full-width support container class
    const lobbyContent = document.querySelector(".lobby-content");
    if (lobbyContent) {
      lobbyContent.scrollTop = 0;
      if (sectionId === "section-support") {
        lobbyContent.classList.add("support-active-view");
      } else {
        lobbyContent.classList.remove("support-active-view");
      }
    }
  }

  static triggerSectionInit(navId) {
    if (navId === "nav-catalog" && window.CatalogManager) {
      window.CatalogManager.renderCatalog();
    } else if (navId === "nav-library" && window.LibraryManager) {
      window.LibraryManager.renderGrid();
    } else if (navId === "nav-leaderboard" && window.loadLeaderboard) {
      window.loadLeaderboard();
    } else if (navId === "nav-premium" && window.PremiumManager) {
      window.PremiumManager.renderPremiumSection();
    } else if (navId === "nav-mystery" && window.MysteryEventManager) {
      window.MysteryEventManager.render();
    } else if ((navId === "nav-support" || navId === "nav-support-staff") && window.SupportSystem) {
      window.SupportSystem.renderTickets();
    }
  }

  static async loadMyProfile() {
    const uid = window.AppState?.currentUser?.uid;
    if (uid && window.ProfileManager) {
      if (window.ProfileManager._currentlyOpenUid === uid) return;
      window.ProfileManager.openViewProfileModal(uid);
    } else {
      // Wait briefly for auth if initializing
      const checkAuth = setInterval(() => {
        const u = window.AppState?.currentUser?.uid;
        if (u) {
          clearInterval(checkAuth);
          if (window.Router.currentPath === "/profile" && window.ProfileManager) {
            if (window.ProfileManager._currentlyOpenUid !== u) {
              window.ProfileManager.openViewProfileModal(u);
            }
          }
        }
      }, 100);
      setTimeout(() => clearInterval(checkAuth), 3000);
    }
  }

  static async loadUsernameProfile(username) {
    if (!username) return;
    const cleanUsername = username.toLowerCase().trim();
    if (window.ProfileManager && window.ProfileManager._currentlyOpenUsername === cleanUsername) {
      return;
    }

    // Show skeleton immediately in #section-profile
    const sProfile = document.getElementById("section-profile");
    if (sProfile) {
      sProfile.style.display = "flex";
    }
    const nameEl = document.getElementById("view-name");
    if (nameEl) {
      nameEl.innerHTML = `<div style="width: 160px; height: 22px; background: rgba(255,255,255,0.12); border-radius: 6px; animation: pulse 1.2s infinite;"></div>`;
    }
    const unameEl = document.getElementById("view-username");
    if (unameEl) {
      unameEl.innerHTML = `@${username}`;
    }
    const avatarEl = document.getElementById("view-avatar");
    if (avatarEl) {
      avatarEl.innerHTML = `<div style="width: 100%; height: 100%; background: rgba(255,255,255,0.08); border-radius: 50%; animation: pulse 1.2s infinite;"></div>`;
    }

    try {
      let database = window.db;
      if (!database) {
        const fb = await import("./firebase.js");
        database = fb.db || window.db;
      }
      const { get, ref } = await import("./firebase.js");
      const snap = await get(ref(database, `usernames/${username.toLowerCase()}`));
      if (snap.exists()) {
        const targetUid = snap.val();
        if (window.ProfileManager) {
          await window.ProfileManager.openViewProfileModal(targetUid);
        }
      } else {
        if (window.Utils && window.Utils.toast) {
          window.Utils.toast(`Пользователь @${username} не найден`, "error");
        }
        this.navigate("/lobby", true);
      }
    } catch (e) {
      console.error("[Router] Error loading username profile:", e);
      if (window.Utils && window.Utils.toast) {
        window.Utils.toast("Ошибка при загрузке профиля", "error");
      }
    }
  }
}

window.Router = Router;
export default Router;
