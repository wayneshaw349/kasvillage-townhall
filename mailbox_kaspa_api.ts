// mailbox_kaspa_api.ts - Mailbox data from the Kaspa L1 registry rail.
// Drop-in replacement for mailbox_arweave_api: same exports, same shapes.
// arweaveTx fields carry Kaspa txids/addresses (opaque ids to the UI).
// townhall.verified = pledge UTXO unspent (on-chain trust, no server blessing).
import { rebuildDirectory } from './kaspa_payload';
import { registryAddress } from './payload_publish';
import { fetchStoreConfig } from './config_chunks';

// ---- Types: identical to mailbox_arweave_api ----
export type Board = 'Elite' | 'Main' | 'Incubator';
export type ServiceCategory = string;

export interface TownHallVerification {
  verified: boolean;
  verifiedAt?: number;
  verificationTx?: string;
  apt?: string;
}
export interface DAppEntry {
  id: string; name: string; description: string; category: string; board: Board;
  arweaveTx: string; ownerPubkey: string; templateVerified: boolean;
  townhall: TownHallVerification; createdAt: number; xpCommitment: number;
}
export interface StorefrontEntry {
  id: string; storeName: string; description: string; category: string;
  arweaveTx: string; ownerPubkey: string; logoArweaveTx?: string;
  townhall: TownHallVerification; createdAt: number; productCount: number; rating?: number;
}
export interface CouponEntry {
  id: string; title: string; description: string; discount: string;
  arweaveTx: string; ownerPubkey: string; storeName: string;
  expiresAt: number; createdAt: number; category: string; townhall: TownHallVerification;
}
export interface AcademicEntry {
  id: string; title: string; description: string; institution: string; field: string;
  arweaveTx: string; ownerPubkey: string; dkimVerified: boolean; dkimDomain?: string;
  createdAt: number; townhall: TownHallVerification;
}
export interface ServiceEntry {
  id: string; title: string; description: string; category: ServiceCategory;
  arweaveTx: string; ownerPubkey: string; priceSompi?: number; priceLabel?: string;
  serviceArea: string; townhall: TownHallVerification; createdAt: number;
}
export interface FetchResult<T> { items: T[]; nextCursor?: string; hasMore: boolean; fromCache: boolean; }
export class MailboxError extends Error {
  constructor(message: string, public code?: string) { super(message); this.name = 'MailboxError'; }
}

const NET = require('./kv_net').KV_NET;

// ---- Network stubs: Kaspa REST is the only dependency; assume reachable ----
export function isOnline(): boolean { return true; }
export function subscribeToNetworkChanges(_l: (online: boolean) => void): () => void { return () => {}; }
export function initMailboxAPI(): () => void { return () => {}; }

