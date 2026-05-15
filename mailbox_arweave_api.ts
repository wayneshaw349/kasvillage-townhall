// ============================================================================
// KASVILLAGE - MAILBOX ARWEAVE API
// ============================================================================
// Provides: types, fetch functions, network utilities for VillageMailbox
// Data source: Arweave GraphQL (with Goldsky fallback) + SecureStore cache
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';

// ============================================================================
// CONSTANTS
// ============================================================================

const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';
const GOLDSKY_GRAPHQL = 'https://arweave-search.goldsky.com/graphql';
const ARWEAVE_GATEWAY = 'https://arweave.net';
const KV_APP_NAME = 'KasVillage';
const PAGE_SIZE = 20;

const CACHE_KEYS = {
  DAPPS: 'kv_mailbox_cache_dapps',
  STOREFRONTS: 'kv_mailbox_cache_storefronts',
  COUPONS: 'kv_mailbox_cache_coupons',
  ACADEMICS: 'kv_mailbox_cache_academics',
  SERVICES: 'kv_mailbox_cache_services',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// TYPES
// ============================================================================

export type Board = 'Elite' | 'Main' | 'Incubator';
export type ServiceCategory =
  | 'Development'
  | 'Design'
  | 'Writing'
  | 'Marketing'
  | 'Legal'
  | 'Finance'
  | 'Education'
  | 'Health'
  | 'Other';

export interface TownHallVerification {
  verified: boolean;
  verifiedAt?: number;
  verificationTx?: string;
  apt?: string;
}

export interface DAppEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  board: Board;
  arweaveTx: string;
  ownerPubkey: string;
  templateVerified: boolean;
  townhall: TownHallVerification;
  createdAt: number;
  xpCommitment: number;
}

export interface StorefrontEntry {
  id: string;
  storeName: string;
  description: string;
  category: string;
  arweaveTx: string;
  ownerPubkey: string;
  logoArweaveTx?: string;
  townhall: TownHallVerification;
  createdAt: number;
  productCount: number;
  rating?: number;
}

export interface CouponEntry {
  id: string;
  title: string;
  description: string;
  discount: string;
  arweaveTx: string;
  ownerPubkey: string;
  storeName: string;
  expiresAt: number;
  createdAt: number;
  category: string;
  townhall: TownHallVerification;
}

export interface AcademicEntry {
  id: string;
  title: string;
  description: string;
  institution: string;
  field: string;
  arweaveTx: string;
  ownerPubkey: string;
  dkimVerified: boolean;
  dkimDomain?: string;
  createdAt: number;
  townhall: TownHallVerification;
}

export interface ServiceEntry {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  arweaveTx: string;
  ownerPubkey: string;
  priceSompi?: number;
  priceLabel?: string;
  serviceArea: string;
  townhall: TownHallVerification;
  createdAt: number;
}

export interface FetchResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  fromCache: boolean;
}

export class MailboxError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MailboxError';
  }
}

// ============================================================================
// NETWORK STATE
// ============================================================================

let _online = true;
let _networkListeners: ((online: boolean) => void)[] = [];
let _networkCheckInterval: ReturnType<typeof setInterval> | null = null;

async function checkNetwork(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function isOnline(): boolean {
  return _online;
}

export function subscribeToNetworkChanges(listener: (online: boolean) => void): () => void {
  _networkListeners.push(listener);
  return () => {
    _networkListeners = _networkListeners.filter(l => l !== listener);
  };
}

function notifyNetworkListeners(online: boolean): void {
  _networkListeners.forEach(l => l(online));
}

export function initMailboxAPI(): () => void {
  // Initial check
  checkNetwork().then(online => {
    _online = online;
    notifyNetworkListeners(online);
  });

  // Poll every 15 seconds
  _networkCheckInterval = setInterval(async () => {
    const online = await checkNetwork();
    if (online !== _online) {
      _online = online;
      notifyNetworkListeners(online);
    }
  }, 15000);

  return () => {
    if (_networkCheckInterval) {
      clearInterval(_networkCheckInterval);
      _networkCheckInterval = null;
    }
    _networkListeners = [];
  };
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    await SecureStore.setItemAsync(key, JSON.stringify(entry));
  } catch {}
}

