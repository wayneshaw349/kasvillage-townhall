/**
 * KasVillage FROST 2-of-2 Headless Test
 * Uses same blake2b(key) approach as kaspa_rest_tx.ts
 */
const { secp256k1 } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { blake2b } = require('@noble/hashes/blake2b');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

const N = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;
const HASH_KEY = new TextEncoder().encode('TransactionSigningHash');

function kb2b(data) { return blake2b(data, { dkLen: 32, key: HASH_KEY }); }
function mod(a, m) { return ((a % m) + m) % m; }
function concat(...arrs) { const t = arrs.reduce((s, a) => s + a.length, 0); const r = new Uint8Array(t); let o = 0; for (const a of arrs) { r.set(a, o); o += a.length; } return r; }
function w8(v) { return new Uint8Array([v]); }
function w16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; }
function w32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; }
function w64(v) { const b = new Uint8Array(8); const d = new DataView(b.buffer); d.setUint32(0, Number(v & 0xFFFFFFFFn), true); d.setUint32(4, Number(v >> 32n), true); return b; }

// Keys
const BUYER = { priv: '041149b90ad3189ce363bf1b3854a4c2a2067e503b1f5d53c69d17732cb20c33', pub: '0335f1be04eb12982f061a268f96d580194f8331084bc13a833633d089fae46f4e' };
const SELLER = { priv: '3e4bf0e0bfc642b3f0645ceaf60e1e79bac5e56d2b5597220999393b53fc6efe', pub: '02ed0484ee0a35c2ebab66bab53fb6bce4b7cc5bf8297d802b39d2a4e35be1cc11' };
const BUYER_AMT = 200000000n, SELLER_AMT = 400000000n, FEE = 10000n;

// Aggregate keys (MuSig)
function aggKeys(pA, pB, counter) {
  const sorted = [pA, pB].sort(); const pkA = sorted[0], pkB = sorted[1];
  const PA = secp256k1.ProjectivePoint.fromHex(pkA), PB = secp256k1.ProjectivePoint.fromHex(pkB);
  const cb = (counter && counter > 0) ? new TextEncoder().encode(String(counter)) : new Uint8Array(0);
  const L = sha256(new Uint8Array([...hexToBytes(pkA), ...hexToBytes(pkB), ...cb]));
  const a1 = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pkA)])))), N);
  const a2 = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pkB)])))), N);
  const Pagg = PA.multiply(a1).add(PB.multiply(a2));
  const aggB = Pagg.toRawBytes(true);
  return { pkA, pkB, a1, a2, Pagg, aggHex: bytesToHex(aggB), aggXOnly: bytesToHex(aggB.slice(1)), frostScript: '20' + bytesToHex(aggB.slice(1)) + 'ac' };
}

// Sighash (matches kaspa_rest_tx.ts)
function hashPrevOutputs(inputs) { return kb2b(concat(...inputs.map(i => concat(hexToBytes(i.txId), w32(i.index))))); }
function hashSequences(inputs) { return kb2b(concat(...inputs.map(() => w64(0n)))); }
function hashSigOpCounts(inputs) { return kb2b(new Uint8Array(inputs.map(() => 1))); }
function hashOutputs(outputs) { return kb2b(concat(...outputs.map(o => concat(w64(o.value), w16(0), w64(BigInt(hexToBytes(o.script).length)), hexToBytes(o.script))))); }

function computeSighash(inputs, outputs, idx) {
  const inp = inputs[idx];
  const spk = hexToBytes(inp.scriptPubKey);
  const subnetId = new Uint8Array(20); // subnetId all zeros = native
  return kb2b(concat(
    w16(0), hashPrevOutputs(inputs), hashSequences(inputs), hashSigOpCounts(inputs),
    hexToBytes(inp.txId), w32(inp.index), w16(0), w64(BigInt(spk.length)), spk,
    w64(inp.value), w64(0n), w8(1), hashOutputs(outputs),
    w64(0n), subnetId, w64(0n), new Uint8Array(32), w8(1),
  ));
}

// Nonce
function genNonce() {
  const k_bytes = secp256k1.utils.randomPrivateKey();
  const k = mod(BigInt('0x' + bytesToHex(k_bytes)), N);
  const R = G.multiply(k);
  return { k, R, R_hex: bytesToHex(R.toRawBytes(true)) };
}

