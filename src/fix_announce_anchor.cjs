// fix_announce_anchor.cjs - announce-only reuses the ORIGINAL publish anchor.
//
// Bug: ANNOUNCE-only fetched a fresh sink as anchor_hash - a block AFTER the
// data, useless as a walk entry, and it overwrote the good coordinate in the
// registry. Fix: PUBLISH persists its press-time anchor per game
// (kv_pub_anchor_<gameId>); ANNOUNCE-only re-advertises that stored anchor,
// or announces span-only when none is stored. Republishing (which devs do on
// any adjustment anyway) refreshes the stored anchor naturally.
// Run from layer1 root:  node src\\fix_announce_anchor.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("kv_pub_anchor_")) { console.log("already patched"); process.exit(0); }
const A = "      let publishAnchor = '';\n      try {\n        const sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');\n        publishAnchor = String((await sr.json()).sink || '');\n        if (publishAnchor) gadd('walk anchor: ' + publishAnchor.slice(0, 16) + '\u2026');\n      } catch {}";
const parts = s.split(A);
if (parts.length !== 3) { console.error("ABORT [anchor-x2]: expected 2 occurrences, found " + (parts.length - 1)); process.exit(1); }
const iAnn = s.indexOf("const runAnnounceOnly");
const iFirst = s.indexOf(A);
const iPub = s.indexOf("const runPublish");
if (!(iAnn >= 0 && iAnn < iFirst && iFirst < iPub)) { console.error("ABORT [order]: announce/publish order unexpected"); process.exit(1); }
s = parts[0] + "      // announce-only: NEVER stamp a fresh sink - it sits AFTER the data and\n      // is useless as a walk entry. Reuse the anchor captured at publish time.\n      let publishAnchor = '';\n      try {\n        const AS = require('@react-native-async-storage/async-storage').default;\n        publishAnchor = String((await AS.getItem('kv_pub_anchor_' + gameId)) || '');\n        if (publishAnchor) gadd('walk anchor (from original publish): ' + publishAnchor.slice(0, 16) + '\u2026');\n        else gadd('no stored publish anchor - announcing span only');\n      } catch {}" + parts[1] + "      let publishAnchor = '';\n      try {\n        const sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');\n        publishAnchor = String((await sr.json()).sink || '');\n        if (publishAnchor) {\n          gadd('walk anchor: ' + publishAnchor.slice(0, 16) + '\u2026');\n          // persist per game so ANNOUNCE-only re-advertises the TRUE entry point\n          try { const AS = require('@react-native-async-storage/async-storage').default; await AS.setItem('kv_pub_anchor_' + gameId, publishAnchor); } catch {}\n        }\n      } catch {}" + parts[2];
console.log("ok  [announce-reuses-anchor]");
console.log("ok  [publish-persists-anchor]");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (2 edits). Announce-only now advertises the true publish-time anchor.");