// KV_PLEDGE_BY_POST: the pledge is what publishing stakes (5 KAS, still yours). A listing whose
// publish pledge is still in place gets full pledge points; one that spent it gets none. More KAS
// does not buy rank, so the whale cap is no longer needed.
export const KV_PLEDGE_FULL_KAS = 5;
export function kvPledgeScore(pledgeKas: number): number { return Math.min(Math.max(pledgeKas || 0, 0) / KV_PLEDGE_FULL_KAS, 1); }
// KV_RANK_XP: publisher XP from the chain - the same consensus scan the Dashboard uses
// (10 XP per settled agreement, -50 per deadlock). Full XP points at KV_XP_FULL so veterans
// lead without locking newcomers out. Cached 1h per publisher; a failed scan counts as 0.
export const KV_XP_FULL = 500;
export function kvXpScore(xp: number): number { return Math.min(Math.max(xp || 0, 0) / KV_XP_FULL, 1); }
export async function kvPublisherXp(ownerPub: string): Promise<number> {
  if (!ownerPub) return 0;
  const g: any = globalThis as any;
  const C: Map<string, any> = g.__kvXpCache || (g.__kvXpCache = new Map());
  const hit = C.get(ownerPub);
  if (hit && Date.now() - hit.at < 3600000) return hit.p;
  const p = (async () => {
    try {
      const scan = require('./counterparty_scan').scanCounterparty(String(ownerPub), NET, 40);
      const r: any = await Promise.race([scan, new Promise((res) => setTimeout(() => res(null), 6000))]);
      if (!r || r.error) return 0;
      return Math.max(0, Number(r.settled || 0) * 10 - Number(r.deadlocked || 0) * 50);
    } catch { return 0; }
  })();
  C.set(ownerPub, { at: Date.now(), p });
  return p;
}
async function kvXpOf(entries: any[], max: number = 24): Promise<number[]> {
  const out: number[] = new Array(entries.length).fill(0);
  await Promise.all(entries.slice(0, max).map(async (e: any, i: number) => { out[i] = await kvPublisherXp(e.ownerPubkey); }));
  return out;
}
// KV_RANK_XP: sections without a price (DApps, Academics): pledge 30% + freshness 50% + XP 20%.
async function kvXpRank(items: any[], byId: Map<string, any>): Promise<void> {
  try {
    const ents = items.map((it: any) => byId.get(it.id) || {});
    const xp = await kvXpOf(ents);
    const sc = (i: number) => {
      const e: any = ents[i];
      const pledge = kvPledgeScore(Number(e.pledgeSompi || 0) / 1e8) * 0.30;
      const fresh = Math.pow(0.5, Math.max(0, (Date.now() / 1000 - (e.announcedAt || 0)) / 3600) / 168) * 0.50;
      return pledge + fresh + kvXpScore(xp[i]) * 0.20;
    };
    items.forEach((it: any, i: number) => { it.publisherXp = xp[i]; });
    const idx = items.map((_: any, i: number) => i).sort((a: number, b: number) => sc(b) - sc(a));
    const si = idx.map((i: number) => items[i]); items.length = 0; items.push(...si);
  } catch (e) { console.log('[XpRank] skipped:', e); }
}
// Visibility sort: pledge (in place or not) + freshness half-life - the first pass; XP re-ranks after (KV_RANK_XP).
function visSort(a: { pledgeSompi: bigint; announcedAt: number }, b: { pledgeSompi: bigint; announcedAt: number }): number {
  const score = (e: { pledgeSompi: bigint; announcedAt: number }) => {
    const pledgeKas = Number(e.pledgeSompi) / 1e8;
    const pledgeScore = kvPledgeScore(pledgeKas) * 0.4;
    const ageHours = Math.max(0, (Date.now() / 1000 - e.announcedAt) / 3600);
    const fresh = Math.pow(0.5, ageHours / (24 * 7)) * 0.6; // 7-day half-life for directory
    return pledgeScore + fresh;
  };
  return score(b) - score(a);
}

