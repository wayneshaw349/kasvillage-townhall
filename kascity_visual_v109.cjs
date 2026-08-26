// kascity_visual_v109.cjs
// Reads showcase_kascity108.html -> showcase_kascity109.html
// 1) clock 540 -> 420 (7:00). 2) prints a probe of renovate / offer / popup code paths (no change).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity108.html')) die('showcase_kascity108.html missing');
let html = fs.readFileSync('showcase_kascity108.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('540 - floor(world.time - world.flags.t0)', '420 - floor(world.time - world.flags.t0)', 'engine clock 420');
rep('var started=false, t0=null, TOTAL=540, over=false;', 'var started=false, t0=null, TOTAL=420, over=false;', 'DOM fallback 420');
rep('clock.textContent="9:00";return;}', 'clock.textContent="7:00";return;}', 'idle label 7:00');

fs.writeFileSync('showcase_kascity109.html', html);
console.log('OK showcase_kascity109.html (' + (fs.statSync('showcase_kascity109.html').size/1024/1024).toFixed(1) + ' MB)');

// ---- probe (read-only) ----
console.log('\n==== PROBE — paste everything below ====');
const L = html.split(/\r?\n/);
const re = /KV_RENOV|renovat|KV_OFFER|KV_BID|mkoffer|KV_TILE|tileAt|hitTile|pickTile|KV_NAMES\[|onTile|PERSONALITY|personality|became a|now a developer|DEAL MADE|deal made|canvas\.addEventListener|addEventListener\("click"|addEventListener\("pointerup"/;
let n = 0;
L.forEach((l, i) => { if (l.length < 2000 && re.test(l) && n < 90) { console.log((i + 1) + ': ' + l.trim().slice(0, 150)); n++; } });
