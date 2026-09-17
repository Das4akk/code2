const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/AppState\.currentUser = user;/, `AppState.currentUser = user;
          
          import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ ref, get, remove, getDatabase }) => {
              const dbase = getDatabase();
              get(ref(dbase, \`users/\${user.uid}/force_tutorial\`)).then(snap => {
                  if (snap.exists() && snap.val() === true) {
                      TutorialManager.startTutorial(true);
                      remove(ref(dbase, \`users/\${user.uid}/force_tutorial\`));
                  }
              });
          });`);
          
fs.writeFileSync('app.js', code);
