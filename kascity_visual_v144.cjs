// kascity_visual_v144.cjs  (replaces earlier v144 attempt)
// Reads showcase_kascity143.html -> showcase_kascity144.html
// Two intervals wrote the player-card numbers: the live one reading the engine's seat ledger, and
// a 250ms one reading the stale KV_STATS mirror, which kept overwriting the fresh values — the
// reason sale credits never showed on your card. The stale writer is removed.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity143.html')) die('showcase_kascity143.html missing');
let html = fs.readFileSync('showcase_kascity143.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if (c != null) document.getElementById("kvc" + p).textContent = c;', '', 'stale cash writer removed');
rep('if (b != null) document.getElementById("kvb" + p).textContent = b;', '', 'stale bank writer removed');
rep('if (m != null) document.getElementById("kvm" + p).textContent = m;', '', 'stale mortgage writer removed');

fs.writeFileSync('showcase_kascity144.html', html);
console.log('OK showcase_kascity144.html (' + (fs.statSync('showcase_kascity144.html').size/1024/1024).toFixed(1) + ' MB)');
