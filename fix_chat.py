import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix chat-section inline style
content = re.sub(
    r'<div class="chat-section glass-panel" style="[^"]*">',
    '<div class="chat-section glass-panel">',
    content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
