// ====== TELEGRAM DM OVERHAUL ======

console.log("[Telegram Patch] Loading...");

const TELEGRAM_CSS = `
.dm-modal-content {
    background: #09090b !important;
    color: #f4f4f5;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
}
.dm-sidebar {
    background: #09090b !important;
    border-right: 1px solid rgba(255,255,255,0.04) !important;
}
.dm-sidebar-header {
    background: #09090b !important;
    padding: 20px 24px !important;
    border-bottom: 1px solid rgba(255,255,255,0.03) !important;
}
.dm-chat-item {
    padding: 14px 18px !important;
    border-bottom: none !important;
    border-radius: 12px;
    margin: 6px 12px !important;
    background: transparent !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
}
.dm-chat-item:after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 18px;
    right: 18px;
    height: 1px;
    background: rgba(255,255,255,0.02);
}
.dm-chat-item:hover { 
    background: rgba(255,255,255,0.03) !important; 
    transform: translateX(2px);
}
.dm-chat-item.active { 
    background: rgba(255,255,255,0.08) !important; 
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
}

.dm-main {
    background: #000000 !important;
    position: relative;
    overflow: hidden;
}
.dm-modal-header {
    background: rgba(9, 9, 11, 0.8) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.03) !important;
    height: 70px;
    padding: 0 28px !important;
    display: flex;
    align-items: center;
    position: relative;
    z-index: 10;
}
.dm-messages {
    padding: 28px !important;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    position: relative;
    z-index: 2;
    scroll-behavior: smooth;
}
.dm-messages::-webkit-scrollbar,
.dm-sidebar::-webkit-scrollbar,
.dm-main::-webkit-scrollbar,
#dm-theme-carousel::-webkit-scrollbar,
.theme-folders::-webkit-scrollbar,
.theme-preview-track::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.dm-messages::-webkit-scrollbar-thumb,
.dm-sidebar::-webkit-scrollbar-thumb,
.dm-main::-webkit-scrollbar-thumb,
#dm-theme-carousel::-webkit-scrollbar-thumb,
.theme-folders::-webkit-scrollbar-thumb,
.theme-preview-track::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}
.dm-messages::-webkit-scrollbar-track,
.dm-sidebar::-webkit-scrollbar-track,
.dm-main::-webkit-scrollbar-track,
#dm-theme-carousel::-webkit-scrollbar-track,
.theme-folders::-webkit-scrollbar-track,
.theme-preview-track::-webkit-scrollbar-track {
    background: transparent;
}
.tg-bubble {
    max-width: 65%;
    padding: 10px 16px;
    border-radius: 20px;
    position: relative;
    word-break: break-word;
    font-size: 15px;
    line-height: 1.5;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05);
    letter-spacing: -0.1px;
}
.m-line {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 4px;
}
.m-line.self {
    align-items: flex-end;
}
.m-line .tg-bubble {
    background: #18181b;
    border-bottom-left-radius: 6px;
    color: #e4e4e7;
    border: 1px solid rgba(255,255,255,0.02);
}
.m-line.self .tg-bubble {
    background: #fafafa;
    border-bottom-right-radius: 6px;
    color: #09090b;
}
.tg-bubble .tg-time {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    float: right;
    margin-top: 6px;
    margin-left: 12px;
    font-variant-numeric: tabular-nums;
}
.m-line.self .tg-bubble .tg-time {
    color: rgba(0,0,0,0.4);
}
.tg-reactions {
    position: absolute;
    bottom: -12px;
    right: 5px;
    display: flex;
    background: linear-gradient(90deg, #222, #111);
    border-radius: 12px;
    padding: 2px 4px;
    gap: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    z-index: 2;
}
.tg-reaction {
    font-size: 12px;
    cursor: pointer;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 2px 6px;
}
.tg-reaction.me {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
}

/* Telegram Input Area */
.tg-input-area {
    background: #000000;
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    border-top: 1px solid rgba(255,255,255,0.04);
    z-index: 2;
}
.tg-reply-bar {
    display: flex;
    align-items: center;
    border-left: 3px solid #ffffff;
    padding-left: 12px;
    margin-bottom: 5px;
}
.tg-input-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
.tg-input-box {
    flex: 1;
    background: #181818;
    border-radius: 20px;
    display: flex;
    align-items: center;
    padding: 8px 16px;
    transition: background 0.2s;
}
.tg-input-box:focus-within {
    background: #202020;
}
.tg-input-box textarea {
    flex: 1;
    background: transparent;
    border: none;
    color: #ffffff;
    outline: none;
    font-family: inherit;
    resize: none;
    max-height: 150px;
    min-height: 20px;
    font-size: 15px;
    line-height: 1.4;
}
.tg-btn {
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    font-size: 20px;
    padding: 6px;
    outline: none !important;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}
.tg-btn:focus, .tg-btn:active {
    outline: none !important;
}
.tg-btn:hover { 
    color: #ffffff; 
    transform: scale(1.1) translateY(-1px);
    background: rgba(255,255,255,0.1);
}
.tg-btn:active {
    transform: scale(0.95);
}
.tg-btn-send {
    background: #ffffff;
    color: #000000;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
    animation: sendPulse 2.5s infinite ease-in-out;
}
@keyframes sendPulse {
    0% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.1); }
    50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255,255,255,0.2); }
    100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.1); }
}
.tg-btn-send:hover { 
    background: #eeeeee; 
    color: #000000; 
    transform: scale(1.1) rotate(-5deg);
    box-shadow: 0 6px 14px rgba(255,255,255,0.3);
}
.tg-btn-send:active {
    transform: scale(0.9);
}

/* Context Menu */
.tg-context-menu {
    position: absolute;
    background: linear-gradient(135deg, #222, #111);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 5px 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
    z-index: 1000;
    min-width: 150px;
}
.tg-ctx-item {
    padding: 8px 15px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
}
.tg-ctx-item:hover { background: rgba(255,255,255,0.05); }

/* Quick Emojis */
.tg-quick-emojis {
    display: flex;
    padding: 8px;
    gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.cowio-dm-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: inherit;
    font-size: clamp(40px, 8vw, 100px);
    font-weight: 900;
    letter-spacing: clamp(5px, 2vw, 20px);
    z-index: 0;
    pointer-events: none;
    display: flex;
    user-select: none;
}
.cowio-dm-bg span {
    animation: cowioLoad 2.5s infinite;
}
.cowio-dm-bg span:nth-child(1) { animation-delay: 0.0s; }
.cowio-dm-bg span:nth-child(2) { animation-delay: 0.2s; }
.cowio-dm-bg span:nth-child(3) { animation-delay: 0.4s; }
.cowio-dm-bg span:nth-child(4) { animation-delay: 0.6s; }
.cowio-dm-bg span:nth-child(5) { animation-delay: 0.8s; }

@keyframes dmFadeIn {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
.m-line {
    animation: dmFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes cowioLoad {
    0%, 100% { opacity: 0.05; transform: translateY(0); color: #888888; }
    50% { opacity: 0.15; transform: translateY(-8px); color: #ffffff; text-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
}

/* THEMES FOR DM OVERHAUL */
#modal-dm-chat[class*="theme-"]:not(.theme-default) .dm-sidebar,
#modal-dm-chat[class*="theme-"]:not(.theme-default) .dm-main,
#modal-dm-chat[class*="theme-"]:not(.theme-default) .dm-modal-header,
#modal-dm-chat[class*="theme-"]:not(.theme-default) .tg-input-area,
#modal-dm-chat[class*="theme-"]:not(.theme-default) .dm-sidebar-header,
#modal-dm-chat[class*="theme-"]:not(.theme-default) .dm-modal-content {
    background: transparent !important;
}

#modal-dm-chat.theme-love { background: rgba(20, 6, 14, 0.95) !important; }
#modal-dm-chat.theme-love .dm-modal-content { border-color: rgba(226, 120, 169, 0.22) !important; }
#modal-dm-chat.theme-love .m-line .tg-bubble { background: rgba(214, 92, 150, 0.12) !important; border-color: rgba(214, 120, 166, 0.28) !important; color: #fff !important; }
#modal-dm-chat.theme-love .m-line.self .tg-bubble { background: rgba(255, 120, 180, 0.2) !important; color: #fff !important; }

#modal-dm-chat.theme-light { background: #f0f2f5 !important; }
#modal-dm-chat.theme-light .dm-modal-content { background: rgba(255, 255, 255, 0.9) !important; border-color: #d8dbe2 !important; color: #0b0d12 !important; }
#modal-dm-chat.theme-light .m-line .tg-bubble { background: #ffffff !important; border-color: #d6dae2 !important; color: #0b0d12 !important; }
#modal-dm-chat.theme-light .m-line.self .tg-bubble { background: #111111 !important; border-color: #111111 !important; color: #fff !important; }
#modal-dm-chat.theme-light .dm-sidebar-header .text-lg, #modal-dm-chat.theme-light .dm-modal-header .text-lg { color: #0b0d12 !important; }
#modal-dm-chat.theme-light .tg-input-box { background: rgba(0,0,0,0.05) !important; }
#modal-dm-chat.theme-light .tg-input-box textarea { color: #000 !important; }
#modal-dm-chat.theme-light .tg-btn:not(.tg-btn-send) { color: #555 !important; }
#modal-dm-chat.theme-light .tg-btn:not(.tg-btn-send):hover { background: rgba(0,0,0,0.1) !important; color: #000 !important; }
#modal-dm-chat.theme-light .dm-chat-item { color: #000 !important; }
#modal-dm-chat.theme-light .dm-chat-item:hover { background: rgba(0,0,0,0.05) !important; }
#modal-dm-chat.theme-light .dm-chat-item.active { background: rgba(0,0,0,0.1) !important; }

#modal-dm-chat.theme-inverted { background: #e0e4eb !important; }
#modal-dm-chat.theme-inverted .dm-modal-content { background: rgba(248, 248, 248, 0.9) !important; border-color: #d9dce2 !important; color: #050505 !important; }
#modal-dm-chat.theme-inverted .m-line .tg-bubble { background: #ffffff !important; border-color: #d9dce2 !important; color: #050505 !important; }
#modal-dm-chat.theme-inverted .m-line.self .tg-bubble { background: #222222 !important; border-color: #222222 !important; color: #fff !important; }
#modal-dm-chat.theme-inverted .dm-sidebar-header .text-lg, #modal-dm-chat.theme-inverted .dm-modal-header .text-lg { color: #050505 !important; }
#modal-dm-chat.theme-inverted .tg-input-box { background: rgba(0,0,0,0.06) !important; }
#modal-dm-chat.theme-inverted .tg-input-box textarea { color: #000 !important; }
#modal-dm-chat.theme-inverted .tg-btn:not(.tg-btn-send) { color: #444 !important; }
#modal-dm-chat.theme-inverted .tg-btn:not(.tg-btn-send):hover { background: rgba(0,0,0,0.1) !important; color: #000 !important; }
#modal-dm-chat.theme-inverted .dm-chat-item { color: #000 !important; }
#modal-dm-chat.theme-inverted .dm-chat-item:hover { background: rgba(0,0,0,0.06) !important; }
#modal-dm-chat.theme-inverted .dm-chat-item.active { background: rgba(0,0,0,0.12) !important; }

#modal-dm-chat.theme-aurora { background: radial-gradient(circle at 20% 15%, rgba(43, 104, 255, 0.22), rgba(8, 18, 36, 0.95) 54%, rgba(4, 8, 18, 0.98) 100%) !important; }
#modal-dm-chat.theme-aurora .dm-modal-content { border-color: rgba(95, 145, 255, 0.34) !important; }
#modal-dm-chat.theme-aurora .m-line .tg-bubble { background: rgba(63, 110, 218, 0.22) !important; border-color: rgba(108, 154, 255, 0.36) !important; color: #e8f1ff !important; }
#modal-dm-chat.theme-aurora .m-line.self .tg-bubble { background: rgba(63, 110, 218, 0.35) !important; color: #e8f1ff !important;}

#modal-dm-chat.theme-sunset { background: radial-gradient(circle at 18% 18%, rgba(255, 120, 76, 0.26), rgba(38, 10, 18, 0.92) 50%, rgba(17, 5, 11, 0.98) 100%) !important; }
#modal-dm-chat.theme-sunset .dm-modal-content { border-color: rgba(255, 133, 94, 0.34) !important; }
#modal-dm-chat.theme-sunset .m-line .tg-bubble { background: rgba(255, 128, 92, 0.16) !important; border-color: rgba(255, 162, 130, 0.36) !important; color: #ffe8df !important; }
#modal-dm-chat.theme-sunset .m-line.self .tg-bubble { background: rgba(255, 128, 92, 0.3) !important; color: #ffe8df !important;}

#modal-dm-chat.theme-ocean { background: radial-gradient(circle at 72% 12%, rgba(65, 170, 198, 0.24), rgba(8, 24, 30, 0.95) 52%, rgba(4, 12, 16, 0.99) 100%) !important; }
#modal-dm-chat.theme-ocean .dm-modal-content { border-color: rgba(93, 199, 224, 0.34) !important; }
#modal-dm-chat.theme-ocean .m-line .tg-bubble { background: rgba(83, 199, 227, 0.14) !important; border-color: rgba(126, 228, 252, 0.34) !important; color: #e6fdff !important; }
#modal-dm-chat.theme-ocean .m-line.self .tg-bubble { background: rgba(83, 199, 227, 0.25) !important; color: #e6fdff !important; }

#modal-dm-chat.theme-default { background: rgba(0, 0, 0, 0.85) !important; }
#modal-dm-chat.theme-default .dm-modal-content { background: radial-gradient(circle at top, rgba(255, 255, 255, 0.09), #09090b) !important; }
#modal-dm-chat.theme-default .dm-sidebar, #modal-dm-chat.theme-default .dm-main, #modal-dm-chat.theme-default .dm-modal-header, #modal-dm-chat.theme-default .tg-input-area, #modal-dm-chat.theme-default .dm-sidebar-header { background: transparent !important; }
`;

