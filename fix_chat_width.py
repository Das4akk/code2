import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make grid wider
content = content.replace('grid-template-columns: 1fr 260px;', 'grid-template-columns: 1fr 400px;')

# Add border to chat-section in light themes
css_border = """
      /* Chat border for light themes */
      #room-screen.theme-inverted .chat-section,
      #room-screen.theme-light .chat-section {
        border: 2px solid #111 !important;
      }
"""
content = content.replace("/* Fix icons on light theme */", css_border + "\n      /* Fix icons on light theme */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
