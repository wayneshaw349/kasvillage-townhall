// kascity_visual_v145.cjs
// Reads showcase_kascity144.html -> showcase_kascity145.html
// REVERTS v133. The globally-copied transfer sequences moved ownership and reset the trade before
// the engine's payment branch ran: blocks changed hands with no money moving (audit showed +0/+0).
// The copies are removed; trades execute on the engine's own branch again (re-arm still waits it
// out), and every one pays. Then prints the full original transfer structure for a correct rebuild.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity144.html')) die('showcase_kascity144.html missing');
let html = fs.readFileSync('showcase_kascity144.html', 'utf8');
function q(s) { return s.replace(/"/g, '\\"'); }

const J = html.replace(/\\"/g, '"');
const seqRe = /\{"sequence":\[\{"cond":"world\.flags\.tr_state == 2 && world\.flags\.tr_tile == \d+ && world\.flags\.tr_from == \d+ && world\.flags\.tr_to == \d+ && ownerOf\('t\d+'\) == \d+ && seatStat\(\d+,'cash'\) >= world\.flags\.tr_amt"\}[\s\S]*?"tr_tile",-1\]\}\}\]\}/g;
const all = J.match(seqRe) || [];
const uniq = [...new Set(all)];
if (all.length !== uniq.length * 2) die('expected each transfer sequence twice (copy + original), got ' + all.length + ' total / ' + uniq.length + ' unique');
const anchorU = '{"sequence":[{"cond":"world.flags.sc_state == 1 && world.flags.sc_seat == 4"}';
const anchorE = q(anchorU);
// v134's recovery sequences sit between the copies and the sc anchor — peel from whichever comes first
const recovE = q('{"sequence":[{"cond":"seatStat(1,\'cash\') >= 0 && seatStat(1,\'alive\') == 0"}');
let ai = html.indexOf(recovE);
if (ai < 0) ai = html.indexOf(anchorE);
if (ai < 0) die('neither recovery block nor global anchor found');
// peel tr-sequence copies off the front of the anchor, one at a time
const escd = uniq.map(u => q(u) + ',');
let head = ai, stripped = 0;
outer: while (true) {
  for (const e of escd) {
    if (html.slice(head - e.length, head) === e) { head -= e.length; stripped++; continue outer; }
  }
  break;
}
if (stripped < 300 || stripped > 400) die('stripped ' + stripped + ' copies — expected 300-400; file left untouched');
html = html.slice(0, head) + html.slice(ai);
console.log('PASS v133 transfer copies removed (' + stripped + ' stripped) — trades pay again');

fs.writeFileSync('showcase_kascity145.html', html);
console.log('OK showcase_kascity145.html (' + (fs.statSync('showcase_kascity145.html').size/1024/1024).toFixed(1) + ' MB)');

console.log('\n==== PROBE: full transfer structure (original site) — paste ====');
const J2 = html.replace(/\\"/g, '"');
const i0 = J2.search(/\{"sequence":\[\{"cond":"world\.flags\.tr_state == 2 && world\.flags\.tr_tile == \d+/);
if (i0 >= 0) console.log(J2.slice(i0, i0 + 1600).replace(/\s+/g, ' '));
