import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the buttons in reaction-bar
old_buttons = """<button class="react-btn" id="btn-share-room-fixed" onclick="if(window._setRoomTab)window._setRoomTab('users'); if(window.Utils)window.Utils.toast('Нажмите \\'Пригласить\\' рядом с другом в списке', 'info');" title="Поделиться" style="background:none; border:none; padding:0; cursor:pointer;">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Link.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>
              <button class="react-btn" id="btn-toggle-chat-panel" onclick="document.querySelector('.room-layout').classList.toggle('chat-collapsed')" title="Скрыть/показать чат" style="background:none; border:none; padding:0; cursor:pointer;">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Eyes.webp" style="width: 36px; height: 36px; pointer-events: none">
              </button>"""

new_buttons = """<button class="react-btn" id="btn-share-room-fixed" onclick="if(window._setRoomTab)window._setRoomTab('users'); if(window.Utils)window.Utils.toast('Нажмите \\'Пригласить\\' рядом с другом в списке', 'info');" title="Поделиться" style="background:none; border:none; padding:0; cursor:pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Outbox%20Tray.webp" style="width: 36px; height: 36px; pointer-events: none">
                <span style="font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; pointer-events: none;">Share</span>
              </button>
              <button class="react-btn" id="btn-toggle-chat-panel" onclick="document.querySelector('.room-layout').classList.toggle('chat-collapsed')" title="Скрыть/показать чат" style="background:none; border:none; padding:0; cursor:pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Eyes.webp" style="width: 36px; height: 36px; pointer-events: none">
                <span style="font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; pointer-events: none;">Чат</span>
              </button>"""

content = content.replace(old_buttons, new_buttons)

# 2. Update the video-container style
old_video_container = '<div class="video-container glass-panel" style="width: 100%; aspect-ratio: 16/9; max-height: 100%; align-self: center; position: relative; border-radius: 24px !important; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1;">'
new_video_container = '<div class="video-container glass-panel" style="flex: 1; height: 100%; min-width: 0; min-height: 0; position: relative; border-radius: 24px !important; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1; display: flex; align-items: center; justify-content: center; background: #000;">'

content = content.replace(old_video_container, new_video_container)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
