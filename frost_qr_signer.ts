// ============================================================================
// KASVILLAGE FROST QR SIGNER — 2-device vault over camera/QR transport
// ============================================================================
// Pure logic — NO UI, NO storage, NO fetch. All crypto is IMPORTED from
// canonical_agreement_steps.ts (L1-proven). This module adds ONLY:
//   1. Vault setup (pubkey exchange -> shared FROST address, fixed counter)
//   2. Vault spend templates (arbitrary recipient + change back to vault)
//   3. Cosigner verify+sign (cosigner receives nothing; human confirms recipient)
//   4. Chunked QR codec (templates exceed one QR frame)
//
// Flow:
//   SETUP  : phone shows setup QR -> cosigner scans, shows its setup QR ->
//            both call deriveVault() -> SAME address + verification code.
//   SPEND  : phone vaultBuildSpendTemplate() -> chunked QR#1 -> cosigner
//            vaultCosignTemplate() (verify, human-confirm, sign; k dies here)
//            -> QR#2 -> phone vaultAggregate() -> buildTxBody -> broadcast
//            via existing submit path. Phone MUST destroy nonces after.
//
// Nonce rules inherited unchanged: one k per input, k exists only during
// the ceremony, reuse leaks the wallet key.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import {
  deriveAggregateKey,
  deriveAddress,
  p2pkScript,
  isPureP2PK,
  assertLMatch,
  verificationCode,
  computeSighash,
  generateNonce,
  partialSign,
  aggregateSigs,
  verifySig,
  buildTxBody,
  encodeTemplate,
  parseTemplate,
  encodeResponse,
  parseResponse,
  type TxTemplate,
  type SellerResponse,
  type FrostNonce,
  type CanonicalInput,
  type CanonicalOutput,
} from './canonical_agreement_steps';

// ============================================================================
// HELPERS (local, no crypto)
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

export type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

// ============================================================================
// SECTION 1: VAULT IDENTITY
// ============================================================================

/** Deterministic counter from vaultId — same formula as deriveFrostAddressLocal. */
export function vaultCounterFromId(vaultId: string): number {
  return Number(
    BigInt('0x' + bytesToHex(sha256(new TextEncoder().encode(vaultId)))) % 2147483646n
  ) + 1;
}

export interface VaultInfo {
  vaultId: string;
  counter: number;
  network: KaspaNetwork;
  myPubkey: string;        // compressed 33-byte hex
  cosignerPubkey: string;  // compressed 33-byte hex
  aggXOnly: string;
  address: string;
  escrowScript: string;    // p2pkScript(aggXOnly)
  verificationCode: string; // both devices display; humans compare
  createdAt: number;
}

/**
 * Derive the shared vault from both pubkeys. BOTH devices call this and MUST
 * display the SAME address + verification code before any funds move.
 */
