// kv_build_chain.ts — on-phone port of make_chain.cjs (universal publishing, #7).
// Any HTML -> wallet-safe chain edition -> <=60 KB hash-chained fragments -> bundle for runPublish.
// Same rewrite rules, same fragmenting, same hash chain => same HEAD as make_chain.cjs for the same input.
// Chunk counts use the real publisher (htmlToChunkData), so slot allocation matches what gets sent.
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const FRAG_MAX = 60000, ZERO = '0'.repeat(64), SLOT_MAX = 300, KAS_PER_CHUNK = 0.2;
const shaHex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const blen = (s: string) => utf8ToBytes(s).length;

export interface ChainBuild { ok: boolean; issues: string[]; bundle?: any; head?: string; htmlBytes?: number; chunks?: number; estKas?: number }

export function buildChainBundle(srcHtml: string, game: string): ChainBuild {
  const issues: string[] = [];
  if (!/^[a-z0-9-]{3,48}$/.test(game)) return { ok: false, issues: ['game id must be 3-48 chars of a-z 0-9 -'] };
  const srcSha = shaHex(srcHtml);
  let html = srcHtml;
  // network + clipboard go through the wallet bridge only (identical to make_chain.cjs)
  html = html.replace(/navigator\.clipboard && navigator\.clipboard\.writeText/g, 'window.KV_WNET && KV_WNET.copy');
  html = html.replace(/navigator\.clipboard\.writeText\(/g, 'KV_WNET.copy(');
  html = html.replace(/\bfetch\s*\(/g, 'KV_WNET.req(');
  const STUB = '<script>window.KV_WNET=window.KV_WNET||{req:function(){return Promise.reject(new Error("offline: open KasCity in the KasVillage wallet"));},copy:function(){return Promise.reject(new Error("no clipboard"));}};</script>\n';
  html = STUB + html;
  const htmlSha = shaHex(html), htmlBytes = blen(html);

  // fragments (same algorithm as make_chain.cjs)
  const { htmlToChunkData, scanHtmlForPublish } = require('./html_chunks');
  const frags: any[] = [];
  for (let pos = 0, prev = ZERO; pos < html.length; ) {
    let end = Math.min(html.length, pos + FRAG_MAX);
    while (blen(html.slice(pos, end)) > FRAG_MAX) end -= 256;
    if (end < html.length) { const nl = html.lastIndexOf('\n', end); if (nl > pos + FRAG_MAX / 2) end = nl + 1; }
    if (end < html.length && /[\uD800-\uDBFF]/.test(html[end - 1])) end--;
    const text = html.slice(pos, end), fh = shaHex(text), link = shaHex(prev + fh);
    const nChunks = htmlToChunkData(text).chunks.length;
    frags.push({ i: frags.length, h: fh, prev, link, bytes: blen(text), chunks: nChunks, text });
    prev = link; pos = end;
  }
  if (!frags.length) return { ok: false, issues: ['empty page'] };
  const head = frags[frags.length - 1].link;
  let slot = 0, used = 0;
  for (const f of frags) { if (used + f.chunks > SLOT_MAX) { slot++; used = 0; } f.slot = slot; used += f.chunks; }
  const tot = frags.reduce((a: number, f: any) => a + f.chunks, 0);
  if (slot + 1 > 80) issues.push('too many address slots (' + (slot + 1) + ') - game too large');

  // wallet scans: full page with the game cap, every fragment on its own, visible text through the content filter
  try { const { scanGameForPublish } = require('./game_chunks'); const g = scanGameForPublish(html); if (!g.ok) for (const x of g.issues) issues.push('page: ' + x.code + (x.detail ? ' ' + String(x.detail).slice(0, 60) : '')); } catch (e: any) { issues.push('page scan error: ' + String(e && e.message || e)); }
  for (const f of frags) { try { const r = scanHtmlForPublish(f.text); for (const x of (r.issues || [])) issues.push('fragment ' + f.i + ': ' + x.code); } catch {} }
  try {
    const cf = require('./content_filter'); const scan = cf.scanObjectStrict || cf.scanObject;
    // KV_ENTITY_DECODE: entity-decoded, tags stripped with AND without spaces ("s<b></b>eed phrase")
    const visible: string[] = (typeof cf.htmlTextForms === 'function' ? cf.htmlTextForms(srcHtml)
      : [srcHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')]).map((v: string) => v.replace(/\s+/g, ' ').slice(0, 200000));
    // KV_SCRIPT_STRINGS: canvas games draw text from JS - scan string literals too
    const lits: string[] = []; const _re = /(["'`])((?:\\.|(?!\1)[^\\\n]){4,300})\1/g; let _m: any; let _n = 0;
    while ((_m = _re.exec(srcHtml)) && _n < 20000) { _n++; if (/[a-z]{3,}[\s&;<>]+[a-z]{2,}|&#?[a-z0-9]+;|<\//i.test(_m[2])) lits.push(_m[2]); }
    const r = scan({ text: visible, strings: lits });
    if (r && r.ok === false) issues.push('content: ' + r.reason);
  } catch (e: any) { issues.push('content scan error: ' + String((e && e.message) || e).slice(0, 60)); }

  const manifest = {
    kind: 'kv_game_manifest', v: 2, game, build: game, source_sha256: srcSha,
    html_sha256: htmlSha, html_bytes: htmlBytes, head, frag_max: FRAG_MAX, total_chunks: tot, est_kas: +(tot * KAS_PER_CHUNK).toFixed(1),
    slots: slot + 1, frags: frags.map((f) => ({ i: f.i, h: f.h, link: f.link, bytes: f.bytes, chunks: f.chunks, slot: f.slot })),
    addresses: new Array(slot + 1).fill(null), music: null,
  };
  // solve the puzzle exactly as the wallet will
  let pl = ZERO, joined = '';
  for (const fr of manifest.frags) { const t = frags[fr.i].text; if (shaHex(t) !== fr.h || shaHex(pl + fr.h) !== fr.link) { issues.push('chain broken at ' + fr.i); break; } pl = fr.link; joined += t; }
  if (pl !== head || shaHex(joined) !== htmlSha) issues.push('puzzle does not solve to the page');
  const bundle = { manifest, frags: frags.map((f) => ({ kind: 'kv_frag', v: 1, game, i: f.i, n: frags.length, h: f.h, prev: f.prev, link: f.link, bytes: f.bytes, text: f.text })) };
  return { ok: issues.length === 0, issues, bundle, head, htmlBytes, chunks: tot, estKas: manifest.est_kas };
}

/** Deterministic, collision-resistant nonce base per (publisher, game): 2,000,000 + k*100, k < 100,000. */
export function nonceBaseFor(pubkeyHex: string, game: string): number {
  return 2000000 + (parseInt(shaHex(pubkeyHex + ':' + game).slice(0, 8), 16) % 100000) * 100;
}
