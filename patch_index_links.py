import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<a href="https://cowio-privacy-accept.vercel.app" target="_blank" style="color: white; text-decoration: underline">пользовательское соглашение</a>',
    '<a href="terms.html" target="_blank" style="color: white; text-decoration: underline">пользовательское соглашение</a> и <a href="privacy.html" target="_blank" style="color: white; text-decoration: underline">политику конфиденциальности</a>'
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
