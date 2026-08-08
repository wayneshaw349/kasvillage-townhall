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

// Kaspa TransactionSigningHash is KEYED blake2b-256. The runtime honors `key`
// (L1-proven; verified against installed @noble/hashes) but the resolved .d.ts
// omits it. The cast below is TYPE-ONLY - runtime bytes are unchanged.
function keyedBlake2b(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32, key: SIGHASH_KEY } as unknown as { dkLen: number });
}

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
// v2: R is per-input. v1 templates (one R, N inputs) leak the wallet key and
// are rejected by parseTemplate/parseResponse.
export const AGREEMENT_SCHEMA_VERSION = 2;

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
R: string[];            // Buyer R nonces - ONE PER INPUT, aligned with u[]
  agr: string;            // Agreement ID
  lt?: string;            // lockTime (DAA) — '0' for release/cancel, set for refund
}

// ============================================================================
// SELLER RESPONSE (clipboard payload: seller → buyer)
// ============================================================================

export interface SellerResponse {
R: string[];     // Seller R nonces - ONE PER INPUT, aligned with the template u[]
  s: string[];     // Partial s values (one per input, hex)
}

// ============================================================================
// RELEASE MODES
// ============================================================================

/** How funds leave the FROST address */
export type ReleaseMode = 'release' | 'cancel' | 'refund';

/**
 * Compute outputs for each release mode.
 * 
 * release: Trade complete — all funds to seller (payment + collateral return)
 * cancel:  Mutual cancellation — each party's collateral returns to them
 * split:   Dispute resolution — custom division agreed by both parties
 */
export function computeReleaseOutputs(
  mode: ReleaseMode,
  totalIn: bigint,
  fee: bigint,
  partyA_depositSompi: bigint,
  partyB_depositSompi: bigint,
  partyA_xOnly: string,
  partyB_xOnly: string,
): { outputs: TxTemplateOutput[]; description: string } {
  const net = totalIn - fee;
  const scriptA = p2pkScript(partyA_xOnly);
  const scriptB = p2pkScript(partyB_xOnly);

  switch (mode) {
    case 'refund': {
      return {
        outputs: [{ v: net.toString(), s: scriptA }],
        description: 'Timelocked refund: ' + (Number(net) / 1e8).toFixed(4) + ' KAS returned',
      };
    }
    case 'release': {
      // Trade complete: seller (party receiving payment) gets everything
      // Caller determines which party is the recipient
      // Single output avoids 0-value UTXO
      return {
        outputs: [{ v: net.toString(), s: scriptB }],
        description: 'Agreement complete: ' + (Number(net) / 1e8).toFixed(4) + ' KAS released',
      };
    }
    case 'cancel': {
      // Mutual cancellation: each gets their original collateral back
      // Fee deducted from larger deposit (or split proportionally)
      const totalDeposit = partyA_depositSompi + partyB_depositSompi;
      let aGets = 0n;
      let bGets = 0n;
      if (totalDeposit > 0n) {
        // Proportional fee split
        aGets = (net * partyA_depositSompi) / totalDeposit;
        bGets = net - aGets;
      }
      const outs: TxTemplateOutput[] = [];
      if (aGets > 0n) outs.push({ v: aGets.toString(), s: scriptA });
      if (bGets > 0n) outs.push({ v: bGets.toString(), s: scriptB });
      return {
        outputs: outs,
        description: 'Cancellation: Party A receives ' + (Number(aGets) / 1e8).toFixed(4) + ', Party B receives ' + (Number(bGets) / 1e8).toFixed(4) + ' KAS',
      };
    }

  }
}

/**
 * Build TX template with configurable release mode.
 * Supports: release (1 output), cancel (2 outputs), split (1-2 outputs).
 * Uses the same signing ceremony as buyerBuildTemplate.
 */
