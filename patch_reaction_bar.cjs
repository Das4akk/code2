const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldReactionBar = `<div class="reaction-bar" style="right: 20px; bottom: auto; top: 50%; transform: translateY(-50%); flex-direction: column;">
              <button class="react-btn" data-emoji="🔥">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width: 32px; height: 32px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="😂">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp" style="width: 32px; height: 32px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="😱">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp" style="width: 32px; height: 32px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="❤️">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width: 32px; height: 32px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="👏">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp" style="width: 32px; height: 32px; pointer-events: none">
              </button>
            </div>
          </div>
        </div>`;

const newReactionBar = `          </div>
        </div>`;
html = html.replace(oldReactionBar, newReactionBar);

const playerSectionOpen = `<div class="player-section" style="padding: 0 24px 24px 24px;">`;
const playerSectionWithReactions = `<div class="player-section" style="padding: 0 54px 24px 24px; position: relative;">
          <div class="reaction-bar" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 12px;">
              <button class="react-btn" data-emoji="🔥">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="😂">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="😱">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="❤️">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
              <button class="react-btn" data-emoji="👏">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
          </div>`;

html = html.replace(playerSectionOpen, playerSectionWithReactions);

fs.writeFileSync('index.html', html);
