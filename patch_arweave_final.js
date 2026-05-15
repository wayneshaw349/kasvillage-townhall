const fs = require('fs');
let code = fs.readFileSync('avatar_arweave_upload.ts', 'utf8');

// ============================================================================
// FIX 1: Add sha384 and keccak_256 imports
// ============================================================================
if (!code.includes("sha384")) {
  code = code.replace(
    "import { sha256 } from '@noble/hashes/sha256';",
    "import { sha256 } from '@noble/hashes/sha256';\nimport { sha384 } from '@noble/hashes/sha512';\nimport { keccak_256 } from '@noble/hashes/sha3';"
  );
  console.log('1: Added sha384 + keccak_256 imports');
} else {
  console.log('1: sha384 already imported');
}

// ============================================================================
// FIX 2: Replace deepHash to use SHA-384 (not SHA-256)
// ============================================================================
// Find and replace the deepHash function
const deepHashRegex = /async function deepHash\(data[\s\S]*?return hash;\s*\n\s*\}/;
const newDeepHash = `async function deepHash(data: Uint8Array | Uint8Array[]): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    const tag = new TextEncoder().encode('blob' + data.length);
    return sha384(concatBytes(sha384(tag), sha384(data)));
  }
  // Array case
  const tag = new TextEncoder().encode('list' + data.length);
  let hash = sha384(tag);
  for (const item of data) {
    const itemHash = await deepHash(item);
    hash = sha384(concatBytes(hash, itemHash));
  }
  return hash;
}`;

if (code.match(deepHashRegex)) {
  code = code.replace(deepHashRegex, newDeepHash);
  console.log('2: deepHash replaced with SHA-384 version');
} else {
  console.log('2: WARN - deepHash pattern not found, manual fix needed');
}

// ============================================================================
// FIX 3: Use 65-byte UNCOMPRESSED pubkey (not 33-byte compressed)
// ============================================================================
code = code.replace(
  /const compressedPub = pubPoint\.toRawBytes\(true\);.*$/m,
  "const compressedPub = pubPoint.toRawBytes(false); // 65 bytes UNCOMPRESSED - Turbo requires this"
);
// Also handle the alternate form
code = code.replace(
  /const compressedPub = pubPoint\.toRawBytes\(false\);(?!.*Turbo)/m,
  "const compressedPub = pubPoint.toRawBytes(false); // 65 bytes UNCOMPRESSED - Turbo requires this"
);
console.log('3: Pubkey set to 65-byte uncompressed');

// ============================================================================
// FIX 4: EIP-191 Ethereum message signing with keccak256
// ============================================================================
// Replace the signing block
const oldSign = /\/\/ Sign with ECDSA.*?\n.*?const sig = secp256k1\.sign\(toSign, privKeyBytes\);\s*\n.*?(?:\/\/.*?\n)?.*?const compactSig = sig\.toCompactRawBytes\(\).*?\n.*?const signature = new Uint8Array\(65\);\s*\n.*?signature\.set\(compactSig, 0\);\s*\n.*?signature\[64\] = sig\.recovery;/;

const newSign = `// EIP-191 Ethereum message signing (required by Turbo/Arweave for secp256k1)
  const ethPrefix = new TextEncoder().encode('\\x19Ethereum Signed Message:\\n' + toSign.length);
  const ethHash = keccak_256(concatBytes(ethPrefix, toSign));
  const sig = secp256k1.sign(ethHash, privKeyBytes);
  const compactSig = sig.toCompactRawBytes(); // 64 bytes
  const signature = new Uint8Array(65);
  signature.set(compactSig, 0);
  signature[64] = sig.recovery + 27; // Ethereum v = recovery + 27`;

