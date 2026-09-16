const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

// 1. Fullscreen logic
js = js.replace(
  /Utils\.\$\("btn-fullscreen-toggle"\)\.onclick = \(\) => \{[\s\S]*?\};/m,
  `Utils.$("btn-fullscreen-toggle").onclick = () => {
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

      document.addEventListener("fullscreenchange", () => {
        if (exitFsBtn) {
           exitFsBtn.style.display = document.fullscreenElement ? "flex" : "none";
        }
        const vidContainer = Utils.$("native-player")?.parentElement;
        if (vidContainer) {
            vidContainer.style.borderRadius = document.fullscreenElement ? "0" : "20px";
        }
      });`
);

// 2. Chat/Users tabs logic
const oldTabsLogic = `    const rbChatPrev = Utils.$("chat-tab-prev");
    const rbChatNext = Utils.$("chat-tab-next");
    const tabTitle = Utils.$("current-right-tab-title");
    const rcChat = Utils.$("chat-messages");
    const rcUsers = Utils.$("users-list");
    let currentTab = "chat";
    const setRoomTab = (name) => {
      currentTab = name;
      if (tabTitle) tabTitle.innerText = name === "chat" ? "Чат" : "Участники";
      const countEl = Utils.$("users-count");
      if (countEl) countEl.style.display = name === "users" ? "inline-block" : "none";
      if (rcChat) rcChat.style.display = name === "chat" ? "flex" : "none";
      if (rcUsers) rcUsers.style.display = name === "users" ? "flex" : "none";
      const inputArea = document.querySelector(".chat-input-area");
      if (inputArea) inputArea.style.display = name === "chat" ? "flex" : "none";
    };
    const toggleTab = () => {
      setRoomTab(currentTab === "chat" ? "users" : "chat");
    };
    if (rbChatPrev) rbChatPrev.onclick = toggleTab;
    if (rbChatNext) rbChatNext.onclick = toggleTab;
    
    // Fallback for older calls
    window._setRoomTab = setRoomTab;`;

const newTabsLogic = `    const rcChat = Utils.$("chat-messages");
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

    window._setRoomTab = setRoomTab;`;

js = js.replace(oldTabsLogic, newTabsLogic);
fs.writeFileSync('app.js', js);
