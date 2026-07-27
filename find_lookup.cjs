const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('=== Look Up Agreement handler ===');
s.forEach((l,n)=>{ if(/Look Up Agreement|lookupAgreement|handleLookup|manualVerCode|manualAgrId.*lookup|Enter Code to Unlock/i.test(l)) console.log((n+1)+': '+l.trim().slice(0,130)); });
console.log('=== contract shape: setContract with many fields (find the biggest one) ===');
s.forEach((l,n)=>{ if(/setContract\(\{|frostData:|multisigAddress:|itemPriceKas:|sellerCommitmentKas:|agreementId:/.test(l)) console.log((n+1)+': '+l.trim().slice(0,110)); });
