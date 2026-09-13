const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const navActiveSearch = /Utils\.\$\("section-find-friend"\)\.style\.display =\n\s*id === "nav-find-friend" \? "flex" : "none";/;
const navActiveReplace = `Utils.$("section-find-friend").style.display =
        id === "nav-find-friend" ? "flex" : "none";
      if (Utils.$("section-leaderboard"))
        Utils.$("section-leaderboard").style.display =
          id === "nav-leaderboard" ? "flex" : "none";`;

if (appJs.match(navActiveSearch)) {
    appJs = appJs.replace(navActiveSearch, navActiveReplace);
}

// Add loadLeaderboard function if not already in global scope or fix it
// Wait, we defined window.loadLeaderboard = async function() earlier. It should be fine.
const navItemSearch = /"nav-find-friend",\s*"nav-support"/;
const navItemReplace = `"nav-find-friend",\n    "nav-leaderboard",\n    "nav-support"`;

if (appJs.match(navItemSearch)) {
    appJs = appJs.replace(navItemSearch, navItemReplace);
}

fs.writeFileSync('app.js', appJs);
console.log("Fixed setNavActive for leaderboard.");
