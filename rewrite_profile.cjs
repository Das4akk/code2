const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('index.html', 'utf-8');
const $ = cheerio.load(html, { decodeEntities: false, recognizeSelfClosing: true });

// We want to redesign `#modal-view-profile .modal-content`
const modalContent = $('#modal-view-profile .modal-content');

// Save existing important elements so we can re-insert them
const dragHandle = modalContent.find('.modal-drag-handle').prop('outerHTML') || '';
const avatar = modalContent.find('#view-avatar').prop('outerHTML') || '';
const name = modalContent.find('#view-name').prop('outerHTML') || '';
const username = modalContent.find('#view-username').prop('outerHTML') || '';
const bio = modalContent.find('#view-bio').prop('outerHTML') || '';
const levelBadge = modalContent.find('#view-level-badge').prop('outerHTML') || '';
const status = modalContent.find('#view-status').prop('outerHTML') || '';
const badgesCollection = modalContent.find('#view-badges-collection').prop('outerHTML') || '';
const partnerContainer = modalContent.find('#view-partner-container').prop('outerHTML') || '';
const hashtags = modalContent.find('#view-hashtags').prop('outerHTML') || '';
const profileActions = modalContent.find('#view-profile-actions').prop('outerHTML') || '';
const streak = modalContent.find('#view-streak').prop('outerHTML') || '';

// Rebuild TikTok layout
modalContent.empty();

const newLayout = `
${dragHandle}
<div class="tiktok-profile-container">
  <div class="tiktok-profile-header">
    <div class="tiktok-profile-avatar-wrap">
       ${streak}
       ${avatar}
    </div>
    <div class="tiktok-profile-info">
       <div class="tiktok-profile-title">
         ${name}
         ${username}
         ${levelBadge}
       </div>
       <div class="tiktok-profile-stats">
          <span><strong>83</strong> Подписки</span>
          <span><strong>188</strong> Подписчики</span>
          <span><strong>84.8K</strong> Лайки</span>
       </div>
       <div class="tiktok-profile-actions-wrap">
          ${profileActions}
       </div>
       ${status}
       ${bio}
       ${badgesCollection}
       ${partnerContainer}
       ${hashtags}
    </div>
  </div>
  
  <div class="tiktok-profile-tabs">
    <div class="tiktok-profile-tab active"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Film%20Frames.webp" style="width:1.2em; height:1.2em; margin-right:4px; vertical-align:bottom;"> Видео</div>
    <div class="tiktok-profile-tab"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Arrows/Right%20Arrow%20Curving%20Left.webp" style="width:1.2em; height:1.2em; margin-right:4px; vertical-align:bottom;"> Репосты</div>
    <div class="tiktok-profile-tab"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Bookmark.webp" style="width:1.2em; height:1.2em; margin-right:4px; vertical-align:bottom;"> Избранное</div>
    <div class="tiktok-profile-tab"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Red%20Heart.webp" style="width:1.2em; height:1.2em; margin-right:4px; vertical-align:bottom;"> Лайкнул(-а)</div>
  </div>

  <div class="tiktok-profile-content">
     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
     </svg>
     <div style="font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">Что-то пошло не так</div>
     <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">Приносим свои извинения! Повторите попытку позже.</div>
     <button class="tiktok-refresh-btn">Обновить</button>
  </div>
</div>
`;

modalContent.append(newLayout);

// Now apply this to #section-profile as well
const myProfileSection = $('#section-profile');
myProfileSection.empty();
// Just copy the structure but use my profile container, since we need to launch edit profile from here
// Or I can just redirect #nav-profile to open the modal! That's cleaner for now.
// Let's add the redirect logic in app.js.
// For now, I'll put a placeholder in #section-profile to indicate they should use the modal.
myProfileSection.html(`
<div style="display:flex; height: 100%; align-items:center; justify-content:center;">
   <button class="primary-btn" id="btn-open-my-profile-modal" style="font-size: 18px; padding: 12px 24px;">Мой профиль</button>
</div>
`);

