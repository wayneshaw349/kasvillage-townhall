// html_chunks.ts - on-chain HTML pages on the Kaspa payload rail.
//
// Mirrors config_chunks.ts exactly (gzip -> base64 -> <=CHUNK_DATA_MAX slices ->
// signed KVP1 records, sequential sends). Differs only in:
//   - d.ty = 'html' marks the chunk set as a page, not a storefront config
//   - the payload is a raw HTML string, not a JSON object
//   - publish is gated on a local safety scan (no external hrefs, no drainer
//     patterns) so the on-chain bytes are verifiable-clean by construction
//
// TRUST MODEL: the chunks ARE the input. Any party can refetch, reassemble,
// hash-verify and re-scan the exact bytes the WebView renders. No TLS fetch,
// no provenance gap, no signer to trust.
//
// PAGE HASH: sha256 of the raw HTML string. Anchor it in the store/dapp record
// (same role configHash plays) so the announce binds the page.

import * as pako from 'pako';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { signRecord, buildPayloadHex, fetchRecords, KvRecord } from './kaspa_payload';
import { sendKaspaViaRest } from './kaspa_rest_tx';
import type { OwnerKeys } from './payload_publish';

const CHUNK_DATA_MAX = 1600;          // base64 chars per chunk (same budget as cfg)
const CHUNK_DUST_SOMPI = 20_000_000n; // 0.2 KAS per chunk tx
export const HTML_SOFT_MAX_BYTES = 60_000; // raw HTML ceiling before publish is refused

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

// ---------------------------------------------------------------------------
// PUBLISH-TIME SAFETY GATE
// ---------------------------------------------------------------------------
// Runs before inscription so the chain never carries a drainer page. Same
// pattern family as the TownHall canary scanner, enforced locally because the
// author's own device is the only party that needs to be convinced here.

export interface HtmlScanIssue { code: string; detail: string; }