// ============================================================================
// ARWEAVE GRAPHQL QUERY
// ============================================================================

async function queryArweave(query: string): Promise<any> {
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  };

  try {
    const res = await fetch(ARWEAVE_GRAPHQL, opts);
    if (res.ok) return await res.json();
  } catch {}

  // Goldsky fallback
  try {
    const res = await fetch(GOLDSKY_GRAPHQL, opts);
    if (res.ok) return await res.json();
  } catch {}

  throw new MailboxError('Arweave query failed — check your connection', 'NETWORK_ERROR');
}

async function fetchTxData<T>(txId: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getTagValue(tags: { name: string; value: string }[], name: string): string | undefined {
  return tags.find(t => t.name === name)?.value;
}

function parseCursor(edges: any[]): string | undefined {
  return edges.length > 0 ? edges[edges.length - 1].cursor : undefined;
}

// ============================================================================
// FETCH DAPPS
// ============================================================================

export async function fetchDApps(cursor?: string): Promise<FetchResult<DAppEntry>> {
  // Try cache if offline
  if (!_online) {
    const cached = await getCache<DAppEntry[]>(CACHE_KEYS.DAPPS);
    if (cached) return { items: cached, hasMore: false, fromCache: true };
    throw new MailboxError('No cached DApps available offline', 'OFFLINE');
  }

  const pagination = cursor ? `after: "${cursor}", first: ${PAGE_SIZE}` : `first: ${PAGE_SIZE}`;

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] }
          { name: "Type", values: ["KV_DAPP_V1"] }
        ]
        ${pagination}
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges: any[] = result?.data?.transactions?.edges ?? [];
  const hasMore: boolean = result?.data?.transactions?.pageInfo?.hasNextPage ?? false;

  const items: DAppEntry[] = edges.map(edge => {
    const tags = edge.node.tags as { name: string; value: string }[];
    const id = edge.node.id;
    return {
      id,
      name: getTagValue(tags, 'DApp-Name') ?? 'Unknown',
      description: getTagValue(tags, 'Description') ?? '',
      category: getTagValue(tags, 'Category') ?? 'Other',
      board: (getTagValue(tags, 'Board') as Board) ?? 'Incubator',
      arweaveTx: id,
      ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
      templateVerified: getTagValue(tags, 'Template-Verified') === 'true',
      townhall: {
        verified: getTagValue(tags, 'Verified') === 'true',
        verifiedAt: edge.node.block?.timestamp,
        verificationTx: getTagValue(tags, 'Verification-TX'),
        apt: getTagValue(tags, 'APT-Alias'),
      },
      createdAt: edge.node.block?.timestamp ?? 0,
      xpCommitment: parseInt(getTagValue(tags, 'XP-Commitment') ?? '0', 10),
    };
  });

  if (!cursor) await setCache(CACHE_KEYS.DAPPS, items);

  return { items, nextCursor: parseCursor(edges), hasMore, fromCache: false };
}

// ============================================================================
// FETCH STOREFRONTS
// ============================================================================

