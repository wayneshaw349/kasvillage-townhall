// kascity_visual_v110.cjs
// Reads showcase_kascity109.html -> showcase_kascity110.html
// Property popup, KV_BID, KV_LIST, KV_RENOVATE all derived "me" from the CURRENT TURN seat.
// Outside your own turn that made every button vanish or refuse. "me" is now your seat
// (KV_NET.seat online, KV_HUMANS[0] solo).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity109.html')) die('showcase_kascity109.html missing');
let html = fs.readFileSync('showcase_kascity109.html', 'utf8');

const ME = 'var me=(window.KV_NET&&window.KV_NET.seat)||(window.KV_HUMANS||[1])[0]||1;';
const old = 'var me=((f.turn||0)%4)+1;';
const n = html.split(old).length - 1;
if (n < 3 || n > 8) die('me=turn-seat sites: expected 3-8, got ' + n);
html = html.split(old).join(ME);
console.log('PASS ' + n + ' sites: me = your seat, not the turn seat');

const oldR = 'window.KV_RENOVATE=function(t){';
if (html.split(oldR).length - 1 !== 1) die('KV_RENOVATE head not unique');
const seg = html.slice(html.indexOf(oldR), html.indexOf(oldR) + 400);
const oldS = 'var seat=((f.turn||0)%4)+1;';
if (seg.split(oldS).length - 1 !== 1) die('KV_RENOVATE seat line not found within function head');
html = html.slice(0, html.indexOf(oldR)) + seg.replace(oldS, 'var seat=(window.KV_NET&&window.KV_NET.seat)||(window.KV_HUMANS||[1])[0]||1;') + html.slice(html.indexOf(oldR) + 400);
console.log('PASS KV_RENOVATE checks ownership against your seat');

fs.writeFileSync('showcase_kascity110.html', html);
console.log('OK showcase_kascity110.html (' + (fs.statSync('showcase_kascity110.html').size/1024/1024).toFixed(1) + ' MB)');
