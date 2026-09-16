const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/if \(\s*window\.PremiumManager &&\s*!PremiumManager\.canUseTheme\(card\.dataset\.theme, profile, uid\)\s*\) \{[\s\S]*?return;\s*\}/g, '');
js = js.replace(/!PremiumManager\.canUseTheme\(\s*card\.dataset\.theme,[\s\S]*?\)/g, 'false');

fs.writeFileSync('app.js', js);
