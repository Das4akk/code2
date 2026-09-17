import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the old Matte Black Gradient block completely
old_gradient_block = r'/\* Matte Black Gradient Text for Light Themes \*/.*?/\* Fix icons on light theme \*/'
content = re.sub(old_gradient_block, '/* Fix icons on light theme */', content, flags=re.DOTALL)

# 2. Add the correct Matte Black Text / Gradient block
new_css = """
      /* Matte Black Gradient Text for Light Themes */
      #room-screen.theme-inverted #room-title-text,
      #room-screen.theme-inverted #room-author-name,
      #room-screen.theme-light #room-title-text,
      #room-screen.theme-light #room-author-name {
        background-image: linear-gradient(135deg, #111 0%, #444 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        color: transparent !important;
      }
      
      #room-screen.theme-inverted #btn-tab-chat,
      #room-screen.theme-inverted #btn-tab-users,
      #room-screen.theme-inverted #btn-fullscreen-toggle,
      #room-screen.theme-inverted #send-btn,
      #room-screen.theme-inverted #btn-leave-room,
      #room-screen.theme-light #btn-tab-chat,
      #room-screen.theme-light #btn-tab-users,
      #room-screen.theme-light #btn-fullscreen-toggle,
      #room-screen.theme-light #send-btn,
      #room-screen.theme-light #btn-leave-room {
        color: #111 !important;
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
"""

content = content.replace("/* Fix icons on light theme */", new_css + "\n      /* Fix icons on light theme */")

# 3. Remove the filter from body.theme-inverted-room #particle-canvas so it stays black
content = re.sub(
    r'body\.theme-inverted-room #particle-canvas \{.*?\}',
    '',
    content,
    flags=re.DOTALL
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
