import re

with open('settingsRenderer.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add a section to SettingSections
legal_section = """  {
    title: "Юридическая информация",
    icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Scroll.webp",
    items: [
      {
        id: "site-legal-privacy",
        type: "button",
        title: "Политика конфиденциальности",
        desc: "Правила обработки ваших данных",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp",
        onClick: () => { window.open('privacy.html', '_blank'); }
      },
      {
        id: "site-legal-terms",
        type: "button",
        title: "Пользовательское соглашение",
        desc: "Условия использования сервиса",
        icon: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Page%20Facing%20Up.webp",
        onClick: () => { window.open('terms.html', '_blank'); }
      }
    ]
  },
"""

content = content.replace("const SettingSections = [", "const SettingSections = [\n" + legal_section)

with open('settingsRenderer.js', 'w', encoding='utf-8') as f:
    f.write(content)
