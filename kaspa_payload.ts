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
export const apiBase = (network: string) => API[network] || API[require('./kv_net').KV_NET];

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
    if (!r || typeof r !== 'object' || Array.isArray(r) || !r.k || !r.o) return null;
    return kvStripInternal(r) as KvRecord;
  } catch { return null; }
}

// KV_STRIP_INTERNAL: reader-side marker fields (_bv "batch-verified", _parent
// "original signed batch") must never be trusted from chain JSON - a poster
// could set _bv:1 to skip signature checks. Chain/cache records lose them on
// decode; batch-verified expansions are tracked in a WeakSet instead.
const KV_INTERNAL_KEYS = ['_bv', '_parent'];
export function kvStripInternal<T>(r: T): T {
  if (r && typeof r === 'object') for (const k of KV_INTERNAL_KEYS) { if (Object.prototype.hasOwnProperty.call(r, k)) delete (r as any)[k]; }
  return r;
}
const _kvBatchVerified = new WeakSet<object>();
const _kvSigOk = (r: any): boolean => !!r && typeof r === 'object' && (_kvBatchVerified.has(r) || verifyRecord(r));

// KV_INFLATE_CAP: streaming inflate with a running output-size check (zip-bomb
// guard). Throws once output exceeds maxOut; never allocates past ~maxOut+64KB.
export const KV_PAGE_MAX_DECOMPRESSED = 2 * 1024 * 1024;   // pages / store configs / manifests
export const KV_GAME_MAX_TOTAL = 16 * 1024 * 1024;         // whole game (all fragments)
export function kvInflateCapped(bytes: Uint8Array, maxOut: number): Uint8Array {
  const pako = require('pako');
  const inf: any = new pako.Inflate();
  const parts: Uint8Array[] = []; let total = 0;
  inf.onData = (c: Uint8Array) => { total += c.length; if (total > maxOut) throw new Error('decompressed size exceeds ' + maxOut + ' bytes'); parts.push(c.slice()); };
  inf.onEnd = (st: number) => { inf.err = st; };
  const STEP = 16384;
  if (!bytes.length) throw new Error('empty input');
  for (let i = 0; i < bytes.length; i += STEP) {
    inf.push(bytes.subarray(i, i + STEP), i + STEP >= bytes.length);
    if (inf.err) throw new Error('inflate: ' + (inf.msg || inf.err));
  }
  if (!inf.ended) throw new Error('inflate: truncated stream');
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export function kvB64ToBytes(b64: string): Uint8Array {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const s2 = String(b64 || '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor(s2.length * 3 / 4)); let n = 0;
  let buf = 0, bits = 0;
  for (let i = 0; i < s2.length; i++) { buf = ((buf << 6) | abc.indexOf(s2[i])) & 0xffffff; bits += 6; if (bits >= 8) { bits -= 8; out[n++] = (buf >> bits) & 255; } }
  return n === out.length ? out : out.slice(0, n);
}
/** b64(gzip/zlib) -> utf8 text, bounded. */
export function kvInflateB64Text(b64: string, maxOut: number): string {
  return new TextDecoder().decode(kvInflateCapped(kvB64ToBytes(b64), maxOut));
}
/** KV_WALK_PAYTO: does a walked tx pay `addr`? null = outputs not exposed by the source (unknown). */
export function kvTxPaysAddress(tx: any, addr?: string): boolean | null {
  if (!addr) return null;
  const outs: any[] | undefined = tx && Array.isArray(tx.outputs) ? tx.outputs : undefined;
  if (!outs || !outs.length) return null; // KV_OUTS_EMPTY: no output data = unknown, not 'pays elsewhere'
  for (const o of outs) {
    const a = o && (o.script_public_key_address || o.address || (o.verboseData && o.verboseData.scriptPublicKeyAddress) || (o.verbose_data && o.verbose_data.script_public_key_address));
    if (a && String(a) === String(addr)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// KV_CHUNK_CANDIDATES: hash-driven chunk reassembly (anti chunk-spam)
// ---------------------------------------------------------------------------
// Anyone can send a dust tx carrying {seq, tot, h, c} to a store/slot address
// with any `t`. "Newest record per seq" let one junk tx break every fresh
// install with "hash mismatch". Instead: keep only signature-valid records
// (and, when the caller knows it, only those signed by the expected owner),
// then try candidate groupings until the inflated content hashes to h.
// `recs` must be in CHAIN order, oldest first (block time / walk order - never
// the attacker-chosen `t`): junk can only be posted after h is public, so the
// original publish is tried first. Bounded by `maxAttempts` decode+hash tries.
export function kvAssembleChunks(
  recs: any[],
  expectedHash: string,
  decode: (b64: string) => string,
  opts?: { ownerPub?: string; maxAttempts?: number; maxChunkChars?: number },
): { text: string | null; error?: string } {
  const maxAttempts = Math.max(1, Math.min(256, (opts && opts.maxAttempts) || 64));
  // KV_INFLATE_CAP: bound the joined chunk text (compressed b64) before any decode;
  // callers' decode() bounds the decompressed size. Default ~3 MB of b64.
  const maxChunkChars = Math.max(1, (opts && opts.maxChunkChars) || 3_000_000);
  let oversize = false;
  const xo = (p: any) => String(p || '').toLowerCase().replace(/^0[23](?=[0-9a-f]{64}$)/, '');
  const ownerX = opts && opts.ownerPub ? xo(opts.ownerPub) : '';
  const ok: Array<{ r: any; ord: number }> = [];
  for (let i = 0; i < (recs || []).length; i++) {
    const r = recs[i]; const d = r && r.d;
    if (!d || d.h !== expectedHash || typeof d.c !== 'string' || d.c.length > 65536) continue;
    if (!Number.isInteger(d.seq) || !Number.isInteger(d.tot) || d.tot < 1 || d.tot > 4096 || d.seq < 0 || d.seq >= d.tot) continue;
    if (ownerX && xo(r.o) !== ownerX) continue;
    if (!verifyRecord(r)) continue;
    ok.push({ r, ord: i });
  }
  if (!ok.length) return { text: null, error: 'no signed chunks' + (ownerX ? ' from owner' : '') };
  let attempts = 0, sawComplete = false, best = 0, bestTot = 0;
  const tryOne = (parts: string[]): string | null => {
    let n = 0; for (const p of parts) n += p.length;
    if (n > maxChunkChars) { oversize = true; attempts++; return null; }
    attempts++;
    try { const txt = decode(parts.join('')); if (bytesToHex(sha256(utf8ToBytes(txt))) === expectedHash) return txt; } catch {}
    return null;
  };
  // per-seq candidate lists (deduped by content, chain order)
  const lists = (rs: Array<{ r: any; ord: number }>, tot: number): string[][] | null => {
    const per: string[][] = Array.from({ length: tot }, () => []);
    for (const { r } of rs) { const L = per[r.d.seq]; if (L.indexOf(r.d.c) < 0) L.push(r.d.c); }
    const have = per.filter((L) => L.length).length;
    if (have > best) { best = have; bestTot = tot; }
    return have < tot ? null : per;
  };
  // odometer over candidates (seq 0 varies fastest), bounded by maxAttempts
  const search = (cands: string[][]): string | null => {
    const idx = new Array(cands.length).fill(0);
    while (attempts < maxAttempts) {
      const hit = tryOne(cands.map((L, i) => L[idx[i]]));
      if (hit !== null) return hit;
      let k = 0;
      while (k < idx.length) { idx[k]++; if (idx[k] < cands[k].length) break; idx[k] = 0; k++; }
      if (k === idx.length) return null;
    }
    return null;
  };
  // group by tot; within a tot try each signer's own set first (a publish or a
  // keeper repost is one signer), then the mixed set. Earliest group first.
  const first = (rs: Array<{ ord: number }>) => rs.reduce((m, x) => Math.min(m, x.ord), Number.MAX_SAFE_INTEGER);
  const byTot = new Map<number, Array<{ r: any; ord: number }>>();
  for (const x of ok) { const L = byTot.get(x.r.d.tot) || []; L.push(x); byTot.set(x.r.d.tot, L); }
  for (const rs of Array.from(byTot.values()).sort((a, b) => first(a) - first(b))) {
    const tot = rs[0].r.d.tot;
    const bySigner = new Map<string, Array<{ r: any; ord: number }>>();
    for (const x of rs) { const k = xo(x.r.o); const L = bySigner.get(k) || []; L.push(x); bySigner.set(k, L); }
    const groups = Array.from(bySigner.values()).sort((a, b) => first(a) - first(b));
    if (groups.length > 1) groups.push(rs);
    for (const g of groups) {
      if (attempts >= maxAttempts) break;
      const c = lists(g, tot);
      if (!c) continue;
      sawComplete = true;
      const hit = search(c);
      if (hit !== null) return { text: hit };
    }
  }
  if (!sawComplete) return { text: null, error: 'incomplete: ' + best + '/' + bestTot + ' chunks' };
  if (oversize) return { text: null, error: 'chunk set too large (> ' + maxChunkChars + ' chars)' };
  return { text: null, error: 'hash mismatch - tampered or corrupt' + (attempts >= maxAttempts ? ' (gave up after ' + attempts + ' tries)' : '') };
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
export async function getPledgeSompi(address: string, network = require('./kv_net').KV_NET): Promise<bigint> {
  const utxos = await getJson(`${apiBase(network)}/addresses/${encodeURIComponent(address)}/utxos`);
  let sum = 0n;
  for (const u of utxos || []) {
    const amt = u?.utxoEntry?.amount ?? u?.amount ?? 0;
    sum += BigInt(String(amt));
  }
  return sum;
}

/** All decoded KV records in an address's tx history, newest first. */
export async function fetchRecords(address: string, network = require('./kv_net').KV_NET, limit = 50, maxPages = 1): Promise<Array<{ record: KvRecord; txid: string; blockTime: number }>> {
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
    } else { const raw = await AS.getItem(ck); if (raw) { for (const r of JSON.parse(raw)) { if (r && r.record && typeof r.record === 'object') { kvStripInternal(r.record); out.push(r); } } } }
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
export async function resolveCurrent(address: string, network = require('./kv_net').KV_NET): Promise<Partial<Record<KvKind, KvRecord>>> {
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
 * One entry per store address, owned by its first signer in chain order
 * (KV_STORE_OWNER), newest announce from that owner; drop sig-invalid and delisted, then attach
 * live pledge per store. Ranking = caller sorts by pledgeSompi (+ reputation
 * from counterparty_scan on the owner key).
 */
export async function rebuildDirectory(category: string, registryAddress: string, network = require('./kv_net').KV_NET): Promise<DirectoryEntry[]> {
  // KV_BATCH_READ: page by time, then expand signed batch announces (verified once)
  const _annsRaw = await fetchRecords(registryAddress, network, 100, 5);
  // KV_CHAIN_ORDER: fetchRecords is newest-first; every ownership / first-N
  // decision below walks CHAIN order (oldest first).
  const anns: any[] = [];
  const _senderCount = new Map<string, number>();
  for (const _a0 of _annsRaw.slice().reverse()) {
    const _r0: any = _a0.record;
    if (_r0 && _r0.k === 'registry' && _r0.d && Array.isArray(_r0.d.batch)) {
      if (!verifyRecord(_r0)) continue;
      for (const _it of _r0.d.batch.slice(0, 12)) {
        if (!_it || !_it.storeAddress) continue;
        const _ex: any = { ..._r0, d: _it, _parent: _r0 };
        _kvBatchVerified.add(_ex); // KV_STRIP_INTERNAL: verified-batch marker lives off-record
        anns.push({ ..._a0, record: _ex });
      }
    } else anns.push(_a0);
  }
  const _xo = (p: any) => String(p || '').toLowerCase().replace(/^0[23](?=[0-9a-f]{64}$)/, '');
  // KV_SENDER_CAP: one wallet cannot occupy the directory scan (its NEWEST 30 count)
  const _senderOk = new Set<any>();
  for (let i = anns.length - 1; i >= 0; i--) {
    const a = anns[i]; const r: any = a.record;
    if (!r || r.k !== 'registry') continue;
    const _sk = String((a as any).sender || r.o || ''); const _sc = (_senderCount.get(_sk) || 0) + 1; _senderCount.set(_sk, _sc);
    if (_sc <= 30) _senderOk.add(a);
  }
  // KV_DIR_BY_ADDR + KV_STORE_OWNER: one entry per STORE ADDRESS. The first
  // signer seen in chain order owns the address; later announces only update
  // it when signed by that same key (any key could otherwise take a listing
  // over by announcing someone else's storeAddress).
  const _candsByAddr = new Map<string, string[]>(); // addr -> distinct signers, chain order
  const _latestBy = new Map<string, { record: KvRecord; blockTime: number; sender: string }>(); // addr|xo -> newest announce
  for (const a of anns) {
    const r: any = a.record;
    if (!r || r.k !== 'registry' || !_senderOk.has(a)) continue;
    if (!r.d?.storeAddress || !r.d?.name || !r.o) continue;
    if (!_kvSigOk(r)) continue;
    const _ak = String(r.d.storeAddress); const _ok = _xo(r.o);
    const L = _candsByAddr.get(_ak) || []; if (L.indexOf(_ok) < 0) L.push(_ok); _candsByAddr.set(_ak, L);
    _latestBy.set(_ak + '|' + _ok, { record: r, blockTime: a.blockTime, sender: (a as any).sender || '' }); // chain order: later replaces
  }
  // Contested address: prefer the claimant who provably funded the pledge at
  // it from their own derived P2PK address (KV_FLAGGER_PROOF helpers); else first-seen.
  const _ownerOf = new Map<string, string>(); // addr -> owner xonly
  let _contested = 0; const _contestDeadline = Date.now() + 15000; // bounded: attacker-made contests cannot stall the scan
  for (const [_ak, L] of _candsByAddr) {
    let own = L[0];
    if (L.length > 1 && _contested++ < 20 && Date.now() < _contestDeadline) {
      try {
        for (const c of L.slice(0, 4)) {
          const fr = _latestBy.get(_ak + '|' + c);
          if (fr && (await kvOwnFundedSompi(String(fr.record.o), _ak, String(network), 1)) > 0) { own = c; break; }
        }
      } catch {}
      if (own !== L[0]) console.warn('[Directory] contested store ' + _ak.slice(-10) + ': funder ' + own.slice(0, 10) + ' preferred over first-seen ' + L[0].slice(0, 10));
    }
    _ownerOf.set(_ak, own);
  }
  const byAddr = new Map<string, { record: KvRecord; blockTime: number }>();
  for (const [_ak, own] of _ownerOf) { const e = _latestBy.get(_ak + '|' + own); if (e) byAddr.set(_ak, e as any); }
  // KV_PROHIBITED_RENDER: reader-side enforcement - a modified client can
  // announce anything; this wallet simply will not display it.
  const KV_PROHIBITED = ['gambling', 'casino', 'betting', 'lottery'];
  const KV_MOD_PUBKEY = '0268c16db707f28883ebd4217d20ffb02a38d3227159dd34bdb4d40a3a715e9483';
  // KV_FLAGS_TALLY: every wallet counts flags itself - no server, no single judge.
  const KV_FLAG_THRESHOLD = 3;
  const _kvFlagMod = '0268c16db707f28883ebd4217d20ffb02a38d3227159dd34bdb4d40a3a715e9483';
  const _kvPublishers = new Set<string>();
  for (const a of anns) { const r: any = a.record; if (r && r.k === 'registry' && r.o && _kvSigOk(r)) _kvPublishers.add(String(r.o)); }
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
    // KV_FLAG_TRADE_GATE: listed-publisher gate replaced by pledge-or-trade gate below
    let m = _kvFlagsBy.get(h); if (!m) { m = new Map(); _kvFlagsBy.set(h, m); }
    // KV_FLAG_CAP: only the first 10 distinct flaggers per head (chain order) are ever checked
    if (!m.has(String(r.o)) && m.size >= 500) continue; // KV_FLAG_CAP2: sanity cap only - junk flaggers cannot fill the slots
    if (!verifyRecord(r)) continue;
    m.set(String(r.o), String(r.d.reason || ''));
  }
  // KV_FLAG_PLEDGE_GATE: flagger must have a live pledge (>= 10 KAS at one of their store addresses)
  const KV_FLAG_MIN_PLEDGE = 1_000_000_000; // sompi = 10 KAS (locked, not burned - recoverable)
  try {
    const _flaggers = new Set<string>();
    for (const m of _kvFlagsBy.values()) for (const k of m.keys()) _flaggers.add(k);
    if (_flaggers.size) {
      const _stores = new Map<string, string[]>();
      for (const a of anns) {
        const r: any = a.record;
        if (r && r.k === 'registry' && r.o && r.d && r.d.storeAddress && _flaggers.has(String(r.o)) && _kvSigOk(r)) { // KV_FLAGGER_PROOF: signed claims only
          const l = _stores.get(String(r.o)) || [];
          if (l.indexOf(String(r.d.storeAddress)) < 0) l.push(String(r.d.storeAddress));
          _stores.set(String(r.o), l);
        }
      }
      const _g: any = globalThis as any;
      const _pledged = new Set<string>();
      // KV_FLAGGER_PROOF: balance of the flagger's OWN P2PK address, or capital the flagger
      // provably put into a store they claim (UTXOs funded from their own address)
      // KV_FLAG_BUDGET: per-session result cache per flagger + overall time budget;
      // flaggers not reached inside the budget simply do not count this pass.
      const _sess: Map<string, boolean> = _g.__kvFlagQualSession || (_g.__kvFlagQualSession = new Map());
      const _deadline = Date.now() + 20000;
      const _pending: string[] = [];
      for (const fk of _flaggers) { const c = _sess.get(fk); if (c === true) _pledged.add(fk); else if (c === undefined) _pending.push(fk); }
      for (const fk of _pending) {
        if (Date.now() > _deadline) break;
        if (await kvPledgeQualified(fk, _stores.get(fk) || [], String(network), KV_FLAG_MIN_PLEDGE)) { _pledged.add(fk); _sess.set(fk, true); }
      }
      // KV_FLAG_TRADE_GATE: no pledge? a settled escrow trade also qualifies
      for (const fk of _pending) {
        if (_pledged.has(fk)) continue;
        if (Date.now() > _deadline) break;
        try {
          const tc = _g.__kvTradeCache || (_g.__kvTradeCache = new Map());
          const hit = tc.get(fk);
          let settled = -1;
          if (hit && Date.now() - hit.t < 600000) settled = hit.n;
          else {
            const { scanCounterparty } = require('./counterparty_scan');
            const sr: any = await scanCounterparty(fk, String(network), 40, true);
            settled = Number((sr && sr.settled) || 0);
            tc.set(fk, { n: settled, t: Date.now() });
          }
          if (settled >= 1) _pledged.add(fk);
          _sess.set(fk, settled >= 1);
        } catch {}
      }
      for (const m of _kvFlagsBy.values()) for (const k of Array.from(m.keys())) if (!_pledged.has(k)) { m.delete(k); console.log('[Flags] ignored - flagger has no pledge or settled trade:', k.slice(0, 12)); }
    }
  } catch (e) { console.warn('[Flags] gate error', e); }
  // KV_DELIST_PERSIGNER: newest delist per (store, signer); only the store's
  // owner's or the mod key's delist is ever applied (a third party's high-t
  // delist can no longer shadow the owner's).
  const delistByTarget = new Map<string, Map<string, any>>();
  const _dlPut = (r: any) => {
    const tgt = String(r.d.head); let m = delistByTarget.get(tgt); if (!m) { m = new Map(); delistByTarget.set(tgt, m); }
    const k = _xo(r.o); const p = m.get(k);
    if (!p || (r.t || 0) > (p.t || 0)) m.set(k, r);
  };
  const _dlGet = (tgt: string, signer: string): any => { const m = delistByTarget.get(tgt); return m ? m.get(_xo(signer)) : undefined; };
  for (const a of anns) {
    const r: any = a.record;
    if (r && r.k === 'delist' && r.d && r.d.head && r.o && verifyRecord(r)) _dlPut(r);
  }
  // KV_MOD_STICKY: latest cold-key action per store address (delist / undelist), cached on device
  const _kvModHeads = new Set<string>();
  try {
    const _mk = 'kv_mod_actions_' + String(registryAddress).slice(-16);
    const _act: Record<string, { t: number; del: boolean }> = JSON.parse((await require('@react-native-async-storage/async-storage').default.getItem(_mk)) || '{}');
    for (const a of anns) {
      const r: any = a.record;
      if (!r || r.o !== KV_MOD_PUBKEY || (r.k !== 'delist' && r.k !== 'undelist') || !r.d || !r.d.head || !verifyRecord(r)) continue;
      const h = String(r.d.head); const cur = _act[h];
      if (!cur || (r.t || 0) > cur.t) _act[h] = { t: r.t || 0, del: r.k === 'delist' };
    }
    await require('@react-native-async-storage/async-storage').default.setItem(_mk, JSON.stringify(_act));
    for (const h of Object.keys(_act)) if (_act[h].del) _kvModHeads.add(h);
  } catch {}
  // KV_MOD_NOTE: cold-key "removed in error" acknowledgments (never reinstate), cached on device
  const _kvModNotes = new Map<string, string>();
  try {
    const _nk = 'kv_mod_notes_' + String(registryAddress).slice(-16);
    const _nn: Record<string, string> = JSON.parse((await require('@react-native-async-storage/async-storage').default.getItem(_nk)) || '{}');
    for (const a of anns) { const r: any = a.record; if (r && r.k === 'modnote' && r.o === KV_MOD_PUBKEY && r.d && r.d.head && verifyRecord(r)) _nn[String(r.d.head)] = String(r.d.note || 'removed in error'); }
    await require('@react-native-async-storage/async-storage').default.setItem(_nk, JSON.stringify(_nn));
    for (const h of Object.keys(_nn)) _kvModNotes.set(h, _nn[h]);
  } catch {}
  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)
  try {
    const _DAS = require('@react-native-async-storage/async-storage').default;
    const _dck = 'kv_store_delist_cache_' + String(registryAddress).slice(-16);
    const _old: any[] = JSON.parse((await _DAS.getItem(_dck)) || '[]');
    for (const r of _old) {
      if (!r || r.k !== 'delist' || !r.d || !r.d.head || !r.o || !verifyRecord(r)) continue;
      _dlPut(r);
    }
    const _flat: any[] = []; for (const m of delistByTarget.values()) for (const r of m.values()) _flat.push(r);
    await _DAS.setItem(_dck, JSON.stringify(_flat.slice(-2000)));
  } catch {}
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
    if (_kvModHeads.has(String(record.d.storeAddress))) { // KV_MOD_STICKY: cold-key removal sticks (owner still told why)
      try { const _md: any = _dlGet(String(record.d.storeAddress), KV_MOD_PUBKEY); const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: 0, reasons: [], owner: String(owner), name: String(record.d.name || ''), hidden: true, mod: true, modReason: String((_md && _md.o === KV_MOD_PUBKEY && _md.d && _md.d.reason) || 'moderator decision'), modNote: _kvModNotes.get(String(record.d.storeAddress)) || '' }); } catch {}
      continue;
    }
    const _dlO = _dlGet(String(record.d.storeAddress), owner);
    const _dlM = _xo(owner) === _xo(KV_MOD_PUBKEY) ? undefined : _dlGet(String(record.d.storeAddress), KV_MOD_PUBKEY);
    const _dl = (_dlM && (_dlM.t || 0) > (record.t || 0)) ? _dlM : _dlO;
    // KV_MOD_OWNER_INFO: remember moderator removals so the owner is told why
    if (_dl && _dl.o === KV_MOD_PUBKEY && _dl.o !== owner && (_dl.t || 0) > (record.t || 0)) { try { const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: 0, reasons: [], owner: String(owner), name: String(record.d.name || ''), hidden: true, mod: true, modReason: String((_dl.d && _dl.d.reason) || 'unspecified') }); } catch {} }
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
    try { const _cfm = require('./content_filter'); const scanObject = _cfm.scanObjectStrict || _cfm.scanObject; const _sc = scanObject({ n: record.d.name, c: record.d.category, l: record.d.primaryLink }); if (!_sc.ok) { console.warn('[Directory] entry BLOCKED:', _sc.reason, String(record.d.name || '').slice(0, 24)); continue; } } catch {}
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

// KV_FLAGGER_PROOF: a claimed storeAddress proves nothing (anyone can sign a
// registry record naming a rich address). Qualify only by
//   (1) the balance of the P2PK address DERIVED from the flagger's own pubkey, or
//   (2) unspent capital at a claimed store whose funding tx was sent FROM that
//       derived address (the flagger provably locked it there).
function _kvOwnAddr(pubkey: string, network: string): string {
  try {
    const xonly = String(pubkey || '').length === 66 ? String(pubkey).slice(2) : String(pubkey || '');
    if (!/^[0-9a-fA-F]{64}$/.test(xonly)) return '';
    return require('./canonical_agreement_steps').deriveAddress(xonly.toLowerCase(), network as any) || '';
  } catch { return ''; }
}
const _kvApi = (network: string) => String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
const _kvPc = (): Map<string, { b: number; t: number }> => { const g: any = globalThis as any; return g.__kvPledgeCache || (g.__kvPledgeCache = new Map()); };
const _kvCached = (k: string) => { const c = _kvPc().get(k); return c && Date.now() - c.t < 600000 ? c.b : null; };

/** KV_FLAGGER_PROOF (2): unspent sompi at `addr` whose funding tx was sent entirely
 *  FROM pubkey's derived P2PK address. Stops counting once >= minSompi. Cached 10 min. */
export async function kvOwnFundedSompi(pubkey: string, addr: string, network: string, minSompi: number): Promise<number> {
  const own = _kvOwnAddr(pubkey, network);
  if (!own || !addr) return 0;
  const api = _kvApi(network);
  const ck = 'fund:' + own + ':' + addr;
  let sum = _kvCached(ck);
  if (sum !== null) return sum;
  sum = 0;
  try {
    const utxos: any[] = (await (await fetch(api + '/addresses/' + encodeURIComponent(addr) + '/utxos')).json()) || [];
    const fundedBy = new Map<string, boolean>();
    for (const u of utxos.slice(0, 20)) {
      const txid = String((u && u.outpoint && (u.outpoint.transactionId || u.outpoint.transaction_id)) || '');
      const amt = Number((u && u.utxoEntry && u.utxoEntry.amount) || (u && u.amount) || 0);
      if (!/^[0-9a-f]{64}$/.test(txid) || !amt) continue;
      if (!fundedBy.has(txid)) {
        let mine = false;
        try {
          const tj: any = await (await fetch(api + '/transactions/' + txid + '?inputs=true&outputs=false&resolve_previous_outpoints=light')).json();
          const ins: any[] = (tj && tj.inputs) || [];
          mine = ins.length > 0 && ins.every((i: any) => String(i && i.previous_outpoint_address || '') === own);
        } catch {}
        fundedBy.set(txid, mine);
      }
      if (fundedBy.get(txid)) sum += amt;
      if (sum >= minSompi) break;
    }
  } catch {}
  _kvPc().set(ck, { b: sum, t: Date.now() });
  return sum;
}

async function kvPledgeQualified(pubkey: string, storeAddrs: string[], network: string, minSompi: number): Promise<boolean> {
  const own = _kvOwnAddr(pubkey, network);
  if (!own) return false;
  const api = _kvApi(network);
  // (1) own wallet balance
  let bal = _kvCached('own:' + own);
  if (bal === null) {
    try { const j: any = await (await fetch(api + '/addresses/' + own + '/balance')).json(); bal = Number((j && j.balance) || 0); _kvPc().set('own:' + own, { b: bal, t: Date.now() }); } catch { bal = 0; }
  }
  if (bal >= minSompi) return true;
  // (2) owner-funded pledge at a claimed store
  for (const addr of storeAddrs.slice(0, 5)) {
    if ((await kvOwnFundedSompi(pubkey, addr, network, minSompi)) >= minSompi) return true;
  }
  return false;
}

// KV_FLAGGER_QUALIFIES: shared reputation gate for flags (games lane; stores tally inline)
export async function kvFlaggerQualifies(pubkey: string, network: string = require('./kv_net').KV_NET): Promise<boolean> {
  const g: any = globalThis as any;
  const qc = g.__kvQualCache || (g.__kvQualCache = new Map());
  const hit = qc.get(pubkey);
  if (hit) return hit.ok; // KV_FLAG_BUDGET: one answer per flagger per session
  let ok = false;
  try {
    // (a) live pledge >= 10 KAS: own P2PK address, or capital they provably put into a store they claim
    if (!g.__kvStoreRegRecs || Date.now() - g.__kvStoreRegRecs.t > 600000) {
      const reg = require('./payload_publish').registryAddress('store', network);
      g.__kvStoreRegRecs = { t: Date.now(), rows: (await (fetchRecords as any)(reg, network, 100, 5)) || [] };
    }
    const addrs: string[] = [];
    for (const a of g.__kvStoreRegRecs.rows) {
      const r: any = a && a.record;
      if (!r || r.k !== 'registry' || r.o !== pubkey || !r.d) continue;
      if (!verifyRecord(r)) continue; // KV_FLAGGER_PROOF: unsigned/forged claims never count
      const its: any[] = Array.isArray(r.d.batch) ? r.d.batch : [r.d];
      for (const it of its) if (it && it.storeAddress && addrs.indexOf(String(it.storeAddress)) < 0) addrs.push(String(it.storeAddress));
    }
    ok = await kvPledgeQualified(pubkey, addrs, network, 1_000_000_000);
    // (b) at least one settled escrow trade
    if (!ok) {
      const { scanCounterparty } = require('./counterparty_scan');
      const sr: any = await scanCounterparty(pubkey, network, 40, true);
      ok = Number((sr && sr.settled) || 0) >= 1;
    }
  } catch { return false; } // KV_FLAG_NOCACHE_ERR: a network error is not a verdict
  qc.set(pubkey, { ok, t: Date.now() });
  return ok;
}

// KV_GRANT_VERIFY: did this tx pay the dev's SIGNED address? (check soon after grant - pruning)
export async function kvVerifyPayment(txid: string, payTo: string, network: string = require('./kv_net').KV_NET): Promise<{ ok: boolean; amountKas: number; found: boolean }> {
  try {
    if (!/^[0-9a-f]{64}$/i.test(String(txid || ''))) return { ok: false, amountKas: 0, found: false };
    const api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    const r = await fetch(api + '/transactions/' + txid);
    if (!r.ok) return { ok: false, amountKas: 0, found: false };
    const j: any = await r.json();
    let amt = 0;
    for (const o of (j.outputs || [])) if (payTo && String(o.script_public_key_address) === String(payTo)) amt += Number(o.amount || 0);
    return { ok: amt > 0, amountKas: amt / 1e8, found: true };
  } catch { return { ok: false, amountKas: 0, found: false }; }
}
// KV_GRANTS_BOOT: saved grants are available before the Mailbox ever loads
try { require('@react-native-async-storage/async-storage').default.getItem('kv_grants').then((v: any) => { try { if (v) (globalThis as any).__kvGrantsAll = JSON.parse(v); } catch {} }); } catch {}

// KV_EVIDENCE: archive the node's own answer about a tx so it can be checked after pruning
export async function kvFetchEvidence(txid: string, network: string = require('./kv_net').KV_NET): Promise<any | null> {
  try {
    if (!/^[0-9a-f]{64}$/i.test(String(txid || ''))) return null;
    const api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    const tr = await fetch(api + '/transactions/' + txid + '?resolve_previous_outpoints=no');
    if (!tr.ok) return null;
    const tx: any = await tr.json();
    const bh = Array.isArray(tx.block_hash) ? tx.block_hash[0] : tx.block_hash;
    const ah = tx.accepting_block_hash;
    if (!bh || !ah) return null; // not accepted yet - try again later
    const br = await fetch(api + '/blocks/' + bh + '?includeTransactions=true');
    const blk: any = br.ok ? await br.json() : null;
    const ar = await fetch(api + '/blocks/' + ah + '?includeTransactions=false');
    const acc: any = ar.ok ? await ar.json() : null;
    if (!blk || !acc) return null;
    const ids: string[] = (blk.verboseData && blk.verboseData.transactionIds) || (blk.transactions || []).map((t: any) => t && t.verboseData && t.verboseData.transactionId).filter(Boolean);
    const hashes: string[] = (blk.transactions || []).map((t: any) => t && t.verboseData && t.verboseData.hash).filter(Boolean);
    return {
      v: 1, network, txid, sealedAt: Date.now(),
      tx,
      block: { hash: bh, header: blk.header || null, txIds: ids, txHashes: hashes, includesTx: ids.indexOf(txid) >= 0 },
      accepting: { hash: ah, header: acc.header || null, verbose: acc.verboseData ? { blueScore: acc.verboseData.blueScore, selectedParentHash: acc.verboseData.selectedParentHash } : null },
    };
  } catch { return null; }
}

export async function kvSealEvidence(network: string = require('./kv_net').KV_NET): Promise<{ sealed: number; pending: number }> {
  let sealed = 0, pending = 0;
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const want: string[] = [];
    try { for (const e of JSON.parse((await AS.getItem('kv_sales_log')) || '[]')) if (e && e.grantTx) want.push(String(e.grantTx)); } catch {}
    try { const sr = require('./stat_records'); for (const r of (await sr.loadChain()) || []) if (r && r.anchor && r.anchor.releaseTxId) want.push(String(r.anchor.releaseTxId)); } catch {}
    for (const t of Array.from(new Set(want))) {
      if (await AS.getItem('kv_evidence_' + t)) continue;
      const ev = await kvFetchEvidence(t, network);
      if (ev) { await AS.setItem('kv_evidence_' + t, JSON.stringify(ev)); sealed++; } else pending++;
    }
    if (sealed || pending) console.log('[Evidence] sealed ' + sealed + ', pending ' + pending + ' (pending = not accepted yet, or already pruned)');
  } catch (e) { console.warn('[Evidence]', e); }
  return { sealed, pending };
}
try { setTimeout(() => { kvSealEvidence().catch(() => {}); }, 20000); } catch {}