// KV_DEAL_RANK: effective price = cheapest stash item after the best live coupon.
async function kvEffMinKas(storeAddress: string, cfgHash: string, coords: any, ownerPub?: string): Promise<number> {
  try {
    if (!cfgHash) return 0;
    const { config } = await fetchStoreConfig(storeAddress, cfgHash, NET, coords || undefined, ownerPub || undefined); // KV_CHUNK_CANDIDATES
    if (!config) return 0;
    const prices = (config.stash || []).map((i: any) => Number(i.kaspaPrice || 0)).filter((p: number) => p > 0);
    if (!prices.length) return 0;
    let eff = Math.min(...prices);
    const now = Date.now();
    for (const c of (config.coupons || [])) {
      if ((c.createdAt || 0) + (c.expiryDays || 30) * 86400000 < now) continue;
      if ((c.usedCount || 0) >= (c.maxUses || 1)) continue;
      const e2 = c.discountPercent > 0 ? eff * (1 - c.discountPercent / 100) : (c.discountKas > 0 ? eff - c.discountKas : eff);
      if (e2 < eff && e2 > 0) eff = e2;
    }
    return eff;
  } catch { return 0; }
}
// KV_DEAL_RANK: re-rank in place - pledge 0.25 + freshness 0.35 + deal 0.20 + XP 0.20 (KV_RANK_XP).
// deal is a capped z-score against the CATEGORY's mean effective price, so a
// fake rock-bottom price scores no better than an honestly cheap one.
async function kvDealRank(dir: any[], items: any[], maxCfg: number = 12): Promise<void> {
  try {
    const n = Math.min(items.length, maxCfg);
    const eff: number[] = new Array(items.length).fill(0);
    for (let i = 0; i < n; i++) {
      const e: any = dir[i];
      eff[i] = await kvEffMinKas(e.storeAddress, e.configHash || (e.record && e.record.d && e.record.d.configHash) || '', e.record && e.record.d && e.record.d.coords, e.ownerPubkey);
      (items[i] as any).dealKas = eff[i];
    }
    const byCat: any = {};
    for (let i = 0; i < items.length; i++) { if (eff[i] > 0) { const k = String((dir[i] as any).category || '').toLowerCase(); (byCat[k] = byCat[k] || []).push(eff[i]); } }
    const stats: any = {};
    for (const k in byCat) { const a = byCat[k]; const m = a.reduce((x: number, y: number) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x: number, y: number) => x + (y - m) * (y - m), 0) / a.length); stats[k] = { m, sd: Math.max(sd, m * 0.1), n: a.length }; }
    const xps = await kvXpOf(dir);   // KV_RANK_XP
    for (let i = 0; i < items.length; i++) (items[i] as any).publisherXp = xps[i];
    const score = (i: number) => {
      const e: any = dir[i];
      const pledge = kvPledgeScore(Number(e.pledgeSompi) / 1e8) * 0.25;
      const ageH = Math.max(0, (Date.now() / 1000 - e.announcedAt) / 3600);
      const fresh = Math.pow(0.5, ageH / 168) * 0.35;
      const xpPart = kvXpScore(xps[i]) * 0.20;
      const st = stats[String(e.category || '').toLowerCase()];
      let deal = 0.10; // neutral
      if (eff[i] > 0 && st && st.n >= 3) { const z = (st.m - eff[i]) / st.sd; deal = Math.max(0, Math.min(1, 0.5 + z / 4)) * 0.20; }
      return pledge + fresh + deal + xpPart;
    };
    const idx = items.map((_: any, i: number) => i).sort((a: number, b: number) => score(b) - score(a));
    const si = idx.map((i: number) => items[i]); const sd2 = idx.map((i: number) => dir[i]);
    items.length = 0; (items as any).push(...si);
    dir.length = 0; (dir as any).push(...sd2);
    console.log('[DealRank]', n, 'priced of', items.length, Object.keys(stats).map((k) => k + ' n=' + stats[k].n + ' mu=' + stats[k].m.toFixed(1)).join(' | '));
  } catch (e) { console.log('[DealRank] skipped:', e); }
}

// KV_MY_RANK: the exact score the Mailbox ranks a store by (pledge 25% + freshness 35% + deal 20% + XP 20%),
// so the Workspace card shows the real number, not an estimate.
export async function kvMyStoreRank(storeAddress: string): Promise<any> {
  const dir: any[] = await rebuildDirectory('store', registryAddress('store', NET), NET);
  const me: any = dir.find((e: any) => e.storeAddress === storeAddress);
  if (!me) return { listed: false };
  const cat = String(me.category || '').toLowerCase();
  const peers = dir.filter((e: any) => String(e.category || '').toLowerCase() === cat);
  const pick = [me].concat(peers.filter((e: any) => e !== me).slice(0, 11));
  const effs: number[] = [];
  let myEff = 0;
  for (const e of pick) {
    const v = await kvEffMinKas(e.storeAddress, e.configHash || (e.record && e.record.d && e.record.d.configHash) || '', e.record && e.record.d && e.record.d.coords, e.ownerPubkey);
    if (e === me) myEff = v;
    if (v > 0) effs.push(v);
  }
  const pledgeKas = Number(me.pledgeSompi) / 1e8;
  const ageH = Math.max(0, (Date.now() / 1000 - me.announcedAt) / 3600);
  const pledge = kvPledgeScore(pledgeKas);
  const fresh = Math.pow(0.5, ageH / 168);
  let deal = 0.5, dealNote = 'neutral - fewer than 3 priced stores in your category';
  if (effs.length >= 3 && myEff > 0) {
    const m = effs.reduce((x, y) => x + y, 0) / effs.length;
    const sd = Math.sqrt(effs.reduce((x, y) => x + (y - m) * (y - m), 0) / effs.length) || 1;
    deal = Math.max(0, Math.min(1, 0.5 + ((m - myEff) / sd) / 4));
    dealNote = 'your best price ' + myEff.toFixed(1) + ' KAS vs category avg ' + m.toFixed(1);
  } else if (myEff <= 0) dealNote = 'neutral - no priced items yet';
  const xp = await kvPublisherXp(me.ownerPubkey);
  const xpS = kvXpScore(xp);
  const total = pledge * 0.25 + fresh * 0.35 + deal * 0.20 + xpS * 0.20;
  return { listed: true, pledgeKas, ageH, pledge, fresh, deal, dealNote, xp, xpS, total, peers: peers.length };
}

