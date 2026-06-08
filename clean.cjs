const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// Remove PartnerBondEngine completely
// It starts with class PartnerBondEngine { and ends before class NotificationUI or similar
appJs = appJs.replace(/class PartnerBondEngine \{[\s\S]*?\n\}\n(?=class |function |\/\*\*)/g, '');

// Also remove usages and partner elements from DOM
appJs = appJs.replace(/await PartnerBondEngine\.[A-Za-z]+\(.*?\);/g, '');
appJs = appJs.replace(/let bond = await PartnerBondEngine\.getBond\(.*?\);/g, '');
appJs = appJs.replace(/const trailDays = PartnerBondEngine\..*?\);/g, '');
appJs = appJs.replace(/const level = PartnerBondEngine\..*?\);/g, '');
appJs = appJs.replace(/const levelPct = PartnerBondEngine\..*?\);/g, '');
appJs = appJs.replace(/const canCheckin = PartnerBondEngine\..*?\);/g, '');
appJs = appJs.replace(/const lvl = PartnerBondEngine\..*?\);/g, '');
appJs = appJs.replace(/const bond = await PartnerBondEngine\.getBond\([^)]+\);/g, '');

// Let's remove partner badges:
// case "partner_7": ... case "partner_100":
appJs = appJs.replace(/case "partner_7":[\s\S]*?(?=case "pioneer":)/, '');
appJs = appJs.replace(/case "partner_30":[\s\S]*?(?=case "partner_100":|case "pioneer":)/, '');
appJs = appJs.replace(/case "partner_100":[\s\S]*?(?=case "pioneer":)/, '');

// Also we should remove `.partnerUid` definitions...
appJs = appJs.replace(/partnerUid:.*?\,/g, '');
appJs = appJs.replace(/targetPartnerUid/g, 'null');
appJs = appJs.replace(/myPartnerUid/g, 'null');
appJs = appJs.replace(/partnerUid/g, 'null');
appJs = appJs.replace(/this\.forceSetPartner\(uid\)/g, '{}');

fs.writeFileSync('app.js.cleaned', appJs);

let indexHtml = fs.readFileSync('index.html', 'utf8');
// remove modal-partner-view
indexHtml = indexHtml.replace(/<div class="modal" id="modal-partner-view">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');
// remove partner-container
indexHtml = indexHtml.replace(/<div class="partner-container" id="\w+-partner-container"><\/div>/g, '');
indexHtml = indexHtml.replace(/<button class="primary-btn"\s*id="btn-remove-partner"\s*style="display:none; margin-top:8px;"\s*>\s*<i data-lucide="heart-off"><\/i>\s*Разорвать отношения\s*<\/button>/g, '');

// Remove all CSS blocks for partner
indexHtml = indexHtml.replace(/\/\* Partner ambilight relationship panel \*\/[\s\S]*?\.partner-ambilight-footer \.secondary-btn \{[\s\S]*?\}/g, '');
indexHtml = indexHtml.replace(/\.partner-container \{[\s\S]*?(?=\.drawer-left |\.inventory |\Z)/g, '');

fs.writeFileSync('index.html.cleaned', indexHtml);
