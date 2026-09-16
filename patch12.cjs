const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/Utils\.\$\("room-title-text"\)\.innerText = Utils\.escapeHtml\([\s\S]*?\);/,
`
    Utils.$("room-title-text").innerText = Utils.escapeHtml(\`\${roomData.name}\${roomTag}\`);
    
    // Set author info
    const authorNameEl = Utils.$("room-author-name");
    const authorAvatarEl = Utils.$("room-author-avatar");
    if (authorNameEl && authorAvatarEl) {
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => {
            get(ref(getDatabase(), \`users/\${roomData.hostId}\`)).then(snap => {
                if (snap.exists()) {
                    const hostUser = snap.val();
                    authorNameEl.innerText = Utils.escapeHtml(hostUser.username || "неизвестно");
                    if (hostUser.photoURL) {
                        authorAvatarEl.innerHTML = \`<img src="\${Utils.escapeHtml(hostUser.photoURL)}" style="width: 100%; height: 100%; object-fit: cover;">\`;
                    } else {
                        authorAvatarEl.innerHTML = \`<div style="width:100%; height:100%; background: #333;"></div>\`;
                    }
                }
            });
        });
    }
`);

fs.writeFileSync('app.js', js);