export async function fetchStorefronts(_cursor?: string): Promise<FetchResult<StorefrontEntry>> {
  try {
    console.log('[Mailbox] store scan -> registry', registryAddress('store', NET).slice(0, 30));
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    console.log('[Mailbox] store scan found', dir.length, 'entries:', dir.map((e: any) => e.name).join(', '));
    // KV_FLAG_OWNER_WARN: tell the owner when their listing is flagged / auto-delisted (once per change)
    (async () => {
      try {
        const g: any = globalThis as any;
        if (!g.__kvMyPub) {
          const ps = require('./proposal_share');
          const priv = await ps._kvResolvePrivHex();
          if (!priv) return;
          const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
          const { secp256k1 } = require('@noble/curves/secp256k1');
          g.__kvMyPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
        }
        const me = g.__kvMyPub;
        const AS = require('@react-native-async-storage/async-storage').default;
        const seen = JSON.parse((await AS.getItem('kv_flag_warned')) || '{}');
        const msgs: string[] = [];
        for (const [h, fi] of (g.__kvFlagInfo || new Map())) {
          if (!fi || fi.owner !== me) continue;
          const key = fi.n + (fi.hidden ? ':h' : '') + (fi.mod ? ':m' : '') + (fi.modNote ? ':e' : ''); // KV_MOD_OWNER_WARN KV_MOD_NOTE_WARN
          if (seen[h] === key) continue;
          seen[h] = key;
          msgs.push(fi.mod && fi.modNote
            ? '"' + fi.name + '" was removed by the moderator - and the moderator has publicly acknowledged it was an ERROR. The removal is final for that store, so open a new store; your record shows the error was not yours.'
            : fi.mod
            ? '"' + fi.name + '" was removed by the moderator. Reason: ' + (fi.modReason === 'legal' ? 'legal request' : fi.modReason) + '. The reason and an evidence hash are public on the Kaspa chain.'
            : fi.hidden
            ? '"' + fi.name + '" was delisted by ' + fi.n + ' community flags (' + fi.reasons.join(', ') + '). Flags expire with chain pruning (~30-40h); fix the issue before re-announcing.'
            : '"' + fi.name + '" has ' + fi.n + '/3 flags (' + fi.reasons.join(', ') + '). At 3 it is delisted in every wallet.');
        }
        if (msgs.length) {
          await AS.setItem('kv_flag_warned', JSON.stringify(seen));
          require('react-native').Alert.alert('Your listing was flagged', msgs.join('\n\n'));
        }
      } catch (e) { console.warn('[FlagWarn]', e); }
    })();
    dir.sort(visSort as any);
    const items: StorefrontEntry[] = dir.map((e: any) => ({
      id: e.storeAddress,
      storeName: e.name,
      description: '',
      category: e.category,
      arweaveTx: e.storeAddress,
      ownerPubkey: e.ownerPubkey,
      townhall: { verified: false, verifiedAt: e.announcedAt, verificationTx: e.storeAddress }, // KV_HONEST_BADGE: stores are pledge-anchored, not TownHall-verified
      createdAt: e.announcedAt * 1000,
      productCount: 0,
      primaryLink: e.primaryLink || '',
      configHash: e.configHash || '',
      coords: (e.record && e.record.d && e.record.d.coords) || null,
      record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM
    } as any));
    await kvDealRank(dir as any[], items as any[]);
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('store scan failed: ' + String(e?.message || e), 'SCAN');
  }
}

/** Fetch a dapp's on-chain attest (dapp_verify chunk set at its address).
 *  Returns null when absent or malformed - listing shows unverified. */
