import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add desktop margins to chat-section
css_addition = """
      @media (min-width: 769px) {
        .chat-section {
          margin: 16px 16px 16px 0;
          height: calc(100% - 32px) !important;
          border-radius: 20px;
        }
      }
"""

content = content.replace("/* ========================================================= */\n      /* SCREENS & AUTH */", css_addition + "\n      /* ========================================================= */\n      /* SCREENS & AUTH */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
