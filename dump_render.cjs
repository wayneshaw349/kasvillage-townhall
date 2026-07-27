const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(3524,3640).forEach((l,i)=>console.log((3525+i)+': '+l));
