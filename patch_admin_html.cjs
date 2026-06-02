const fs = require('fs');

let index = fs.readFileSync('index.html', 'utf8');

// The new HTML for Creator panel
const newModal = `
    <!-- Creator Support Panel Modal -->
    <div id="modal-support-creator-panel" class="modal" style="z-index:9000;">
        <div class="modal-content glass-panel" style="width:100%; max-width:800px; padding:30px; border-radius:24px; position:relative; display:flex; flex-direction:column; gap:20px; animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <button class="secondary-btn" style="position:absolute; top:20px; right:20px; width:40px; height:40px; padding:0; border-radius:12px; font-size:20px;" onclick="document.getElementById('modal-support-creator-panel').classList.remove('active')">×</button>
            <h2 style="font-size:24px; margin:0; display:flex; align-items:center; gap:10px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Crown.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Панель Создателя (Поддержка)</h2>
            <div style="color:var(--text-muted); font-size:14px; margin-top:-10px;">Проверенная статистика, управление доступом и шаблонами ответов</div>
            
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#fff;" id="stat-total-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Всего тикетов</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#2ed573;" id="stat-open-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Открытых</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#ff4757;" id="stat-closed-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Закрытых</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#ffa502;" id="stat-banned-count">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Забанено</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);">
                    <h4 style="margin:0 0 10px 0; font-size:14px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Memo.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Шаблоны быстрых ответов</h4>
                    <div id="support-creator-templates-list" style="display:flex; flex-direction:column; gap:8px; max-height:150px; overflow-y:auto; margin-bottom:10px;"></div>
                    <div style="display:flex; gap:8px; margin-top:15px;">
                        <input type="text" id="new-template-name" placeholder="Название" style="flex:1; padding:8px; border-radius:8px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:12px;">
                        <input type="text" id="new-template-text" placeholder="Текст" style="flex:2; padding:8px; border-radius:8px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:12px;">
                        <button class="primary-btn" style="padding:8px 12px; font-size:12px;" onclick="SupportSystem.addGlobalTemplate()">Добавить</button>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:10px;">
                    <h4 style="margin:0; font-size:14px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Hammer.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"> Управление системой</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:10px;">
                        <button class="secondary-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem.forceSyncAllTickets('all')">Удалить все закрытые</button>
                        <button class="secondary-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem.forceSyncAllTickets('old')">Удалить старше 7 дней</button>
                        <button class="secondary-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem.exportAllTickets()">📥 Экспорт активных</button>
                        <button class="danger-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem.clearAllBans()">Снять все блокировки</button>
                    </div>
                    <div style="margin-top:auto; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                        <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--text-muted)">Заблокировать по UID:</h4>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="admin-ban-uid" placeholder="User ID" style="flex:1; padding:8px; border-radius:8px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:12px;">
                            <button class="danger-btn" style="padding:8px; font-size:12px; width:auto;" onclick="SupportSystem.banUidFromInput()">Забанить</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

// Extract old modal
const start = index.indexOf('<!-- Creator Support Panel Modal -->');
const end = index.indexOf('</div>', index.indexOf('</div>', index.indexOf('<!-- Creator Support Panel Modal -->') + 50) + 50);

const fullEnd = index.indexOf('</div>\n    </div>', start) + 16;
if (start !== -1 && fullEnd !== -1) {
    index = index.substring(0, start) + newModal + index.substring(fullEnd);
    fs.writeFileSync('index.html', index);
    console.log('patched HTML');
} else {
    console.log('could not find modal in html');
}
