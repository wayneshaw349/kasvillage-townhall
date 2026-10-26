// wire_v417_why.cjs - KasCity v417: when your landing has nothing to buy, the PASS card says why
//   (vacant / condemned lot, owned by P#, or not enough cash).
//   node wire_v417_why.cjs   (project folder; safe to run twice; backups *.bak_why)
const fs = require('fs');
const MARK = '__KV_V417_WHY';
const HUNKS = [["    btn(\"PASS\", \"#caa64c\", function(){ close(\"pass\", 0); });\n  }", "    /* __KV_V417_WHY: say why there is nothing to buy, so PASS-only never looks like a bug */\n    if (!canBuy){\n      var why, nm = (N[pos] && N[pos].n) || null, COLS = {1:\"#d94f4f\",2:\"#4f7fd9\",3:\"#4fd98a\",4:\"#d9c14f\"};\n      if (!nm || !(price > 0)) why = [\"\ud83d\udea7 Vacant lot \u2014 nothing to buy here\", \"\ud83c\udfda\ufe0f Condemned lot \u2014 nothing to buy here\", \"\ud83c\udf3e Empty field \u2014 nothing to buy here\"][(+pos || 0) % 3];\n      else if (owner) why = \"\ud83c\udfe0 \" + nm + \" is owned by <b style='color:\" + (COLS[owner] || \"#f0c860\") + \"'>P\" + owner + \"</b>\" + (+owner === +seat ? \" (yours)\" : \" \u2014 rent paid\");\n      else why = \"\ud83d\udcb8 Not enough cash for \" + nm + \" \u2014 needs \" + price;\n      var lb = document.createElement(\"div\");\n      lb.style.cssText = \"align-self:center;padding:8px 12px;background:rgba(20,16,12,.92);border:1px solid #6a5a34;border-radius:8px;font:12px monospace;color:#e8dcc0;max-width:260px;box-shadow:0 4px 18px rgba(0,0,0,.5)\";\n      lb.innerHTML = why; p.appendChild(lb);\n    }\n    btn(\"PASS\", \"#caa64c\", function(){ close(\"pass\", 0); });\n  }"]];
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
  fs.writeFileSync(f + '.bak_why', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
