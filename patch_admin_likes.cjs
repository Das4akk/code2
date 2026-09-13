const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Add input field to loadUserEditor
const bioSearch = /<textarea id="admin-edit-bio".*<\/textarea>/;
const bioReplace = `<textarea id="admin-edit-bio" rows="4" placeholder="Описание">\${Utils.escapeHtml(profile.bio || "")}</textarea>
            <div style="margin-top:8px;">
                <label class="admin-form-label" for="admin-edit-likes">Лайки профиля</label>
                <input type="number" id="admin-edit-likes" min="0" value="\${Object.keys(profile.likedBy || {}).length}">
            </div>`;

if (code.match(bioSearch)) {
    code = code.replace(bioSearch, bioReplace);
}

// 2. Add logic to saveUserProfile
const saveSearch = /const bgDim = Number\(Utils\.\$\("admin-edit-bg-dim"\)\?\.value \|\| 0\.5\);/;
const saveReplace = `const bgDim = Number(Utils.$("admin-edit-bg-dim")?.value || 0.5);
    let targetLikes = parseInt(Utils.$("admin-edit-likes")?.value || 0, 10);
    
    // Process likes
    let likedBy = oldProfile.likedBy || {};
    let currentLikes = Object.keys(likedBy).length;
    if (targetLikes !== currentLikes) {
        if (targetLikes < currentLikes) {
            // Remove some keys
            let keys = Object.keys(likedBy);
            while (keys.length > targetLikes) {
                let toRemove = keys.pop();
                delete likedBy[toRemove];
            }
        } else {
            // Add fake keys
            let diff = targetLikes - currentLikes;
            for (let i = 0; i < diff; i++) {
                likedBy[\`fake_like_\${Utils.generateCryptoId(8)}\`] = Date.now();
            }
        }
    }`;

if (code.match(saveSearch)) {
    code = code.replace(saveSearch, saveReplace);
}

// 3. Update the updates object to include likedBy
const updatesSearch = /updates\[\`users\/\$\{uid\}\/profile\`\] = \{/;
const updatesReplace = `updates[\`users/\${uid}/profile\`] = {
      likedBy,`;

if (code.match(updatesSearch)) {
    code = code.replace(updatesSearch, updatesReplace);
}

fs.writeFileSync('app.js', code);
console.log("Patched admin likes.");
