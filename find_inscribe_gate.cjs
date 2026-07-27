const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
let a=0;
s.forEach((l,n)=>{ if(/Inscribed to Arweave.*survives phone loss|now funding|FUND-SENTINEL - already|Backup Failed/.test(l)) console.log((n+1)+': '+l.trim().slice(0,130)); });
