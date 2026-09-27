// kascity_visual_v127.cjs
// Reads showcase_kascity126.html -> showcase_kascity127.html
// Counter-offers: when your bid is under a bot's bar but within 82% of it, the bot counters at its
// bar (rounded to 5) instead of a flat refuse. You get Accept / Decline; accept -> same settle().
// Recorded as counter:<tile> (v = counter price). Also prints the district/tile data shape.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity126.html')) die('showcase_kascity126.html missing');
let html = fs.readFileSync('showcase_kascity126.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('else { if(window.KV_SFX) window.KV_SFX("dang"); if(window.KV_SHOUT) window.KV_SHOUT("REFUSED", "P"+owner+" wanted "+Math.round(threshold)+" \\u00b7 you offered "+v, COL[owner], true); }',
  'else if(v>=threshold*0.82 && (window.KV_SEAT?true:true)){' + EOL +
  '  var cv=Math.ceil(threshold/5)*5;' + EOL +
  '  window.KV_LOG("P"+owner+"  COUNTERS  "+cv+"  for "+d.n, COL[owner]);' + EOL +
  '  if(window.KV_MOVE) window.KV_MOVE(owner,"counter:"+tile,cv);' + EOL +
  '  if(window.KV_SHOUT) window.KV_SHOUT("COUNTER-OFFER", "P"+owner+" wants "+cv+" \\u00b7 you offered "+v, COL[owner], true);' + EOL +
  '  var ov2=document.createElement("div"); ov2.setAttribute("data-kvmodal","1");' + EOL +
  '  ov2.style.cssText="position:fixed;inset:0;z-index:77;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;";' + EOL +
  '  var bx=document.createElement("div");' + EOL +
  '  bx.style.cssText="background:#14100c;border:2px solid "+COL[owner]+";border-radius:12px;padding:18px 22px;font:12px/1.7 monospace;color:#f4e4c1;min-width:300px;text-align:center;";' + EOL +
  '  bx.innerHTML="<div style=\'color:#f0c860;font-weight:700\'>P"+owner+" \\u2014 COUNTER-OFFER</div><div style=\'margin:8px 0\'>"+d.n+" for <b style=\'color:#f0c860;font-size:20px\'>"+cv+"</b></div><div style=\'opacity:.65;font-size:11px\'>you offered "+v+" \\u00b7 you have "+myCash+"</div>";' + EOL +
  '  [["Accept "+cv,1],["Decline",0]].forEach(function(o){ var b=document.createElement("button"); b.textContent=o[0];' + EOL +
  '    b.style.cssText="margin:10px 5px 0;padding:7px 18px;background:"+(o[1]?"#22303a":"#2a2118")+";color:#f4e4c1;border:1px solid "+(o[1]?"#4f7fd9":"#5a4a3a")+";border-radius:5px;font:12px monospace;cursor:pointer;";' + EOL +
  '    b.onclick=function(){ ov2.remove(); if(o[1]){ if(cv>myCash){ window.KV_LOG("can\'t afford the counter","#ff6a4a"); return; } window.KV_LOG("P"+me+"  ACCEPTS COUNTER  "+cv, COL[me]); if(window.KV_MOVE) window.KV_MOVE(me,"bid:"+tile,cv); settle(tile,me,owner,cv); } else { window.KV_LOG("P"+me+"  declines the counter", COL[me]); } };' + EOL +
  '    bx.appendChild(b); });' + EOL +
  '  ov2.appendChild(bx); document.body.appendChild(ov2);' + EOL +
  '} else { if(window.KV_SFX) window.KV_SFX("dang"); if(window.KV_SHOUT) window.KV_SHOUT("REFUSED", "P"+owner+" wanted "+Math.round(threshold)+" \\u00b7 you offered "+v, COL[owner], true); }',
  'counter-offer when the bid is within 82% of the bar');

fs.writeFileSync('showcase_kascity127.html', html);
console.log('OK showcase_kascity127.html (' + (fs.statSync('showcase_kascity127.html').size/1024/1024).toFixed(1) + ' MB)');

console.log('\n==== PROBE (districts) — paste ====');
const L = html.split(/\r?\n/);
const re = /KV_NAMES\s*=|KV_NAMES\[\s*\d+\s*\]\s*=|dbon_|district|DIST\b|\.g\b|group/i;
let n = 0; L.forEach((l, i) => { if (l.length < 1500 && re.test(l) && n < 40) { console.log((i + 1) + ': ' + l.trim().slice(0, 190)); n++; } });
const R = L.find(l => l.indexOf('world.flags.left') >= 0 && l.length > 100000) || '';
const J = R.replace(/\\"/g, '"');
const m = J.indexOf('"dbon_0"'); if (m >= 0) console.log('engine dbon_0: ' + J.slice(Math.max(0, m - 600), m + 200).replace(/\s+/g, ' '));
