// kascity_visual_v114.cjs
// Reads showcase_kascity113.html -> showcase_kascity114.html
// 1) Engine watchdog (12s) only passes BOT turns. Your turn waits for you.
// 2) JS stall detector: on a human seat it waits 30s and never fires while a dialog is open.
// 3) Bot verdict on a bid is recorded in the move log: accept:<tile> / refuse:<tile>, v = their bar.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity113.html')) die('showcase_kascity113.html missing');
let html = fs.readFileSync('showcase_kascity113.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }
function q(s) { return s.replace(/"/g, '\\"'); }

// 1) engine watchdog: bots only
rep(q('"cond":"world.flags.over == 0 && world.flags.wd_t > 0 && world.time - world.flags.wd_t > 12"'),
    q('"cond":"world.flags.over == 0 && world.flags.wd_t > 0 && world.time - world.flags.wd_t > 12 && seat() > world.flags.humans"'),
    'engine watchdog passes bot turns only');

// 2) JS stall detector: human seat -> 30s and no dialog
rep('if(window.KV_SCN_BUSY && window.KV_SCN_BUSY()){ since=Date.now(); step=0; return; }',
    'if(window.KV_SCN_BUSY && window.KV_SCN_BUSY()){ since=Date.now(); step=0; return; }' + EOL +
    'var __hum=(window.KV_HUMANS||[1]).indexOf(((f.turn||0)%4)+1)>=0;' + EOL +
    'if(__hum){' + EOL +
    '  var __dlg=false; var __all=document.body.children; for(var __i=0;__i<__all.length;__i++){ var __z=+(__all[__i].style&&__all[__i].style.zIndex); if((__z===77||__z===78||__z===90||__z===71||__z===73) && __all[__i].style.display!=="none") __dlg=true; }' + EOL +
    '  if(__dlg){ since=Date.now(); step=0; return; }' + EOL +
    '  if((Date.now()-since)/1000 < 30) return;' + EOL +
    '}',
    'stall detector: human waits 30s, never while a dialog is open');

// 3) record verdict
rep('window.KV_LOG("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+"  \\u2014 "+why, COL[owner]);',
    'window.KV_LOG("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+"  \\u2014 "+why, COL[owner]);' + EOL +
    'if(window.KV_MOVE) window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile,Math.round(threshold));',
    'bid verdict recorded in the move log');

fs.writeFileSync('showcase_kascity114.html', html);
console.log('OK showcase_kascity114.html (' + (fs.statSync('showcase_kascity114.html').size/1024/1024).toFixed(1) + ' MB)');
