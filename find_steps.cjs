const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/\{step === \d|step === \d+ &&/.test(l)) console.log((n+1)+': '+l.trim().slice(0,110)); });
