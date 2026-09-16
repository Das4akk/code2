const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');
// Original:
//    if (rtb) {
//      const dbg = document.createElement("button");
//      ...
//      dbg.onclick = () => { ... };
//    }
// Since I removed from "// Add toggle button" to "};", there's an extra "    }" left.
// Let's find "window.addEventListener("resize", rs);\n    rs();\n    }" and remove the "    }"

js = js.replace(/window\.addEventListener\("resize", rs\);\n    rs\(\);\n    \}\n/m, 'window.addEventListener("resize", rs);\n    rs();\n');

fs.writeFileSync('app.js', js);
