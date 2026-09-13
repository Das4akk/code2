const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const newStyles = `
  /* Fix Avatar Flow */
  .tiktok-profile-avatar-wrap {
     position: absolute !important;
     top: -60px !important;
     left: 32px !important;
     margin: 0 !important;
  }
  
  .tiktok-profile-container {
     padding: 70px 32px 32px 32px !important; /* 60px for the avatar bottom half + 10px spacing */
  }
  
  .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
     margin-top: 0 !important;
     top: -60px !important; /* Half of 120px */
  }
  
  @media (max-width: 768px) {
     .tiktok-profile-avatar-wrap {
        left: 16px !important;
        top: -45px !important;
     }
     .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
        top: -45px !important;
     }
     .tiktok-profile-container {
        padding: 55px 16px 16px 16px !important;
     }
  }
`;

// Inject this right before </style> to override previous Discord CSS tweaks
html = html.replace('</style>', newStyles + '\\n</style>');

fs.writeFileSync('index.html', html);
console.log("Fixed avatar flow.");
