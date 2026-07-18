// patch_k_per_input_neighbor.cjs   —  PATCH 2 of 2  (callers + storage)
//
// Patch 1 made the crypto core refuse to reuse k. This wires the callers to it.
//
// Storage shape changes. v1 blobs held ONE {k, d_tweaked, R_hex}; v2 holds an
// array, one entry per input, in the template's sorted u[] order:
//
//   kv_frost_nonce_<agrId>            { v: 2, nonces: [...] }
//   kv_refund_pending_<agrId>.nonces      (was .nonce)
//   kv_refund_pending_<agrId>.killNonces  (was .killNonce)
//
// A v1 blob is REFUSED, not migrated. There is nothing to migrate to: one k
// cannot become N. Anything mid-flight must be rebuilt or re-accepted. Loud
// refusal beats a silent single-k signature.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
let applied = 0;

const rx = (lines) =>
  new RegExp(lines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ \\t]*\\r?\\n[ \\t]*'));
const countRx = (p) => (s.match(new RegExp(p.source, 'g')) || []).length;

function sub(oldStr, newLines, tag) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const i = s.indexOf(oldStr);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  s = s.slice(0, ls) + newLines.map(l => (l ? ind + l : '')).join(NL) + s.slice(i + oldStr.length);
  applied++; console.log(`APPLIED [${tag}]`);
}

function subRx(pat, newLines, tag) {
  const n = countRx(pat);
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const m = s.match(pat);
  const i = s.indexOf(m[0]);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  s = s.slice(0, ls) + newLines.map(l => (l ? ind + l : '')).join(NL) + s.slice(i + m[0].length);
  applied++; console.log(`APPLIED [${tag}]`);
}

// ===================== A. cancel/split path (buildReleaseTemplateFn) =====================
// The caller no longer generates the nonce: buildReleaseTemplate does it AFTER the
// sort, so R[i] lines up with u[i]. Generating out here would misalign them.
sub("        const _nonce = generateNonce(wallet.privKeyHex, contract.buyerPubkey || '', contract.sellerPubkey || '', contract.frostData?.frostCounter || 0);",
  ['// nonces are generated inside buildReleaseTemplate, after the UTXO sort.'],
  'cancel-drop-nonce');

sub("        const { template: _cTmpl, description: _cDesc } = buildReleaseTemplateFn({",
  ['const { template: _cTmpl, description: _cDesc, nonces: _cNonces } = buildReleaseTemplateFn({'],
  'cancel-destructure');

sub("          R_hex: _nonce.R_hex, agrId: contract.agreementId || '',",
  ['privateKeyHex: wallet.privKeyHex,',
   "buyerPubkey: contract.buyerPubkey || '',",
   "sellerPubkey: contract.sellerPubkey || '',",
   'counter: contract.frostData?.frostCounter || 0,',
   "agrId: contract.agreementId || '',"],
  'cancel-params');

sub("        await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ k: _nonce.k.toString(16), d_tweaked: _nonce.d_tweaked.toString(16), R_hex: _nonce.R_hex, createdAt: Date.now() }));",
  ['// v2: one k per input, array order == template u[] order.',
   "await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ v: 2, nonces: _cNonces.map((n: any) => ({ k: n.k.toString(16), d_tweaked: n.d_tweaked.toString(16), R_hex: n.R_hex })), createdAt: Date.now() }));"],
  'cancel-store');

// ===================== B. release path (buyerBuildTemplate) =====================
sub("      await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ k: result.nonce.k.toString(16), d_tweaked: result.nonce.d_tweaked.toString(16), R_hex: result.nonce.R_hex }));",
  ['// v2: one k per input, array order == template u[] order.',
   "await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ v: 2, nonces: result.nonces.map((n: any) => ({ k: n.k.toString(16), d_tweaked: n.d_tweaked.toString(16), R_hex: n.R_hex })), createdAt: Date.now() }));"],
  'release-store');

// ===================== C. processSellerResponse =====================
sub("      const nonce = { k: BigInt('0x' + savedNonce.k), d_tweaked: BigInt('0x' + savedNonce.d_tweaked), R_hex: savedNonce.R_hex };",
  ['// A v1 blob holds ONE k. Reconstituting it would sign every input with the same',
   '// k and publish the wallet key by division. There is no migration - one k cannot',
   '// become N. Refuse and make them rebuild.',
   "if (!Array.isArray(savedNonce?.nonces)) { Alert.alert('Rebuild the Template', 'The stored nonce is from the old single-k format and cannot be used safely. Tap Build TX Template again.'); return; }",
   "const nonces = savedNonce.nonces.map((n: any) => ({ k: BigInt('0x' + n.k), d_tweaked: BigInt('0x' + n.d_tweaked), R_hex: n.R_hex }));"],
  'processSellerResponse-load');

