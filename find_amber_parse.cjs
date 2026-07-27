const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/Expected two signatures|split\('\|'\)|split\("\|"\)/.test(l)) console.log((n+1)+': ['+l.trim().slice(0,140)+']'); });
