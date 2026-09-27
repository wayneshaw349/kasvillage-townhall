// wire_session_digest.cjs - move-log hash + human-timing stats, for free.
//
// Every game move already passes through kv_net_bridge as a POST. This hashes
// them in order (a commitment the dev cannot rewrite after the fact) and
// records inter-move gaps. Coefficient of variation is the signal: human play
// scatters, scripted play clusters. We publish the numbers, never a verdict.
//
// The game neither cooperates nor can opt out - this is wallet-side.
// Run from layer1 root:  node src\\wire_session_digest.cjs
const fs = require("fs");
const P = "kv_net_bridge.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("kvSessionDigest")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("session-state", "/** Returns true if the message was a KV_WNET message (handled here). */", "// ---------------------------------------------------------------------------\n// SESSION DIGEST - move-log hash + timing, captured from traffic already\n// passing through this bridge. The game does not cooperate and cannot opt out\n// or forge it: every move POST is hashed in order, client-side.\n//\n// Timing is the part that distinguishes a human from a script. Human gaps\n// scatter widely (high coefficient of variation); scripted play clusters\n// tight. We publish the stats, not a verdict - anyone can recompute them from\n// the committed hash chain and draw their own conclusion.\n// ---------------------------------------------------------------------------\nimport { sha256 as _kvSha } from '@noble/hashes/sha256';\nimport { utf8ToBytes as _kvU8, bytesToHex as _kvHex } from '@noble/hashes/utils';\n\nlet _kvSess: { head: string; h: string; n: number; last: number; gaps: number[] } | null = null;\n\nexport function kvSessionStart(gameHead: string) {\n  _kvSess = { head: String(gameHead || ''), h: '0'.repeat(64), n: 0, last: 0, gaps: [] };\n}\n\nfunction _kvSessNote(url: string, body: string | null) {\n  if (!_kvSess) return;\n  const now = Date.now();\n  if (_kvSess.last) _kvSess.gaps.push(now - _kvSess.last);\n  if (_kvSess.gaps.length > 500) _kvSess.gaps.shift();\n  _kvSess.last = now;\n  _kvSess.n += 1;\n  _kvSess.h = _kvHex(_kvSha(_kvU8(_kvSess.h + '|' + url + '|' + (body || ''))));\n}\n\n/** Move-log commitment + timing stats for the session. Null if none started. */\nexport function kvSessionDigest(): null | {\n  head: string; moves: number; moveHash: string;\n  meanGapMs: number; cvGap: number; spanMs: number;\n} {\n  if (!_kvSess || _kvSess.n === 0) return null;\n  const g = _kvSess.gaps;\n  const mean = g.length ? g.reduce((a, b2) => a + b2, 0) / g.length : 0;\n  const varr = g.length > 1 ? g.reduce((a, b2) => a + (b2 - mean) * (b2 - mean), 0) / (g.length - 1) : 0;\n  const cv = mean > 0 ? Math.sqrt(varr) / mean : 0;\n  return {\n    head: _kvSess.head, moves: _kvSess.n, moveHash: _kvSess.h,\n    meanGapMs: Math.round(mean), cvGap: Math.round(cv * 1000) / 1000,\n    spanMs: g.reduce((a, b2) => a + b2, 0),\n  };\n}\n\nexport function kvSessionEnd() { _kvSess = null; }\n\n/** Returns true if the message was a KV_WNET message (handled here). */");
rep("note-post", "  (async () => {\n    const c = new AbortController();", "  if (method === 'POST') { try { _kvSessNote(String(m.url), typeof m.body === 'string' ? m.body : null); } catch {} }\n\n  (async () => {\n    const c = new AbortController();");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (2 edits). Move-log hash + timing stats now captured.");
