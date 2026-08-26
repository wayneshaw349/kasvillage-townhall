// kascity_visual_v129.cjs
// Reads showcase_kascity128.html -> showcase_kascity129.html
// OFFER RECEIVED (bot -> you) expires after 20s with a countdown on the Refuse button, so an
// unanswered offer can't hold the table. Your own bids to humans are unaffected (solo has none).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity128.html')) die('showcase_kascity128.html missing');
let html = fs.readFileSync('showcase_kascity128.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// anchor: the settle() head is unique; the askHuman dialog's append line is the last
// 'ov.appendChild(box); document.body.appendChild(ov);' before it
const head='function settle(tile,buyer,seller,amt){';
if(html.split(head).length-1!==1) die('settle head not unique');
const hi=html.indexOf(head);
const app='ov.appendChild(box); document.body.appendChild(ov);';
const ai=html.lastIndexOf(app, hi);
if(ai<0 || hi-ai>400) die('askHuman append line not found just before settle');
html = html.slice(0, ai+app.length) + EOL +
  '// v129: auto-expire after 20s' + EOL +
  '(function(){ var left=20; var btns=box.querySelectorAll("button"); var ref=btns[1]; var iv=setInterval(function(){ if(!document.body.contains(ov)){ clearInterval(iv); return; } left--; if(ref) ref.textContent="Refuse ("+left+")"; if(left<=0){ clearInterval(iv); ov.remove(); window.KV_LOG("P"+seller+"  let the offer lapse  "+amt, COL[seller]); if(window.KV_MOVE) window.KV_MOVE(seller,"lapse:"+tile,amt); } },1000); })();' +
  html.slice(ai+app.length);
console.log('PASS bot offer dialog expires after 20s');

fs.writeFileSync('showcase_kascity129.html', html);
console.log('OK showcase_kascity129.html (' + (fs.statSync('showcase_kascity129.html').size/1024/1024).toFixed(1) + ' MB)');
