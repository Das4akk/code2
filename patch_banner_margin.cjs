const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "block";/g,
  `Utils.$("profile-banner-wrapper").style.display = "block";
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.style.marginTop = "-60px";`
);

appJs = appJs.replace(
  /Utils\.\$\("profile-banner-wrapper"\)\.style\.display = "none";/g,
  `Utils.$("profile-banner-wrapper").style.display = "none";
            const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.style.marginTop = "0";`
);

fs.writeFileSync('app.js', appJs);
console.log("Patched banner margins");