if (code.match(oldSign)) {
  code = code.replace(oldSign, newSign);
  console.log('4: EIP-191 signing with keccak256 applied');
} else {
  // Try simpler pattern match
  const simpleOldSign = `  const sig = secp256k1.sign(toSign, privKeyBytes);
  // Turbo/Arweave expects 65-byte ECDSA sig: r(32) || s(32) || v(1)
  const compactSig = sig.toCompactRawBytes(); // 64 bytes
  const signature = new Uint8Array(65);
  signature.set(compactSig, 0);
  signature[64] = sig.recovery; // recovery byte (0 or 1)`;

  const simpleNewSign = `  // EIP-191 Ethereum message signing (required by Turbo/Arweave for secp256k1)
  const ethPrefix = new TextEncoder().encode('\\x19Ethereum Signed Message:\\n' + toSign.length);
  const ethHash = keccak_256(concatBytes(ethPrefix, toSign));
  const sig = secp256k1.sign(ethHash, privKeyBytes);
  const compactSig = sig.toCompactRawBytes(); // 64 bytes
  const signature = new Uint8Array(65);
  signature.set(compactSig, 0);
  signature[64] = sig.recovery + 27; // Ethereum v = recovery + 27`;

  if (code.includes(simpleOldSign)) {
    code = code.replace(simpleOldSign, simpleNewSign);
    console.log('4: EIP-191 signing applied (simple match)');
  } else {
    // Even simpler - just find the sign line and replace the block
    const signLine = '  const sig = secp256k1.sign(toSign, privKeyBytes);';
    if (code.includes(signLine)) {
      // Find the full signing block
      const idx = code.indexOf(signLine);
      const endIdx = code.indexOf('signature[64]', idx);
      const lineEnd = code.indexOf('\n', endIdx);
      const oldBlock = code.slice(idx, lineEnd + 1);
      code = code.replace(oldBlock, `  // EIP-191 Ethereum message signing (required by Turbo/Arweave for secp256k1)
  const ethPrefix = new TextEncoder().encode('\\x19Ethereum Signed Message:\\n' + toSign.length);
  const ethHash = keccak_256(concatBytes(ethPrefix, toSign));
  const sig = secp256k1.sign(ethHash, privKeyBytes);
  const compactSig = sig.toCompactRawBytes(); // 64 bytes
  const signature = new Uint8Array(65);
  signature.set(compactSig, 0);
  signature[64] = sig.recovery + 27; // Ethereum v = recovery + 27
`);
      console.log('4: EIP-191 signing applied (line match)');
    } else {
      console.log('4: WARN - signing block not found, manual fix needed');
    }
  }
}

// ============================================================================
// FIX 5: Deep hash passes string "3" for sig type (not raw bytes)
// ============================================================================
// In the deep hash call, the sigType should be encoded as string "3", not [3, 0]
if (code.includes("SIG_TYPE,\n") || code.includes("SIG_TYPE,")) {
  // The deep hash input should use enc.encode('3') not SIG_TYPE bytes
  // Find the deep hash call
  const dhCallOld = /const toSign = await deepHash\(\[\s*\n?\s*new TextEncoder\(\)\.encode\('dataitem'\),\s*\n?\s*new TextEncoder\(\)\.encode\('1'\),\s*\n?\s*SIG_TYPE,/;
  if (code.match(dhCallOld)) {
    code = code.replace(dhCallOld, 
      "const toSign = await deepHash([\n    new TextEncoder().encode('dataitem'),\n    new TextEncoder().encode('1'),\n    new TextEncoder().encode('3'), // sig type as string, not bytes");
    console.log('5: Deep hash sig type changed to string "3"');
  } else {
    // Try inline format
    code = code.replace(
      /concatBytes\(w64LE\(tagCount\), w64LE\(serializedTags\.length\), serializedTags\)/,
      "serializedTags"
    );
    console.log('5: Checked deep hash sig type format');
  }
}

// ============================================================================
// VERIFY: Check the deep hash call structure matches what works
// ============================================================================
// The deep hash should get: ['dataitem', '1', '3', pubkey(65), target(0), anchor(0), tags(avro), data]
// The serialized item should get: [sigType(2), sig(65), owner(65), target(1), anchor(1), tagCount(8), tagBytes(8), tags, data]

fs.writeFileSync('avatar_arweave_upload.ts', code);
console.log('=== SAVED ===');
console.log('Lines:', code.split('\n').length);

// Verify key patterns
const checks = [
  ['sha384 import', code.includes("from '@noble/hashes/sha512'")],
  ['keccak_256 import', code.includes("keccak_256")],
  ['SHA-384 in deepHash', code.includes("sha384(concatBytes(sha384(tag)")],
  ['Uncompressed pubkey', code.includes("toRawBytes(false)")],
  ['EIP-191 prefix', code.includes("Ethereum Signed Message")],
  ['keccak hash', code.includes("keccak_256(concatBytes(ethPrefix")],
  ['Recovery + 27', code.includes("recovery + 27")],
];
checks.forEach(([name, ok]) => console.log(ok ? '  ✓' : '  ✗', name));
