// kascity_visual_v161.cjs
// Reads showcase_kascity160.html -> showcase_kascity161.html
// 1) settle() itself is now idempotent: a second invocation for the same tile+amount within 5s
//    returns immediately, before any logging, moves or banners. This removes the phantom second
//    p2pbuy/cash pair at the source rather than filtering its output.
// 2) Card repeat-fire: the payout is applied by the engine reading sc_state, and the flag was
//    being re-armed, replaying +200/-24/-50 several times. sc_state is now written through a
//    guarded setter that refuses to re-arm the same sc_seat+sc_amt within 3s.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity160.html')) die('showcase_kascity160.html missing');
let html = fs.readFileSync('showcase_kascity160.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) idempotent settle
rep('function settle(tile,buyer,seller,amt){',
    'window.__SETTLED = window.__SETTLED || {};' + EOL +
    'function settle(tile,buyer,seller,amt){' + EOL +
    '  var __sk = tile + ":" + amt, __sn = Date.now();' + EOL +
    '  if (window.__SETTLED[__sk] && __sn - window.__SETTLED[__sk] < 5000) return;' + EOL +
    '  window.__SETTLED[__sk] = __sn;',
    'settle() ignores a repeat call for the same trade');

// 2) guard sc_state re-arming
rep('window.KV_SETSTATE = function (k, v) {',
    'window.__SC_ARM = window.__SC_ARM || { key: "", at: 0 };' + EOL +
    'window.KV_SETSTATE = function (k, v) {' + EOL +
    '  if (k === "sc_state" && v === 1) {' + EOL +
    '    var __w = null;' + EOL +
    '    try { __w = (window.KV_WORLD && window.KV_WORLD.flags) ? window.KV_WORLD.flags : null; } catch (e) {}' + EOL +
    '    var __key = __w ? (__w.sc_seat + "|" + __w.sc_amt + "|" + __w.sc_sell) : "?";' + EOL +
    '    var __now2 = Date.now();' + EOL +
    '    if (__key === window.__SC_ARM.key && __now2 - window.__SC_ARM.at < 3000) {' + EOL +
    '      if (window.KV_LOG) window.KV_LOG("card payout already applied \\u2014 repeat blocked", "#e0a040");' + EOL +
    '      return false;' + EOL +
    '    }' + EOL +
    '    window.__SC_ARM = { key: __key, at: __now2 };' + EOL +
    '  }',
    'card payout cannot re-arm within 3s');

fs.writeFileSync('showcase_kascity161.html', html);
console.log('OK showcase_kascity161.html (' + (fs.statSync('showcase_kascity161.html').size/1024/1024).toFixed(1) + ' MB)');
