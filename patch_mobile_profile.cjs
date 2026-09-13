const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// The previous block added FULL WIDTH PROFILE FIX before </style>
html = html.replace(/\/\* FULL WIDTH PROFILE FIX \*\/[\s\S]*?<\/style>/, `/* FULL WIDTH PROFILE FIX */
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
     max-width: 1200px !important;
     padding: 40px 60px !important;
     margin: 0 auto !important;
     background: transparent !important;
  }
  @media (max-width: 768px) {
     .tiktok-profile-container {
        padding: 24px !important;
     }
     
     .tiktok-profile-header {
        display: block !important;
        position: relative;
        padding-top: 60px;
     }
     
     /* Move avatar to the right */
     .tiktok-profile-avatar-wrap {
        position: absolute !important;
        top: 20px !important;
        right: -10px !important; 
        margin: 0 !important;
        width: 110px !important;
        height: 110px !important;
     }
     #view-avatar {
        width: 110px !important;
        height: 110px !important;
     }
     
     /* + icon on avatar */
     .tiktok-profile-avatar-wrap::after {
        content: '+';
        position: absolute;
        bottom: -2px;
        right: 4px;
        width: 32px;
        height: 32px;
        background-color: #00d2ff;
        color: #fff;
        font-size: 24px;
        line-height: 32px;
        text-align: center;
        font-weight: bold;
        border-radius: 50%;
        border: 3px solid #000;
        z-index: 10;
     }
     html.theme-light-global .tiktok-profile-avatar-wrap::after {
        border-color: #fff;
     }
     
     /* Title block on the left */
     .tiktok-profile-info {
        display: block !important;
        padding-right: 110px !important;
     }
     .tiktok-profile-title {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 4px !important;
        margin-bottom: 20px !important;
     }
     #view-name {
        font-size: 46px !important;
        line-height: 1.1 !important;
        letter-spacing: -1.5px !important;
        margin-bottom: 0 !important;
        word-break: break-word;
     }
     #view-username {
        font-size: 18px !important;
        opacity: 0.8;
        font-weight: 500 !important;
        margin-bottom: 12px !important;
     }
     
     #view-level-badge {
        margin-bottom: 12px !important;
        background: transparent !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
     }
     
     #view-bio {
        text-align: left !important;
        font-size: 15px !important;
        margin-top: 40px !important;
        max-width: 100% !important;
     }
     
     /* Badges alignment */
     #view-badges-collection {
        justify-content: flex-start !important;
        margin-top: 20px !important;
     }
     .partner-container {
        align-items: flex-start !important;
     }
     
     /* Make action buttons float top left */
     .tiktok-profile-actions-wrap {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        justify-content: flex-start !important;
     }
     #view-profile-actions {
        flex-direction: row !important;
        align-items: center !important;
        gap: 15px !important;
     }
     
     /* Pencil icon for Edit Profile */
     .secondary-btn#btn-dm-modal {
         font-size: 0 !important;
         width: 32px !important;
         height: 32px !important;
         padding: 0 !important;
         border-radius: 50% !important;
         background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>') !important;
         background-repeat: no-repeat !important;
         background-position: center !important;
         background-size: 24px !important;
         background-color: transparent !important;
         border: none !important;
         transform: rotate(-10deg);
     }
     
     html.theme-light-global .secondary-btn#btn-dm-modal {
         background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>') !important;
     }
     
     /* Clean up share/settings buttons on mobile */
     .tiktok-settings-btn, #view-profile-actions > button:not(#btn-dm-modal) {
         background-color: transparent !important;
         border: none !important;
         padding: 0 !important;
         width: 32px !important;
         height: 32px !important;
         color: white !important;
     }
  }
</style>`);

fs.writeFileSync('index.html', html);
console.log("Updated mobile styles!");
