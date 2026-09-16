const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const regex = /authorNameEl\.style\.textDecoration = "underline";[\s\S]*?authorNameEl\.style\.textUnderlineOffset = "4px";/;
js = js.replace(regex, ''); // Remove underline

// Wait, we need to get the user's equipped frame to display it on the author avatar!
// Let's modify the author render code entirely.
const oldRenderHost = `function renderHost(name, photo) {
            authorNameEl.innerText = Utils.escapeHtml(name);
            authorNameEl.style.textDecoration = "underline";
            authorNameEl.style.textUnderlineOffset = "4px";
            if (photo) {
                authorAvatarEl.innerHTML = \`<img src="\${Utils.escapeHtml(photo)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">\`;
            } else {
                authorAvatarEl.innerHTML = \`<div style="width:100%; height:100%; background: #555; border-radius: 50%;"></div>\`;
            }
        }`;

const newRenderHost = `function renderHost(name, photo, pData = {}) {
            authorNameEl.innerText = Utils.escapeHtml(name);
            authorNameEl.style.textDecoration = "none";
            let frameHtml = "";
            if (pData.equippedFrame) {
                let frameUrl = pData.equippedFrame;
                if (!frameUrl.startsWith("http")) frameUrl = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Military%20Medal.webp"; // fallback or resolve real url if we could, but let's just use the URL if it is one, or assume it's resolved elsewhere. Actually, in this app, equippedFrame usually contains the full URL or we can use ProfileManager.getAvatarHtml(pData). Let's use ProfileManager!
            }
            // Better yet, use ProfileManager.getAvatarHtml!
            authorAvatarEl.innerHTML = (typeof ProfileManager !== "undefined" && ProfileManager.getAvatarHtml) ? ProfileManager.getAvatarHtml(pData) : (photo ? \`<img src="\${Utils.escapeHtml(photo)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">\` : \`<div style="width:100%; height:100%; background: #555; border-radius: 50%;"></div>\`);
        }`;

// Wait, the previous block where we get profile data:
const oldProfileBlock = `get(ref(getDatabase(), \`users/\${roomData.hostId}/profile\`)).then(snap => {
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
            });`;

const newProfileBlock = `get(ref(getDatabase(), \`users/\${roomData.hostId}/profile\`)).then(snap => {
                let name = "Неизвестно";
                let photo = "";
                let pData = {};
                if (snap.exists()) {
                    const p = snap.val();
                    name = p.name || p.username || "Неизвестно";
                    photo = p.photoURL || p.avatar || "";
                    pData = p;
                } else {
                    // Fallback to top level
                    get(ref(getDatabase(), \`users/\${roomData.hostId}\`)).then(snap2 => {
                        if (snap2.exists()) {
                            const p2 = snap2.val();
                            name = p2.name || p2.username || "Неизвестно";
                            photo = p2.photoURL || p2.avatar || "";
                            pData = p2;
                        }
                        renderHost(name, photo, pData);
                    });
                    return;
                }
                renderHost(name, photo, pData);
            });`;

js = js.replace(oldRenderHost, newRenderHost);
js = js.replace(oldProfileBlock, newProfileBlock);
fs.writeFileSync('app.js', js);
