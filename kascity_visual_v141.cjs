// kascity_visual_v141.cjs
// Reads showcase_kascity140.html -> showcase_kascity141.html
// Renovation charged repeatedly (every few seconds, +15 each pass) because the charging sequence
// never disarmed the renov flag; the disarm lived in a completion branch that seldom ran. The
// charging sequence now sets renov=-1 itself after the single charge. One click (or contractor
// card) = one charge. Ledger from v140 stays in for one more game to verify.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity140.html')) die('showcase_kascity140.html missing');
let html = fs.readFileSync('showcase_kascity140.html', 'utf8');

// find the charging sequence on the unescaped view, using a depth scan for its exact extent
const J = html.replace(/\\"/g, '"');
let seq=null, seqStart=-1, end=-1, scan=0, found=0;
while (true) {
  const condIdx = J.indexOf('"cond":"world.flags.renov >= 0', scan);
  if (condIdx < 0) break;
  scan = condIdx + 10; found++;
  const st = J.lastIndexOf('{"sequence":[', condIdx);
  if (st < 0 || condIdx - st > 60) continue;
  let depth = 0, en = -1;
  for (let i = st; i < J.length && i < st + 5000; i++) {
    if (J[i] === '{') depth++;
    else if (J[i] === '}') { depth--; if (depth === 0) { en = i + 1; break; } }
  }
  if (en < 0) continue;
  const cand = J.slice(st, en);
  const nCharge = (cand.match(/"addSeatStat"/g) || []).length;
  if (nCharge === 1 && /amountExpr":"0 - \(/.test(cand.replace(/\\/g,'')) || (nCharge === 1 && cand.indexOf('"amountExpr":"0 -') >= 0)) {
    if (cand.indexOf('"renov",-1') >= 0) continue;
    seq = cand; seqStart = st; end = en; break;
  }
}
if (!seq) die('no charging renov sequence found among ' + found + ' renov branches');
console.log('PASS charge sequence located (' + seq.length + ' chars, 1 charge, no disarm): ' + seq.slice(0, 160).replace(/\s+/g, ' ') + '…');

const fixed = seq.slice(0, seq.length - 2) + ',{"do":{"action":"setState","args":["renov",-1]}}' + seq.slice(seq.length - 2);
const escSeq = seq.replace(/"/g, '\\"');
const escFixed = fixed.replace(/"/g, '\\"');
if (html.split(escSeq).length - 1 !== 1) die('escaped charge sequence not unique in html');
html = html.replace(escSeq, escFixed);
console.log('PASS renov disarmed inside the charging sequence — one charge per request');

fs.writeFileSync('showcase_kascity141.html', html);
console.log('OK showcase_kascity141.html (' + (fs.statSync('showcase_kascity141.html').size/1024/1024).toFixed(1) + ' MB)');
