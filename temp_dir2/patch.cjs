const fs = require("fs");
let appJs = fs.readFileSync("app.js", "utf8");

appJs = appJs.replace(/if \(!confirm\((.*?)\)\)/g, "if (!(await Utils.confirm($1)))");
appJs = appJs.replace(/if \(confirm\((.*?)\)\) {/g, "if (await Utils.confirm($1)) {");
appJs = appJs.replace(/!confirm\(/g, "!(await Utils.confirm(");
appJs = appJs.replace(/!prompt\(/g, "!(await Utils.prompt(");
appJs = appJs.replace(/prompt\(/g, "await Utils.prompt(");
appJs = appJs.replace(/alert\(/g, "await Utils.alert(");

fs.writeFileSync("app.js", appJs);
console.log("Replaced confirm/prompt/alert.");
