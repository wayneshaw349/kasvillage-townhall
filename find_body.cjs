const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/generateProposal|proposalString|proposalBody|kvClean|templateB64.*proposal|Clipboard\.setStringAsync.*KV|\bKV\|/.test(l)) console.log((n+1)+': '+l.trim()); });
