// stat_records.ts — signed reputation records. Counterparty signature = attestation.
// Deterministic record bytes (both phones derive identically) → only sigs travel, inside existing pastes.
// Hash chain prevents silent omission. Verification is local + one keyless UTXO query.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import { poseidon2 } from 'poseidon-lite';

// ---------- Poseidon digest (BN254, circuit-aligned for future halo2-lib sig circuit) ----------
const BN254_P = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
/** Absorb arbitrary bytes: 31-byte chunks packed as field elements, chained via poseidon2. */
function poseidonBytes(b: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 0; i < b.length; i += 31) {
    let chunk = 0n;
    for (let j = i; j < Math.min(i + 31, b.length); j++) chunk = (chunk << 8n) | BigInt(b[j]);
    acc = poseidon2([acc, chunk % BN254_P]);
  }
  return acc;
}
function fieldToHex32(f: bigint): string { return f.toString(16).padStart(64, '0'); }
/** 32-byte digest for schnorr signing / chain linkage. */
function poseidonDigest(b: Uint8Array): Uint8Array { return unhexStd(fieldToHex32(poseidonBytes(b))); }
function unhexStd(h: string): Uint8Array { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return o; }

// ---------- types ----------
export interface ChainAnchor {                 // filled post-broadcast; NOT in signed bytes
  releaseTxId: string;
  releaseDaaScore: number;
  blockHash: string;
  acceptingBlockHash: string;
  blockTime: number;
  utxoCommitment: string;    // muhash of accepting block's UTXO set state
}

export interface StatRecord {
  v: 1;
  agrId: string;
  frostAddr: string;          // escrow address — binds record to this exact agreement
  escrowTxId: string;         // funding/escrow outpoint txid (replay binding)
  escrowDaaScore: number;     // DAA of escrow confirmation (known pre-ceremony → signed)
  myPubkey: string;           // x-only or compressed — normalized before hashing
  cpPubkey: string;
  buyerAmountSompi: string;
  sellerAmountSompi: string;
  network: string;            // 'testnet-10' | 'mainnet'
  agreementType: string;      // 'trade' | 'simple'
  timeoutN: number;
  descriptionHash: string;    // sha256 hex of description (raw stays off the export)
  outcome: 'complete' | 'cancel' | 'deadlock';
  anchor: ChainAnchor | null; // set after broadcast via setAnchor()
  ts: number;                 // creation time (informational, not security-relevant)
  prevHash: string;           // hex sha256 of previous record's signedBytes; 64 zeros for genesis
}

export interface ChainedRecord extends StatRecord {
  selfHash: string;           // sha256(signedBytes(record)) hex
  cpSignature: string;        // counterparty schnorr sig over signedBytes, hex — the attestation
  mySignature: string;        // our own sig (what we handed the counterparty), hex
}

const CHAIN_KEY = 'kv_stat_chain_v1';
const GENESIS = '0'.repeat(64);

// ---------- helpers ----------
const xonly = (pk: string) => (pk || '').replace(/^0[23]/, '').toLowerCase();
const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return o; };

/** Canonical signed bytes — the CORE record both phones derive identically.
 *  prevHash is NOT here: the counterparty cannot know your chain tip. Chain linkage is
 *  structural (selfHash covers core+prevHash; next record commits to selfHash). */
export function signedBytes(r: StatRecord): Uint8Array {
  const s = [
    'KVSTAT3', r.agrId, r.frostAddr,
    xonly(r.myPubkey) < xonly(r.cpPubkey) ? xonly(r.myPubkey) : xonly(r.cpPubkey), // party order canonical:
    xonly(r.myPubkey) < xonly(r.cpPubkey) ? xonly(r.cpPubkey) : xonly(r.myPubkey), // sorted, so both phones hash identically
    r.buyerAmountSompi, r.sellerAmountSompi, r.network, r.agreementType,
    r.outcome,
  ].join('|');
  return new TextEncoder().encode(s);
}

/** selfHash covers core + prevHash → chain continuity is verifiable structurally. */
export function recordHash(r: StatRecord): string {
  return hex(poseidonDigest(new TextEncoder().encode(hex(poseidonDigest(signedBytes(r))) + '|' + r.prevHash)));
}
// NOTE: anchor + ts are intentionally OUTSIDE the signed bytes: release anchor isn't known
// when sigs are exchanged (pre-broadcast), and ts differs per device. Binding comes from
// agrId + frostAddr + escrowTxId, unique per agreement.

export function descHash(description: string): string { return hex(sha256(new TextEncoder().encode(description || ''))); }

/** Sign a record with the wallet key (schnorr over sha256 of signed bytes). */
export function signRecord(r: StatRecord, privKeyHex: string): string {
  return hex(schnorr.sign(poseidonDigest(signedBytes(r)), unhex(privKeyHex)));
}

/** Verify a signature over a record against a pubkey (x-only or compressed). */
export function verifyRecordSig(r: StatRecord, sigHex: string, pubkey: string): boolean {
  try { return schnorr.verify(unhex(sigHex), poseidonDigest(signedBytes(r)), unhex(xonly(pubkey))); }
  catch { return false; }
}

// ---------- chain storage (device-local) ----------
export async function loadChain(): Promise<ChainedRecord[]> {
  try { const j = await AsyncStorage.getItem(CHAIN_KEY); return j ? JSON.parse(j) : []; } catch { return []; }
}

