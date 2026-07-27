const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/addToFrostList|kv_frost_list|Background-FROST|Crash-Recovery|Arweave-Restore|getFrostList|frostList|updateFrostEntry/.test(l)) console.log((n+1)+': '+l.trim()); });
