const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Replace the bad #section-profile styles
html = html.replace(/#section-profile \{[\s\S]*?text-align:\s*left;\s*\}/, '');
// Wait, regex might be tricky if text-align is missing. Let's just find the string block.
