const fs = require("fs");
const p = "Workspace.tsx";
let s = fs.readFileSync(p, "utf8");
const a = "require('./games_to_publish.js')";
if (!s.includes(a)) { console.log("anchor not found — maybe already fixed"); process.exit(0); }
s = s.split(a).join("require('./games_to_publish')");
fs.writeFileSync(p, s);
console.log("dropped .js extension from the games_to_publish require");
