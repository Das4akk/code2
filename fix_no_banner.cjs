const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /if \(profile\.bannerUrl\) \{\s*Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "block";\s*Utils\.\$\("profile-banner-img"\)\.src = profile\.bannerUrl;\s*Utils\.\$\("profile-banner-overlay"\)\.style\.background = \`rgba\(0,0,0,\\\$\{\(profile\.bannerDimming !== undefined \? profile\.bannerDimming : 30\) \/ 100\}\)\`;\s*\} else \{\s*Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "none";\s*const profContainer = vModal\.querySelector\("\.tiktok-profile-container"\);\s*if \(profContainer\) profContainer\.classList\.remove\("has-banner"\);\s*\}/,
  `if (profile.bannerUrl) {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "block";
            Utils.$("profile-banner-img").src = profile.bannerUrl;
            Utils.$("profile-banner-wrapper").style.background = "transparent";
            Utils.$("profile-banner-overlay").style.background = \`rgba(0,0,0,\${(profile.bannerDimming !== undefined ? profile.bannerDimming : 30) / 100})\`;
         } else {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "none";
            Utils.$("profile-banner-img").src = "";
            Utils.$("profile-banner-wrapper").style.background = profile.background || "var(--panel-hover)";
            Utils.$("profile-banner-overlay").style.background = "rgba(0,0,0,0.3)";
         }`
);

// We also need to fix loadedProfile section (it uses loadedProfile instead of profile)
appJs = appJs.replace(
  /if \(loadedProfile\.bannerUrl\) \{\s*Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "block";\s*Utils\.\$\("profile-banner-img"\)\.src = loadedProfile\.bannerUrl;\s*Utils\.\$\("profile-banner-overlay"\)\.style\.background = \`rgba\(0,0,0,\\\$\{\(loadedProfile\.bannerDimming !== undefined \? loadedProfile\.bannerDimming : 30\) \/ 100\}\)\`;\s*\} else \{\s*Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "none";\s*const profContainer = vModal\.querySelector\("\.tiktok-profile-container"\);\s*if \(profContainer\) profContainer\.classList\.remove\("has-banner"\);\s*\}/,
  `if (loadedProfile.bannerUrl) {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "block";
            Utils.$("profile-banner-img").src = loadedProfile.bannerUrl;
            Utils.$("profile-banner-wrapper").style.background = "transparent";
            Utils.$("profile-banner-overlay").style.background = \`rgba(0,0,0,\${(loadedProfile.bannerDimming !== undefined ? loadedProfile.bannerDimming : 30) / 100})\`;
         } else {
            Utils.$("profile-banner-wrapper").style.display = "block";
            Utils.$("profile-banner-img").style.display = "none";
            Utils.$("profile-banner-img").src = "";
            Utils.$("profile-banner-wrapper").style.background = loadedProfile.background || "var(--panel-hover)";
            Utils.$("profile-banner-overlay").style.background = "rgba(0,0,0,0.3)";
         }`
);

fs.writeFileSync('app.js', appJs);
console.log("Fixed no-banner fallback.");
