const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldTopBarRight = `<div style="display: flex; align-items: center; gap: 16px;">
            <button class="secondary-btn" title="На весь экран" id="btn-fullscreen-toggle" style="background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 8px;">⛶</button>
            <button class="secondary-btn" id="btn-open-chat" style="background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; padding: 6px 12px; border-radius: 8px;">Чат</button>
     <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none;">настройки</button>
          </div>`;

const newTopBarRight = `<div style="display: flex; align-items: center; gap: 16px;">
            <button class="secondary-btn" title="На весь экран" id="btn-fullscreen-toggle" style="background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 8px;">⛶</button>
            <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none; padding: 8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Nut%20And%20Bolt.webp" style="width:28px;height:28px;"></button>
          </div>`;

html = html.replace(oldTopBarRight, newTopBarRight);

// move them to the left side
const oldTopBar = `<div class="room-top-bar glass-panel" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: transparent; border-bottom: none;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <button class="icon-btn" id="btn-leave-room" aria-label="Выйти" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 44px; height: 44px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div class="room-title-wrapper" style="display: flex; flex-direction: column;">
              <h2 id="room-title-text" style="margin: 0; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">Загрузка комнаты...</h2>
              <div id="room-author-info" style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); margin-top: 4px;">
                  <div id="room-author-avatar" style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.1);"></div>
                  <span id="room-author-name" style="font-weight: 600; color: #eee;">автор комнаты</span>
                  <span id="room-typing-status" style="font-size: 13px; display: inline-block; animation: pulse 1.5s infinite;"></span>
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 16px;">
            <button class="secondary-btn" title="На весь экран" id="btn-fullscreen-toggle" style="background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 8px;">⛶</button>
            <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none; padding: 8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Nut%20And%20Bolt.webp" style="width:28px;height:28px;"></button>
          </div>
        </div>`;

const newTopBar = `<div class="room-top-bar glass-panel" style="display: flex; align-items: center; justify-content: flex-start; gap: 24px; padding: 16px 24px; background: transparent; border-bottom: none;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <button class="icon-btn" id="btn-leave-room" aria-label="Выйти" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 44px; height: 44px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div class="room-title-wrapper" style="display: flex; flex-direction: column;">
              <h2 id="room-title-text" style="margin: 0; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">Загрузка комнаты...</h2>
              <div id="room-author-info" style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); margin-top: 4px;">
                  <div id="room-author-avatar" style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.1);"></div>
                  <span id="room-author-name" style="font-weight: 600; color: #eee;">автор комнаты</span>
                  <span id="room-typing-status" style="font-size: 13px; display: inline-block; animation: pulse 1.5s infinite;"></span>
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;" id="room-top-actions">
            <!-- Share btn added from JS goes here -->
            <button class="secondary-btn" title="На весь экран" id="btn-fullscreen-toggle" style="background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 8px;">⛶</button>
            <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none; padding: 8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Nut%20And%20Bolt.webp" style="width:28px;height:28px;"></button>
          </div>
        </div>`;

// Wait, the user said "Все верхние кнопки сьехали куда-то в центр.Смести их максимально влево."
// My new layout uses margin-left: auto; which pushes the right block to the right. 
// Let's remove `margin-left: auto` to put them on the left, next to the title.

const newTopBarLeftAligned = `<div class="room-top-bar glass-panel" style="display: flex; align-items: center; justify-content: flex-start; gap: 24px; padding: 16px 24px; background: transparent; border-bottom: none;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <button class="icon-btn" id="btn-leave-room" aria-label="Выйти" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 44px; height: 44px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div class="room-title-wrapper" style="display: flex; flex-direction: column;">
              <h2 id="room-title-text" style="margin: 0; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">Загрузка комнаты...</h2>
              <div id="room-author-info" style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); margin-top: 4px;">
                  <div id="room-author-avatar" style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.1);"></div>
                  <span id="room-author-name" style="font-weight: 600; color: #eee;">автор комнаты</span>
                  <span id="room-typing-status" style="font-size: 13px; display: inline-block; animation: pulse 1.5s infinite;"></span>
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px;" id="room-top-actions">
            <!-- Share btn added from JS goes here -->
            <button class="secondary-btn" title="На весь экран" id="btn-fullscreen-toggle" style="background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 8px;">⛶</button>
            <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none; padding: 8px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Nut%20And%20Bolt.webp" style="width:28px;height:28px;"></button>
          </div>
        </div>`;

if(html.includes(oldTopBar)) {
    html = html.replace(oldTopBar, newTopBarLeftAligned);
} else {
    html = html.replace(oldTopBarRight, newTopBarRight);
}

fs.writeFileSync('index.html', html);
