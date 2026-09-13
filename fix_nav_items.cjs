const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const navItemSearch2 = /"nav-find-friend",\s*"nav-catalog",/;
const navItemReplace2 = `"nav-find-friend",\n      "nav-leaderboard",\n      "nav-catalog",`;

if (appJs.match(navItemSearch2)) {
    appJs = appJs.replace(navItemSearch2, navItemReplace2);
}

fs.writeFileSync('app.js', appJs);
console.log("Fixed navItems array.");
