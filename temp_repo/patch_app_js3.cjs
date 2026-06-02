const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// remove methods
app = app.replace(/static async exportBansList\(\) \{.*?\}\s*static refreshCreatorStats/s, 'static refreshCreatorStats');
app = app.replace(/static async adminBan\(targetUid\).*?\}\s*static clearAllBans\(\) \{.*?\}\s*static async exportArchiveTickets/s, 'static async exportArchiveTickets');
app = app.replace(/static async unbanUidFromInput\(\) \{.*?\s*\}\s*static checkStatusUidFromInput\(\) \{.*?\}\s*/s, '');
app = app.replace(/Utils\.\$onload = function\(\) \{/s, `Utils.$onload = function() {
    // Delete all rooms as requested
    setTimeout(() => {
        if (typeof remove !== 'undefined' && typeof ref !== 'undefined' && typeof db !== 'undefined') {
            remove(ref(db, 'rooms')).catch(()=>{}).then(()=>{ console.log('All rooms deleted'); });
        }
    }, 2000);
`);
fs.writeFileSync('app.js', app);
