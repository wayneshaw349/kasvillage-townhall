const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

// Mint-once: Lock-step effect must reuse contract.agreementId, not mint a fresh Date.now() each render.
// This is the single source of the buyer/seller address divergence once the address is salted by agrId.

const anchor = 'const agreementId = `AGR_${Date.now()}`;';
const count = c.split(anchor).length - 1;
if (count !== 1) {
  console.error('ABORT: expected exactly 1 mint site, found ' + count);
  process.exit(1);
}

const replacement = 'const agreementId = contract.agreementId || `AGR_${Date.now()}`; // mint-once: reuse pasted/prior agrId so address stays stable across renders/retries';
c = c.replace(anchor, replacement);

fs.writeFileSync(f, c);
console.log('OK — Lock-step now reuses contract.agreementId (mint-once)');
