const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(1705,1740).forEach((l,i)=>console.log((1706+i)+': '+l));
