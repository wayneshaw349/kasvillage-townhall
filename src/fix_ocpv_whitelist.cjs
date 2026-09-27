const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("originWhitelist={['https://kv-game.local']}")) { console.log("already patched"); process.exit(0); }
const a = "        originWhitelist={[]}";
const b = "        originWhitelist={['https://kv-game.local']}";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT: found " + f); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("whitelist now exactly the synthetic origin - nothing external");
