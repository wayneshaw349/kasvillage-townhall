const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('=== buyer share/copy 3936-3968 ===');
s.slice(3935,3968).forEach((l,i)=>console.log((3936+i)+': '+l));
console.log('=== third paste 3296-3316 ===');
s.slice(3295,3316).forEach((l,i)=>console.log((3296+i)+': '+l));
