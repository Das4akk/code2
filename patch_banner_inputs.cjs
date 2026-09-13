const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

const bannerInputsHtml = `
          <div style="margin-bottom: 10px; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
            <label style="display:block; margin-bottom: 8px; font-weight: bold; font-size: 14px;">Шапка профиля (Баннер)</label>
            <input type="text" id="edit-banner-url" placeholder="URL баннера (ссылка, gif)" style="margin-bottom: 8px">
            <input type="file" id="edit-banner-file" accept="image/*" style="margin-bottom: 8px; font-size: 12px">
            
            <label style="display:flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
              <span>Затемнение баннера</span>
              <span id="banner-dimming-val">30%</span>
            </label>
            <input type="range" id="edit-banner-dimming" min="0" max="100" value="30" style="width: 100%;">
          </div>
`;

// Insert the banner inputs before the Name input section (which comes right after avatar section)
// Let's find '<div style="margin-bottom: 10px; margin-top: 5px">'
html = html.replace(
  '<div style="margin-bottom: 10px; margin-top: 5px">',
  bannerInputsHtml + '\n          <div style="margin-bottom: 10px; margin-top: 5px">'
);

fs.writeFileSync('index.html', html);
console.log("Injected banner inputs into modal");
