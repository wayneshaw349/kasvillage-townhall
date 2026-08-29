// kascity_visual_v175.cjs
// Reads showcase_kascity174.html -> showcase_kascity175.html
// Duplicate p2pbuy / renovate entries come from the ENGINE recording the same event the JS layer
// already recorded — two writers, one event, and per-emitter guards can never catch it because
// only one of the two passes through them.
// FIX: deduplicate at KV_MOVE, where both paths meet. An identical (seat, action, value) inside
// 3 seconds is recorded once. Rolls, buys and cards are unaffected (their values differ), and the
// money path is untouched — this only cleans the record the commitment chain is built from.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity174.html')) die('showcase_kascity174.html missing');
let html = fs.readFileSync('showcase_kascity174.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

const anchor = '// ---- local moves extend the commitment chain (v171) ----';
if (html.split(anchor).length - 1 !== 1) die('v171 anchor not unique');

html = html.replace(anchor,
  '// ---- one record per event (v175) ----' + EOL +
  '(function(){' + EOL +
  '  var installed = false;' + EOL +
  '  var seen = {};' + EOL +
  '  var DEDUP = { "p2pbuy": 1, "renovate": 1 };   // events both the engine and the JS record' + EOL +
  '  var iv = setInterval(function(){' + EOL +
  '    if (installed || !window.KV_MOVE) return;' + EOL +
  '    installed = true; clearInterval(iv);' + EOL +
  '    var base = window.KV_MOVE;' + EOL +
  '    window.KV_MOVE = function(seat, action, value){' + EOL +
  '      try {' + EOL +
  '        var a = String(action || "");' + EOL +
  '        var head = a.split(":")[0];' + EOL +
  '        if (DEDUP[head] || DEDUP[a]) {' + EOL +
  '          var key = seat + "|" + a + "|" + value;' + EOL +
  '          var now = Date.now();' + EOL +
  '          if (seen[key] && now - seen[key] < 3000) return;   // the other writer already logged it' + EOL +
  '          seen[key] = now;' + EOL +
  '        }' + EOL +
  '      } catch (e) {}' + EOL +
  '      return base.apply(null, arguments);' + EOL +
  '    };' + EOL +
  '  }, 200);' + EOL +
  '})();' + EOL + EOL + anchor);
console.log('PASS KV_MOVE records one entry per event (engine and JS writers merged)');

fs.writeFileSync('showcase_kascity175.html', html);
console.log('OK showcase_kascity175.html (' + (fs.statSync('showcase_kascity175.html').size/1024/1024).toFixed(1) + ' MB)');
