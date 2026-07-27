const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('=== how role is set ===');
s.forEach((l,n)=>{ if(/setRole\(/.test(l)) console.log((n+1)+': '+l.trim().slice(0,120)); });
console.log('=== AMBER box wrapper 4040-4056 ===');
s.slice(4039,4056).forEach((l,i)=>console.log((4040+i)+': '+l.trim().slice(0,110)));
console.log('=== GREEN kill wrapper 4112-4126 ===');
s.slice(4111,4126).forEach((l,i)=>console.log((4112+i)+': '+l.trim().slice(0,110)));
console.log('=== PURPLE cosign wrapper 4165-4180 ===');
s.slice(4164,4180).forEach((l,i)=>console.log((4165+i)+': '+l.trim().slice(0,110)));