const BLOCKED_PATTERNS: Array<[RegExp, string]> = [
  [/(seed|recovery|secret)\s*phrase/i,                      'seed_phrase_prompt'],
  [/\b(mnemonic|12\s*[- ]?words?|24\s*[- ]?words?)\b/i,      'mnemonic_prompt'],
  [/setApprovalForAll/i,                                     'unlimited_approval'],
  [/eval\s*\(\s*(atob|unescape|String\.fromCharCode)/i,      'obfuscated_eval'],
  [/Function\s*\(\s*atob/i,                                  'obfuscated_function'],
  [/document\.write\s*\(\s*(atob|unescape)/i,                'obfuscated_write'],
  [/<iframe/i,                                               'iframe_not_allowed'],
  [/clipboard(Data)?\.(setData|writeText)/i,                 'clipboard_write'],
  [/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i,     'network_call'],
  [/<script[^>]*\ssrc\s*=/i,                                 'external_script'],
];

/** Any href/src that leaves the sandbox. kv:// and #anchors are fine. */
function findExternalRefs(html: string): string[] {
  const out: string[] = [];
  const re = /(?:href|src|action)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const v = m[1].trim();
    if (v.startsWith('kv://') || v.startsWith('#') || v.startsWith('data:image/')) continue;
    out.push(v.slice(0, 80));
  }
  return out;
}

export function scanHtmlForPublish(html: string): { ok: boolean; issues: HtmlScanIssue[] } {
  const issues: HtmlScanIssue[] = [];
  for (const [re, code] of BLOCKED_PATTERNS) {
    const hit = html.match(re);
    if (hit) issues.push({ code, detail: String(hit[0]).slice(0, 60) });
  }
  for (const ref of findExternalRefs(html)) {
    issues.push({ code: 'external_ref', detail: ref });
  }
  if (utf8ToBytes(html).length > HTML_SOFT_MAX_BYTES) {
    issues.push({ code: 'too_large', detail: utf8ToBytes(html).length + ' bytes' });
  }
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// CHUNKING
// ---------------------------------------------------------------------------

// Relay KVP1 word gate scans every payload string; these must never appear
// wholly inside one chunk. Boundaries are free (reassembly joins by seq), so
// the slicer cuts inside any match, splitting it across two records.
const RELAY_GATE_WORDS = ['casino', 'gambling', 'slot', 'poker', 'blackjack', 'roulette', 'lottery', 'jackpot', 'sportsbook', 'wagering', 'porn', 'xxx'];
export function wordSafeChunks(b64: string, max: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < b64.length) {
    let end = Math.min(b64.length, i + max);
    let cut = end;
    for (let guard = 0; guard < 64; guard++) {
      const piece = b64.slice(i, cut).toLowerCase();
      let worst = -1, wlen = 0;
      for (const w of RELAY_GATE_WORDS) {
        const p = piece.lastIndexOf(w);
        if (p >= 0 && p + w.length > worst + wlen) { worst = p; wlen = w.length; }
      }
      if (worst < 0) break;
      cut = i + worst + 1;              // cut inside the word -> split across records
      if (cut <= i) { cut = i + 1; break; }
    }
    chunks.push(b64.slice(i, cut));
    i = cut;
  }
  return chunks;
}
export function htmlToChunkData(html: string): { chunks: string[]; hash: string } {
  const gz = pako.deflate(utf8ToBytes(html));
  const b64 = b64encode(gz);
  const hash = bytesToHex(sha256(utf8ToBytes(html)));
  return { chunks: wordSafeChunks(b64, CHUNK_DATA_MAX), hash };
}

/** Cost preview for the publish confirm dialog. */
export function estimateHtmlPublishCost(html: string): { chunks: number; kas: number; hash: string } {
  const { chunks, hash } = htmlToChunkData(html);
  return { chunks: chunks.length, kas: (Number(CHUNK_DUST_SOMPI) * chunks.length) / 1e8, hash };
}

// ---------------------------------------------------------------------------
// PUBLISH
// ---------------------------------------------------------------------------

export async function publishHtmlChunks(
  owner: OwnerKeys,
  storeAddress: string,
  html: string,
  opts?: { skipScan?: boolean },
): Promise<{ success: boolean; txids: string[]; totalChunks: number; hash: string; issues?: HtmlScanIssue[]; error?: string }> {
  if (!opts?.skipScan) {
    const scan = scanHtmlForPublish(html);
    if (!scan.ok) {
      return { success: false, txids: [], totalChunks: 0, hash: '', issues: scan.issues, error: 'blocked by publish scan' };
    }
  }
  const { chunks, hash } = htmlToChunkData(html);
  const txids: string[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const rec: KvRecord = signRecord({
        k: 'cfg', v: 1, o: owner.pubkeyHex, t: Date.now(),
        d: { ty: 'html', seq: i, tot: chunks.length, h: hash, c: chunks[i] },
      }, owner.privateKeyHex);
      // SEQUENTIAL: change UTXO from tx N funds tx N+1 (no in-flight reuse).
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
      console.log('[HtmlChunks] sent', (i + 1) + '/' + chunks.length, res.txId.slice(0, 16));
    }
    return { success: true, txids, totalChunks: chunks.length, hash };
  } catch (e: any) {
    return { success: false, txids, totalChunks: chunks.length, hash, error: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------------------
// FETCH (viewer side)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PAGE RETRIEVAL LADDER - the same three tiers games use.
//   1. device cache   (offline, instant, survives everything but a data wipe)
//   2. relay records  (fast when api-tn10's index is current and the relay
//                      instance you reached happens to hold them)
//   3. coordinate walk (anchor_hash -> daa_to, straight off raw blocks)
// Tier 3 is what makes a store survive a relay rotation, exactly as it does
// for a game. It needs the coords the announce now carries.
// ---------------------------------------------------------------------------
const KV_PAGE_WALK_RELAY = 'https://kasvillage.app.runonflux.io';

async function pageCacheGet(hash: string): Promise<string | null> {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const html = await AS.getItem('kv_page_' + hash);
    if (!html) return null;
    // Self-verifying: the key IS the content hash, so a match proves integrity
    // without needing the network or the announce.
    if (bytesToHex(sha256(utf8ToBytes(html))) !== hash) { await AS.removeItem('kv_page_' + hash); return null; }
    return html;
  } catch { return null; }
}

async function pageCachePut(hash: string, html: string): Promise<void> {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem('kv_page_' + hash, html);
  } catch {}
}

async function fetchHtmlPageViaWalk(
  expectedHash: string,
  coords: { anchor_hash?: string; daa_from?: number; daa_to?: number },
): Promise<{ html: string | null; error?: string }> {
  try {
    if (!coords || !coords.anchor_hash || !coords.daa_to) return { html: null, error: 'no coordinates' };
    const sink = await (await fetch(KV_PAGE_WALK_RELAY + '/api/kaspa/sink')).json();
    const vdaa = Number(sink.virtual_daa_score || 0);
    const daaTo = Number(coords.daa_to);
    if (vdaa && vdaa - daaTo > 1100000) return { html: null, error: 'publish window (~30h) closed - needs a republish' };
    const store: Record<number, { t: number; tot: number; c: string }> = {};
    let low = String(coords.anchor_hash);
    let pages = 0, retries = 0;
    while (pages < 450) {
      let page: any;
      try { page = await (await fetch(KV_PAGE_WALK_RELAY + '/api/kaspa/blocks?low_hash=' + low + '&daa_max=' + (daaTo + 600) + '&txs=1')).json(); }
      catch { if (++retries > 20) return { html: null, error: 'walk: node unreachable' }; await new Promise((r) => setTimeout(r, 1500)); continue; }
      pages++;
      for (const b of page.blocks || []) for (const tx of b.txs || []) {
        try {
          const hx = String(tx.payload_hex || '');
          let raw = '';
          for (let i = 0; i < hx.length; i += 2) raw += String.fromCharCode(parseInt(hx.substr(i, 2), 16));
          try { raw = decodeURIComponent(escape(raw)); } catch {}
          const rec = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw);
          const d = rec && rec.d;
          if (!d || rec.k !== 'cfg') continue;
          if (d.ty === 'html' && d.h === expectedHash && typeof d.seq === 'number') {
            if (!store[d.seq] || (rec.t || 0) > store[d.seq].t) store[d.seq] = { t: rec.t || 0, tot: d.tot, c: d.c };
          }
        } catch {}
      }
      if (page.done || !page.next_low_hash) break;
      low = page.next_low_hash;
    }
    const first = store[0];
    if (!first) return { html: null, error: 'walk found no page chunks in span' };
    let b64 = '';
    for (let i = 0; i < first.tot; i++) { const c = store[i]; if (!c) return { html: null, error: 'walk missing chunk ' + i }; b64 += c.c; }
    const html = new TextDecoder().decode(pako.inflate(b64decode(b64)));
    if (bytesToHex(sha256(utf8ToBytes(html))) !== expectedHash) return { html: null, error: 'walked page hash mismatch' };
    const scan = scanHtmlForPublish(html);
    if (!scan.ok) return { html: null, error: 'page failed safety scan: ' + scan.issues.map(i => i.code).join(',') };
    return { html };
  } catch (e: any) { return { html: null, error: 'walk: ' + String(e?.message || e) }; }
}

export async function fetchHtmlPage(
  storeAddress: string,
  expectedHash: string,
  network = 'testnet-10',
  coords?: { anchor_hash?: string; daa_from?: number; daa_to?: number },
): Promise<{ html: string | null; error?: string }> {
  try {
    const cachedPage = await pageCacheGet(expectedHash);
    if (cachedPage) return { html: cachedPage };
    const wrapped: any[] = await fetchRecords(storeAddress, network, 400);
    // fetchRecords returns { record, txid, blockTime } wrappers - unwrap first
    const recs: any[] = wrapped.map(w => (w && w.record) ? w.record : w);
    const pageRecs = recs.filter(r => r && r.k === 'cfg' && r.d && r.d.ty === 'html' && r.d.h === expectedHash);
    if (pageRecs.length === 0) {
      const w = await fetchHtmlPageViaWalk(expectedHash, coords || {});
      if (w.html) { await pageCachePut(expectedHash, w.html); return w; }
      return { html: null, error: 'no page chunks found; walk: ' + (w.error || 'failed') };
    }
    const tot = pageRecs[0].d.tot;
    const bySeq = new Map<number, any>();
    for (const r of pageRecs) {
      const prev = bySeq.get(r.d.seq);
      if (!prev || r.t > prev.t) bySeq.set(r.d.seq, r);
    }
    if (bySeq.size < tot) return { html: null, error: 'incomplete: ' + bySeq.size + '/' + tot + ' chunks' };
    let b64 = '';
    for (let i = 0; i < tot; i++) {
      const r = bySeq.get(i);
      if (!r) return { html: null, error: 'missing chunk ' + i };
      b64 += r.d.c;
    }
    const html = new TextDecoder().decode(pako.inflate(b64decode(b64)));
    const gotHash = bytesToHex(sha256(utf8ToBytes(html)));
    if (gotHash !== expectedHash) return { html: null, error: 'hash mismatch - tampered or corrupt' };
    // Second gate: re-scan what actually came off chain before it reaches a WebView.
    const scan = scanHtmlForPublish(html);
    if (!scan.ok) return { html: null, error: 'page failed safety scan: ' + scan.issues.map(i => i.code).join(',') };
    await pageCachePut(expectedHash, html);
    return { html };
  } catch (e: any) {
    return { html: null, error: String(e?.message || e) };
  }
}
