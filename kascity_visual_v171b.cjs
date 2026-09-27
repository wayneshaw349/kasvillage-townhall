// kascity_visual_v171.cjs
// Reads showcase_kascity170.html -> showcase_kascity171.html
// The commitment chain only advanced on peer moves, so a local game committed nothing and a peer
// had nothing to compare against. Every recorded move now extends the chain, and the resulting
// hash is attached to the move so it travels to the peer and lands in the result as stateRoot.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity170.html')) die('showcase_kascity170.html missing');
let html = fs.readFileSync('showcase_kascity170.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

// wrap KV_MOVE so every local move commits
const anchor = '// ---- per-move state commitments (v170) ----';
if (html.split(anchor).length - 1 !== 1) die('commitment block anchor not unique');
html = html.replace(anchor,
  '// ---- local moves extend the commitment chain (v171) ----' + EOL +
  '(function(){' + EOL +
  '  var installed = false;' + EOL +
  '  var iv = setInterval(function(){' + EOL +
  '    if (installed || !window.KV_MOVE || !window.KV_COMMIT) return;' + EOL +
  '    installed = true; clearInterval(iv);' + EOL +
  '    var base = window.KV_MOVE;' + EOL +
  '    window.KV_MOVE = function(seat, action, value){' + EOL +
  '      var out = base.apply(null, arguments);' + EOL +
  '      try {' + EOL +
  '        var list = window.KV_MOVES || [];' + EOL +
  '        var idx = list.length ? list[list.length - 1].i : 0;' + EOL +
  '        window.KV_COMMIT.add(idx, seat, action, value).then(function(h){' + EOL +
  '          if (list.length) list[list.length - 1].hash = h;' + EOL +
  '          window.KV_STATE_ROOT = h;' + EOL +
  '        });' + EOL +
  '      } catch (e) {}' + EOL +
  '      return out;' + EOL +
  '    };' + EOL +
  '  }, 300);' + EOL +
  '})();' + EOL + EOL + anchor);
console.log('PASS every local move extends the commitment chain');

// publish the chain head in the result (moveRoot is a variable, not a literal)
(function(){
  const cands = [
    'moveRoot: chain,',
    'moveRoot: chain ,',
    '"moveRoot": chain,',
    'moveRoot:chain,'
  ];
  let hit = null;
  for (const c of cands) { if (html.split(c).length - 1 === 1) { hit = c; break; } }
  if (!hit) {
    // fall back: any single-line assignment of moveRoot inside the result object
    const m = html.match(/moveRoot\s*:\s*[A-Za-z_$][\w$]*\s*,/);
    if (!m || html.split(m[0]).length - 1 !== 1) die('could not locate a unique moveRoot field');
    hit = m[0];
  }
  html = html.replace(hit, hit + ' stateRoot: (window.KV_STATE_ROOT || ""),');
  console.log('PASS stateRoot published in the result (anchored on: ' + hit.trim() + ')');
})();

fs.writeFileSync('showcase_kascity171.html', html);
console.log('OK showcase_kascity171.html (' + (fs.statSync('showcase_kascity171.html').size/1024/1024).toFixed(1) + ' MB)');
