// fix_cache_null.cjs — cache check must not run when the manifest fetch failed.
// Run from layer1 root:  node src\fix_cache_null.cjs
const fs = require("fs");
const P = "game_chunks.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("if (config) {")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("cache-null-guard",
`    const m = config as GameManifest;
    {
      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);
      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }
    }`,
`    const m = config as GameManifest;
    if (config) {
      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);
      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }
    }`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Clean 'manifest: ...' errors return again.");
