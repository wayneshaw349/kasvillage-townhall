// game_chunks.ts — on-chain GAMES as a hash-chained puzzle of <=60 KB pages.
//
// make_chain414.cjs cuts the game into fragments of <=60,000 bytes. Each
// fragment is an ordinary page for html_chunks.ts: it passes the EXISTING
// scanHtmlForPublish on its own (60 KB cap included), is published with the
// EXISTING publishHtmlChunks and fetched with the EXISTING fetchHtmlPage
// (which re-checks its hash and re-scans it). Nothing in html_chunks.ts changes.
//
// The pieces are chained:  link_i = sha256(link_{i-1} + h_i),  link_{-1} = 0*64.
// The last link (HEAD) commits to every fragment AND their order, so the
// wallet pins one value per build (TRUSTED_GAMES) and can trust any manifest
// that solves to it. The manifest itself rides the existing config rail
// (config_chunks.ts publishConfigChunks / fetchStoreConfig).
//
// After the puzzle solves, the full page must match manifest.html_sha256 and
// pass the same scan rules with the 8 MB game cap. Network and clipboard are
// still absent: the game reaches both only through kv_net_bridge.ts.

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { publishHtmlChunks, fetchHtmlPage, scanHtmlForPublish, HtmlScanIssue } from './html_chunks';
import { publishConfigChunks, fetchStoreConfig } from './config_chunks';
import type { OwnerKeys } from './payload_publish';

export const GAME_MAX_BYTES = 8_000_000;
const ZERO = '0'.repeat(64);

// HEAD per released build. Only a manifest that solves to a pinned HEAD runs.
export const TRUSTED_GAMES: Record<string, string> = {
  'kascity-414-chain': 'ef0c3a6ff34488044747589b3ee301c238879f496f60bf7bfb6c9fa7292ff63a',
};

export interface FragRef { i: number; h: string; link: string; bytes: number; chunks: number; slot: number }
export interface GameManifest {
  kind: 'kv_game_manifest'; v: 2; game: string; build: string;
  html_sha256: string; html_bytes: number; head: string; frag_max: number;
  frags: FragRef[]; addresses: Array<string | null>;
}
export interface FragFile { kind: 'kv_frag'; v: 1; i: number; n: number; h: string; prev: string; link: string; text: string }

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

export function scanGameForPublish(html: string): { ok: boolean; issues: HtmlScanIssue[] } {
  const issues = scanHtmlForPublish(html).issues.filter((i) => i.code !== 'too_large');
  const n = utf8ToBytes(html).length;
  if (n > GAME_MAX_BYTES) issues.push({ code: 'too_large', detail: n + ' bytes' });
  return { ok: issues.length === 0, issues };
}

/** Walks the chain. Returns the HEAD it solves to, or an error. */
export function verifyChain(m: GameManifest): { head: string | null; error?: string } {
  let prev = ZERO;
  for (let k = 0; k < m.frags.length; k++) {
    const f = m.frags[k];
    if (f.i !== k) return { head: null, error: 'fragment order broken at ' + k };
    if (hex(prev + f.h) !== f.link) return { head: null, error: 'link broken at fragment ' + k };
    prev = f.link;
  }
  return prev === m.head ? { head: prev } : { head: null, error: 'chain does not end at HEAD' };
}

// ---------------------------------------------------------------------------
// PUBLISH: fragments first (each through the normal 60 KB page path, scan on),
// one address per slot; then the manifest (with addresses) on the config rail.
// ---------------------------------------------------------------------------
export async function publishGamePuzzle(
  owner: OwnerKeys, manifest: GameManifest, frags: FragFile[], slotAddresses: string[], manifestAddress: string,
  onProgress?: (fragDone: number, fragTotal: number) => void,
): Promise<{ success: boolean; manifestHash?: string; error?: string }> {
  if (verifyChain(manifest).head !== manifest.head) return { success: false, error: 'manifest chain invalid' };
  const slots = Math.max(...manifest.frags.map((f) => f.slot)) + 1;
  if (slotAddresses.length !== slots) return { success: false, error: 'need ' + slots + ' slot addresses' };
  for (const f of frags) {
    const ref = manifest.frags[f.i];
    if (!ref || hex(f.text) !== ref.h) return { success: false, error: 'fragment ' + f.i + ' does not match manifest' };
    const res = await publishHtmlChunks(owner, slotAddresses[ref.slot], f.text);   // existing path, scan ON
    if (!res.success || res.hash !== ref.h) return { success: false, error: 'fragment ' + f.i + ': ' + (res.error || 'hash mismatch') };
    onProgress?.(f.i + 1, frags.length);
  }
  const final: GameManifest = { ...manifest, addresses: slotAddresses };
  const pub = await publishConfigChunks(owner, manifestAddress, final);
  if (!pub.success) return { success: false, error: 'manifest: ' + pub.error };
  return { success: true, manifestHash: pub.hash };   // announce this as the dapp's gameHash
}

