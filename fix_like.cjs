const fs = require('fs');

// 1. Fix HTML
let html = fs.readFileSync('index.html', 'utf8');
const oldSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="like-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
const newIcon = '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp" style="width: 22px; height: 22px; object-fit: contain; filter: grayscale(100%) opacity(50%); transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);" id="like-icon" alt="Like">';
html = html.replace(oldSvg, newIcon);
fs.writeFileSync('index.html', html);
console.log("HTML updated.");

// 2. Fix JS
let js = fs.readFileSync('app.js', 'utf8');

// The block to replace
const jsSearch = /const likeIcon = document\.getElementById\("like-icon"\);[\s\S]*?newLikeBtn\.addEventListener\("click", async \(\) => {/m;

const jsReplace = `
       // Remove previous listener to avoid duplicates
       const newLikeBtn = likeBtn.cloneNode(true);
       likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
       
       const likeIcon = newLikeBtn.querySelector("#like-icon") || document.getElementById("like-icon");
       const likesCount = newLikeBtn.querySelector("#view-likes-count") || document.getElementById("view-likes-count");

       const isSelf = targetUid === AppState.currentUser?.uid;
       if (isSelf) {
          newLikeBtn.style.opacity = "0.5";
          newLikeBtn.style.cursor = "not-allowed";
       } else {
          newLikeBtn.style.opacity = "1";
          newLikeBtn.style.cursor = "pointer";
       }

       // Helper to update UI
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          if (likesCount) likesCount.innerText = count;
          if (likeIcon) {
             if (AppState.currentUser && likedBy[AppState.currentUser.uid]) {
                likeIcon.style.filter = "none";
                likeIcon.style.transform = "scale(1.15)";
             } else {
                likeIcon.style.filter = "grayscale(100%) opacity(50%)";
                likeIcon.style.transform = "scale(1)";
             }
          }
       };
       
       updateLikeUI(profile);
       
       newLikeBtn.addEventListener("click", async () => {`;

if (js.includes('const likeIcon = document.getElementById("like-icon");')) {
    js = js.replace(jsSearch, jsReplace);
}

// And fix the asyncLoaded updateLikeUI logic too:
const jsSearch2 = /const likeIcon = document\.getElementById\("like-icon"\);\s*const likesCount = document\.getElementById\("view-likes-count"\);\s*const updateLikeUI = \(p\) => {[\s\S]*?updateLikeUI\(profile\);\s*}/m;
const jsReplace2 = `
       const likeIcon = document.getElementById("like-icon");
       const likesCount = document.getElementById("view-likes-count");
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          if (likesCount) likesCount.innerText = count;
          if (likeIcon) {
            if (AppState.currentUser && likedBy[AppState.currentUser.uid]) {
               likeIcon.style.filter = "none";
               likeIcon.style.transform = "scale(1.15)";
            } else {
               likeIcon.style.filter = "grayscale(100%) opacity(50%)";
               likeIcon.style.transform = "scale(1)";
            }
          }
       };
       updateLikeUI(profile);
    }`;

if (js.match(jsSearch2)) {
    js = js.replace(jsSearch2, jsReplace2);
} else {
    console.log("Could not find second block.");
}

fs.writeFileSync('app.js', js);
console.log("JS updated.");

