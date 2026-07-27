const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(1955,2005).forEach((l,i)=>console.log((1956+i)+': '+l));
