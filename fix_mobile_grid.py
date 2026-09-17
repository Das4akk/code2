import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mobile height auto
content = content.replace(
"""        .room-layout {
          grid-template-columns: 1fr;
          padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0;
          height: auto;""",
"""        .room-layout {
          grid-template-columns: 1fr;
          padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0;
          height: 100% !important;"""
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
