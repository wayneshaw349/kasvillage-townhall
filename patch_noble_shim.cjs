// patch_noble_shim.cjs — make the sha256 shim satisfy pbkdf2's CHash type
// Run: node patch_noble_shim.cjs
//
// noble_d.ts declares `sha256(data: Uint8Array): Uint8Array`, which lacks the
// outputLen/blockLen/create members pbkdf2 requires. pbkdf2 itself isn't in the
// shim, so TS uses the real package types for it — hence the mismatch.
// Type-only change; runtime behaviour is unaffected.
const fs = require('fs');
const path = require('path');

// locate the shim wherever it lives
function find(name, dir = '.', depth = 0) {
  if (depth > 3) return null;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(name, p, depth + 1); if (r) return r; }
    else if (e.name === name) return p;
  }
  return null;
}

const P = find('noble_d.ts') || find('noble.d.ts');
if (!P) throw new Error('noble_d.ts / noble.d.ts not found in tree');
console.log('shim: ' + P);

let src = fs.readFileSync(P, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const before = src;

const OLD = 'export function sha256(data: Uint8Array): Uint8Array;';
const n = src.split(OLD).length - 1;
if (n !== 2) throw new Error(`expected 2 sha256 declarations, found ${n}`);

const NEW = [
  '// CHash shape — pbkdf2/hmac require these members, not just the call signature.',
  'export const sha256: {',
  '  (data: Uint8Array | string): Uint8Array;',
  '  outputLen: number;',
  '  blockLen: number;',
  '  create(): any;',
  '};',
].join(EOL + '  ');

src = src.split(OLD).join(NEW);
console.log('[ok] sha256 declarations upgraded (2)');

// add pbkdf2 to the shim so both sides resolve consistently
if (!src.includes("@noble/hashes/pbkdf2")) {
  src = src.replace(/\s*$/, EOL) + [
    '',
    "declare module '@noble/hashes/pbkdf2' {",
    '  export function pbkdf2(',
    '    hash: any,',
    '    password: Uint8Array | string,',
    '    salt: Uint8Array | string,',
    '    opts: { c: number; dkLen: number },',
    '  ): Uint8Array;',
    '}',
    '',
    "declare module '@noble/hashes/pbkdf2.js' {",
    '  export function pbkdf2(',
    '    hash: any,',
    '    password: Uint8Array | string,',
    '    salt: Uint8Array | string,',
    '    opts: { c: number; dkLen: number },',
    '  ): Uint8Array;',
    '}',
    '',
  ].join(EOL);
  console.log('[ok] pbkdf2 module declared');
} else {
  console.log('[skip] pbkdf2 already declared');
}

if (!src.includes('outputLen')) throw new Error('post-condition failed: outputLen');
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak-shim', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak-shim');