// Add CSS for TikTok Profile Redesign
const tiktokProfileStyles = `
  /* TikTok Profile Modal Overrides */
  #modal-view-profile .modal-content {
     width: 90vw !important;
     max-width: 1000px !important;
     height: 85vh !important;
     max-height: 800px !important;
     padding: 40px !important;
     border-radius: 12px !important;
     background: #121212 !important;
     border: 1px solid rgba(255,255,255,0.1) !important;
     display: flex;
     flex-direction: column;
     text-align: left;
  }
  
  html.theme-light-global #modal-view-profile .modal-content {
     background: #FFFFFF !important;
     border: 1px solid rgba(0,0,0,0.1) !important;
  }

  .tiktok-profile-container {
     display: flex;
     flex-direction: column;
     height: 100%;
     overflow-y: auto;
  }

  .tiktok-profile-container::-webkit-scrollbar {
     display: none;
  }

  .tiktok-profile-header {
     display: flex;
     flex-direction: row;
     gap: 32px;
     margin-bottom: 32px;
  }

  .tiktok-profile-avatar-wrap {
     position: relative;
     width: 120px;
     height: 120px;
     flex-shrink: 0;
  }

  #view-avatar {
     width: 120px !important;
     height: 120px !important;
     margin: 0 !important;
  }

  .tiktok-profile-info {
     display: flex;
     flex-direction: column;
     flex: 1;
  }

  .tiktok-profile-title {
     display: flex;
     flex-direction: row;
     align-items: center;
     gap: 12px;
     margin-bottom: 8px;
     flex-wrap: wrap;
  }

  #view-name {
     font-size: 28px !important;
     font-weight: 800 !important;
     margin: 0 !important;
  }

  #view-username {
     font-size: 18px !important;
     font-weight: 600 !important;
     color: var(--text-muted) !important;
     margin: 0 !important;
  }

  .tiktok-profile-stats {
     display: flex;
     gap: 24px;
     font-size: 16px;
     color: var(--text-muted);
     margin-bottom: 16px;
  }
  
  html.theme-light-global .tiktok-profile-stats {
     color: rgba(22, 24, 35, 0.75);
  }

  .tiktok-profile-stats strong {
     color: var(--text-main);
     font-weight: 700;
  }

  .tiktok-profile-actions-wrap {
     display: flex;
     gap: 8px;
     margin-bottom: 16px;
  }
  
  /* Fix the default buttons to look more TikTok-like */
  #view-profile-actions {
     flex-direction: row !important;
     gap: 8px !important;
  }
  
  #view-profile-actions button {
     width: auto !important;
     padding: 8px 24px !important;
     font-size: 15px !important;
     font-weight: 600 !important;
     border-radius: 4px !important;
  }
  
  #view-profile-actions .btn-close-modal {
     background-color: rgba(255, 255, 255, 0.08) !important;
     border: 1px solid rgba(255, 255, 255, 0.12) !important;
     color: white !important;
  }
  
  html.theme-light-global #view-profile-actions .btn-close-modal {
     background-color: rgba(22, 24, 35, 0.06) !important;
     border: 1px solid rgba(22, 24, 35, 0.12) !important;
     color: #161823 !important;
  }

  #view-bio {
     font-size: 15px !important;
     margin-bottom: 12px !important;
     text-align: left !important;
  }

  .tiktok-profile-tabs {
     display: flex;
     border-bottom: 1px solid rgba(255,255,255,0.1);
     margin-bottom: 32px;
  }
  html.theme-light-global .tiktok-profile-tabs {
     border-bottom: 1px solid rgba(22, 24, 35, 0.1);
  }

  .tiktok-profile-tab {
     padding: 12px 32px;
     font-size: 16px;
     font-weight: 600;
     color: rgba(255,255,255,0.5);
     cursor: pointer;
     position: relative;
     transition: color 0.2s;
  }
  
  html.theme-light-global .tiktok-profile-tab {
     color: rgba(22, 24, 35, 0.5);
  }

  .tiktok-profile-tab:hover {
     color: rgba(255,255,255,0.8);
  }
  
  html.theme-light-global .tiktok-profile-tab:hover {
     color: rgba(22, 24, 35, 0.8);
  }

  .tiktok-profile-tab.active {
     color: #ffffff;
  }
  
  html.theme-light-global .tiktok-profile-tab.active {
     color: #161823;
  }

  .tiktok-profile-tab.active::after {
     content: '';
     position: absolute;
     bottom: -1px;
     left: 0;
     right: 0;
     height: 2px;
     background-color: #ffffff;
  }
  html.theme-light-global .tiktok-profile-tab.active::after {
     background-color: #161823;
  }

  .tiktok-profile-content {
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     flex: 1;
     min-height: 200px;
  }

  .tiktok-refresh-btn {
     background: rgba(255, 255, 255, 0.08);
     border: none;
     border-radius: 4px;
     color: #ffffff;
     font-size: 15px;
     font-weight: 600;
     padding: 10px 24px;
     cursor: pointer;
     transition: background 0.2s;
  }
  
  html.theme-light-global .tiktok-refresh-btn {
     background: rgba(22, 24, 35, 0.06);
     color: #161823;
  }

  .tiktok-refresh-btn:hover {
     background: rgba(255, 255, 255, 0.12);
  }
  
  html.theme-light-global .tiktok-refresh-btn:hover {
     background: rgba(22, 24, 35, 0.12);
  }

  @media (max-width: 768px) {
     #modal-view-profile .modal-content {
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        padding: 20px !important;
     }
     .tiktok-profile-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
     }
     .tiktok-profile-title {
        justify-content: center;
     }
     .tiktok-profile-stats {
        justify-content: center;
     }
     .tiktok-profile-actions-wrap {
        justify-content: center;
     }
     #view-profile-actions {
        flex-direction: column !important;
        width: 100%;
     }
     #view-profile-actions button {
        width: 100% !important;
     }
     #view-bio {
        text-align: center !important;
     }
     .tiktok-profile-tabs {
        overflow-x: auto;
     }
  }
`;

$('#tiktok-redesign').append(tiktokProfileStyles);

fs.writeFileSync('index.html', $.html());
console.log('Successfully updated profile UI!');
