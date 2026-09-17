import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the footerLinks.innerHTML block
old_html = """  footerLinks.innerHTML = `
        <a href="mailto:support@cowio.com">Mail</a>
        <a href="https://t.me/Das4akk" target="_blank">Telegram</a>
        <a href="https://cowio-privacy-accept.vercel.app" target="_blank"Политика</a>
        <a href="https://t.me/EzKid" target="_blank">Предложка</a>
    `;"""

new_html = """  footerLinks.innerHTML = `
        <a href="mailto:support@cowio.com">Mail</a>
        <a href="https://t.me/Das4akk" target="_blank">Telegram</a>
        <a href="privacy.html" target="_blank">Политика</a>
        <a href="terms.html" target="_blank">Соглашение</a>
    `;"""

content = content.replace(old_html, new_html)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
