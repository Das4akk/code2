const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/const rbChat = Utils\.\$\("tab-chat-btn"\);[\s\S]*?if \(rbUsers\) rbUsers\.onclick = \(\) => setRoomTab\("users"\);/, 
`
    const rbChatPrev = Utils.$("chat-tab-prev");
    const rbChatNext = Utils.$("chat-tab-next");
    const tabTitle = Utils.$("current-right-tab-title");
    const rcChat = Utils.$("chat-messages");
    const rcUsers = Utils.$("users-list");
    let currentTab = "chat";

    const setRoomTab = (name) => {
      currentTab = name;
      if (tabTitle) tabTitle.innerText = name === "chat" ? "Чат" : "Участники";
      if (rcChat) rcChat.style.display = name === "chat" ? "flex" : "none";
      if (rcUsers) rcUsers.style.display = name === "users" ? "flex" : "none";
    };

    const toggleTab = () => {
      setRoomTab(currentTab === "chat" ? "users" : "chat");
    };

    if (rbChatPrev) rbChatPrev.onclick = toggleTab;
    if (rbChatNext) rbChatNext.onclick = toggleTab;
    
    // Fallback for older calls
    window._setRoomTab = setRoomTab;
`);

js = js.replace(/Utils\.\$\("tab-users-btn"\)\.click\(\)/g, 'if (window._setRoomTab) window._setRoomTab("users")');
js = js.replace(/Utils\.\$\("tab-chat-btn"\)\.click\(\)/g, 'if (window._setRoomTab) window._setRoomTab("chat")');
js = js.replace(/Utils\.\$\("tab-users-btn"\)\?\.click\(\)/g, 'if (window._setRoomTab) window._setRoomTab("users")');
js = js.replace(/Utils\.\$\("tab-chat-btn"\)\?\.click\(\)/g, 'if (window._setRoomTab) window._setRoomTab("chat")');

// Replace the old btn-chat-toggle handler to match the new one (if needed), or map it to `btn-chat-close-x`.
// Let's find btn-chat-toggle in app.js
fs.writeFileSync('app.js', js);
