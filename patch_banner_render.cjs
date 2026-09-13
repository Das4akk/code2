const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

const bannerLogic = `
      if (Utils.$("profile-banner-wrapper")) {
         if (profile.bannerUrl) {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").src = profile.bannerUrl;
            Utils.$("profile-banner-overlay").style.background = \`rgba(0,0,0,\${(profile.bannerDimming !== undefined ? profile.bannerDimming : 30) / 100})\`;
         } else {
            Utils.$("profile-banner-wrapper").style.display = "none";
         }
      }
`;

// Insert after applyProfileBackground for cached profile load
appJs = appJs.replace(
  'this.applyProfileBackground(vModal.querySelector(".tiktok-profile-container") || vModal, profile.background);',
  'this.applyProfileBackground(vModal.querySelector(".tiktok-profile-container") || vModal, profile.background);\n' + bannerLogic
);

// Insert after applyProfileBackground for fresh profile load
appJs = appJs.replace(
  'this.applyProfileBackground(vModal.querySelector(".tiktok-profile-container") || vModal, loadedProfile.background);',
  'this.applyProfileBackground(vModal.querySelector(".tiktok-profile-container") || vModal, loadedProfile.background);\n' + bannerLogic.replace(/profile\./g, 'loadedProfile.')
);

fs.writeFileSync('app.js', appJs);
console.log("Patched banner rendering in openViewProfileModal");
