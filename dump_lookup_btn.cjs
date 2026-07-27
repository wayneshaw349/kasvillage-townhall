const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(3470,3525).forEach((l,i)=>console.log((3471+i)+': '+l));
