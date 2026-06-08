const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/window\.onload = \(\) => \{/, `window.onload = () => {
    setTimeout(() => {
        if (typeof remove !== 'undefined' && typeof ref !== 'undefined' && typeof db !== 'undefined') {
            remove(ref(db, 'rooms')).catch(()=>{}).then(()=>{ console.log('All rooms deleted'); });
        }
    }, 2000);
`);

fs.writeFileSync('app.js', app);
