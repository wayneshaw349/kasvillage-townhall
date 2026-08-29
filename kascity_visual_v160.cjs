// kascity_visual_v160.cjs
// Reads showcase_kascity159.html -> showcase_kascity160.html
// 1) Duplicate trade reporting: settle() runs twice per accept, and although v156's lock stops the
//    second payment, the second pass still logged p2pbuy + both cash: moves and re-shouted the
//    banner. The reporting block now runs only when KV_PAY actually moved money.
// 2) Scenario resolver repeat-fire: one card was applying its payout up to three times in ~130ms
//    (the trace shows +200/-6/-50 repeated). resolve() now ignores a repeat of the same
//    scenario+option+seat inside 3 seconds.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity159.html')) die('showcase_kascity159.html missing');
let html = fs.readFileSync('showcase_kascity159.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) only report a trade that actually settled
rep('  if(__r && typeof __r === "object"){',
    '  if(__r && typeof __r === "object" && (__r.s1 - __r.s0) !== 0){',
    'trade reporting requires a real money movement');

// 2) scenario resolver: ignore repeats of the same card+option+seat within 3s
rep('function resolve(sc, oi, seat, isHuman){',
    'window.__SCN_LAST = window.__SCN_LAST || {};' + EOL +
    'function resolve(sc, oi, seat, isHuman){' + EOL +
    '  var __k = (sc && sc.id) + "|" + oi + "|" + seat, __now = Date.now();' + EOL +
    '  if (window.__SCN_LAST[__k] && __now - window.__SCN_LAST[__k] < 3000) {' + EOL +
    '    if (window.KV_LOG) window.KV_LOG("scenario repeat ignored: " + (sc && sc.id), "#e0a040");' + EOL +
    '    return;' + EOL +
    '  }' + EOL +
    '  window.__SCN_LAST[__k] = __now;',
    'scenario resolver fires once per card');

fs.writeFileSync('showcase_kascity160.html', html);
console.log('OK showcase_kascity160.html (' + (fs.statSync('showcase_kascity160.html').size/1024/1024).toFixed(1) + ' MB)');
