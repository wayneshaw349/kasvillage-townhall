// wire_v417_green.cjs - KasCity v417:
//   1) pieces stand on the green, just inside the curb (not on the sidewalk)
//   2) landing on a P1-owned lot charges rent in multiplayer (it used to fall through to a Pass-only prompt)
//   node wire_v417_green.cjs   (project folder; safe to run twice; edits the v417 files in place, backups *.bak_green)
const fs = require('fs');
const MARK = '/*KV_GREEN*/';
const PIECES = [
  ['  var W = 8.62;', '  var W = 7.55; ' + MARK],
  ['var lift = (!cornerish && Math.abs(x) > Math.abs(z)) ? 0.35 : 0;', 'var lift = 0;'],
  ['across = (slot.idx % 2) ? -0.1 : -1.15;', 'across = (slot.idx % 2) ? -0.05 : -0.85;'],
];
const RENT = /ownerOf\('t(\d+)'\) == 1 && seat\(\) > world\.flags\.humans/g;   // solo-era rule: only bots paid P1
const FILES = [['showcase_kascity_v417.html', true], ['dev_kascity_v417_browser.html', true], ['tools/v417/v417_runtime.js', false]];
let bad = 0;
for (const [f, game] of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of PIECES) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a); break; } t = t.replace(a, () => b); }
  let n = 0;
  if (ok && game) { t = t.replace(RENT, (m, k) => { n++; return "ownerOf('t" + k + "') == 1 && seat() != 1"; }); if (n !== 100) { ok = false; console.log('    rent rules found: ' + n + ' (expected 100)'); } }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_green', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f + (game ? '  (' + n + ' rent rules fixed)' : ''));
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
