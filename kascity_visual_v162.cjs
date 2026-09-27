// kascity_visual_v162.cjs
// Reads showcase_kascity161.html -> showcase_kascity162.html
// MOVEMENT TRACE. Every position change for every seat is recorded into the move log, so the
// result JSON shows whether a "jump backwards" is a real mis-step or just the token animating
// across the board on a wrap.
// Records (seat 0, action "M:<detail>", v = landing tile):
//   from -> to, the dice total, the expected landing tile (from + dice, mod 40),
//   whether it matched, the tile names of both ends, and a WRAP marker when it crosses GO.
// Any mismatch is also shouted on screen in red.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity161.html')) die('showcase_kascity161.html missing');
let html = fs.readFileSync('showcase_kascity161.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

const anchor = '// ---- stall detector (escalating) ----';
if (html.split(anchor).length - 1 !== 1) die('anchor not unique');
html = html.replace(anchor,
  '// ---- movement trace (v162) ----' + EOL +
  '(function(){' + EOL +
  '  var last = {}, lastDice = {};' + EOL +
  '  function nm(t){ var N = window.KV_NAMES || {}; return (N[t] && N[t].n) || ("tile " + t); }' + EOL +
  '  setInterval(function(){' + EOL +
  '    var f = (window.KV_FLAGS && window.KV_FLAGS()) || {};' + EOL +
  '    if (!(f.t0 > 0) || window.KV_SEALED) return;' + EOL +
  '    var dice = (f.d1 || 0) + (f.d2 || 0);' + EOL +
  '    for (var p = 1; p <= 4; p++) {' + EOL +
  '      var cur = f["p" + p];' + EOL +
  '      if (cur == null) continue;' + EOL +
  '      if (last[p] == null) { last[p] = cur; continue; }' + EOL +
  '      if (cur === last[p]) continue;' + EOL +
  '      var from = last[p], to = cur; last[p] = cur;' + EOL +
  '      var expect = ((from + dice) % 40 + 40) % 40;' + EOL +
  '      var fwd = ((to - from) % 40 + 40) % 40;' + EOL +
  '      var wrap = (to < from) ? " WRAP" : "";' + EOL +
  '      var okm = (to === expect) ? "ok" : "MISMATCH";' + EOL +
  '      var line = "M:P" + p + " " + from + "->" + to + " dice=" + dice + " expect=" + expect +' + EOL +
  '                 " step=" + fwd + " " + okm + wrap;' + EOL +
  '      if (window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), to);' + EOL +
  '      if (window.KV_LOG) window.KV_LOG(line + "  (" + nm(from) + " -> " + nm(to) + ")",' + EOL +
  '                                       (to === expect) ? "#8ab4d8" : "#ff4a3a");' + EOL +
  '      if (to !== expect && window.KV_SHOUT) {' + EOL +
  '        window.KV_SHOUT("MOVE MISMATCH", "P" + p + " " + from + "->" + to + " but dice " + dice +' + EOL +
  '                        " means " + expect, "#ff4a3a", (window.KV_HUMANS || [1]).indexOf(p) >= 0);' + EOL +
  '      }' + EOL +
  '    }' + EOL +
  '  }, 120);' + EOL +
  '})();' + EOL + EOL + anchor);
console.log('PASS movement trace installed (every seat, every step, expected vs actual)');

fs.writeFileSync('showcase_kascity162.html', html);
console.log('OK showcase_kascity162.html (' + (fs.statSync('showcase_kascity162.html').size/1024/1024).toFixed(1) + ' MB)');
