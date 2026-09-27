const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("props.game ? res.html : injectCsp")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("game-skips-csp",
"      if (res.html) setHtml(injectCsp(res.html));",
"      // Games: full inline-JS apps, verified by hash chain + scanner - the\n      // static-page CSP (default-src none, no scripts) would kill them.\n      if (res.html) setHtml(props.game ? res.html : injectCsp(res.html));", 1);
rep("regex-harden",
"  if (/<head[^>]*>/i.test(raw)) return raw.replace(/<head([^>]*)>/i, '<head$1>' + CSP_META);",
"  if (/<head(\\s[^>]*)?>/i.test(raw)) return raw.replace(/<head(\\s[^>]*)?>/i, (mm) => mm + CSP_META); // word-boundary: never matches JS like i<heads.length", 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("patched " + P + " (" + n + "). Games load un-spliced; page CSP regex hardened.");
