// kascity_visual_v136.cjs
// Reads showcase_kascity135.html -> showcase_kascity136.html
// Roll-for-first: the engine's boot chain (seat=1, turn=0 on 0.1s delays) could land after the
// winner was applied. The winner is now re-asserted every 300ms until the first roll is actually
// recorded (or 8s pass), and any stale prompt is cleared each time.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity135.html')) die('showcase_kascity135.html missing');
let html = fs.readFileSync('showcase_kascity135.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if(seatNow===w || tries++>40){ clearInterval(iv); if(window.KV_LOG) window.KV_LOG("P"+w+" opens the game","#caa64c"); }',
    'var rolled=(window.KV_MOVES||[]).some(function(m){ return m.a==="roll"; });' +
    ' if(rolled || tries++>26){ clearInterval(iv); if(window.KV_LOG) window.KV_LOG("P"+w+" opens the game","#caa64c"); }',
    'hold the winner until the first roll is recorded');
rep('else if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("seat", w); }',
    'else if(window.KV_SETSTATE && seatNow!==w){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("seat", w); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1); }',
    're-assert winner + clear prompt whenever the engine resets it');

fs.writeFileSync('showcase_kascity136.html', html);
console.log('OK showcase_kascity136.html (' + (fs.statSync('showcase_kascity136.html').size/1024/1024).toFixed(1) + ' MB)');
