// ============================================================================
// KASVILLAGE CANONICAL AGREEMENT STEPS - TypeScript (Expo)
// ============================================================================
// Version: 1
// Pure logic — NO side effects, NO UI, NO storage, NO fetch
// All I/O (clipboard, SecureStore, L1 API, Arweave) stays in NeighborAgreement.tsx
// This module defines WHAT happens. The UI decides HOW.
//
// L1 Proven:
//   Counter=0: TX 1caf979391b435d1 (confirmed)
//   Counter=1: TX 977446ec89c59da7 (confirmed)
//   Headless template test: k lifetime 41ms, both inputs BIP340 VALID
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import { secp256k1, schnorr } from '@noble/curves/secp256k1';

// ============================================================================
// HELPERS (self-contained — no imports from frost_complete.ts)
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const N = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;
const SIGHASH_KEY = new TextEncoder().encode('TransactionSigningHash');

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function w8(v: number): Uint8Array { return new Uint8Array([v]); }
function w16(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, true);
  return b;
}
function w32(v: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, true);
  return b;
}
function w64(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, Number(v & 0xFFFFFFFFn), true);
  dv.setUint32(4, Number(v >> 32n), true);
  return b;
}

// ============================================================================
// SCHEMA VERSION
// ============================================================================
export const AGREEMENT_SCHEMA_VERSION = 1;

// ============================================================================
// STEP DEFINITIONS
// ============================================================================
// Linear state machine. No skipping. Each step requires explicit advancement.

export const STEPS = {
  CHOOSE_TYPE: 1,       // Buyer picks agreement type
  CHOOSE_ROLE: 2,       // Pick buyer or seller
  PROPOSE: 3,           // Derive FROST address, propose on Arweave, share clipboard
  FUND_AND_SHIP: 4,     // Both fund FROST, seller ships goods (days). NO k exists.
  SIGNING_CEREMONY: 5,  // Buyer builds template → seller signs → buyer broadcasts. k: ~41ms.
  MUTUAL_RELEASE: 6,    // Cancel flow (both must agree)
  COMPLETE: 7,          // Funds released on L1
  DISPUTE: 8,           // Snail mode / deadlock
} as const;

export type StepNumber = typeof STEPS[keyof typeof STEPS];

export const STEP_LABELS: Record<StepNumber, string> = {
  1: 'Choose Agreement Type',
  2: 'Choose Role',
  3: 'Create Proposal',
  4: 'Fund & Ship',
  5: 'Signing Ceremony',
  6: 'Mutual Release',
  7: 'Complete',
  8: 'Dispute',
};

// Steps where k nonce is allowed to exist (ONLY step 5)
export const K_ALLOWED_STEPS: readonly StepNumber[] = [5] as const;

// Terminal steps where k MUST be destroyed
export const K_DESTROY_STEPS: readonly StepNumber[] = [5, 7] as const;

// ============================================================================
// AGREEMENT STATE
// ============================================================================

export interface AgreementState {
  agrId: string;
  step: StepNumber;
  role: 'buyer' | 'seller' | null;
  buyerPubkey: string;
  sellerPubkey: string;
  buyerAmountSompi: bigint;
  sellerAmountSompi: bigint;
  frostAddress: string;
  frostCounter: number;
  network: 'mainnet' | 'testnet-10' | 'testnet-11';
  description: string;
  shippingCenter: string;
  verificationCode: string;
  proposalDaa: number;
  arweaveTxId: string;
  releaseTxId: string;
  createdAt: number;
}

// ============================================================================
// TX TEMPLATE (clipboard payload: buyer → seller)
// ============================================================================

export interface TxTemplateInput {
  t: string;  // txId
  i: number;  // index
  a: string;  // amount sompi (string for JSON safety)
  s: string;  // scriptPubKey hex
}

export interface TxTemplateOutput {
  v: string;  // value sompi (string for JSON safety)
  s: string;  // scriptPubKey hex (20{xonly}ac)
}

export interface TxTemplate {
  u: TxTemplateInput[];   // UTXOs (sorted by txId)
  o: TxTemplateOutput[];  // Outputs [buyer, seller]
  f: string;              // Fee sompi
  R: string;              // Buyer R nonce (compressed point hex)
  agr: string;            // Agreement ID
}

// ============================================================================
// SELLER RESPONSE (clipboard payload: seller → buyer)
// ============================================================================

