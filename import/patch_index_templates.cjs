const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const templatesHtml = `
                            <div id="support-inline-templates" style="display:none; flex-wrap:wrap; gap:8px; padding:10px 20px; background:rgba(0,0,0,0.15); border-top:1px solid var(--border-light);">
                                <!-- Template buttons will be inserted here dynamically -->
                            </div>
`;

// Insert before the dm-compose area but below typing indicator
html = html.replace(/(<div class="dm-compose".*?>)/, templatesHtml + '$1');

// also Add Delete ticket button in header
html = html.replace(/(<button class="secondary-btn" id="btn-support-quick-actions".*?<\/button>)/, 
`<button class="danger-btn" id="btn-support-delete-ticket" style="padding:4px 10px; font-size:12px; height:auto; width:auto; border-radius:12px;" onclick="SupportSystem.deleteTicketLocally()"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Wastebasket.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Удалить</button>\n$1`);

// also add a blur overlay for closed tickets
const overlayHtml = `
                        <div id="support-closed-overlay" style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); z-index:100; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px;">
                            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked.webp" style="width:64px;height:64px;margin-bottom:15px;animation: pulse 2s infinite;">
                            <h3 style="margin:0 0 10px 0; font-size:20px; color:#fff;">Тикет закрыт</h3>
                            <p style="color:rgba(255,255,255,0.7); font-size:13px; max-width:300px; line-height:1.4;">Комната была закрыта. Если нужно, вы можете ее переоткрыть и вновь связаться с пользователем.</p>
                            <button id="btn-support-reopen-overlay" class="primary-btn" style="margin-top:20px;">Открыть снова</button>
                        </div>
`;
html = html.replace(/(<div id="support-active-ticket".*?>\s*<div class="dm-header".*?<\/div>)/, `$1\n${overlayHtml}`);

fs.writeFileSync('index.html', html);
