// kascity_visual_v143.cjs
// Reads showcase_kascity140.html -> showcase_kascity143.html  (skips the withdrawn v141/v142)
// 1) Bleed alarm: three negative hits with the same tag inside 40s on a human seat -> big red
//    banner "YOU'RE BLEEDING — resolve your card" with the running total, repeated every 20s
//    while it continues. Makes rent_late / squatter / similar drains impossible to miss.
// 2) The v140 ledger stops writing moves (log lines stay).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity140.html')) die('showcase_kascity140.html missing');
let html = fs.readFileSync('showcase_kascity140.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if(window.KV_MOVE) window.KV_MOVE(p,"d:"+d+"|"+tag,c); } });',
    'if(d<0){ var k=p+"|"+tag.split("|")[0]; var e=bleed[k]=bleed[k]||{n:0,sum:0,t:Date.now(),warned:0};' + EOL +
    '        if(Date.now()-e.t>40000){ e.n=0; e.sum=0; }' + EOL +
    '        e.n++; e.sum+=d; e.t=Date.now();' + EOL +
    '        if(e.n>=3 && Date.now()-e.warned>20000){ e.warned=Date.now();' + EOL +
    '          if(window.KV_SHOUT) window.KV_SHOUT("YOU\'RE BLEEDING", "P"+p+" down "+(-e.sum)+" and counting \\u2014 resolve your card", "#ff4a3a", true);' + EOL +
    '          if(window.KV_LOG) window.KV_LOG("P"+p+" recurring charge "+(-e.sum)+" total \\u2014 an open card is draining you","#ff4a3a");' + EOL +
    '        } } } });',
    'bleed alarm replaces ledger moves');
rep('var last={}, lastSnd="", lastSndT=0;', 'var last={}, lastSnd="", lastSndT=0, bleed={};', 'bleed state');

fs.writeFileSync('showcase_kascity143.html', html);
console.log('OK showcase_kascity143.html (' + (fs.statSync('showcase_kascity143.html').size/1024/1024).toFixed(1) + ' MB)');
