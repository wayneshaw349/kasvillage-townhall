const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

c = c.replace(
  "Step 2: Confirm & Release</Text>",
  "Step 2: {releaseMode === 'cancel' ? 'Cancel & Refund' : 'Confirm & Release'}</Text>"
);
console.log('1. Step title');

c = c.replace(
  "Releasing to seller:</Text>",
  "{releaseMode === 'cancel' ? 'Refunding both parties:' : 'Releasing to seller:'}</Text>"
);
console.log('2. Release label');

c = c.replace(
  "Confirm & Release KASPA to Seller</Text>",
  "{releaseMode === 'cancel' ? '\\u21A9 Cancel & Refund Both Parties' : '\\u2713 Confirm & Release KASPA to Seller'}</Text>"
);
console.log('3. Button label');

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
