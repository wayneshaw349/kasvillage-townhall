// kascity_visual_v172.cjs
// Reads showcase_kascity171.html -> showcase_kascity172.html
// Every purchase was charged twice: settlement runs from two callers (the local settle path and
// the remote-apply path), and the v161 lock was a 5s time window keyed on tile+amount, which the
// second call slipped past.
// FIX: one settlement per trade for the life of the game, keyed on tile+buyer+seller+amount.
// DIAGNOSTIC: each settlement records its caller, so if a duplicate still occurs the record names
// the path responsible instead of leaving it to inference.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity171.html')) die('showcase_kascity171.html missing');
let html = fs.readFileSync('showcase_kascity171.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// replace the old time-window guard with a permanent per-trade lock + caller trace
const old = '  var __k = "t" + tile + ":" + amt, __now = Date.now();';
if (html.split(old).length - 1 !== 1) die('v156 lock header not found');
html = html.replace(old,
  '  var __k = "t" + tile + ":b" + buyer + ":s" + seller + ":" + amt;' + EOL +
  '  var __now = Date.now();' + EOL +
  '  var __caller = "?";' + EOL +
  '  try { var __st = (new Error().stack || "").split("\\n");' + EOL +
  '        for (var __i = 2; __i < __st.length; __i++) { var __t = __st[__i].trim();' + EOL +
  '          if (__t && __t.indexOf("KV_PAY") < 0) { __caller = __t.replace(/^at /, "").slice(0, 40); break; } } } catch (e) {}');
console.log('PASS lock keyed on the whole trade, caller captured');

// the guard itself: permanent, and it says who tried to settle again
const oldGuard = '  if (window.__KV_PAID[__k] && __now - window.__KV_PAID[__k] < 4000) {';
if (html.split(oldGuard).length - 1 !== 1) die('v156 guard body not found');
html = html.replace(oldGuard, '  if (window.__KV_PAID[__k]) {');
console.log('PASS duplicate settlement refused for the rest of the game');

const oldLog = '    if (window.KV_LOG) window.KV_LOG("duplicate settlement blocked for block " + tile + " (" + amt + ")", "#e0a040");';
if (html.split(oldLog).length - 1 !== 1) die('duplicate log line not found');
html = html.replace(oldLog,
  '    if (window.KV_LOG) window.KV_LOG("duplicate settlement blocked \\u2014 block " + tile + " (" + amt + ") \\u2014 caller: " + __caller, "#e0a040");' + EOL +
  '    if (window.KV_MOVE) window.KV_MOVE(0, ("dup:" + tile + "|" + __caller).slice(0, 60), amt);');
console.log('PASS blocked duplicates name their caller in the log and record');

// record the caller of the settlement that does go through
const okAnchor = '    w.owners["t" + tile] = buyer;';
if (html.split(okAnchor).length - 1 !== 1) die('ownership write not found');
html = html.replace(okAnchor,
  okAnchor + EOL +
  '    if (window.KV_MOVE) window.KV_MOVE(0, ("paid:" + tile + "|" + __caller).slice(0, 60), amt);');
console.log('PASS successful settlements record their caller');

fs.writeFileSync('showcase_kascity172.html', html);
console.log('OK showcase_kascity172.html (' + (fs.statSync('showcase_kascity172.html').size/1024/1024).toFixed(1) + ' MB)');
