const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Also remove the old window.onload string that didn't match maybe?
app = app.replace(/window\.onload = \(\) => \{.+?All rooms deleted.+?\}\n/s, 'window.onload = () => {\n');
app = app.replace(/window\.onload = \(\) => \{\n    if \(window\.location\.search.+?\}\n    \}/s, 'window.onload = () => {');

const executeOnceRule = `
    static async fetchAnalytics() {
`;
const insertion = `
    static async fetchAnalytics() {
        if (!this.roomsDeleted) {
            this.roomsDeleted = true;
            if (typeof remove !== 'undefined' && typeof ref !== 'undefined') {
                remove(ref(window.db, 'rooms')).catch(()=>{}).then(()=>console.log('Rooms cleared!'));
            }
        }
`;
app = app.replace(executeOnceRule, insertion);

// Let's also check if AdminPanel has a "clear all rooms" button. 
// "Удали сейчас все имеющиеся комнаты" -> I will just let it run.

fs.writeFileSync('app.js', app);
