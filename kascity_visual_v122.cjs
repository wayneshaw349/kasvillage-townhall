// kascity_visual_v122.cjs
// Reads showcase_kascity121.html -> showcase_kascity122.html
// Bot-offer cash reader returned 0 (KV_SEAT null, flag name mismatch) so no bot ever qualified.
// cashOf now tries KV_SEAT, flags.cashN, flags.cash_pN, flags.pN_cash, then the player card DOM.
// The two grey skip lines become amber and print the cash figures they saw.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity121.html')) die('showcase_kascity121.html missing');
let html = fs.readFileSync('showcase_kascity121.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('function cashOf(p){ var v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); if(v==null){ v=((window.KV_FLAGS&&window.KV_FLAGS())||{})["cash"+p]; } return v==null?0:Math.round(v); }',
    'function cashOf(p){ var v=null; try{ v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); }catch(e){} var ff=(window.KV_FLAGS&&window.KV_FLAGS())||{};' +
    ' if(v==null) v=ff["cash"+p]; if(v==null) v=ff["cash_p"+p]; if(v==null) v=ff["p"+p+"_cash"];' +
    ' if(v==null){ var ds=document.body.querySelectorAll("div"); for(var i=0;i<ds.length;i++){ var tx=ds[i].textContent||""; if(tx.length<400 && tx.indexOf("P"+p)>=0 && /CASH\\s+(\\d+)/.test(tx) && ds[i].children.length<12){ v=+RegExp.$1; break; } } }' +
    ' return v==null?0:Math.round(v); }',
    'cashOf reads seat, three flag names, then the player card');

rep('window.KV_LOG("no bot has cash to make you an offer right now","#5a4f42");',
    'window.KV_LOG("offers: no bot has 350+ cash (P2 "+cashOf(2)+" \\u00b7 P3 "+cashOf(3)+" \\u00b7 P4 "+cashOf(4)+")","#c9a34c");',
    'no-cash line amber with figures');
rep('window.KV_LOG("P"+bot+" eyed your "+((N[tile]&&N[tile].n)||tile)+" at "+amt+" but can\'t stretch to it","#5a4f42");',
    'window.KV_LOG("offers: P"+bot+" eyed your "+((N[tile]&&N[tile].n)||tile)+" at "+amt+" but has only "+cashOf(bot),"#c9a34c");',
    'stretch line amber with figures');

fs.writeFileSync('showcase_kascity122.html', html);
console.log('OK showcase_kascity122.html (' + (fs.statSync('showcase_kascity122.html').size/1024/1024).toFixed(1) + ' MB)');
