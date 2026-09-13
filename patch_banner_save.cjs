const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /avatar,\s*background,\s*gender,\s*frame,\s*\}/,
  'avatar,\n      background,\n      gender,\n      frame,\n      bannerUrl,\n      bannerDimming,\n    }'
);

fs.writeFileSync('app.js', appJs);
console.log("Patched banner save object");
