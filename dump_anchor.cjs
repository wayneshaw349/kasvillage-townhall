const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
for(let i=2219;i<2226;i++){console.log('--- '+(i+1)+' ---');console.log('['+s[i]+']');}