document.head.insertAdjacentHTML("beforeend", `<style>${TELEGRAM_CSS}</style>`);

DirectMessages.EDITING_MSG_ID = null;
DirectMessages.REPLY_TO_MSG = null;
DirectMessages.EMOJIS = [
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Thumbs%20Up.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Open%20Mouth.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Crying%20Face.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp' style='width:24px;height:24px;vertical-align:middle;'>",
  "<img src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Pile%20Of%20Poo.webp' style='width:24px;height:24px;vertical-align:middle;'>",
];

setTimeout(() => {
  if (!document.querySelector(".cowio-dm-bg") && document.querySelector(".dm-main")) {
    document.querySelector(".dm-main").insertAdjacentHTML(
      "afterbegin",
      `
          <div class="cowio-dm-bg">
              <span>C</span><span>O</span><span>W</span><span>I</span><span>O</span>
          </div>
      `,
    );
  }
}, 1000);

const tgOldOpenChat = DirectMessages.openChat;
DirectMessages.openChat = function (targetUid, targetName) {
  tgOldOpenChat.call(this, targetUid, targetName);

  // Inject Telegram Input UI if not exists
  if (!document.getElementById("tg-bar-injected")) {
    const standardInputs = document.querySelectorAll(
      "#dm-messages ~ div:not(#dm-media-picker), #dm-messages ~ input, #dm-messages ~ button",
    );
    standardInputs.forEach((el) => {
      if (
        el.id !== "dm-media-picker" &&
        !el.classList.contains("tg-input-area")
      ) {
        el.style.display = "none";
      }
    });

    const myHtml = `
        <div class="tg-input-area" id="tg-bar-injected">
           <div id="tg-reply-bar" class="tg-reply-bar" style="display:none">
              <div style="flex:1">
                 <div style="color:#5288c1;font-size:13px;font-weight:bold" id="tg-reply-name">Reply to</div>
                 <div style="color:rgba(255,255,255,0.7);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px" id="tg-reply-text">...</div>
              </div>
              <button class="tg-btn" style="font-size:16px" onclick="DirectMessages.cancelReply()">✕</button>
           </div>
           
           <div class="tg-input-row">
              <button class="tg-btn" title="Прикрепить" id="tg-btn-clip"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/File%20Folder.webp" style="width:24px;height:24px;"></button>
              <div class="tg-input-box">
                 <textarea id="tg-textarea" rows="1" placeholder="Write a message..."></textarea>
                 <button class="tg-btn" title="Стикеры/Эмодзи" id="tg-btn-smile" style="display:flex;align-items:center;justify-content:center;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Smiling%20Face.webp" style="width:24px;height:24px;"></button>
              </div>
              <button class="tg-btn tg-btn-send" id="tg-btn-send-msg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
           </div>
        </div>
        `;

    document.querySelector(".dm-main").insertAdjacentHTML("beforeend", myHtml);

    document.getElementById("tg-btn-send-msg").onclick = () =>
      this.sendTGMessage();

    let dmTypingTimeout = null;
    document.getElementById("tg-textarea").oninput = () => {
      const chatId = DirectMessages.getChatId(
        AppState.currentUser.uid,
        AppState.currentDirectChat.uid,
      );
      const refT = window.firebaseDatabase.ref(
        window.firebaseDatabase.db,
        `direct-messages/${chatId}/typing/${AppState.currentUser.uid}`,
      );
      window.firebaseDatabase.set(refT, true);

      if (dmTypingTimeout) clearTimeout(dmTypingTimeout);
      dmTypingTimeout = setTimeout(() => {
        window.firebaseDatabase.set(refT, null);
      }, 3000);
    };

    document.getElementById("tg-textarea").onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendTGMessage();
      }
    };

    document.getElementById("tg-btn-clip").onclick = () => {
      const inputImg = document.createElement("input");
      inputImg.type = "file";
      inputImg.accept = "image/*";
      inputImg.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (window.Utils) Utils.toast("Обработка картинки...", "info");
        const reader = new FileReader();
        reader.onload = (re) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);

            const myProfile = AppState.usersCache.get(AppState.currentUser.uid);
            const myName =
              myProfile?.name || AppState.currentUser.displayName || "User";
            const payload = {
              type: "media",
              fromUid: AppState.currentUser.uid,
              fromName: myName,
              url: compressedBase64,
              ts: Date.now(),
            };

            const chatId = DirectMessages.getChatId(
              AppState.currentUser.uid,
              AppState.currentDirectChat.targetUid,
            );
            try {
              const { ref: dbRef, push, update } = window.firebaseDatabase;
              const db = window.firebaseDatabase.db;
              await push(
                dbRef(db, `direct-messages/${chatId}/messages`),
                payload,
              );
              await update(dbRef(db, `direct-messages/${chatId}`), {
                lastMessage: payload,
              });
              if (window.Utils) Utils.toast("Медиа отправлено!", "success");
            } catch (err) {
              console.error(err);
            }
          };
          img.src = re.target.result;
        };
        reader.readAsDataURL(file);
      };
      inputImg.click();
    };

    document.getElementById("tg-btn-smile").onclick = (e) => {
      e.stopPropagation();
      let picker = document.getElementById("tg-emoji-picker");
      if (!picker) {
        picker = document.createElement("div");
        picker.id = "tg-emoji-picker";
        picker.style.position = "absolute";
        picker.style.bottom = "70px";
        picker.style.right = "20px";
        picker.style.width = "300px";
        picker.style.height = "350px";
        picker.style.background = "#17212b";
        picker.style.borderRadius = "12px";
        picker.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
        picker.style.display = "flex";
        picker.style.flexWrap = "wrap";
        picker.style.gap = "5px";
        picker.style.padding = "10px";
        picker.style.overflowY = "auto";
        picker.style.zIndex = "1001";

        // Add search bar
        const shtml = `
                    <div style="width:100%; position:sticky; top:0; background:#17212b; padding-bottom:10px; z-index:2;">
                        <input type="text" id="tg-emoji-search" placeholder="Поиск эмодзи..." style="width:100%; background:#242f3d; color:#fff; border:none; padding:8px 12px; border-radius:20px; outline:none;" />
                    </div>
                    <div id="tg-emoji-grid" style="display:flex; flex-wrap:wrap; gap:5px; width:100%;"></div>
                `;
        picker.innerHTML = shtml;

        document.querySelector(".dm-main").appendChild(picker);

        const grid = document.getElementById("tg-emoji-grid");
        const emojis =
          window.ANIMATED_EMOJIS ||
          (typeof ANIMATED_EMOJIS !== "undefined" ? ANIMATED_EMOJIS : []);

        const renderEmojis = (filter = "") => {
          grid.innerHTML = "";
          emojis
            .filter((e) => e.toLowerCase().includes(filter.toLowerCase()))
            .forEach((url) => {
              const img = document.createElement("img");
              img.src = url;
              img.style.width = "32px";
              img.style.height = "32px";
              img.style.cursor = "pointer";
              img.style.transition = "transform 0.1s";
              img.onmouseover = () => (img.style.transform = "scale(1.2)");
              img.onmouseout = () => (img.style.transform = "scale(1)");
              img.onclick = () => {
                const ta = document.getElementById("tg-textarea");
                ta.value += `<img src="${url}" class="tg-inline-emoji" style="width:24px;height:24px;vertical-align:bottom;"> `;
                picker.style.display = "none";
                ta.focus();
              };
              grid.appendChild(img);
            });
        };

        renderEmojis();
        document.getElementById("tg-emoji-search").oninput = (ev) =>
          renderEmojis(ev.target.value);

        // Close on click outside
        document.addEventListener("click", (evt) => {
          if (picker.style.display === "flex" && !picker.contains(evt.target)) {
            picker.style.display = "none";
          }
        });
      } else {
        picker.style.display =
          picker.style.display === "none" ? "flex" : "none";
      }
    };
  }

  this.cancelReply();
};

