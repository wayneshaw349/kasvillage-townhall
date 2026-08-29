const L=require('fs').readFileSync('showcase_kascity100.html','utf8').split(/\r?\n/);
const J=L[9921];
function f(re,k){const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');
  all.slice(0,k).forEach(x=>console.log('  @'+x.index+' '+J.slice(Math.max(0,x.index-80),x.index+130).replace(/\s+/g,' ')));}
f(/left\s*[:=]\s*\d+/g,4);
f(/\b(480|540|600)\b(?!\s*-)/g,6);
f(/mgmt_open|mgmtOpen|card_open|deck_open|pending_mgmt|mgmt_seat|mgmt_t/g,6);
f(/human_turn|turn_seat|cur_seat|whose|active_seat|"turn"/g,6);
f(/p2p|offer_open|bid_open/g,6);
f(/"onClick"|"click"|onclick|pointerdown|"tap"/g,6);
console.log('---- seal');
for(let i=7335;i<7380;i++)console.log((i+1)+': '+L[i].trim().slice(0,200));
