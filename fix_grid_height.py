import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Force room-layout to have bounded height so it doesn't grow with chat messages
css_height = """
      .room-layout {
        height: 100% !important;
        overflow: hidden;
      }
      .player-section {
        height: 100%;
        overflow: hidden;
      }
"""

content = content.replace("/* ========================================================= */\n      /* SCREENS & AUTH */", css_height + "\n      /* ========================================================= */\n      /* SCREENS & AUTH */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
