// kascity_visual_v139.cjs
// Reads showcase_kascity138.html -> showcase_kascity139.html
// Trade audit: settle() snapshots both parties' cash; DEAL DONE prints before -> after for buyer
// and seller (banner + log), and records "cash:<seat>" moves so the result JSON carries it.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity138.html')) die('showcase_kascity138.html missing');
let html = fs.readFileSync('showcase_kascity138.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('function settle(tile,buyer,seller,amt){',
    'function cashNow(p){ var v=null; try{ v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); }catch(e){} if(v==null){ v=((window.KV_FLAGS&&window.KV_FLAGS())||{})["cash"+p]; } return v==null?0:Math.round(v); }' + EOL +
    'function settle(tile,buyer,seller,amt){ var __b0=cashNow(buyer), __s0=cashNow(seller);',
    'cash snapshot at settle');

rep('if(window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P"+buyer+" now owns "+nm+" for "+amt, COL[buyer], (window.KV_HUMANS||[1]).indexOf(buyer)>=0);',
    'var __b1=cashNow(buyer), __s1=cashNow(seller); var hm=(window.KV_HUMANS||[1]);' + EOL +
    '      var aud="P"+buyer+" "+(__b1-__b0>=0?"+":"")+(__b1-__b0)+" ("+__b0+"\\u2192"+__b1+") \\u00b7 P"+seller+" "+(__s1-__s0>=0?"+":"")+(__s1-__s0)+" ("+__s0+"\\u2192"+__s1+")";' + EOL +
    '      if(window.KV_LOG) window.KV_LOG("DEAL "+nm+" for "+amt+": "+aud, "#f0c860");' + EOL +
    '      if(window.KV_MOVE){ window.KV_MOVE(buyer,"cash:"+tile,__b1); window.KV_MOVE(seller,"cash:"+tile,__s1); }' + EOL +
    '      if(window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P"+buyer+" now owns "+nm+" for "+amt+" \\u00b7 "+aud, COL[buyer], hm.indexOf(buyer)>=0||hm.indexOf(seller)>=0);',
    'DEAL DONE shows both balances and records them');

fs.writeFileSync('showcase_kascity139.html', html);
console.log('OK showcase_kascity139.html (' + (fs.statSync('showcase_kascity139.html').size/1024/1024).toFixed(1) + ' MB)');
