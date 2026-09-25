// patch_townhall_jsonlimit.js — raise the actix JSON body limit to 16 MB.
//
// Why: actix-web's default JSON limit is 2 MB, so POSTing the 3.9 MB chain
// game to /api/verify/game never gets read (the proxy just hangs until the
// client times out). 16 MB covers any game under the 8 MB cap with room for
// JSON escaping overhead. Applied to BOTH HttpServer App instances (the
// ingress server and the main v3 server, which owns /api/verify/game).
//
// Usage (repo root):  node patch_townhall_jsonlimit.js   -> patches src/main.rs
const fs = require("fs");
const P = "src/main.rs";
let rs = fs.readFileSync(P, "utf8");
const LIMIT = ".app_data(web::JsonConfig::default().limit(16 * 1024 * 1024))   // [KV] 16 MB JSON for game verify";

if (rs.includes("web::JsonConfig::default().limit(16")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, anchor, expected) {
  const found = rs.split(anchor).length - 1;
  if (found !== expected) { console.error(`ABORT [${name}]: expected ${expected}, found ${found}`); process.exit(1); }
  rs = rs.split(anchor).join(anchor + "\n                    " + LIMIT);
  n++; console.log("ok  [" + name + "]");
}

rep("jsonlimit-ingress", ".app_data(web::Data::new(config.clone()))", 1);
rep("jsonlimit-main", ".app_data(web::Data::new(state.clone()))", 1);

fs.writeFileSync(P, rs);
console.log("\npatched " + P + " (" + n + " patches). cargo check, push, wait for the Action, redeploy Flux.");
