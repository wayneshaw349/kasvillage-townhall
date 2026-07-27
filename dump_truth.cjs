const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
console.log('--- box header Texts ---');
s.forEach((l,n)=>{ if(/Paste Kill Tx from Seller|Paste Buyer.s Refund Sign|refund template|Paste seller/i.test(l) && /<Text/.test(l)) console.log((n+1)+': ['+l.trim().slice(0,140)+']'); });
console.log('--- accept-flow derivation context 1270-1285 ---');
s.slice(1269,1285).forEach((l,i)=>console.log((1270+i)+': '+l.trim().slice(0,120)));
console.log('--- third-paste derivation context 3375-3390 ---');
s.slice(3374,3390).forEach((l,i)=>console.log((3375+i)+': '+l.trim().slice(0,120)));
console.log('--- template paste box wrapper: search around amber paste input ---');
s.forEach((l,n)=>{ if(/seller.*frozen|frozen their collateral|templates.*paste|Paste.*templates/i.test(l)) console.log((n+1)+': ['+l.trim().slice(0,140)+']'); });
