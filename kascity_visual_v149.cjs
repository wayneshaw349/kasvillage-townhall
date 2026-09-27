// kascity_visual_v149.cjs
// Reads showcase_kascity147.html -> showcase_kascity149.html
// ROOT CAUSE: bot listing-purchase branches write the same tr_tile/tr_from/tr_to/tr_amt/tr_state
// flags that settle() uses. A bot buying a listing within a tick of your accept overwrote your
// trade's parameters, so your execution branch stopped matching: block moved, nobody paid.
// FIX: human-initiated trades get a private channel (htr_*). The 336 transfer sequences are
// duplicated with htr_ conditions and appended to the global block; settle() arms htr_ only.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity147.html')) die('showcase_kascity147.html missing');
let html = fs.readFileSync('showcase_kascity147.html', 'utf8');
function q(s) { return s.replace(/"/g, '\\"'); }

// 1) collect the authored transfer sequences (with their payments) from the unescaped view
const J = html.replace(/\\"/g, '"');
const seqRe = /\{"sequence":\[\{"cond":"world\.flags\.tr_state == 2 && world\.flags\.tr_tile == \d+ && world\.flags\.tr_from == \d+ && world\.flags\.tr_to == \d+ && ownerOf\('t\d+'\) == \d+ && seatStat\(\d+,'cash'\) >= world\.flags\.tr_amt"\}[\s\S]*?"tr_tile",-1\]\}\}\]\}/g;
const seqs = J.match(seqRe) || [];
if (seqs.length !== 336) die('authored transfer sequences: expected 336, got ' + seqs.length);
let bad = 0; seqs.forEach(s => { if ((s.match(/"addSeatStat"/g) || []).length < 6) bad++; });
if (bad) die(bad + ' sequences look truncated (missing payment actions) — refusing to duplicate');
console.log('PASS 336 authored sequences captured, all carry their payment actions');

// 2) rewrite tr_ -> htr_ on the copies
const hseqs = seqs.map(s => s.replace(/world\.flags\.tr_(state|tile|from|to|amt)/g, 'world.flags.htr_$1')
                             .replace(/"tr_(state|tile)",(-?\d)/g, '"htr_$1",$2'));

// 3) append them at the global block anchor (v134 recovery block or sc credit)
const recovE = q('{"sequence":[{"cond":"seatStat(1,\'cash\') >= 0 && seatStat(1,\'alive\') == 0"}');
const scE = q('{"sequence":[{"cond":"world.flags.sc_state == 1 && world.flags.sc_seat == 4"}');
let anchor = html.indexOf(recovE) >= 0 ? recovE : scE;
if (html.split(anchor).length - 1 !== 1) die('global anchor not unique');
html = html.replace(anchor, q(hseqs.join(',')) + ',' + anchor);
console.log('PASS 336 private-channel (htr_) sequences installed in the global block');

// 4) settle() arms the private channel
[['tr_tile', 'htr_tile'], ['tr_from', 'htr_from'], ['tr_to', 'htr_to'], ['tr_amt', 'htr_amt'], ['tr_t', 'htr_t'], ['tr_state', 'htr_state']].forEach(function (pair) {
  const a = 'window.KV_SETSTATE("' + pair[0] + '",';
  const si = html.indexOf('function settle(tile,buyer,seller,amt){');
  const idx = html.indexOf(a, si);
  if (idx < 0 || idx - si > 600) die('settle: ' + pair[0] + ' write not found');
  html = html.slice(0, idx) + 'window.KV_SETSTATE("' + pair[1] + '",' + html.slice(idx + a.length);
});
console.log('PASS settle() now arms htr_* only — bot listings cannot overwrite your trade');

// 5) re-arm + debug read the private channel too
html = html.split('f.tr_state!==2 || f.tr_tile!==tile').join('f.htr_state!==2 || f.htr_tile!==tile');
html = html.split('window.KV_SETSTATE("tr_tile",tile); window.KV_SETSTATE("tr_from",buyer); window.KV_SETSTATE("tr_to",seller);').join('window.KV_SETSTATE("htr_tile",tile); window.KV_SETSTATE("htr_from",buyer); window.KV_SETSTATE("htr_to",seller);');
html = html.split('window.KV_SETSTATE("tr_amt",amt); window.KV_SETSTATE("tr_t",0); window.KV_SETSTATE("tr_state",2);').join('window.KV_SETSTATE("htr_amt",amt); window.KV_SETSTATE("htr_t",0); window.KV_SETSTATE("htr_state",2);');
html = html.split('f0.tr_from+" tr_to(payee)="+f0.tr_to+" tr_amt="+f0.tr_amt+" tr_state="+f0.tr_state').join('f0.htr_from+" tr_to(payee)="+f0.htr_to+" tr_amt="+f0.htr_amt+" tr_state="+f0.htr_state');
console.log('PASS re-arm and debug follow the private channel');

fs.writeFileSync('showcase_kascity149.html', html);
console.log('OK showcase_kascity149.html (' + (fs.statSync('showcase_kascity149.html').size/1024/1024).toFixed(1) + ' MB)');
