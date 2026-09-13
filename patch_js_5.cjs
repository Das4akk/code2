const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /actionBtn\.style\.background = "#EA284E";/,
  'actionBtn.style.background = "#FFFFFF"; actionBtn.style.color = "#000000";'
);

// We should also make sure actionBtn style resets color for current user (which uses secondary-btn) if needed.
// Wait, for current user it's:
// actionBtn.style.background = "rgba(255, 255, 255, 0.08)";
// actionBtn.style.border = "1px solid rgba(255, 255, 255, 0.12)";
appJs = appJs.replace(
  /actionBtn\.className = "secondary-btn";/,
  'actionBtn.className = "secondary-btn"; actionBtn.style.color = "#FFFFFF";'
);

fs.writeFileSync('app.js', appJs);
console.log("Patched button styling in app.js");
