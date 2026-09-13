const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

// Replace the WHOLE nav-profile block
const searchBlockRegex = /if \(Utils\.\$\("nav-profile"\)\)\s*Utils\.\$\("nav-profile"\)\.onclick = async \(\) => \{[\s\S]*?Utils\.\$\("my-profile-container"\)\.innerHTML\s*=\s*`[\s\S]*?`;\s*\}\s*\};/;

const replaceBlock = `
    if (Utils.$("lobby-app-bar-profile")) {
      Utils.$("lobby-app-bar-profile").onclick = () => {
         const uid = AppState.currentUser?.uid;
         if (uid) ProfileManager.openViewProfileModal(uid);
      };
    }
    if (Utils.$("nav-profile")) {
      Utils.$("nav-profile").onclick = () => {
         const uid = AppState.currentUser?.uid;
         if (uid) {
             ProfileManager.openViewProfileModal(uid);
         }
      };
    }
`;

if (searchBlockRegex.test(appJs)) {
    appJs = appJs.replace(searchBlockRegex, replaceBlock);
    fs.writeFileSync('app.js', appJs);
    console.log("Successfully replaced nav-profile block!");
} else {
    console.log("Regex still didn't match. Printing what was matched:");
    // Let's just find the index
    const start = appJs.indexOf('if (Utils.$("nav-profile"))');
    console.log("Found at index:", start);
    
    // Manual slicing if needed
    if (start !== -1) {
        const endStr = 'Utils.$("section-switch-account").style.display'; // This comes shortly after
        const nextBlock = appJs.indexOf(endStr, start);
        if (nextBlock !== -1) {
           const before = appJs.substring(0, start);
           // Find the closing brace of the if block
           // Actually, the next block is:
           //       Utils.$("section-switch-account").style.display =
           //         id === "nav-switch-account" ? "flex" : "none";
           // Wait, no. That is in `setNavActive`. 
           // Let's look at what comes after `nav-profile` onclick...
        }
    }
}

