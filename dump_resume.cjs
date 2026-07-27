const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('=== FrostActiveEntry type + helpers 265-305 ===');
s.slice(264,305).forEach((l,i)=>console.log((265+i)+': '+l));
console.log('=== Crash-Recovery 1420-1500 ===');
s.slice(1419,1500).forEach((l,i)=>console.log((1420+i)+': '+l.trim()));
