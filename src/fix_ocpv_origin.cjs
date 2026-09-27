const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("kv-game.local")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("base-url",
"        source={{ html }}",
"        source={{ html, baseUrl: 'https://kv-game.local/' }}", 1);
rep("gate-allow",
"    if (url.startsWith('about:blank') || url === '' || url.startsWith('data:text/html')) return true;",
"    if (url.startsWith('about:blank') || url === '' || url.startsWith('data:text/html') || url.startsWith('https://kv-game.local')) return true;", 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("patched " + P + " (" + n + "). Page now has a real origin: storage works, errors unmask.");
