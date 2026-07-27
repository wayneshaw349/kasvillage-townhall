const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('FILL-FROSTADDR')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// buyer create — after "Derived FROST address" (1929)
rep(
"console.log('[Neighbor] Derived FROST address:', frostData.address);",
"console.log('[Neighbor] Derived FROST address:', frostData.address);\n            laUpsert({ agrId: agreementId, frostAddress: frostData.address, frostCounter: frostData.frostCounter }).catch(() => {}); /* FILL-FROSTADDR */",
"buyer-fill");

// seller accept — after "Inbox FROST address" (2785)
rep(
"console.log('[Neighbor] Inbox FROST address:', frostData.address);",
"console.log('[Neighbor] Inbox FROST address:', frostData.address);\n          laUpsert({ agrId, frostAddress: frostData.address, frostCounter: frostData.frostCounter }).catch(() => {}); /* FILL-FROSTADDR */",
"seller-fill");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_fillfrost',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
