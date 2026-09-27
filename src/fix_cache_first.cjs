// fix_cache_first.cjs - cached games play OFFLINE, before any fetch.
//
// Root cause of the recurring "manifest: no config chunks found": the cache
// check needed html_sha256 FROM the fetched manifest, so when the relay's
// chunk records were recycled away the device cache was never consulted -
// even though it holds the whole verified game. Fix: a sidecar meta file
// (<head>.json with the html sha, written at save; backfilled once for the
// legacy cache) lets the cache self-verify, and fetchGamePuzzle now serves
// it FIRST with zero network. Client persistence, made real.
// Run from layer1 root:  node src\\fix_cache_first.cjs
const fs = require("fs");
const P = "game_chunks.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("gameCacheLoadOffline")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("cache-meta", "async function gameCacheSave(head: string, html: string): Promise<void> {\n  try {\n    const FS = require('expo-file-system');\n    const p = await gameCachePath(head);\n    if (p) await FS.writeAsStringAsync(p, html);\n  } catch { /* cache is best-effort */ }\n}", "async function gameCacheSave(head: string, html: string): Promise<void> {\n  try {\n    const FS = require('expo-file-system');\n    const p = await gameCachePath(head);\n    if (p) {\n      await FS.writeAsStringAsync(p, html);\n      // sidecar meta: lets the cache self-verify WITHOUT the manifest, so a\n      // cached game plays even when no relay serves the chunk records.\n      await FS.writeAsStringAsync(p.replace(/\\.html$/, '.json'),\n        JSON.stringify({ sha: bytesToHex(sha256(utf8ToBytes(html))), at: Date.now() })).catch(() => {});\n    }\n  } catch { /* cache is best-effort */ }\n}\n// Cache-first load that needs NOTHING from the network: verifies the file\n// against its sidecar meta. The file was only ever written after full\n// hash-chain + sha verification, and the app sandbox is private, so a\n// missing sidecar (legacy cache) is backfilled from the file once.\nasync function gameCacheLoadOffline(head: string): Promise<string | null> {\n  try {\n    const FS = require('expo-file-system');\n    const p = await gameCachePath(head);\n    if (!p) return null;\n    const info = await FS.getInfoAsync(p);\n    if (!info.exists) return null;\n    const html = await FS.readAsStringAsync(p);\n    const gotSha = bytesToHex(sha256(utf8ToBytes(html)));\n    const mp = p.replace(/\\.html$/, '.json');\n    const mInfo = await FS.getInfoAsync(mp);\n    if (mInfo.exists) {\n      try {\n        const meta = JSON.parse(await FS.readAsStringAsync(mp));\n        if (meta && meta.sha && meta.sha !== gotSha) { await FS.deleteAsync(p, { idempotent: true }).catch(() => {}); return null; }\n      } catch {}\n    } else {\n      await FS.writeAsStringAsync(mp, JSON.stringify({ sha: gotSha, at: Date.now() })).catch(() => {});\n    }\n    return html;\n  } catch { return null; }\n}");
rep("cache-first", "  try {\n    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network);\n    const m = config as GameManifest;\n    if (config) {\n      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);\n      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }\n    }", "  try {\n    // CACHE FIRST: the phone is the runtime. A verified cached copy plays\n    // with zero network - the manifest fetch below is only for first installs\n    // and updates, so a recycled relay can never brick an installed game.\n    {\n      const cachedOff = await gameCacheLoadOffline(pinnedHead);\n      if (cachedOff) { onProgress && onProgress(1, 1); return { html: cachedOff }; }\n    }\n    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network);\n    const m = config as GameManifest;\n    if (config) {\n      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);\n      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }\n    }");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (2 edits). Installed games play offline, always.");
