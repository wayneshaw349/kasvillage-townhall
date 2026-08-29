// kascity_visual_v146.cjs  — EXPERIMENT, reversible
// Reads showcase_kascity145.html -> showcase_kascity146.html
// Swaps the two cash lines in all 336 transfer sequences: on an executed trade the SELLER pays
// and the BUYER receives, ownership still moves to the buyer. This is deliberately wrong commerce,
// for observation only. Re-run on 145 -> 146 is the only change; discard 146 to revert.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity145.html')) die('showcase_kascity145.html missing');
let html = fs.readFileSync('showcase_kascity145.html', 'utf8');

// escaped pair: [F,"cash"] -amt then [T,"cash"] +amt  ->  swap the seat numbers
const re = /\{\\"do\\":\{\\"action\\":\\"addSeatStat\\",\\"args\\":\[(\d),\\"cash\\"\],\\"amountExpr\\":\\"0 - world\.flags\.tr_amt\\"\}\},\{\\"do\\":\{\\"action\\":\\"addSeatStat\\",\\"args\\":\[(\d),\\"cash\\"\],\\"amountExpr\\":\\"world\.flags\.tr_amt\\"\}\}/g;
const n = (html.match(re) || []).length;
if (n !== 336) die('cash pairs: expected 336, got ' + n);
html = html.replace(re,
  '{\\"do\\":{\\"action\\":\\"addSeatStat\\",\\"args\\":[$2,\\"cash\\"],\\"amountExpr\\":\\"0 - world.flags.tr_amt\\"}},{\\"do\\":{\\"action\\":\\"addSeatStat\\",\\"args\\":[$1,\\"cash\\"],\\"amountExpr\\":\\"world.flags.tr_amt\\"}}');
console.log('PASS ' + n + ' payment pairs reversed — seller pays, buyer receives (EXPERIMENT)');

fs.writeFileSync('showcase_kascity146.html', html);
console.log('OK showcase_kascity146.html (' + (fs.statSync('showcase_kascity146.html').size/1024/1024).toFixed(1) + ' MB)');
