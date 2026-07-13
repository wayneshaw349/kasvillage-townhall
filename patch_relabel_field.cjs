const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

const edits = [
  { from: '>Counterparty Kaspa Address</Text>', to: ">Seller's Response (pubkey)</Text>" },
  { from: 'placeholder="kaspatest:qr..."', to: 'placeholder="Paste seller\'s pubkey: 03..."' },
  { from: '"Paste your counterparty\'s wallet address"', to: '"Paste the seller\'s pubkey (03...), from their response"' },
];

for (const e of edits) {
  const n = c.split(e.from).length - 1;
  if (n !== 1) { console.error('ABORT: anchor count ' + n + ' for: ' + e.from); process.exit(1); }
}
for (const e of edits) c = c.replace(e.from, e.to);

fs.writeFileSync(f, c);
console.log('OK — label, placeholder, and hint updated for seller pubkey');
