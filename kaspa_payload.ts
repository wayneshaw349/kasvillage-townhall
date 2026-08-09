// ============================================================================
// KASPA PAYLOAD RAIL — foundation module
// ============================================================================
// The content layer for KasVillage on Kaspa L1: identity, storefronts, DApps,
// games, academics, services. Replaces Arweave (402-dead) as primary rail.
//
// MODEL:
//   record  = JSON payload on a Kaspa tx
//   anchor  = the UNSPENT UTXO created by that tx at a derived address
//   pledge  = sum of unspent sompi at the address (trust = locked capital)
//   update  = new tx to same address, newest sig-valid payload wins
//   delist  = spend your anchors (pledge -> 0) or payload {delist:true}
//   search  = walk a well-known registry address, rebuild directory trustlessly
//
// This module is READ-complete standalone. WRITE side exposes
// buildPayloadHex(); the existing tx sender attaches it (payload field on
// the REST submit JSON) — wiring is a separate small patch to the sender.
//
// Payload size: records target <= PAYLOAD_SOFT_MAX bytes. Actual node limit
// must be probed once on testnet-10 (see probePayloadLimit note at bottom).
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

export const KV_MAGIC = 'KVP1'; // 4-byte marker, version 1
export const PAYLOAD_SOFT_MAX = 2000; // bytes of JSON per record — probe-verified on testnet-10 (2000B accepted, tx a2805928ce16)

export type KvKind =
  | 'identity'
  | 'store'
  | 'dapp'
  | 'game'
  | 'academic'
  | 'service'
  | 'registry'   // announce record sent to a registry address
  | 'attest';    // TownHall attestation/badge

export interface KvRecord {
  k: KvKind;          // kind
  v: number;          // schema version for this kind
  o: string;          // owner pubkey (33-byte compressed hex)
  t: number;          // unix ms timestamp
  d: any;             // kind-specific data (catalog, identity fields, board, ...)
  del?: boolean;      // delist flag
  sig?: string;       // schnorr sig over canonical body (added by signRecord)
}

// ---------------------------------------------------------------------------
// NETWORK
// ---------------------------------------------------------------------------

const API: Record<string, string> = {
  'testnet-10': 'https://api-tn10.kaspa.org',
  'mainnet': 'https://api.kaspa.org',
};
export const apiBase = (network: string) => API[network] || API['testnet-10'];

// ---------------------------------------------------------------------------
// CANONICALIZATION + SIGNING
// ---------------------------------------------------------------------------
// Canonical form: JSON with sorted keys, sig field excluded. Sign sha256 of it
// with the x-only schnorr key. Verification never trusts the tx alone — but
// note: the tx INPUT already proves key control for self-sent anchors; the
// explicit sig additionally lets third parties (TownHall, relayers) submit a
// seller's record on their behalf without being able to forge content.

function canonJson(x: any): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(canonJson).join(',') + ']';
  const keys = Object.keys(x).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonJson(x[k])).join(',') + '}';
}

export function canonicalBody(r: KvRecord): string {
  const { sig, ...body } = r;
  return canonJson(body);
}

export function signRecord(r: KvRecord, privkeyHex: string): KvRecord {
  const msg = sha256(utf8ToBytes(canonicalBody(r)));
  const sig = bytesToHex(schnorr.sign(msg, hexToBytes(privkeyHex)));
  return { ...r, sig };
}

