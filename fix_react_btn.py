import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('document.querySelectorAll(".react-btn").forEach((btn) => {', 'document.querySelectorAll(".react-btn[data-emoji]").forEach((btn) => {')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
