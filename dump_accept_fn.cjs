const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(2554,2572).forEach((l,i)=>console.log((2555+i)+': '+l.trim().slice(0,130)));
