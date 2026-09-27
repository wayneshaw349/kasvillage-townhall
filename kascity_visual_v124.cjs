// kascity_visual_v124.cjs
// Reads showcase_kascity123.html -> showcase_kascity124.html
// Race banners: "YOU'RE IN THE LEAD" / "YOU LOST THE LEAD to P3" / "P3 TAKES THE LEAD" on every
// lead change, plus a chase banner every ~60s when 2nd place is within 12% of the leader
// ("P4 CHASING YOU — 90 behind" / "YOU'RE CHASING P2 — 140 behind").
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity123.html')) die('showcase_kascity123.html missing');
let html = fs.readFileSync('showcase_kascity123.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

const oldA = 'var best=0,bp=0; [1,2,3,4].forEach(function(p){ var nw=st(p,"cash")+st(p,"propval")-st(p,"mort"); if(nw>best){best=nw;bp=p;} });';
const oldB = 'if(bp && bp!==lastLead){ if(lastLead) shout("IN THE LEAD", "P"+bp+" \\u00b7 net worth "+Math.round(best), COL[bp], you(bp)); lastLead=bp; }';
rep(oldA,
  'var rows=[1,2,3,4].map(function(p){ return {p:p, nw:st(p,"cash")+st(p,"propval")-st(p,"mort")}; }).sort(function(a,b){ return b.nw-a.nw; });' + EOL +
  '  var best=rows[0].nw, bp=rows[0].p, second=rows[1];' + EOL +
  '  var hum=(window.KV_HUMANS||[1]);',
  'ranked net worth');
rep(oldB,
  'if(bp && bp!==lastLead){' + EOL +
  '    if(lastLead){' + EOL +
  '      if(you(bp)) shout("YOU\'RE IN THE LEAD", "net worth "+Math.round(best)+" \\u00b7 P"+second.p+" "+Math.round(best-second.nw)+" behind", COL[bp], true);' + EOL +
  '      else if(you(lastLead)) shout("YOU LOST THE LEAD", "P"+bp+" ahead by "+Math.round(best-second.nw), COL[bp], true);' + EOL +
  '      else shout("P"+bp+" TAKES THE LEAD", "net worth "+Math.round(best), COL[bp], false);' + EOL +
  '    }' + EOL +
  '    lastLead=bp; lastChase=Date.now();' + EOL +
  '  } else if(bp && second && Date.now()-lastChase>60000 && best>0 && (best-second.nw)/best<0.12){' + EOL +
  '    lastChase=Date.now();' + EOL +
  '    if(you(bp)) shout("P"+second.p+" CHASING YOU", Math.round(best-second.nw)+" behind", COL[second.p], true);' + EOL +
  '    else if(you(second.p)) shout("YOU\'RE CHASING P"+bp, Math.round(best-second.nw)+" behind", COL[second.p], true);' + EOL +
  '    else shout("P"+second.p+" CHASING P"+bp, Math.round(best-second.nw)+" behind", COL[second.p], false);' + EOL +
  '  }',
  'lead change + chase banners');
rep('var lastLead=0;', 'var lastLead=0, lastChase=0;', 'chase timer');

fs.writeFileSync('showcase_kascity124.html', html);
console.log('OK showcase_kascity124.html (' + (fs.statSync('showcase_kascity124.html').size/1024/1024).toFixed(1) + ' MB)');
