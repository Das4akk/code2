const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Overwrite the has-banner CSS
const newHasBannerCSS = `
  /* Banner Aspect Ratio */
  #profile-banner-wrapper {
     height: auto !important;
     aspect-ratio: 21 / 6;
     min-height: 120px;
     max-height: 250px;
  }
  
  /* Reset container margin */
  .tiktok-profile-container.has-banner {
     margin-top: 0;
  }
  
  /* PC: Pull avatar up into banner */
  .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
     margin-top: -60px;
  }
  
  /* Mobile: adjust absolute avatar and text padding */
  @media (max-width: 768px) {
     .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
        margin-top: 0;
        top: -45px !important;
     }
     
     /* Only on mobile, we can push the text back up slightly if needed, but it's fine by default */
  }
`;

html = html.replace(
  /\.tiktok-profile-container\.has-banner \{[\s\S]*?\}\s*\}\s*<\/style>/,
  newHasBannerCSS + '\n</style>'
);

fs.writeFileSync('index.html', html);
console.log("Patched CSS for overlapping avatar only");
