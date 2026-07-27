const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/partialSig.*\+.*\|.*partialSig|setStringAsync.*partialSig/i.test(l)) console.log((n+1)+': ['+l.trim()+']'); });
