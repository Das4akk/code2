import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make transition on room title
content = content.replace('id="room-title-text" style="margin: 0; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px;"', 'id="room-title-text" style="margin: 0; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; transition: color 0.5s ease, background 0.5s ease;"')
content = content.replace('id="room-author-name" style="font-weight: 600; color: #eee;"', 'id="room-author-name" style="font-weight: 600; color: #eee; transition: color 0.5s ease, background 0.5s ease;"')

css_addition = """
      /* Matte Black Gradient Text for Light Themes */
      #room-screen.theme-inverted #room-title-text,
      #room-screen.theme-inverted #room-author-name,
      #room-screen.theme-inverted #btn-tab-chat,
      #room-screen.theme-inverted #btn-tab-users,
      #room-screen.theme-inverted .react-btn span,
      #room-screen.theme-light #room-title-text,
      #room-screen.theme-light #room-author-name,
      #room-screen.theme-light #btn-tab-chat,
      #room-screen.theme-light #btn-tab-users,
      #room-screen.theme-light .react-btn span {
        background-image: linear-gradient(135deg, #111 0%, #444 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        color: transparent !important;
      }
      
      #room-screen.theme-inverted #btn-leave-room svg,
      #room-screen.theme-inverted #btn-exit-fullscreen svg,
      #room-screen.theme-light #btn-leave-room svg,
      #room-screen.theme-light #btn-exit-fullscreen svg {
        stroke: #222 !important;
      }

      #room-screen.theme-inverted #btn-tab-chat,
      #room-screen.theme-light #btn-tab-chat {
        background: rgba(0,0,0,0.05) !important;
      }
      
      #room-screen.theme-inverted #chat-input,
      #room-screen.theme-light #chat-input {
        color: #111 !important;
        background: rgba(0,0,0,0.05) !important;
      }

      #room-screen.theme-inverted #chat-input::placeholder,
      #room-screen.theme-light #chat-input::placeholder {
        color: #555 !important;
      }
      
      /* Fix icons on light theme */
      #room-screen.theme-inverted .icon-btn,
      #room-screen.theme-light .icon-btn {
        background: rgba(0,0,0,0.05) !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
"""

if "/* Matte Black Gradient Text for Light Themes */" not in content:
    content = content.replace("/* // [NEW] INVERTED ROOM THEME */", css_addition + "\n      /* // [NEW] INVERTED ROOM THEME */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
