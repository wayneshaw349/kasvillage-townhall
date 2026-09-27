// kascity_visual_v155.cjs
// Reads showcase_kascity154.html -> showcase_kascity155.html
// If a call ever passes buyer/seller the wrong way round, the owner gets charged for their own
// block. KV_PAY now derives the roles from ownership: whoever owns the tile is the SELLER and is
// paid; the other party is the BUYER and pays. Argument order can no longer invert a deal, and a
// swap is logged when detected.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity154.html')) die('showcase_kascity154.html missing');
let html = fs.readFileSync('showcase_kascity154.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('    w.seats = w.seats || []; w.owners = w.owners || {};',
    '    w.seats = w.seats || []; w.owners = w.owners || {};' + EOL +
    '    // v155: ownership decides the roles — the owner sells and is paid' + EOL +
    '    var __own = w.owners["t" + tile]; if (__own == null) __own = w.owners[String(tile)];' + EOL +
    '    if (__own != null && __own !== 0 && __own !== seller && __own === buyer) {' + EOL +
    '      var __t = buyer; buyer = seller; seller = __t;' + EOL +
    '      if (window.KV_LOG) window.KV_LOG("roles corrected: P" + seller + " owns the block, so P" + seller + " is paid", "#e0a040");' + EOL +
    '    }' + EOL +
    '    if (__own != null && __own !== 0 && __own !== seller) {' + EOL +
    '      return "owner mismatch: block belongs to P" + __own + ", not P" + seller;' + EOL +
    '    }',
    'KV_PAY derives buyer/seller from ownership');

fs.writeFileSync('showcase_kascity155.html', html);
console.log('OK showcase_kascity155.html (' + (fs.statSync('showcase_kascity155.html').size/1024/1024).toFixed(1) + ' MB)');
