const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// Add section-settings display logic
const oldSwitch = 'Utils.$("section-shop").style.display =\n          id === "nav-shop" ? "flex" : "none";';
const newSwitch = oldSwitch + '\n      if (Utils.$("section-settings"))\n        Utils.$("section-settings").style.display =\n          id === "nav-settings" ? "flex" : "none";';
appJs = appJs.replace(oldSwitch, newSwitch);

const oldClick = 'if (Utils.$("nav-catalog"))\n      Utils.$("nav-catalog").onclick = () => setNavActive("nav-catalog");';
const newClick = oldClick + '\n    if (Utils.$("nav-settings"))\n      Utils.$("nav-settings").onclick = () => setNavActive("nav-settings");';
appJs = appJs.replace(oldClick, newClick);

// Replace button btn-open-security to go to settings
const btnSecRegex = /Utils\.\$\("btn-open-security"\)\.onclick = \(\) => this\.openSecurityModal\(\);/g;
appJs = appJs.replace(btnSecRegex, 'Utils.$("btn-open-security").onclick = () => { Utils.$("modal-edit-profile").classList.remove("active"); document.getElementById("nav-settings").click(); };');

// Also modal-security logic remove openSecurityModal? We don't have to remove the function definition, just ensuring no calls crash.
// Let's replace the whole openSecurityModal with nav-settings just in case.
const funcSec = /static openSecurityModal\(\) \{[\s\S]*?Utils\.\$\("modal-security"\)\.classList\.add\("active"\);\n  \}/;
appJs = appJs.replace(funcSec, 'static openSecurityModal() { document.getElementById("nav-settings").click(); }');

fs.writeFileSync('app.js', appJs);
console.log('patched app.js');
