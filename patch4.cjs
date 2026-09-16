const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
    /<button class="secondary-btn" id="btn-room-settings".*?>настройки<\/button>/,
    `<button class="secondary-btn" id="btn-open-chat" style="background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; padding: 6px 12px; border-radius: 8px;">Чат</button>
     <button class="secondary-btn" id="btn-room-settings" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; display: none;">настройки</button>`
);
fs.writeFileSync('index.html', html);

let js = fs.readFileSync('app.js', 'utf8');
js += `
document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btn-open-chat");
    if (openBtn) {
        openBtn.addEventListener("click", () => {
            const layout = document.querySelector(".room-layout");
            if (layout) {
                layout.classList.remove("chat-collapsed");
            }
        });
    }
});
`;
fs.writeFileSync('app.js', js);
