// kascity_visual_v168.cjs
// Reads showcase_kascity167.html -> showcase_kascity168.html
// v167 replaced an existing window.KV object that the boot code relies on (KV.setGrants), which
// broke startup. The toolkit now merges its commands into whatever KV already exists, keeping the
// original methods intact.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity167.html')) die('showcase_kascity167.html missing');
let html = fs.readFileSync('showcase_kascity167.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('  window.KV = KV;',
    '  // v168: merge, never replace — the boot code owns KV.setGrants and friends' + EOL +
    '  var __existing = window.KV || {};' + EOL +
    '  Object.keys(KV).forEach(function(k){ if (typeof __existing[k] === "undefined") __existing[k] = KV[k]; });' + EOL +
    '  window.KV = __existing;',
    'toolkit merges into the existing KV object');

fs.writeFileSync('showcase_kascity168.html', html);
console.log('OK showcase_kascity168.html (' + (fs.statSync('showcase_kascity168.html').size/1024/1024).toFixed(1) + ' MB)');
