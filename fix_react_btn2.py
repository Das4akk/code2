import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('.querySelectorAll(".react-btn")', '.querySelectorAll(".react-btn[data-emoji]")')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
