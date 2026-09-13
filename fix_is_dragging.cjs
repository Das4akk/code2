const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const touchLogicSearch = /trackElem\.addEventListener\("touchend", \(e\) => {/;
const touchLogicReplace = `trackElem.addEventListener("touchend", (e) => {
            setTimeout(() => { window.isDraggingBadge = false; }, 50);`;

if (code.match(touchLogicSearch)) {
    code = code.replace(touchLogicSearch, touchLogicReplace);
}

// In the onclick, we can just check but not reset, because touchend will reset it anyway.
// But it's fine if onclick resets it too. If onclick fires after touchend, the setTimeout might not have fired yet.

fs.writeFileSync('app.js', code);
console.log("Fixed isDraggingBadge reset.");
