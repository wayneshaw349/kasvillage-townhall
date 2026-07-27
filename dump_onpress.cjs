const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
for(let i=3463;i<3478;i++){console.log((i+1)+': '+s[i]);}
