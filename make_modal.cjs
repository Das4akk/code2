const fs = require('fs');

let index = fs.readFileSync('index.html', 'utf8');

const modalHtml = `
    <!-- Creator Support Panel Modal -->
    <div id="modal-support-creator-panel" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9000; align-items:center; justify-content:center; backdrop-filter:blur(8px);">
        <div class="modal-content glass-panel" style="width:100%; max-width:700px; padding:30px; border-radius:24px; position:relative; display:flex; flex-direction:column; gap:20px; animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <button class="secondary-btn" style="position:absolute; top:20px; right:20px; width:40px; height:40px; padding:0; border-radius:12px; font-size:20px;" onclick="document.getElementById('modal-support-creator-panel').style.display='none'">×</button>
            <h2 style="font-size:24px; margin:0; display:flex; align-items:center; gap:10px;">👑 Панель Создателя (Поддержка)</h2>
            <div style="color:var(--text-muted); font-size:14px; margin-top:-10px;">Глобальная статистика и управление поддержкой</div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:36px; font-weight:800; margin-bottom:5px; color:var(--text-main);" id="stat-banned-count">0</div>
                    <div style="font-size:12px; color:var(--text-muted);">Заблокированных пользователей</div>
                    <button class="danger-btn" style="margin-top:15px; width:100%; padding:8px; font-size:12px;" onclick="SupportSystem.clearAllBans()">Снять все блокировки</button>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:20px; font-weight:800; margin-bottom:5px; color:#2ed573;">Активно</div>
                    <div style="font-size:12px; color:var(--text-muted);">Статус системы поддержки</div>
                    <button class="secondary-btn" style="margin-top:15px; width:100%; padding:8px; font-size:12px;" onclick="SupportSystem.forceSyncAllTickets()">Очистить старые тикеты</button>
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);">
                <h4 style="margin:0 0 10px 0; font-size:14px;">Шаблоны быстрых ответов (Глобальные)</h4>
                <div id="support-creator-templates-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                <button class="primary-btn" style="margin-top:15px; width:auto; padding:8px 16px; font-size:12px;" onclick="SupportSystem.addGlobalTemplate()">+ Добавить шаблон</button>
            </div>
        </div>
    </div>
`;
index = index.replace('</body>', modalHtml + '\n</body>');
fs.writeFileSync('index.html', index);

let app = fs.readFileSync('app.js', 'utf8');
app = app.replace(/static openCreatorPanel\(\) \{[\s\S]*?static clearAllBans\(\) \{/, `static openCreatorPanel() {
        Utils.$('modal-support-creator-panel').style.display = 'flex';
        Utils.$('stat-banned-count').innerText = this.BANNED_USERS.size;
        this.renderCreatorTemplates();
    }
    
    static forceSyncAllTickets() {
        if(confirm('Удалить все закрытые тикеты?')) {
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, remove}) => {
                const dbLocal = window.db;
                get(ref(dbLocal, 'support_tickets')).then(snap => {
                     const val = snap.val() || {};
                     Object.keys(val).forEach(k => {
                         if (val[k].status === 'closed') {
                             remove(ref(dbLocal, \`support_tickets/\${k}\`));
                         }
                     });
                     Utils.toast('Закрытые тикеты очищены');
                });
            });
        }
    }

    static renderCreatorTemplates() {
        const list = Utils.$('support-creator-templates-list');
        if (!list) return;
        list.innerHTML = Object.entries(this.TEMPLATES).map(([k, v]) => \`
            <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">
                <b style="color:#fff; min-width:100px; font-size:12px;">\${k}</b>
                <span style="flex:1; color:var(--text-muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${Utils.escapeHtml(v)}</span>
            </div>
        \`).join('');
    }

    static addGlobalTemplate() {
        Utils.toast('Настройка глобальных шаблонов пока в разработке', 'info');
    }

    static clearAllBans() {`);
fs.writeFileSync('app.js', app);
console.log('done');
