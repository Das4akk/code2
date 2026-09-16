const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/if \(rcUsers\) rcUsers\.style\.display = name === "users" \? "flex" : "none";/, 
`if (rcUsers) rcUsers.style.display = name === "users" ? "flex" : "none";
      const inputArea = document.querySelector(".chat-input-area");
      if (inputArea) inputArea.style.display = name === "chat" ? "flex" : "none";`);

fs.writeFileSync('app.js', js);
