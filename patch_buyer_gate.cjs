const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');
const A="if (role === 'buyer' && balance >= otherExpected && myExpected > 0) {";
const B="if (role === 'buyer' && balance >= otherExpected * 0.95 && myExpected > 0) {";
if(s.includes(B)){console.log('already patched');process.exit(0);}
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count='+c+' (need 1) — abort');process.exit(1);}
fs.writeFileSync(F+'.bak_buyergate',s);
s=s.replace(A,B);
fs.writeFileSync(F,s);console.log('patched ok');
