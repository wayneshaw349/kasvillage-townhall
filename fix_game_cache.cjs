// fix_game_cache.cjs — solve once, save, render local forever.
//
// fetchGamePuzzle gains a device cache: after the puzzle solves + verifies,
// the finished HTML is written to <documents>/kv_games/<head>.html. Next
// launches load that file, re-verify its sha256 against the pinned build
// hash, and return instantly — no chain, no indexer, no relay needed.
// Verification makes the cache tamper-proof: wrong bytes -> refetch.
// Run from layer1 root:  node src\fix_game_cache.cjs
const fs = require("fs");
const P = "game_chunks.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("kv_games/")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}

rep("cache-fns",
"export async function fetchGamePuzzle(",
`// ---- device cache: the chain is delivery, the phone is the runtime --------
async function gameCachePath(head: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system');
    const dir = FS.documentDirectory + 'kv_games/';
    await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    return dir + head + '.html';
  } catch { return null; }
}
async function gameCacheLoad(head: string, wantSha: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system');
    const p = await gameCachePath(head);
    if (!p) return null;
    const info = await FS.getInfoAsync(p);
    if (!info.exists) return null;
    const html = await FS.readAsStringAsync(p);
    if (bytesToHex(sha256(utf8ToBytes(html))) !== wantSha) { await FS.deleteAsync(p, { idempotent: true }).catch(() => {}); return null; }
    return html;
  } catch { return null; }
}
async function gameCacheSave(head: string, html: string): Promise<void> {
  try {
    const FS = require('expo-file-system');
    const p = await gameCachePath(head);
    if (p) await FS.writeAsStringAsync(p, html);
  } catch { /* cache is best-effort */ }
}

export async function fetchGamePuzzle(`, 1);

rep("cache-use",
"    const m = config as GameManifest;",
`    const m = config as GameManifest;
    {
      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);
      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }
    }`, 1);

rep("cache-save",
"    return { html };",
`    await gameCacheSave(pinnedHead, html);
    return { html };`, 1);

fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Launches after the first render from the device file.");
