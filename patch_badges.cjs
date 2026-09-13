const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const touchLogicSearch = /trackElem\.addEventListener\(\s*"touchstart",\s*\(e\) => {\s*badgeStartX = e\.touches\[0\]\.clientX;\s*},\s*\{ passive: true \},\s*\);/;

const touchLogicReplace = `trackElem.addEventListener(
            "touchstart",
            (e) => {
              badgeStartX = e.touches[0].clientX;
              window.isDraggingBadge = false;
            },
            { passive: true },
          );
          trackElem.addEventListener("touchmove", () => {
              window.isDraggingBadge = true;
          }, { passive: true });`;

if (code.match(touchLogicSearch)) {
    code = code.replace(touchLogicSearch, touchLogicReplace);
}

const onclickSearch = /card\.onclick = \(\) => {\s*window\.ProfileBadgesState\.index = i;\s*updateBadgeCarousel\(\);\s*};/;
const onclickReplace = `card.onclick = () => {
            if (window.isDraggingBadge) {
                window.isDraggingBadge = false;
                return;
            }
            window.ProfileBadgesState.index = i;
            updateBadgeCarousel();
          };`;

if (code.match(onclickSearch)) {
    code = code.replace(onclickSearch, onclickReplace);
}

fs.writeFileSync('app.js', code);
console.log("Patched badges.");
