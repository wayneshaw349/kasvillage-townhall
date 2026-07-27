const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/buyerR|buyer_r|Buyer R|R missing|No R|_R /.test(l) && /not|miss|fail|warn|Alert|found/i.test(l)) console.log((n+1)+': ['+l.trim().slice(0,140)+']'); });
console.log('--- KV| parse position check ---');
s.forEach((l,n)=>{ if(/indexOf\(.KV\||includes\(.KV\||startsWith\(.KV\|/.test(l)) console.log((n+1)+': '+l.trim().slice(0,120)); });