// ---------------------------------------------------------------------------
// FETCH: manifest -> pinned HEAD -> every fragment via fetchHtmlPage (parallel,
// 6 at a time) -> join in chain order -> full SHA -> full scan (8 MB cap).
// ---------------------------------------------------------------------------
// ---- device cache: the chain is delivery, the phone is the runtime --------
async function gameCachePath(head: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system/legacy');
    const dir = FS.documentDirectory + 'kv_games/';
    await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    return dir + head + '.html';
  } catch { return null; }
}
async function gameCacheLoad(head: string, wantSha: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system/legacy');
    const p = await gameCachePath(head);
    if (!p) return null;
    const info = await FS.getInfoAsync(p);
    if (!info.exists) return null;
    const html = await FS.readAsStringAsync(p);
    if (bytesToHex(sha256(utf8ToBytes(html))) !== wantSha) { await FS.deleteAsync(p, { idempotent: true }).catch(() => {}); return null; }
    return html;
  } catch { return null; }
}
async function gameCacheSave(head: string, html: string): Promise<void> {
  try {
    const FS = require('expo-file-system/legacy');
    const p = await gameCachePath(head);
    if (p) {
      await FS.writeAsStringAsync(p, html);
      // sidecar meta: lets the cache self-verify WITHOUT the manifest, so a
      // cached game plays even when no relay serves the chunk records.
      await FS.writeAsStringAsync(p.replace(/\.html$/, '.json'),
        JSON.stringify({ sha: bytesToHex(sha256(utf8ToBytes(html))), at: Date.now() })).catch(() => {});
    }
  } catch { /* cache is best-effort */ }
}
// Cache-first load that needs NOTHING from the network: verifies the file
// against its sidecar meta. The file was only ever written after full
// hash-chain + sha verification, and the app sandbox is private, so a
// missing sidecar (legacy cache) is backfilled from the file once.
async function gameCacheLoadOffline(head: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system/legacy');
    const p = await gameCachePath(head);
    if (!p) return null;
    const info = await FS.getInfoAsync(p);
    if (!info.exists) return null;
    const html = await FS.readAsStringAsync(p);
    const gotSha = bytesToHex(sha256(utf8ToBytes(html)));
    const mp = p.replace(/\.html$/, '.json');
    const mInfo = await FS.getInfoAsync(mp);
    if (mInfo.exists) {
      try {
        const meta = JSON.parse(await FS.readAsStringAsync(mp));
        if (meta && meta.sha && meta.sha !== gotSha) { await FS.deleteAsync(p, { idempotent: true }).catch(() => {}); return null; }
      } catch {}
    } else {
      await FS.writeAsStringAsync(mp, JSON.stringify({ sha: gotSha, at: Date.now() })).catch(() => {});
    }
    return html;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// INSTALL VIA COORDINATES - the phone as its own indexer (inside the window).
// ---------------------------------------------------------------------------
const KV_WALK_RELAY = 'https://kasvillage.app.runonflux.io';
function kvB64ToBytes(b64: string): Uint8Array {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const s2 = String(b64 || '').replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (let i = 0; i < s2.length; i++) { buf = (buf << 6) | abc.indexOf(s2[i]); bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } }
  return Uint8Array.from(out);
}
async function fetchGameViaWalk(
  manifestHash: string, pinnedHead: string,
  coords: { anchor_hash: string; daa_from?: number; daa_to: number },
  network: string,
  onProgress?: (have: number, total: number) => void,
): Promise<{ html: string | null; error?: string }> {
  try {
    const pako = require('pako');
    const sink = await (await fetch(KV_WALK_RELAY + '/api/kaspa/sink')).json();
    const vdaa = Number(sink.virtual_daa_score || 0);
    const daaTo = Number(coords.daa_to);
    if (vdaa && vdaa - daaTo > 1100000) return { html: null, error: 'publish window (~30h) closed - needs a republish' };
    const store: Record<string, { t: number; tot: number; c: string }> = {};
    const mstore: Record<number, { t: number; tot: number; c: string }> = {};
    let low = String(coords.anchor_hash);
    let pages = 0, retries = 0;
    while (pages < 450) {
      let page: any;
      try { page = await (await fetch(KV_WALK_RELAY + '/api/kaspa/blocks?low_hash=' + low + '&daa_max=' + (daaTo + 600) + '&txs=1')).json(); }
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
          if (d.ty === 'html' && d.h && typeof d.seq === 'number') {
            const k = d.h + ':' + d.seq;
            if (!store[k] || (rec.t || 0) > store[k].t) store[k] = { t: rec.t || 0, tot: d.tot, c: d.c };
          } else if (!d.ty && d.h === manifestHash && typeof d.seq === 'number') {
            if (!mstore[d.seq] || (rec.t || 0) > mstore[d.seq].t) mstore[d.seq] = { t: rec.t || 0, tot: d.tot, c: d.c };
          }
        } catch {}
      }
      if (page.done || !page.next_low_hash) break;
      low = page.next_low_hash;
    }
    const m0 = mstore[0];
    if (!m0) return { html: null, error: 'walk found no manifest chunks in span' };
    let mb64 = '';
    for (let i = 0; i < m0.tot; i++) { const c = mstore[i]; if (!c) return { html: null, error: 'walk missing manifest chunk ' + i }; mb64 += c.c; }
    const mjson = new TextDecoder().decode(pako.inflate(kvB64ToBytes(mb64)));
    if (hex(mjson) !== manifestHash) return { html: null, error: 'walked manifest hash mismatch' };
    const m = JSON.parse(mjson) as GameManifest;
    if (m.kind !== 'kv_game_manifest' || m.v !== 2) return { html: null, error: 'walked manifest: bad kind' };
    if (m.head !== pinnedHead) return { html: null, error: 'walked manifest HEAD is not the pinned build' };
    const vc = verifyChain(m);
    if (!vc.head) return { html: null, error: vc.error };
    const texts: string[] = new Array(m.frags.length);
    let have = 0;
    for (const f of m.frags) {
      const f0 = store[f.h + ':0'];
      if (!f0) return { html: null, error: 'walk missing fragment ' + f.i };
      let b64 = '';
      for (let i = 0; i < f0.tot; i++) { const c = store[f.h + ':' + i]; if (!c) return { html: null, error: 'walk missing chunk ' + i + ' of fragment ' + f.i }; b64 += c.c; }
      const text = new TextDecoder().decode(pako.inflate(kvB64ToBytes(b64)));
      if (hex(text) !== f.h) return { html: null, error: 'walked fragment ' + f.i + ' hash mismatch' };
      texts[f.i] = text;
      onProgress?.(++have, m.frags.length);
    }
    const html = texts.join('');
    if (hex(html) !== m.html_sha256) return { html: null, error: 'walked page hash mismatch' };
    const scan = scanGameForPublish(html);
    if (!scan.ok) return { html: null, error: 'game failed safety scan: ' + scan.issues.map((i: any) => i.code).join(',') };
    await gameCacheSave(pinnedHead, html);
    return { html };
  } catch (e: any) { return { html: null, error: String(e?.message || e) }; }
}

