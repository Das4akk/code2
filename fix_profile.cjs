const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const oldLogic = `  static async openViewProfileModal(targetUid) {
    // Show section-profile instead of modal
    document.querySelectorAll('.rooms-main').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // If viewing our own profile, highlight the nav-profile item
    if (targetUid === AppState.currentUser?.uid) {
       const navMy = document.getElementById('nav-profile');
       if (navMy) navMy.classList.add('active');
    }
    
    const sProfile = document.getElementById("section-profile");
    if (sProfile) {
        sProfile.style.display = "flex";
    }
    
    // We don't have vModal anymore, so we remove the check for it

    const vModal = Utils.$("section-profile");
    if (!vModal) return;`;

const newLogic = `  static async openViewProfileModal(targetUid) {
    const sProfile = document.getElementById("section-profile");
    if (!sProfile) return;
    const vModal = sProfile;

    const isRoom = document.getElementById("room-screen")?.classList.contains("active");

    if (isRoom) {
       // Make it a modal overlay
       sProfile.style.setProperty("position", "fixed", "important");
       sProfile.style.setProperty("top", "10%", "important");
       sProfile.style.setProperty("left", "50%", "important");
       sProfile.style.setProperty("transform", "translateX(-50%)", "important");
       sProfile.style.setProperty("width", "90%", "important");
       sProfile.style.setProperty("max-width", "800px", "important");
       sProfile.style.setProperty("height", "80%", "important");
       sProfile.style.setProperty("z-index", "9999", "important");
       sProfile.style.setProperty("background", "rgba(20, 20, 20, 0.95)", "important");
       sProfile.style.setProperty("border-radius", "24px", "important");
       sProfile.style.setProperty("box-shadow", "0 20px 60px rgba(0,0,0,0.8)", "important");
       sProfile.style.setProperty("border", "1px solid rgba(255,255,255,0.1)", "important");
       sProfile.style.setProperty("backdrop-filter", "blur(20px)", "important");
       sProfile.style.display = "flex";
       
       if (!document.getElementById("profile-overlay-close")) {
           const btn = document.createElement("button");
           btn.id = "profile-overlay-close";
           btn.innerHTML = "✖";
           btn.style.cssText = "position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; z-index: 1000; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;";
           btn.onmouseover = () => btn.style.background = "rgba(255,255,255,0.2)";
           btn.onmouseout = () => btn.style.background = "rgba(255,255,255,0.1)";
           btn.onclick = () => {
               sProfile.style.display = "none";
           };
           sProfile.appendChild(btn);
       } else {
           document.getElementById("profile-overlay-close").style.display = "flex";
       }
    } else {
        // Normal lobby behavior
        sProfile.style.position = "relative";
        sProfile.style.top = "auto";
        sProfile.style.left = "auto";
        sProfile.style.transform = "none";
        sProfile.style.width = "100%";
        sProfile.style.maxWidth = "none";
        sProfile.style.height = "100%";
        sProfile.style.zIndex = "1";
        sProfile.style.background = "transparent";
        sProfile.style.borderRadius = "0";
        sProfile.style.boxShadow = "none";
        sProfile.style.border = "none";
        sProfile.style.backdropFilter = "none";
        if (document.getElementById("profile-overlay-close")) {
            document.getElementById("profile-overlay-close").style.display = "none";
        }
        
        document.querySelectorAll('.rooms-main').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (targetUid === AppState.currentUser?.uid) {
           const navMy = document.getElementById('nav-profile');
           if (navMy) navMy.classList.add('active');
        }
        sProfile.style.display = "flex";
    }`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync('app.js', js);
