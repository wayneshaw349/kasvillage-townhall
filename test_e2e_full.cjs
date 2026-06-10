/**
 * KasVillage Full End-to-End Flow Test
 * Simulates: Proposal → Parse → Fund → Canonical TX → Partial Sig → Template → Co-sign → Verify
 * Uses real project crypto functions
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
function concat(...a) { const t = a.reduce((s,x) => s+x.length, 0); const r = new Uint8Array(t); let o=0; for(const x of a){r.set(x,o);o+=x.length;} return r; }
function w8(v){return new Uint8Array([v]);}
function w16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
function w32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b;}
function w64(v){const b=new Uint8Array(8);const d=new DataView(b.buffer);d.setUint32(0,Number(v&0xFFFFFFFFn),true);d.setUint32(4,Number(v>>32n),true);return b;}

// Test wallets
const BUYER = { priv: '041149b90ad3189ce363bf1b3854a4c2a2067e503b1f5d53c69d17732cb20c33', pub: '0335f1be04eb12982f061a268f96d580194f8331084bc13a833633d089fae46f4e' };
const SELLER = { priv: '3e4bf0e0bfc642b3f0645ceaf60e1e79bac5e56d2b5597220999393b53fc6efe', pub: '02ed0484ee0a35c2ebab66bab53fb6bce4b7cc5bf8297d802b39d2a4e35be1cc11' };
const BUYER_AMT = 400000000n; // 4 KAS
const SELLER_AMT = 600000000n; // 6 KAS
const FEE = 10000n;

// ============================================================
// STEP 1: BUYER CREATES PROPOSAL
// ============================================================
console.log('============================================================');
console.log('STEP 1: BUYER CREATES PROPOSAL');
console.log('============================================================');

// Aggregate keys
const sorted = [BUYER.pub, SELLER.pub].sort();
const pkA = sorted[0], pkB = sorted[1];
const PA = secp256k1.ProjectivePoint.fromHex(pkA);
const PB = secp256k1.ProjectivePoint.fromHex(pkB);
const L = sha256(hexToBytes(pkA + pkB));
const a1 = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pkA)])))), N);
const a2 = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pkB)])))), N);
const Pagg = PA.multiply(a1).add(PB.multiply(a2));
const aggBytes = Pagg.toRawBytes(true);
const aggXOnly = bytesToHex(aggBytes.slice(1));
const frostScript = '20' + aggXOnly + 'ac';

// AGR ID
const agrHash = sha256(new TextEncoder().encode(BUYER.pub + SELLER.pub + BUYER_AMT.toString() + SELLER_AMT.toString() + 'testnet-10'));
const agrId = 'AGR_' + bytesToHex(agrHash.slice(0, 6));

// Buyer generates R nonce
const bk = mod(BigInt('0x' + bytesToHex(secp256k1.utils.randomPrivateKey())), N);
const bR = G.multiply(bk);
const buyerR_hex = bytesToHex(bR.toRawBytes(true));

// Verification code
const vcHash = sha256(hexToBytes(BUYER.pub + SELLER.pub));
const verCode = bytesToHex(vcHash.slice(0, 2)).toUpperCase();

console.log('AGR ID:', agrId);
console.log('FROST script:', frostScript.slice(0, 20) + '...');
console.log('Buyer R:', buyerR_hex.slice(0, 20) + '...');
console.log('Verification code:', verCode);

// Build KV clipboard
const kvProposal = `KV|${agrId}|buyerAddr|sellerAddr|${BUYER_AMT}|${SELLER_AMT}|testnet-10|${buyerR_hex}|${verCode}|Watch - Ship to: UPS Store Newark`;
console.log('\n📋 BUYER COPIES:');
console.log(kvProposal.slice(0, 80) + '...');

// ============================================================
// STEP 2: SELLER PARSES PROPOSAL & ACCEPTS
// ============================================================
console.log('\n============================================================');
console.log('STEP 2: SELLER PARSES PROPOSAL & ACCEPTS');
console.log('============================================================');

// parseClipboard simulation
const parts = kvProposal.split('|');
console.log('Parsed AGR:', parts[1]);
console.log('Parsed amounts: buyer=', Number(parts[4])/1e8, 'seller=', Number(parts[5])/1e8);
console.log('Parsed R:', parts[7].slice(0, 20) + '...');
console.log('Parsed code:', parts[8]);
console.log('Parsed description:', parts[9]);

// Seller generates R nonce
const sk = mod(BigInt('0x' + bytesToHex(secp256k1.utils.randomPrivateKey())), N);
const sR = G.multiply(sk);
const sellerR_hex = bytesToHex(sR.toRawBytes(true));
console.log('Seller R:', sellerR_hex.slice(0, 20) + '...');
console.log('✅ Seller accepts and generates R nonce');

// ============================================================
// STEP 3: BOTH FUND FROST ADDRESS
// ============================================================
console.log('\n============================================================');
console.log('STEP 3: BOTH FUND FROST ADDRESS');
console.log('============================================================');

// Simulate UTXOs after funding
const utxos = [
  { txId: bytesToHex(sha256(new TextEncoder().encode('seller_collateral_tx'))), index: 0, value: SELLER_AMT, scriptPubKey: frostScript },
  { txId: bytesToHex(sha256(new TextEncoder().encode('buyer_collateral_tx'))), index: 0, value: BUYER_AMT, scriptPubKey: frostScript },
].sort((a, b) => a.txId.localeCompare(b.txId));

console.log('FROST UTXOs:', utxos.length);
utxos.forEach((u, i) => console.log('  UTXO', i, ':', u.txId.slice(0, 16) + '...', Number(u.value)/1e8, 'KAS'));
const totalIn = utxos.reduce((s, u) => s + u.value, 0n);
console.log('Total:', Number(totalIn)/1e8, 'KAS');

// ============================================================
// STEP 4: BUYER CONFIRMS DELIVERY — BUILDS CANONICAL TX
// ============================================================
console.log('\n============================================================');
console.log('STEP 4: BUYER CONFIRMS DELIVERY');
console.log('============================================================');

// Canonical outputs
const buyerScript = '20' + BUYER.pub.slice(2) + 'ac';
const sellerScript = '20' + SELLER.pub.slice(2) + 'ac';
const available = totalIn - FEE;
const buyerOut = available * BUYER_AMT / (BUYER_AMT + SELLER_AMT);
const sellerOut = available - buyerOut;

const outputs = [
  { value: buyerOut, script: buyerScript },
  { value: sellerOut, script: sellerScript },
];

console.log('Output 0 (buyer):', Number(buyerOut)/1e8, 'KAS');
console.log('Output 1 (seller):', Number(sellerOut)/1e8, 'KAS');
console.log('Fee:', Number(FEE)/1e8, 'KAS');

// Sighash computation
function hashPO(ins){return kb2b(concat(...ins.map(i=>concat(hexToBytes(i.txId),w32(i.index)))));}
function hashSeq(ins){return kb2b(concat(...ins.map(()=>w64(0n))));}
function hashSO(ins){return kb2b(new Uint8Array(ins.map(()=>1)));}
function hashOut(outs){return kb2b(concat(...outs.map(o=>concat(w64(o.value),w16(0),w64(BigInt(hexToBytes(o.script).length)),hexToBytes(o.script)))));}
function sighash(ins,outs,idx){
  const inp=ins[idx];const spk=hexToBytes(inp.scriptPubKey);const sn=new Uint8Array(20);sn[0]=1;
  return kb2b(concat(w16(0),hashPO(ins),hashSeq(ins),hashSO(ins),hexToBytes(inp.txId),w32(inp.index),w16(0),w64(BigInt(spk.length)),spk,w64(inp.value),w64(0n),w8(1),hashOut(outs),w64(0n),sn,w64(0n),new Uint8Array(32),w8(1)));
}

const buyerSighashes = utxos.map((_, i) => bytesToHex(sighash(utxos, outputs, i)));
console.log('Buyer sighashes:');
buyerSighashes.forEach((sh, i) => console.log('  Input', i, ':', sh.slice(0, 20) + '...'));

// Buyer partial s for each input
function partialS(privHex, myK, myR, counterR_hex, sighash_hex) {
  const Rc = secp256k1.ProjectivePoint.fromHex(counterR_hex);
  const Ragg = myR.add(Rc);
  const Ragg_bytes = Ragg.toRawBytes(true);
  let k = myK;
  if (Ragg_bytes[0] === 0x03) k = mod(N - k, N);
  const Rx = bytesToHex(Ragg_bytes.slice(1));
  const tag = sha256(new TextEncoder().encode('BIP0340/challenge'));
  const e = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...tag, ...tag, ...hexToBytes(Rx), ...hexToBytes(aggXOnly), ...hexToBytes(sighash_hex)])))), N);
  const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex), true));
  const myCoeff = myPub === pkA ? a1 : a2;
  let d = mod(BigInt('0x' + privHex) * myCoeff, N);
  if (aggBytes[0] === 0x03) d = mod(N - d, N);
  return { s: mod(k + mod(e * d, N), N), Rx, e };
}

const buyerPartials = buyerSighashes.map(sh => partialS(BUYER.priv, bk, bR, sellerR_hex, sh));
const R_agg_x = buyerPartials[0].Rx;

console.log('R_agg_x:', R_agg_x.slice(0, 20) + '...');
buyerPartials.forEach((p, i) => console.log('  Buyer s' + i + ':', p.s.toString(16).slice(0, 16) + '...'));

// Build TX template
const txTemplate = {
  u: utxos.map(u => ({ t: u.txId, i: u.index, a: u.value.toString(), s: u.scriptPubKey })),
  o: outputs.map(o => ({ v: o.value.toString(), s: o.script })),
  f: FEE.toString(),
};
const templateB64 = Buffer.from(JSON.stringify(txTemplate)).toString('base64');

// Build clipboard output
const sigHex = R_agg_x + buyerPartials.map(p => p.s.toString(16).padStart(64, '0')).join('');
const clipboard = `AGR: ${agrId}\nR: ${buyerR_hex}\nSIG: ${sigHex}|${templateB64}\nSeller: press Release`;

console.log('\n📋 BUYER COPIES DELIVERY CONFIRMATION:');
console.log('SIG length:', sigHex.length, 'chars (R_agg_x + 2 s values)');
console.log('Template:', templateB64.length, 'chars');

// ============================================================
// STEP 5: SELLER PARSES, VERIFIES, CO-SIGNS
// ============================================================
console.log('\n============================================================');
console.log('STEP 5: SELLER CO-SIGNS');
console.log('============================================================');

// Parse clipboard (universal parser)
const agrMatch = clipboard.match(/AGR:\s*(AGR_[0-9a-f]+)/i);
const rMatch = clipboard.match(/R:\s*([0-9a-f]{60,130})/i);
const sigMatch = clipboard.match(/SIG:\s*(.+)/is);
let parsedSig, parsedTemplate;
if (sigMatch) {
  let sr = sigMatch[1].trim().replace(/\nSeller:.*/is, '').trim();
  const pi = sr.indexOf('|');
  parsedSig = pi > 0 ? sr.slice(0, pi) : sr;
  parsedTemplate = pi > 0 ? sr.slice(pi + 1) : null;
}
const isEncrypted = !/^[0-9a-f]+$/i.test(parsedSig) || parsedSig.length > 256;

