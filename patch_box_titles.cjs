const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('the box titled')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

rep(
"'KasVillage agreement proposal. Open Neighbor Agreement, tap Resume, and paste ALL of this into the BLUE box (Paste Buyer Proposal). /* PASTE-INSTRUCTIONS */\\n\\n'",
"'KasVillage agreement proposal. Open Neighbor Agreement and paste ALL of this into the box titled \"Paste Buyer Proposal\" (blue). /* PASTE-INSTRUCTIONS */\\n\\n'",
"p1-title");

rep(
"'KasVillage refund+kill templates. Paste ALL of this into your AMBER box (refund template) in Neighbor Agreement, co-sign, and send your signature back.\\n\\n'",
"'KasVillage refund+kill templates. In Neighbor Agreement, paste ALL of this into the box titled \"Paste seller refund template\" (amber), co-sign, and send your signature back.\\n\\n'",
"p2-title");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_boxtitles',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
