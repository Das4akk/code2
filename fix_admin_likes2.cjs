const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// I will just make sure oldProfile.likedBy is assigned
const targetSearch = /let likedBy = oldProfile\.likedBy \|\| \{\};\n\s*let currentLikes = Object\.keys\(likedBy\)\.length;/;
const targetReplace = `let likedBy = oldProfile.likedBy ? { ...oldProfile.likedBy } : {};
    let currentLikes = Object.keys(likedBy).length;`;

if (code.match(targetSearch)) {
    code = code.replace(targetSearch, targetReplace);
}

const targetSearch2 = /likedBy\[\`fake_like_\$\{Utils\.generateCryptoId\(8\)\}\`\] = Date\.now\(\);\n            }\n        }\n    }/;
const targetReplace2 = `likedBy[\`fake_like_\${Utils.generateCryptoId(8)}\`] = Date.now();
            }
        }
        oldProfile.likedBy = likedBy;
    }`;

if (code.match(targetSearch2)) {
    code = code.replace(targetSearch2, targetReplace2);
}

// Remove the erroneous updates replace we added earlier since we just use ...oldProfile
const errUpdatesSearch = /updates\[\`users\/\$\{uid\}\/profile\`\] = \{\n\s*likedBy,/;
const errUpdatesReplace = `updates[\`users/\${uid}/profile\`] = {`;

if (code.match(errUpdatesSearch)) {
    code = code.replace(errUpdatesSearch, errUpdatesReplace);
}

fs.writeFileSync('app.js', code);
console.log("Fixed oldProfile assignment.");