DirectMessages.cancelReply = function () {
  this.EDITING_MSG_ID = null;
  this.REPLY_TO_MSG = null;
  const bar = document.getElementById("tg-reply-bar");
  if (bar) bar.style.display = "none";
  const ta = document.getElementById("tg-textarea");
  if (ta) ta.value = "";
};

DirectMessages.setReplyOrEdit = function (msg, mode) {
  if (mode === "edit") {
    this.EDITING_MSG_ID = msg.id;
    document.getElementById("tg-reply-name").innerText = "Редактирование";
    document.getElementById("tg-reply-text").innerText = msg.text || "Медиа";
    document.getElementById("tg-textarea").value = msg.text || "";
  } else {
    this.REPLY_TO_MSG = {
      id: msg.id,
      name: msg.fromName,
      text: msg.text || "Медиа",
    };
    document.getElementById("tg-reply-name").innerText =
      "В ответ: " + msg.fromName;
    document.getElementById("tg-reply-text").innerText = msg.text || "Медиа";
    document.getElementById("tg-textarea").value = "";
  }
  document.getElementById("tg-reply-bar").style.display = "flex";
  document.getElementById("tg-textarea").focus();
};

DirectMessages.sendTGMessage = async function () {
  if (!AppState.currentDirectChat) return;
  const { ref, push, update, db } = window.firebaseDatabase;
  const chatId = AppState.currentDirectChat.id;
  const targetUid = AppState.currentDirectChat.uid;
  const ta = document.getElementById("tg-textarea");
  const text = ta.value.trim();
  if (!text) return;

  if (this.EDITING_MSG_ID) {
    await update(
      ref(db, `direct-messages/${chatId}/messages/${this.EDITING_MSG_ID}`),
      {
        text: text,
        isEdited: true,
      },
    );
    this.cancelReply();
    return;
  }

  const myName =
    AppState.usersCache.get(AppState.currentUser.uid)?.name ||
    AppState.currentUser.displayName ||
    "User";

  const payload = {
    type: "text",
    fromUid: AppState.currentUser.uid,
    fromName: myName,
    text: text,
    ts: Date.now(),
  };

  if (this.REPLY_TO_MSG) {
    payload.replyToId = this.REPLY_TO_MSG.id;
    payload.replyToName = this.REPLY_TO_MSG.name;
    payload.replyToText = this.REPLY_TO_MSG.text;
  }

  ta.value = "";
  this.cancelReply();

  await update(ref(db, `direct-messages/${chatId}`), {
    participants: { [AppState.currentUser.uid]: true, [targetUid]: true },
    updatedAt: payload.ts,
    lastMessage: payload,
  });
  await push(ref(db, `direct-messages/${chatId}/messages`), payload);
};

