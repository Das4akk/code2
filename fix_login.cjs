const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/const email = Utils\.\$\("login-email"\)\.value\.trim\(\);/, `let email = Utils.$("login-email").value.trim();
      if (email && !email.includes("@")) {
          const cleanName = email.replace("@", "").toLowerCase();
          try {
              const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => get(ref(getDatabase(), \`usernames/\${cleanName}\`)));
              if (snap.exists()) {
                  const uid = snap.val();
                  const profileSnap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => get(ref(getDatabase(), \`users/\${uid}/profile/email\`)));
                  if (profileSnap.exists()) {
                      email = profileSnap.val();
                  }
              }
          } catch(e) {
             console.log("Could not resolve username to email", e);
          }
      }`);

fs.writeFileSync('app.js', code);
