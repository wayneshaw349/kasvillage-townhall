// wire_v417_rollfb.cjs - KasCity v417: bold "ROLL RECORDED" when the relay confirms your roll, bold "ROLL NOT ACCEPTED"
//   (with the reason) when a tap or a held roll does not count.
//   node wire_v417_rollfb.cjs   (project folder, after wire_v417_oneroll; safe to run twice; backups *.bak_rollfb)
const fs = require('fs');
const MARK = '__KV_V417_ROLLFB';
const NEED = '__KV_V417_ONEROLL';
const ANCHOR = '  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);\n';
const HUNKS = [[ANCHOR, ANCHOR + "\n  // ---- __KV_V417_ROLLFB: tell the player what the record did with their roll ----\n  (function(){\n    var COL = {1:\"#d94f4f\",2:\"#4f7fd9\",3:\"#4fd98a\",4:\"#d9c14f\"}, seenI = null, lastNo = 0;\n    function me(){ var M = window.KV_MP2; return (M && M.room && M.started) ? M.seat : null; }\n    window.__kvRollNo = function(why){\n      if (Date.now() - lastNo < 1500) return; lastNo = Date.now();\n      var d = toast(\"<b style='font:900 15px monospace;color:#ff8a6a'>\u2717 ROLL NOT ACCEPTED</b><br><span style='font:400 11px monospace;color:#e8dcc0'>\" + why + \"</span>\", 1600);\n      d.style.borderColor = \"#ff8a6a\";\n    };\n    setInterval(function(){\n      try {\n        var s = me(); if (!s) return;\n        var mv = window.KV_MOVES || [];\n        if (seenI === null){ seenI = 0; for (var k = 0; k < mv.length; k++) if (mv[k] && mv[k].__acked) seenI = Math.max(seenI, k); return; }   // only rolls from now on\n        for (var i = seenI + 1; i < mv.length; i++){\n          var r = mv[i]; if (!r || !r.__acked) break;\n          seenI = i;\n          if (String(r.a) === \"roll\" && +r.s === +s){\n            var dv = (r.d1 != null && r.d2 != null) ? (r.d1 + \" + \" + r.d2 + \" = \" + (+r.d1 + +r.d2)) : (\"rolled \" + r.v);\n            var d = toast(\"<b style='font:900 15px monospace;color:\" + (COL[s] || \"#f0c860\") + \"'>\u2713 ROLL RECORDED</b><br><span style='font:400 11px monospace;color:#e8dcc0'>\" + dv + \"</span>\", 1500);\n            d.style.borderColor = COL[s] || \"#caa64c\"; d.style.top = \"30%\";\n          }\n        }\n      } catch(e){}\n    }, 250);\n    // the relay or the turn gate turned our own roll away\n    setInterval(function(){\n      var f = window.KV_LOG; if (!f || f.__kvFb) return;\n      var g = function(m){\n        try {\n          var s = me(), t = String(m || \"\"), x;\n          if (s && (x = t.match(/^dropped P(\\d) roll \u2014 (.*)$/)) && +x[1] === +s) window.__kvRollNo(x[2]);\n          else if (s && (x = t.match(/^relay refused roll P(\\d)/)) && +x[1] === +s) window.__kvRollNo(\"the relay did not take it \u2014 syncing\");\n        } catch(e){}\n        return f.apply(this, arguments);\n      };\n      g.__kvFb = 1; window.KV_LOG = g;\n    }, 300);\n  })();\n"], ["          toast(st.rolled ? \"You already rolled \u2014 finish your turn\" : (\"Waiting for P\" + st.exp + \"\u2026\"), 1300);", "          if (window.__kvRollNo) window.__kvRollNo(st.rolled ? \"you already rolled \u2014 finish your turn\" : (\"waiting for P\" + st.exp + \"\u2026\")); else toast(st.rolled ? \"You already rolled \u2014 finish your turn\" : (\"Waiting for P\" + st.exp + \"\u2026\"), 1300);"]];
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  if (!t.includes(NEED)) { console.log('  FAIL  ' + f + ' (run wire_v417_oneroll.cjs first)'); bad++; continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 60)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_rollfb', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
