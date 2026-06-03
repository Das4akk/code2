const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Render inline templates for admin
const renderInlineTemplates = `
        const templateContainer = Utils.$('support-inline-templates');
        if (templateContainer) {
            if (isAdmin) {
                templateContainer.style.display = 'flex';
                templateContainer.innerHTML = Object.keys(this.TEMPLATES).map(k => 
                    \`<button class="secondary-btn" style="padding:4px 10px; font-size:11px; border-radius:12px;" onclick="SupportSystem.useTemplate('\${k}', '\${id}')">\${k}</button>\`
                ).join('');
            } else {
                templateContainer.style.display = 'none';
            }
        }
`;

app = app.replace(/(Utils\.\$\('support-ticket-title-text'\)\.innerText = t\.title \|\| 'Без темы';)/, renderInlineTemplates + '\n$1');

const blurHandling = `
             // handle blur and lock for closed
             const overlay = Utils.$('support-closed-overlay');
             const dmCompose = Utils.$('support-active-ticket').querySelector('.dm-compose');
             const inlineTmplate = Utils.$('support-inline-templates');
             if (isClosed) {
                 if (overlay) overlay.style.display = 'flex';
                 if (dmCompose) dmCompose.style.opacity = '0.3';
                 if (dmCompose) dmCompose.style.pointerEvents = 'none';
                 if (inlineTmplate) inlineTmplate.style.display = 'none';
             } else {
                 if (overlay) overlay.style.display = 'none';
                 if (dmCompose) dmCompose.style.opacity = '1';
                 if (dmCompose) dmCompose.style.pointerEvents = 'auto';
                 if (isAdmin && inlineTmplate) inlineTmplate.style.display = 'flex';
             }

             const btnReopenOverlay = Utils.$('btn-support-reopen-overlay');
             if (btnReopenOverlay) {
                 btnReopenOverlay.style.display = isAdmin ? 'block' : 'none';
                 btnReopenOverlay.onclick = () => this.reopenTicket(id);
             }
`;

app = app.replace(/(Utils\.\$\('btn-support-close-ticket'\)\.style\.display = isClosed \? 'none' : 'block';)/, blurHandling + '\n$1');

// Hide closed tickets for normal users!
const hideClosedUsers = `
                if (!isAdmin && t.creatorUid === uid && t.status === 'closed') return false;
`;

app = app.replace(/(tickets = tickets\.filter\(t => t\.creatorUid === uid\);)/, `$1\n                tickets = tickets.filter(t => t.status !== 'closed'); // Hide for creator visually`);

// Add deleteTicketLocally
const deleteTicketMethod = `
    static async deleteTicketLocally() {
        if (!this.activeTicketId) return;
        if (!confirm('Точно удалить этот тикет?')) return;
        const id = this.activeTicketId;
        const uid = AppState.currentUser?.uid;
        
        // Hide visually right now
        Utils.$('support-active-ticket').style.display = 'none';
        Utils.$('support-no-ticket').style.display = 'flex';
        
        if (typeof remove !== 'undefined' && typeof ref !== 'undefined') {
            await remove(ref(window.db, \`support_tickets/\${id}\`));
            Utils.toast('Тикет удален', 'success');
        }
    }
`;

app = app.replace(/static async closeAllActiveTickets/, deleteTicketMethod + '\n    static async closeAllActiveTickets');

// also remove quick templates button from quick actions since we moved them inline
app = app.replace(/<div style="font-size:11px; color:var\(--text-muted\); margin-bottom:4px; font-weight:bold;">ШАБЛОНЫ:<\/div>.*?<div style="border-top:1px solid rgba\(255,255,255,0\.05\); margin: 6px 0;"><\/div>/s, '');


fs.writeFileSync('app.js', app);
