const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Remove the pencil icon hack
html = html.replace(/\/\* Make action buttons float top left \*\/[\s\S]*?\/\* Clean up share\/settings buttons on mobile \*\//, '/* Removed pencil hack */\n');

// Make the Edit Profile button a normal button
// Let's modify app.js where it sets up the btn-dm-modal
let appJs = fs.readFileSync('app.js', 'utf-8');
appJs = appJs.replace(
  /actionBtn\.innerText = "Изменить профиль";\s*actionBtn\.className = "secondary-btn"; actionBtn\.style\.color = "#FFFFFF";\s*actionBtn\.style\.background = "rgba\(255, 255, 255, 0\.08\)";\s*actionBtn\.style\.border = "1px solid rgba\(255, 255, 255, 0\.12\)";/,
  `actionBtn.innerText = "Изменить профиль";
      actionBtn.className = "primary-btn";
      actionBtn.style.color = "#FFFFFF";
      actionBtn.style.background = "rgba(255, 255, 255, 0.1)";
      actionBtn.style.border = "none";
      actionBtn.style.padding = "6px 16px";
      actionBtn.style.fontSize = "14px";`
);
appJs = appJs.replace(
  /actionBtn\.className = "primary-btn";\s*actionBtn\.style\.background = "#FFFFFF"; actionBtn\.style\.color = "#000000";/,
  `actionBtn.className = "primary-btn";
      actionBtn.style.background = "#FFFFFF"; actionBtn.style.color = "#000000";
      actionBtn.style.padding = "6px 16px";
      actionBtn.style.fontSize = "14px";
      actionBtn.innerText = "Написать сообщение";`
);
fs.writeFileSync('app.js', appJs);

// Also remove `font-size: 0` if it's anywhere else.
fs.writeFileSync('index.html', html);
console.log("Fixed pencil to full button.");
