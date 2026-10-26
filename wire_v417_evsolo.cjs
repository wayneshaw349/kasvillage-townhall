// wire_v417_evsolo.cjs - KasCity v417: the table-life scenes (SOLD signs, construction, offers, scenario cards) also play
//   in solo games against bots, not only in multiplayer.
//   node wire_v417_evsolo.cjs   (project folder, after wire_v417_events; safe to run twice; backups *.bak_evsolo)
const fs = require('fs');
const MARK = '__KV_V417_EVSOLO';
const NEED = '__KV_V417_EVENTS';
const HUNKS = [["        var M = window.KV_MP2; if (!(M && M.room && M.started)) return;\n        var mv = window.KV_MOVES || [];\n        if (seenI === null){ seenI = 0; for (var k = 0; k < mv.length; k++) if (mv[k] && mv[k].__acked) seenI = k; return; }   // history is not replayed\n        for (var i = seenI + 1; i < mv.length; i++){\n          var r = mv[i]; if (!r || !r.__acked) break; seenI = i;", "        /* __KV_V417_EVSOLO: solo games have no relay, so their moves count as soon as they are recorded */\n        var M = window.KV_MP2, mp = !!(M && M.room); if (mp && !M.started) return;\n        var mv = window.KV_MOVES || [], okm = function(r){ return !!r && (mp ? !!r.__acked : true); };\n        if (seenI === null){ seenI = -1; for (var k = 0; k < mv.length; k++) if (okm(mv[k])) seenI = k; return; }   // history is not replayed\n        if (mv.length <= seenI) seenI = mv.length - 1;                                       // a new game started a fresh list\n        for (var i = seenI + 1; i < mv.length; i++){\n          var r = mv[i]; if (!okm(r)) break; seenI = i;"]];
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  if (!t.includes(NEED)) { console.log('  FAIL  ' + f + ' (run wire_v417_events.cjs first)'); bad++; continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 60)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_evsolo', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
