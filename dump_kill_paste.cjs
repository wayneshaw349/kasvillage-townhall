const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(4120,4145).forEach((l,i)=>console.log((4121+i)+': '+l.trim().slice(0,130)));
