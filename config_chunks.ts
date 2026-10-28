// config_chunks.ts - full storefront config on the Kaspa payload rail.
//
// PUBLISH: gzip(config JSON) -> base64 -> split into <=CHUNK_DATA_MAX slices ->
// one signed KVP1 {k:'cfg', seq, tot, h, d} record per slice, dust tx to the
// store address, SEQUENTIAL sends (each awaits broadcast before the next to
// avoid in-flight UTXO reuse).
//
// FETCH (buyer): scan store address records -> newest complete {h, tot} set ->
// reassemble -> gunzip -> sha256 must equal both h and the configHash anchored
// in the store's publish record. Tamper-proof, serverless, offline-renderable.
import * as pako from 'pako';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { signRecord, buildPayloadHex, fetchRecords, KvRecord, kvAssembleChunks, kvInflateCapped, kvTxPaysAddress, KV_PAGE_MAX_DECOMPRESSED } from './kaspa_payload';
import { sendKaspaViaRest } from './kaspa_rest_tx';
import type { OwnerKeys } from './payload_publish';

// 2000B soft max minus envelope (~180B of k/v/o/t/s/seq/tot/h JSON) -> data budget.
const CHUNK_DATA_MAX = 1600; // base64 chars per chunk, conservative
const CHUNK_DUST_SOMPI = 20_000_000n; // 0.2 KAS per chunk tx

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function configToChunkData(config: any): { chunks: string[]; hash: string } {
  const json = JSON.stringify(config);
  const gz = pako.deflate(utf8ToBytes(json));
  const b64 = b64encode(gz);
  const hash = bytesToHex(sha256(utf8ToBytes(json)));
  const chunks: string[] = [];
  const { wordSafeChunks } = require('./html_chunks');
  chunks.push(...wordSafeChunks(b64, CHUNK_DATA_MAX));   // relay word-gate safe
  return { chunks, hash };
}

/** Publish config as sequential chunk txs to the store address.
 *  Non-fatal by design: caller treats failure as "config pending". */
export async function publishConfigChunks(
  owner: OwnerKeys,
  storeAddress: string,
  config: any,
): Promise<{ success: boolean; txids: string[]; totalChunks: number; hash: string; error?: string }> {
  const { chunks, hash } = configToChunkData(config);
  const txids: string[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const rec: KvRecord = signRecord({
        k: 'cfg', v: 1, o: owner.pubkeyHex, t: Date.now(),
        d: { seq: i, tot: chunks.length, h: hash, c: chunks[i] },
      }, owner.privateKeyHex);
      // SEQUENTIAL: await each broadcast before building the next tx so the
      // change UTXO from tx N funds tx N+1 without in-flight reuse.
      const res: any = await sendKaspaViaRest({
        senderAddress: owner.address,
        recipientAddress: storeAddress,
        amountSompi: CHUNK_DUST_SOMPI,
        privateKeyHex: owner.privateKeyHex,
        network: owner.network,
        payload: buildPayloadHex(rec),
      });
      if (!res || res.success === false || !res.txId) {
        return { success: false, txids, totalChunks: chunks.length, hash, error: 'chunk ' + i + ' failed: ' + (res && res.error) };
      }
      txids.push(res.txId);
      console.log('[CfgChunks] sent', (i + 1) + '/' + chunks.length, res.txId.slice(0, 16));
    }
    return { success: true, txids, totalChunks: chunks.length, hash };
  } catch (e: any) {
    return { success: false, txids, totalChunks: chunks.length, hash, error: String(e?.message || e) };
  }
}

/** Buyer side: rebuild + verify a store's config from chain. */
// ---------------------------------------------------------------------------
// Dapps and storefront configs get the ladder games and pages already have:
// device cache -> relay records -> coordinate walk. Relay-only meant a dapp
// went dark the moment the archive rotated - which is exactly why dapps were
// not persistent while games were.
// ---------------------------------------------------------------------------
const KV_CFG_WALK_RELAY = 'https://kasvillage.app.runonflux.io';

async function cfgCacheGet(hash: string): Promise<any | null> {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const raw = await AS.getItem('kv_cfg_' + hash);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function cfgCachePut(hash: string, cfg: any): Promise<void> {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem('kv_cfg_' + hash, JSON.stringify(cfg));
  } catch {}
}

