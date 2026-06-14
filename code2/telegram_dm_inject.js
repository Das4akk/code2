// ====== TELEGRAM DM OVERHAUL ======

console.log("[Telegram Patch] Loading...");

const TELEGRAM_CSS = `
.dm-modal-content {
    background: #0e1621 !important; /* Base Telegram Dark Blue */
    color: #f5f5f5;
}
.dm-sidebar {
    background: #17212b !important;
    border-right: 1px solid #101921 !important;
}
.dm-sidebar-header {
    background: #17212b !important;
    padding: 10px 15px !important;
    border-bottom: 1px solid #101921 !important;
}
.dm-chat-item {
    padding: 10px 15px !important;
    border-bottom: none !important;
    border-radius: 6px;
    margin: 2px 5px !important;
}
.dm-chat-item:hover { background: #202b36 !important; }
.dm-chat-item.active { background: #2b5278 !important; }

.dm-main {
    background: #0e1621 !important;
    background-image: url('https://telegram.org/file/464001154/11186/3mJ7k0dO574.34114.gif') !important; /* TG Pattern */
    background-size: 400px;
}
.dm-modal-header {
    background: #17212b !important;
    border-bottom: 1px solid #101921 !important;
    height: 60px;
    padding: 10px 20px !important;
}
.dm-messages {
    padding: 20px !important;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.tg-bubble {
    max-width: 65%;
    padding: 8px 12px;
    border-radius: 12px;
    position: relative;
    word-break: break-word;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.m-line {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 2px;
}
.m-line.self {
    align-items: flex-end;
}
.m-line .tg-bubble {
    background: #182533;
    border-bottom-left-radius: 4px;
}
.m-line.self .tg-bubble {
    background: #2b5278;
    border-bottom-right-radius: 4px;
}
.tg-bubble .tg-time {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    float: right;
    margin-top: 5px;
    margin-left: 10px;
}
.tg-reactions {
    position: absolute;
    bottom: -12px;
    right: 5px;
    display: flex;
    background: #17212b;
    border-radius: 12px;
    padding: 2px 4px;
    gap: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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
    background: rgba(43,82,120,0.7);
    border: 1px solid #3e74a8;
}

/* Telegram Input Area */
.tg-input-area {
    background: #17212b;
    padding: 10px 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    position: relative;
    border-top: 1px solid #101921;
}
.tg-reply-bar {
    display: flex;
    align-items: center;
    border-left: 2px solid #5288c1;
    padding-left: 10px;
    margin-bottom: 5px;
}
.tg-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.tg-input-box {
    flex: 1;
    background: #242f3d;
    border-radius: 20px;
    display: flex;
    align-items: center;
    padding: 8px 15px;
}
.tg-input-box textarea {
    flex: 1;
    background: transparent;
    border: none;
    color: #fff;
    outline: none;
    font-family: inherit;
    resize: none;
    max-height: 150px;
    min-height: 20px;
}
.tg-btn {
    background: transparent;
    border: none;
    color: #6b7d8d;
    cursor: pointer;
    font-size: 20px;
    padding: 5px;
    transition: color 0.2s;
}
.tg-btn:hover { color: #5288c1; }
.tg-btn-send {
    background: #5288c1;
    color: #fff;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.tg-btn-send:hover { background: #4679ae; color: #fff; }

/* Context Menu */
.tg-context-menu {
    position: absolute;
    background: #17212b;
    border-radius: 8px;
    padding: 5px 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
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
.tg-ctx-item:hover { background: #202b36; }

/* Quick Emojis */
.tg-quick-emojis {
    display: flex;
    padding: 8px;
    gap: 8px;
    border-bottom: 1px solid #101921;
}
`;

document.head.insertAdjacentHTML("beforeend", `<style>${TELEGRAM_CSS}</style>`);

DirectMessages.EDITING_MSG_ID = null;
DirectMessages.REPLY_TO_MSG = null;
DirectMessages.EMOJIS = ["👍","❤","🔥","😂","😮","😢","👏","💩"];

