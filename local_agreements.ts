// ============================================================================
// local_agreements.ts — device-local agreement ledger (KasVillage)
// ============================================================================
// PURPOSE
//   Persist proposals I created + proposals given to me, with progress state,
//   so the inbox/agreement UI reads from DEVICE — TownHall becomes optional
//   transport, Arweave stays the durable restore layer.
//
// SAFETY MODEL (do not violate)
//   - AsyncStorage, PLAINTEXT ONLY. Everything here is public by construction:
//     proposal body (buyer-signed, already pasted/inscribed), R (public nonce
//     commitment), agrId, amounts, pubkeys, FROST address, timeoutN, step.
//   - NEVER store k, d_tweaked, private keys, mnemonics, or the
//     kv_refund_pending_ blob here. Those live in SecureStore, keyed by agrId.
//   - Proposal body is self-authenticating (buyer ECDSA over body = paste-is-
//     truth). Callers may pass a verify hook; unverified records are flagged,
//     not hidden — chain-truth guards downstream re-check everything anyway.
//
// STORAGE
//   Single AsyncStorage key, versioned envelope, atomic read-modify-write
//   serialized through an in-module mutex (AsyncStorage has no transactions).
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgrRole = 'buyer' | 'seller';

/** Monotonic progress. Never move backwards except via explicit abort/reset. */
export type AgrStep =
  | 'proposed'          // proposal created (buyer) or received (seller)
  | 'agreed'            // both parties agreed, FROST derived
  | 'templates_built'   // seller froze funding tx, refund+kill templates copied
  | 'cosigned'          // buyer returned refund|kill cosignatures
  | 'seller_funded'     // seller collateral broadcast (escrow partial)
  | 'kill_broadcast'    // kill tx fired, refund dead
  | 'buyer_funded'      // buyer collateral broadcast (escrow full)
  | 'complete'          // release done
  | 'aborted';          // explicitly torn down

const STEP_ORDER: Record<AgrStep, number> = {
  proposed: 0, agreed: 1, templates_built: 2, cosigned: 3,
  seller_funded: 4, kill_broadcast: 5, buyer_funded: 6, complete: 7,
  aborted: 99,
};

/** Ceremony payloads captured to the on-device dossier. PUBLIC text only:
 *  proposal body, base64 templates/cosig/response, kill tx JSON. NEVER nonces/keys. */
export type PayloadKind = 'proposal' | 'templates' | 'cosig' | 'response' | 'kill';

export interface PastedPayload {
  text: string;                 // raw payload exactly as pasted or created
  dir: 'in' | 'out';            // 'in' = pasted/received, 'out' = created on this device
  at: number;                   // capture timestamp
}

export interface LocalAgreement {
  agrId: string;
  role: AgrRole;
  /** 'mine' = I authored the proposal; 'given' = pasted/received from counterparty */
  origin: 'mine' | 'given';
  /** Raw proposal text exactly as created/pasted. THE source of truth. */
  proposalBody: string;
  /** True once the buyer signature over proposalBody verified on this device. */
  sigVerified: boolean;
  step: AgrStep;
  // -- public metadata (all derivable from proposalBody; cached for display) --
  buyerPubkey?: string;
  sellerPubkey?: string;
  buyerAmountSompi?: string;   // strings: no BigInt in JSON
  sellerAmountSompi?: string;
  frostAddress?: string;
  frostCounter?: number;
  timeoutN?: number;
  network?: string;
  description?: string;
  verificationCode?: string;   // public — presented to both parties at ceremony
  buyerR?: string;             // public nonce commitment
  /** DOSSIER: every ceremony payload seen for this agreement, keyed by kind. Public text only. */
  pastedPayloads?: Partial<Record<PayloadKind, PastedPayload>>;
  // -- provenance / recovery pointers --
  arweaveTxIds?: string[];     // every inscription tx seen for this agrId
  predictedFundingTxId?: string;
  escrowTxId?: string;
  killTxId?: string;
  // -- timestamps --
  createdAt: number;
  updatedAt: number;
}

interface Envelope {
  v: 1;
  agreements: Record<string, LocalAgreement>; // keyed by agrId
}

// ---------------------------------------------------------------------------
// Storage core
// ---------------------------------------------------------------------------

const STORE_KEY = 'kv_local_agreements_v1';
const MAX_RECORDS = 200; // prune oldest terminal records beyond this

let _mutex: Promise<unknown> = Promise.resolve();

