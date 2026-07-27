const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('--- titles as they exist ---');
s.forEach((l,n)=>{ if(/AMBER box|GREEN box|PURPLE box/.test(l)) console.log((n+1)+': ['+l.trim().slice(0,130)+']'); });
console.log('--- setRole lines raw ---');
s.forEach((l,n)=>{ if(/setRole\(/.test(l)) console.log((n+1)+': ['+l+']'); });
console.log('--- waitingForTemplates ---');
s.forEach((l,n)=>{ if(/waitingForTemplates &&/.test(l)) console.log((n+1)+': ['+l.trim().slice(0,110)+']'); });
