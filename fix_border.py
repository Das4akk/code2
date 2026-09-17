import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    ".room-layout:not(.chat-collapsed) .player-section {\n        border-right: 1px solid var(--border);\n      }",
    ".room-layout:not(.chat-collapsed) .player-section {\n        /* removed border-right */\n      }"
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