export async function fetchStorefronts(cursor?: string): Promise<FetchResult<StorefrontEntry>> {
  if (!_online) {
    const cached = await getCache<StorefrontEntry[]>(CACHE_KEYS.STOREFRONTS);
    if (cached) return { items: cached, hasMore: false, fromCache: true };
    throw new MailboxError('No cached storefronts available offline', 'OFFLINE');
  }

  const pagination = cursor ? `after: "${cursor}", first: ${PAGE_SIZE}` : `first: ${PAGE_SIZE}`;

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] }
          { name: "Type", values: ["KV_STOREFRONT_V1"] }
        ]
        ${pagination}
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges: any[] = result?.data?.transactions?.edges ?? [];
  const hasMore: boolean = result?.data?.transactions?.pageInfo?.hasNextPage ?? false;

  const items: StorefrontEntry[] = edges.map(edge => {
    const tags = edge.node.tags as { name: string; value: string }[];
    const id = edge.node.id;
    return {
      id,
      storeName: getTagValue(tags, 'Brand-Name') ?? 'Unknown Store',
      description: getTagValue(tags, 'Tagline') ?? '',
      category: getTagValue(tags, 'Category') ?? 'General',
      arweaveTx: id,
      ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
      logoArweaveTx: getTagValue(tags, 'Logo-TX'),
      townhall: {
        verified: getTagValue(tags, 'Verified') === 'true',
        verifiedAt: edge.node.block?.timestamp,
        verificationTx: getTagValue(tags, 'Verification-TX'),
        apt: getTagValue(tags, 'APT-Alias'),
      },
      createdAt: edge.node.block?.timestamp ?? 0,
      productCount: parseInt(getTagValue(tags, 'Product-Count') ?? '0', 10),
      rating: parseFloat(getTagValue(tags, 'Rating') ?? '0') || undefined,
    };
  });

  if (!cursor) await setCache(CACHE_KEYS.STOREFRONTS, items);

  return { items, nextCursor: parseCursor(edges), hasMore, fromCache: false };
}

// ============================================================================
// FETCH COUPONS
// ============================================================================

export async function fetchCoupons(cursor?: string): Promise<FetchResult<CouponEntry>> {
  if (!_online) {
    const cached = await getCache<CouponEntry[]>(CACHE_KEYS.COUPONS);
    if (cached) return { items: cached, hasMore: false, fromCache: true };
    throw new MailboxError('No cached coupons available offline', 'OFFLINE');
  }

  const pagination = cursor ? `after: "${cursor}", first: ${PAGE_SIZE}` : `first: ${PAGE_SIZE}`;

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] }
          { name: "Type", values: ["KV_COUPON_V1"] }
        ]
        ${pagination}
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges: any[] = result?.data?.transactions?.edges ?? [];
  const hasMore: boolean = result?.data?.transactions?.pageInfo?.hasNextPage ?? false;

  const now = Date.now();
  const items: CouponEntry[] = edges.map(edge => {
    const tags = edge.node.tags as { name: string; value: string }[];
    const id = edge.node.id;
    const expiresAt = parseInt(getTagValue(tags, 'Expires-At') ?? '0', 10);
    return {
      id,
      title: getTagValue(tags, 'Coupon-Title') ?? 'Coupon',
      description: getTagValue(tags, 'Description') ?? '',
      discount: getTagValue(tags, 'Discount') ?? 'DEAL',
      arweaveTx: id,
      ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
      storeName: getTagValue(tags, 'Store-Name') ?? 'Unknown Store',
      expiresAt: expiresAt || now + 7 * 24 * 60 * 60 * 1000,
      createdAt: edge.node.block?.timestamp ?? 0,
      category: getTagValue(tags, 'Category') ?? 'General',
      townhall: {
        verified: getTagValue(tags, 'Verified') === 'true',
        verifiedAt: edge.node.block?.timestamp,
        apt: getTagValue(tags, 'APT-Alias'),
      },
    };
  });

  if (!cursor) await setCache(CACHE_KEYS.COUPONS, items);

  return { items, nextCursor: parseCursor(edges), hasMore, fromCache: false };
}

// ============================================================================
// FETCH ACADEMICS
// ============================================================================

