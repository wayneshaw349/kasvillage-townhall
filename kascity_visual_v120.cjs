// kascity_visual_v120.cjs
// Reads showcase_kascity119.html -> showcase_kascity120.html
// 1) Bot parked in phase 21 (landed on a human block, paid rent, "offer?" step) loops forever.
//    The bot has already rolled, so after 1.5s in phase 21 its turn is ended cleanly (same hand-off
//    the pass step uses) — no turn is lost, and the seats behind it stop starving.
// 2) Stall detector key: clock removed (it ticks, so nothing ever looked stuck); phase added.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity119.html')) die('showcase_kascity119.html missing');
let html = fs.readFileSync('showcase_kascity119.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('var key=[f.turn, (window.KV_MOVES||[]).length, Math.round(f.left||0)].join("/");',
    'var key=[f.turn, (window.KV_MOVES||[]).length, f.phase, f.asked].join("/");',
    'stall key watches turn/moves/phase, not the clock');

rep('// ---- stall detector (escalating) ----',
  '// ---- bot phase-21 loop breaker (v120) ----' + EOL +
  '(function(){' + EOL +
  '  var since=null, lastTurn=null;' + EOL +
  '  setInterval(function(){' + EOL +
  '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '    if(f.over || window.KV_SEALED || !(f.t0>0)) return;' + EOL +
  '    var seat=((f.turn||0)%4)+1;' + EOL +
  '    var bot=(window.KV_HUMANS||[1]).indexOf(seat)<0;' + EOL +
  '    if(!(bot && f.phase===21)){ since=null; return; }' + EOL +
  '    if(since===null || lastTurn!==f.turn){ since=Date.now(); lastTurn=f.turn; return; }' + EOL +
  '    if(Date.now()-since<1500) return;' + EOL +
  '    since=null;' + EOL +
  '    if(!window.KV_SETSTATE) return;' + EOL +
  '    window.KV_SETSTATE("offer_ask",-1); window.KV_SETSTATE("oq",0); window.KV_SETSTATE("mkoffer",-1);' + EOL +
  '    window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);' + EOL +
  '    if(window.KV_LOG) window.KV_LOG("P"+seat+" ends turn","#7a6a58");' + EOL +
  '  }, 500);' + EOL +
  '})();' + EOL + EOL +
  '// ---- stall detector (escalating) ----',
  'bot phase-21 loop ends the turn instead of hanging');

fs.writeFileSync('showcase_kascity120.html', html);
console.log('OK showcase_kascity120.html (' + (fs.statSync('showcase_kascity120.html').size/1024/1024).toFixed(1) + ' MB)');
