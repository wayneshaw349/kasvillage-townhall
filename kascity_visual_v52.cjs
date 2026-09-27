// kascity_visual_v52.cjs
// Reads showcase_kascity51.html -> showcase_kascity52.html   (scene JSON unchanged)
// BANK FIX: bankOf() was reading seat stat 'propval' through the engine, which isn't resolving.
// It now computes net worth in JS from things we can observe directly:
//     bank = cash + sum(listed price of every tile that player owns)
// That needs no engine internals, so it can't silently return nothing. Also adds a debug readout
// (toggle with the D key) showing the raw values behind cash / propval / bank per seat.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity51.html')) die('showcase_kascity51.html missing');
if (fs.existsSync('kascity_v51.json')) fs.writeFileSync('kascity_v52.json', fs.readFileSync('kascity_v51.json'));
let html = fs.readFileSync('showcase_kascity51.html', 'utf8');

const oldBank = "function bankOf(p){var c=sv(p,'cash'),pv=sv(p,'propval');return c==null?\"-\":(c+(pv||0));}";
if (html.split(oldBank).length - 1 !== 1) die('bankOf not found exactly once (' + (html.split(oldBank).length - 1) + ')');

const newBank = [
  'function propValOf(p){',
  '  var sum=0, N=window.KV_NAMES||{};',
  '  for(var k in N){',
  '    var t=parseInt(k,10);',
  '    if(window.KV_OWNER && window.KV_OWNER(t)===p) sum += (N[k].p||0);',
  '  }',
  '  return sum;',
  '}',
  'function bankOf(p){',
  '  var c=sv(p,"cash");',
  '  if(c==null){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; c=(f["cash"+p]!=null)?Math.round(f["cash"+p]):null; }',
  '  if(c==null) return "-";',
  '  return c + propValOf(p);',
  '}'
].join('\n');
html = html.split(oldBank).join(newBank);

// cash falls back to the world flag mirror too
const oldCash = 'function cashOf(p){var v=sv(p,\'cash\');return v==null?"-":v;}';
if (html.split(oldCash).length - 1 !== 1) die('cashOf not found exactly once');
html = html.split(oldCash).join(
  'function cashOf(p){var v=sv(p,"cash");' +
  'if(v==null){var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};v=(f["cash"+p]!=null)?Math.round(f["cash"+p]):null;}' +
  'return v==null?"-":v;}');

// debug overlay on the D key
const endAnchor = '  window.KV_END=endGame;';
if (html.split(endAnchor).length - 1 !== 1) die('endGame anchor not found');
const dbg = [
  '  window.KV_END=endGame;',
  '',
  '  (function(){',
  '    var dbg=document.createElement("pre");',
  '    dbg.style.cssText="position:fixed;left:8px;top:120px;z-index:75;display:none;background:rgba(10,8,6,.92);border:1px solid #5a4a3a;border-radius:5px;padding:8px 10px;font:10px/1.5 monospace;color:#9cd87c;margin:0;";',
  '    document.body.appendChild(dbg);',
  '    var on=false;',
  '    document.addEventListener("keydown",function(e){',
  '      if(e.key!=="d"&&e.key!=="D")return;',
  '      on=!on; dbg.style.display=on?"block":"none";',
  '    });',
  '    setInterval(function(){',
  '      if(!on)return;',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var s="seat  cash(stat) cash(flag) props  bank\\n";',
  '      for(var p=1;p<=4;p++){',
  '        var cs=(window.KV_SEAT?window.KV_SEAT(p,"cash"):null);',
  '        var cf=f["cash"+p];',
  '        var pv=0,N=window.KV_NAMES||{};',
  '        for(var k in N){ if(window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===p) pv+=(N[k].p||0); }',
  '        s+=" P"+p+"   "+String(cs==null?"null":Math.round(cs)).padEnd(10)+String(cf==null?"null":Math.round(cf)).padEnd(10)+String(pv).padEnd(7)+bankOf(p)+"\\n";',
  '      }',
  '      s+="\\nmoves "+((window.KV_MOVES||[]).length)+"  mode "+(window.KV_MODE||"?")+"  humans "+((window.KV_HUMANS||[]).length);',
  '      dbg.textContent=s;',
  '    },500);',
  '  })();'
].join('\n');
html = html.split(endAnchor).join(dbg);

fs.writeFileSync('showcase_kascity52.html', html);
console.log('PASS bank = cash + owned property prices (computed in JS, no engine stat dependency)');
console.log('PASS cash falls back to the world-flag mirror when the seat stat is unreadable');
console.log('PASS debug overlay on the D key (raw cash / props / bank per seat)');
console.log('OK showcase_kascity52.html (' + (fs.statSync('showcase_kascity52.html').size/1024/1024).toFixed(1) + ' MB)');
