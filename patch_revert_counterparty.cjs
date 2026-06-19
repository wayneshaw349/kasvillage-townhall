const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// L1897: handleSetCounterparty is NOT async and this is the COUNTERPARTY's key (not ours)
// Revert to original — counterparty pubkey comes from proposal, not SecureStore
c = c.replace(
  "const pubkeyHex = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join(''));",
  "const pubkeyHex = '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join(''); // Counterparty: prefix unknown from address, proposal overrides"
);
console.log('Reverted counterparty derivation (not our key)');
fs.writeFileSync('NeighborAgreement.tsx', c);
