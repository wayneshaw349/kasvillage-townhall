const fs = require('fs');
const f = 'frost_complete.ts';
let c = fs.readFileSync(f, 'utf8');

const FN = 'export function deriveFrostAddressLocal';
const start = c.indexOf(FN);
if (start === -1) { console.error('ABORT: deriveFrostAddressLocal not found'); process.exit(1); }
const next = c.indexOf('export function', start + FN.length);
const end = next === -1 ? c.length : next;
let body = c.slice(start, end);

// idempotency guard
if (body.includes('agrNonceDerived')) { console.error('ABORT: already patched'); process.exit(1); }

const anchor = 'const { pubkeyA, pubkeyB, network, agreementId, frostCounter } = params;';
if (body.split(anchor).length - 1 !== 1) {
  console.error('ABORT: destructure anchor count in fn = ' + (body.split(anchor).length - 1));
  process.exit(1);
}

const replacement =
`const { pubkeyA, pubkeyB, network, agreementId } = params;
  let frostCounter = params.frostCounter; // agrNonceDerived
  if (!(frostCounter && frostCounter > 0) && agreementId) {
    frostCounter = Number(BigInt('0x' + bytesToHex(sha256(new TextEncoder().encode(agreementId)))) % 2147483646n) + 1;
  }`;

body = body.replace(anchor, replacement);
c = c.slice(0, start) + body + c.slice(end);
fs.writeFileSync(f, c);
console.log('OK — patched deriveFrostAddressLocal only');
