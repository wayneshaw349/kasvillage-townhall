// kascity_visual_v112.cjs
// Reads showcase_kascity111.html -> showcase_kascity112.html
// 1) Fresh seed per solo game (was "kc11" every time -> identical dice every game). Online games
//    keep the room seed. The seed is still published in the result + seedCommit, so replay holds.
// 2) RENT COLLECTED / RENT PAID banners now carry the running balance.
// 3) Leader banner: whenever the net-worth leader changes, "IN THE LEAD" with their figure.
// Also prints the settle() body for the next patch (bids not transferring).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity111.html')) die('showcase_kascity111.html missing');
let html = fs.readFileSync('showcase_kascity111.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) seed
rep('rnd = mulberry(hashStr(scene.meta.seed || "kv"));',
    'if(scene.meta && !(window.KV_NET&&window.KV_NET.online) && !window.KV_FIXED_SEED){ scene.meta.seed="kc"+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }' + EOL +
    'rnd = mulberry(hashStr(scene.meta.seed || "kv"));',
    'solo seed is fresh every game (set window.KV_FIXED_SEED=1 to pin it)');

// 2) rent banners with balance
const bal = '(function(){var v=(window.KV_SEAT&&window.KV_SEAT(p,"cash"));if(v==null){var ff=(window.KV_FLAGS&&window.KV_FLAGS())||{};v=ff["cash"+p];}return v==null?"":(" \\u00b7 balance "+Math.round(v));})()';
rep('shout("RENT COLLECTED", tag+" received "+d, COL[p], mine);',
    'shout("RENT COLLECTED", tag+" received "+d+' + bal + ', COL[p], mine);',
    'rent collected banner shows balance');
rep('shout("RENT PAID", tag+" paid "+(-d), COL[p], mine);',
    'shout("RENT PAID", tag+" paid "+(-d)+' + bal + ', COL[p], mine);',
    'rent paid banner shows balance');

// 3) leader banner (inside the same block as shout/COL/you so they are in scope)
rep('// ---- XP awards echo to the centre ----',
    '// ---- leader banner (v112) ----' + EOL +
    'var lastLead=0;' + EOL +
    'setInterval(function(){' + EOL +
    '  var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
    '  function st(p,k){ var v=(window.KV_SEAT&&window.KV_SEAT(p,k)); if(v==null) v=f[k+p]; return v==null?0:+v; }' + EOL +
    '  if(!(f.t0>0)) return;' + EOL +
    '  var best=0,bp=0; [1,2,3,4].forEach(function(p){ var nw=st(p,"cash")+st(p,"propval")-st(p,"mort"); if(nw>best){best=nw;bp=p;} });' + EOL +
    '  if(bp && bp!==lastLead){ if(lastLead) shout("IN THE LEAD", "P"+bp+" \\u00b7 net worth "+Math.round(best), COL[bp], you(bp)); lastLead=bp; }' + EOL +
    '}, 2500);' + EOL + EOL +
    '// ---- XP awards echo to the centre ----',
    'leader banner on lead change');

fs.writeFileSync('showcase_kascity112.html', html);
console.log('OK showcase_kascity112.html (' + (fs.statSync('showcase_kascity112.html').size/1024/1024).toFixed(1) + ' MB)');

console.log('\n==== PROBE — paste ====');
const L = html.split(/\r?\n/);
const s = L.findIndex(l => l.indexOf('function settle(tile,buyer,seller,amt){') >= 0);
for (let i = s; i < s + 40 && i < L.length; i++) console.log((i + 1) + ': ' + L[i].trim().slice(0, 220));
