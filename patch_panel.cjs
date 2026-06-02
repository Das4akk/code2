const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// replace the 4-column stats with 3-column stats
html = html.replace(/<div style="display:grid; grid-template-columns: repeat\(4, 1fr\); gap:12px;">.*?(<div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">)/s, `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#fff;" id="stat-total-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Всего тикетов</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#2ed573;" id="stat-open-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Открытых</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#ff4757;" id="stat-closed-tickets">0</div>
                    <div style="font-size:11px; color:var(--text-muted);">Закрытых</div>
                </div>
            </div>

            $1`);

// remove the ban section entirely
html = html.replace(/<button class="secondary-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem\.exportBansList\(\)">📥 Экспорт списка банов<\/button>/g, '');
html = html.replace(/<button class="danger-btn" style="font-size:11px; padding:8px;" onclick="SupportSystem\.clearAllBans\(\)">Снять все блокировки<\/button>/g, '');
html = html.replace(/<div style="margin-top:20px; padding-top:15px; border-top:1px solid rgba\(255,255,255,0\.1\);">\s*<h4 style="margin:0 0 8px 0; font-size:12px; color:var\(--text-muted\)">Точечное управление доступом UID:<\/h4>.*?<\/div>\s*<\/div>/s, '</div>');

fs.writeFileSync('index.html', html);