DirectMessages.toggleReaction = async function (msgId, emoji) {
  if (!AppState.currentDirectChat) return;
  const { ref, get, set, remove, db } = window.firebaseDatabase;
  const chatId = AppState.currentDirectChat.id;
  const myUid = AppState.currentUser.uid;
  const rRef = ref(
    db,
    `direct-messages/${chatId}/messages/${msgId}/reactions/${myUid}`,
  );

  const snap = await get(rRef);
  if (snap.exists() && snap.val() === emoji) {
    await remove(rRef);
  } else {
    await set(rRef, emoji);
  }

  const ctx = document.getElementById("tg-context-menu");
  if (ctx) ctx.remove();
};

DirectMessages.deleteMsg = async function (msgId) {
  if (!AppState.currentDirectChat) return;
  const { ref, remove, db } = window.firebaseDatabase;
  const chatId = AppState.currentDirectChat.id;
  await remove(ref(db, `direct-messages/${chatId}/messages/${msgId}`));
  const ctx = document.getElementById("tg-context-menu");
  if (ctx) ctx.remove();
};

DirectMessages.showContextMenu = function (e, msg) {
  e.preventDefault();
  const oldCtx = document.getElementById("tg-context-menu");
  if (oldCtx) oldCtx.remove();

  const isSelf = msg.fromUid === AppState.currentUser.uid;
  const isEditingAllowed = isSelf && msg.type === "text";

  const emojiReply =
    '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Backhand%20Index%20Pointing%20Left.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">';
  const emojiEdit =
    '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Pencil.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">';
  const emojiTrash =
    '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Cross%20Mark.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">';
  const emojiPin =
    '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">';

  let html = `
    <div id="tg-context-menu" class="tg-context-menu" style="left: ${e.pageX}px; top: ${e.pageY - 50}px;">
       <div class="tg-quick-emojis">
          ${this.EMOJIS.map((em, idx) => `<div class="tg-reaction" onclick="DirectMessages.toggleReaction('${msg.id}', DirectMessages.EMOJIS[${idx}])">${em}</div>`).join("")}
       </div>
       <div class="tg-ctx-item" onclick="DirectMessages.setReplyOrEdit(${JSON.stringify(msg).replace(/"/g, "&quot;")}, 'reply')">${emojiReply} Ответить</div>
       <div class="tg-ctx-item" onclick="DirectMessages.pinMsg('${msg.id}')">${emojiPin} Закрепить</div>
       ${isEditingAllowed ? `<div class="tg-ctx-item" onclick="DirectMessages.setReplyOrEdit(${JSON.stringify(msg).replace(/"/g, "&quot;")}, 'edit')">${emojiEdit} Изменить</div>` : ""}
       ${isSelf ? `<div class="tg-ctx-item" style="color:#ff5555" onclick="DirectMessages.deleteMsg('${msg.id}')">${emojiTrash} Удалить</div>` : ""}
    </div>
    `;

  document.body.insertAdjacentHTML("beforeend", html);

  const closeListener = (evt) => {
    if (!evt.target.closest("#tg-context-menu")) {
      const m = document.getElementById("tg-context-menu");
      if (m) m.remove();
      document.removeEventListener("click", closeListener);
    }
  };
  setTimeout(() => document.addEventListener("click", closeListener), 10);
};

DirectMessages.renderMessages = function (messages) {
  const list = Utils.$("dm-messages");
  if (!messages.length) {
    list.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px;" class="no-msgs-placeholder">Нет сообщений</div>`;
    return;
  }

  window._curMessagesMap = {};
  window._lastDateStr = null;

  const newHtml = messages
    .map((m) => {
      window._curMessagesMap[m.id] = m;

      const isSelf = m.fromUid === AppState.currentUser.uid;
      let dateHeaderHtml = "";

      if (m.type !== "system") {
        const dateObj = new Date(m.ts);
        const dateStr = dateObj.toLocaleDateString();
        if (dateStr !== window._lastDateStr) {
          dateHeaderHtml = `\n<div style="text-align:center; margin: 15px 0;" class="date-header" data-date="${dateStr}"><span style="background:rgba(255,255,255,0.1); padding:4px 12px; border-radius:12px; font-size:12px; color:var(--text-muted);">${dateStr}</span></div>\n`;
          window._lastDateStr = dateStr;
        }
      }

      if (m.type === "system") {
        return (
          dateHeaderHtml +
          `<div class="sys-msg" id="msg-${m.id || m.ts}">${Utils.escapeHtml(m.fromName || "Пользователь")} ${Utils.escapeHtml(m.text || "")}</div>`
        );
      }

      let replyHtml = "";
      if (m.replyToId) {
        replyHtml = `
               <div style="border-left: 2px solid #5288c1; padding-left: 8px; margin-bottom: 5px; cursor: pointer; opacity: 0.8;" onclick="Utils.$('msg-${m.replyToId}')?.scrollIntoView({behavior:'smooth'})">
                  <div style="color: #5288c1; font-weight: bold; font-size: 12px;">${Utils.escapeHtml(m.replyToName || "Пользователь")}</div>
                  <div style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${Utils.escapeHtml(m.replyToText || "Медиа")}</div>
               </div>
            `;
      }

      let reactionsHtml = "";
      if (m.reactions) {
        let grouped = {};
        Object.entries(m.reactions).forEach(([uid, em]) => {
          if (!grouped[em]) grouped[em] = { count: 0, me: false };
          grouped[em].count++;
          if (uid === AppState.currentUser.uid) grouped[em].me = true;
        });
        let items = Object.entries(grouped).map(
          ([em, data]) =>
            `<div class="tg-reaction ${data.me ? "me" : ""}" onclick="DirectMessages.toggleReaction('${m.id}', '${em}')">${em} ${data.count}</div>`,
        );
        if (items.length) {
          reactionsHtml = `<div class="tg-reactions">${items.join("")}</div>`;
        }
      }

      const timestamp = new Date(m.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const editedStr = m.isEdited ? "изменено" : "";

      if (
        m.type === "file" ||
        m.type === "gif" ||
        m.type === "media" ||
        m.url
      ) {
        const isImg =
          m.type === "gif" ||
          String(m.url).match(/\.(gif|jpe?g|png|webp|bmp)$/i) ||
          String(m.url).match(/tenor\.com|giphy\.com|imgur\.com/i) ||
          String(m.url).startsWith("data:image/");

        return (
          dateHeaderHtml +
          `
            <div class="m-line ${isSelf ? "self" : ""}" id="msg-${m.id}">
                <div class="tg-bubble" oncontextmenu="DirectMessages.showContextMenu(event, window._curMessagesMap['${m.id}'])">
                    ${replyHtml}
                    ${isImg ? `<img src="${Utils.escapeHtml(m.url)}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x150?text=Error';" />` : `<a href="${Utils.escapeHtml(m.url)}" target="_blank" style="color: #5288c1; padding: 8px; display: inline-block;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Paperclip.webp" style="width:18px;height:18px;vertical-align:bottom;margin-right:5px;">Прикрепленный файл</a>`}
                    <div class="tg-time">${editedStr} ${timestamp}</div>
                    ${reactionsHtml}
                </div>
            </div>
          `
        );
      }

      return (
        dateHeaderHtml +
        `
            <div class="m-line ${isSelf ? "self" : ""}" id="msg-${m.id}">
                <div class="tg-bubble" oncontextmenu="DirectMessages.showContextMenu(event, window._curMessagesMap['${m.id}'])">
                    ${replyHtml}
                    <div>${Utils.escapeHtml(m.text)}</div>
                    <div class="tg-time">${editedStr} ${timestamp}</div>
                    ${reactionsHtml}
                </div>
            </div>
        `
      );
    })
    .join("");

  const isAtBottom =
    list.scrollHeight - list.scrollTop - list.clientHeight <= 150;
  const oldScroll = list.scrollTop;

  // Find what has changed instead of recreating everything
  // We can just inject new items.
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = newHtml;

  if (list.innerHTML.trim() === "") {
    list.innerHTML = newHtml;
  } else {
    const newItems = Array.from(tempDiv.children);
    
    // Linear synchronization
    newItems.forEach((newChild, index) => {
        const existingChild = list.children[index];
        if (!existingChild) {
            list.appendChild(newChild);
        } else if (existingChild.id === newChild.id && newChild.id) {
            if (existingChild.className !== newChild.className) existingChild.className = newChild.className;
            if (existingChild.innerHTML !== newChild.innerHTML) {
                existingChild.innerHTML = newChild.innerHTML;
            }
        } else if (!existingChild.id && !newChild.id && existingChild.getAttribute('data-date') === newChild.getAttribute('data-date')) {
            // Same date header, do nothing
        } else {
            // Mismatch, replace it
            existingChild.replaceWith(newChild);
        }
    });

    // Remove any extra items
    while (list.children.length > newItems.length) {
        list.lastChild.remove();
    }
  }

  let forceScroll = false;
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.fromUid === AppState.currentUser.uid && Date.now() - lastMsg.ts < 5000) {
      forceScroll = true;
    }
  }

  setTimeout(() => {
     if (isAtBottom || forceScroll) {
       list.scrollTop = list.scrollHeight;
     }
  }, 10);

  if (this.theme === "love") this.startLoveHearts();
};