export async function fetchGamePuzzle(
  manifestAddress: string, manifestHash: string, pinnedHead: string, network = 'testnet-10',
  onProgress?: (have: number, total: number) => void,
  coords?: { anchor_hash?: string; daa_from?: number; daa_to?: number },
): Promise<{ html: string | null; error?: string }> {
  try {
    // CACHE FIRST: the phone is the runtime. A verified cached copy plays
    // with zero network - the manifest fetch below is only for first installs
    // and updates, so a recycled relay can never brick an installed game.
    {
      const cachedOff = await gameCacheLoadOffline(pinnedHead);
      if (cachedOff) { onProgress && onProgress(1, 1); return { html: cachedOff }; }
    }
    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network);
    const m = config as GameManifest;
    if (config) {
      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);
      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }
    }
    if (!m || m.kind !== 'kv_game_manifest' || m.v !== 2) {
      // THIRD FALLBACK - install via coordinates. No indexer answered, so the
      // phone reads the chain itself: walk anchor_hash -> daa_to through the
      // stateless /blocks passthrough (any node), collect this game's chunk
      // records from raw blocks, verify everything. Works while the publish
      // window (~30h) is open; the same walk the PC harvest proved.
      if (coords && /^[0-9a-f]{64}$/.test(String(coords.anchor_hash || '')) && Number(coords.daa_to) > 0) {
        const w = await fetchGameViaWalk(manifestHash, pinnedHead, coords as any, network, onProgress);
        if (w.html) return w;
        return { html: null, error: 'manifest: ' + (error || 'no records') + '; walk: ' + (w.error || 'failed') };
      }
      return { html: null, error: 'manifest: ' + (error || 'bad kind') };
    }
    if (m.head !== pinnedHead) return { html: null, error: 'manifest HEAD is not the pinned build' };
    const vc = verifyChain(m);
    if (!vc.head) return { html: null, error: vc.error };
    if (m.addresses.some((a) => !a)) return { html: null, error: 'manifest has unpublished slots' };

    const texts: string[] = new Array(m.frags.length);
    let next = 0, have = 0, fail: string | null = null;
    const worker = async () => {
      while (!fail && next < m.frags.length) {
        const f = m.frags[next++];
        const r = await fetchHtmlPage(m.addresses[f.slot]!, f.h, network);   // existing: hash + 60 KB scan
        if (!r.html) { fail = 'fragment ' + f.i + ': ' + r.error; return; }
        texts[f.i] = r.html; onProgress?.(++have, m.frags.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (fail) return { html: null, error: fail };

    const html = texts.join('');
    if (hex(html) !== m.html_sha256) return { html: null, error: 'solved page hash mismatch' };
    const scan = scanGameForPublish(html);
    if (!scan.ok) return { html: null, error: 'game failed safety scan: ' + scan.issues.map((i) => i.code).join(',') };
    await gameCacheSave(pinnedHead, html);
    return { html };
  } catch (e: any) {
    return { html: null, error: String(e?.message || e) };
  }
}
