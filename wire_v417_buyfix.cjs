// wire_v417_buyfix.cjs - KasCity v417: the BUY/PASS card reads your landing lot, owners and cash from the chain record
//   of your roll (the engine may still be catching up), so BUY is no longer missing while a turn resumes.
//   node wire_v417_buyfix.cjs   (project folder; safe to run twice; backups *.bak_buyfix)
const fs = require('fs');
const MARK = '__KV_V417_BUYFIX';
const HUNKS = [["      var pos = flags()[\"p\" + m.seat];\n      var key = m.seat + \"/\" + lr.i + \"/\" + pos;", "      var pos = flags()[\"p\" + m.seat];\n      /* __KV_V417_BUYFIX: the engine may still be catching up - read where you landed, who owns what and your cash\n         from the chain record of your roll, so BUY is offered whenever the record says you can buy */\n      window.__kvLrSnap = null;\n      try { var sp = String(lr.snap || \"\").split(\"|\"); if (sp.length >= 3){ var P = sp[1].split(\",\"), C = sp[0].split(\",\"), own = {};\n        (sp[2] || \"\").split(\",\").forEach(function(x){ var q = x.match(/^t(\\d+)>(\\d)$/); if (q) own[+q[1]] = +q[2]; });\n        var cp = +P[m.seat - 1]; if (cp >= 0 && isFinite(cp)) pos = cp;\n        window.__kvLrSnap = { own: own, cash: +C[m.seat - 1] }; } } catch(eS){}\n      var key = m.seat + \"/\" + lr.i + \"/\" + pos;"], ["    var canBuy = (pos != null && N[pos] && !owner && price > 0 && cashOf(seat) >= price);\n\n    var p = ensure();", "    var SN = window.__kvLrSnap; if (SN){ owner = SN.own[pos] || null; }\n    var cashNow = (SN && isFinite(SN.cash)) ? SN.cash : cashOf(seat);\n    var canBuy = (pos != null && N[pos] && !owner && price > 0 && cashNow >= price);\n\n    var p = ensure();"]];
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 60)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_buyfix', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
