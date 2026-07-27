const fs=require('fs');const F='SendKAS.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('vault: raw balance only')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_ledgerfix',s);
const A="            try {\n              const { syncLedger } = await import('./utxo_ledger');\n              const ledger = await syncLedger(srcAddr);\n              setBalance(ledger.spendableBalance > 0n ? ledger.spendableBalance : total);\n            } catch {\n              setBalance(total); // fallback to raw\n            }";
const Acr=A.replace(/\n/g,'\r\n');
const B="            if (sendSource === 'vault') {\n              setBalance(total); // vault: raw balance only - never sync shared ledger to vault addr\n            } else try {\n              const { syncLedger } = await import('./utxo_ledger');\n              const ledger = await syncLedger(srcAddr);\n              setBalance(ledger.spendableBalance > 0n ? ledger.spendableBalance : total);\n            } catch {\n              setBalance(total); // fallback to raw\n            }";
const Bcr=B.replace(/\n/g,'\r\n');
if(s.includes(A)) s=s.replace(A,B);
else if(s.includes(Acr)) s=s.replace(Acr,Bcr);
else {console.error('anchor abort');process.exit(1);}
fs.writeFileSync(F,s);console.log('fixed');