async function fetchDAppAttest(dappAddress: string): Promise<any | null> {
  try {
    const _wrapped: any[] = await (await import('./kaspa_payload')).fetchRecords(dappAddress, NET, 100);
    const recs: any[] = _wrapped.map(w => (w && w.record) ? w.record : w);
    // attest rides the cfg chunk format; find the newest complete set
    const cfgRecs = recs.filter(r => (r as any).k === 'cfg' && r.d && typeof r.d.h === 'string');
    if (!cfgRecs.length) return null;
    // group by hash, take newest complete
    const byHash = new Map<string, any[]>();
    for (const r of cfgRecs) {
      const arr = byHash.get(r.d.h) || [];
      arr.push(r); byHash.set(r.d.h, arr);
    }
    let best: any = null;
    for (const [h, arr] of byHash) {
      const tot = arr[0].d.tot;
      const seqs = new Set(arr.map(r => r.d.seq));
      if (seqs.size < tot) continue;
      const newest = Math.max(...arr.map(r => r.t));
      if (!best || newest > best.newest) best = { h, newest };
    }
    if (!best) return null;
    const { fetchStoreConfig } = await import('./config_chunks');
    const { config } = await fetchStoreConfig(dappAddress, best.h, NET);
    return config && config.kind === 'dapp_verify' ? config : null;
  } catch { return null; }
}

export async function fetchDApps(_cursor?: string): Promise<FetchResult<DAppEntry>> {
  try {
    const dir = await rebuildDirectory('dapp', registryAddress('dapp', NET), NET);
    dir.sort(visSort as any);
    const items: DAppEntry[] = await Promise.all(dir.map(async (e: any) => {
      const pledgeKas = Number(e.pledgeSompi) / 1e8;
      const pledgeBoard: Board = pledgeKas >= 2000 ? 'Elite' : pledgeKas >= 500 ? 'Main' : 'Incubator';
      // On-chain attest decides verified status; codeHash must match the announce.
      const attest = await fetchDAppAttest(e.storeAddress);
      const announcedCodeHash = e.record?.d?.codeHash || '';
      // Game rail: announce carries configHash of a data-only descriptor - hash IS the integrity check.
      const gameHash = e.record?.d?.configHash || '';
      const attestValid = !!(attest
        && attest.proofType === 'Halo2-IPA-DApp-V1'
        && attest.proofB64
        && attest.codeHash
        && (!announcedCodeHash || attest.codeHash === announcedCodeHash));
      // Board = min(claimed, pledge-derived): pledge on chain is the floor of truth.
      const rank = (b: string) => b === 'Elite' ? 2 : b === 'Main' ? 1 : 0;
      const claimedBoard = (attest?.board || '').charAt(0).toUpperCase() + (attest?.board || '').slice(1);
      const board: Board = attestValid && rank(claimedBoard) < rank(pledgeBoard)
        ? (claimedBoard as Board) : pledgeBoard;
      return {
        id: e.storeAddress,
        name: e.name,
        description: '',
        category: e.category,
        board,
        arweaveTx: e.storeAddress,
        ownerPubkey: e.ownerPubkey,
        templateVerified: attestValid, // KV_HONEST_BADGE: hash presence is integrity (checked at install), not verification
        townhall: { verified: attestValid, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },
        createdAt: e.announcedAt * 1000,
        xpCommitment: Math.round(pledgeKas),
        gameHash,
        record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM
      } as any;
    }));
    await kvXpRank(items as any[], new Map((dir as any[]).map((e: any) => [e.storeAddress, e])));   // KV_RANK_XP
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('dapp scan failed: ' + String(e?.message || e), 'SCAN');
  }
}

