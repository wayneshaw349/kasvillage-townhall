const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/[Bb]uyer R not found|buyerR.*not|R not found/.test(l)) console.log((n+1)+': ['+l.trim().slice(0,140)+']'); });
