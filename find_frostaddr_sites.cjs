const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/Inbox FROST address|Derived FROST address|frostData\.address|frostData = |multisigAddress: frostData|\.address, network/.test(l)) console.log((n+1)+': '+l.trim().slice(0,120)); });
