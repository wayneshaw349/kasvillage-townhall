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
import { signRecord, buildPayloadHex, fetchRecords, KvRecord } from './kaspa_payload';
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
  for (let i = 0; i < b64.length; i += CHUNK_DATA_MAX) chunks.push(b64.slice(i, i + CHUNK_DATA_MAX));
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
export async function fetchStoreConfig(
  storeAddress: string,
  expectedHash: string,
  network = 'testnet-10',
): Promise<{ config: any | null; error?: string }> {
  try {
    const recs: any[] = await fetchRecords(storeAddress, network, 200);
    const cfgRecs = recs.filter(r => (r as any).k === 'cfg' && r.d && r.d.h === expectedHash);
    if (cfgRecs.length === 0) return { config: null, error: 'no config chunks found' };
    const tot = cfgRecs[0].d.tot;
    // newest record per seq wins (config updates re-publish all chunks)
    const bySeq = new Map<number, any>();
    for (const r of cfgRecs) {
      const prev = bySeq.get(r.d.seq);
      if (!prev || r.t > prev.t) bySeq.set(r.d.seq, r);
    }
    if (bySeq.size < tot) return { config: null, error: 'incomplete: ' + bySeq.size + '/' + tot + ' chunks' };
    let b64 = '';
    for (let i = 0; i < tot; i++) {
      const r = bySeq.get(i);
      if (!r) return { config: null, error: 'missing chunk ' + i };
      b64 += r.d.c;
    }
    const json = new TextDecoder().decode(pako.inflate(b64decode(b64)));
    const gotHash = bytesToHex(sha256(utf8ToBytes(json)));
    if (gotHash !== expectedHash) return { config: null, error: 'hash mismatch - tampered or corrupt' };
    return { config: JSON.parse(json) };
  } catch (e: any) {
    return { config: null, error: String(e?.message || e) };
  }
}
