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

const NET = 'testnet-10';

// ---- Network stubs: Kaspa REST is the only dependency; assume reachable ----
export function isOnline(): boolean { return true; }
export function subscribeToNetworkChanges(_l: (online: boolean) => void): () => void { return () => {}; }
export function initMailboxAPI(): () => void { return () => {}; }

// Visibility sort: pledge (capped) + freshness half-life. XP joins later via StatSig.
function visSort(a: { pledgeSompi: bigint; announcedAt: number }, b: { pledgeSompi: bigint; announcedAt: number }): number {
  const score = (e: { pledgeSompi: bigint; announcedAt: number }) => {
    const pledgeKas = Number(e.pledgeSompi) / 1e8;
    const pledgeScore = Math.min(pledgeKas / 2500, 1.0) * 0.4;
    const ageHours = Math.max(0, (Date.now() / 1000 - e.announcedAt) / 3600);
    const fresh = Math.pow(0.5, ageHours / (24 * 7)) * 0.6; // 7-day half-life for directory
    return pledgeScore + fresh;
  };
  return score(b) - score(a);
}

export async function fetchStorefronts(_cursor?: string): Promise<FetchResult<StorefrontEntry>> {
  try {
    console.log('[Mailbox] store scan -> registry', registryAddress('store', NET).slice(0, 30));
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    console.log('[Mailbox] store scan found', dir.length, 'entries:', dir.map((e: any) => e.name).join(', '));
    dir.sort(visSort as any);
    const items: StorefrontEntry[] = dir.map((e: any) => ({
      id: e.storeAddress,
      storeName: e.name,
      description: '',
      category: e.category,
      arweaveTx: e.storeAddress,
      ownerPubkey: e.ownerPubkey,
      townhall: { verified: true, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
      createdAt: e.announcedAt * 1000,
      productCount: 0,
    }));
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('store scan failed: ' + String(e?.message || e), 'SCAN');
  }
}

/** Fetch a dapp's on-chain attest (dapp_verify chunk set at its address).
 *  Returns null when absent or malformed - listing shows unverified. */
async function fetchDAppAttest(dappAddress: string): Promise<any | null> {
  try {
    const recs: any[] = await (await import('./kaspa_payload')).fetchRecords(dappAddress, NET, 100);
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
        templateVerified: attestValid,
        townhall: { verified: attestValid, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },
        createdAt: e.announcedAt * 1000,
        xpCommitment: Math.round(pledgeKas),
      };
    }));
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
      const { config } = await fetchStoreConfig(e.storeAddress, cfgHash, NET);
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
        });
      }
    }
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('coupon scan failed: ' + String(e?.message || e), 'SCAN');
  }
}

/** Academic + service categories publish on the rail later; empty-success until then. */
export async function fetchAcademics(_cursor?: string): Promise<FetchResult<AcademicEntry>> {
  return { items: [], hasMore: false, fromCache: false };
}
export async function fetchServices(_cursor?: string): Promise<FetchResult<ServiceEntry>> {
  return { items: [], hasMore: false, fromCache: false };
}
