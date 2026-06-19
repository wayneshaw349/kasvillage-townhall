const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
const target = "myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');";
const replacement = "myPubkey = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join(''));";
let count = 0;
while (c.includes(target)) {
  c = c.replace(target, replacement);
  count++;
}
console.log('Replaced', count, 'myPubkey lines (surgical, no surrounding code touched)');
fs.writeFileSync('NeighborAgreement.tsx', c);
