const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

const startStr = 'if (Utils.$("nav-profile"))';
const endStr = 'if (Utils.$("nav-switch-account"))'; // wait, what comes after?
