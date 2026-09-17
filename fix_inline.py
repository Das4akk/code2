import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix video-container
old_video = '<div class="video-container glass-panel" style="flex: 1; height: 100%; min-width: 0; min-height: 0; position: relative; border-radius: 24px !important; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); transition: border-radius 0.3s ease; order: 1; display: flex; align-items: center; justify-content: center; background: #000;">'
new_video = '<div class="video-container glass-panel" style="flex: 1; height: 100%; min-width: 0; min-height: 0; position: relative; border-radius: 24px !important; overflow: hidden; transition: border-radius 0.3s ease; order: 1; display: flex; align-items: center; justify-content: center;">'
content = content.replace(old_video, new_video)

# Fix chat-section
old_chat = '<div class="chat-section glass-panel" style="display: flex; flex-direction: column; background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px !important; margin: 0 16px 24px 0; overflow: hidden; max-height: calc(100vh - 80px);">'
new_chat = '<div class="chat-section glass-panel" style="display: flex; flex-direction: column; border-radius: 24px !important; margin: 0 16px 24px 0; overflow: hidden; max-height: calc(100vh - 80px);">'
content = content.replace(old_chat, new_chat)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