export interface SellerResponse {
  R: string;       // Seller R nonce (compressed point hex)
  s: string[];     // Partial s values (one per input, hex)
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum
export const SUBNETWORK_NATIVE = '0000000000000000000000000000000000000000';
export const MAX_COUNTER_SEARCH = 10;         // L1 loop max iterations
export const P2PK_SCRIPT_LENGTH = 68;         // 20{32bytes}ac = 68 hex chars

// ============================================================================
// SECTION 1: KEY AGGREGATION (L1 proven)
// ============================================================================

/**
 * Compute binding hash L from sorted pubkeys + optional counter.
 * Uses hexToBytes (NOT TextEncoder) — proven on L1.
 */
export function computeL(pk1: string, pk2: string, counter?: number, agreementId?: string): Uint8Array {
  const counterBytes =
    counter && counter > 0
      ? new TextEncoder().encode(String(counter))
      : new Uint8Array(0);
  const agrBytes = agreementId ? new TextEncoder().encode(agreementId) : new Uint8Array(0);
  return sha256(
    new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ...agrBytes, ...counterBytes])
  );
}

/**
 * Compute binding coefficient for a pubkey given L.
 */
export function bindingCoefficient(L: Uint8Array, pk: string): bigint {
  return mod(
    BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pk)])))),
    N
  );
}

/**
 * Derive aggregate public key from two compressed pubkeys.
 * P_agg = a1*P1 + a2*P2
 */
export function deriveAggregateKey(
  pubkeyA: string,
  pubkeyB: string,
  counter?: number,
  agreementId?: string
): {
  aggPubkey: string;  // compressed hex (02/03 + 32 bytes)
  aggXOnly: string;   // x-only hex (32 bytes)
  pk1: string;        // sorted first
  pk2: string;        // sorted second
  a1: bigint;
  a2: bigint;
  L: Uint8Array;
} {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const L = computeL(pk1, pk2, counter, agreementId);
  const a1 = bindingCoefficient(L, pk1);
  const a2 = bindingCoefficient(L, pk2);

  const P1 = secp256k1.ProjectivePoint.fromHex(pk1);
  const P2 = secp256k1.ProjectivePoint.fromHex(pk2);
  const Pagg = P1.multiply(a1).add(P2.multiply(a2));

  const aggBytes = Pagg.toRawBytes(true);
  return {
    aggPubkey: bytesToHex(aggBytes),
    aggXOnly: bytesToHex(aggBytes.slice(1)),
    pk1,
    pk2,
    a1,
    a2,
    L,
  };
}

/**
 * Build P2PK script from x-only pubkey: 0x20 + xonly + 0xac
 */
export function p2pkScript(xOnlyHex: string): string {
  return '20' + xOnlyHex + 'ac';
}

/**
 * Derive FROST address string from aggregate key.
 * Uses Kaspa bech32 encoding.
 */
export function deriveAddress(
  aggXOnly: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11'
): string {
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function polymod(values: number[]): bigint {
    let c = 1n;
    for (const d of values) {
      const c0 = c >> 35n;
      c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
      if (c0 & 1n) c ^= 0x98f2bc8e61n;
      if (c0 & 2n) c ^= 0x79b76d99e2n;
      if (c0 & 4n) c ^= 0xf33e5fb3c4n;
      if (c0 & 8n) c ^= 0xae2eabe2a8n;
      if (c0 & 0x10n) c ^= 0x1e4f43e470n;
    }
    return c ^ 1n;
  }

  function conv8to5(payload: number[]): number[] {
    const result: number[] = [];
    let buffer = 0,
      bits = 0;
    for (const byte of payload) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        result.push((buffer >> bits) & 31);
        buffer &= (1 << bits) - 1;
      }
    }
    if (bits > 0) result.push((buffer << (5 - bits)) & 31);
    return result;
  }

  const xOnly = hexToBytes(aggXOnly);
  const fullPayload = [0, ...Array.from(xOnly)];
  const fp5 = conv8to5(fullPayload);
  const pfx5 = Array.from(prefix).map((c) => c.charCodeAt(0) & 0x1f);
  const csIn = [...pfx5, 0, ...fp5, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = polymod(csIn);
  const csB: number[] = [];
  for (let i = 4; i >= 0; i--) csB.push(Number((cs >> BigInt(i * 8)) & 0xffn));
  const cs5 = conv8to5(csB);

  let addr = prefix + ':';
  for (const d of [...fp5, ...cs5]) addr += CHARSET[d];
  return addr;
}

