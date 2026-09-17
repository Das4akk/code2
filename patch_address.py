import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<strong>Юридический адрес:</strong> г. Москва, ул. Примерная, д. 1, оф. 1',
    ''
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
