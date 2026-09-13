const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const properCss = `
  /* FULL WIDTH PROFILE FIX */
  #section-profile {
     padding: 0 !important;
     width: 100% !important;
     height: 100% !important;
     max-width: none !important;
     max-height: none !important;
     border-radius: 0 !important;
     border: none !important;
     background: transparent !important;
  }
  .tiktok-profile-container {
     width: 100% !important;
     max-width: none !important;
     padding: 40px 60px !important;
     margin: 0 !important;
  }
  @media (max-width: 768px) {
     .tiktok-profile-container {
        padding: 20px !important;
     }
  }
`;

html = html.replace('</style>', properCss + '\n</style>');
fs.writeFileSync('index.html', html);
console.log("Injected final CSS!");