/**
 * Generate 4-char verification code from sorted pubkeys.
 */
export function verificationCode(pubkeyA: string, pubkeyB: string): string {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const hash = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2)]));
  return bytesToHex(hash).slice(0, 4).toUpperCase();
}

// ============================================================================
// SECTION 2: SIGHASH (Kaspa Blake2b TransactionSigningHash)
// ============================================================================

export interface CanonicalInput {
  txId: string;
  index: number;
  value: bigint;
  scriptPubKey: string;  // hex
}

export interface CanonicalOutput {
  value: bigint;
  script: string;  // hex
}

function hashPrevOutputs(inputs: CanonicalInput[]): Uint8Array {
  return blake2b(
    concat(...inputs.map((i) => concat(hexToBytes(i.txId), w32(i.index)))),
    { dkLen: 32, key: SIGHASH_KEY }
  );
}

function hashSequences(inputs: CanonicalInput[]): Uint8Array {
  return blake2b(concat(...inputs.map(() => w64(0n))), {
    dkLen: 32,
    key: SIGHASH_KEY,
  });
}

function hashSigOpCounts(inputs: CanonicalInput[]): Uint8Array {
  return blake2b(new Uint8Array(inputs.map(() => 1)), {
    dkLen: 32,
    key: SIGHASH_KEY,
  });
}

function hashOutputs(outputs: CanonicalOutput[]): Uint8Array {
  return blake2b(
    concat(
      ...outputs.map((o) =>
        concat(
          w64(o.value),
          w16(0),
          w64(BigInt(hexToBytes(o.script).length)),
          hexToBytes(o.script)
        )
      )
    ),
    { dkLen: 32, key: SIGHASH_KEY }
  );
}

/**
 * Compute Kaspa sighash for a specific input.
 * Uses SIGHASH_ALL mode, native subnetwork (all zeros).
 */
export function computeSighash(
  inputs: CanonicalInput[],
  outputs: CanonicalOutput[],
  inputIndex: number
): Uint8Array {
  const inp = inputs[inputIndex];
  const spk = hexToBytes(inp.scriptPubKey);
  const subnetId = new Uint8Array(20); // all zeros = native

  return blake2b(
    concat(
      w16(0),                         // version
      hashPrevOutputs(inputs),
      hashSequences(inputs),
      hashSigOpCounts(inputs),
      hexToBytes(inp.txId),           // this input txId
      w32(inp.index),                 // this input index
      w16(0),                         // script version
      w64(BigInt(spk.length)),        // script length
      spk,                            // script data
      w64(inp.value),                 // this input value
      w64(0n),                        // sequence
      w8(1),                          // sigOpCount
      hashOutputs(outputs),
      w64(0n),                        // lockTime
      subnetId,                       // native subnetwork
      w64(0n),                        // gas
      new Uint8Array(32),             // payload hash (empty)
      w8(1)                           // sighash type: ALL
    ),
    { dkLen: 32, key: SIGHASH_KEY }
  );
}

// ============================================================================
// SECTION 3: FROST NONCE + PARTIAL SIG
// ============================================================================

export interface FrostNonce {
  k: bigint;           // PRIVATE — never leaves device, destroyed after use
  d_tweaked: bigint;   // PRIVATE — binding-adjusted private key
  R_hex: string;       // PUBLIC — shared via clipboard
}

/**
 * Generate FROST nonce (k) and compute d_tweaked.
 * Uses secp256k1 random private key for k.
 * k is NEVER reused. Reuse leaks wallet private key.
 */
export function generateNonce(
  privateKeyHex: string,
  pubkeyA: string,
  pubkeyB: string,
  counter?: number,
  agreementId?: string
): FrostNonce {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const L = computeL(pk1, pk2, counter, agreementId);
  const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(privateKeyHex), true));
  const myCoeff = bindingCoefficient(L, myPub === pk1 ? pk1 : pk2);

  // d_tweaked = privKey × bindingCoefficient mod N
  let d = mod(BigInt('0x' + privateKeyHex) * myCoeff, N);

  // BIP340 parity: negate d if aggregate key has odd y
  const agg = deriveAggregateKey(pubkeyA, pubkeyB, counter, agreementId);
  const aggBytes = hexToBytes(agg.aggPubkey);
  if (aggBytes[0] === 0x03) d = mod(N - d, N);

  // Random k
  const kBytes = secp256k1.utils.randomPrivateKey();
  let k = mod(BigInt('0x' + bytesToHex(kBytes)), N);
  if (k === 0n) k = 1n;

  const R = G.multiply(k);

  return {
    k,
    d_tweaked: d,
    R_hex: bytesToHex(R.toRawBytes(true)),
  };
}

