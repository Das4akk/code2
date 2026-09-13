const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  'Utils.$("edit-avatar-url").value = p.avatar || "";',
  `Utils.$("edit-avatar-url").value = p.avatar || "";
    Utils.$("edit-banner-url").value = p.bannerUrl || "";
    Utils.$("edit-banner-dimming").value = p.bannerDimming !== undefined ? p.bannerDimming : 30;
    if (Utils.$("banner-dimming-val")) Utils.$("banner-dimming-val").innerText = (p.bannerDimming !== undefined ? p.bannerDimming : 30) + "%";`
);

// File input and range listeners
const listeners = `
    if (Utils.$("edit-banner-file")) {
      Utils.$("edit-banner-file").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const b64 = await Utils.fileToBase64(file, 800);
          Utils.$("edit-banner-url").value = b64;
        }
      };
    }
    if (Utils.$("edit-banner-dimming")) {
      Utils.$("edit-banner-dimming").oninput = (e) => {
        if (Utils.$("banner-dimming-val")) Utils.$("banner-dimming-val").innerText = e.target.value + "%";
      };
    }
`;

appJs = appJs.replace(
  /if \(Utils\.\$\("edit-avatar-file"\)\) \{/,
  listeners + '\n    if (Utils.$("edit-avatar-file")) {'
);

// Save logic
appJs = appJs.replace(
  'const avatar = Utils.$("edit-avatar-url").value.trim();',
  'const avatar = Utils.$("edit-avatar-url").value.trim();\n    const bannerUrl = Utils.$("edit-banner-url") ? Utils.$("edit-banner-url").value.trim() : "";\n    const bannerDimming = Utils.$("edit-banner-dimming") ? parseInt(Utils.$("edit-banner-dimming").value, 10) : 30;'
);

appJs = appJs.replace(
  'updates[`users/${myUid}/profile/avatar`] = avatar;',
  'updates[`users/${myUid}/profile/avatar`] = avatar;\n      updates[`users/${myUid}/profile/bannerUrl`] = bannerUrl;\n      updates[`users/${myUid}/profile/bannerDimming`] = bannerDimming;'
);

fs.writeFileSync('app.js', appJs);
console.log("Patched Edit Modal inputs and Save logic");
