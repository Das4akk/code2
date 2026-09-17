import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('filter: invert(1) brightness(0.9);', '/* keeping default white particles for light themes on black background */')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
