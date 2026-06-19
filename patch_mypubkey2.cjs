const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let count = 0;
while (true) {
  const idx = c.indexOf("myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');");
  if (idx === -1) break;
  // Find the "let myPubkey = ''" before this
  const letIdx = c.lastIndexOf("let myPubkey = '';", idx);
  // Replace from letIdx to end of the '02' line
  const endIdx = idx + "myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');".length;
  c = c.substring(0, letIdx) + "let myPubkey = await SecureStore.getItemAsync('kv_public_key') || '';" + c.substring(endIdx);
  count++;
}
console.log('Replaced', count);
fs.writeFileSync('NeighborAgreement.tsx', c);
