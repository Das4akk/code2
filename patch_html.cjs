const fs = require('fs');

function hideRelationships() {
    let indexHtml = fs.readFileSync('index.html', 'utf8');

    // Change relationship buttons and views to be display: none
    indexHtml = indexHtml.replace(/<div class="partner-container"(.*?)>/g, '<div class="partner-container"$1 style="display:none !important;">');
    indexHtml = indexHtml.replace(/id="btn-remove-partner"/g, 'id="btn-remove-partner" style="display:none !important;"');
    indexHtml = indexHtml.replace(/id="modal-partner-view"/g, 'id="modal-partner-view" style="display:none !important;"');

    // Inject forgotten password link
    indexHtml = indexHtml.replace(
      /<button class="submit-btn" id="btn-do-login" style="margin-top: 10px;">/,
      '<button type="button" id="btn-forgot-password" style="background:none; border:none; color:var(--text-muted); font-size:12px; cursor:pointer; text-decoration:underline; width:100%; margin-top:0px; margin-bottom:10px;">Забыли пароль?</button>\n      <button class="submit-btn" id="btn-do-login" style="margin-top: 10px;">'
    );

    // Inject settings panel for email/password
    const settingsPanel = '<div style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid var(--border-light); margin-bottom: 20px;">' +
        '<h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 700;">Безопасность (Подготовка)</h3>' +
        '<div style="display:flex; flex-direction:column; gap:12px;">' +
          '<input type="email" id="settings-new-email" placeholder="Новая почта" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:10px; border-radius:8px; color:#fff;" />' +
          '<button class="primary-btn" id="btn-settings-change-email" style="font-size: 14px;">Сменить почту</button>' +
          '<hr style="border:none; border-top:1px solid rgba(255,255,255,0.05); margin: 5px 0;">' +
          '<input type="password" id="settings-new-password" placeholder="Новый пароль" style="margin-bottom:0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:10px; border-radius:8px; color:#fff;" />' +
          '<button class="primary-btn" id="btn-settings-change-password" style="font-size: 14px;">Сменить пароль</button>' +
        '</div>' +
      '</div>';


    indexHtml = indexHtml.replace(
      /<h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 700;">🔊 Уведомления<\/h3>/,
      settingsPanel + '\n<h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 700;">🔊 Уведомления</h3>'
    );

    // Add CSS fixes for yt-player wrapper if needed
    // The player wrapper should be 100%
    indexHtml = indexHtml.replace(/<div id="yt-player"><\/div>/, '<div id="yt-player" style="width: 100%; height: 100%;"></div>');

    fs.writeFileSync('index.html', indexHtml);
}

hideRelationships();
