const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('--- 4040-4048 raw ---');
s.slice(4039,4048).forEach((l,i)=>{const n=4040+i;console.log(n+': ['+s[n-1].slice(0,140)+']');});
console.log('--- 2695-2706 ---');
s.slice(2694,2706).forEach((l,i)=>console.log((2695+i)+': '+l.trim().slice(0,120)));