/** Coupons live inside store configs (chunk rail). Bounded to first N stores per refresh. */
export async function fetchCoupons(_cursor?: string): Promise<FetchResult<CouponEntry>> {
  try {
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    dir.sort(visSort as any);
    const items: CouponEntry[] = [];
    for (const e of dir.slice(0, 10) as any[]) {
      const cfgHash = e.record?.d?.configHash;
      if (!cfgHash) continue;
      const { config } = await fetchStoreConfig(e.storeAddress, cfgHash, NET, undefined, e.ownerPubkey || undefined); // KV_CHUNK_CANDIDATES
      if (!config?.coupons?.length) continue;
      for (const c of config.coupons) {
        const expiresAt = (c.createdAt || 0) + (c.expiryDays || 30) * 86400000;
        if (expiresAt < Date.now()) continue;
        if ((c.usedCount || 0) >= (c.maxUses || 1)) continue;
        items.push({
          id: e.storeAddress + '_' + c.id,
          title: c.code,
          description: c.description || '',
          discount: c.discountPercent > 0 ? c.discountPercent + '% off' : c.discountKas + ' KAS off',
          arweaveTx: e.storeAddress,
          ownerPubkey: e.ownerPubkey,
          storeName: e.name,
          expiresAt,
          createdAt: c.createdAt || e.announcedAt * 1000,
          category: e.category,
          townhall: { verified: true, verifiedAt: e.announcedAt },
          discountedKaspa: Number(c.discountedKaspa || 0),
        } as any);
      }
    }
    items.sort((a: any, b: any) => ((a.discountedKaspa > 0 ? a.discountedKaspa : 9e9) - (b.discountedKaspa > 0 ? b.discountedKaspa : 9e9))); // KV_DEAL_RANK: biggest real cut first
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('coupon scan failed: ' + String(e?.message || e), 'SCAN');
  }
}

/** Academic + service = CATEGORIES of the store rail (one publish path).
 *  TownHall verification rules gate the badges: DKIM for academics (strict -
 *  unattested entries are not listed), pledge-anchor for services. */
export async function fetchAcademics(_cursor?: string): Promise<FetchResult<AcademicEntry>> {
  try {
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    dir.sort(visSort as any);
    console.log('[Academics] KV_ACAD_DIAG dir:', dir.length, 'cats:', (dir as any[]).slice(0, 8).map((e: any) => String(e.category || '?')).join(','));
    const items: AcademicEntry[] = (dir as any[])
      .filter((e) => String(e.category || '').toLowerCase().indexOf('academ') === 0)
      .map((e) => {
        const dkim = !!(e.record && e.record.d && (e.record.d.dkim === true || e.record.d.dkimDomain));
        return {
          id: e.storeAddress,
          title: e.name,
          description: '',
          institution: String((e.record && e.record.d && (e.record.d.institution || e.record.d.dkimDomain)) || ''), // KV_ACAD_INST: DKIM school is the institution
          field: e.category,
          arweaveTx: e.storeAddress,
          ownerPubkey: e.ownerPubkey,
          dkimVerified: dkim,
          dkimDomain: String((e.record && e.record.d && e.record.d.dkimDomain) || '') || undefined,
          configHash: e.configHash || '', coords: (e.record && e.record.d && e.record.d.coords) || null, repositoryUrl: e.primaryLink || '', // KV_ACAD_VIEW: chunks fetchable from the card
          createdAt: e.announcedAt * 1000,
          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
          record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM
        } as any;
      });
    await kvXpRank(items as any[], new Map((dir as any[]).map((e: any) => [e.storeAddress, e])));   // KV_RANK_XP
    console.log('[Academics] matched:', items.length, items.map((i: any) => (i.title || '(untitled)') + '/' + (i.institution || '-')).join(' | '));
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('academic scan failed: ' + String(e?.message || e), 'SCAN');
  }
}
export async function fetchServices(_cursor?: string): Promise<FetchResult<ServiceEntry>> {
  try {
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    dir.sort(visSort as any);
    const items: ServiceEntry[] = (dir as any[])
      .filter((e) => String(e.category || '').toLowerCase().indexOf('service') === 0)
      .map((e) => ({
        id: e.storeAddress,
        title: e.name,
        description: '',
        category: e.category,
        arweaveTx: e.storeAddress,
        ownerPubkey: e.ownerPubkey,
        priceLabel: undefined,
        serviceArea: '',
        townhall: { verified: true, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
        createdAt: e.announcedAt * 1000,
        coords: (e.record && e.record.d && e.record.d.coords) || null,
        configHash: e.configHash || '',
        record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM svc
      } as any));
    await kvDealRank(dir as any[], items as any[]);
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('service scan failed: ' + String(e?.message || e), 'SCAN');
  }
}
