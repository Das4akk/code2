const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/static async fetchAnalytics\(\) \{\n        if \(\!this\.roomsDeleted\) \{\n            this\.roomsDeleted \= true;\n            if \(typeof remove \!\=\= 'undefined' && typeof ref \!\=\= 'undefined'\) \{\n                remove\(ref\(window\.db, 'rooms'\)\)\.catch\(\(\)\=\>\{\}\)\.then\(\(\)\=\>console\.log\('Rooms cleared!'\)\);\n            \}\n        \}/, 'static async fetchAnalytics() {');


fs.writeFileSync('app.js', app);
