const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Remove inline padding from section-profile and add it to css
html = html.replace(
  /<main class="rooms-main" id="section-profile" style="display: none; overflow-y: auto !important; align-items: center; padding: 40px 20px;">/,
  '<main class="rooms-main" id="section-profile" style="display: none; overflow-y: auto !important; align-items: center;">'
);

const cssToAdd = `
  #section-profile {
     padding: 40px 20px !important;
  }
  @media (max-width: 768px) {
     #section-profile {
        padding: 0 !important;
     }
  }
`;

html = html.replace('</style>', cssToAdd + '\\n</style>');

fs.writeFileSync('index.html', html);
