const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
c = c.replace(
  "verificationCode: contract.verificationCode || '',",
  "verificationCode: contract.verificationCode || '',\n                            buyerPubkey: myPubkey || '',"
);
fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('OK:', c.includes("buyerPubkey: myPubkey"));
