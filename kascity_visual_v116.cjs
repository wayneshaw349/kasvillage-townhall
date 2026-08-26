// kascity_visual_v116.cjs
// Reads showcase_kascity115.html -> showcase_kascity116.html
// A settled trade now polls every 400ms for up to 90s: if the tile has moved -> DEAL DONE; if the
// engine cleared tr_state before executing (watchdog cleanup on a stalled bot) it re-arms the
// tr_* flags. Only after 90s does it report TRANSFER FAILED. The JS stall detector no longer
// clears tr_state at all.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity115.html')) die('showcase_kascity115.html missing');
let html = fs.readFileSync('showcase_kascity115.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

const head = 'if(!okt && window.KV_LOG) window.KV_LOG("trade failed to register","#ff6a4a");';
const hi = html.indexOf(head);
if (hi < 0 || html.indexOf(head, hi + 1) >= 0) die('settle head not unique');
const tailMark = '}, 1500);';
const ti = html.indexOf(tailMark, hi);
if (ti < 0 || ti - hi > 3000) die('v113 one-shot check not found after settle head');
const newBlock =
  head + EOL +
  '(function(){' + EOL +
  '  var t0=Date.now(), rearm=0;' + EOL +
  '  var iv=setInterval(function(){' + EOL +
  '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '    var own=window.KV_OWNER?window.KV_OWNER(tile):null;' + EOL +
  '    var N=window.KV_NAMES||{}, nm=(N[tile]&&N[tile].n)||("block "+tile);' + EOL +
  '    if(own===buyer){' + EOL +
  '      clearInterval(iv);' + EOL +
  '      if(window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P"+buyer+" now owns "+nm+" for "+amt, COL[buyer], (window.KV_HUMANS||[1]).indexOf(buyer)>=0);' + EOL +
  '      return;' + EOL +
  '    }' + EOL +
  '    if(own!==seller){ clearInterval(iv); if(window.KV_LOG) window.KV_LOG("trade void \\u2014 "+nm+" changed hands first","#e08a5a"); return; }' + EOL +
  '    if(f.tr_state!==2 || f.tr_tile!==tile){' + EOL +
  '      rearm++;' + EOL +
  '      window.KV_SETSTATE("tr_tile",tile); window.KV_SETSTATE("tr_from",buyer); window.KV_SETSTATE("tr_to",seller);' + EOL +
  '      window.KV_SETSTATE("tr_amt",amt); window.KV_SETSTATE("tr_t",0); window.KV_SETSTATE("tr_state",2);' + EOL +
  '      if(window.KV_LOG && rearm<=3) window.KV_LOG("trade re-armed ("+rearm+") \\u2014 waiting for the engine","#7a6a58");' + EOL +
  '    }' + EOL +
  '    if(Date.now()-t0>90000){' + EOL +
  '      clearInterval(iv);' + EOL +
  '      var cash=(window.KV_SEAT&&window.KV_SEAT(buyer,"cash")); if(cash==null) cash=f["cash"+buyer];' + EOL +
  '      var why="owner still P"+own+" \\u00b7 tr_state "+f.tr_state+" \\u00b7 amt "+amt+" \\u00b7 buyer cash "+Math.round(cash||0)+" \\u00b7 phase "+f.phase+" \\u00b7 turn seat "+(((f.turn||0)%4)+1)+" \\u00b7 re-armed "+rearm+"x";' + EOL +
  '      if(window.KV_LOG) window.KV_LOG("TRANSFER DID NOT LAND: "+why,"#ff6a4a");' + EOL +
  '      if(window.KV_SHOUT) window.KV_SHOUT("TRANSFER FAILED", why, "#ff6a4a", true);' + EOL +
  '    }' + EOL +
  '  }, 400);' + EOL +
  '})();';
html = html.slice(0, hi) + newBlock + html.slice(ti + tailMark.length);
console.log('PASS settle() re-arms the trade until the engine executes it (90s cap)');

rep('window.KV_SETSTATE("tr_state",0); window.KV_SETSTATE("sc_state",0);',
    'window.KV_SETSTATE("sc_state",0);',
    'JS stall detector no longer wipes a pending trade');

fs.writeFileSync('showcase_kascity116.html', html);
console.log('OK showcase_kascity116.html (' + (fs.statSync('showcase_kascity116.html').size/1024/1024).toFixed(1) + ' MB)');
