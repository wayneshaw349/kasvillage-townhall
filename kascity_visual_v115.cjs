// kascity_visual_v115.cjs
// Reads showcase_kascity114.html -> showcase_kascity115.html
// Every lap: tall bold "GET YOUR MONEY" banner for whichever player passed GO — rent earned,
// block count, and the new balance once it has settled. Bots and you alike, in their colour.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity114.html')) die('showcase_kascity114.html missing');
let html = fs.readFileSync('showcase_kascity114.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

const anchor = 'if(window.KV_SHOUT) window.KV_SHOUT("RENT ROLL", (mine?"YOU":("P"+seat))+" collect "+total+" from "+count+" blocks",';
rep(anchor,
  '(function(){' + EOL +
  '  var b=document.createElement("div");' + EOL +
  '  b.style.cssText="position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.85);z-index:80;padding:18px 40px;border-radius:14px;background:rgba(14,11,8,.94);border:3px solid "+COL[seat]+";box-shadow:0 10px 50px rgba(0,0,0,.75),0 0 30px "+COL[seat]+"55;text-align:center;pointer-events:none;opacity:0;transition:opacity .18s,transform .18s;";' + EOL +
  '  b.innerHTML="<div style=\'font:900 46px/1 Impact,\\"Arial Black\\",sans-serif;letter-spacing:3px;color:"+COL[seat]+";text-shadow:3px 3px 0 #000\'>"+(mine?"GET YOUR MONEY":("P"+seat+" GETS PAID"))+"</div>"' + EOL +
  '    +"<div style=\'font:900 30px/1.2 Impact,sans-serif;color:#9cd87c;margin-top:8px;text-shadow:2px 2px 0 #000\'>+"+total+" <span style=\'font-size:16px;color:#f4e4c1;opacity:.8\'>rent from "+count+" block"+(count===1?"":"s")+"</span></div>"' + EOL +
  '    +"<div id=\'kv_lapbal\' style=\'font:700 15px monospace;color:#f4e4c1;margin-top:8px;opacity:.9\'></div>";' + EOL +
  '  document.body.appendChild(b);' + EOL +
  '  requestAnimationFrame(function(){ b.style.opacity="1"; b.style.transform="translate(-50%,-50%) scale(1)"; });' + EOL +
  '  setTimeout(function(){ var v=(window.KV_SEAT&&window.KV_SEAT(seat,"cash")); if(v==null){ v=F()["cash"+seat]; } var e=b.querySelector("#kv_lapbal"); if(e && v!=null) e.textContent="balance now "+Math.round(v); }, 900);' + EOL +
  '  setTimeout(function(){ b.style.opacity="0"; b.style.transform="translate(-50%,-50%) scale(.92)"; setTimeout(function(){ b.remove(); }, 250); }, 2600);' + EOL +
  '})();' + EOL +
  anchor,
  'tall bold lap banner for every player');

fs.writeFileSync('showcase_kascity115.html', html);
console.log('OK showcase_kascity115.html (' + (fs.statSync('showcase_kascity115.html').size/1024/1024).toFixed(1) + ' MB)');
