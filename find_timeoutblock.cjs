const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/proposal carries no timeout N/i.test(l)) console.log((n+1)+': '+l.trim().slice(0,140)); });
console.log('---');
s.forEach((l,n)=>{ if(/timeoutN/.test(l) && /canon|agr\.|agreement\./.test(l)) console.log((n+1)+': '+l.trim().slice(0,140)); });
