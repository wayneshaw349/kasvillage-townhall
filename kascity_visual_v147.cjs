// kascity_visual_v147.cjs
// Reads showcase_kascity145.html -> showcase_kascity147.html   (branches from 145, NOT the 146 experiment)
// Accept debug: every accept narrates the whole hand-off, step by step, into the game log and the
// WHAT HAD HAPPENED WAS feed:
//   1. who accepted what: roles, tile, amount, both balances at that instant
//   2. the flags settle() wrote (tr_from/tr_to/tr_amt/tr_state)
//   3. when the engine executes: both balances again, with deltas, and who got the block
//   4. if 3s pass without execution: the exact flag/owner state blocking it
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity145.html')) die('showcase_kascity145.html missing');
let html = fs.readFileSync('showcase_kascity145.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('var okt=window.KV_SETSTATE("tr_state",2);',
  'var okt=window.KV_SETSTATE("tr_state",2);' + EOL +
  '(function(){' + EOL +
  '  function dbg(m,c){ if(window.KV_LOG) window.KV_LOG(m, c||"#8ab4d8"); }' + EOL +
  '  var N=window.KV_NAMES||{}, nm=(N[tile]&&N[tile].n)||("tile "+tile);' + EOL +
  '  dbg("ACCEPT DEBUG 1/3 \\u2014 P"+buyer+" (buyer, pays) \\u00b7 P"+seller+" (seller, receives) \\u00b7 "+nm+" \\u00b7 amount "+amt);' + EOL +
  '  dbg("ACCEPT DEBUG 1/3 \\u2014 balances now: buyer P"+buyer+" "+__b0+" \\u00b7 seller P"+seller+" "+__s0);' + EOL +
  '  var f0=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '  dbg("ACCEPT DEBUG 2/3 \\u2014 armed: tr_from(payer)="+f0.tr_from+" tr_to(payee)="+f0.tr_to+" tr_amt="+f0.tr_amt+" tr_state="+f0.tr_state+" owner=P"+(window.KV_OWNER?window.KV_OWNER(tile):"?"));' + EOL +
  '  var t0=Date.now(), done=false;' + EOL +
  '  var iv=setInterval(function(){' + EOL +
  '    var own=window.KV_OWNER?window.KV_OWNER(tile):null;' + EOL +
  '    var b1=cashNow(buyer), s1=cashNow(seller);' + EOL +
  '    if(own===buyer && !done){ done=true; clearInterval(iv);' + EOL +
  '      dbg("ACCEPT DEBUG 3/3 \\u2014 EXECUTED: block \\u2192 P"+buyer+" \\u00b7 buyer P"+buyer+" "+__b0+"\\u2192"+b1+" ("+(b1-__b0>=0?"+":"")+(b1-__b0)+") \\u00b7 seller P"+seller+" "+__s0+"\\u2192"+s1+" ("+(s1-__s0>=0?"+":"")+(s1-__s0)+")", (s1-__s0)>0?"#9cd87c":"#ff6a4a");' + EOL +
  '      if((s1-__s0)<=0) dbg("ACCEPT DEBUG \\u2014 SELLER DID NOT GAIN \\u2014 this is the bug, screenshot this line", "#ff4a3a");' + EOL +
  '      return; }' + EOL +
  '    if(Date.now()-t0>3000 && !done){ done=true; clearInterval(iv);' + EOL +
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '      dbg("ACCEPT DEBUG 3/3 \\u2014 NOT EXECUTED after 3s: owner=P"+own+" tr_state="+f.tr_state+" tr_tile="+f.tr_tile+" tr_from="+f.tr_from+" tr_to="+f.tr_to+" tr_amt="+f.tr_amt+" buyerCash="+b1+" (needs \\u2265 "+amt+")", "#e0a040"); }' + EOL +
  '  }, 250);' + EOL +
  '})();',
  'accept narrated in three numbered debug steps');

fs.writeFileSync('showcase_kascity147.html', html);
console.log('OK showcase_kascity147.html (' + (fs.statSync('showcase_kascity147.html').size/1024/1024).toFixed(1) + ' MB)');
