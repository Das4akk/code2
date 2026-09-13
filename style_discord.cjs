const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const discordCSS = `
  /* Discord Profile CSS */
  .discord-profile-card {
     width: 100%;
     max-width: 800px;
     margin: 0 auto;
     background: var(--panel);
     border-radius: 16px;
     overflow: hidden;
     box-shadow: 0 8px 24px rgba(0,0,0,0.4);
     display: flex;
     flex-direction: column;
  }
  
  .tiktok-profile-container {
     padding: 20px 32px 32px 32px !important;
     overflow-y: visible !important;
     height: auto !important;
     margin-top: 0 !important;
     background: transparent !important;
  }
  
  /* When no banner is present, we still want the avatar to look normal, 
     but wait, the user asked for banner to overlap. If no banner, what happens?
     We'll adjust margin-top based on whether has-banner is active. */
     
  .tiktok-profile-container.has-banner {
     margin-top: 0 !important;
  }

  .tiktok-profile-header {
     display: flex !important;
     flex-direction: column !important;
     align-items: flex-start !important;
     margin-bottom: 20px !important;
  }

  /* Override previous avatar PC and Mobile styles */
  .tiktok-profile-avatar-wrap {
     position: relative !important;
     top: auto !important;
     right: auto !important;
     left: auto !important;
     margin: 0 !important;
     width: auto !important;
     height: auto !important;
     z-index: 10;
  }
  
  /* Overlapping Avatar when banner exists */
  .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
     margin-top: -80px !important; /* Pull up into banner */
  }

  #view-avatar {
     width: 120px !important;
     height: 120px !important;
     border: 6px solid var(--panel) !important;
     background-color: var(--panel) !important;
     border-radius: 50% !important;
     box-sizing: content-box !important;
     margin: 0 !important;
  }

  .tiktok-profile-info {
     padding: 0 !important;
     width: 100% !important;
     display: flex !important;
     flex-direction: column !important;
     align-items: flex-start !important;
     text-align: left !important;
  }

  /* Reset title to flex-start */
  .tiktok-profile-title {
     align-items: flex-start !important;
     width: 100%;
  }
  
  /* Actions (Edit Button / Message Button) - Move to top right of the info area */
  .tiktok-profile-actions-wrap {
     position: absolute !important;
     top: 16px !important;
     right: 32px !important;
     margin: 0 !important;
  }
  
  /* Ensure the secondary-btn (pencil) is normal, not absolute inside its wrapper */
  .tiktok-profile-container.has-banner .secondary-btn#btn-dm-modal {
     position: relative !important;
     top: auto !important;
     left: auto !important;
     z-index: 10;
     background-color: rgba(255, 255, 255, 0.08) !important;
  }

  #view-streak {
     top: 10px !important;
     right: -10px !important;
     transform: scale(0.9) !important;
     z-index: 15;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
     .discord-profile-card {
        border-radius: 0;
        min-height: 100vh;
     }
     #section-profile {
        padding: 0 !important;
     }
     .tiktok-profile-container {
        padding: 16px !important;
     }
     .tiktok-profile-container.has-banner .tiktok-profile-avatar-wrap {
        margin-top: -65px !important;
     }
     #view-avatar {
        width: 90px !important;
        height: 90px !important;
        border-width: 4px !important;
     }
     .tiktok-profile-actions-wrap {
        top: 12px !important;
        right: 16px !important;
     }
  }
`;

// Insert our CSS before </style>
html = html.replace('</style>', discordCSS + '\n</style>');

// Also we need to clean up previous `has-banner` CSS injected before.
html = html.replace(/\/\* Banner Aspect Ratio \*\/[\s\S]*?\/\* Only on mobile[\s\S]*?\}\s*\}\s*/, '');
// And the third patch
html = html.replace(/\/\* PC & Mobile: Pull edit icon up into banner if it's the pencil \*\/[\s\S]*?\/\* Reset container margin \*\//, '');

fs.writeFileSync('index.html', html);
console.log("Discord CSS injected.");