export function deriveVault(params: {
  vaultId: string;
  myPubkey: string;
  cosignerPubkey: string;
  network: KaspaNetwork;
}): VaultInfo {
  const counter = vaultCounterFromId(params.vaultId);
  const agg = deriveAggregateKey(params.myPubkey, params.cosignerPubkey, counter);
  return {
    vaultId: params.vaultId,
    counter,
    network: params.network,
    myPubkey: params.myPubkey,
    cosignerPubkey: params.cosignerPubkey,
    aggXOnly: agg.aggXOnly,
    address: deriveAddress(agg.aggXOnly, params.network),
    escrowScript: p2pkScript(agg.aggXOnly),
    verificationCode: verificationCode(params.myPubkey, params.cosignerPubkey),
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Setup QR (single frame — fits easily)
// ---------------------------------------------------------------------------

export interface VaultSetupPayload {
  type: 'kvv_setup';
  pubkey: string;
  vaultId: string;
  network: KaspaNetwork;
  name?: string;
}

export function makeVaultSetupQR(p: {
  pubkey: string; vaultId: string; network: KaspaNetwork; name?: string;
}): string {
  const payload: VaultSetupPayload = { type: 'kvv_setup', ...p };
  return JSON.stringify(payload);
}

export function parseVaultSetupQR(data: string): VaultSetupPayload | null {
  try {
    const obj = JSON.parse(data);
    if (obj.type !== 'kvv_setup' || !obj.pubkey || !obj.vaultId || !obj.network) return null;
    if (typeof obj.pubkey !== 'string' || obj.pubkey.length !== 66) return null;
    return obj as VaultSetupPayload;
  } catch { return null; }
}

// ============================================================================
// SECTION 2: SPEND — PHONE SIDE (build template)
// ============================================================================

/**
 * Build a vault spend template: pays recipientScript, change back to the vault.
 * One fresh k per input (same rule as buyerBuildTemplate). Phone keeps nonces
 * ONLY until vaultAggregate returns, then destroys them.
 */
export function vaultBuildSpendTemplate(params: {
  vault: VaultInfo;
  privateKeyHex: string;   // phone's key
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  recipientScript: string; // full scriptPubKey hex (pure P2PK)
  amountSompi: bigint;
  fee?: bigint;
}): {
  template: TxTemplate;
  templateB64: string;
  nonces: FrostNonce[];
  sighashes: string[];
} | { error: string } {
  const { vault, privateKeyHex, recipientScript, amountSompi } = params;

  if (!isPureP2PK(recipientScript)) {
    return { error: 'Recipient script is not standard P2PK — refusing.' };
  }

  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));
  // Every input must be the vault escrow script — signing anything else is not a vault spend.
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].scriptPubKey !== vault.escrowScript) {
      return { error: 'Input ' + i + ' is not a vault UTXO (script mismatch).' };
    }
  }

  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  // Fee floor mirrors canonical formula, assume 2 outputs (recipient + change)
  const fee = params.fee || BigInt(sorted.length * 115000 + 2 * 48000 + 5000);
  if (amountSompi + fee > totalIn) {
    return { error: 'Insufficient vault balance: need ' + (amountSompi + fee) + ', have ' + totalIn };
  }

  const change = totalIn - amountSompi - fee;
  const outputs: { v: string; s: string }[] = [{ v: amountSompi.toString(), s: recipientScript }];
  if (change > 546n) outputs.push({ v: change.toString(), s: vault.escrowScript }); // change stays in vault
  // change <= 546 (dust): absorbed into fee implicitly (outputs+fee < inputs is fine — verified below as non-inflation)

  const nonces: FrostNonce[] = sorted.map(() =>
    generateNonce(privateKeyHex, vault.myPubkey, vault.cosignerPubkey, vault.counter)
  );

  const template: TxTemplate = {
    u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
    o: outputs,
    f: fee.toString(),
    R: nonces.map((n) => n.R_hex),
    agr: 'VAULT_' + vault.vaultId,
    lt: '0',
  };

  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s,
  }));
  const canonOutputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v), script: o.s,
  }));
  const sighashes: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    sighashes.push(bytesToHex(computeSighash(inputs, canonOutputs, i, 0n)));
  }

  return { template, templateB64: encodeTemplate(template), nonces, sighashes };
}

// ============================================================================
// SECTION 3: SPEND — COSIGNER SIDE (verify + human confirm + sign)
// ============================================================================

/**
 * Verify a vault spend template on the cosigner device. The cosigner receives
 * nothing, so the safety argument is:
 *   (a) every input is THE vault escrow (assertLMatch throws otherwise),
 *   (b) all outputs are pure P2PK, no inflation, fee sane, lockTime 0,
 *   (c) a HUMAN confirms the recipient script + amount shown on screen.
 * Returns the display info; caller shows it and only then calls vaultCosignTemplate.
 */
export function vaultVerifySpendTemplate(
  template: TxTemplate,
  vault: VaultInfo,
): {
  valid: boolean;
  error?: string;
  recipientScript?: string;   // for human display (decode to address in UI)
  amountSompi?: bigint;
  changeSompi?: bigint;
  feeSompi?: bigint;
} {
  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {
    return { valid: false, error: 'Template must carry one R nonce per input (v2).' };
  }
  if (template.agr !== 'VAULT_' + vault.vaultId) {
    return { valid: false, error: 'Template is for a different vault (' + template.agr + ').' };
  }
  if (BigInt(template.lt || '0') !== 0n) {
    return { valid: false, error: 'Vault spend must have no lockTime.' };
  }
  for (let i = 0; i < template.u.length; i++) {
    if (template.u[i].s !== vault.escrowScript) {
      return { valid: false, error: 'Input ' + i + ' is not this vault\'s escrow script.' };
    }
  }
  if (template.o.length < 1 || template.o.length > 2) {
    return { valid: false, error: 'Vault spend must have 1-2 outputs, saw ' + template.o.length };
  }
  for (let i = 0; i < template.o.length; i++) {
    if (!isPureP2PK(template.o[i].s)) {
      return { valid: false, error: 'Output ' + i + ' is not standard P2PK — possible covenant.' };
    }
  }

  const totalIn = template.u.reduce((s, u) => s + BigInt(u.a), 0n);
  const totalOut = template.o.reduce((s, o) => s + BigInt(o.v), 0n);
  const fee = BigInt(template.f);
  if (totalOut + fee > totalIn) {
    return { valid: false, error: 'Inflation: outputs + fee exceed inputs.' };
  }
  const minFee = BigInt(template.u.length * 115000 + template.o.length * 48000 + 5000);
  if (fee < minFee) {
    return { valid: false, error: 'Fee too low: ' + fee + ' < ' + minFee };
  }

  // Identify change (pays back to vault) vs recipient
  const changeIdx = template.o.findIndex((o) => o.s === vault.escrowScript);
  const recipIdx = template.o.findIndex((o) => o.s !== vault.escrowScript);
  if (recipIdx < 0) {
    // Self-sweep (consolidation back into vault) — allowed, recipient IS the vault
    return {
      valid: true,
      recipientScript: vault.escrowScript,
      amountSompi: totalOut,
      changeSompi: 0n,
      feeSompi: fee,
    };
  }
  return {
    valid: true,
    recipientScript: template.o[recipIdx].s,
    amountSompi: BigInt(template.o[recipIdx].v),
    changeSompi: changeIdx >= 0 ? BigInt(template.o[changeIdx].v) : 0n,
    feeSompi: fee,
  };
}

