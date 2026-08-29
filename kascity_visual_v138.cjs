// kascity_visual_v138.cjs
// Reads showcase_kascity137.html -> showcase_kascity138.html
// Holding period 8 -> 14 turns, and a block cannot go back to its previous owner within 30 turns
// (listing is unlisted while the only likely buyer is the seller it came from; bot offers to you
// on such a block are skipped). Breaks the two-bot ping-pong.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity137.html')) die('showcase_kascity137.html missing');
let html = fs.readFileSync('showcase_kascity137.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('var HOLD=8, lastOwner={}, boughtAt={};',
    'var HOLD=14, lastOwner={}, boughtAt={}, prevOwner={}, NOBACK=30;' + EOL +
    '  window.KV_NO_BACK=function(t,buyer){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; return !!(prevOwner[t] && prevOwner[t].who===buyer && (f.turn||0)-prevOwner[t].at<NOBACK); };',
    'hold 14 + previous-owner memory');
rep('if(o!==lastOwner[t]){ lastOwner[t]=o; if(o) boughtAt[t]=(f.turn||0); }',
    'if(o!==lastOwner[t]){ if(lastOwner[t]) prevOwner[t]={who:lastOwner[t],at:(f.turn||0)}; lastOwner[t]=o; if(o) boughtAt[t]=(f.turn||0); }',
    'track previous owner on every change');
// bot offers to you: skip a block that came from that bot recently
rep('if(tried[bot+":"+tile] && Date.now()-tried[bot+":"+tile]<150000){',
    'if(window.KV_NO_BACK && window.KV_NO_BACK(tile,bot)){ tried[bot+":"+tile]=Date.now(); why("P"+bot+" just sold tile "+tile+" \\u2014 not buying it back"); return; }' + EOL +
    '    if(tried[bot+":"+tile] && Date.now()-tried[bot+":"+tile]<150000){',
    'bots do not buy back what they just sold');

fs.writeFileSync('showcase_kascity138.html', html);
console.log('OK showcase_kascity138.html (' + (fs.statSync('showcase_kascity138.html').size/1024/1024).toFixed(1) + ' MB)');
