const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /if \(profile\.bannerUrl\) \{[\s\S]*?\} else \{[\s\S]*?\}/,
  `if (profile.bannerUrl) {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "block";
            Utils.$("profile-banner-img").src = profile.bannerUrl;
            Utils.$("profile-banner-wrapper").style.background = "transparent";
            Utils.$("profile-banner-overlay").style.background = \`rgba(0,0,0,\${(profile.bannerDimming !== undefined ? profile.bannerDimming : 30) / 100})\`;
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.add("has-banner");
         } else {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "none";
            Utils.$("profile-banner-img").src = "";
            Utils.$("profile-banner-wrapper").style.background = profile.background || "var(--panel-hover)";
            Utils.$("profile-banner-overlay").style.background = "rgba(0,0,0,0.3)";
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.add("has-banner"); // always add now
         }`
);

// We need to replace it again for loadedProfile
appJs = appJs.replace(
  /if \(loadedProfile\.bannerUrl\) \{[\s\S]*?\} else \{[\s\S]*?\}/,
  `if (loadedProfile.bannerUrl) {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "block";
            Utils.$("profile-banner-img").src = loadedProfile.bannerUrl;
            Utils.$("profile-banner-wrapper").style.background = "transparent";
            Utils.$("profile-banner-overlay").style.background = \`rgba(0,0,0,\${(loadedProfile.bannerDimming !== undefined ? loadedProfile.bannerDimming : 30) / 100})\`;
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.add("has-banner");
         } else {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "none";
            Utils.$("profile-banner-img").src = "";
            Utils.$("profile-banner-wrapper").style.background = loadedProfile.background || "var(--panel-hover)";
            Utils.$("profile-banner-overlay").style.background = "rgba(0,0,0,0.3)";
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.add("has-banner"); // always add now
         }`
);

fs.writeFileSync('app.js', appJs);
console.log("Fixed app.js banner replacement.");
