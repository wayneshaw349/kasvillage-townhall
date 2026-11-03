// ============================================================================
// kv_pp_index.ts — KV_PP_INDEX: the village-wide Kaspa purchasing-power index
// ============================================================================
// Opt-in: after a price check is saved, the pair can be shared as a tiny signed
// record on chain. The record carries ONLY { currency, discount (basis points),
// category, time } - never the item name, store, amounts, wallet balance or place.
//
//   record : { k:'pp', v:1, o:<pubkey>, t:<day, rounded>, d:{ ccy:'GBP', bp:1800, cat:'food' } }
//   PRIVACY 2026-11-02: no listing code and no outside price are shared; time is rounded to the UTC day.
//   The Big-Mac style cross-country view is computed only from this phone's own checks.
//   where  : registryAddress('pp-index')  (same rendezvous trick as the registries)
//   cost   : REPOST_SOMPI (0.2 KAS) dust + fee - spam has a price
//
// Read side (every wallet computes its own; the relay is a cache, not an authority):
//   - signature-verified, sane fields, last 90 days
//   - counts only posters who pass kvFlaggerQualifies (live 10+ KAS pledge or a
//     settled escrow trade) - same bar as flags, checked with a time budget
//   - at most 3 checks per poster per UTC day
//   - aggregate = MEDIAN per currency, then the mean of currency medians
//     (medians blunt outlier-pumping; equal weight so one country can't drown the rest)
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

export const PP_CATS = ['electronics', 'clothing', 'food', 'home', 'tools', 'toys', 'beauty', 'auto', 'services', 'other'] as const;
export type PpCat = (typeof PP_CATS)[number];
const SHARE_PREF = 'kv_pp_share'; // '1' always · '0' never · unset = ask

