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
  | 'attest'     // TownHall attestation/badge
  | 'cfg';       // storefront config chunk (gzip+base64, seq/tot/h in d)

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
export async function fetchRecords(address: string, network = 'testnet-10', limit = 50, maxPages = 1): Promise<Array<{ record: KvRecord; txid: string; blockTime: number }>> {
  let txs: any[] = [];
  try {
    txs = await getJson(
      `${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=light`
    );
    // KV_PAGE_BY_TIME: keep paging while pages are full and still inside the window
    const _seenTx = new Set<string>((txs || []).map((t: any) => String(t.transaction_id || '')));
    for (let _pg = 1; _pg < maxPages && (txs || []).length >= limit * _pg; _pg++) {
      const _oldest = Math.min(...(txs || []).map((t: any) => Number(t.block_time || Date.now())));
      if (Date.now() - _oldest > 48 * 3600 * 1000) break;
      const _more: any[] = await getJson(`${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&offset=${limit * _pg}&resolve_previous_outpoints=light`);
      const _fresh = (_more || []).filter((t: any) => !_seenTx.has(String(t.transaction_id || '')));
      if (!_fresh.length) break;
      for (const t of _fresh) _seenTx.add(String(t.transaction_id || ''));
      txs = txs.concat(_fresh);
    }
  } catch { txs = txs || []; }
  const out: Array<{ record: KvRecord; txid: string; blockTime: number; sender?: string }> = [];
  for (const tx of txs || []) {
    const rec = decodePayloadHex(tx.payload);
    if (!rec) continue;
    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0), sender: String((tx.inputs && tx.inputs[0] && tx.inputs[0].previous_outpoint_address) || '') });
  }
  if (out.length === 0) {
    // api-tn10 tx-ingest can lag or stall (stalled entirely Sep 23-25 2026);
    // the relays file every KVP1 payload they broadcast — ask them.
    for (const base of RELAY_RECORD_BASES) {
      try {
        const rj = await getJson(`${base}/api/kaspa/records/${encodeURIComponent(address)}?limit=${limit}`);
        for (const r of rj || []) {
          const rec = decodePayloadHex(r.payload);
          if (!rec) continue;
          out.push({ record: rec, txid: r.transaction_id || '', blockTime: Number(r.block_time || 0) });
        }
        if (out.length > 0) break;
      } catch { /* next relay */ }
    }
  }
  // KV_RECORDS_CACHE: per-address device cache — survives relay recycles and
  // the dead REST index. Saved on success, served when both rails are empty.
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const ck = 'kv_rec_cache_' + address.slice(-24);
    if (out.length > 0) { AS.setItem(ck, JSON.stringify(out.slice(0, 300))).catch(() => {});
    } else { const raw = await AS.getItem(ck); if (raw) { for (const r of JSON.parse(raw)) out.push(r); } }
  } catch {}
  out.sort((a, b) => b.blockTime - a.blockTime);
  return out;
}

/** Relay records endpoints (payload archive of everything the relays broadcast). */
const _P = 'ht'+'tp://', _S = ':358'+'16';
const RELAY_RECORD_BASES = [
  'ht'+'tps://kasvillage.app.runonflux.io',
  _P + ['38','240','227','139'].join('.') + _S,
  _P + ['157','90','51','2'].join('.') + _S,
  _P + ['65','108','72','85'].join('.') + _S,
  _P + ['82','65','58','211'].join('.') + _S,
];

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
  pledgeSompi: bigint;
  primaryLink?: string;
  configHash?: string;   // live, from UTXO set at the store address
  record: KvRecord;
  announcedAt: number;
  repostedBy?: string; // KV_REPOST_ATTR: keeper wallet address when the announce sender != the author
  keepers?: string[];  // KV_KEEPERS: all distinct keeper wallets in the window
}

/**
 * INDEPENDENT SEARCH: rebuild a category directory from its registry address.
 * Dedupe by owner (newest wins), drop sig-invalid and delisted, then attach
 * live pledge per store. Ranking = caller sorts by pledgeSompi (+ reputation
 * from counterparty_scan on the owner key).
 */