export function buildReleaseTemplate(params: {
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  partyA_xOnly: string;
  partyB_xOnly: string;
  partyA_depositSompi: bigint;
  partyB_depositSompi: bigint;
  mode: ReleaseMode;
  fee?: bigint;
  privateKeyHex: string;
  buyerPubkey: string;
  sellerPubkey: string;
  counter: number;
  agrId: string;
}): { template: TxTemplate; description: string; nonces: FrostNonce[] } {
  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));
  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  const numOutputs = params.mode === 'release' ? 1 : 2;
  const fee = params.fee || BigInt(sorted.length * 115000 + numOutputs * 48000 + 5000);

  // ONE k PER INPUT. Generated AFTER the sort so R[i] lines up with u[i].
  const nonces: FrostNonce[] = sorted.map(() =>
    generateNonce(params.privateKeyHex, params.buyerPubkey, params.sellerPubkey, params.counter)
  );

  const { outputs, description } = computeReleaseOutputs(
    params.mode, totalIn, fee,
    params.partyA_depositSompi, params.partyB_depositSompi,
    params.partyA_xOnly, params.partyB_xOnly,
  );

  return {
    template: {
      u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
      o: outputs,
      f: fee.toString(),
      R: nonces.map((n) => n.R_hex),
      agr: params.agrId,
    },
    description,
    nonces,
  };
}


// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum (above Toccata 100 sompi/gram)

// Toccata-compatible: fetch fee estimate from REST API
// Falls back to hardcoded formula if API unavailable
export async function fetchFeeEstimate(
  network: 'mainnet' | 'testnet-10' = 'testnet-10'
): Promise<bigint> {
  const api = network === 'mainnet' ? 'api.kaspa.org' : 'api-tn10.kaspa.org';
  try {
    const resp = await fetch(`https://${api}/info/fee-estimate`);
    if (!resp.ok) throw new Error(`Fee API: ${resp.status}`);
    const data = await resp.json();
    // priorityBucket.feerate is sompi/gram — multiply by estimated mass
    const feeRate = data?.priorityBucket?.feerate || data?.priority_bucket?.feerate || 100;
    // Typical FROST tx: ~2500 grams (2-in, 2-out)
    const estimatedMass = 2500;
    const fee = BigInt(Math.ceil(feeRate * estimatedMass));
    return fee < MIN_FEE_SOMPI ? MIN_FEE_SOMPI : fee;
  } catch {
    // Toccata fallback formula: fee = 100 * max(compute_grams, 2 * tx_bytes)
    // Typical FROST tx: 2 inputs, 2 outputs
    // tx_bytes � 35 + 2*(41+65) + 2*(9+34) = 333 bytes
    // compute_grams � 333 + 2*340 + 2*1000 = 3013
    // fee = 100 * max(3013, 2*333) = 100 * 3013 = 301300 sompi
    const txBytes = 333; // typical FROST 2-in-2-out
    const computeGrams = txBytes + 2 * 340 + 2 * 1000;
    const toccataFee = BigInt(100 * Math.max(computeGrams, 2 * txBytes));
    return toccataFee < MIN_FEE_SOMPI ? MIN_FEE_SOMPI : toccataFee;
  }
}
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
 * [L-GUARD] Assert the signing-side aggregate key matches the escrow script being spent.
 * If the counter (or pubkey set) used at signing diverges from the one used at address
 * derivation, L differs, the aggregate key differs, and the signature can never satisfy
 * the escrow script - the failure would surface only at broadcast, or worse, in a stored
 * refund that silently cannot fire. This makes the divergence throw loudly BEFORE any k
 * is used or anything is signed.
 */
export function assertLMatch(
  agg: { aggXOnly: string },
  templateInputs: Array<{ s: string; t?: string }>,
  fnName: string,
  counter?: number
): void {
  const expected = p2pkScript(agg.aggXOnly);
  for (let gi = 0; gi < templateInputs.length; gi++) {
    const got = (templateInputs[gi] && templateInputs[gi].s) || '';
    if (got !== expected) {
      throw new Error(
        '[L-MISMATCH] ' + fnName + ': input ' + gi + ' escrow script does not match the aggregate key derived at signing time. ' +
        'counter=' + String(counter) + ' derived=' + expected.slice(0, 20) + '... input=' + got.slice(0, 20) + '... ' +
        'The signing counter/pubkeys differ from the ones used to derive the escrow address. NOTHING was signed. ' +
        'Do not retry with a guessed counter - resume from the original proposal paste.'
      );
    }
  }
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
  const hash = sha256(new TextEncoder().encode('FROST_VERIFY:' + pk1 + pk2)); // [UNIFIED] match frost_complete
  return bytesToHex(hash).slice(0, 12).toUpperCase();
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
  return keyedBlake2b(
    concat(...inputs.map((i) => concat(hexToBytes(i.txId), w32(i.index))))
  );
}

