// kascity_visual_v117.cjs
// Reads showcase_kascity116.html -> showcase_kascity117.html
// v114's dialog check matched the always-present shout stack (z-73), so a stuck human turn could
// never be nudged. Now only real modals count (z-77 bid, z-78 list, z-90 roll-off), and only if they
// have content. Human stall: 30s -> re-prompt (asked=0, phase=3), never a pass.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity116.html')) die('showcase_kascity116.html missing');
let html = fs.readFileSync('showcase_kascity116.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if((__z===77||__z===78||__z===90||__z===71||__z===73) && __all[__i].style.display!=="none") __dlg=true;',
    'if((__z===77||__z===78||__z===90) && __all[__i].style.display!=="none" && __all[__i].children.length) __dlg=true;',
    'dialog check: real modals only');

fs.writeFileSync('showcase_kascity117.html', html);
console.log('OK showcase_kascity117.html (' + (fs.statSync('showcase_kascity117.html').size/1024/1024).toFixed(1) + ' MB)');

console.log('\n==== PROBE (bot offers / listings cadence) — paste ====');
const L = html.split(/\r?\n/);
const re = /mkoffer|KV_BOT|botBid|botOffer|bot offer|bots? (bid|list)|lastFire|OFFER_MS|LIST_MS|Math\.random\(\)\s*<\s*0?\.|chance/;
let n = 0;
L.forEach((l, i) => { if (l.length < 1500 && re.test(l) && n < 60) { console.log((i + 1) + ': ' + l.trim().slice(0, 170)); n++; } });
