const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace('</style>', `
  @media (max-width: 768px) {
     #view-streak {
        top: -15px !important;
        right: 35px !important;
        transform: scale(0.8) !important;
     }
  }
</style>`);

fs.writeFileSync('index.html', html);
console.log("Updated streak pos on mobile");
