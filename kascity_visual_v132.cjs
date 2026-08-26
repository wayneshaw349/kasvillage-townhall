// kascity_visual_v132.cjs
// Reads showcase_kascity131.html -> showcase_kascity132.html
// The engine's seat() reads world.flags.seat (advanced by nextSeat); `turn` is only the counter.
// Every place I set `turn` now sets `seat` to match: roll-off winner, stall-detector pass,
// phase-21 loop breaker. Fixes "P2 goes first but P1 moves" and bots getting a second roll on a pass.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity131.html')) die('showcase_kascity131.html missing');
let html = fs.readFileSync('showcase_kascity131.html', 'utf8');
function repN(a, b, name, lo, hi) { const n = html.split(a).length - 1; if (n < lo || n > hi) die(name + ': expected ' + lo + '-' + hi + ', got ' + n); html = html.split(a).join(b); console.log('PASS ' + name + ' (' + n + ')'); }

// roll-off: two sites set turn to w-1
repN('window.KV_SETSTATE("turn", w-1);', 'window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("seat", w);', 'roll-off sets seat too', 2, 3);
repN('if(window.KV_SETSTATE) window.KV_SETSTATE("turn", w-1);', 'if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("seat", w); }', 'roll-off pre-start sets seat too', 0, 1);
// stall detector pass + phase-21 breaker
repN('window.KV_SETSTATE("turn",(f.turn||0)+1);', 'window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("seat",(((f.turn||0)+1)%4)+1);', 'turn passes advance seat too', 2, 2);
// winner check compares against the real seat
repN('var seatNow=((f.turn||0)%4)+1;', 'var seatNow=f.seat||(((f.turn||0)%4)+1);', 'winner check reads seat', 1, 1);

fs.writeFileSync('showcase_kascity132.html', html);
console.log('OK showcase_kascity132.html (' + (fs.statSync('showcase_kascity132.html').size/1024/1024).toFixed(1) + ' MB)');
