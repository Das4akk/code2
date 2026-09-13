const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const additionalCss = `
  /* PC & Mobile: Pull edit icon up into banner if it's the pencil */
  .tiktok-profile-container.has-banner .secondary-btn#btn-dm-modal {
     position: absolute !important;
     top: -45px !important;
     left: 20px !important;
     z-index: 10;
     background-color: rgba(0,0,0,0.5) !important; /* give it a dark circular background for visibility over any banner */
  }
`;

html = html.replace(
  /\/\* Reset container margin \*\//,
  additionalCss + '\n  /* Reset container margin */'
);

fs.writeFileSync('index.html', html);
console.log("Patched CSS for overlapping edit icon");
