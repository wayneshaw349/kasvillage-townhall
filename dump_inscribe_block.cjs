const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(4195,4225).forEach((l,i)=>console.log((4196+i)+': '+l));