/**
 * Compute partial Schnorr signature for one input.
 * s_i = k_i + e × d_tweaked_i (mod N)
 *
 * Challenge e uses BIP340 tagged SHA256 (NOT Blake2b).
 */
export function partialSign(
  nonce: FrostNonce,
  counterpartyR_hex: string,
  aggXOnly: string,
  sighash_hex: string
): { s_hex: string; R_agg_x_hex: string } {
  // R_agg = R_mine + R_counterparty
  const Rc = secp256k1.ProjectivePoint.fromHex(counterpartyR_hex);
  let Ragg = G.multiply(nonce.k).add(Rc);
  let k = nonce.k;

  // BIP340: negate k if R_agg has odd y
  if (Ragg.toRawBytes(true)[0] === 0x03) {
    k = mod(N - k, N);
    Ragg = Ragg.negate();
  }

  const Rx = Ragg.toRawBytes(true).slice(1);
  const Px = hexToBytes(aggXOnly);
  const msg = hexToBytes(sighash_hex);

  // BIP340 tagged hash: SHA256(tag || tag || R_x || P_x || msg)
  const tag = sha256(new TextEncoder().encode('BIP0340/challenge'));
  const e = mod(
    BigInt(
      '0x' + bytesToHex(sha256(new Uint8Array([...tag, ...tag, ...Rx, ...Px, ...msg])))
    ),
    N
  );

  const s = mod(k + mod(e * nonce.d_tweaked, N), N);

  return {
    s_hex: s.toString(16).padStart(64, '0'),
    R_agg_x_hex: bytesToHex(Rx),
  };
}

/**
 * Aggregate buyer + seller partial sigs.
 * sig = R_agg_x || s_agg
 */
export function aggregateSigs(
  R_agg_x_hex: string,
  buyerS_hex: string,
  sellerS_hex: string
): string {
  const sAgg = mod(BigInt('0x' + buyerS_hex) + BigInt('0x' + sellerS_hex), N);
  return R_agg_x_hex + sAgg.toString(16).padStart(64, '0');
}

/**
 * Verify aggregated signature with schnorr.verify before broadcasting.
 * Returns true if L1 will accept this signature.
 */
export function verifySig(
  sigHex: string,
  sighash_hex: string,
  aggXOnly: string
): boolean {
  try {
    return schnorr.verify(hexToBytes(sigHex), hexToBytes(sighash_hex), hexToBytes(aggXOnly));
  } catch {
    return false;
  }
}

// ============================================================================
// SECTION 4: TX TEMPLATE BUILD / PARSE / VERIFY
// ============================================================================

/**
 * Build TX template from FROST UTXOs.
 * Buyer calls this at step 5 (signing ceremony).
 */
export function buildTemplate(params: {
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  buyerXOnly: string;
  sellerXOnly: string;
  buyerAmountSompi: bigint;
  fee: bigint;
  buyerR_hex: string;
  agrId: string;
}): TxTemplate {
  const { utxos, buyerXOnly, sellerXOnly, buyerAmountSompi, fee, buyerR_hex, agrId } = params;

  // Sort UTXOs deterministically
  const sorted = [...utxos].sort((a, b) => a.txId.localeCompare(b.txId));

  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  const sellerAmt = totalIn - buyerAmountSompi - fee;

  return {
    u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
    o: [
      { v: buyerAmountSompi.toString(), s: p2pkScript(buyerXOnly) },
      { v: sellerAmt.toString(), s: p2pkScript(sellerXOnly) },
    ],
    f: fee.toString(),
    R: buyerR_hex,
    agr: agrId,
  };
}

/**
 * Parse base64 template string → TxTemplate object.
 * Returns null if invalid.
 */
