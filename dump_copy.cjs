const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
[3954,3955].forEach(i=>{console.log('--- '+(i+1)+' ---');console.log('['+s[i]+']');console.log('HEX head:',Buffer.from(s[i].slice(0,30),'utf8').toString('hex'));});
