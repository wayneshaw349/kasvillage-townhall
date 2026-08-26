// kascity_visual_v118.cjs
// Reads showcase_kascity117.html -> showcase_kascity118.html
// Bots now occasionally make offers on YOUR blocks (not just via the "buyer" scenario):
//  - every 50s at most, one bot with cash to spare picks one of your unlisted blocks
//  - price = its valuation x personality (developer 1.05 / trader 0.90 / miser 0.80) +/- a little
//  - only if it can pay without dropping under 300 cash; never in the last 25s; never over a dialog
//  - goes through the same OFFER RECEIVED dialog, settle() and engine transfer as everything else
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity117.html')) die('showcase_kascity117.html missing');
let html = fs.readFileSync('showcase_kascity117.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('function askHuman(tile,buyer,seller,amt,nm){',
    'window.KV_ASK_HUMAN=function(){ return askHuman.apply(null,arguments); };' + EOL +
    'function askHuman(tile,buyer,seller,amt,nm){',
    'OFFER RECEIVED dialog exported');

const anchor = '// ---- narrate bot offer decisions ----';
rep(anchor,
  '// ---- bots make offers on human blocks (v118) ----' + EOL +
  '(function(){' + EOL +
  '  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};' + EOL +
  '  var last=0, tried={};' + EOL +
  '  function cashOf(p){ var v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); if(v==null){ v=((window.KV_FLAGS&&window.KV_FLAGS())||{})["cash"+p]; } return v==null?0:Math.round(v); }' + EOL +
  '  function dialogOpen(){ var a=document.body.children; for(var i=0;i<a.length;i++){ var z=+(a[i].style&&a[i].style.zIndex); if((z===77||z===78||z===90)&&a[i].style.display!=="none"&&a[i].children.length) return true; } return false; }' + EOL +
  '  setInterval(function(){' + EOL +
  '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '    if(!(f.t0>0) || f.over || window.KV_SEALED) return;' + EOL +
  '    if((f.left||0)<25) return;' + EOL +
  '    if(Date.now()-last<50000) return;' + EOL +
  '    if(dialogOpen()) return;' + EOL +
  '    var humans=window.KV_HUMANS||[1]; if(!humans.length) return;' + EOL +
  '    var human=humans[Math.floor(Math.random()*humans.length)];' + EOL +
  '    var N=window.KV_NAMES||{};' + EOL +
  '    var mine=Object.keys(N).map(function(k){return parseInt(k,10);}).filter(function(t){ return window.KV_OWNER&&window.KV_OWNER(t)===human && !(f["ls_t"+t]>0); });' + EOL +
  '    if(!mine.length) return;' + EOL +
  '    var bots=[1,2,3,4].filter(function(p){ return humans.indexOf(p)<0 && cashOf(p)>=500; });' + EOL +
  '    if(!bots.length) return;' + EOL +
  '    var bot=bots[Math.floor(Math.random()*bots.length)];' + EOL +
  '    var tile=mine[Math.floor(Math.random()*mine.length)];' + EOL +
  '    if(tried[bot+":"+tile] && Date.now()-tried[bot+":"+tile]<150000) return;' + EOL +
  '    var intr=window.KV_INTRINSIC?window.KV_INTRINSIC(tile):(window.KV_MARKET?window.KV_MARKET(tile):(N[tile].p||100));' + EOL +
  '    var label=((window.KV_PROFNAME&&window.KV_PROFNAME(bot))||"").toLowerCase();' + EOL +
  '    var mul=label.indexOf("develop")>=0?1.05:(label.indexOf("trader")>=0?0.90:(label.indexOf("miser")>=0?0.80:0.95));' + EOL +
  '    var amt=Math.round(intr*mul*(0.95+Math.random()*0.12)/5)*5;' + EOL +
  '    if(amt<20 || cashOf(bot)-amt<300) return;' + EOL +
  '    last=Date.now(); tried[bot+":"+tile]=Date.now();' + EOL +
  '    var nm=(N[tile]&&N[tile].n)||("block "+tile);' + EOL +
  '    if(window.KV_LOG) window.KV_LOG("P"+bot+"  offers  "+amt+"  for your "+nm+(label?("  \\u00b7 the "+label):""), COL[bot]);' + EOL +
  '    if(window.KV_MOVE) window.KV_MOVE(bot,"bid:"+tile,amt);' + EOL +
  '    if(window.KV_ASK_HUMAN) window.KV_ASK_HUMAN(tile,bot,human,amt,nm);' + EOL +
  '  }, 3000);' + EOL +
  '})();' + EOL + EOL + anchor,
  'bots make offers on your blocks');

fs.writeFileSync('showcase_kascity118.html', html);
console.log('OK showcase_kascity118.html (' + (fs.statSync('showcase_kascity118.html').size/1024/1024).toFixed(1) + ' MB)');