export interface PpIndex {
  n: number;            // counted checks
  countries: number;    // currencies represented
  avg: number;          // mean of currency medians (discount, -0.9..0.9)
  perCcy: { ccy: string; n: number; med: number }[];
  perCat: { cat: string; n: number; med: number }[];
  cross: { ccy: string; level: number; items: number }[]; // KV_PP_CROSS: price level vs other countries, same items, in USD (1 = average)
  crossItems: number;
  posters: number;      // qualified posters counted
  unverified: number;   // records skipped because the gate could not be checked in budget
  at: number;
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function ownerKeys(): Promise<any | null> {
  try {
    const SS = require('expo-secure-store');
    const net = require('./kv_net').KV_NET;
    let sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
    if (net === 'mainnet') sender = (await SS.getItemAsync('kaspa_address_real')) || sender;
    const priv = await require('./proposal_share')._kvResolvePrivHex();
    if (!sender || !priv) return null;
    const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
    return { privateKeyHex: priv, pubkeyHex: pub, address: sender, network: net };
  } catch { return null; }
}

export async function ppSharePref(): Promise<'ask' | 'always' | 'never'> {
  try { const v = await AsyncStorage.getItem(SHARE_PREF); return v === '1' ? 'always' : v === '0' ? 'never' : 'ask'; } catch { return 'ask'; }
}
export async function ppSetSharePref(v: 'always' | 'never'): Promise<void> { try { await AsyncStorage.setItem(SHARE_PREF, v === 'always' ? '1' : '0'); } catch {} }

/** Same listing -> same code everywhere (name + village KAS price). A hash, not the name. */
export function ppItemKey(name: string, kas: number): string {
  const { sha256 } = require('@noble/hashes/sha256'); const { utf8ToBytes } = require('@noble/hashes/utils');
  const norm = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return bytesToHex(sha256(utf8ToBytes('KV_ITEM|' + norm + '|' + String(Number(kas) || 0)))).slice(0, 16);
}

/** KV_PP_CROSS: Big-Mac style. For items checked in 2+ currencies, each currency's USD price vs the item's
 *  cross-country median; averaged over items. level 0.7 = the same goods cost 30% less there (in USD). */
export function crossLevels(rows: { ccy: string; ik: string; usd: number }[]): { cross: { ccy: string; level: number; items: number }[]; crossItems: number } {
  const byItem: Record<string, Record<string, number[]>> = {};
  for (const r of rows) {
    if (!r.ik || !(r.usd > 0)) continue;
    const m = (byItem[r.ik] = byItem[r.ik] || {});
    (m[r.ccy] = m[r.ccy] || []).push(r.usd);
  }
  const acc: Record<string, number[]> = {}; let items = 0;
  for (const ik of Object.keys(byItem)) {
    const per = Object.keys(byItem[ik]).map((c) => ({ c, v: median(byItem[ik][c]) }));
    if (per.length < 2) continue;
    items++;
    const base = median(per.map((p) => p.v)); if (!(base > 0)) continue;
    for (const p of per) (acc[p.c] = acc[p.c] || []).push(p.v / base);
  }
  const cross = Object.keys(acc).map((c) => ({ ccy: c, level: acc[c].reduce((a, b) => a + b, 0) / acc[c].length, items: acc[c].length })).sort((a, b) => a.level - b.level);
  return { cross, crossItems: items };
}

/** Post one check to the index. d = discount (-0.9..0.9), cat from PP_CATS; ik/usd feed the cross-country view. */
export async function ppShare(ccy: string, d: number, cat: PpCat, ik?: string, usd?: number): Promise<{ error?: string; txId?: string }> {
  try { if (require('./kv_tutorial').kvIsTutorial()) return { error: 'Sharing needs Real mode.' }; } catch {}
  const bp = Math.round(Math.max(-0.9, Math.min(0.9, Number(d))) * 10000);
  if (!isFinite(bp)) return { error: 'Bad value.' };
  const c = String(ccy || '').toUpperCase();
  if (!require('./kv_fx').CURRENCIES.some((x: any) => x.code === c)) return { error: 'Unknown currency.' };
  const owner = await ownerKeys(); if (!owner) return { error: 'Wallet identity unavailable.' };
  const { signRecord, buildPayloadHex } = require('./kaspa_payload');
  const { registryAddress, REPOST_SOMPI } = require('./payload_publish');
  const cat2: PpCat = (PP_CATS as readonly string[]).includes(cat) ? cat : 'other';
  const dd: any = { ccy: c, bp, cat: cat2 }; // PRIVACY 2026-11-02: ik/usd are never shared (kept for the call signature only)
  const day = Math.floor(Date.now() / 86400000) * 86400000; // rounded to the UTC day
  const rec = signRecord({ v: 1, k: 'pp', t: day, o: owner.pubkeyHex, d: dd } as any, owner.privateKeyHex);
  const res = await require('./kaspa_rest_tx').sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: registryAddress('pp-index', owner.network),
    amountSompi: REPOST_SOMPI, // 0.2 KAS dust (0.1 trips the KIP-9 storage-mass floor)
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  if (!res?.success) return { error: String(res?.error || 'send failed') };
  return { txId: res.txId };
}

/** Compute the index on this phone. Qualification checks are budgeted like flag tallies. */
export async function ppFetchIndex(budgetMs = 15000): Promise<PpIndex> {
  const g: any = globalThis as any;
  if (g.__kvPpIdx && Date.now() - g.__kvPpIdx.at < 10 * 60 * 1000) return g.__kvPpIdx; // 10-min cache
  const net = require('./kv_net').KV_NET;
  const kp = require('./kaspa_payload');
  const { registryAddress } = require('./payload_publish');
  const CODES = new Set(require('./kv_fx').CURRENCIES.map((x: any) => x.code));
  const rows: any[] = (await kp.fetchRecords(registryAddress('pp-index', net), net, 100, 5)) || [];
  // sane, signed, fresh
  const fresh = rows.filter(({ record: r, blockTime }: any) => {
    if (!r || r.k !== 'pp' || !r.d) return false;
    const bp = Number(r.d.bp);
    if (!isFinite(bp) || bp < -9000 || bp > 9000) return false;
    if (!CODES.has(String(r.d.ccy || '').toUpperCase())) return false;
    const t = Number(r.t || blockTime || 0);
    if (t > Date.now() + 2 * 3600 * 1000 || Date.now() - t > 90 * 86400000) return false;
    return kp.verifyRecord(r);
  });
  // newest first; at most 3 per poster per UTC day
  fresh.sort((a: any, b: any) => Number(b.record.t) - Number(a.record.t));
  const perDay = new Map<string, number>();
  const kept: any[] = [];
  for (const row of fresh) {
    const r = row.record;
    const key = r.o + ':' + Math.floor(Number(r.t) / 86400000);
    const n = perDay.get(key) || 0;
    if (n >= 3) continue;
    perDay.set(key, n + 1);
    kept.push(r);
  }
  // gate: same bar as flags, with a time budget; cached per session in __kvQualCache
  const deadline = Date.now() + budgetMs;
  let checks = 0, unverified = 0;
  const counted: any[] = [];
  const posters = new Set<string>();
  for (const r of kept) {
    const cached = !!(g.__kvQualCache && g.__kvQualCache.has(r.o));
    if (!cached && (checks >= 25 || Date.now() > deadline)) { unverified++; continue; }
    if (!cached) checks++;
    let ok = false; try { ok = await kp.kvFlaggerQualifies(r.o, net); } catch {}
    if (!ok) continue;
    counted.push(r); posters.add(r.o);
  }
  const byCcy: Record<string, number[]> = {}; const byCat: Record<string, number[]> = {};
  for (const r of counted) {
    const d = Number(r.d.bp) / 10000;
    (byCcy[String(r.d.ccy).toUpperCase()] = byCcy[String(r.d.ccy).toUpperCase()] || []).push(d);
    const cat = (PP_CATS as readonly string[]).includes(r.d.cat) ? r.d.cat : 'other';
    (byCat[cat] = byCat[cat] || []).push(d);
  }
  const perCcy = Object.keys(byCcy).map((c) => ({ ccy: c, n: byCcy[c].length, med: median(byCcy[c]) })).sort((a, b) => b.n - a.n);
  const perCat = Object.keys(byCat).map((c) => ({ cat: c, n: byCat[c].length, med: median(byCat[c]) })).sort((a, b) => b.n - a.n);
  const cx = crossLevels(counted.filter((r) => /^[0-9a-f]{16}$/.test(String(r.d.ik || '')) && Number(r.d.u) > 0 && Number(r.d.u) < 1e11)
    .map((r) => ({ ccy: String(r.d.ccy).toUpperCase(), ik: String(r.d.ik), usd: Number(r.d.u) / 100 })));
  const idx: PpIndex = {
    n: counted.length,
    countries: perCcy.length,
    avg: perCcy.length ? perCcy.reduce((p, c) => p + c.med, 0) / perCcy.length : 0,
    perCcy, perCat, posters: posters.size, unverified, at: Date.now(), cross: cx.cross, crossItems: cx.crossItems,
  };
  g.__kvPpIdx = idx;
  return idx;
}
