const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/Templates Re-Copied/.test(l)) console.log((n+1)+': ['+l.trim()+']'); });
