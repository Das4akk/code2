const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/if \(tabTitle\) tabTitle\.innerText = name === "chat" \? "Чат" : "Участники";/,
`if (tabTitle) tabTitle.innerText = name === "chat" ? "Чат" : "Участники";
      const countEl = Utils.$("users-count");
      if (countEl) countEl.style.display = name === "users" ? "inline-block" : "none";`);

fs.writeFileSync('app.js', js);