function hashSequences(inputs: CanonicalInput[]): Uint8Array {
  return keyedBlake2b(concat(...inputs.map(() => w64(0n))));
}

function hashSigOpCounts(inputs: CanonicalInput[]): Uint8Array {
  return keyedBlake2b(new Uint8Array(inputs.map(() => 1)));
}

function hashOutputs(outputs: CanonicalOutput[]): Uint8Array {
  return keyedBlake2b(
    concat(
      ...outputs.map((o) =>
        concat(
          w64(o.value),
          w16(0),
          w64(BigInt(hexToBytes(o.script).length)),
          hexToBytes(o.script)
        )
      )
    )
  );
}

/**
 * Compute Kaspa sighash for a specific input.
 * Uses SIGHASH_ALL mode, native subnetwork (all zeros).
 */
export function computeSighash(
  inputs: CanonicalInput[],
  outputs: CanonicalOutput[],
  inputIndex: number,
  lockTime: bigint = 0n
): Uint8Array {
  const inp = inputs[inputIndex];
  const spk = hexToBytes(inp.scriptPubKey);
  const subnetId = new Uint8Array(20); // all zeros = native

  return keyedBlake2b(
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
      w64(lockTime),                  // lockTime
      subnetId,                       // native subnetwork
      w64(0n),                        // gas
      new Uint8Array(32),             // payload hash (empty)
      w8(1)                           // sighash type: ALL
    )
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
  const kBytes = (secp256k1 as any).utils.randomPrivateKey(); // type-only cast; runtime proven
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
  let Ragg: any = (G.multiply(nonce.k) as any).add(Rc); // type-only cast; runtime proven
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
buyerR_hex: string[];   // one per input, sorted order
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
    // v1 templates carried ONE R for N inputs. Signing one leaks the wallet key
    // by division. Refuse to parse rather than refuse to sign.
    if (!Array.isArray(obj.R)) {
      console.warn('[Template] REJECTED: v1 format (single R for all inputs). Ask for a fresh template.');
      return null;
    }
    if (obj.R.length !== obj.u.length) {
      console.warn('[Template] REJECTED:', obj.R.length, 'R nonces for', obj.u.length, 'inputs.');
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
  const dynamicMinFee = BigInt(template.u.length * 115000 + template.o.length * 48000 + 5000);
    if (fee < dynamicMinFee) {
    return { valid: false, myOutputIdx: myIdx, myAmount, error: `Fee too low: ${fee} < ${dynamicMinFee}` };
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
    // Same gate as parseTemplate: a scalar R means one k signed every input.
    if (!Array.isArray(obj.R)) {
      console.warn('[Response] REJECTED: v1 format (single R for all inputs).');
      return null;
    }
    if (obj.R.length !== obj.s.length) {
      console.warn('[Response] REJECTED:', obj.R.length, 'R nonces for', obj.s.length, 'partials.');
      return null;
    }
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
      lockTime: template.lt || '0',
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
// ============================================================================
// SELLER REFUND (timelocked reclaim) — pure wrapper over the refund-mode ceremony.
// The SELLER is the reclaiming party (partyA): they get the single output back.
// Party mapping: seller pubkey -> buyerPubkey slot (partyA/scriptA in refund mode).
// The predicted escrow UTXO is computed by the caller (computeTxId) and passed in.
// lockTime = fundDAA + N; both parties co-sign; broadcastable only after N.
// ============================================================================
export function buildSellerRefund(params: {
  sellerPrivKeyHex: string;
  sellerPubkey: string;   // reclaiming party (partyA) - receives the refund output
  buyerPubkey: string;    // counterparty (partyB)
  counter: number;
  predictedEscrowUtxo: { txId: string; index: number; amount: string; scriptPubKey: string };
  fundDAA: bigint;
  N: bigint;              // timeout window in DAA (from proposal)
  agrId: string;
}): { template: TxTemplate; templateB64: string; nonces: FrostNonce[]; sighashes: string[] } {
  return buyerBuildTemplate({
    privateKeyHex: params.sellerPrivKeyHex,
    buyerPubkey: params.sellerPubkey,   // partyA = seller = gets the refund output
    sellerPubkey: params.buyerPubkey,   // partyB = buyer = counterparty
    counter: params.counter,
    utxos: [params.predictedEscrowUtxo],
    buyerAmountSompi: BigInt(params.predictedEscrowUtxo.amount),
    releaseMode: 'refund',
    lockTime: params.fundDAA + params.N,
    agrId: params.agrId,
  });
}

export function buyerBuildTemplate(params: {
  privateKeyHex: string;
  buyerPubkey: string;
  sellerPubkey: string;
  counter: number;
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  buyerAmountSompi: bigint;
  sellerAmountSompi?: bigint;
  releaseMode?: ReleaseMode;
  fee?: bigint;
  agrId: string;
  lockTime?: bigint;
}): {
  template: TxTemplate;
  templateB64: string;
  nonces: FrostNonce[];
  sighashes: string[];
} {
  const numOutputs = ((params.releaseMode || 'release') === 'cancel') ? 2 : 1;
  const fee = params.fee || BigInt(params.utxos.length * 115000 + numOutputs * 48000 + 5000);

  const buyerXOnly =
    params.buyerPubkey.length === 66 ? params.buyerPubkey.slice(2) : params.buyerPubkey;
  const sellerXOnly =
    params.sellerPubkey.length === 66 ? params.sellerPubkey.slice(2) : params.sellerPubkey;

  const mode: ReleaseMode = params.releaseMode || 'release';
  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));
  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  const sellerDeposit = params.sellerAmountSompi ?? (totalIn - params.buyerAmountSompi - fee);

  // ONE k PER INPUT (k born here, one per input). Sharing a k across inputs gives
  // d = (s0-s1)/(e0-e1) - the wallet key by division. Generated after the sort so
  // R[i] lines up with u[i].
  const nonces: FrostNonce[] = sorted.map(() =>
    generateNonce(params.privateKeyHex, params.buyerPubkey, params.sellerPubkey, params.counter)
  );

  const { outputs } = computeReleaseOutputs(
    mode, totalIn, fee,
    params.buyerAmountSompi, sellerDeposit,
    buyerXOnly, sellerXOnly,
  );

  const template: TxTemplate = {
    u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
    o: outputs,
    f: fee.toString(),
    R: nonces.map((n) => n.R_hex),
    agr: params.agrId,
    lt: (params.lockTime ?? 0n).toString(),
  };

  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t,
    index: u.i,
    value: BigInt(u.a),
    scriptPubKey: u.s,
  }));
  const canonOutputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v),
    script: o.s,
  }));

  const sighashes: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    sighashes.push(bytesToHex(computeSighash(inputs, canonOutputs, i, BigInt(template.lt || '0'))));
  }

  return {
    template,
    templateB64: encodeTemplate(template),
    nonces,
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

  // A template with fewer R nonces than inputs is a v1 template. Signing it would
  // publish two s values under one k and hand over the wallet key. Refuse.
  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {
    return { error: 'Template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign. Ask for a fresh template.' };
  }

  const sellerXOnly =
    sellerPubkey.length === 66 ? sellerPubkey.slice(2) : sellerPubkey;
  const verification = verifyTemplate(template, sellerXOnly);
  if (!verification.valid) {
    return { error: verification.error || 'Template verification failed' };
  }

  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);
  assertLMatch(agg, template.u, 'sellerSignTemplate/buyerAggregate', counter); // [L-GUARD]

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
  const myR: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    // Fresh k for THIS input only. Born and dies inside this loop iteration.
    const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter);
    myR.push(nonce.R_hex);
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));
    const ps = partialSign(nonce, template.R[i], agg.aggXOnly, shHex);
    partials.push(ps.s_hex);
  }

  const response: SellerResponse = { R: myR, s: partials };

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
  nonces: FrostNonce[];
  buyerPubkey: string;
  sellerPubkey: string;
  counter: number;
  template: TxTemplate;
  sellerResponse: SellerResponse;
}): { txBody: object; signatures: string[] } | { error: string } {
  const { nonces, buyerPubkey, sellerPubkey, counter, template, sellerResponse } = params;

  // Every array must line up with u[], or somebody reused a k.
  if (!Array.isArray(nonces) || nonces.length !== template.u.length) {
    return { error: 'Have ' + (Array.isArray(nonces) ? nonces.length : 0) + ' nonce(s) for ' + template.u.length + ' input(s) - one k per input is required.' };
  }
  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {
    return { error: 'Template carries the wrong number of R nonces - refusing.' };
  }
  if (!Array.isArray(sellerResponse.R) || sellerResponse.R.length !== template.u.length) {
    return { error: 'Counterparty sent ' + (Array.isArray(sellerResponse.R) ? sellerResponse.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). They reused a k - do NOT broadcast, and tell them to update.' };
  }
  if (sellerResponse.s.length !== template.u.length) {
    return { error: 'Counterparty sent ' + sellerResponse.s.length + ' partial(s) for ' + template.u.length + ' input(s).' };
  }

  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);
  assertLMatch(agg, template.u, 'sellerSignTemplate/buyerAggregate', counter); // [L-GUARD]

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
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));

    // nonces[i] signed input i and nothing else.
    const buyerPartial = partialSign(nonces[i], sellerResponse.R[i], agg.aggXOnly, shHex);

    const sigHex = aggregateSigs(
      buyerPartial.R_agg_x_hex,
      buyerPartial.s_hex,
      sellerResponse.s[i]
    );

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
// SECTION 8b: REFUND CO-SIGN (counterparty side)
// The refund pays ONLY the funder. verifyTemplate() would reject it outright
// ('your output not found'), which is correct for a release but wrong here.
// The co-signer's safety argument is different: I receive nothing, but this tx
//   (a) spends ONLY the predicted escrow UTXO (which does not exist yet),
//   (b) pays ONLY the funder's own P2PK script,
//   (c) cannot confirm before lockTime = now + N.
// ============================================================================
export function verifyRefundTemplate(
  template: TxTemplate,
  funderXOnly: string,
  expected: {
    predictedTxId: string;
    escrowScript: string;   // p2pkScript(frost aggXOnly)
    N: bigint;              // from the signed proposal
    currentDAA: bigint;
    slackDAA?: bigint;         // how much longer than N is tolerated (default 600 = ~1 min)
    minRemainingDAA?: bigint;  // how much clock must still remain (default 600 = ~1 min)
  },
): { valid: boolean; error?: string } {
  const slack = expected.slackDAA ?? 600n;

if (!Array.isArray(template.R) || template.R.length !== template.u.length) return { valid: false, error: 'Refund template must carry one R nonce per input (v2)' };
if (template.u.length !== 1) return { valid: false, error: 'Refund must spend exactly 1 input, saw ' + template.u.length };
  const u = template.u[0];
  if (u.t !== expected.predictedTxId) return { valid: false, error: 'Refund input is not the predicted escrow txid' };
  if (u.i !== 0) return { valid: false, error: 'Refund input index must be 0, saw ' + u.i };
  if (u.s !== expected.escrowScript) return { valid: false, error: 'Refund input script is not the FROST escrow script' };

  if (template.o.length !== 1) return { valid: false, error: 'Refund must have exactly 1 output, saw ' + template.o.length };
  const funderScript = p2pkScript(funderXOnly);
  if (template.o[0].s !== funderScript) return { valid: false, error: 'Refund output does not pay the funder' };
  if (!isPureP2PK(template.o[0].s)) return { valid: false, error: 'Refund output is not standard P2PK — possible covenant' };

  const lt = BigInt(template.lt || '0');
  if (lt === 0n) return { valid: false, error: 'Refund has no lockTime — would be spendable immediately' };
  // (a) Must not already be spendable, or the seller could reclaim the instant they fund.
  //     The seller stamps lt at accept; the buyer checks it minutes later, so lt is always
  //     somewhat behind currentDAA + N. That drift is the handshake, not an attack — what
  //     matters is only that real time remains on the clock.
  const minRemaining = expected.minRemainingDAA ?? 600n;   // ~1 min at 10 DAA/s
  if (lt < expected.currentDAA + minRemaining) {
    return { valid: false, error: 'lockTime ' + lt + ' has passed or is about to (now ' + expected.currentDAA + '). The agreed timeout is too short for the time this handshake took — start again with a longer one.' };
  }
  // (b) Must not claim materially longer than agreed.
  if (lt > expected.currentDAA + expected.N + slack) {
    return { valid: false, error: 'lockTime ' + lt + ' is longer than the agreed timeout (max ' + (expected.currentDAA + expected.N + slack) + ')' };
  }

  const totalIn = BigInt(u.a);
  const totalOut = BigInt(template.o[0].v);
  const fee = BigInt(template.f);
  if (totalOut + fee > totalIn) return { valid: false, error: 'Inflation: output + fee exceed input' };
  const minFee = BigInt(template.u.length * 115000 + template.o.length * 48000 + 5000);
  if (fee < minFee) return { valid: false, error: 'Fee too low: ' + fee + ' < ' + minFee };

  return { valid: true };
}

