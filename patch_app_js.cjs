const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// replace openCreatorPanel and related methods
const regex = /static openCreatorPanel\(\) \{[\s\S]*?static clearAllBans\(\) \{[\s\S]*?\}\s*}/;

const newMethods = `static async openCreatorPanel() {
        Utils.$('modal-support-creator-panel').classList.add('active');
        Utils.$('stat-banned-count').innerText = this.BANNED_USERS.size;
        
        let total = 0, open = 0, closed = 0;
        const dbLocal = window.db;
        const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get}) => get(ref(dbLocal, 'support_tickets')));
        const val = snap.val() || {};
        Object.values(val).forEach(t => {
            total++;
            if (t.status === 'closed') closed++;
            else open++;
        });
        
        const elTotal = Utils.$('stat-total-tickets'); if (elTotal) elTotal.innerText = total;
        const elOpen = Utils.$('stat-open-tickets'); if (elOpen) elOpen.innerText = open;
        const elClosed = Utils.$('stat-closed-tickets'); if (elClosed) elClosed.innerText = closed;
        
        this.renderCreatorTemplates();
    }
    
    static forceSyncAllTickets(type = 'all') {
        if(confirm(type === 'all' ? 'Удалить все закрытые тикеты?' : 'Удалить тикеты старше 7 дней?')) {
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, remove}) => {
                const dbLocal = window.db;
                get(ref(dbLocal, 'support_tickets')).then(snap => {
                     const val = snap.val() || {};
                     const now = Date.now();
                     let c = 0;
                     Object.keys(val).forEach(k => {
                         const time = val[k].createdAt || 0;
                         if (type === 'all' && val[k].status === 'closed') {
                             remove(ref(dbLocal, \`support_tickets/\${k}\`));
                             c++;
                         } else if (type === 'old' && (now - time > 7 * 24 * 3600000)) {
                             remove(ref(dbLocal, \`support_tickets/\${k}\`));
                             c++;
                         }
                     });
                     Utils.toast(\`Очищено тикетов: \${c}\`);
                     this.openCreatorPanel(); // refresh stats
                });
            });
        }
    }
    
    static renderCreatorTemplates() {
        const list = Utils.$('support-creator-templates-list');
        if (!list) return;
        list.innerHTML = Object.entries(this.TEMPLATES).map(([k, v]) => \`
            <div style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px;">
                <b style="color:#fff; min-width:80px; font-size:12px;">\${k}</b>
                <span style="flex:1; color:var(--text-muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${Utils.escapeHtml(v)}</span>
                <button class="danger-btn" style="padding:4px 8px; font-size:10px;" onclick="SupportSystem.removeGlobalTemplate('\${k}')">Удалить</button>
            </div>
        \`).join('') || '<div style="color:var(--text-muted); font-size:12px; padding:10px;">Нет шаблонов</div>';
    }

    static async addGlobalTemplate() {
        const titleEl = Utils.$('new-template-name');
        const textEl = Utils.$('new-template-text');
        const title = titleEl ? titleEl.value.trim() : '';
        const text = textEl ? textEl.value.trim() : '';
        if(!title || !text) return Utils.toast('Заполните все поля');
        
        const { update } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        await update(ref(window.db, 'support_templates'), { [title]: text });
        titleEl.value = ''; textEl.value = '';
        Utils.toast('Шаблон добавлен');
    }

    static async removeGlobalTemplate(key) {
        if(!confirm('Удалить шаблон?')) return;
        const { remove } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        await remove(ref(window.db, \`support_templates/\${key}\`));
        Utils.toast('Шаблон удален');
    }
    
    static async exportAllTickets() {
        const dbLocal = window.db;
        const { get } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        const snap = await get(ref(dbLocal, 'support_tickets'));
        const val = snap.val() || {};
        let str = '=== ЭКСПОРТ ОТКРЫТЫХ ТИКЕТОВ ===\\n\\n';
        Object.values(val).forEach(t => {
            if(t.status === 'closed') return;
            str += \`[ID: \${t.id}] \${t.title} (от \${t.creatorUid})\\n\`;
            Object.values(t.messages || {}).forEach(m => {
                str += \`  - \${m.name}: \${m.text}\\n\`;
            });
            str += '\\n';
        });
        const blob = new Blob([str], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = \`active_tickets_\${Date.now()}.txt\`;
        a.click();
    }
    
    static async banUidFromInput() {
        const el = Utils.$('admin-ban-uid');
        if (!el || !el.value.trim()) return;
        const tUid = el.value.trim();
        await this.adminBan(tUid);
        el.value = '';
        this.openCreatorPanel(); // refresh stats
    }

    static clearAllBans() {
        if(confirm('Точно снять все баны?')) {
            const { remove } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
            remove(ref(window.db, 'support_bans')).then(() => Utils.toast('Баны очищены'));
        }
    }
}`;

if(regex.test(app)) {
    app = app.replace(regex, newMethods);
    fs.writeFileSync('app.js', app);
    console.log('patched SupportSystem methods');
} else {
    console.log('Regex not found!');
}
