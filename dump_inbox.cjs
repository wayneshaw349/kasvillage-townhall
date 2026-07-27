const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(2160,2235).forEach((l,i)=>console.log((2161+i)+': '+l));
