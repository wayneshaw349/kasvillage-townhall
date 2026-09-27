// make_chain.cjs — UNIVERSAL chain-game builder: any HTML -> wallet-safe chain
// edition -> 60 KB hash-chained puzzle fragments -> bundle for the publish panel.
//
// Usage (layer1 root):
//   node src\make_chain.cjs <input.html> <gameId> [--kascity-music]
//     <input.html>      the finished game build (e.g. showcase_kascity414.html)
//     <gameId>          [a-z0-9-], e.g. kascity-414-chain
//     --kascity-music   swap the KasCity MP3 loop for the chiptune song
//                       (KasCity-only patch; omit for other games)
//
// Outputs: chain_<gameId>/frag_NNN.json + manifest.json (+ music.json with
// --kascity-music), <base>_chain.html (publish source), <base>_chain_dev.html
// (browser testing ONLY, never publish), chain_<gameId>_bundle.json (panel input).
// Scan: every fragment AND the full page must pass the html_chunks.ts rules
// (io-discipline included) or the build ABORTS. After TownHall verify, add the
// printed HEAD to TRUSTED_GAMES (game_chunks.ts) and to games_to_publish.json.
const fs = require("fs"), path = require("path"), zlib = require("zlib"), crypto = require("crypto");
const ARGS = process.argv.slice(2);
const SRC = ARGS[0], GAME = ARGS[1];
const KASCITY_MUSIC = ARGS.includes("--kascity-music");
if (!SRC || !GAME || !/^[a-z0-9-]+$/.test(GAME)) { console.error("usage: node src\\make_chain.cjs <input.html> <gameId> [--kascity-music]"); process.exit(1); }
const BASE = SRC.replace(/\.html?$/i, "");
const OUT_HTML = BASE + "_chain.html", OUT_DEV = BASE + "_chain_dev.html", DIR = "chain_" + GAME;
const CHUNK = 1600, KAS_PER_CHUNK = 0.2;
const SONG = {"v":2,"style":"chiptune","seed":"kv_music_loop","bpm":136,"key":0,"scale":"major","voice":{"lead":{"wave":"square","vib":0,"vol":0.08,"len":1.8},"bass":{"wave":"triangle","drive":false,"max":1.2},"kick":"chip"},"lead":".......4...4..........5....5..........9....8...........6...6....","bass":".3....2d.........4....3e...........6..6...........5...4f........","kick":"k......k..k..k..k......k...k..k.k......k..k...k.k.....k...k...k.","snare":"....s.......s.......s.......s.......s.......s.......s.......s...","hats":"..h...h...h...h...h...h...h...h...h...h...h...h...h...h...h...h."};
const MUSIC_ON = KASCITY_MUSIC
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

