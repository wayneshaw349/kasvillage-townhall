const fs = require('fs');
const f = 'canonical_agreement_steps.ts';
let s = fs.readFileSync(f, 'utf8');

// 1. Remove agrId from deriveAggregateKey signature and computeL call
s = s.replace(
  /export function deriveAggregateKey\(\s*pubkeyA: string,\s*pubkeyB: string,\s*counter\?: number,\s*agrId\?: string\s*\)/,
  'export function deriveAggregateKey(\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number\n)'
);
// Remove agrId from computeL call inside deriveAggregateKey
s = s.replace(/const L = computeL\(pk1, pk2, counter, agrId\);/, 'const L = computeL(pk1, pk2, counter);');

// 2. Remove agrId from computeL signature
s = s.replace(
  /export function computeL\(pk1: string, pk2: string, counter\?: number, agrId\?: string\)/,
  'export function computeL(pk1: string, pk2: string, counter?: number)'
);
// Remove agrId bytes from computeL body
s = s.replace(
  /const agrIdBytes =[\s\S]*?new Uint8Array\(0\);/,
  ''
);
s = s.replace(
  /\.\.\.(agrIdBytes|hexToBytes\(agrId[^)]*\))/g,
  ''
);
// Clean up any trailing commas from removed agrId bytes
s = s.replace(/,\s*,/g, ',');
s = s.replace(/\[\.\.\.hexToBytes\(pk1\), \.\.\.hexToBytes\(pk2\), \.\.\.counterBytes,\s*\]/,
  '[...hexToBytes(pk1), ...hexToBytes(pk2), ...counterBytes]');

// 3. Remove agrId from generateNonce signature
s = s.replace(
  /export function generateNonce\(\s*privateKeyHex: string,\s*pubkeyA: string,\s*pubkeyB: string,\s*counter\?: number,\s*agrId\?: string\s*\)/,
  'export function generateNonce(\n  privateKeyHex: string,\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number\n)'
);
// Remove agrId from calls inside generateNonce
s = s.replace(/const L = computeL\(pk1, pk2, counter, agrId\);/g, 'const L = computeL(pk1, pk2, counter);');
s = s.replace(/const agg = deriveAggregateKey\(pubkeyA, pubkeyB, counter, agrId\);/g, 'const agg = deriveAggregateKey(pubkeyA, pubkeyB, counter);');

// 4. Remove agrId from buyerBuildTemplate
s = s.replace(/params\.buyerPubkey,\s*params\.sellerPubkey,\s*params\.counter,\s*params\.agrId/g,
  'params.buyerPubkey,\n    params.sellerPubkey,\n    params.counter');

// 5. Remove agrId from sellerSignTemplate  
s = s.replace(/const agrId = template\.agr \|\| '';\s*\n\s*const agg = deriveAggregateKey\(buyerPubkey, sellerPubkey, counter, agrId\);/g,
  'const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);');
s = s.replace(/const nonce = generateNonce\(privateKeyHex, buyerPubkey, sellerPubkey, counter, agrId\);/g,
  'const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter);');

// 6. Remove agrId from buyerAggregate
s = s.replace(/const agrId = template\.agr \|\| '';\s*\n\s*\n\s*const agg = deriveAggregateKey\(buyerPubkey, sellerPubkey, counter, agrId\);/g,
  'const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);');

fs.writeFileSync(f, s);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('agrId in computeL:', v.includes('agrId') && v.indexOf('agrId') < v.indexOf('deriveAggregateKey') ? 'STILL THERE' : 'REMOVED');
console.log('agrId refs remaining:', (v.match(/agrId/g) || []).length);
console.log('computeL signature clean:', !v.includes('computeL(pk1: string, pk2: string, counter?: number, agrId'));
console.log('deriveAggregateKey clean:', !v.includes('deriveAggregateKey(\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number,\n  agrId'));
