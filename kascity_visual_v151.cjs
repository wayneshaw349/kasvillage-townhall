// kascity_visual_v151.cjs
// Reads showcase_kascity150.html -> showcase_kascity151.html
// ROOT CAUSE (confirmed): window.KV_OWNER derived ownership from the VISIBILITY of the
// own_<tile>_<seat> marker nodes, while the engine's ownerOf() reads world.owners. A branch that
// merely showed a marker made every JS consumer (popup, holdings, settle's verification, the DEAL
// audit) believe the block had changed hands, while world.owners — and therefore the payment
// sequences — never moved. Hence "block transfers, nobody pays".
// FIX: KV_OWNER now reads world.owners (engine truth), with the marker scan kept only as a
// fallback if the world is unreachable.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity150.html')) die('showcase_kascity150.html missing');
let html = fs.readFileSync('showcase_kascity150.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

const head = 'window.KV_OWNER = function (tid) {';
if (html.split(head).length - 1 !== 1) die('KV_OWNER head not unique');
const hi = html.indexOf(head);
html = html.slice(0, hi) + head + EOL +
  '  // v151: engine truth first — world.owners is what ownerOf() and every payment branch read' + EOL +
  '  try {' + EOL +
  '    var w = (window.KV_WORLD && window.KV_WORLD.owners) ? window.KV_WORLD :' + EOL +
  '            ((typeof world !== "undefined" && world && world.owners) ? world : null);' + EOL +
  '    if (w && w.owners) { var ow = w.owners[String("t" + tid)]; if (ow == null) ow = w.owners[String(tid)];' + EOL +
  '      return (ow == null || ow === 0) ? null : ow; }' + EOL +
  '  } catch (e) {}' + EOL +
  '  // fallback: legacy marker scan' + EOL +
  html.slice(hi + head.length);
console.log('PASS KV_OWNER reads world.owners first (marker scan kept as fallback)');

fs.writeFileSync('showcase_kascity151.html', html);
console.log('OK showcase_kascity151.html (' + (fs.statSync('showcase_kascity151.html').size/1024/1024).toFixed(1) + ' MB)');
