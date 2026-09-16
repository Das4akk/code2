const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const drawStart = js.indexOf('// Watch Party Draw System');
if (drawStart !== -1) {
    const drawEnd = js.indexOf('// Setup copy link button', drawStart);
    if (drawEnd !== -1) {
        js = js.substring(0, drawStart) + js.substring(drawEnd);
        fs.writeFileSync('app.js', js);
        console.log("Removed draw system");
    }
}
