// kascity_visual_v119.cjs
// Reads showcase_kascity118.html -> showcase_kascity119.html
// Bot offers: cash gate 500/300 -> 350/180, spacing 50s -> 40s, and a grey log line whenever the
// bot looks and passes (so a silent market is explainable).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity118.html')) die('showcase_kascity118.html missing');
let html = fs.readFileSync('showcase_kascity118.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if(Date.now()-last<50000) return;', 'if(Date.now()-last<40000) return;', 'offer spacing 40s');
rep('var bots=[1,2,3,4].filter(function(p){ return humans.indexOf(p)<0 && cashOf(p)>=500; });',
    'var bots=[1,2,3,4].filter(function(p){ return humans.indexOf(p)<0 && cashOf(p)>=350; });' +
    ' if(!bots.length){ if(window.KV_LOG && Date.now()-last>60000){ last=Date.now()-25000; window.KV_LOG("no bot has cash to make you an offer right now","#5a4f42"); } return; }',
    'cash gate 350 + skip reason');
rep('if(amt<20 || cashOf(bot)-amt<300) return;',
    'if(amt<20 || cashOf(bot)-amt<180){ if(window.KV_LOG) window.KV_LOG("P"+bot+" eyed your "+((N[tile]&&N[tile].n)||tile)+" at "+amt+" but can\'t stretch to it","#5a4f42"); last=Date.now()-25000; return; }',
    'keep-back 180 + skip reason');

fs.writeFileSync('showcase_kascity119.html', html);
console.log('OK showcase_kascity119.html (' + (fs.statSync('showcase_kascity119.html').size/1024/1024).toFixed(1) + ' MB)');
