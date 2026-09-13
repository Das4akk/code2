const fs = require('fs');

// 1. App.js
let appJs = fs.readFileSync('app.js', 'utf8');
// Remove SoundpadController completely
appJs = appJs.replace(/window\.SoundpadController = class SoundpadController \{[\s\S]*?\};\n/g, '');
// Remove references
appJs = appJs.replace(/if\s*\(window\.SoundpadController\)\s*window\.SoundpadController\.loadPad\(\);/g, '');
appJs = appJs.replace(/if\s*\(window\.SoundpadController\)\s*window\.SoundpadController\.renderGrid\(\);/g, '');
// Remove tabs switching logic for soundpad
appJs = appJs.replace(/const rbSound = Utils\.\$\("tab-soundpad-btn"\);\n/g, '');
appJs = appJs.replace(/const rcSound = Utils\.\$\("soundpad-list"\);\n/g, '');
appJs = appJs.replace(/if\s*\(rbSound\)\s*rbSound\.onclick = \(\) => \{\n\s*rbChat\.classList\.remove\("active"\);\n\s*rbUsers\.classList\.remove\("active"\);\n\s*rbSound\.classList\.add\("active"\);\n\s*rcChat\.style\.display = "none";\n\s*rcUsers\.style\.display = "none";\n\s*rcSound\.style\.display = "block";\n\s*window\.SoundpadController\?\.loadPad\(\);\n\s*\};\n/g, '');
appJs = appJs.replace(/rbChat\.onclick = \(\) => \{\n\s*rbUsers\.classList\.remove\("active"\);\n\s*if\s*\(rbSound\)\s*rbSound\.classList\.remove\("active"\);\n\s*rbChat\.classList\.add\("active"\);\n\s*rcUsers\.style\.display = "none";\n\s*if\s*\(rcSound\)\s*rcSound\.style\.display = "none";\n\s*rcChat\.style\.display = "block";\n\s*\};\n/g, 'rbChat.onclick = () => {\n      rbUsers.classList.remove("active");\n      rbChat.classList.add("active");\n      rcUsers.style.display = "none";\n      rcChat.style.display = "block";\n    };\n');
appJs = appJs.replace(/rbUsers\.onclick = \(\) => \{\n\s*rbChat\.classList\.remove\("active"\);\n\s*if\s*\(rbSound\)\s*rbSound\.classList\.remove\("active"\);\n\s*rbUsers\.classList\.add\("active"\);\n\s*rcChat\.style\.display = "none";\n\s*if\s*\(rcSound\)\s*rcSound\.style\.display = "none";\n\s*rcUsers\.style\.display = "block";\n\s*\};\n/g, 'rbUsers.onclick = () => {\n      rbChat.classList.remove("active");\n      rbUsers.classList.add("active");\n      rcChat.style.display = "none";\n      rcUsers.style.display = "block";\n    };\n');
appJs = appJs.replace(/const soundpadBtn = Utils\.\$\("tab-soundpad-btn"\);\n\s*if\s*\(soundpadBtn\)\s*\{\n\s*soundpadBtn\.style\.display = isHost \? "flex" : "none";\n\s*if\s*\(!isHost\)\s*\{\n\s*const spList = Utils\.\$\("soundpad-list"\);\n\s*if\s*\(spList && spList\.style\.display !== "none"\)\s*rbChat\.click\(\);\n\s*\}\n\s*\}/g, '');

fs.writeFileSync('app.js', appJs);

// 2. index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(/<button id="tab-soundpad-btn">[\s\S]*?<\/button>\n/g, '');
indexHtml = indexHtml.replace(/<div class="chat-content-area" id="soundpad-list"[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/div>/g, '</div>\n          </div>');

fs.writeFileSync('index.html', indexHtml);

console.log("Custom sounds removed.");
