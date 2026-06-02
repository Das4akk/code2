const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const additionalMethods = `
    static async exportArchiveTickets() {
        const { get } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        const snap = await get(ref(window.db, 'support_tickets'));
        const val = snap.val() || {};
        let str = '=== ЭКСПОРТ АРХИВНЫХ (ЗАКРЫТЫХ) ТИКЕТОВ ===\\n\\n';
        Object.values(val).forEach(t => {
            if(t.status === 'open') return;
            str += \`[ID: \${t.id}] \${t.title} (от \${t.creatorUid})\\n\`;
            Object.values(t.messages || {}).forEach(m => {
                str += \`  - \${m.name}: \${m.text}\\n\`;
            });
            str += '\\n';
        });
        const blob = new Blob([str], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = \`archived_tickets_\${Date.now()}.txt\`;
        a.click();
    }
    
    static async exportBansList() {
        let str = '=== СПИСОК ЗАБЛОКИРОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ (ПОДДЕРЖКА) ===\\n\\n';
        this.BANNED_USERS.forEach(uid => str += \`- \${uid}\\n\`);
        const blob = new Blob([str], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = \`support_bans_\${Date.now()}.txt\`;
        a.click();
    }
    
    static refreshCreatorStats() {
        this.openCreatorPanel(); // Just calls the opening which refreshes stats
        Utils.toast('Данные обновлены', 'success');
    }
    
    static async closeAllActiveTickets() {
        if(!confirm('Закрыть все открытые тикеты? Это действие нельзя отменить.')) return;
        const { get, update } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        const snap = await get(ref(window.db, 'support_tickets'));
        const val = snap.val() || {};
        let c = 0;
        Object.keys(val).forEach(k => {
            if (val[k].status === 'open') {
                update(ref(window.db, \`support_tickets/\${k}\`), { status: 'closed' });
                c++;
            }
        });
        Utils.toast(\`Закрыто тикетов: \${c}\`);
        this.openCreatorPanel();
    }
    
    static async unbanUidFromInput() {
        const el = Utils.$('admin-ban-uid');
        if (!el || !el.value.trim()) return;
        const tUid = el.value.trim();
        const { remove } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        await remove(ref(window.db, \`support_bans/\${tUid}\`));
        el.value = '';
        Utils.toast('Пользователь разблокирован', 'success');
        this.openCreatorPanel();
    }
    
    static checkStatusUidFromInput() {
        const el = Utils.$('admin-ban-uid');
        if (!el || !el.value.trim()) return;
        const tUid = el.value.trim();
        if (this.BANNED_USERS.has(tUid)) {
            Utils.toast('Пользователь ЗАБЛОКИРОВАН', 'error');
        } else {
            Utils.toast('Пользователь НЕ ЗАБЛОКИРОВАН', 'success');
        }
    }
`;

const pos = app.lastIndexOf('window.SupportSystem = SupportSystem;');
if (pos !== -1) {
    const endBrace = app.lastIndexOf('}', pos);
    if (endBrace !== -1) {
        app = app.substring(0, endBrace) + additionalMethods + app.substring(endBrace);
        fs.writeFileSync('app.js', app);
        console.log('Features added');
    }
}
