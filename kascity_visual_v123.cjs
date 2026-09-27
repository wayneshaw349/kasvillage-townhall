// kascity_visual_v123.cjs
// Reads showcase_kascity122.html -> showcase_kascity123.html
// Bot-offer engine also records its skip reason in the move log (seat 0, action "why:<reason>",
// at most once per 60s) so the pasted result JSON shows which gate is closed. Diagnostic; remove later.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity122.html')) die('showcase_kascity122.html missing');
let html = fs.readFileSync('showcase_kascity122.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('function why(m){ if(Date.now()-lastWhy<40000) return; lastWhy=Date.now(); if(window.KV_LOG) window.KV_LOG("offers: "+m,"#c9a34c"); }',
    'var lastRec=0; function why(m){ if(Date.now()-lastWhy<40000) return; lastWhy=Date.now(); if(window.KV_LOG) window.KV_LOG("offers: "+m,"#c9a34c"); if(window.KV_MOVE && Date.now()-lastRec>60000){ lastRec=Date.now(); window.KV_MOVE(0,"why:"+String(m).replace(/[^a-z0-9 .+]/gi,"").slice(0,60),0); } }',
    'why() also lands in the move log');
// route the two cash-gate lines through why() as well
rep('window.KV_LOG("offers: no bot has 350+ cash (P2 "+cashOf(2)+" \\u00b7 P3 "+cashOf(3)+" \\u00b7 P4 "+cashOf(4)+")","#c9a34c");',
    'why("no bot has 350+ cash P2 "+cashOf(2)+" P3 "+cashOf(3)+" P4 "+cashOf(4));',
    'no-cash reason recorded');
rep('window.KV_LOG("offers: P"+bot+" eyed your "+((N[tile]&&N[tile].n)||tile)+" at "+amt+" but has only "+cashOf(bot),"#c9a34c");',
    'why("P"+bot+" eyed tile "+tile+" at "+amt+" but has only "+cashOf(bot));',
    'stretch reason recorded');
// spacing gate gets a reason too (throttled by why itself)
rep('if(Date.now()-last<40000) return;', 'if(Date.now()-last<40000){ why("waiting out spacing "+Math.round((40000-(Date.now()-last))/1000)+"s"); return; }', 'spacing reason recorded');

fs.writeFileSync('showcase_kascity123.html', html);
console.log('OK showcase_kascity123.html (' + (fs.statSync('showcase_kascity123.html').size/1024/1024).toFixed(1) + ' MB)');
