const fs = require('fs');
let code = fs.readFileSync('avatar_arweave_upload.ts', 'utf8');

// Replace the entire deepHash function with arbundles-compatible version
const oldDeepHash = /async function deepHash\(items: Uint8Array\[\]\): Promise<Uint8Array> \{[\s\S]*?return h;\s*\n\}/;

const newDeepHash = `async function deepHash(data: Uint8Array | Uint8Array[]): Promise<Uint8Array> {
  // Exact port of arbundles deepHash - works in React Native with @noble/hashes
  if (data instanceof Uint8Array) {
    // Leaf node: H(H("blob" + length) || H(data))
    const tag = concatBytes(
      new TextEncoder().encode('blob'),
      new TextEncoder().encode(data.byteLength.toString())
    );
    const taggedHash = concatBytes(sha384(tag), sha384(data));
    return sha384(taggedHash);
  }
  // Array node: H("list" + length), then chain: acc = H(acc || deepHash(chunk))
  const tag = concatBytes(
    new TextEncoder().encode('list'),
    new TextEncoder().encode(data.length.toString())
  );
  let acc = sha384(tag);
  for (const chunk of data) {
    const chunkHash = await deepHash(chunk);
    acc = sha384(concatBytes(acc, chunkHash));
  }
  return acc;
}`;

if (code.match(oldDeepHash)) {
  code = code.replace(oldDeepHash, newDeepHash);
  console.log('OK: deepHash replaced with arbundles-compatible version');
} else {
  // Try to find it by the function signature alone
  const start = code.indexOf('async function deepHash(');
  if (start >= 0) {
    // Find the closing brace
    let depth = 0;
    let end = start;
    let foundOpen = false;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') { depth++; foundOpen = true; }
      if (code[i] === '}') { depth--; }
      if (foundOpen && depth === 0) { end = i + 1; break; }
    }
    const oldFunc = code.slice(start, end);
    code = code.slice(0, start) + newDeepHash + code.slice(end);
    console.log('OK: deepHash replaced (manual bounds)');
    console.log('Old func was', oldFunc.split('\n').length, 'lines');
  } else {
    console.log('ERROR: deepHash function not found');
  }
}

// Also update the call site - deepHash now takes Uint8Array | Uint8Array[], not just Uint8Array[]
// The call site passes an array of Uint8Array, which is correct

fs.writeFileSync('avatar_arweave_upload.ts', code);
console.log('Saved. Lines:', code.split('\n').length);

// Verify
const hasRecursive = code.includes('async function deepHash(data: Uint8Array | Uint8Array[])');
const hasBlobTag = code.includes("'blob'");
const hasListTag = code.includes("'list'");
const hasChunkHash = code.includes('await deepHash(chunk)');
console.log('Recursive signature:', hasRecursive ? '✓' : '✗');
console.log('Blob tag:', hasBlobTag ? '✓' : '✗');
console.log('List tag:', hasListTag ? '✓' : '✗');
console.log('Recursive call:', hasChunkHash ? '✓' : '✗');
