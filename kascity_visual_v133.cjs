// kascity_visual_v133.cjs
// Reads showcase_kascity132.html -> showcase_kascity133.html
// Direct settle: the engine's 336 transfer sequences (tr_state==2 && tr_tile && from/to && owner &&
// cash) only run inside a turn phase, so an accepted trade waited for the buyer's next turn (up to
// 90s) and stalled the seller. A copy of every transfer sequence is placed in the global block that
// runs every tick (next to the rent-roll credit), so a settled trade executes within a frame.
// The JS re-arm stays as a backstop; its cap drops to 20s.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity132.html')) die('showcase_kascity132.html missing');
let html = fs.readFileSync('showcase_kascity132.html', 'utf8');
function q(s) { return s.replace(/"/g, '\\"'); }

// work on the unescaped view to find sequences, then re-escape for insertion
const J = html.replace(/\\"/g, '"');
const seqRe = /\{"sequence":\[\{"cond":"world\.flags\.tr_state == 2 && world\.flags\.tr_tile == \d+ && world\.flags\.tr_from == \d+ && world\.flags\.tr_to == \d+ && ownerOf\('t\d+'\) == \d+ && seatStat\(\d+,'cash'\) >= world\.flags\.tr_amt"\}[\s\S]*?"tr_tile",-1\]\}\}\]\}/g;
const seqs = J.match(seqRe) || [];
if (seqs.length < 300 || seqs.length > 400) die('transfer sequences: expected 300-400, got ' + seqs.length);
// sanity: each must contain exactly one claim
for (const s of seqs) if ((s.match(/"claim"/g) || []).length !== 1) die('a transfer sequence has ' + (s.match(/"claim"/g) || []).length + ' claims — regex overran');
console.log('PASS ' + seqs.length + ' transfer sequences extracted');

const anchorU = '{"sequence":[{"cond":"world.flags.sc_state == 1 && world.flags.sc_seat == 4"}';
const anchorE = q(anchorU);
if (html.split(anchorE).length - 1 !== 1) die('global anchor (sc_state credit) not unique');
const chunk = q(seqs.join(',')) + ',';
html = html.replace(anchorE, chunk + anchorE);
console.log('PASS transfers now evaluated every tick (global block)');

// re-arm cap 90s -> 20s
const capA = 'if(Date.now()-t0>90000){';
if (html.split(capA).length - 1 !== 1) die('re-arm cap not unique');
html = html.replace(capA, 'if(Date.now()-t0>20000){');
console.log('PASS re-arm backstop cap 20s');

fs.writeFileSync('showcase_kascity133.html', html);
console.log('OK showcase_kascity133.html (' + (fs.statSync('showcase_kascity133.html').size/1024/1024).toFixed(1) + ' MB)');
