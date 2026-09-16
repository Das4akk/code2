const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldHeader = `<div class="chat-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button id="chat-tab-prev" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 18px; padding: 0 8px; font-weight: bold; transition: color 0.2s;">&lt;</button>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span id="current-right-tab-title" style="font-weight: 700; font-size: 17px; color: #fff;">Чат</span>
                <span id="users-count" style="font-size: 14px; color: rgba(255,255,255,0.4);">0</span>
              </div>
              <button id="chat-tab-next" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 18px; padding: 0 8px; font-weight: bold; transition: color 0.2s;">&gt;</button>
            </div>
            <button id="btn-chat-close-x" style="background: rgba(255,255,255,0.05); border: none; width: 28px; height: 28px; border-radius: 50%; color: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">✕</button>
          </div>`;

const newHeader = `<div class="chat-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px;">
            <button id="btn-tab-chat" style="flex: 1; background: rgba(255,255,255,0.1); border: none; color: #fff; border-radius: 12px; padding: 10px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Чат</button>
            <button id="btn-tab-users" style="flex: 1; background: transparent; border: none; color: rgba(255,255,255,0.6); border-radius: 12px; padding: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s, color 0.2s;">Люди <span id="users-count" style="font-size: 13px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 10px;">0</span></button>
          </div>`;

html = html.replace(oldHeader, newHeader);

const oldChatSection = `<div class="chat-section glass-panel" style="display: flex; flex-direction: column; background: #000; border-left: 1px solid rgba(255,255,255,0.05); border-radius: 0;">`;
const newChatSection = `<div class="chat-section glass-panel" style="display: flex; flex-direction: column; background: #000; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; margin: 0 16px 24px 0; overflow: hidden; max-height: calc(100vh - 80px);">`;
html = html.replace(oldChatSection, newChatSection);

fs.writeFileSync('index.html', html);
