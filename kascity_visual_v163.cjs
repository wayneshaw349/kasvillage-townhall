// kascity_visual_v163.cjs
// Reads showcase_kascity162.html -> showcase_kascity163.html
// Tile 10 is the Holding Cell and fate card #5 sends a player there with a -50 fine. It happened
// silently, so it looked like the token jumping backwards at random. Now:
//  1) a big red "SENT TO HOLDING" banner with the fine, for whoever it hits
//  2) the Holding Cell tile is labelled and outlined on the board so its position is obvious
//  3) the movement trace classifies a jump to 10 as HOLDING rather than MISMATCH
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity162.html')) die('showcase_kascity162.html missing');
let html = fs.readFileSync('showcase_kascity162.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1 + 3) trace classifies holding, and shouts it
rep('      var okm = (to === expect) ? "ok" : "MISMATCH";',
    '      var holding = (to === 10 && to !== expect);' + EOL +
    '      var okm = (to === expect) ? "ok" : (holding ? "HOLDING" : "MISMATCH");' + EOL +
    '      if (holding) {' + EOL +
    '        if (window.KV_SHOUT) window.KV_SHOUT("SENT TO HOLDING",' + EOL +
    '          "P" + p + " \\u00b7 fate card \\u00b7 fined 50 \\u00b7 turn ends", "#ff4a3a",' + EOL +
    '          (window.KV_HUMANS || [1]).indexOf(p) >= 0);' + EOL +
    '        if (window.KV_LOG) window.KV_LOG("P" + p + " SENT TO HOLDING (cell is tile 10) \\u00b7 fined 50", "#ff4a3a");' + EOL +
    '      }',
    'holding jump recognised, announced and no longer flagged as a mismatch');

rep('      if (to !== expect && window.KV_SHOUT) {',
    '      if (to !== expect && !holding && window.KV_SHOUT) {',
    'mismatch banner only for genuine mismatches');

// 2) mark the cell on the board
rep('// ---- movement trace (v162) ----',
    '// ---- holding cell marker (v163) ----' + EOL +
    '(function(){' + EOL +
    '  setInterval(function(){' + EOL +
    '    try {' + EOL +
    '      var lab = document.querySelectorAll("div");' + EOL +
    '      for (var i = 0; i < lab.length; i++) {' + EOL +
    '        var d = lab[i];' + EOL +
    '        if (d.__kvHold) continue;' + EOL +
    '        if (d.textContent === "tile 10" || d.textContent === "Block 10") {' + EOL +
    '          d.__kvHold = 1; d.textContent = "HOLDING CELL";' + EOL +
    '          d.style.color = "#ff6a4a"; d.style.textShadow = "1px 1px 0 #241c12, 0 0 8px #ff4a3a";' + EOL +
    '        }' + EOL +
    '      }' + EOL +
    '    } catch (e) {}' + EOL +
    '  }, 1500);' + EOL +
    '})();' + EOL + EOL +
    '// ---- movement trace (v162) ----',
    'Holding Cell labelled on the board');

fs.writeFileSync('showcase_kascity163.html', html);
console.log('OK showcase_kascity163.html (' + (fs.statSync('showcase_kascity163.html').size/1024/1024).toFixed(1) + ' MB)');
