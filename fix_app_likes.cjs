const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const targetLine = 'vModal.classList.add("active");';
const insertLogic = `
    const likeBtn = document.getElementById("btn-like-profile");
    if (likeBtn) {
       likeBtn.style.display = "flex";
       const likeIcon = document.getElementById("like-icon");
       const likesCount = document.getElementById("view-likes-count");
       
       const isSelf = targetUid === AppState.currentUser?.uid;
       if (isSelf) {
          likeBtn.style.opacity = "0.5";
          likeBtn.style.cursor = "not-allowed";
       } else {
          likeBtn.style.opacity = "1";
          likeBtn.style.cursor = "pointer";
       }

       // Helper to update UI
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          likesCount.innerText = count;
          if (AppState.currentUser && likedBy[AppState.currentUser.uid]) {
             likeIcon.setAttribute("fill", "#ff4757");
             likeIcon.setAttribute("stroke", "#ff4757");
          } else {
             likeIcon.setAttribute("fill", "none");
             likeIcon.setAttribute("stroke", "currentColor");
          }
       };
       
       updateLikeUI(profile);

       // Remove previous listener to avoid duplicates
       const newLikeBtn = likeBtn.cloneNode(true);
       likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
       
       newLikeBtn.addEventListener("click", async () => {
          if (isSelf) {
             Utils.toast("Вы не можете поставить лайк самому себе", "error");
             return;
          }
          if (!AppState.currentUser) return;
          
          try {
             const myUid = AppState.currentUser.uid;
             const likedRef = ref(db, \`users/\${targetUid}/profile/likedBy/\${myUid}\`);
             
             // Check current state from cache or fetch
             const profSnap = await get(ref(db, \`users/\${targetUid}/profile/likedBy/\${myUid}\`));
             if (profSnap.exists()) {
                await remove(likedRef);
             } else {
                await set(likedRef, Date.now());
             }
             
             // Refresh profile
             const freshProfSnap = await get(ref(db, \`users/\${targetUid}/profile\`));
             if (freshProfSnap.exists()) {
                const freshP = freshProfSnap.val();
                AppState.usersCache.set(targetUid, freshP);
                updateLikeUI(freshP);
             }
          } catch (err) {
             console.error("Like error", err);
          }
       });
    }
`;

code = code.replace(targetLine, insertLogic + "\n    " + targetLine);

// Ensure the like UI gets updated when profile is loaded asynchronously
const asyncLoadedReplace = /profile = loadedProfile;\s*if \(!profile\) {/;
const asyncLoadedInsert = `
    profile = loadedProfile;
    if (document.getElementById("btn-like-profile")) {
       const likeIcon = document.getElementById("like-icon");
       const likesCount = document.getElementById("view-likes-count");
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          if (likesCount) likesCount.innerText = count;
          if (likeIcon) {
            if (AppState.currentUser && likedBy[AppState.currentUser.uid]) {
               likeIcon.setAttribute("fill", "#ff4757");
               likeIcon.setAttribute("stroke", "#ff4757");
            } else {
               likeIcon.setAttribute("fill", "none");
               likeIcon.setAttribute("stroke", "currentColor");
            }
          }
       };
       updateLikeUI(profile);
    }

    if (!profile) {
`;
code = code.replace(asyncLoadedReplace, asyncLoadedInsert);

fs.writeFileSync('app.js', code);
console.log("App.js modified for likes logic.");
