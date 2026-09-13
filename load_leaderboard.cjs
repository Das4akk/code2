const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const targetSearch = /if \(Utils\.\$\("btn-auth-switch"\)\) \{/;

const leaderboardLogic = `window.loadLeaderboard = async function() {
    const listEl = Utils.$("leaderboard-list");
    if (!listEl) return;
    
    listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Загрузка...</div>';
    
    try {
        const { get, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        const snap = await get(ref(getDatabase(), "users"));
        if (!snap.exists()) {
            listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Пока нет данных.</div>';
            return;
        }
        
        const allUsers = snap.val();
        let usersArray = [];
        
        for (const [uid, uData] of Object.entries(allUsers)) {
            if (!uData.profile) continue;
            const likedBy = uData.profile.likedBy || {};
            const likesCount = Object.keys(likedBy).length;
            if (likesCount > 0) {
                usersArray.push({ uid, profile: uData.profile, likes: likesCount });
            }
        }
        
        usersArray.sort((a, b) => b.likes - a.likes);
        usersArray = usersArray.slice(0, 50);
        
        if (usersArray.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Пока ни у кого нет лайков.</div>';
            return;
        }
        
        let html = "";
        usersArray.forEach((u, idx) => {
            let placeStyle = "color: var(--text-muted); font-size: 16px;";
            let placeText = \`#\${idx + 1}\`;
            if (idx === 0) { placeStyle = "color: #FFD700; font-size: 20px; font-weight: 800; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);"; placeText = "👑 1"; }
            if (idx === 1) { placeStyle = "color: #C0C0C0; font-size: 18px; font-weight: 800;"; placeText = "🥈 2"; }
            if (idx === 2) { placeStyle = "color: #CD7F32; font-size: 18px; font-weight: 800;"; placeText = "🥉 3"; }
            
            const avHtml = ProfileManager.getAvatarHtml(u.profile);
            
            html += \`<div style="display:flex;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;transition:transform 0.2s, background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'" onclick="ProfileManager.openViewProfileModal('\${u.uid}')">
                <div style="width: 40px; text-align:center; margin-right:16px; font-weight:bold; \${placeStyle}">\${placeText}</div>
                <div style="width:46px;height:46px;margin-right:16px;border-radius:50%;overflow:visible;">\${avHtml}</div>
                <div style="flex:1;display:flex;flex-direction:column;gap:2px;">
                    <span style="font-weight:700;font-size:16px;color:var(--text-main);">\${Utils.escapeHtml(u.profile.name || "Пользователь")}</span>
                    <span style="font-size:12px;color:var(--text-muted);">@\${Utils.escapeHtml(u.profile.username || "")}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:16px;">
                    \${u.likes} <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width: 20px; height: 20px;">
                </div>
            </div>\`;
        });
        
        listEl.innerHTML = html;
        
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div style="color:red; text-align:center;">Ошибка загрузки.</div>';
    }
};

if (Utils.$("btn-auth-switch")) {`;

appJs = appJs.replace(targetSearch, leaderboardLogic);
fs.writeFileSync('app.js', appJs);

console.log("Leaderboard logic added.");
