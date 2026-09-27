// fix_fs_legacy.cjs - restore file caching under Expo SDK 54.
//
// SDK 54 moved the classic filesystem API behind 'expo-file-system/legacy'.
// Calling getInfoAsync on the new default export THROWS:
//   "Method getInfoAsync is deprecated. You can migrate to the new filesystem
//    API using 'File' and 'Directory' classes or import the legacy API from
//    'expo-file-system/legacy'."
//
// That surfaced visibly as "Export failed" on SAVE FILE - but it was doing
// far more damage silently. gameCacheLoadOffline wraps its body in
// `catch { return null }`, so every offline cache read was throwing and
// returning null, i.e. CACHE-FIRST NEVER WORKED. gameCacheSave was failing
// the same way, so nothing was being written either. That is why an installed
// game still tried to pull from the network and why nothing was "saved on the
// device" - not a logic bug, a broken filesystem import.
//
// Fix: point the classic calls at the legacy module. 5 call sites.
// Run from layer1 root:  node src\\fix_fs_legacy.cjs
const fs = require("fs");
function patch(P, want) {
  let s = fs.readFileSync(P, "utf8");
  const CRLF = s.includes("\r\n");
  if (CRLF) s = s.replace(/\r\n/g, "\n");
  if (s.includes("expo-file-system/legacy")) { console.log("already patched  [" + P + "]"); return; }
  const n = s.split("require('expo-file-system')").length - 1;
  if (n !== want) { console.error("ABORT [" + P + "]: found " + n + " call sites, expected " + want); process.exit(1); }
  s = s.split("require('expo-file-system')").join("require('expo-file-system/legacy')");
  fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
  console.log("ok  [" + P + "] " + n + " call sites -> legacy API");
}
patch("game_chunks.ts", 4);
patch("EntertainmentCenter.tsx", 1);
console.log("\ndone. Offline cache reads/writes and SAVE FILE export work again.");
