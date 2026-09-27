// kascity_visual_v121.cjs
// Reads showcase_kascity120.html -> showcase_kascity121.html
// Bot-offer engine reports (throttled, amber) which gate stopped it: not started / clock / spacing /
// dialog open / you own nothing unlisted / no bot with cash / already tried / price out of reach.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity120.html')) die('showcase_kascity120.html missing');
let html = fs.readFileSync('showcase_kascity120.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('var last=0, tried={};',
    'var last=0, tried={}, lastWhy=0; function why(m){ if(Date.now()-lastWhy<40000) return; lastWhy=Date.now(); if(window.KV_LOG) window.KV_LOG("offers: "+m,"#c9a34c"); }',
    'why() reporter');
rep('if(!(f.t0>0) || f.over || window.KV_SEALED) return;',
    'if(!(f.t0>0)){ why("game not started (t0="+f.t0+")"); return; } if(f.over || window.KV_SEALED) return;',
    'gate: start');
rep('if((f.left||0)<25) return;', 'if((f.left||0)<25){ why("under 25s left"); return; }', 'gate: clock');
rep('if(dialogOpen()) return;', 'if(dialogOpen()){ why("a dialog is open"); return; }', 'gate: dialog');
rep('if(!mine.length) return;', 'if(!mine.length){ why("you own no unlisted block yet"); return; }', 'gate: blocks');
rep('if(tried[bot+":"+tile] && Date.now()-tried[bot+":"+tile]<150000) return;',
    'if(tried[bot+":"+tile] && Date.now()-tried[bot+":"+tile]<150000){ why("P"+bot+" already asked about that block recently"); return; }',
    'gate: tried');

fs.writeFileSync('showcase_kascity121.html', html);
console.log('OK showcase_kascity121.html (' + (fs.statSync('showcase_kascity121.html').size/1024/1024).toFixed(1) + ' MB)');
