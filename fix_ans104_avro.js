const fs = require('fs');
let code = fs.readFileSync('avatar_arweave_upload.ts', 'utf8');

// 1. Remove the duplicate w64LE we accidentally added (the first one at line ~70)
code = code.replace(
`function w64LE(v: number): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = v & 0xff;
  buf[1] = (v >> 8) & 0xff;
  buf[2] = (v >> 16) & 0xff;
  buf[3] = (v >> 24) & 0xff;
  // upper 4 bytes stay 0 for values < 2^32
  return buf;
}

function w16LE`,
'function w16LE'
);
console.log('1: Removed duplicate w64LE');

// 2. Replace serializeTags with Avro-compatible encoding
// ANS-104 uses Apache Avro encoding: zigzag variable-length integers for field lengths
code = code.replace(
`function serializeTags(tags: ArweaveTag[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  
  for (const t of tags) {
    const n = enc.encode(t.name);
    const v = enc.encode(t.value);
    parts.push(w16LE(n.length), n, w16LE(v.length), v);
  }
  
  return concatBytes(...parts);
}`,
`// Avro zigzag variable-length integer encoding (ANS-104 spec)
function avroLong(v: number): Uint8Array {
  // Zigzag encode: (n << 1) ^ (n >> 63)
  let n = v >= 0 ? v * 2 : (-v) * 2 - 1;
  const bytes: number[] = [];
  while (n > 0x7f) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n & 0x7f);
  return new Uint8Array(bytes);
}

function serializeTags(tags: ArweaveTag[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  
  // Avro array: block count (zigzag long), then items, then 0 terminator
  if (tags.length > 0) {
    parts.push(avroLong(tags.length)); // block count
    for (const t of tags) {
      const n = enc.encode(t.name);
      const v = enc.encode(t.value);
      // Each field: zigzag-encoded byte length, then raw bytes
      parts.push(avroLong(n.length), n, avroLong(v.length), v);
    }
  }
  parts.push(avroLong(0)); // end of array marker
  
  return concatBytes(...parts);
}`
);
console.log('2: serializeTags now uses Avro encoding');

// 3. Also fix the deep hash to NOT include tag count/tagBytesLen separately
// The deep hash message should include the raw serialized tags as one blob
// Check current deep hash structure
const deepHashOld = `    concatBytes(w64LE(tagCount), w64LE(serializedTags.length), serializedTags),`;
const deepHashNew = `    serializedTags,`;
if (code.includes(deepHashOld)) {
  code = code.replace(deepHashOld, deepHashNew);
  console.log('3: Fixed deep hash to use raw serialized tags');
} else {
  console.log('3: Deep hash already correct or different format');
}

fs.writeFileSync('avatar_arweave_upload.ts', code);
console.log('Lines:', code.split('\n').length);

// Verify
const w64count = (code.match(/w64LE/g) || []).length;
const avroCount = (code.match(/avroLong/g) || []).length;
console.log('w64LE occurrences:', w64count);
console.log('avroLong occurrences:', avroCount);
