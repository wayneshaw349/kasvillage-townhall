const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
let ok = true, log = [];
function apply(tag, marker, a, b){
  if (s.includes(marker)) { log.push('SKIP ' + tag); return; }
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK   ' + tag); }
  else { ok = false; log.push('MISS(' + n + ') ' + tag); }
}

// FIX 1: toCompactHex -> bytesToHex(toCompactRawBytes())
apply('sign api', 'toCompactRawBytes())',
  "secp256k1.sign(kvSigHash(_bodyOnly), hexToBytes((params as any).buyerPrivKeyHex)).toCompactHex();",
  "bytesToHex(secp256k1.sign(kvSigHash(_bodyOnly), hexToBytes((params as any).buyerPrivKeyHex)).toCompactRawBytes());");

// FIX 2: verify args must be Uint8Array
apply('verify api', 'secp256k1.verify(hexToBytes(_sig)',
  "const _okSig = secp256k1.verify(_sig, kvSigHash(_bodyOnly), proposal.buyerPubkey as string);",
  "const _okSig = secp256k1.verify(hexToBytes(_sig), kvSigHash(_bodyOnly), hexToBytes(proposal.buyerPubkey as string));");

if (ok) { fs.writeFileSync(f, s); console.log('WROTE ' + f); }
else { console.log('NO WRITE:'); }
log.forEach(l => console.log('  ' + l));
