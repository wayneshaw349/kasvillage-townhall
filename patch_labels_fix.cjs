const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
c = c.replace("'Cancel & Refund'", "'Return Collateral'");
c = c.replace("'Refunding both parties:'", "'Return to Party A + Return to Party B:'");
c = c.replace("Cancel & Refund Both Parties'", "Return Collateral to Both Parties'");
console.log('Fixed labels');
fs.writeFileSync('NeighborAgreement.tsx', c);