/**
 * Cosigner signs after the human confirmed. k is born and dies inside this call.
 */
export function vaultCosignTemplate(params: {
  privateKeyHex: string;   // cosigner's key
  vault: VaultInfo;        // cosigner's own VaultInfo (its myPubkey = cosigner key)
  template: TxTemplate;
}): { response: SellerResponse; responseB64: string } | { error: string } {
  const { privateKeyHex, vault, template } = params;

  const v = vaultVerifySpendTemplate(template, vault);
  if (!v.valid) return { error: v.error || 'Vault template verification failed' };

  const agg = deriveAggregateKey(vault.myPubkey, vault.cosignerPubkey, vault.counter);
  assertLMatch(agg, template.u, 'vaultCosignTemplate', vault.counter); // [L-GUARD]

  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s,
  }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v), script: o.s,
  }));

  const partials: string[] = [];
  const myR: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const nonce = generateNonce(privateKeyHex, vault.myPubkey, vault.cosignerPubkey, vault.counter); // fresh k per input
    myR.push(nonce.R_hex);
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, 0n));
    partials.push(partialSign(nonce, template.R[i], agg.aggXOnly, shHex).s_hex);
  }

  const response: SellerResponse = { R: myR, s: partials };
  return { response, responseB64: encodeResponse(response) };
}

// ============================================================================
// SECTION 4: SPEND — PHONE FINAL (aggregate + verify)
// ============================================================================

/**
 * Aggregate phone + cosigner partials, verify BIP340 per input, build tx body.
 * Caller broadcasts txBody via the existing submit path and MUST destroy nonces.
 */
export function vaultAggregate(params: {
  nonces: FrostNonce[];
  vault: VaultInfo;
  template: TxTemplate;
  cosignerResponse: SellerResponse;
}): { txBody: object; signatures: string[] } | { error: string } {
  const { nonces, vault, template, cosignerResponse } = params;

  if (!Array.isArray(nonces) || nonces.length !== template.u.length) {
    return { error: 'Have ' + (Array.isArray(nonces) ? nonces.length : 0) + ' nonce(s) for ' + template.u.length + ' input(s).' };
  }
  if (!Array.isArray(cosignerResponse.R) || cosignerResponse.R.length !== template.u.length) {
    return { error: 'Cosigner sent wrong R count — possible k reuse. Do NOT broadcast.' };
  }
  if (cosignerResponse.s.length !== template.u.length) {
    return { error: 'Cosigner sent ' + cosignerResponse.s.length + ' partial(s) for ' + template.u.length + ' input(s).' };
  }

  const agg = deriveAggregateKey(vault.myPubkey, vault.cosignerPubkey, vault.counter);
  assertLMatch(agg, template.u, 'vaultAggregate', vault.counter); // [L-GUARD]

  const inputs: CanonicalInput[] = template.u.map((u) => ({
    txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s,
  }));
  const outputs: CanonicalOutput[] = template.o.map((o) => ({
    value: BigInt(o.v), script: o.s,
  }));

  const signatures: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const shHex = bytesToHex(computeSighash(inputs, outputs, i, 0n));
    const myPartial = partialSign(nonces[i], cosignerResponse.R[i], agg.aggXOnly, shHex);
    const sigHex = aggregateSigs(myPartial.R_agg_x_hex, myPartial.s_hex, cosignerResponse.s[i]);
    if (!verifySig(sigHex, shHex, agg.aggXOnly)) {
      return { error: 'Input ' + i + ' failed BIP340 verification. Aborting.' };
    }
    signatures.push(sigHex);
  }

  return { txBody: buildTxBody(template, signatures), signatures };
}

