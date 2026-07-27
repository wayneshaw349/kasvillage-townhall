const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8');
const A="console.log('[Neighbor] Agree tapped:', _agrId);";
console.log('anchor count:', s.split(A).length-1);
const lines=s.split(/\r?\n/);
lines.forEach((l,n)=>{ if(/Agree tapped/.test(l)) console.log((n+1)+': ['+l.trim()+']'); });
console.log('--- context after each hit ---');
lines.forEach((l,n)=>{ if(/Agree tapped/.test(l)) { console.log('hit at '+(n+1)+', next 2 lines:'); console.log('  '+(n+2)+': '+lines[n+1].trim().slice(0,80)); console.log('  '+(n+3)+': '+lines[n+2].trim().slice(0,80)); } });