export async function fetchAcademics(cursor?: string): Promise<FetchResult<AcademicEntry>> {
  if (!_online) {
    const cached = await getCache<AcademicEntry[]>(CACHE_KEYS.ACADEMICS);
    if (cached) return { items: cached, hasMore: false, fromCache: true };
    throw new MailboxError('No cached academics available offline', 'OFFLINE');
  }

  const pagination = cursor ? `after: "${cursor}", first: ${PAGE_SIZE}` : `first: ${PAGE_SIZE}`;

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] }
          { name: "Type", values: ["KV_ACADEMIC_V1"] }
        ]
        ${pagination}
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges: any[] = result?.data?.transactions?.edges ?? [];
  const hasMore: boolean = result?.data?.transactions?.pageInfo?.hasNextPage ?? false;

  const items: AcademicEntry[] = edges.map(edge => {
    const tags = edge.node.tags as { name: string; value: string }[];
    const id = edge.node.id;
    return {
      id,
      title: getTagValue(tags, 'Academic-Title') ?? 'Academic Profile',
      description: getTagValue(tags, 'Description') ?? '',
      institution: getTagValue(tags, 'Institution') ?? 'Unknown',
      field: getTagValue(tags, 'Field') ?? 'General',
      arweaveTx: id,
      ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
      dkimVerified: getTagValue(tags, 'DKIM-Verified') === 'true',
      dkimDomain: getTagValue(tags, 'DKIM-Domain'),
      createdAt: edge.node.block?.timestamp ?? 0,
      townhall: {
        verified: getTagValue(tags, 'Verified') === 'true',
        verifiedAt: edge.node.block?.timestamp,
        verificationTx: getTagValue(tags, 'Verification-TX'),
        apt: getTagValue(tags, 'APT-Alias'),
      },
    };
  });

  if (!cursor) await setCache(CACHE_KEYS.ACADEMICS, items);

  return { items, nextCursor: parseCursor(edges), hasMore, fromCache: false };
}

// ============================================================================
// FETCH SERVICES
// ============================================================================

export async function fetchServices(cursor?: string): Promise<FetchResult<ServiceEntry>> {
  if (!_online) {
    const cached = await getCache<ServiceEntry[]>(CACHE_KEYS.SERVICES);
    if (cached) return { items: cached, hasMore: false, fromCache: true };
    throw new MailboxError('No cached services available offline', 'OFFLINE');
  }

  const pagination = cursor ? `after: "${cursor}", first: ${PAGE_SIZE}` : `first: ${PAGE_SIZE}`;

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] }
          { name: "Type", values: ["KV_SERVICE_V1"] }
        ]
        ${pagination}
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges: any[] = result?.data?.transactions?.edges ?? [];
  const hasMore: boolean = result?.data?.transactions?.pageInfo?.hasNextPage ?? false;

  const items: ServiceEntry[] = edges.map(edge => {
    const tags = edge.node.tags as { name: string; value: string }[];
    const id = edge.node.id;
    const priceSompiRaw = getTagValue(tags, 'Price-Sompi');
    return {
      id,
      title: getTagValue(tags, 'Service-Title') ?? 'Service',
      description: getTagValue(tags, 'Description') ?? '',
      category: (getTagValue(tags, 'Category') as ServiceCategory) ?? 'Other',
      arweaveTx: id,
      ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
      priceSompi: priceSompiRaw ? parseInt(priceSompiRaw, 10) : undefined,
      priceLabel: getTagValue(tags, 'Price-Label'),
      serviceArea: getTagValue(tags, 'Service-Area') ?? 'Remote',
      townhall: {
        verified: getTagValue(tags, 'Verified') === 'true',
        verifiedAt: edge.node.block?.timestamp,
        verificationTx: getTagValue(tags, 'Verification-TX'),
        apt: getTagValue(tags, 'APT-Alias'),
      },
      createdAt: edge.node.block?.timestamp ?? 0,
    };
  });

  if (!cursor) await setCache(CACHE_KEYS.SERVICES, items);

  return { items, nextCursor: parseCursor(edges), hasMore, fromCache: false };
}