/** Counterparty co-signs the funder's timelocked refund. k born and dies here. */
export function cosignRefundTemplate(params: {
  privateKeyHex: string;
  myPubkey: string;        // co-signer (buyer) - receives nothing
  funderPubkey: string;    // seller - receives the refund output
  counter: number;
  template: TxTemplate;
  expected: { predictedTxId: string; escrowScript: string; N: bigint; currentDAA: bigint; slackDAA?: bigint; minRemainingDAA?: bigint };
}): { response: SellerResponse; responseB64: string } | { error: string } {
  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;

  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {
    return { error: 'Refund template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign.' };
  }

  const funderXOnly = funderPubkey.length === 66 ? funderPubkey.slice(2) : funderPubkey;
  const v = verifyRefundTemplate(template, funderXOnly, params.expected);
  if (!v.valid) return { error: v.error || 'Refund verification failed' };

  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);
  assertLMatch(agg, template.u, 'cosignRefund/cosignKill', counter); // [L-GUARD]

  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));

  const partials: string[] = [];
  const myR: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);  // fresh k per input
    myR.push(nonce.R_hex);
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));
    partials.push(partialSign(nonce, template.R[i], agg.aggXOnly, shHex).s_hex);
  }

  const response: SellerResponse = { R: myR, s: partials };
  return { response, responseB64: encodeResponse(response) };
}

