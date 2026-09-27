// kascity_visual_v156.cjs
// Reads showcase_kascity155.html -> showcase_kascity156.html
// The log shows every trade settling TWICE: once via KV_PAY and once via the engine's own
// transfer sequence. On the second pass ownership has already moved, so the roles invert and the
// seller is charged — which is exactly the "it swaps buyer and seller" behaviour.
// FIX: one settlement per trade. KV_PAY records a per-tile lock; a repeat within 4s for the same
// tile/amount is refused and logged. Ownership is also required to still be with the seller.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity155.html')) die('showcase_kascity155.html missing');
let html = fs.readFileSync('showcase_kascity155.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('window.KV_PAY = function (tile, buyer, seller, amt) {',
    'window.__KV_PAID = window.__KV_PAID || {};' + EOL +
    'window.KV_PAY = function (tile, buyer, seller, amt) {' + EOL +
    '  var __k = "t" + tile + ":" + amt, __now = Date.now();' + EOL +
    '  if (window.__KV_PAID[__k] && __now - window.__KV_PAID[__k] < 4000) {' + EOL +
    '    if (window.KV_LOG) window.KV_LOG("duplicate settlement blocked for block " + tile + " (" + amt + ")", "#e0a040");' + EOL +
    '    return "already settled";' + EOL +
    '  }' + EOL +
    '  window.__KV_PAID[__k] = __now;',
    'one settlement per trade (4s lock)');

// belt and braces: the engine must not run its own transfer for a trade JS has settled
rep('    w.owners["t" + tile] = buyer;',
    '    w.owners["t" + tile] = buyer;' + EOL +
    '    try { w.flags = w.flags || {}; w.flags.tr_state = 0; w.flags.tr_tile = -1; w.flags.htr_state = 0; w.flags.htr_tile = -1; } catch (e) {}',
    'engine transfer disarmed after JS settlement');

fs.writeFileSync('showcase_kascity156.html', html);
console.log('OK showcase_kascity156.html (' + (fs.statSync('showcase_kascity156.html').size/1024/1024).toFixed(1) + ' MB)');