// ============================================================================
// SECTION 5: CHUNKED QR CODEC
// ============================================================================
// Templates exceed one QR frame. Frame format (string, QR-friendly):
//   KVQ1|<sid>|<kind>|<seq>/<tot>|<chunk>
// sid  = 8-hex session id (sha256 of full payload, first 8)
// kind = 'T' (templateB64) | 'S' (responseB64)
// Animated-QR style: UI loops all frames; scanner collects until complete.

export const QR_CHUNK_SIZE = 280;

export interface QrFrameSet {
  sid: string;
  kind: 'T' | 'S';
  frames: string[];
}

export function chunkForQR(payloadB64: string, kind: 'T' | 'S', chunkSize = QR_CHUNK_SIZE): QrFrameSet {
  const sid = bytesToHex(sha256(new TextEncoder().encode(payloadB64))).slice(0, 8);
  const frames: string[] = [];
  const tot = Math.max(1, Math.ceil(payloadB64.length / chunkSize));
  for (let i = 0; i < tot; i++) {
    frames.push('KVQ1|' + sid + '|' + kind + '|' + (i + 1) + '/' + tot + '|' + payloadB64.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  return { sid, kind, frames };
}

export class QrAssembler {
  private sid: string | null = null;
  private kind: 'T' | 'S' | null = null;
  private total = 0;
  private chunks = new Map<number, string>();

  /** Feed one scanned frame. Returns progress; payload set when complete. */
  feed(frame: string): { ok: boolean; have: number; total: number; kind?: 'T' | 'S'; payloadB64?: string; error?: string } {
    const parts = frame.split('|');
    if (parts.length !== 5 || parts[0] !== 'KVQ1') {
      return { ok: false, have: this.chunks.size, total: this.total, error: 'Not a KVQ1 frame' };
    }
    const [, sid, kind, seqTot, chunk] = parts;
    if (kind !== 'T' && kind !== 'S') return { ok: false, have: this.chunks.size, total: this.total, error: 'Bad kind' };
    const m = seqTot.match(/^(\d+)\/(\d+)$/);
    if (!m) return { ok: false, have: this.chunks.size, total: this.total, error: 'Bad seq' };
    const seq = parseInt(m[1], 10), tot = parseInt(m[2], 10);
    if (seq < 1 || seq > tot) return { ok: false, have: this.chunks.size, total: this.total, error: 'Seq out of range' };

    if (this.sid === null) { this.sid = sid; this.kind = kind as 'T' | 'S'; this.total = tot; }
    else if (this.sid !== sid) return { ok: false, have: this.chunks.size, total: this.total, error: 'Frame from a different session — reset and rescan' };
    else if (this.total !== tot || this.kind !== kind) return { ok: false, have: this.chunks.size, total: this.total, error: 'Inconsistent frame set' };

    this.chunks.set(seq, chunk);

    if (this.chunks.size === this.total) {
      let payload = '';
      for (let i = 1; i <= this.total; i++) payload += this.chunks.get(i) || '';
      // Integrity: sid must match reassembled payload
      const check = bytesToHex(sha256(new TextEncoder().encode(payload))).slice(0, 8);
      if (check !== this.sid) {
        this.reset();
        return { ok: false, have: 0, total: 0, error: 'Checksum mismatch — rescan from the start' };
      }
      return { ok: true, have: this.total, total: this.total, kind: this.kind!, payloadB64: payload };
    }
    return { ok: true, have: this.chunks.size, total: this.total, kind: this.kind! };
  }

  reset(): void { this.sid = null; this.kind = null; this.total = 0; this.chunks.clear(); }
}

// Convenience: full-payload helpers
export function templateToQRFrames(templateB64: string): QrFrameSet { return chunkForQR(templateB64, 'T'); }
export function responseToQRFrames(responseB64: string): QrFrameSet { return chunkForQR(responseB64, 'S'); }
export function parseAssembledTemplate(payloadB64: string): TxTemplate | null { return parseTemplate(payloadB64); }
export function parseAssembledResponse(payloadB64: string): SellerResponse | null { return parseResponse(payloadB64); }

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// Vault identity : vaultCounterFromId, deriveVault, makeVaultSetupQR, parseVaultSetupQR
// Phone (spend)  : vaultBuildSpendTemplate, vaultAggregate
// Cosigner       : vaultVerifySpendTemplate, vaultCosignTemplate
// QR transport   : chunkForQR, QrAssembler, templateToQRFrames, responseToQRFrames,
//                  parseAssembledTemplate, parseAssembledResponse
// ============================================================================