subRx(rx(['const aggResult = buyerAggregate({', 'nonce,']),
  ['const aggResult = buyerAggregate({', '  nonces,'],
  'processSellerResponse-agg');

// ===================== D. kv_refund_pending_ write =====================
sub("                nonce: { k: _refund.nonce.k.toString(16), d_tweaked: _refund.nonce.d_tweaked.toString(16), R_hex: _refund.nonce.R_hex },",
  ['nonces: _refund.nonces.map((n: any) => ({ k: n.k.toString(16), d_tweaked: n.d_tweaked.toString(16), R_hex: n.R_hex })),'],
  'refund-pending-nonces');

sub("                killNonce: { k: _kill.nonce.k.toString(16), d_tweaked: _kill.nonce.d_tweaked.toString(16), R_hex: _kill.nonce.R_hex },",
  ['killNonces: _kill.nonces.map((n: any) => ({ k: n.k.toString(16), d_tweaked: n.d_tweaked.toString(16), R_hex: n.R_hex })),'],
  'refund-pending-killNonces');

// ===================== E. refund aggregate =====================
sub("                              const _nonce = { k: BigInt('0x' + _p.nonce.k), d_tweaked: BigInt('0x' + _p.nonce.d_tweaked), R_hex: _p.nonce.R_hex };",
  ['// v1 pending blob: single k for refund AND kill. Cannot be signed safely, and',
   '// nothing has moved yet, so refusing costs only a re-accept.',
   "if (!Array.isArray(_p.nonces) || !Array.isArray(_p.killNonces)) { Alert.alert('Re-accept Required', 'This pending refund was frozen under the old single-k format and cannot be signed safely. Your collateral was NOT sent - re-accept the agreement to start over.'); setIsLoading(false); return; }",
   "const _nonces = _p.nonces.map((n: any) => ({ k: BigInt('0x' + n.k), d_tweaked: BigInt('0x' + n.d_tweaked), R_hex: n.R_hex }));"],
  'refund-agg-load');

sub('                                nonce: _nonce,', ['nonces: _nonces,'], 'refund-agg-param');

// ===================== F. kill aggregate =====================
sub("                              const _killNonce = { k: BigInt('0x' + _p.killNonce.k), d_tweaked: BigInt('0x' + _p.killNonce.d_tweaked), R_hex: _p.killNonce.R_hex };",
  ["const _killNonces = _p.killNonces.map((n: any) => ({ k: BigInt('0x' + n.k), d_tweaked: BigInt('0x' + n.d_tweaked), R_hex: n.R_hex }));"],
  'kill-agg-load');

sub('                                nonce: _killNonce,', ['nonces: _killNonces,'], 'kill-agg-param');

// ===================== CHECKS =====================
if (applied !== 13) { console.error(`ABORT - ${applied}/13 applied, file NOT written`); process.exit(1); }

const post = [
  // every v1 single-k read must be gone
  ['_p.nonce.', 0],
  ['_p.killNonce.', 0],
  ['result.nonce.', 0],
  ['_refund.nonce.', 0],
  ['_kill.nonce.', 0],
  ['savedNonce.k', 0],
  ['savedNonce.d_tweaked', 0],
  ['_nonce.R_hex', 0],
  ['_nonce.k.toString', 0],
  // and every buyerAggregate call must pass an array
  ['nonces: _nonces,', 1],
  ['nonces: _killNonces,', 1],
  ['nonces: result.nonces.map', 0],   // stored via map(), not passed
  ['result.nonces.map', 1],
  ['_cNonces.map', 1],
  ['_refund.nonces.map', 1],
  ['_kill.nonces.map', 1],
  // v1 refusal gates present
  ['!Array.isArray(savedNonce?.nonces)', 1],
  ['!Array.isArray(_p.nonces) || !Array.isArray(_p.killNonces)', 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('  npx tsc --noEmit 2>&1 | Select-String "NeighborAgreement.tsx" | Measure-Object | Select Count');
console.log('');
console.log('Expect 29 (baseline). Anything above = a caller I missed.');
console.log('');
console.log('IN-FLIGHT STATE IS REFUSED, NOT MIGRATED. One k cannot become N.');
console.log('  - any kv_frost_nonce_ from a template built before now  -> rebuild');
console.log('  - any kv_refund_pending_ frozen before now              -> re-accept');
console.log('  - c6d61b74: seller 6 KAS already funded, kill already broadcast,');
console.log('    refund dead. Its pending blob is v1. That agreement is finished.');
console.log('');
console.log('NOT touched (pre-existing, in the 29):');
console.log('  - releaseMode can be "split", ReleaseMode cannot. computeReleaseOutputs');
console.log('    has no split case -> falls through -> outputs undefined -> crash.');
console.log('    Live bug on the split path. Separate fix.');
