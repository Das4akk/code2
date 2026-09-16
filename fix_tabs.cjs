const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const regex = /const rbChatPrev = Utils\.\$\("chat-tab-prev"\);[\s\S]*?window\._setRoomTab = setRoomTab;/m;

const newLogic = `const rcChat = Utils.$("chat-messages");
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

js = js.replace(regex, newLogic);
fs.writeFileSync('app.js', js);
