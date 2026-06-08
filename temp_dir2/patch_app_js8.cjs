const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/window\.onload = \(\) => \{\n    setTimeout\(\(\) => \{\n        if \(typeof remove !== 'undefined' && typeof ref !== 'undefined' && typeof db !== 'undefined'\) \{\n            remove\(ref\(db, 'rooms'\)\)\.catch\(\(\)=>{}\)\.then\(\(\)=>{ console\.log\('All rooms deleted'\); \}\);\n        \}\n    \}, 2000\);/s, `window.onload = () => {
    if (window.location.search.includes('delete_rooms=1')) {
        setTimeout(() => {
            if (typeof remove !== 'undefined' && typeof ref !== 'undefined' && typeof db !== 'undefined') {
                remove(ref(db, 'rooms')).catch(()=>{}).then(()=>{ alert('Все комнаты удалены'); window.location.search = ''; });
            }
        }, 1000);
    }`);

fs.writeFileSync('app.js', app);
