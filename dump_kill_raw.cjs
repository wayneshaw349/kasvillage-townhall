const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.slice(4130,4148).forEach((l,i)=>{const n=4131+i;console.log(n+': ['+s[n-1]+']');});