// ============================================================================
// SECTION 8c: KILL TX
// Spends the seller's predicted escrow UTXO A and pays it back to the SAME FROST
// address. No lockTime. Nobody is paid — A simply stops existing, which kills the
// refund (whose only input is A) by consensus, not by a guard.
//
// The seller pre-signs this at accept as the price of the buyer co-signing the
// refund. Withholding it gains the seller nothing: the buyer then never funds, and
// the seller's collateral just sits until they reclaim it at N.
//
// Why this is safe to hand over: the tx can only move A from escrow back to escrow.
// It cannot pay anyone, so publishing it costs nothing.
// ============================================================================
export function buildKillTx(params: {
  sellerPrivKeyHex: string;
  sellerPubkey: string;
  buyerPubkey: string;
  counter: number;
  predictedEscrowUtxo: { txId: string; index: number; amount: string; scriptPubKey: string };
  agrId: string;
  fee?: bigint;
}): { template: TxTemplate; templateB64: string; nonces: FrostNonce[]; sighashes: string[] } {
  const u = params.predictedEscrowUtxo;
  const fee = params.fee || BigInt(1 * 115000 + 1 * 48000 + 5000);
  const totalIn = BigInt(u.amount);
  if (totalIn <= fee) throw new Error('Kill: escrow amount too low for fee');

  // Fresh random k per input. NEVER derive k from the tx, and never share one
  // across inputs: the refund and the kill spend the SAME utxo with DIFFERENT
  // outputs, so a shared k would give d = (s1-s2)/(e1-e2) - the wallet key by
  // division. Same reason two inputs of one tx may not share a k.
  const inputsRaw = [{ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey }];
  const nonces: FrostNonce[] = inputsRaw.map(() =>
    generateNonce(params.sellerPrivKeyHex, params.sellerPubkey, params.buyerPubkey, params.counter)
  );

  const template: TxTemplate = {
    u: inputsRaw,
    o: [{ v: (totalIn - fee).toString(), s: u.scriptPubKey }],  // back to the escrow
    f: fee.toString(),
    R: nonces.map((n) => n.R_hex),
    agr: params.agrId,
    lt: '0',                                                    // spendable immediately
  };

  const inputs: CanonicalInput[] = template.u.map((x) => ({ txId: x.t, index: x.i, value: BigInt(x.a), scriptPubKey: x.s }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));
  const sighashes: string[] = [];
  for (let i = 0; i < inputs.length; i++) sighashes.push(bytesToHex(computeSighash(inputs, outputs, i, 0n)));

  return { template, templateB64: encodeTemplate(template), nonces, sighashes };
}