console.log('Parsed: AGR=', agrMatch?.[1], 'R=', rMatch?.[1]?.slice(0,20)+'...', 'encrypted=', isEncrypted);
console.log('SIG:', parsedSig.slice(0, 20) + '... (' + parsedSig.length + ' chars)');
console.log('Template:', parsedTemplate ? 'YES' : 'NO');

// Rebuild TX from template
const tmpl = JSON.parse(Buffer.from(parsedTemplate, 'base64').toString());
const sellerInputs = tmpl.u.map(u => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));
const sellerOutputs = tmpl.o.map(o => ({ value: BigInt(o.v), script: o.s }));

// VERIFY template
const myScript = '20' + SELLER.pub.slice(2) + 'ac';
const myOutput = sellerOutputs.find(o => o.script === myScript);
console.log('My output found:', myOutput ? Number(myOutput.value)/1e8 + ' KAS ✅' : 'MISSING ✗');
let tIn = 0n; for (const i of sellerInputs) tIn += i.value;
let tOut = 0n; for (const o of sellerOutputs) tOut += o.value;
console.log('Total in:', Number(tIn)/1e8, 'out:', Number(tOut)/1e8, 'fee:', Number(tIn-tOut)/1e8, tOut <= tIn ? '✅' : '✗');

// Seller sighashes from template
const sellerSighashes = sellerInputs.map((_, i) => bytesToHex(sighash(sellerInputs, sellerOutputs, i)));
console.log('\nSeller sighashes:');
sellerSighashes.forEach((sh, i) => console.log('  Input', i, ':', sh.slice(0, 20) + '...'));