export function parseTemplate(b64: string): TxTemplate | null {
  try {
    const json = atob(b64);
    const obj = JSON.parse(json);
    if (!obj.u || !obj.o || !obj.R || !Array.isArray(obj.u) || !Array.isArray(obj.o)) {
      return null;
    }
    return obj as TxTemplate;
  } catch {
    return null;
  }
}

/**
 * Seller verifies template before signing.
 * Checks: output pays to my address, amounts sane, scripts are P2PK, no inflation.
 */
export function verifyTemplate(
  template: TxTemplate,
  myXOnly: string
): { valid: boolean; myOutputIdx: number; myAmount: bigint; error?: string } {
  // Find my output
  const myScript = p2pkScript(myXOnly);
  const myIdx = template.o.findIndex((o) => o.s === myScript);
  if (myIdx < 0) {
    return { valid: false, myOutputIdx: -1, myAmount: 0n, error: 'Your output not found in template' };
  }

  const myAmount = BigInt(template.o[myIdx].v);

  // Check all outputs are pure P2PK
  for (let i = 0; i < template.o.length; i++) {
    if (!isPureP2PK(template.o[i].s)) {
      return {
        valid: false,
        myOutputIdx: myIdx,
        myAmount,
        error: `Output ${i} is not standard P2PK — possible covenant`,
      };
    }
  }

  // Check no inflation: total_out + fee <= total_in
  const totalIn = template.u.reduce((s, u) => s + BigInt(u.a), 0n);
  const totalOut = template.o.reduce((s, o) => s + BigInt(o.v), 0n);
  const fee = BigInt(template.f);
  if (totalOut + fee > totalIn) {
    return { valid: false, myOutputIdx: myIdx, myAmount, error: 'Inflation: outputs + fee exceed inputs' };
  }

  // Check fee is reasonable
  if (fee < MIN_FEE_SOMPI) {
    return { valid: false, myOutputIdx: myIdx, myAmount, error: `Fee too low: ${fee} < ${MIN_FEE_SOMPI}` };
  }

  return { valid: true, myOutputIdx: myIdx, myAmount };
}

/**
 * Encode template to base64 for clipboard.
 */
export function encodeTemplate(template: TxTemplate): string {
  return btoa(JSON.stringify(template));
}

/**
 * Encode seller response to base64 for clipboard.
 */
export function encodeResponse(response: SellerResponse): string {
  return btoa(JSON.stringify(response));
}

/**
 * Parse seller response from base64.
 */
export function parseResponse(b64: string): SellerResponse | null {
  try {
    const obj = JSON.parse(atob(b64));
    if (!obj.R || !obj.s || !Array.isArray(obj.s)) return null;
    return obj as SellerResponse;
  } catch {
    return null;
  }
}

// ============================================================================
// SECTION 5: COVENANT DETECTION
// ============================================================================

/**
 * Check if a script is standard P2PK: 0x20 + 32-byte x-only pubkey + 0xac.
 * Any other format is a covenant or unknown script type.
 */
export function isPureP2PK(scriptPubKey: string): boolean {
  return (
    scriptPubKey.length === P2PK_SCRIPT_LENGTH &&
    scriptPubKey.startsWith('20') &&
    scriptPubKey.endsWith('ac')
  );
}

export type UtxoSafety = 'pure' | 'covenant' | 'unknown';

export function classifyScript(scriptPubKey: string): {
  safety: UtxoSafety;
  reason: string;
} {
  if (!scriptPubKey || scriptPubKey.length === 0)
    return { safety: 'unknown', reason: 'Empty script' };
  if (isPureP2PK(scriptPubKey))
    return { safety: 'pure', reason: 'Standard P2PK' };
  if (scriptPubKey.length > P2PK_SCRIPT_LENGTH)
    return {
      safety: 'covenant',
      reason: `Extra opcodes (${scriptPubKey.length} chars vs ${P2PK_SCRIPT_LENGTH}). DO NOT accept as payment.`,
    };
  return { safety: 'unknown', reason: 'Non-standard script format' };
}

// ============================================================================
// SECTION 6: SIGNATURE SCRIPT (L1 submission format)
// ============================================================================

/**
 * Build Kaspa signatureScript from a 64-byte Schnorr signature.
 * Format: 0x41 (length=65) + 64-byte sig + 0x01 (SIGHASH_ALL)
 */
