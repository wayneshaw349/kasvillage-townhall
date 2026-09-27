// kascity_visual_v140.cjs
// Reads showcase_kascity139.html -> showcase_kascity140.html
// Human cash ledger (diagnostic): every change to a human seat's cash is recorded as a move
// "d:<delta>|<lastSound>|phase" with v = new balance, and logged. Removed once the leak is found.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity139.html')) die('showcase_kascity139.html missing');
let html = fs.readFileSync('showcase_kascity139.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('// ---- stall detector (escalating) ----',
  '// ---- human cash ledger (v140, diagnostic) ----' + EOL +
  '(function(){' + EOL +
  '  var last={}, lastSnd="", lastSndT=0; var prev=window.KV_ON_SOUND;' + EOL +
  '  window.KV_ON_SOUND=function(id){ try{ if(prev) prev(id); }catch(e){} lastSnd=id; lastSndT=Date.now(); };' + EOL +
  '  function cash(p){ var v=null; try{ v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); }catch(e){} if(v==null){ v=((window.KV_FLAGS&&window.KV_FLAGS())||{})["cash"+p]; } return v==null?null:Math.round(v); }' + EOL +
  '  setInterval(function(){' + EOL +
  '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; if(!(f.t0>0)||window.KV_SEALED) return;' + EOL +
  '    (window.KV_HUMANS||[1]).forEach(function(p){ var c=cash(p); if(c==null) return; if(last[p]==null){ last[p]=c; return; } if(c!==last[p]){ var d=c-last[p]; last[p]=c;' + EOL +
  '      var tag=(Date.now()-lastSndT<1500?lastSnd:"-")+"|ph"+f.phase+"|s"+(f.seat||"?")+"|tr"+f.tr_state+"|sc"+f.sc_state;' + EOL +
  '      if(window.KV_LOG) window.KV_LOG("P"+p+" cash "+(d>0?"+":"")+d+" \\u2192 "+c+"  ["+tag+"]", d<0?"#ff9a7a":"#9cd87c");' + EOL +
  '      if(window.KV_MOVE) window.KV_MOVE(p,"d:"+d+"|"+tag,c); } });' + EOL +
  '  },150);' + EOL +
  '})();' + EOL + EOL +
  '// ---- stall detector (escalating) ----',
  'human cash ledger');

fs.writeFileSync('showcase_kascity140.html', html);
console.log('OK showcase_kascity140.html (' + (fs.statSync('showcase_kascity140.html').size/1024/1024).toFixed(1) + ' MB)');
