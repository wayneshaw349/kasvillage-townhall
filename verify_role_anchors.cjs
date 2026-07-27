const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8');
const anchors={
 "amber-title":"AMBER box \u2014 The seller has frozen",
 "green-title":">GREEN box \u2014 Paste Kill Tx from Seller",
 "purple-title":">PURPLE box \u2014 Paste Buyer's Refund Sign",
 "accept-setrole":"setRole(myRole);",
 "paste3-setrole":"setRole(_role);"
};
for(const [k,a] of Object.entries(anchors)){console.log(k+':',s.split(a).length-1);}
const L=s.split(/\r?\n/);
console.log('--- 2600-2612 (accept derivation context) ---');
L.slice(2599,2612).forEach((l,i)=>console.log((2600+i)+': '+l.trim().slice(0,120)));
console.log('--- 3390-3400 (paste3 derivation context) ---');
L.slice(3389,3400).forEach((l,i)=>console.log((3390+i)+': '+l.trim().slice(0,120)));
console.log('--- 4040-4047 (AMBER wrapper opening) ---');
L.slice(4039,4047).forEach((l,i)=>console.log((4040+i)+': '+l.trim().slice(0,120)));