export function buildSignatureScript(sigHex: string): string {
  return '41' + sigHex + '01';
}

/**
 * Build full L1 transaction body from signed inputs + outputs.
 */
export function buildTxBody(
  template: TxTemplate,
  signatures: string[]  // one sigHex per input
): object {
  return {
    transaction: {
      version: 0,
      inputs: template.u.map((u, i) => ({
        previousOutpoint: { transactionId: u.t, index: u.i },
        signatureScript: buildSignatureScript(signatures[i]),
        sequence: '0',
        sigOpCount: 1,
      })),
      outputs: template.o.map((o) => ({
        amount: o.v,
        scriptPublicKey: { version: 0, scriptPublicKey: o.s },
      })),
      lockTime: '0',
      subnetworkId: SUBNETWORK_NATIVE,
      gas: '0',
      payload: '',
    },
  };
}

// ============================================================================
// SECTION 7: STATE TRANSITIONS (pure — returns new state, no side effects)
// ============================================================================

export type TransitionResult =
  | { ok: true; newStep: StepNumber }
  | { ok: false; error: string };

/**
 * Validate a step transition.
 * Returns { ok: true, newStep } or { ok: false, error }.
 */
export function canTransition(
  currentStep: StepNumber,
  targetStep: StepNumber,
  role: 'buyer' | 'seller' | null
): TransitionResult {
  // Forward transitions
  const allowed: Record<number, number[]> = {
    1: [2],
    2: [3],
    3: [4],
    4: [5, 6],       // Confirm delivery → signing, or cancel
    5: [4, 7],       // Back to agreement, or complete
    6: [4, 7, 8],    // Back, release complete, or dispute
    7: [],           // Terminal
    8: [4, 7],       // Resume or complete
  };

  if (!allowed[currentStep]?.includes(targetStep)) {
    return { ok: false, error: `Cannot go from step ${currentStep} to ${targetStep}` };
  }

  // Role-specific gates
  if (targetStep === 5 && role === 'seller') {
    // Seller doesn't initiate signing — buyer does via template
    // Seller stays at step 4, receives template via paste
    return { ok: false, error: 'Seller receives template via clipboard, not via step transition' };
  }

  return { ok: true, newStep: targetStep };
}

// ============================================================================
// SECTION 8: FULL SIGNING CEREMONY (pure functions)
// ============================================================================

/**
 * BUYER STEP: Generate nonce + build template + compute buyer partials.
 * Returns template for clipboard + nonce (caller stores in SecureStore).
 *
 * k lifetime starts HERE.
 */
export function buyerBuildTemplate(params: {
  privateKeyHex: string;
  buyerPubkey: string;
  sellerPubkey: string;
  counter: number;
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  buyerAmountSompi: bigint;
  fee?: bigint;
  agrId: string;
}): {
  template: TxTemplate;
  templateB64: string;
  nonce: FrostNonce;
  sighashes: string[];
} {
  const fee = params.fee || BigInt(params.utxos.length * 157000 + 2 * 500 + 5400);

  // Generate nonce (k born)
  const nonce = generateNonce(
    params.privateKeyHex,
    params.buyerPubkey,
    params.sellerPubkey,
    params.counter
  );

  // Build template
  const buyerXOnly =
    params.buyerPubkey.length === 66 ? params.buyerPubkey.slice(2) : params.buyerPubkey;
  const sellerXOnly =
    params.sellerPubkey.length === 66 ? params.sellerPubkey.slice(2) : params.sellerPubkey;

  const template = buildTemplate({
    utxos: params.utxos,
    buyerXOnly,
    sellerXOnly,
    buyerAmountSompi: params.buyerAmountSompi,
    fee,
    buyerR_hex: nonce.R_hex,
    agrId: params.agrId,
  });

  // Compute sighashes
  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t,
    index: u.i,
    value: BigInt(u.a),
    scriptPubKey: u.s,
  }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v),
    script: o.s,
  }));

  const sighashes: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    sighashes.push(bytesToHex(computeSighash(inputs, outputs, i)));
  }

  return {
    template,
    templateB64: encodeTemplate(template),
    nonce,
    sighashes,
  };
}

/**
 * SELLER STEP: Receive template → verify → generate nonce → sign → return response.
 * k is born and dies within this single function call.
 *
 * Returns response for clipboard. k is NOT returned — it's garbage collected.
 */
