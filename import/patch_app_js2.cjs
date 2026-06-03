const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// 1. Rewrite SupportSystem.openCreatorPanel
app = app.replace(/static async openCreatorPanel\(\) \{.*?this\.renderCreatorTemplates\(\);\s*\}/s, `static async openCreatorPanel() {
        Utils.$('modal-support-creator-panel').classList.add('active');
        
        let total = 0, open = 0, closed = 0;
        const dbLocal = window.db || (typeof db !== 'undefined' ? db : null);
        if (dbLocal && typeof get !== 'undefined' && typeof ref !== 'undefined') {
            const snap = await get(ref(dbLocal, 'support_tickets'));
            const val = snap.val() || {};
            Object.values(val).forEach(t => {
                total++;
                if (t.status === 'closed') closed++;
                else open++;
            });
        }
        
        const elTotal = Utils.$('stat-total-tickets'); if (elTotal) elTotal.innerText = total;
        const elOpen = Utils.$('stat-open-tickets'); if (elOpen) elOpen.innerText = open;
        const elClosed = Utils.$('stat-closed-tickets'); if (elClosed) elClosed.innerText = closed;
        
        this.renderCreatorTemplates();
    }`);

// remove import() dynamic imports in SupportSystem
// exportArchiveTickets
app = app.replace(/const \{ get \} = await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js"\);\s*/g, '');
app = app.replace(/const \{ remove \} = await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js"\);\s*/g, '');
app = app.replace(/const \{ get, update \} = await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js"\);\s*/g, '');

// fix forceSyncAllTickets
app = app.replace(/import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js"\)\.then\(\(\{get, remove\}\) => \{/g, `if (typeof get !== 'undefined' && typeof remove !== 'undefined') {`);

fs.writeFileSync('app.js', app);