/** Serialize all writers through one chain. Readers may go direct. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = _mutex.then(fn, fn);
  _mutex = run.catch(() => {}); // never poison the chain
  return run;
}

async function readEnvelope(): Promise<Envelope> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return { v: 1, agreements: {} };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && parsed.agreements && typeof parsed.agreements === 'object') {
      return parsed as Envelope;
    }
    console.warn('[LocalAgr] Unrecognized envelope — starting fresh (old data preserved under backup key)');
    await AsyncStorage.setItem(STORE_KEY + '_corrupt_' + Date.now(), raw).catch(() => {});
    return { v: 1, agreements: {} };
  } catch (e) {
    console.warn('[LocalAgr] Read failed:', e);
    return { v: 1, agreements: {} };
  }
}

async function writeEnvelope(env: Envelope): Promise<void> {
  // prune: keep everything active; drop oldest terminal (complete/aborted) past cap
  const all = Object.values(env.agreements);
  if (all.length > MAX_RECORDS) {
    const terminal = all
      .filter(a => a.step === 'complete' || a.step === 'aborted')
      .sort((a, b) => a.updatedAt - b.updatedAt);
    let excess = all.length - MAX_RECORDS;
    for (const t of terminal) {
      if (excess <= 0) break;
      delete env.agreements[t.agrId];
      excess--;
    }
  }
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(env));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert or update an agreement. Merge rules:
 *  - proposalBody: first non-empty wins; a DIFFERENT non-empty body for the
 *    same agrId is rejected (paste-is-truth — bodies are immutable).
 *  - step: only advances (see advanceStep); use abortAgreement to terminate.
 *  - metadata: incoming defined fields overwrite; undefined fields keep old.
 *  - arweaveTxIds: set-union.
 * Returns the stored record.
 */
export async function upsertAgreement(
  input: Partial<LocalAgreement> & { agrId: string },
): Promise<LocalAgreement> {
  return locked(async () => {
    const env = await readEnvelope();
    const now = Date.now();
    const prev = env.agreements[input.agrId];

    if (prev && input.proposalBody && prev.proposalBody &&
        input.proposalBody !== prev.proposalBody) {
      console.warn('[LocalAgr] REJECT body mutation for', input.agrId,
        '- existing body kept (paste-is-truth)');
      // still merge non-body fields below
      input = { ...input, proposalBody: prev.proposalBody };
    }

    const defaults: LocalAgreement = {
      agrId: input.agrId, role: 'buyer', origin: 'mine', proposalBody: '',
      sigVerified: false, step: 'proposed', createdAt: now, updatedAt: now,
    };
    const merged: LocalAgreement = {
      ...defaults,
      ...(prev || {}),           // previous state
      ...definedOnly(input),     // incoming defined fields only
      agrId: input.agrId,
      updatedAt: now,
    };

    // step never regresses via upsert
    if (prev && STEP_ORDER[merged.step] < STEP_ORDER[prev.step]) {
      merged.step = prev.step;
    }
    // arweave tx union
    if (prev?.arweaveTxIds || input.arweaveTxIds) {
      merged.arweaveTxIds = Array.from(new Set([
        ...(prev?.arweaveTxIds || []),
        ...(input.arweaveTxIds || []),
      ]));
    }

    env.agreements[merged.agrId] = merged;
    await writeEnvelope(env);
    console.log('[LocalAgr] Upsert', merged.agrId.slice(0, 16), 'step:', merged.step, 'origin:', merged.origin);
    return merged;
  });
}

/**
 * Advance progress. No-op (with warn) if the move would go backwards.
 * 'aborted' is only reachable through abortAgreement.
 */
export async function advanceStep(agrId: string, step: Exclude<AgrStep, 'aborted'>): Promise<LocalAgreement | null> {
  return locked(async () => {
    const env = await readEnvelope();
    const rec = env.agreements[agrId];
    if (!rec) { console.warn('[LocalAgr] advanceStep: unknown', agrId); return null; }
    if (rec.step === 'aborted') { console.warn('[LocalAgr] advanceStep on aborted', agrId, '- ignored'); return rec; }
    if (STEP_ORDER[step] < STEP_ORDER[rec.step]) {
      console.warn('[LocalAgr] step regression blocked:', rec.step, '->', step, agrId.slice(0, 16));
      return rec;
    }
    rec.step = step;
    rec.updatedAt = Date.now();
    await writeEnvelope(env);
    console.log('[LocalAgr] Step', agrId.slice(0, 16), '->', step);
    return rec;
  });
}

