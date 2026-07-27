const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
const show=(a,b)=>{s.slice(a-1,b).forEach((l,i)=>console.log((a+i)+': '+l.trim().slice(0,140)));console.log('');};
console.log('=== pair2 seller copies refund|kill 2920-2930 ===');show(2920,2930);
console.log('=== pair3 seller copies kill tx 4238-4246 ===');show(4238,4246);
console.log('=== pair4 buyer copies cosign 4050-4058 ===');show(4050,4058);
