// kascity_visual_v135.cjs
// Reads showcase_kascity134.html -> showcase_kascity135.html
// Holding period: a block that changed hands cannot be re-listed for 8 turns. Kills the bot
// flip loop (same block bouncing between two bots every turn, farming trade XP). Applies to
// everyone; your own List button is refused with the turns remaining.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity134.html')) die('showcase_kascity134.html missing');
let html = fs.readFileSync('showcase_kascity134.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('// ---- stall detector (escalating) ----',
  '// ---- holding period (v135) ----' + EOL +
  '(function(){' + EOL +
  '  var HOLD=8, lastOwner={}, boughtAt={};' + EOL +
  '  window.KV_HOLD_LEFT=function(t){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; if(boughtAt[t]==null) return 0; return Math.max(0, HOLD-((f.turn||0)-boughtAt[t])); };' + EOL +
  '  setInterval(function(){' + EOL +
  '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; if(!(f.t0>0)) return;' + EOL +
  '    var N=window.KV_NAMES||{};' + EOL +
  '    Object.keys(N).forEach(function(k){ var t=parseInt(k,10); var o=window.KV_OWNER?window.KV_OWNER(t):null;' + EOL +
  '      if(lastOwner[t]===undefined){ lastOwner[t]=o; return; }' + EOL +
  '      if(o!==lastOwner[t]){ lastOwner[t]=o; if(o) boughtAt[t]=(f.turn||0); }' + EOL +
  '      if(o && f["ls_t"+t]>0 && window.KV_HOLD_LEFT(t)>0 && window.KV_SETSTATE){' + EOL +
  '        window.KV_SETSTATE("ls_t"+t,0);' + EOL +
  '        if(window.KV_LOG) window.KV_LOG("P"+o+" can\'t relist "+(N[k].n||t)+" yet \\u2014 "+window.KV_HOLD_LEFT(t)+" turns to hold","#7a6a58");' + EOL +
  '      }' + EOL +
  '    });' + EOL +
  '  }, 400);' + EOL +
  '})();' + EOL + EOL +
  '// ---- stall detector (escalating) ----',
  'holding period watcher');

// your List button respects it too (anchor: the unique "not your property" line inside KV_LIST)
const listHead = 'window.KV_LIST=function(tile){';
if (html.split(listHead).length - 1 !== 1) die('KV_LIST head not unique');
const li = html.indexOf(listHead);
const notYours = 'if(own!==me){ window.KV_LOG("not your property","#ff6a4a"); return; }';
const ni = html.indexOf(notYours, li);
if (ni < 0 || ni - li > 600) die('"not your property" line not found inside KV_LIST');
html = html.slice(0, ni + notYours.length) + EOL +
  'if(window.KV_HOLD_LEFT && window.KV_HOLD_LEFT(tile)>0){ window.KV_LOG("hold "+d.n+" "+window.KV_HOLD_LEFT(tile)+" more turns before listing","#ff6a4a"); if(window.KV_SHOUT) window.KV_SHOUT("TOO SOON","hold "+window.KV_HOLD_LEFT(tile)+" more turns","#ff6a4a",true); return; }' +
  html.slice(ni + notYours.length);
console.log('PASS List button respects the hold');

fs.writeFileSync('showcase_kascity135.html', html);
console.log('OK showcase_kascity135.html (' + (fs.statSync('showcase_kascity135.html').size/1024/1024).toFixed(1) + ' MB)');