/** Terminal teardown. Record kept (audit trail), marked aborted. */
export async function abortAgreement(agrId: string, reason?: string): Promise<void> {
  return locked(async () => {
    const env = await readEnvelope();
    const rec = env.agreements[agrId];
    if (!rec) return;
    rec.step = 'aborted';
    rec.updatedAt = Date.now();
    if (reason) rec.description = (rec.description ? rec.description + ' | ' : '') + 'ABORT: ' + reason;
    await writeEnvelope(env);
    console.log('[LocalAgr] Aborted', agrId.slice(0, 16), reason || '');
  });
}

/** Single record. */
export async function getAgreement(agrId: string): Promise<LocalAgreement | null> {
  const env = await readEnvelope();
  return env.agreements[agrId] || null;
}

/** All records, newest first. */
export async function listAgreements(): Promise<LocalAgreement[]> {
  const env = await readEnvelope();
  return Object.values(env.agreements).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Non-terminal records, newest first — this is the device-local "inbox". */
export async function listActiveAgreements(): Promise<LocalAgreement[]> {
  return (await listAgreements()).filter(a => a.step !== 'complete' && a.step !== 'aborted');
}

/**
 * Verify-on-read helper. verifyFn = existing buyer-sig check over the raw
 * proposal body (same one the paste path uses). Updates the stored flag.
 * Records that FAIL verification are returned flagged, not deleted — the UI
 * should mark them; funding guards already re-check chain truth.
 */
export async function verifyAgreement(
  agrId: string,
  verifyFn: (proposalBody: string) => boolean | Promise<boolean>,
): Promise<{ record: LocalAgreement | null; ok: boolean }> {
  const rec = await getAgreement(agrId);
  if (!rec || !rec.proposalBody) return { record: rec, ok: false };
  let ok = false;
  try { ok = !!(await verifyFn(rec.proposalBody)); }
  catch (e) { console.warn('[LocalAgr] verify threw:', e); }
  if (ok !== rec.sigVerified) {
    await locked(async () => {
      const env = await readEnvelope();
      const r = env.agreements[agrId];
      if (r) { r.sigVerified = ok; r.updatedAt = Date.now(); await writeEnvelope(env); }
    });
  }
  if (!ok) console.warn('[LocalAgr] SIG-FAIL', agrId.slice(0, 16), '- record flagged, not hidden');
  return { record: { ...rec, sigVerified: ok }, ok };
}

/** Record an Arweave inscription tx against an agreement (set-union). */
export async function recordArweaveTx(agrId: string, txId: string): Promise<void> {
  if (!txId) return;
  await upsertAgreement({ agrId, arweaveTxIds: [txId] });
}

/** Wipe (testing / explicit user reset only). */
export async function clearAllAgreements(): Promise<void> {
  return locked(async () => {
    await AsyncStorage.removeItem(STORE_KEY);
    console.log('[LocalAgr] Cleared');
  });
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function definedOnly<T extends object>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}


// ============================================================================
// derivePhase(agrId) — L1-first phase derivation. The store REMEMBERS the step;
// this DERIVES the true phase from Layer 1 + the stored record.
// ============================================================================

export type DerivedPhase =
  | 'draft' | 'proposed' | 'agreed' | 'templates_ready' | 'cosigned'
  | 'seller_funded' | 'kill_dead' | 'fully_funded' | 'complete' | 'aborted' | 'unknown';

export interface PhaseResult {
  phase: DerivedPhase;
  balanceKas: number; utxoCount: number;
  totalKas: number; sellerKas: number; buyerKas: number;
  l1Ok: boolean; agrId: string; frostAddress: string;
}

function restBase(network: string | undefined): string {
  return (network || 'testnet-10').includes('testnet')
    ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
}

async function readEscrowL1(frostAddress: string, network: string | undefined): Promise<{ bal: number; count: number } | null> {
  if (!frostAddress) return null;
  try {
    const r = await fetch(restBase(network) + '/addresses/' + frostAddress + '/utxos');
    if (!r.ok) return null;
    const utxos = await r.json();
    if (!Array.isArray(utxos)) return null;
    const bal = utxos.reduce((sum: number, u: any) => sum + Number(u?.utxoEntry?.amount || '0'), 0);
    return { bal, count: utxos.length };
  } catch { return null; }
}

function near(value: number, target: number, tol = 0.05): boolean {
  if (target <= 0) return false;
  return Math.abs(value - target) <= target * tol;
}

function mapStoredStep(step: string | undefined): DerivedPhase {
  switch (step) {
    case 'proposed': return 'proposed';
    case 'agreed': return 'agreed';
    case 'templates_built': return 'templates_ready';
    case 'cosigned': return 'cosigned';
    case 'seller_funded': return 'seller_funded';
    case 'kill_broadcast': return 'kill_dead';
    case 'buyer_funded': return 'fully_funded';
    case 'complete': return 'complete';
    case 'aborted': return 'aborted';
    default: return 'proposed';
  }
}

export async function derivePhase(agrId: string): Promise<PhaseResult> {
  const rec = await getAgreement(agrId);
  const frostAddress = rec?.frostAddress || '';
  const network = rec?.network || 'testnet-10';
  const buyerKas = Number(rec?.buyerAmountSompi || 0) / 1e8;
  const sellerKas = Number(rec?.sellerAmountSompi || 0) / 1e8;
  const totalKas = buyerKas + sellerKas;
  const base = { balanceKas: 0, utxoCount: 0, totalKas, sellerKas, buyerKas, agrId, frostAddress };

  if (!rec) return { ...base, phase: 'unknown', l1Ok: false };
  if (rec.step === 'aborted') return { ...base, phase: 'aborted', l1Ok: false };

  const l1 = await readEscrowL1(frostAddress, network);
  if (!l1) return { ...base, phase: mapStoredStep(rec.step), l1Ok: false };

  const balanceKas = l1.bal / 1e8;
  const utxoCount = l1.count;
  const withL1 = { ...base, balanceKas, utxoCount };

  if (balanceKas === 0 && (rec.step === 'complete' || rec.step === 'buyer_funded')) {
    return { ...withL1, phase: 'complete', l1Ok: true };
  }
  if (near(balanceKas, totalKas) && utxoCount >= 2) {
    return { ...withL1, phase: 'fully_funded', l1Ok: true };
  }
  if (utxoCount === 1 && rec.killTxId && near(balanceKas, sellerKas) && rec.step === 'kill_broadcast') {
    return { ...withL1, phase: 'kill_dead', l1Ok: true };
  }
  if (near(balanceKas, sellerKas) && utxoCount === 1) {
    return { ...withL1, phase: 'seller_funded', l1Ok: true };
  }
  return { ...withL1, phase: mapStoredStep(rec.step), l1Ok: true };
}

export function routeForPhase(phase: DerivedPhase): 'inbox' | 'poll' | 'release' | 'done' | 'draft' {
  switch (phase) {
    case 'draft': return 'draft';
    case 'proposed': case 'agreed': case 'templates_ready': case 'cosigned': return 'inbox';
    case 'seller_funded': case 'kill_dead': return 'poll';
    case 'fully_funded': return 'release';
    case 'complete': case 'aborted': return 'done';
    default: return 'inbox';
  }
}

// ---------------------------------------------------------------------------
// DOSSIER: capture public ceremony payloads for copy-back. No secrets here.
// ---------------------------------------------------------------------------

/**
 * Record a public payload against an agreement's dossier. Safe to call at any
 * paste-in or create-out point. Stores raw text + direction + timestamp under
 * its kind. Last write per kind wins. Silently ignores empty text.
 * NEVER pass nonces, k, d_tweaked, or private keys - PUBLIC payloads only.
 */
export async function recordPayload(
  agrId: string,
  kind: PayloadKind,
  text: string,
  dir: 'in' | 'out',
): Promise<void> {
  if (!agrId || !text || !text.trim()) return;
  await locked(async () => {
    const env = await readEnvelope();
    const rec = env.agreements[agrId];
    if (!rec) { console.warn('[Dossier] recordPayload: unknown agr', agrId.slice(0, 16)); return; }
    const pp = rec.pastedPayloads || {};
    pp[kind] = { text: text.trim(), dir, at: Date.now() };
    rec.pastedPayloads = pp;
    rec.updatedAt = Date.now();
    await writeEnvelope(env);
    console.log('[Dossier] recorded', kind, dir, 'for', agrId.slice(0, 16));
  });
}

/** Read the dossier payloads for an agreement (public text only). */
export async function getPayloads(agrId: string): Promise<Partial<Record<PayloadKind, PastedPayload>>> {
  const rec = await getAgreement(agrId);
  return (rec && rec.pastedPayloads) ? rec.pastedPayloads : {};
}