// Partial S
function partialS(privHex, nonce, counterR_hex, agg, sighash_hex) {
  const Rc = secp256k1.ProjectivePoint.fromHex(counterR_hex);
  const Ragg = nonce.R.add(Rc);
  const Ragg_bytes = Ragg.toRawBytes(true);
  let k = nonce.k;
  if (Ragg_bytes[0] === 0x03) k = mod(N - k, N);
  const Rx = bytesToHex(Ragg_bytes.slice(1));
  const Px = agg.aggXOnly;
  // BIP340 tagged hash challenge
  const tag = sha256(new TextEncoder().encode('BIP0340/challenge'));
  const e = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...tag, ...tag, ...hexToBytes(Rx), ...hexToBytes(Px), ...hexToBytes(sighash_hex)])))), N);
  const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex), true));
  const myCoeff = myPub === agg.pkA ? agg.a1 : agg.a2;
  let d = mod(BigInt('0x' + privHex) * myCoeff, N);
  const Pagg_bytes = agg.Pagg.toRawBytes(true);
  if (Pagg_bytes[0] === 0x03) d = mod(N - d, N);
  const s = mod(k + mod(e * d, N), N);
  return { s, s_hex: s.toString(16).padStart(64, '0'), Rx, e };
}

async function run() {
  console.log('=== FROST 2-of-2 TEST WITH COUNTER ===\n');
  const _a0 = aggKeys(BUYER.pub, SELLER.pub, 0);
  const _a1 = aggKeys(BUYER.pub, SELLER.pub, 1);
  console.log('Counter 0:', _a0.aggXOnly.slice(0,20));
  console.log('Counter 1:', _a1.aggXOnly.slice(0,20));
  console.log('Different:', _a0.aggXOnly !== _a1.aggXOnly ? 'YES' : 'NO');
  console.log('Order safe:', aggKeys(SELLER.pub, BUYER.pub, 1).aggXOnly === _a1.aggXOnly ? 'YES' : 'NO');


  // 1. Aggregate
  const agg = aggKeys(BUYER.pub, SELLER.pub);
  console.log('[1] Agg pubkey:', agg.aggHex.slice(0, 20) + '...');

  // 2. AGR ID
  const agrHash = sha256(new TextEncoder().encode(BUYER.pub + SELLER.pub + BUYER_AMT.toString() + SELLER_AMT.toString() + 'testnet-10'));
  console.log('[2] AGR ID: AGR_' + bytesToHex(agrHash.slice(0, 6)));

  // 3. Simulated UTXOs (sorted)
  const utxos = [
    { txId: bytesToHex(sha256(new TextEncoder().encode('buyer_tx'))), index: 0, value: BUYER_AMT, scriptPubKey: agg.frostScript },
    { txId: bytesToHex(sha256(new TextEncoder().encode('seller_tx'))), index: 0, value: SELLER_AMT, scriptPubKey: agg.frostScript },
  ].sort((a, b) => a.txId.localeCompare(b.txId));
  console.log('[3] UTXOs:', utxos.map(u => Number(u.value)/1e8 + ' KAS').join(', '));

  // 4. Outputs
  const buyerScript = '20' + BUYER.pub.slice(2) + 'ac';
  const sellerScript = '20' + SELLER.pub.slice(2) + 'ac';
  const totalIn = utxos.reduce((s, u) => s + u.value, 0n);
  const outputs = [
    { value: BUYER_AMT, script: buyerScript },
    { value: totalIn - BUYER_AMT - FEE, script: sellerScript },
  ];
  console.log('[4] Out0 (buyer):', Number(outputs[0].value)/1e8, 'KAS');
  console.log('[4] Out1 (seller):', Number(outputs[1].value)/1e8, 'KAS');

  // 5. TX Template
  const tmpl = { u: utxos.map(u => ({ t: u.txId, i: u.index, a: u.value.toString(), s: u.scriptPubKey })), o: outputs.map(o => ({ v: o.value.toString(), s: o.script })), f: FEE.toString() };
  const tmplB64 = Buffer.from(JSON.stringify(tmpl)).toString('base64');
  console.log('[5] Template:', tmplB64.length, 'chars');

  // 6. Buyer sighashes
  const buyerSH = utxos.map((_, i) => bytesToHex(computeSighash(utxos, outputs, i)));
  console.log('[6] Buyer sighashes:', buyerSH.map(s => s.slice(0, 16) + '...'));

  // 7. Seller rebuilds from template, computes sighashes
  const recv = JSON.parse(Buffer.from(tmplB64, 'base64').toString());
  const sInputs = recv.u.map(u => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));
  const sOutputs = recv.o.map(o => ({ value: BigInt(o.v), script: o.s }));
  const sellerSH = sInputs.map((_, i) => bytesToHex(computeSighash(sInputs, sOutputs, i)));
  console.log('[7] Seller sighashes:', sellerSH.map(s => s.slice(0, 16) + '...'));

  // 8. CRITICAL: sighash match
  let match = true;
  for (let i = 0; i < buyerSH.length; i++) {
    if (buyerSH[i] !== sellerSH[i]) { console.error('FAIL: sighash mismatch input', i); match = false; }
  }
  if (match) console.log('[8] ✓ ALL SIGHASHES MATCH');
  else { console.error('[8] ✗ SIGHASH MISMATCH — ABORT'); process.exit(1); }

  // 9. Nonces
  const bNonce = genNonce(), sNonce = genNonce();
  console.log('[9] Buyer R:', bNonce.R_hex.slice(0, 20) + '...');
  console.log('[9] Seller R:', sNonce.R_hex.slice(0, 20) + '...');

  // 10. Partial sigs
  const bPartials = buyerSH.map(sh => partialS(BUYER.priv, bNonce, sNonce.R_hex, agg, sh));
  const sPartials = sellerSH.map(sh => partialS(SELLER.priv, sNonce, bNonce.R_hex, agg, sh));
  console.log('[10] Buyer partials:', bPartials.map(p => p.s_hex.slice(0, 12) + '...'));
  console.log('[10] Seller partials:', sPartials.map(p => p.s_hex.slice(0, 12) + '...'));

  // 11. Aggregate + verify
  console.log('\n[11] === BIP340 VERIFICATION ===');
  for (let i = 0; i < buyerSH.length; i++) {
    const s_agg = mod(bPartials[i].s + sPartials[i].s, N);
    const Rx = bPartials[i].Rx;
    const Px = agg.aggXOnly;
    const msg = buyerSH[i];

    // Recompute e
    const tag = sha256(new TextEncoder().encode('BIP0340/challenge'));
    const e = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...tag, ...tag, ...hexToBytes(Rx), ...hexToBytes(Px), ...hexToBytes(msg)])))), N);

    // s*G
    const sG = G.multiply(s_agg);
    // R + e*P (lift x-only)
    const R_pt = secp256k1.ProjectivePoint.fromHex('02' + Rx);
    const P_pt = secp256k1.ProjectivePoint.fromHex('02' + Px);
    const ReP = R_pt.add(P_pt.multiply(e));

    const sGx = bytesToHex(sG.toRawBytes(true).slice(1));
    const RePx = bytesToHex(ReP.toRawBytes(true).slice(1));

    if (sGx === RePx) console.log('  Input', i, '✓ VALID');
    else console.log('  Input', i, '✗ INVALID\n    sG_x:', sGx.slice(0, 20), '\n    ReP_x:', RePx.slice(0, 20));
  }

  // 12. Seller template verification
  console.log('\n[12] === SELLER TEMPLATE VERIFY ===');
  const myScript = '20' + SELLER.pub.slice(2) + 'ac';
  const myOut = sOutputs.find(o => o.script === myScript);
  console.log('  Seller output found:', myOut ? Number(myOut.value)/1e8 + ' KAS ✓' : 'MISSING ✗');
  let tIn = 0n; for (const i of sInputs) tIn += i.value;
  let tOut = 0n; for (const o of sOutputs) tOut += o.value;
  console.log('  Total in:', Number(tIn)/1e8, 'out:', Number(tOut)/1e8, 'fee:', Number(tIn-tOut)/1e8, tOut <= tIn ? '✓' : '✗');

  console.log('\n=== TEST COMPLETE ===');
}

run().catch(e => { console.error('FAILED:', e); process.exit(1); });
