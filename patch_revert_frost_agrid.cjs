const fs = require('fs');
const f = 'frost_complete.ts';
let s = fs.readFileSync(f, 'utf8');

// 1. deriveAggregatePubkey: remove _agr from L hash
s = s.replace(
  "const _agr = agreementId ? new TextEncoder().encode(agreementId) : new Uint8Array(0);\n  const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ..._agr, ..._nb]));",
  "const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ..._nb]));"
);

// 2. generateFrostNonce: remove _agrId from _L hash
s = s.replace(
  "const _agrId = frostAddress?.sessionId ? new TextEncoder().encode(frostAddress.sessionId) : new Uint8Array(0);\n  const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._agrId, ..._fnonce]));",
  "const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._fnonce]));"
);

// 3. createPartialSigLocal: remove _agrId from _L hash
s = s.replace(
  "const _agrId = frostAddress?.sessionId ? new TextEncoder().encode(frostAddress.sessionId) : new Uint8Array(0);\n  const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._agrId, ..._fnonce]));",
  "const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._fnonce]));"
);

fs.writeFileSync(f, s);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('_agr in L:', v.includes('..._agr,') ? 'STILL THERE' : 'REMOVED');
console.log('_agrId in L:', v.includes('..._agrId,') ? 'STILL THERE' : 'REMOVED');
console.log('agreementId param kept:', v.includes('agreementId?: string'));
console.log('frostCounter still used:', v.includes('_fnonce'));