/** Buyer's check before co-signing the kill tx. It must only ever move A escrow->escrow. */
export function verifyKillTemplate(
  template: TxTemplate,
  expected: { predictedTxId: string; escrowScript: string },
): { valid: boolean; error?: string } {
if (!Array.isArray(template.R) || template.R.length !== template.u.length) return { valid: false, error: 'Kill template must carry one R nonce per input (v2)' };
if (template.u.length !== 1) return { valid: false, error: 'Kill must spend exactly 1 input, saw ' + template.u.length };
  const u = template.u[0];
  if (u.t !== expected.predictedTxId) return { valid: false, error: 'Kill input is not the predicted escrow txid' };
  if (u.i !== 0) return { valid: false, error: 'Kill input index must be 0, saw ' + u.i };
  if (u.s !== expected.escrowScript) return { valid: false, error: 'Kill input script is not the FROST escrow script' };

  if (template.o.length !== 1) return { valid: false, error: 'Kill must have exactly 1 output, saw ' + template.o.length };
  // THE point of the whole tx: the output goes back to escrow, not to a party.
  if (template.o[0].s !== expected.escrowScript) return { valid: false, error: 'Kill output does not return to the escrow — it pays someone' };
  if (!isPureP2PK(template.o[0].s)) return { valid: false, error: 'Kill output is not standard P2PK' };

  if (BigInt(template.lt || '0') !== 0n) return { valid: false, error: 'Kill must have no lockTime — it has to be broadcastable at once' };

  const totalIn = BigInt(u.a);
  const totalOut = BigInt(template.o[0].v);
  const fee = BigInt(template.f);
  if (totalOut + fee > totalIn) return { valid: false, error: 'Inflation: output + fee exceed input' };
  const minFee = BigInt(template.u.length * 115000 + template.o.length * 48000 + 5000);
  if (fee < minFee) return { valid: false, error: 'Fee too low: ' + fee + ' < ' + minFee };

  return { valid: true };
}

/** Buyer co-signs the kill tx. k born and dies here. */
export function cosignKillTemplate(params: {
  privateKeyHex: string;
  myPubkey: string;        // co-signer (buyer)
  funderPubkey: string;    // seller - whose UTXO is being consumed
  counter: number;
  template: TxTemplate;
  expected: { predictedTxId: string; escrowScript: string };
}): { response: SellerResponse; responseB64: string } | { error: string } {
  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;

  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {
    return { error: 'Kill template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign.' };
  }

  const v = verifyKillTemplate(template, params.expected);
  if (!v.valid) return { error: v.error || 'Kill verification failed' };

  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);
  assertLMatch(agg, template.u, 'cosignRefund/cosignKill', counter); // [L-GUARD]

  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));

  const partials: string[] = [];
  const myR: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);  // fresh k per input
    myR.push(nonce.R_hex);
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, 0n));
    partials.push(partialSign(nonce, template.R[i], agg.aggXOnly, shHex).s_hex);
  }

  const response: SellerResponse = { R: myR, s: partials };
  return { response, responseB64: encodeResponse(response) };
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

