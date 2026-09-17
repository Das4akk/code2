import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

css_addition2 = """
      #room-screen.theme-inverted #users-count,
      #room-screen.theme-light #users-count {
        background: rgba(0,0,0,0.1) !important;
        color: #111 !important;
      }
"""

content = content.replace("/* // [NEW] INVERTED ROOM THEME */", css_addition2 + "\n      /* // [NEW] INVERTED ROOM THEME */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
