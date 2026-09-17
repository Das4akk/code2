import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix player-section
content = re.sub(
    r'<div class="player-section" style="[^"]*">',
    '<div class="player-section">',
    content
)

# Fix reaction-bar
content = re.sub(
    r'<div class="reaction-bar" style="[^"]*">',
    '<div class="reaction-bar">',
    content
)

# Fix video-container
content = re.sub(
    r'<div class="video-container glass-panel" style="[^"]*">',
    '<div class="video-container glass-panel">',
    content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