export function sellerSignTemplate(params: {
  privateKeyHex: string;
  sellerPubkey: string;
  buyerPubkey: string;
  counter: number;
  template: TxTemplate;
}): {
  response: SellerResponse;
  responseB64: string;
  verification: ReturnType<typeof verifyTemplate>;
} | { error: string } {
  const { privateKeyHex, sellerPubkey, buyerPubkey, counter, template } = params;

  // Verify template
  const sellerXOnly =
    sellerPubkey.length === 66 ? sellerPubkey.slice(2) : sellerPubkey;
  const verification = verifyTemplate(template, sellerXOnly);
  if (!verification.valid) {
    return { error: verification.error || 'Template verification failed' };
  }

  // Derive aggregate key
  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);

  // Generate seller nonce (k born — dies at end of this function)
  const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter);

  // Compute partial sigs
  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t,
    index: u.i,
    value: BigInt(u.a),
    scriptPubKey: u.s,
  }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v),
    script: o.s,
  }));

  const partials: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const shHex = bytesToHex(computeSighash(inputs, outputs, i));
    const ps = partialSign(nonce, template.R, agg.aggXOnly, shHex);
    partials.push(ps.s_hex);
  }

  // k dies here — nonce goes out of scope, garbage collected
  const response: SellerResponse = { R: nonce.R_hex, s: partials };

  return {
    response,
    responseB64: encodeResponse(response),
    verification,
  };
}

/**
 * BUYER FINAL: Receive seller response → aggregate → verify → build TX body.
 *
 * Returns signed TX body ready for L1 submission.
 * Caller MUST destroy buyer nonce after this returns.
 */
export function buyerAggregate(params: {
  nonce: FrostNonce;
  buyerPubkey: string;
  sellerPubkey: string;
  counter: number;
  template: TxTemplate;
  sellerResponse: SellerResponse;
}): { txBody: object; signatures: string[] } | { error: string } {
  const { nonce, buyerPubkey, sellerPubkey, counter, template, sellerResponse } = params;

  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);

  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t,
    index: u.i,
    value: BigInt(u.a),
    scriptPubKey: u.s,
  }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v),
    script: o.s,
  }));

  const signatures: string[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const shHex = bytesToHex(computeSighash(inputs, outputs, i));

    // Buyer partial
    const buyerPartial = partialSign(nonce, sellerResponse.R, agg.aggXOnly, shHex);

    // Aggregate
    const sigHex = aggregateSigs(
      buyerPartial.R_agg_x_hex,
      buyerPartial.s_hex,
      sellerResponse.s[i]
    );

    // Verify before broadcast
    if (!verifySig(sigHex, shHex, agg.aggXOnly)) {
      return { error: `Input ${i} failed BIP340 verification. Aborting.` };
    }

    signatures.push(sigHex);
  }

  return {
    txBody: buildTxBody(template, signatures),
    signatures,
  };
}

// ============================================================================
// SECTION 9: AGR ID (deterministic from pubkeys + amounts + UTXO tag)
// ============================================================================

export function computeAgrId(
  buyerPubkey: string,
  sellerPubkey: string,
  buyerAmountSompi: bigint,
  sellerAmountSompi: bigint,
  network: string,
  utxoTag?: string
): string {
  const input = new TextEncoder().encode(
    buyerPubkey +
      sellerPubkey +
      buyerAmountSompi.toString() +
      sellerAmountSompi.toString() +
      network +
      (utxoTag || 'no-utxo')
  );
  const hash = sha256(input);
  return 'AGR_' + bytesToHex(hash).slice(0, 12);
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// Key Aggregation: computeL, bindingCoefficient, deriveAggregateKey, deriveAddress,
//                  p2pkScript, verificationCode
// Sighash:         computeSighash
// FROST Signing:   generateNonce, partialSign, aggregateSigs, verifySig
// TX Template:     buildTemplate, parseTemplate, verifyTemplate, encodeTemplate,
//                  encodeResponse, parseResponse
// Covenant:        isPureP2PK, classifyScript
// L1 Format:       buildSignatureScript, buildTxBody
// State Machine:   STEPS, canTransition, K_ALLOWED_STEPS, K_DESTROY_STEPS
// Ceremony:        buyerBuildTemplate, sellerSignTemplate, buyerAggregate
// Identity:        computeAgrId