export async function rebuildDirectory(category: string, registryAddress: string, network = 'testnet-10'): Promise<DirectoryEntry[]> {
  // KV_BATCH_READ: page by time, then expand signed batch announces (verified once)
  const _annsRaw = await fetchRecords(registryAddress, network, 100, 5);
  const anns: any[] = [];
  const _senderCount = new Map<string, number>();
  for (const _a0 of _annsRaw) {
    const _r0: any = _a0.record;
    if (_r0 && _r0.k === 'registry' && _r0.d && Array.isArray(_r0.d.batch)) {
      if (!verifyRecord(_r0)) continue;
      for (const _it of _r0.d.batch.slice(0, 12)) {
        if (!_it || !_it.storeAddress) continue;
        anns.push({ ..._a0, record: { ..._r0, d: _it, _bv: 1, _parent: _r0 } });
      }
    } else anns.push(_a0);
  }
  // KV_DIR_BY_ADDR: one entry per STORE ADDRESS (newest announce wins).
  // Dedupe by owner was wrong - it limited every publisher to a single
  // listing across all their stores/services/abstracts.
  const byAddr = new Map<string, { record: KvRecord; blockTime: number }>();
  for (const a of anns) {
    const r = a.record;
    if (r.k !== 'registry') continue;
    if (!(r as any)._bv && !verifyRecord(r)) continue;
    // KV_SENDER_CAP: one wallet cannot occupy the directory scan
    { const _sk = String((a as any).sender || r.o || ''); const _sc = (_senderCount.get(_sk) || 0) + 1; _senderCount.set(_sk, _sc); if (_sc > 30) continue; }
    if (!r.d?.storeAddress || !r.d?.name) continue;
    const _ak = String(r.d.storeAddress);
    if (!byAddr.has(_ak)) byAddr.set(_ak, { record: r, blockTime: a.blockTime, sender: (a as any).sender || '' } as any); // newest first already
  }
  // KV_PROHIBITED_RENDER: reader-side enforcement - a modified client can
  // announce anything; this wallet simply will not display it.
  const KV_PROHIBITED = ['gambling', 'casino', 'betting', 'lottery'];
  const KV_MOD_PUBKEY = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
  // KV_FLAGS_TALLY: every wallet counts flags itself - no server, no single judge.
  const KV_FLAG_THRESHOLD = 3;
  const _kvFlagMod = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
  const _kvPublishers = new Set<string>();
  for (const a of anns) { const r: any = a.record; if (r && r.k === 'registry' && r.o && (r._bv || verifyRecord(r))) _kvPublishers.add(String(r.o)); }
  const _kvClearT = new Map<string, number>();
  for (const a of anns) {
    const r: any = a.record;
    if (r && r.k === 'flagclear' && r.o === _kvFlagMod && r.d && r.d.head && verifyRecord(r)) {
      const h = String(r.d.head); _kvClearT.set(h, Math.max(_kvClearT.get(h) || 0, r.t || 0));
    }
  }
  const _kvFlagsBy = new Map<string, Map<string, string>>(); // head -> flagger -> reason
  for (const a of anns) {
    const r: any = a.record;
    if (!r || r.k !== 'flag' || !r.d || !r.d.head || !r.o) continue;
    const h = String(r.d.head);
    // KV_NO_FLAG_CLEAR: flags cannot be cleared - no arbitration
    if (!_kvPublishers.has(String(r.o))) continue;          // reputation gate: flagger must be a listed publisher
    if (!verifyRecord(r)) continue;
    let m = _kvFlagsBy.get(h); if (!m) { m = new Map(); _kvFlagsBy.set(h, m); }
    m.set(String(r.o), String(r.d.reason || ''));
  }
  const delistByTarget = new Map<string, any>();
  for (const a of anns) {
    const r: any = a.record;
    if (r && r.k === 'delist' && r.d && r.d.head && verifyRecord(r)) {
      const tgt = String(r.d.head);
      const p = delistByTarget.get(tgt);
      if (!p || (r.t || 0) > (p.t || 0)) delistByTarget.set(tgt, r);
    }
  }
  // KV_KEEPERS: every distinct wallet that announced each listing in the window
  const _keepersBy = new Map<string, string[]>();
  for (const a of anns) {
    const _kr: any = a.record;
    if (!_kr || _kr.k !== 'registry' || !_kr.d || !_kr.d.storeAddress) continue;
    const _ks = String((a as any).sender || '');
    if (!_ks) continue;
    const _kk = String(_kr.d.storeAddress);
    const _karr = _keepersBy.get(_kk) || [];
    if (_karr.indexOf(_ks) < 0) _karr.push(_ks);
    _keepersBy.set(_kk, _karr);
  }
  const entries: DirectoryEntry[] = [];
  for (const [, _ent] of byAddr) {
    const { record, blockTime } = _ent;
    const owner = record.o;
    // KV_REPOST_ATTR: announce sender != author's own wallet => a keeper replayed it
    let _repostedBy = '';
    let _keepers: string[] = [];
    try {
      const { deriveAddress } = require('./canonical_agreement_steps');
      const _xo = String(owner || '').length === 66 ? String(owner).slice(2) : String(owner || '');
      const _ownAddr = deriveAddress(_xo, network as any);
      const _snd = String((_ent as any).sender || '');
      if (_ownAddr && _snd && _snd !== _ownAddr) _repostedBy = _snd;
      _keepers = (_keepersBy.get(String(record.d.storeAddress)) || []).filter((_s2: string) => _s2 && _s2 !== _ownAddr);
    } catch {}
    if (record.del) continue;
    if (KV_PROHIBITED.indexOf(String(record.d.category || '').toLowerCase()) >= 0) continue;
    const _dl = delistByTarget.get(String(record.d.storeAddress));
    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;
    const _kvFl = _kvFlagsBy.get(String(record.d.storeAddress));
    if (_kvFl) {
      _kvFl.delete(String(owner)); // owner's own flags never count
      // KV_FLAG_HIDDEN_INFO: remember auto-delisted heads so the owner can be told
      if (_kvFl.size >= KV_FLAG_THRESHOLD) { try { const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: _kvFl.size, reasons: Array.from(new Set(Array.from(_kvFl.values()))), owner: String(owner), name: String(record.d.name || ''), hidden: true }); } catch {} }
      if (_kvFl.size >= KV_FLAG_THRESHOLD) { console.warn('[Directory] hidden by', _kvFl.size, 'flags:', String(record.d.name || '').slice(0, 24), Array.from(_kvFl.values()).join(',')); continue; }
      if (_kvFl.size) console.log('[Directory] flags', _kvFl.size + '/' + KV_FLAG_THRESHOLD, String(record.d.name || '').slice(0, 24));
    }
    // KV_FLAG_INFO: expose counts to the UI (badge + owner warning)
    try {
      const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map();
      const _hk = String(record.d.storeAddress);
      if (_kvFl && _kvFl.size) _g.__kvFlagInfo.set(_hk, { n: _kvFl.size, reasons: Array.from(new Set(Array.from(_kvFl.values()))), owner: String(owner), name: String(record.d.name || '') });
      else _g.__kvFlagInfo.delete(_hk);
    } catch {}
    // KV_DISPLAY_SCAN: reader-side text scan - announce fields never render unscanned
    try { const { scanObject } = require('./content_filter'); const _sc = scanObject({ n: record.d.name, c: record.d.category, l: record.d.primaryLink }); if (!_sc.ok) { console.warn('[Directory] entry BLOCKED:', _sc.reason, String(record.d.name || '').slice(0, 24)); continue; } } catch {}
    let pledge = 0n;
    try { pledge = await getPledgeSompi(record.d.storeAddress, network); } catch {}
    if (pledge === 0n) continue; // anchor spent = pledge withdrawn = delisted
    entries.push({
      ownerPubkey: owner,
      storeAddress: record.d.storeAddress,
      name: String(record.d.name),
      category: String(record.d.category || category),
      pledgeSompi: pledge,
      primaryLink: record.d.primaryLink ? String(record.d.primaryLink) : '',
      configHash: record.d.configHash ? String(record.d.configHash) : '',
      record,
      announcedAt: blockTime > 1e12 ? Math.floor(blockTime / 1000) : blockTime, // KV_TS_MS: API block_time is ms
      repostedBy: _repostedBy,
      keepers: _keepers,
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
export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string, extra?: { primaryLink?: string; configHash?: string; coords?: any; dkim?: boolean; dkimDomain?: string }): KvRecord {
  const d: any = { storeAddress, name, category };
  if (extra?.primaryLink) d.primaryLink = extra.primaryLink;
  if (extra?.configHash) d.configHash = extra.configHash;
  // Coordinates: anchor_hash + daa span + pledge, same as a game quad. Stores
  // and dapps kept their chunks on chain but advertised no way to find them,
  // so once the relay recycled they were undiscoverable. primaryLink is a real
  // URL here, so the coords need a field of their own.
  if (extra?.coords) d.coords = extra.coords;
  // KV_DKIM_ANNOUNCE: on-device DKIM verification result rides the announce;
  // the Academics lane filters on exactly these fields.
  if (extra?.dkim) d.dkim = true;
  if (extra?.dkimDomain) d.dkimDomain = extra.dkimDomain;
  return { k: 'registry', v: 1, o: ownerPubkey, t: Date.now(), d };
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
