// wire_v417_lift.cjs - KasCity v417: raise pieces on the left/right streets so the lots never cover them
//   node wire_v417_lift.cjs   (project folder; safe to run twice; edits the v417 files in place, backups *.bak_lift)
const fs = require('fs');
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
const MARK = '/*KV_LIFT*/';
const HUNKS = [
  ['    var dx = tx - x, dz = tz - z;',
   '    var dx = tx - x, dz = tz - z;\n    ' + MARK + 'var lift = (!cornerish && Math.abs(x) > Math.abs(z)) ? 0.35 : 0;   // side streets: camera looks across the lots, so stand taller'],
  ['      if (Math.abs(cur[0] - lx) > 1e-3 || Math.abs(cur[2] - lz) > 1e-3){\n        n.transform.pos = [lx, cur[1] != null ? cur[1] : e[1], lz];',
   '      var ly = e[1] + lift / s;\n      if (Math.abs(cur[0] - lx) > 1e-3 || Math.abs(cur[2] - lz) > 1e-3 || Math.abs((cur[1] || 0) - ly) > 1e-3){\n        n.transform.pos = [lx, ly, lz];'],
];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (text not found, left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_lift', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