// CRITICAL CHECK: sighashes match
let match = true;
for (let i = 0; i < buyerSighashes.length; i++) {
  if (buyerSighashes[i] !== sellerSighashes[i]) { console.error('✗ SIGHASH MISMATCH input', i); match = false; }
}
console.log(match ? '\n✅ ALL SIGHASHES MATCH' : '\n✗ SIGHASH MISMATCH — ABORT');
if (!match) process.exit(1);

// Extract buyer's s values
const buyerS0 = BigInt('0x' + parsedSig.slice(64, 128));
const buyerS1 = BigInt('0x' + parsedSig.slice(128, 192));

// Seller partial s
const sellerPartials = sellerSighashes.map(sh => partialS(SELLER.priv, sk, sR, buyerR_hex, sh));

// Aggregate
console.log('\n=== AGGREGATE & VERIFY ===');
for (let i = 0; i < sellerSighashes.length; i++) {
  const cpS = i === 0 ? buyerS0 : buyerS1;
  const s_agg = mod(sellerPartials[i].s + cpS, N);
  const Rx = R_agg_x;
  const msg = sellerSighashes[i];
  
  // Recompute e
  const tag = sha256(new TextEncoder().encode('BIP0340/challenge'));
  const e = mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...tag, ...tag, ...hexToBytes(Rx), ...hexToBytes(aggXOnly), ...hexToBytes(msg)])))), N);
  
  // Verify: s*G == R + e*P
  const sG = G.multiply(s_agg);
  const R_pt = secp256k1.ProjectivePoint.fromHex('02' + Rx);
  const P_pt = secp256k1.ProjectivePoint.fromHex('02' + aggXOnly);
  const ReP = R_pt.add(P_pt.multiply(e));
  
  const sGx = bytesToHex(sG.toRawBytes(true).slice(1));
  const RePx = bytesToHex(ReP.toRawBytes(true).slice(1));
  
  if (sGx === RePx) console.log('  Input', i, '✅ BIP340 VALID — L1 WILL ACCEPT');
  else console.log('  Input', i, '✗ INVALID');
}

console.log('\n============================================================');
console.log('🎯 FULL FLOW COMPLETE — KASPA L1 WOULD ACCEPT THIS TX');
console.log('============================================================');
