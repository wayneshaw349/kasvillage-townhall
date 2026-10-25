// wire_v417_clear.cjs - KasCity v417: pieces sharing a lot spread wider, and block-sign labels fade when a piece is under them
//   node wire_v417_clear.cjs   (project folder; safe to run twice; edits the v417 files in place, backups *.bak_clear)
const fs = require('fs');
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
const MARK = '/*KV_CLEAR*/';
const HUNKS = [
  ['  setInterval(function(){ try { slim(); } catch(e){} }, 250);\n',
   '  setInterval(function(){ try { slim(); } catch(e){} }, 250);\n' + '  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);\n  // street names on the lots fade while a piece stands under them, so the piece stays readable\n  var names = null;\n  function fadeNames(){\n    var PW = window.__kvPW, cv = document.querySelector("canvas"); if (!PW || !window.KV_PROJECT || !cv) return;\n    var r = cv.getBoundingClientRect(), sx = r.width / cv.width, sy = r.height / cv.height, pts = [];\n    for (var p in PW){ var q = window.KV_PROJECT({ x: PW[p][0], y: 0.7, z: PW[p][1] }); if (q) pts.push([r.left + q.x * sx, r.top + q.y * sy]); }\n    if (!names || !names.length) names = [].filter.call(document.querySelectorAll("body > div"), function(d){ return /z-index: 56/.test(d.style.cssText) && /width: 74px/.test(d.style.cssText); });\n    names.forEach(function(d){\n      if (d.style.display === "none") return;\n      var b = d.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, near = false;\n      pts.forEach(function(t){ if (Math.abs(t[0] - cx) < 40 && Math.abs(t[1] - cy) < 22) near = true; });\n      var o = near ? "0.2" : ""; if (d.style.opacity !== o) d.style.opacity = o;\n    });\n  }\n'],
  ['g.forEach(function(p, i){ var sl = sp[i].slice(); sl.crowd = g.length; place(p, sl); });',
   'g.forEach(function(p, i){ var sl = sp[i].slice(); sl.crowd = g.length; sl.idx = i; place(p, sl); });'],
  ['    var cornerish = Math.abs(Math.abs(x) - Math.abs(z)) < 1.2;\n',
   '    var cornerish = Math.abs(Math.abs(x) - Math.abs(z)) < 1.2;\n' +
   '    if (!cornerish && Math.abs(x) > Math.abs(z) && slot.crowd > 1){   // side streets: the camera looks down the street, so pieces in a row hide each other -> 2-wide grid instead\n' +
   '      var rows = Math.ceil(slot.crowd / 2), row = Math.floor(slot.idx / 2);\n' +
   '      across = (slot.idx % 2) ? -0.1 : -1.15; along = rows > 1 ? (row ? 0.8 : -0.8) : 0;\n' +
   '    }\n'],
  ['out.push([0.8 * f,', 'out.push([(n > 2 ? 1.0 : 0.8) * f,'],
  ['    var dx = tx - x, dz = tz - z;\n',
   '    var dx = tx - x, dz = tz - z;\n    ' + MARK + '(window.__kvPW = window.__kvPW || {})[p] = [tx, tz];\n'],
  ['      d.style.left = (r.left + q.x * sx) + "px"; d.style.top = (r.top + q.y * sy) + "px"; d.style.display = "block";',
   '      var Lx = r.left + q.x * sx, Ly = r.top + q.y * sy, near = false, PW = window.__kvPW || {};\n' +
   '      for (var pp in PW){ var pq = window.KV_PROJECT({ x: PW[pp][0], y: 0.7, z: PW[pp][1] }); if (pq && Math.abs(r.left + pq.x * sx - Lx) < 46 && Math.abs(r.top + pq.y * sy - Ly) < 40) near = true; }\n' +
   '      d.style.opacity = near ? "0.18" : "1";   // a piece is standing under the sign: let it show through\n' +
   '      d.style.left = Lx + "px"; d.style.top = Ly + "px"; d.style.display = "block";'],
];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 50)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (text not found, left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_clear', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
