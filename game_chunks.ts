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
    const FS = require('expo-file-system');
    const dir = FS.documentDirectory + 'kv_games/';
    await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    return dir + head + '.html';
  } catch { return null; }
}
async function gameCacheLoad(head: string, wantSha: string): Promise<string | null> {
  try {
    const FS = require('expo-file-system');
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
    const FS = require('expo-file-system');
    const p = await gameCachePath(head);
    if (p) await FS.writeAsStringAsync(p, html);
  } catch { /* cache is best-effort */ }
}

export async function fetchGamePuzzle(
  manifestAddress: string, manifestHash: string, pinnedHead: string, network = 'testnet-10',
  onProgress?: (have: number, total: number) => void,
): Promise<{ html: string | null; error?: string }> {
  try {
    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network);
    const m = config as GameManifest;
    {
      const cached = await gameCacheLoad(pinnedHead, m.html_sha256);
      if (cached) { onProgress && onProgress(m.frags.length, m.frags.length); return { html: cached }; }
    }
    if (!m || m.kind !== 'kv_game_manifest' || m.v !== 2) return { html: null, error: 'manifest: ' + (error || 'bad kind') };
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