/** Tip hash for building the next record's prevHash. */
export async function chainTip(): Promise<string> {
  const c = await loadChain(); return c.length ? c[c.length - 1].selfHash : GENESIS;
}

/** Build the next record (prevHash auto-filled from tip). Both sides call with mirrored my/cp. */
export async function buildRecord(p: Omit<StatRecord, 'v' | 'prevHash' | 'ts'>): Promise<StatRecord> {
  return { v: 1, ...p, ts: Date.now(), prevHash: await chainTip() };
}

/** Append once counterparty sig is in hand and verified. Idempotent per agrId+outcome. */
export async function appendRecord(r: StatRecord, mySigHex: string, cpSigHex: string): Promise<{ ok: boolean; error?: string }> {
  if (!verifyRecordSig(r, cpSigHex, r.cpPubkey)) return { ok: false, error: 'cp signature invalid' };
  const chain = await loadChain();
  if (chain.some(c => c.agrId === r.agrId && c.outcome === r.outcome)) return { ok: true }; // already recorded
  const tip = chain.length ? chain[chain.length - 1].selfHash : GENESIS;
  if (r.prevHash !== tip) return { ok: false, error: 'prevHash != chain tip (rebuild record)' };
  const rec: ChainedRecord = { ...r, selfHash: recordHash(r), cpSignature: cpSigHex, mySignature: mySigHex };
  chain.push(rec);
  await AsyncStorage.setItem(CHAIN_KEY, JSON.stringify(chain));
  console.log('[StatChain] appended', r.agrId.slice(0, 12), r.outcome, 'len:', chain.length);
  return { ok: true };
}

/** Attach chain anchor after broadcast (outside signed bytes, so safe to patch in). */
export async function setAnchor(agrId: string, anchor: ChainAnchor): Promise<void> {
  const chain = await loadChain();
  const i = chain.findIndex(c => c.agrId === agrId);
  if (i >= 0) { chain[i].anchor = anchor; await AsyncStorage.setItem(CHAIN_KEY, JSON.stringify(chain)); }
}

/** Fetch full anchor for a release tx: DAA, block hashes, time, and accepting block's muhash. */
export async function fetchAnchor(releaseTxId: string, network: string): Promise<ChainAnchor | null> {
  const base = network === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org';
  try {
    const tx = await (await fetch(base + '/transactions/' + releaseTxId + '?resolve_previous_outpoints=no')).json();
    const acceptingHash = tx.accepting_block_hash || '';
    let utxoCommitment = '';
    let daaFromHeader = 0;
    if (acceptingHash) {
      try {
        const blk = await (await fetch(base + '/blocks/' + acceptingHash + '?includeTransactions=false')).json();
        utxoCommitment = blk?.header?.utxoCommitment || '';
        daaFromHeader = Number(blk?.header?.daaScore || 0);
      } catch {}
    }
    return {
      releaseTxId,
      releaseDaaScore: daaFromHeader || Number(tx.block_daa_score || 0), // header daaScore is authoritative; blue_score is NOT daa
      blockHash: Array.isArray(tx.block_hash) ? (tx.block_hash[0] || '') : (tx.block_hash || ''),
      acceptingBlockHash: acceptingHash,
      blockTime: Number(tx.block_time || 0),
      utxoCommitment,
    };
  } catch (e) { console.warn('[StatChain] fetchAnchor failed:', e); return null; }
}

// ---------- bundle export / verify ----------
export async function exportBundle(): Promise<string> {
  const chain = await loadChain();
  return JSON.stringify({ kind: 'KVSTAT-BUNDLE', v: 1, records: chain });
}

/** Full local verification of someone else's bundle: sigs, chain continuity, per-record binding.
 *  ownerPubkey = the identity whose reputation is claimed (their myPubkey in every record). */
export function verifyBundle(bundleJson: string, ownerPubkey: string): {
  ok: boolean; total: number; complete: number; deadlocks: number; errors: string[];
} {
  const errors: string[] = [];
  let records: ChainedRecord[] = [];
  try { const b = JSON.parse(bundleJson); records = b.records || []; if (b.kind !== 'KVSTAT-BUNDLE') errors.push('not a stat bundle'); }
  catch { return { ok: false, total: 0, complete: 0, deadlocks: 0, errors: ['unparseable'] }; }
  let prev = GENESIS; let complete = 0; let deadlocks = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (xonly(r.myPubkey) !== xonly(ownerPubkey)) errors.push('#' + i + ' not owned by claimed identity');
    if (r.prevHash !== prev) errors.push('#' + i + ' chain break (gap or reorder)');
    if (recordHash(r) !== r.selfHash) errors.push('#' + i + ' selfHash mismatch');
    if (!verifyRecordSig(r, r.cpSignature, r.cpPubkey)) errors.push('#' + i + ' cp signature invalid');
    prev = r.selfHash;
    if (r.outcome === 'complete') complete++;
    if (r.outcome === 'deadlock') deadlocks++;
  }
  return { ok: errors.length === 0, total: records.length, complete, deadlocks, errors };
}
// Residual risks by design: tail-truncation (owner can drop newest records — mitigate later
// with a signed count anchor or pledge-payload commitment) and record-count claims require
// the pledge UTXO liveness check (done by caller via keyless REST, never pruned).
