const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
const line=s[2223]; // 0-indexed line 2224
console.log('LEN:',line.length);
console.log('HEX:',Buffer.from(line,'utf8').toString('hex'));
console.log('RAW:['+line+']');
