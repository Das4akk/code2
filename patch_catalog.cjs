const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const badLogic1 = `let userAvatarInner = "";
          const myAvatarDisplay = document.getElementById("my-avatar-display");
          if (myAvatarDisplay && myAvatarDisplay.innerHTML && myAvatarDisplay.innerHTML !== "?") {
            // Strip any frame from it because in catalog we only want the bare avatar
            let tmpNode = document.createElement("div");
            tmpNode.innerHTML = myAvatarDisplay.innerHTML;
            let images = tmpNode.querySelectorAll("img");
            if (images.length > 0) {
              userAvatarInner = \`<img src="\${images[0].src}" onerror="this.parentElement.innerHTML='?';" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />\`;
            } else {
               userAvatarInner = tmpNode.innerText || "?";
            }
          } else {
            let fakeProf = currentProf ? { ...currentProf, frame: null } : { name: "User", avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png" };
            userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);
          }`;

const goodLogic1 = `          let fakeProf = currentProf ? { ...currentProf, frame: null } : { name: "User", avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png" };
          let userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);`;

appJs = appJs.replace(badLogic1, goodLogic1);

const badLogic2 = `let userAvatarInner = "";
  const myAvatarDisplay = document.getElementById("my-avatar-display");
  if (myAvatarDisplay && myAvatarDisplay.innerHTML && myAvatarDisplay.innerHTML !== "?") {
    let tmpNode = document.createElement("div");
    tmpNode.innerHTML = myAvatarDisplay.innerHTML;
    let images = tmpNode.querySelectorAll("img");
    if (images.length > 0) {
      userAvatarInner = \`<img src="\${images[0].src}" onerror="this.parentElement.innerHTML='?';" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />\`;
    } else {
       userAvatarInner = tmpNode.innerText || "?";
    }
  } else {
    let fakeProf = currentProf ? { ...currentProf, frame: null } : { name: "User", avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png" };
    userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);
  }`;

const goodLogic2 = `  let fakeProf = currentProf ? { ...currentProf, frame: null } : { name: "User", avatar: "https://telegra.ph/file/0c9e88d184cf43b448f21.png" };
  let userAvatarInner = ProfileManager.getAvatarHtml(fakeProf);`;

appJs = appJs.replace(badLogic2, goodLogic2);

fs.writeFileSync('app.js', appJs);
console.log("Avatar render fixed in catalog.");
