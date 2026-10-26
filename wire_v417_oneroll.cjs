// wire_v417_oneroll.cjs - KasCity v417: one roll per turn on your screen. Taps on Roll only count when the chain
//   says it is your turn and you have not rolled yet (extra taps used to move your piece 2-3 times locally).
//   node wire_v417_oneroll.cjs   (project folder, after wire_v417_back; safe to run twice; backups *.bak_oneroll)
const fs = require('fs');
const MARK = '__KV_V417_ONEROLL';
const NEED = '__KV_V417_BACK';
const ANCHOR = '  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);\n';
const BLOCK = "\n  // ---- __KV_V417_ONEROLL: one roll per turn on your screen ----\n  // Your own taps on Roll only count when the chain says it is your turn and you have not rolled yet.\n  // Extra taps used to move your piece again locally (the chain kept one roll, then a resync pulled you\n  // back), so the board showed two or three moves. Replays of other players (synthetic clicks) pass.\n  (function(){\n    function chainTurn(me){\n      var mv = (window.KV_MOVES || []), M = window.KV_MP2 || {}, lr = null, lri = -1;\n      for (var i = mv.length - 1; i >= 0; i--){ var r = mv[i]; if (r && String(r.a) === \"roll\" && (r.__acked || (r.__sent && +r.s === +me))){ lr = r; lri = i; break; } }\n      if (!lr){ var op = M.opener || null; return { exp: op, rolled: false }; }\n      var closed = false;\n      for (var j = lri + 1; j < mv.length; j++){ var q = mv[j]; if (q && q.__acked && +q.s === +lr.s && /^(buy|pass|end|court)$/.test(String(q.a))){ closed = true; break; } }\n      if (!closed) return { exp: +lr.s, rolled: +lr.s === +me };\n      return { exp: (+lr.s % 4) + 1, rolled: false };\n    }\n    function isRoll(el){\n      if (!el || !el.closest) return false;\n      if (el.closest(\"#kvbigroll\")) return true;\n      var c = el.closest(\"div[data-i],button\"); return !!(c && /^\\s*\u25b8?\\s*Roll\\b|^ROLL$/i.test((c.textContent || \"\").trim()));\n    }\n    var lastNote = 0;\n    function guard(e){\n      try {\n        if (!e.isTrusted) return;                                                   // engine replays are synthetic\n        var M = window.KV_MP2; if (!(M && M.room && M.started)) return;\n        if (!isRoll(e.target)) return;\n        var me = M.seat, st = chainTurn(me);\n        if (st.exp == null) return;                                                 // opener not known yet: leave it\n        if (st.exp === me && !st.rolled) return;                                    // your turn, first roll: go\n        e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();\n        if (Date.now() - lastNote > 1500 && e.type === \"click\"){\n          lastNote = Date.now();\n          toast(st.rolled ? \"You already rolled \u2014 finish your turn\" : (\"Waiting for P\" + st.exp + \"\u2026\"), 1300);\n        }\n      } catch(x){}\n    }\n    [\"pointerdown\", \"mousedown\", \"touchstart\", \"pointerup\", \"mouseup\", \"touchend\", \"click\"].forEach(function(t){ document.addEventListener(t, guard, true); });\n  })();\n";
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  if (!t.includes(NEED)) { console.log('  FAIL  ' + f + ' (run wire_v417_back.cjs first)'); bad++; continue; }
  if (t.split(ANCHOR).length !== 2) { console.log('  FAIL  ' + f + ' (anchor not found, left untouched)'); bad++; continue; }
  t = t.replace(ANCHOR, () => ANCHOR + BLOCK);
  fs.writeFileSync(f + '.bak_oneroll', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