const tgOldOpenChat = DirectMessages.openChat;
DirectMessages.openChat = function(targetUid, targetName) {
    tgOldOpenChat.call(this, targetUid, targetName);
    
    // Inject Telegram Input UI if not exists
    if (!document.getElementById("tg-bar-injected")) {
        const standardInputs = document.querySelectorAll("#dm-messages ~ div:not(#dm-media-picker), #dm-messages ~ input, #dm-messages ~ button");
        standardInputs.forEach(el => {
            if(el.id !== "dm-media-picker" && !el.classList.contains("tg-input-area")) {
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
              <button class="tg-btn" title="Прикрепить" id="tg-btn-clip">📎</button>
              <div class="tg-input-box">
                 <textarea id="tg-textarea" rows="1" placeholder="Write a message..."></textarea>
                 <button class="tg-btn" title="Стикеры/Эмодзи" id="tg-btn-smile" style="font-size:18px">😊</button>
              </div>
              <button class="tg-btn tg-btn-send" id="tg-btn-send-msg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
           </div>
        </div>
        `;
        
        document.querySelector(".dm-main").insertAdjacentHTML("beforeend", myHtml);
        
        document.getElementById("tg-btn-send-msg").onclick = () => this.sendTGMessage();
        document.getElementById("tg-textarea").onkeydown = (e) => {
           if(e.key === "Enter" && !e.shiftKey) {
               e.preventDefault();
               this.sendTGMessage();
           }
        };
        
        document.getElementById("tg-btn-clip").onclick = () => {
            const picker = document.getElementById("dm-media-picker");
            if(picker) picker.style.display = picker.style.display === "none" ? "flex" : "none";
        };
        
        document.getElementById("tg-btn-smile").onclick = () => {
            const picker = document.getElementById("dm-media-picker");
            if(picker) {
                picker.style.display = "flex";
                document.getElementById("dm-media-input").focus();
            }
        };
    }
    
    this.cancelReply();
};

DirectMessages.cancelReply = function() {
    this.EDITING_MSG_ID = null;
    this.REPLY_TO_MSG = null;
    const bar = document.getElementById("tg-reply-bar");
    if(bar) bar.style.display = "none";
    const ta = document.getElementById("tg-textarea");
    if(ta) ta.value = "";
}

DirectMessages.setReplyOrEdit = function(msg, mode) {
    if (mode === "edit") {
        this.EDITING_MSG_ID = msg.id;
        document.getElementById("tg-reply-name").innerText = "Редактирование";
        document.getElementById("tg-reply-text").innerText = msg.text || "Медиа";
        document.getElementById("tg-textarea").value = msg.text || "";
    } else {
        this.REPLY_TO_MSG = { id: msg.id, name: msg.fromName, text: msg.text || "Медиа" };
        document.getElementById("tg-reply-name").innerText = "В ответ: " + msg.fromName;
        document.getElementById("tg-reply-text").innerText = msg.text || "Медиа";
        document.getElementById("tg-textarea").value = "";
    }
    document.getElementById("tg-reply-bar").style.display = "flex";
    document.getElementById("tg-textarea").focus();
}

DirectMessages.sendTGMessage = async function() {
    if (!AppState.currentDirectChat) return;
    const chatId = AppState.currentDirectChat.id;
    const targetUid = AppState.currentDirectChat.uid;
    const ta = document.getElementById("tg-textarea");
    const text = ta.value.trim();
    if (!text) return;
    
    if (this.EDITING_MSG_ID) {
        await update(ref(db, `direct-messages/${chatId}/messages/${this.EDITING_MSG_ID}`), {
            text: text,
            isEdited: true
        });
        this.cancelReply();
        return;
    }
    
    const myName = AppState.usersCache.get(AppState.currentUser.uid)?.name || AppState.currentUser.displayName || "User";
    
    const payload = {
        type: "text",
        fromUid: AppState.currentUser.uid,
        fromName: myName,
        text: text,
        ts: Date.now()
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
        lastMessage: payload
    });
    await push(ref(db, `direct-messages/${chatId}/messages`), payload);
}

DirectMessages.toggleReaction = async function(msgId, emoji) {
    if (!AppState.currentDirectChat) return;
    const chatId = AppState.currentDirectChat.id;
    const myUid = AppState.currentUser.uid;
    const rRef = ref(db, `direct-messages/${chatId}/messages/${msgId}/reactions/${myUid}`);
    
    const snap = await get(rRef);
    if (snap.exists() && snap.val() === emoji) {
        await remove(rRef);
    } else {
        await set(rRef, emoji);
    }
    
    const ctx = document.getElementById("tg-context-menu");
    if(ctx) ctx.remove();
}

DirectMessages.deleteMsg = async function(msgId) {
    if (!AppState.currentDirectChat) return;
    const chatId = AppState.currentDirectChat.id;
    await remove(ref(db, `direct-messages/${chatId}/messages/${msgId}`));
    const ctx = document.getElementById("tg-context-menu");
    if(ctx) ctx.remove();
}

DirectMessages.showContextMenu = function(e, msg) {
    e.preventDefault();
    const oldCtx = document.getElementById("tg-context-menu");
    if(oldCtx) oldCtx.remove();
    
    const isSelf = msg.fromUid === AppState.currentUser.uid;
    const isEditingAllowed = isSelf && msg.type === "text";
    
    let html = `
    <div id="tg-context-menu" class="tg-context-menu" style="left: ${e.pageX}px; top: ${e.pageY - 50}px;">
       <div class="tg-quick-emojis">
          ${this.EMOJIS.map(em => `<div class="tg-reaction" onclick="DirectMessages.toggleReaction('${msg.id}', '${em}')">${em}</div>`).join('')}
       </div>
       <div class="tg-ctx-item" onclick="DirectMessages.setReplyOrEdit(${JSON.stringify(msg).replace(/"/g, "&quot;")}, 'reply')">↩️ Ответить</div>
       ${isEditingAllowed ? `<div class="tg-ctx-item" onclick="DirectMessages.setReplyOrEdit(${JSON.stringify(msg).replace(/"/g, "&quot;")}, 'edit')">✏️ Изменить</div>` : ''}
       ${isSelf ? `<div class="tg-ctx-item" style="color:#ff5555" onclick="DirectMessages.deleteMsg('${msg.id}')">🗑 Удалить</div>` : ''}
    </div>
    `;
    
    document.body.insertAdjacentHTML("beforeend", html);
    
    const closeListener = (evt) => {
        if (!evt.target.closest("#tg-context-menu")) {
            const m = document.getElementById("tg-context-menu");
            if(m) m.remove();
            document.removeEventListener("click", closeListener);
        }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 10);
};

DirectMessages.renderMessages = function(messages) {
    const list = Utils.$("dm-messages");
    if (!messages.length) {
      list.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px;">Нет сообщений</div>`;
      return;
    }
    
    window._curMessagesMap = {};

    list.innerHTML = messages
      .map((m) => {
        window._curMessagesMap[m.id] = m;
      
        const isSelf = m.fromUid === AppState.currentUser.uid;
        if (m.type === "system") {
          return `<div class="sys-msg">${Utils.escapeHtml(m.fromName || "Пользователь")} ${Utils.escapeHtml(m.text || "")}</div>`;
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
                if(!grouped[em]) grouped[em] = { count: 0, me: false };
                grouped[em].count++;
                if (uid === AppState.currentUser.uid) grouped[em].me = true;
            });
            let items = Object.entries(grouped).map(([em, data]) => 
               `<div class="tg-reaction ${data.me ? 'me' : ''}" onclick="DirectMessages.toggleReaction('${m.id}', '${em}')">${em} ${data.count}</div>`
            );
            if (items.length) {
               reactionsHtml = `<div class="tg-reactions">${items.join('')}</div>`;
            }
        }
        
        const timestamp = new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const editedStr = m.isEdited ? "изменено" : "";

        if (m.type === "file" || m.type === "gif" || m.type === "media" || m.url) {
          const isImg =
            m.type === "gif" ||
            String(m.url).match(/\.(gif|jpe?g|png|webp|bmp)$/i) ||
            String(m.url).match(/tenor\.com|giphy\.com|imgur\.com/i) ||
            String(m.url).startsWith("data:image/");
            
          return `
            <div class="m-line ${isSelf ? "self" : ""}" id="msg-${m.id}">
                <div class="tg-bubble" oncontextmenu="DirectMessages.showContextMenu(event, window._curMessagesMap['${m.id}'])">
                    ${replyHtml}
                    ${isImg ? `<img src="${Utils.escapeHtml(m.url)}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x150?text=Error';" />` : `<a href="${Utils.escapeHtml(m.url)}" target="_blank" style="color: #5288c1; padding: 8px; display: inline-block;">📎 Прикрепленный файл</a>`}
                    <div class="tg-time">${editedStr} ${timestamp}</div>
                    ${reactionsHtml}
                </div>
            </div>
          `;
        }

        return `
            <div class="m-line ${isSelf ? "self" : ""}" id="msg-${m.id}">
                <div class="tg-bubble" oncontextmenu="DirectMessages.showContextMenu(event, window._curMessagesMap['${m.id}'])">
                    ${replyHtml}
                    <div>${Utils.escapeHtml(m.text)}</div>
                    <div class="tg-time">${editedStr} ${timestamp}</div>
                    ${reactionsHtml}
                </div>
            </div>
        `;
      })
      .join("");
      
    list.scrollTop = list.scrollHeight;
    if (this.theme === "love") this.startLoveHearts();
}
