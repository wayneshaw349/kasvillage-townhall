// fix_filter_gaps.cjs - closes the two filter gaps.
// 1) weapons plurals in the wallet strict rule (glock switches, ghost guns, pipe bombs, auto sears)
// 2) hate-speech slurs: stored as one-way hashes (no slur text in the repo), matched per word
//    after leet/homoglyph folding, spaced-letter joining and repeated-letter collapsing.
const fs = require('fs');
const f = 'content_filter.ts';
const H = ["290fedowzxm","2b2kccjuv0w","11ss8oogt2v","2emij7gma9o","185u4j9ttf4","l4mgaol78h","h87zqcsx1w","rw3cx7reim","mlt0jihr27","289s4sk5k0h","eh7iobl40h","2fvyjgluvdp","ty98s3d25n","2der11syiqa","zjk6ililhr","6voycgqet3","21ty6l0rgna","1yb4v3xe0cz","28v6b0u8vkz","zhni53yb3d","gu49stghk1","28ck4tiqn7e","1wplasgwpff","1przrfzaals","1zrd2j8vsmf","srk67wdl5t","129l8tpj8sg","vi8tdv2zez","1rtyqgyzuky","jrh5q4ow5d","1juwujy5mr5","26jmnd3spaf","2gmmzy29cdy","1wbotkru6hq","186sumx36d3","1jrd0dw7849","18w145ebwdo","20wzofpb3ao","5kjxfze1q3","o5l7pnqrfm","m4rohoj1yj","dx9hawcpgx","471lgat23n","kxmcwsksfu","19msgyli5ey","2fzka2ng7xn","f53l6ch7n1","qxjy0vr59n","wockg5ryhp","22a9k8ri4yi","1iyn1b0tqxo","1pni8ch55wm","1hbtct98zrl","1icxm6zkn","1yxfvenhtrx","1ba93vnmyqm","5np8sxr9we","1netqdgpxa9","w369h45do7","7nbwxbj29k","ztfi243qvw","121jd5w8af9","1i0zpzy6o3w","10z468hffnn","19d6p5z6z7m","hg2ii883ky","1j1qwvwsnk2","glomqjppta","1z8rhwlkuza","1rmj2mn2gu7","e0ppld9ejv","f0apautbt5","1mwa1fmybwg","2g70xqs5o1i","1ule6bwm0ux","1qx68k1acht","chxuc2i3b5","191xtx07s2c","c03r97eg7d","lz91vv8on","1nssmemqqct","ew90rmzw1z","8y650lk4e5","2d8yhtbxomi","1xaam8gv69d","2f6myylzo94","88t7180tpj","15vgabghx1s","185deefbthm","7576pqtkwb","14gec39qhk0","269j0qdck6x","s3mp5e218z","19fjyv8x5st","2ba044ixyyx","qg9xfcr3s6","1tb1392lnwt","8ofug523qf","tgmzh81du8","vh5o3duqds","1nkyewz3xk9","27w7bwz0k04","1gifzmbsn16","vdqr5xpu1e","3d2p17eek1","21125toalw0","gdsgpjilru","dv9hebmx2h","18s29hvomaw","smy3hkryx8","1131w074luk","1li72xsgara","hksbblglss","1cw4gn0fzlb","ulfuhtectn","1lpah2z6yrp","gifgzbh3r9","biti05edfn","d94tdns41v","22cg91q04kq","1aub70skg2u","2c8foey9xgq","sfb0p0vwqn"];
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_SLUR_HASH')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [
  ["['weapons', /\\b(ghost gun|auto sear|glock switch|", "['weapons', /\\b(ghost guns?|auto sears?|glock switch(es)?|"],
  ["|pipe bomb|grenades?|", "|pipe bombs?|grenades?|"],
  ["export function scanObjectStrict(obj: any): any {",
   "// KV_SLUR_HASH: one-way hashes of slurs (+ plurals, letter-collapsed forms). Matches whole words only.\n" +
   "const KV_SLUR_H = new Set<string>(" + JSON.stringify(H) + ");\n" +
   "function kvH53(str: string): string { let h1 = 0xdeadbeef ^ 0x6b76, h2 = 0x41c6ce57 ^ 0x6b76;\n" +
   "  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }\n" +
   "  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);\n" +
   "  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);\n" +
   "  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }\n" +
   "function kvSlurHit(t: string): boolean {\n" +
   "  for (const w of String(t || '').toLowerCase().split(/[^a-z]+/)) {\n" +
   "    if (w.length < 4 || w.length > 24) continue;\n" +
   "    if (KV_SLUR_H.has(kvH53(w)) || KV_SLUR_H.has(kvH53(w.replace(/(.)\\1+/g, '$1')))) return true;\n" +
   "  }\n  return false;\n}\n" +
   "export function scanObjectStrict(obj: any): any {"],
  ["    for (const [reason, re] of KV_STRICT_RULES) if (re.test(n)",
   "    if (kvSlurHit(n) || kvSlurHit(nL) || kvSlurHit(sq) || kvSlurHit(raw)) return { ok: false, reason: 'slur', path: p };\n    for (const [reason, re] of KV_STRICT_RULES) if (re.test(n)"],
];
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1. Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched (' + H.length + ' slur hashes, weapons plurals)');
// test file: add cases (slur samples are base64 so the test file holds no slur text either)
const tf = 'test_content_filter.cjs';
if (fs.existsSync(tf)) {
  let t = fs.readFileSync(tf, 'utf8'); const tC = t.includes('\r\n'); if (tC) t = t.replace(/\r\n/g, '\n');
  if (!t.includes('KV_GAP_CASES')) {
    const a = "  ['ok', 'board game shop', { n: 'KasCity board game' }, A],\n";
    if (t.split(a).length - 1 === 1) {
      t = t.replace(a, a + "  // KV_GAP_CASES\n" +
        "  ['weapons', 'glock switches plural', { d: 'glock switches in stock' }, B],\n" +
        "  ['weapons', 'pipe bombs plural', { d: 'pipe bombs for sale' }, B],\n" +
        "  ['slur', 'slur plain', { t: Buffer.from('eW91IGZhZ2dvdA==', 'base64').toString() }, B],\n" +
        "  ['slur', 'slur leet', { t: Buffer.from('ZjRnZzB0IHN0b3Jl', 'base64').toString() }, B],\n" +
        "  ['slur', 'slur spaced', { t: Buffer.from('ayBpIGsgZQ==', 'base64').toString() }, B],\n" +
        "  ['slur', 'slur stretched', { t: Buffer.from('Z29vb29vayBnYW1l', 'base64').toString() }, B],\n" +
        "  ['ok', 'spice rack', { n: 'Spice rack and spicy sauce' }, A],\n" +
        "  ['ok', 'Niger river trip', { d: 'Niger river boat trip' }, A],\n" +
        "  ['ok', 'raccoon plush', { n: 'Raccoon plush and Maine Coon cat toys' }, A],\n" +
        "  ['ok', 'Pakistani tea', { n: 'Pakistani chai and Kikeriki cafe' }, A],\n" +
        "  ['ok', 'Merchant of Venice', { d: 'Shakespeare: The Merchant of Venice, bundle of fagots for firewood' }, A],\n");
      t = t.replace("if (!/const SLURS: string\\[\\] = \\[\\s*['\"]/.test(src))", "if (!/const SLURS: string\\[\\] = \\[\\s*['\"]/.test(src) && !/KV_SLUR_HASH/.test(src))");
      fs.writeFileSync(tf, tC ? t.replace(/\n/g, '\r\n') : t); console.log(tf + ': 11 cases added');
    } else console.log(tf + ': anchor not found - cases not added');
  }
}
console.log('DONE - run: node test_content_filter.cjs');