async function fetchStoreConfigViaWalk(
  expectedHash: string,
  coords: { anchor_hash?: string; daa_to?: number },
  ownerPub?: string,
  payTo?: string, // KV_WALK_PAYTO: the store address - txs whose outputs do not pay it are ignored (when outputs are exposed)
): Promise<{ config: any | null; error?: string }> {
  try {
    if (!coords || !coords.anchor_hash || !coords.daa_to) return { config: null, error: 'no coordinates' };
    const sink = await (await fetch(KV_CFG_WALK_RELAY + '/api/kaspa/sink')).json();
    const vdaa = Number(sink.virtual_daa_score || 0);
    const daaTo = Number(coords.daa_to);
    if (vdaa && vdaa - daaTo > 1100000) return { config: null, error: 'publish window (~30h) closed - needs a republish' };
    const found: any[] = []; // KV_CHUNK_CANDIDATES: every matching record, walk (chain) order
    let low = String(coords.anchor_hash);
    let pages = 0, retries = 0;
    while (pages < 450) {
      let page: any;
      try { page = await (await fetch(KV_CFG_WALK_RELAY + '/api/kaspa/blocks?low_hash=' + low + '&daa_max=' + (daaTo + 600) + '&txs=1')).json(); }
      catch { if (++retries > 20) return { config: null, error: 'walk: node unreachable' }; await new Promise((r) => setTimeout(r, 1500)); continue; }
      pages++;
      for (const b of page.blocks || []) for (const tx of b.txs || []) {
        try {
          if (kvTxPaysAddress(tx, payTo) === false) continue;
          const hx = String(tx.payload_hex || '');
          let raw = '';
          for (let i = 0; i < hx.length; i += 2) raw += String.fromCharCode(parseInt(hx.substr(i, 2), 16));
          try { raw = decodeURIComponent(escape(raw)); } catch {}
          const rec = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw);
          const d = rec && rec.d;
          if (!d || rec.k !== 'cfg' || d.ty === 'html') continue;
          if (d.h === expectedHash && typeof d.seq === 'number' && found.length < 4000) found.push(rec);
        } catch {}
      }
      if (page.done || !page.next_low_hash) break;
      low = page.next_low_hash;
    }
    if (!found.length) return { config: null, error: 'walk found no config chunks in span' };
    const asm = kvAssembleChunks(found, expectedHash, cfgInflate, { ownerPub, maxChunkChars: KV_CFG_MAX_CHUNK_CHARS });
    if (asm.text === null) return { config: null, error: 'walk: ' + asm.error };
    return { config: JSON.parse(asm.text) };
  } catch (e: any) { return { config: null, error: 'walk: ' + String(e?.message || e) }; }
}

// KV_INFLATE_CAP: bounded streaming inflate - a 2 MB+ decompressed config is refused, never materialized
const cfgInflate = (b64: string) => new TextDecoder().decode(kvInflateCapped(b64decode(b64), KV_PAGE_MAX_DECOMPRESSED));
const KV_CFG_MAX_CHUNK_CHARS = Math.ceil(KV_PAGE_MAX_DECOMPRESSED * 4 / 3) + 65536; // b64 of a <=2 MB deflate stream

// ownerPub (KV_CHUNK_CANDIDATES): the announce / store registry `o` when known -
// only chunks signed by it count. Omit for content-addressed reposts (games).
export async function fetchStoreConfig(storeAddress: string, expectedHash: string, network = require('./kv_net').KV_NET, coords?: { anchor_hash?: string; daa_to?: number }, ownerPub?: string): Promise<{ config: any | null; error?: string }> {
  let r = await _fetchStoreConfigOnce(storeAddress, expectedHash, network, coords, ownerPub);
  for (let i = 0; i < 4 && !r.config && /incomplete|missing chunk/.test(String(r.error || '')); i++) {
    await new Promise((res) => setTimeout(res, 5000));
    r = await _fetchStoreConfigOnce(storeAddress, expectedHash, network, coords, ownerPub);
  }
  return r;
}
async function _fetchStoreConfigOnce(
  storeAddress: string,
  expectedHash: string,
  network = require('./kv_net').KV_NET,
  coords?: { anchor_hash?: string; daa_to?: number },
  ownerPub?: string,
): Promise<{ config: any | null; error?: string }> {
  try {
    const hit = await cfgCacheGet(expectedHash);
    if (hit) return { config: hit };
    const wrapped: any[] = await fetchRecords(storeAddress, network, 200);
    // fetchRecords returns { record, txid, blockTime } wrappers - unwrap to the KvRecord
    const recs: any[] = wrapped.map(w => (w && w.record) ? w.record : w);
    const cfgRecs = recs.filter(r => r && r.k === 'cfg' && r.d && r.d.h === expectedHash);
    if (cfgRecs.length === 0) {
      const w = await fetchStoreConfigViaWalk(expectedHash, coords || {}, ownerPub, storeAddress);
      if (w.config) { await cfgCachePut(expectedHash, w.config); return w; }
      return { config: null, error: 'no config chunks found; walk: ' + (w.error || 'failed') };
    }
    // KV_CHUNK_CANDIDATES: signed (+owner) records only; try groupings until the hash
    // matches (junk newest records can no longer win). fetchRecords is newest-first.
    const asm = kvAssembleChunks(cfgRecs.slice().reverse(), expectedHash, cfgInflate, { ownerPub, maxChunkChars: KV_CFG_MAX_CHUNK_CHARS });
    if (asm.text === null) { // KV_MANIFEST_LAG: index behind the chain - read the chunks off the chain instead
      const w2 = await fetchStoreConfigViaWalk(expectedHash, coords || {}, ownerPub, storeAddress);
      if (w2.config) { await cfgCachePut(expectedHash, w2.config); return w2; }
      return { config: null, error: String(asm.error) };
    }
    const json = asm.text;
    return { config: JSON.parse(json) };
  } catch (e: any) {
    return { config: null, error: String(e?.message || e) };
  }
}
