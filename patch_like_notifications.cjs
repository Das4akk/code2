const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Notification for liking someone
const likeBtnSearch = /await set\(likedRef, Date\.now\(\)\);/g;
const likeBtnReplace = `await set(likedRef, Date.now());\n                Utils.toast(\`Вы поставили лайк пользователю \${profile.name || "Пользователь"}\`, "success");`;

if (code.match(likeBtnSearch)) {
    code = code.replace(likeBtnSearch, likeBtnReplace);
}

// 2. Notification for receiving a like when online
const initSearch = /AppState\.currentUser = user;\n\s*const savedAccounts = JSON\.parse\(/;
const initReplace = `AppState.currentUser = user;
          
          // --- Like Notifications ---
          let initialLikesLoad = true;
          import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ onChildAdded, ref, get, getDatabase }) => {
              const dbase = getDatabase();
              onChildAdded(ref(dbase, \`users/\${user.uid}/profile/likedBy\`), (snap) => {
                  if (initialLikesLoad) return;
                  const likerUid = snap.key;
                  get(ref(dbase, \`users/\${likerUid}/profile/name\`)).then(nameSnap => {
                      const likerName = nameSnap.val() || "Кто-то";
                      get(ref(dbase, \`users/\${user.uid}/profile/likedBy\`)).then(likesSnap => {
                          const count = likesSnap.exists() ? Object.keys(likesSnap.val()).length : 1;
                          Utils.toast(\`Вы получили лайк от \${likerName} - теперь у вас \${count} лайков в профиле\`, "info");
                      });
                  });
              });
              setTimeout(() => initialLikesLoad = false, 3000);
          });
          // --------------------------
          
          const savedAccounts = JSON.parse(`;

if (code.match(initSearch)) {
    code = code.replace(initSearch, initReplace);
}

fs.writeFileSync('app.js', code);
console.log("Patched notifications.");