export function verifyRecord(r: KvRecord): boolean {
  if (!r.sig || !r.o) return false;
  try {
    const msg = sha256(utf8ToBytes(canonicalBody(r)));
    const xonly = r.o.length === 66 ? r.o.slice(2) : r.o; // strip 02/03 parity
    return schnorr.verify(hexToBytes(r.sig), msg, hexToBytes(xonly));
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// PAYLOAD ENCODE / DECODE
// ---------------------------------------------------------------------------
// Wire format: KV_MAGIC (ascii) + JSON (utf8), hex-encoded for the REST
// "payload" field. Decode is tolerant: returns null on anything foreign.

export function buildPayloadHex(r: KvRecord): string {
  const json = JSON.stringify(r);
  const bytes = utf8ToBytes(KV_MAGIC + json);
  if (bytes.length > PAYLOAD_SOFT_MAX + KV_MAGIC.length) {
    throw new Error(`payload ${bytes.length}B exceeds soft max ${PAYLOAD_SOFT_MAX}B — split the record (games: one board per tx)`);
  }
  return bytesToHex(bytes);
}

export function decodePayloadHex(hex: string | null | undefined): KvRecord | null {
  if (!hex) return null;
  try {
    const bytes = hexToBytes(hex);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    // utf8-safe decode
    s = decodeURIComponent(escape(s));
    if (!s.startsWith(KV_MAGIC)) return null;
    const r = JSON.parse(s.slice(KV_MAGIC.length));
    if (!r || typeof r !== 'object' || !r.k || !r.o) return null;
    return r as KvRecord;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// ADDRESS DERIVATION
// ---------------------------------------------------------------------------
// Registry addresses: hash of a fixed string -> x-only pubkey point is NOT
// needed; we need a spendable-by-no-one anchor target. Simplest sound scheme:
// take sha256(tag) as the 32-byte "x-only pubkey" for a P2PK address. With
// overwhelming probability no one knows a discrete log for it — funds sent
// there are burned dust, which is exactly what a registry announce costs.
// Store addresses: derived from the OWNER's key so the owner CAN reclaim
// pledge (spending = delisting): sha256(ownerPubkey || "KV-STORE" || nonce)
// is used as a tweak the caller applies via their existing FROST-style
// derivation. This module only computes the tweak; address construction
// reuses the app's deriveAddress (single implementation rule: never
// reconstruct pubkeys from addresses).

export function registryTag(category: string): string {
  return `KV-REGISTRY-V1-${category.toLowerCase()}`;
}

export function registryXOnly(category: string): string {
  return bytesToHex(sha256(utf8ToBytes(registryTag(category))));
}

export function storeTweak(ownerPubkeyHex: string, nonce: number): string {
  return bytesToHex(sha256(utf8ToBytes(ownerPubkeyHex + 'KV-STORE-V1' + String(nonce))));
}

// ---------------------------------------------------------------------------
// READ SIDE — fully functional standalone against api-tn10
// ---------------------------------------------------------------------------

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/** Live pledge = sum of unspent sompi at an address. One call, trustless. */
export async function getPledgeSompi(address: string, network = 'testnet-10'): Promise<bigint> {
  const utxos = await getJson(`${apiBase(network)}/addresses/${encodeURIComponent(address)}/utxos`);
  let sum = 0n;
  for (const u of utxos || []) {
    const amt = u?.utxoEntry?.amount ?? u?.amount ?? 0;
    sum += BigInt(String(amt));
  }
  return sum;
}

/** All decoded KV records in an address's tx history, newest first. */
export async function fetchRecords(address: string, network = 'testnet-10', limit = 50): Promise<Array<{ record: KvRecord; txid: string; blockTime: number }>> {
  const txs = await getJson(
    `${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=light`
  );
  const out: Array<{ record: KvRecord; txid: string; blockTime: number }> = [];
  for (const tx of txs || []) {
    const rec = decodePayloadHex(tx.payload);
    if (!rec) continue;
    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0) });
  }
  out.sort((a, b) => b.blockTime - a.blockTime);
  return out;
}

/** Current content for a store/dapp/game/identity address: newest sig-valid record per kind. */
export async function resolveCurrent(address: string, network = 'testnet-10'): Promise<Partial<Record<KvKind, KvRecord>>> {
  const all = await fetchRecords(address, network);
  const current: Partial<Record<KvKind, KvRecord>> = {};
  for (const { record } of all) {           // newest first
    if (current[record.k]) continue;         // already have newest of this kind
    if (!verifyRecord(record)) continue;     // sig-invalid: ignore, keep looking
    if (record.del) { current[record.k] = record; continue; } // delist is terminal
    current[record.k] = record;
  }
  return current;
}

export interface DirectoryEntry {
  ownerPubkey: string;
  storeAddress: string;
  name: string;
  category: string;
  pledgeSompi: bigint;   // live, from UTXO set at the store address
  record: KvRecord;
  announcedAt: number;
}

/**
 * INDEPENDENT SEARCH: rebuild a category directory from its registry address.
 * Dedupe by owner (newest wins), drop sig-invalid and delisted, then attach
 * live pledge per store. Ranking = caller sorts by pledgeSompi (+ reputation
 * from counterparty_scan on the owner key).
 */
export async function rebuildDirectory(category: string, registryAddress: string, network = 'testnet-10'): Promise<DirectoryEntry[]> {
  const anns = await fetchRecords(registryAddress, network, 100);
  const byOwner = new Map<string, { record: KvRecord; blockTime: number }>();
  for (const a of anns) {
    const r = a.record;
    if (r.k !== 'registry') continue;
    if (!verifyRecord(r)) continue;
    if (!r.d?.storeAddress || !r.d?.name) continue;
    if (!byOwner.has(r.o)) byOwner.set(r.o, { record: r, blockTime: a.blockTime }); // newest first already
  }
  const entries: DirectoryEntry[] = [];
  for (const [owner, { record, blockTime }] of byOwner) {
    if (record.del) continue;
    let pledge = 0n;
    try { pledge = await getPledgeSompi(record.d.storeAddress, network); } catch {}
    if (pledge === 0n) continue; // anchor spent = pledge withdrawn = delisted
    entries.push({
      ownerPubkey: owner,
      storeAddress: record.d.storeAddress,
      name: String(record.d.name),
      category: String(record.d.category || category),
      pledgeSompi: pledge,
      record,
      announcedAt: blockTime,
    });
  }
  entries.sort((a, b) => (b.pledgeSompi > a.pledgeSompi ? 1 : b.pledgeSompi < a.pledgeSompi ? -1 : 0));
  return entries;
}

// ---------------------------------------------------------------------------
// WRITE-SIDE HELPERS (attachment happens in the existing tx sender)
// ---------------------------------------------------------------------------

/** Announce record for a registry address. Sign, then buildPayloadHex, then
 *  the sender sends dust to the registry address with this payload. */
export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string): KvRecord {
  return { k: 'registry', v: 1, o: ownerPubkey, t: Date.now(), d: { storeAddress, name, category } };
}

/** Content record for the store address itself (catalog, identity, board...). */
export function makeContentRecord(kind: KvKind, ownerPubkey: string, data: any): KvRecord {
  return { k: kind, v: 1, o: ownerPubkey, t: Date.now(), d: data };
}

export function makeDelist(kind: KvKind, ownerPubkey: string): KvRecord {
  return { k: kind, v: 1, o: ownerPubkey, t: Date.now(), d: {}, del: true };
}

// ---------------------------------------------------------------------------
// PROBE NOTE (run once on testnet-10, then set PAYLOAD_SOFT_MAX for real):
// submit a self-send with payloads of 500 / 1000 / 5000 / 10000 bytes and
// record which sizes the node accepts and what the mass/fee cost is. Games
// chunking (one board per tx) is designed assuming ~1KB is safe.
// ---------------------------------------------------------------------------
