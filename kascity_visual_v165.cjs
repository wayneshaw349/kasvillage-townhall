// kascity_visual_v165.cjs  (re-anchored)
// Reads showcase_kascity164.html -> showcase_kascity165.html
// Diagnostics off: the S.. settlement trace and routine M: movement lines no longer write to the
// move log or the on-screen feed. Anomalies, the holding-cell banner, the DEAL audit and the bleed
// alarm all stay.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity164.html')) die('showcase_kascity164.html missing');
let html = fs.readFileSync('showcase_kascity164.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// settlement tracer: make __TRACE a no-op (single-line anchor inside its body)
rep('  var n = ++window.__TR.n, ms = Date.now() - window.__TR.t0;',
    '  if (!window.__TR_VERBOSE) return;' + (html.indexOf('\r\n') >= 0 ? '\r\n' : '\n') +
    '  var n = ++window.__TR.n, ms = Date.now() - window.__TR.t0;',
    'settlement trace silenced (set window.__TR_VERBOSE=1 to re-enable)');

// movement trace: record and log only anomalies
rep('      if (window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), to);',
    '      if (to !== expect && window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), to);',
    'movement trace records only anomalies');
rep('      if (window.KV_LOG) window.KV_LOG(line + "  (" + nm(from) + " -> " + nm(to) + ")",',
    '      if (to !== expect && window.KV_LOG) window.KV_LOG(line + "  (" + nm(from) + " -> " + nm(to) + ")",',
    'movement log only on anomalies');

fs.writeFileSync('showcase_kascity165.html', html);
console.log('OK showcase_kascity165.html (' + (fs.statSync('showcase_kascity165.html').size/1024/1024).toFixed(1) + ' MB)');
