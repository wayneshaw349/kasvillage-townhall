// patch_serial_v2.cjs — globally comparable serial hash (dedup + recovery)
// Run: node patch_serial_v2.cjs
//
// v1 (hashSerialNumber) mixes in the device anchor, so the hash differs on every
// install. That makes dedup and recovery impossible. v2 uses a fixed global salt
// with a slow KDF: same serial -> same hash everywhere, but enumeration costs
// ITERATIONS hashes per candidate instead of one.
// v1 is left untouched so existing inscribed KV-SerialHash values still verify.
const fs = require('fs');
const P = 'device_attestation.ts';

let src = fs.readFileSync(P, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const before = src;

function count(s) { return src.split(s).length - 1; }

// ---- preconditions ---------------------------------------------------------
if (count('export async function hashSerialNumber') !== 1)
  throw new Error('expected exactly 1 hashSerialNumber definition');
if (src.includes('hashSerialNumberV2'))
  throw new Error('v2 already present — nothing to do');
if (count("const STORE_KEY_SERIAL_HASH = 'kv_serial_hash';") !== 1)
  throw new Error('STORE_KEY_SERIAL_HASH constant not found as expected');

// ---- 1. imports ------------------------------------------------------------
const lines = src.split(/\r?\n/);
let lastImport = -1;
lines.forEach((l, i) => { if (/^import\s/.test(l)) lastImport = i; });
if (lastImport < 0) throw new Error('no import statements found');

const imports = [
  "import { pbkdf2 as noblePbkdf2 } from '@noble/hashes/pbkdf2';",
  "import { sha256 as nobleSha256 } from '@noble/hashes/sha256';",
  "import { bytesToHex as nobleBytesToHex } from '@noble/hashes/utils';",
];
lines.splice(lastImport + 1, 0, ...imports);
src = lines.join(EOL);
console.log('[ok] imports inserted after line ' + (lastImport + 1));

// ---- 2. v2 block appended --------------------------------------------------
const block = [
  '',
  '// ============================================================================',
  '// SERIAL HASH V2 — globally comparable',
  '// ============================================================================',
  '// v1 salts with the device anchor, so the same serial yields a different hash',
  '// on every install: dedup and recovery both impossible. v2 uses a fixed salt so',
  '// the hash is identical everywhere, and a slow KDF so the (small, structured)',
  '// serial space is not cheaply enumerable from a public KV-SerialHash tag.',
  '',
  "const STORE_KEY_SERIAL_HASH_V2 = 'kv_serial_hash_v2';",
  "const SERIAL_SALT_V2 = 'KV_SERIAL_V1';   // fixed and global — do not vary per user",
  'const SERIAL_ITERATIONS_V2 = 100_000;    // ~1-3s on a low-end phone; one-time cost',
  '',
  '/**',
  ' * Normalise before hashing. Without this the SAME serial typed with spaces or',
  ' * dashes hashes differently and dedup silently fails.',
  ' */',
  'export function normalizeSerial(serial: string): string {',
  "  return serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');",
  '}',
  '',
  '/**',
  ' * Deterministic across devices and installs. Safe to inscribe publicly.',
  ' * Deliberately slow — do not call this in a loop or on every render.',
  ' */',
  'export async function hashSerialNumberV2(serial: string): Promise<string> {',
  '  const norm = normalizeSerial(serial);',
  '  if (norm.length < 6) throw new Error(\'serial too short to be valid\');',
  '  const dk = noblePbkdf2(',
  '    nobleSha256,',
  '    new TextEncoder().encode(norm),',
  '    new TextEncoder().encode(SERIAL_SALT_V2),',
  '    { c: SERIAL_ITERATIONS_V2, dkLen: 32 },',
  '  );',
  '  return nobleBytesToHex(dk);',
  '}',
  '',
  '/** Store the v2 hash. Raw serial is never persisted. */',
  'export async function storeSerialHashV2(serial: string): Promise<string> {',
  '  const hash = await hashSerialNumberV2(serial);',
  '  await SecureStore.setItemAsync(STORE_KEY_SERIAL_HASH_V2, hash);',
  '  return hash;',
  '}',
  '',
  '/** Read the stored v2 hash (for inscription). Null if never entered. */',
  'export async function getSerialHashV2(): Promise<string | null> {',
  '  return await SecureStore.getItemAsync(STORE_KEY_SERIAL_HASH_V2);',
  '}',
  '',
  '/**',
  ' * Recompute from a freshly typed serial. Unlike verifySerialNumber this does',
  ' * NOT need anything stored locally, so it works on a wiped device: hand the',
  ' * result to an Arweave KV-SerialHash query to locate the identity.',
  ' */',
  'export async function serialLookupHash(serial: string): Promise<string> {',
  '  return await hashSerialNumberV2(serial);',
  '}',
  '',
  '/** Local check against the stored v2 hash, when one exists. */',
  'export async function verifySerialNumberV2(serial: string): Promise<boolean> {',
  '  const stored = await SecureStore.getItemAsync(STORE_KEY_SERIAL_HASH_V2);',
  '  if (!stored) return false;',
  '  const computed = await hashSerialNumberV2(serial);',
  '  return computed === stored;',
  '}',
  '',
];

src = src.replace(/\s*$/, EOL) + block.join(EOL);
console.log('[ok] v2 block appended');

// ---- post-conditions -------------------------------------------------------
for (const m of [
  'hashSerialNumberV2',
  'normalizeSerial',
  'serialLookupHash',
  'noblePbkdf2',
  'export async function hashSerialNumber(',   // v1 still intact
]) {
  if (!src.includes(m)) throw new Error('post-condition failed: ' + m);
}
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak-serialv2', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak-serialv2');
