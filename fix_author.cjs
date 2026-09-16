const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const oldAuthorCode = `    const authorNameEl = Utils.$("room-author-name");
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
    }`;

const newAuthorCode = `    const authorNameEl = Utils.$("room-author-name");
    const authorAvatarEl = Utils.$("room-author-avatar");
    if (authorNameEl && authorAvatarEl) {
        // Reset and add pointer cursor
        authorNameEl.style.cursor = "pointer";
        authorAvatarEl.style.cursor = "pointer";
        const openHostProfile = () => {
            if (typeof window.showProfileModal === "function") window.showProfileModal(roomData.hostId);
            else if (window.ProfileManager) ProfileManager.showProfile(roomData.hostId);
        };
        authorNameEl.onclick = openHostProfile;
        authorAvatarEl.onclick = openHostProfile;

        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => {
            // First check profile, then fallback
            get(ref(getDatabase(), \`users/\${roomData.hostId}/profile\`)).then(snap => {
                let name = "Неизвестно";
                let photo = "";
                if (snap.exists()) {
                    const p = snap.val();
                    name = p.name || p.username || "Неизвестно";
                    photo = p.photoURL || p.avatar || "";
                } else {
                    // Fallback to top level
                    get(ref(getDatabase(), \`users/\${roomData.hostId}\`)).then(snap2 => {
                        if (snap2.exists()) {
                            const p2 = snap2.val();
                            name = p2.name || p2.username || "Неизвестно";
                            photo = p2.photoURL || p2.avatar || "";
                        }
                        renderHost(name, photo);
                    });
                    return;
                }
                renderHost(name, photo);
            });
        });
        
        function renderHost(name, photo) {
            authorNameEl.innerText = Utils.escapeHtml(name);
            authorNameEl.style.textDecoration = "underline";
            authorNameEl.style.textUnderlineOffset = "4px";
            if (photo) {
                authorAvatarEl.innerHTML = \`<img src="\${Utils.escapeHtml(photo)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">\`;
            } else {
                authorAvatarEl.innerHTML = \`<div style="width:100%; height:100%; background: #555; border-radius: 50%;"></div>\`;
            }
        }
    }`;

js = js.replace(oldAuthorCode, newAuthorCode);
fs.writeFileSync('app.js', js);
