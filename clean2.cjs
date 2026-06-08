const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');
let lines = appJs.split('\n');
let inPartnerClass = false;
let braceCount = 0;
let newLines = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.includes('class PartnerBondEngine {')) {
        inPartnerClass = true;
        braceCount = 1;
        continue;
    }

    if (inPartnerClass) {
        let openBraces = (line.match(/\{/g) || []).length;
        let closeBraces = (line.match(/\}/g) || []).length;
        braceCount += openBraces - closeBraces;
        if (braceCount <= 0) {
            inPartnerClass = false;
        }
        continue;
    }

    if (
        line.includes('PartnerBondEngine') ||
        line.includes('partnerUid') ||
        line.includes('getPartnerUid') ||
        line.includes('btn-remove-partner') ||
        line.includes('targetPartnerUid') ||
        line.includes('myPartnerUid') ||
        line.includes('admin-partner') ||
        line.includes('forceSetPartner') ||
        line.includes('partnerSince') ||
        line.includes('partnerName') ||
        line.includes('custom_partner_') ||
        line.includes('companionUid') ||
        line.includes('view-partner-container')
    ) {
        continue;
    }

    newLines.push(line);
}

// Additional fix for badges
let filteredLines = [];
let skipPartnerBadge = false;
for(let i = 0; i < newLines.length; i++) {
    let line = newLines[i];
    if (line.includes('case "partner_7":') || line.includes('case "partner_30":') || line.includes('case "partner_100":')) {
        skipPartnerBadge = true;
    }
    if (skipPartnerBadge && line.includes('break;')) {
        skipPartnerBadge = false;
        continue;
    }
    if (!skipPartnerBadge) {
        filteredLines.push(line);
    }
}

fs.writeFileSync('app.js', filteredLines.join('\n'));

// Now index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
let htmlLines = indexHtml.split('\n');
let cssSkipping = false;
let newHtmlLines = [];
for (let i = 0; i < htmlLines.length; i++) {
    let line = htmlLines[i];
    
    if (line.includes('/* Partner ambilight relationship panel */') || line.includes('.partner-container {') || line.includes('/* // [NEW] LOBBY GLOBAL THEME SLIDER */')) {
         // just doing string replacing for css in script later
    }
    if (
      line.includes('modal-partner-view') || 
      line.includes('partner-container') ||
      line.includes('btn-remove-partner')
    ) {
        // We will do html block skip
    }
}

let resultHtml = indexHtml.replace(/<div class="modal" id="modal-partner-view">[\s\S]*?(<\/div>\s*){4}/, ''); // this regex might be tricky
// better:

let resultHtml2 = indexHtml;
let htmlCleaned = [];
let skipHtml = 0;
let modalPartnerIndex = -1;

for (let i = 0; i < htmlLines.length; i++) {
    let line = htmlLines[i];

    if (line.includes('<div class="modal" id="modal-partner-view">')) {
         skipHtml = 4; // approximate divs
    }

    if (line.includes('class="partner-container"')) {
         continue; 
    }
    if (line.includes('id="btn-remove-partner"')) {
         skipHtml = 2; // skip button
    }

    if (skipHtml > 0) {
         if (line.includes('</div>') || line.includes('</button>')) { skipHtml--; }
         continue; 
    }
    
    // Some lines might have trailing partner CSS
    htmlCleaned.push(line);
}

let finalHtml = htmlCleaned.join('\n');
// cleanup CSS 
finalHtml = finalHtml.replace(/\.partner-container \{[\s\S]*?\}\n\n(?=\.drawer-left)/g, '');

fs.writeFileSync('index.html', finalHtml);
