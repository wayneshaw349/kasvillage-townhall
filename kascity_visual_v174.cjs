// kascity_visual_v174.cjs
// Reads showcase_kascity173.html -> showcase_kascity174.html
// The engine now pays once (v173), but one trade was reported three times: settle() is invoked
// more than once and each call spawned its own watcher, so p2pbuy + both cash: moves landed
// repeatedly. Renovate was recorded twice for the same reason.
// FIX: reporting is deduplicated per trade and per renovation, so the move record carries one
// entry for one event. This matters beyond tidiness — the commitment hashes are built from these
// moves, and two clients must record the same set.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity173.html')) die('showcase_kascity173.html missing');
let html = fs.readFileSync('showcase_kascity173.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) one report per completed trade, whichever watcher gets there first
rep('        if (window.KV_MOVE) { window.KV_MOVE(buyer, "cash:" + tile, b1); window.KV_MOVE(seller, "cash:" + tile, s1); }',
    '        window.__KV_REPORTED = window.__KV_REPORTED || {};' + EOL +
    '        if (window.__KV_REPORTED[k]) return;   // another watcher already reported this trade' + EOL +
    '        window.__KV_REPORTED[k] = 1;' + EOL +
    '        if (window.KV_MOVE) { window.KV_MOVE(buyer, "p2pbuy", tile); window.KV_MOVE(buyer, "cash:" + tile, b1); window.KV_MOVE(seller, "cash:" + tile, s1); }',
    'one trade report per trade');

// 2) the p2pbuy that the old path emitted separately must not double up
const dupBuy = 'if(window.KV_MOVE){ window.KV_MOVE(buyer,"p2pbuy",tile); window.KV_MOVE(buyer,"cash:"+tile,__r.b1); window.KV_MOVE(seller,"cash:"+tile,__r.s1); }';
if (html.split(dupBuy).length - 1 === 1) {
  html = html.replace(dupBuy, '/* v174: reporting moved into the settlement watcher */');
  console.log('PASS legacy trade reporting removed');
} else {
  console.log('note: legacy trade reporting block not present (already gone)');
}

// 3) renovate recorded once per request
rep('if(window.KV_MOVE) window.KV_MOVE(seat,"renovate",t);',
    'window.__KV_RENOV = window.__KV_RENOV || {};' + EOL +
    'var __rk = seat + ":" + t + ":" + Math.floor(Date.now() / 4000);' + EOL +
    'if (!window.__KV_RENOV[__rk]) { window.__KV_RENOV[__rk] = 1;' + EOL +
    '  if (window.KV_MOVE) window.KV_MOVE(seat, "renovate", t); }',
    'renovate recorded once per request');

fs.writeFileSync('showcase_kascity174.html', html);
console.log('OK showcase_kascity174.html (' + (fs.statSync('showcase_kascity174.html').size/1024/1024).toFixed(1) + ' MB)');
