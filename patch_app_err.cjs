const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/const res = await fetch\(`\$\{apiBase\}\/api\/auth\/(.*?)`, \{([\s\S]*?)\}\);\s*const data = await res\.json\(\);/g, 
`const res = await fetch(\`\${apiBase}/api/auth/$1\`, {$2});
            let text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch(err) { throw new Error("API $1 failed (HTTP " + res.status + "): " + (text ? text : "Empty body")); }`);

code = code.replace(/const resetRes = await fetch\(`\$\{apiBase\}\/api\/auth\/(.*?)`, \{([\s\S]*?)\}\);\s*const resetData = await resetRes\.json\(\);/g, 
`const resetRes = await fetch(\`\${apiBase}/api/auth/$1\`, {$2});
            let resetText = await resetRes.text();
            let resetData;
            try { resetData = JSON.parse(resetText); } catch(err) { throw new Error("API $1 failed (HTTP " + resetRes.status + "): " + (resetText ? resetText : "Empty body")); }`);

code = code.replace(/const changeRes = await fetch\(`\$\{apiBase\}\/api\/auth\/(.*?)`, \{([\s\S]*?)\}\);\s*const changeData = await changeRes\.json\(\);/g, 
`const changeRes = await fetch(\`\${apiBase}/api/auth/$1\`, {$2});
            let changeText = await changeRes.text();
            let changeData;
            try { changeData = JSON.parse(changeText); } catch(err) { throw new Error("API $1 failed (HTTP " + changeRes.status + "): " + (changeText ? changeText : "Empty body")); }`);

fs.writeFileSync('app.js', code);