let html = fs.readFileSync(SRC, "utf8");
const srcSha = sha(Buffer.from(html, "utf8"));
console.log("src " + SRC + "  sha256 " + srcSha);
let n = 0;
function rep(name, find, to, expected) {
  const found = typeof find === "string" ? html.split(find).length - 1 : (html.match(find) || []).length;
  if (found !== expected) { console.error("ABORT [" + name + "]: expected " + expected + ", found " + found); process.exit(1); }
  html = typeof find === "string" ? html.split(find).join(to) : html.replace(find, to); n++; console.log("ok  [" + name + "]");
}
if (KASCITY_MUSIC) {
rep("chain-drop-mp3", /window\.KV_MUSIC = new Audio\("data:audio\/mpeg;base64,[A-Za-z0-9+\/=]+"\);/g, "window.KV_MUSIC = new Audio();", 1);
rep("chain-default-song", "window.KV_MUSIC.playbackRate = 1.0;\n",
    "window.KV_MUSIC.playbackRate = 1.0;\nwindow.KV_MM_DEFAULT = " + JSON.stringify(SONG) + ";   // __KV_CHAIN: transcribed loop\n", 1);
rep("chain-mm-song", '  if(!song) song=gen(CHIP,"kascity",-1);',
    '  if(!song) song=(window.KV_MM_DEFAULT&&valid(window.KV_MM_DEFAULT))?window.KV_MM_DEFAULT:gen(CHIP,"kascity",-1);', 1);
rep("chain-mm-use", '  try{ if(localStorage.getItem(LS_USE)==="1"&&window.KV_MUSIC) useGame(true); }catch(e){}',
    '  try{ var __u=localStorage.getItem(LS_USE); if((__u==="1"||(__u===null&&window.KV_MM_DEFAULT))&&window.KV_MUSIC) useGame(true); }catch(e){}', 1);
}
function repAll(name, re, to) {
  const c = (html.match(re) || []).length;
  if (c) html = html.replace(re, to);
  console.log("ok  [" + name + "] x" + c);
}
repAll("chain-wnet-clipcond", /navigator\.clipboard && navigator\.clipboard\.writeText/g, "window.KV_WNET && KV_WNET.copy");
repAll("chain-wnet-clip", /navigator\.clipboard\.writeText\(/g, "KV_WNET.copy(");
repAll("chain-wnet-fetch", /\bfetch\s*\(/g, "KV_WNET.req(");
const STUB = '<script>window.KV_WNET=window.KV_WNET||{req:function(){return Promise.reject(new Error("offline: open KasCity in the KasVillage wallet"));},copy:function(){return Promise.reject(new Error("no clipboard"));}};</script>\n';
const DEV  = '<script>/* DEV ONLY - never publish */window.KV_WNET={req:function(u,o){return window.fetch(u,o);},copy:function(t){return navigator.clipboard.writeText(t);}};</script>\n';
fs.writeFileSync(OUT_DEV, DEV + html);
html = STUB + html;
fs.writeFileSync(OUT_HTML, html);

const raw = Buffer.from(html, "utf8"), h = sha(raw);

// ---- PUZZLE: <=60,000-byte fragments, hash-chained --------------------------
// Each fragment is a plain slice of the page, so it passes html_chunks.ts
// scanHtmlForPublish ON ITS OWN (60 KB cap included) and publishes/fetches with
// the existing publishHtmlChunks / fetchHtmlPage (keyed by the fragment's h).
// link_i = sha256(link_{i-1} + h_i), link_{-1} = 64 zeros. The last link (HEAD)
// commits to every fragment and its order: pin HEAD, and the wallet can verify
// the whole puzzle from any manifest.
const FRAG_MAX = 60000, ZERO = "0".repeat(64), SLOT_MAX = 300;   // <=300 chunk records per address
const frags = [];
for (let pos = 0, prev = ZERO; pos < html.length; ) {
  let end = Math.min(html.length, pos + FRAG_MAX);
  while (Buffer.byteLength(html.slice(pos, end), "utf8") > FRAG_MAX) end -= 256;
  if (end < html.length) { const nl = html.lastIndexOf("\n", end); if (nl > pos + FRAG_MAX / 2) end = nl + 1; }
  if (end < html.length && /[\uD800-\uDBFF]/.test(html[end - 1])) end--;   // never split a surrogate pair
  const text = html.slice(pos, end), fh = sha(Buffer.from(text, "utf8")), link = sha(Buffer.from(prev + fh, "utf8"));
  const nChunks = Math.ceil(zlib.deflateSync(Buffer.from(text, "utf8"), { level: 9 }).toString("base64").length / CHUNK);
  frags.push({ i: frags.length, h: fh, prev, link, bytes: Buffer.byteLength(text, "utf8"), chunks: nChunks, text });
  prev = link; pos = end;
}
const head = frags[frags.length - 1].link;
let slot = 0, used = 0;
for (const f of frags) { if (used + f.chunks > SLOT_MAX) { slot++; used = 0; } f.slot = slot; used += f.chunks; }
const tot = frags.reduce((a, f) => a + f.chunks, 0);

fs.mkdirSync(DIR, { recursive: true });
for (const f of fs.readdirSync(DIR)) if (/^(part|frag)_\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f));
for (const f of frags) fs.writeFileSync(path.join(DIR, "frag_" + String(f.i).padStart(3, "0") + ".json"),
  JSON.stringify({ kind: "kv_frag", v: 1, game: GAME, i: f.i, n: frags.length, h: f.h, prev: f.prev, link: f.link, bytes: f.bytes, text: f.text }));
const music = MUSIC_ON ? { kind: "kv_song", v: 1, id: "kv_music_loop", song: SONG, sha256: sha(Buffer.from(JSON.stringify(SONG), "utf8")) } : null;
if (music) fs.writeFileSync(path.join(DIR, "music.json"), JSON.stringify(music));
const manifest = { kind: "kv_game_manifest", v: 2, game: GAME, build: GAME, source_sha256: srcSha,
  html_sha256: h, html_bytes: raw.length, head, frag_max: FRAG_MAX, total_chunks: tot, est_kas: +(tot * KAS_PER_CHUNK).toFixed(1),
  slots: slot + 1, frags: frags.map(f => ({ i: f.i, h: f.h, link: f.link, bytes: f.bytes, chunks: f.chunks, slot: f.slot })),
  addresses: new Array(slot + 1).fill(null),
  music: music ? { file: "music.json", id: music.id, sha256: music.sha256, embedded: true } : null };
fs.writeFileSync(path.join(DIR, "manifest.json"), JSON.stringify(manifest, null, 1));

// ---- solve the puzzle from the files on disk, exactly as the wallet will ----
const m2 = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
let prevL = ZERO, joined = "";
for (const fr of m2.frags) {
  const body = JSON.parse(fs.readFileSync(path.join(DIR, "frag_" + String(fr.i).padStart(3, "0") + ".json"), "utf8"));
  const fh = sha(Buffer.from(body.text, "utf8"));
  if (fh !== fr.h || body.prev !== prevL || sha(Buffer.from(prevL + fh, "utf8")) !== fr.link) { console.error("ABORT: chain broken at fragment " + fr.i); process.exit(1); }
  if (Buffer.byteLength(body.text, "utf8") > FRAG_MAX) { console.error("ABORT: fragment " + fr.i + " over 60 KB"); process.exit(1); }
  prevL = fr.link; joined += body.text;
}
if (prevL !== m2.head || sha(Buffer.from(joined, "utf8")) !== m2.html_sha256) { console.error("ABORT: puzzle does not solve to the game"); process.exit(1); }

// ---- html_chunks.ts scanHtmlForPublish, rule for rule ----
const BLOCKED = [[/(seed|recovery|secret)\s*phrase/i,"seed_phrase_prompt"],[/\b(mnemonic|12\s*[- ]?words?|24\s*[- ]?words?)\b/i,"mnemonic_prompt"],
  [/setApprovalForAll/i,"unlimited_approval"],[/eval\s*\(\s*(atob|unescape|String\.fromCharCode)/i,"obfuscated_eval"],[/Function\s*\(\s*atob/i,"obfuscated_function"],
  [/document\.write\s*\(\s*(atob|unescape)/i,"obfuscated_write"],[/<iframe/i,"iframe_not_allowed"],[/clipboard(Data)?\.(setData|writeText)/i,"clipboard_write"],
  [/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i,"network_call"],[/<script[^>]*\ssrc\s*=/i,"external_script"]];
const issues = [];
for (const [re, code] of BLOCKED) { const m = html.match(re); if (m) issues.push(code + ' "' + String(m[0]).slice(0, 40) + '"'); }
const refRe = /(?:href|src|action)\s*=\s*["']([^"']+)["']/gi; let rm;
while ((rm = refRe.exec(html)) !== null) { const v = rm[1].trim(); if (!(v.startsWith("kv://") || v.startsWith("#") || v.startsWith("data:image/"))) issues.push("external_ref " + v.slice(0, 60)); }
if (raw.length > 8000000) issues.push("too_large for the 8 MB game cap");
for (const f of frags) {                                   // every fragment on its own, 60 KB cap included
  for (const [re, code] of BLOCKED) if (re.test(f.text)) issues.push("fragment " + f.i + ": " + code);
  const fr = /(?:href|src|action)\s*=\s*["']([^"']+)["']/gi; let x;
  while ((x = fr.exec(f.text)) !== null) { const v = x[1].trim(); if (!(v.startsWith("kv://") || v.startsWith("#") || v.startsWith("data:image/"))) issues.push("fragment " + f.i + ": external_ref"); }
}
if (issues.length) { console.error("ABORT: wallet scan would block:\n  " + issues.join("\n  ")); process.exit(1); }

console.log("\nchain html  " + OUT_HTML + "  " + raw.length + " bytes  sha256 " + h);
console.log("puzzle      " + frags.length + " fragments <= 60,000 bytes, HEAD " + head);
console.log("chunks      " + tot + " x " + CHUNK + " chars across " + (slot + 1) + " address slot(s)  (~" + manifest.est_kas + " KAS at " + KAS_PER_CHUNK + "/chunk)");
console.log("solve       OK (hash chain + HEAD + full SHA from " + DIR + "/*.json)");
fs.writeFileSync("chain_" + GAME + "_bundle.json", JSON.stringify({ manifest: m2, frags: m2.frags.map((fr) => JSON.parse(fs.readFileSync(path.join(DIR, "frag_" + String(fr.i).padStart(3, "0") + ".json"), "utf8"))) }));
console.log("bundle      chain_" + GAME + "_bundle.json  (panel input)");
console.log("wallet scan PASS: every fragment under the existing 60 KB rules + full page   dev copy: " + OUT_DEV);
// ---- registry for the Workspace panel (static requires for Metro) ----------
// games_to_publish.js maps gameId -> { bundle, head, nonceBase }. Slot addresses
// derive at nonceBase+slot, the manifest at nonceBase+86. KasCity keeps 9414
// (manifest 9500, the already-derived addresses); new games get base+100 each.
const REG = "games_to_publish.js";
let entries = {};
if (fs.existsSync(REG)) {
  const src = fs.readFileSync(REG, "utf8");
  for (const mm of src.matchAll(/'([a-z0-9-]+)':\s*\{\s*bundle:\s*require\('\.\/(.*?)'\),\s*head:\s*'([0-9a-f]{64})',\s*nonceBase:\s*(\d+)/g))
    entries[mm[1]] = { file: mm[2], head: mm[3], nonceBase: +mm[4] };
}
const bases = Object.values(entries).map((e) => e.nonceBase);
const nonceBase = entries[GAME] ? entries[GAME].nonceBase : (bases.length ? Math.max(...bases) + 100 : 9414);
entries[GAME] = { file: "chain_" + GAME + "_bundle.json", head: head, nonceBase };
const lines = Object.entries(entries).map(([id, e]) =>
  "  '" + id + "': { bundle: require('./" + e.file + "'), head: '" + e.head + "', nonceBase: " + e.nonceBase + " },");
fs.writeFileSync(REG, "// generated by make_chain.cjs — one entry per publishable chain game\n" +
  "// (static requires so Metro bundles every game's fragments)\nmodule.exports = {\n" + lines.join("\n") + "\n};\n");
console.log("registry    " + REG + "  (" + GAME + " @ nonceBase " + nonceBase + ")");
console.log("NEXT: TownHall verify -> pin HEAD in TRUSTED_GAMES; the panel lists every registry game");
