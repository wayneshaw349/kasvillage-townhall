// ============================================================================
// KASVILLAGE - ARWEAVE GRAPHQL QUERY MODULE
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';

// Buffer-free hex helper
function u8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ARWEAVE_GATEWAY = 'https://arweave.net';
export const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';
export const GOLDSKY_GRAPHQL = 'https://arweave-search.goldsky.com/graphql';

export const KV_APP_NAME = 'KasVillage';
export const KV_APP_VERSION = '1.0.0';

export const TAG_TYPES = {
  IDENTITY: 'KV_IDENTITY_V1',
  STOREFRONT: 'KV_STOREFRONT_V1',
  STATS: 'KV_STATS_V1',
  FROST_EVENT: 'KV_FROST_V1',
  PROOF: 'KV_PROOF_V1',
  PROFILE: 'KV_PROFILE_V1',
  ACADEMIC: 'KV_ACADEMIC_V1',
  DAPP: 'KV_DAPP_V1',
  REVIEW: 'KV_REVIEW_V1',
  VISIT: 'KV_VISIT_V1',
} as const;

const CACHE_TTL = {
  STATS: 5 * 60 * 1000,
  STOREFRONT: 10 * 60 * 1000,
  IDENTITY: 60 * 60 * 1000,
  FROST: 2 * 60 * 1000,
};

// ============================================================================
// HASH-BASED INDEXING
// ============================================================================

export function hashApt(aptAlias: string): string {
  const hash = sha256(new TextEncoder().encode(`APT:${aptAlias}`));
  return u8ToHex(hash.slice(0, 8));
}

export function hashPubkey(pubkey: string): string {
  const hash = sha256(new TextEncoder().encode(`PK:${pubkey}`));
  return u8ToHex(hash.slice(0, 8));
}

export function hashAddress(address: string): string {
  const hash = sha256(new TextEncoder().encode(`ADDR:${address}`));
  return u8ToHex(hash.slice(0, 8));
}

export function hashAgreement(agreementId: string): string {
  const hash = sha256(new TextEncoder().encode(`AGR:${agreementId}`));
  return u8ToHex(hash.slice(0, 8));
}

export function hashContent(contentHash: string): string {
  const hash = sha256(new TextEncoder().encode(`CONTENT:${contentHash}`));
  return u8ToHex(hash.slice(0, 8));
}

// ============================================================================
// TYPES
// ============================================================================

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveNode {
  id: string;
  owner: { address: string };
  tags: ArweaveTag[];
  block?: {
    height: number;
    timestamp: number;
  };
  data?: { size: string };
}

export interface ArweaveEdge {
  cursor: string;
  node: ArweaveNode;
}

export interface GraphQLResponse {
  data?: {
    transactions: {
      edges: ArweaveEdge[];
      pageInfo?: { hasNextPage: boolean };
    };
  };
  errors?: Array<{ message: string }>;
}

export interface ArweaveUserStats {
  pubkey: string;
  successes: number;
  deadlocks: number;
  xp: number;
  pComplete: number;
  totalAgreements: number;
  totalVolumeSompi: number;
  lastUpdatedAt: number;
  arweaveTx: string;
}

export interface ArweaveStorefront {
  ownerPubkey: string;
  aptNumber: string;
  brandName: string;
  tagline?: string;
  description?: string;
  logoArweaveTx?: string;
  bannerArweaveTx?: string;
  theme: Record<string, string>;
  sections: any[];
  products: any[];
  coupons: any[];
  socialLinks: any[];
  verified: boolean;
  createdAt: number;
  updatedAt: number;
  arweaveTx: string;
}

export interface ArweaveFrostEvent {
  agreementId: string;
  eventType: 'created' | 'completed' | 'deadlocked' | 'refunded' | 'expired';
  buyerPubkey: string;
  sellerPubkey: string;
  amountSompi: number;
  timestampMs: number;
  daaScore: number;
  l1TxId?: string;
  deadlockReason?: string;
  arweaveTx: string;
}

export interface ArweaveIdentity {
  pubkey: string;
  aptAlias: string;
  avatarHash: string;
  deviceAttestationHash: string;
  createdAt: number;
  l1InscriptionTx?: string;
  arweaveTx: string;
}

// ============================================================================
// CORE QUERY FUNCTION
// ============================================================================

export async function queryArweave(
  query: string,
  useGoldsky = true
): Promise<GraphQLResponse | null> {
  const endpoint = useGoldsky ? GOLDSKY_GRAPHQL : ARWEAVE_GRAPHQL;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`[ArweaveQuery] HTTP ${response.status} from ${endpoint}`);
      if (!useGoldsky) return queryArweave(query, true);
      return null;
    }

    const result: GraphQLResponse = await response.json();
    if (result.errors?.length) {
      console.error('[ArweaveQuery] GraphQL errors:', result.errors);
    }
    return result;
  } catch (error) {
    console.error('[ArweaveQuery] Fetch error:', error);
    if (!useGoldsky) return queryArweave(query, true);
    return null;
  }
}

export async function fetchTransactionData<T>(txId: string): Promise<T | null> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[ArweaveQuery] Fetch TX data error:', error);
    return null;
  }
}

// ============================================================================
// USER STATS QUERIES
// ============================================================================

export async function queryUserStats(pubkey: string): Promise<ArweaveUserStats | null> {
  const cacheKey = `ar_stats_${pubkey.slice(0, 16)}`;
  const cached = await getCached<ArweaveUserStats>(cacheKey, CACHE_TTL.STATS);
  if (cached) return cached;

  const pubkeyHash = hashPubkey(pubkey);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.STATS}"] },
          { name: "Pubkey-Hash", values: ["${pubkeyHash}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];
  if (!edge) return null;

  const data = await fetchTransactionData<any>(edge.node.id);
  if (!data) return null;

  const stats: ArweaveUserStats = {
    pubkey,
    successes: data.successes ?? 0,
    deadlocks: data.deadlocks ?? 0,
    xp: data.xp ?? 0,
    pComplete: data.pComplete ?? 0.5,
    totalAgreements: data.totalAgreements ?? 0,
    totalVolumeSompi: data.totalVolumeSompi ?? 0,
    lastUpdatedAt: edge.node.block?.timestamp ?? Date.now(),
    arweaveTx: edge.node.id,
  };

  await setCache(cacheKey, stats);
  return stats;
}

export async function queryUserStatsBatch(
  pubkeys: string[]
): Promise<Map<string, ArweaveUserStats>> {
  const results = new Map<string, ArweaveUserStats>();
  const chunks = chunkArray(pubkeys, 5);

  for (const chunk of chunks) {
    const promises = chunk.map(pk => queryUserStats(pk));
    const stats = await Promise.all(promises);
    for (let i = 0; i < chunk.length; i++) {
      if (stats[i]) results.set(chunk[i], stats[i]!);
    }
  }

  return results;
}

// ============================================================================
// STOREFRONT QUERIES
// ============================================================================

export async function queryStorefront(pubkey: string): Promise<ArweaveStorefront | null> {
  const cacheKey = `ar_store_${pubkey.slice(0, 16)}`;
  const cached = await getCached<ArweaveStorefront>(cacheKey, CACHE_TTL.STOREFRONT);
  if (cached) return cached;

  const pubkeyHash = hashPubkey(pubkey);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.STOREFRONT}"] },
          { name: "Pubkey-Hash", values: ["${pubkeyHash}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];
  if (!edge) return null;

  const data = await fetchTransactionData<any>(edge.node.id);
  if (!data) return null;

  const storefront: ArweaveStorefront = {
    ownerPubkey: pubkey,
    aptNumber: data.aptNumber ?? '',
    brandName: data.brandName ?? '',
    tagline: data.tagline,
    description: data.description,
    logoArweaveTx: data.logoArweaveTx,
    bannerArweaveTx: data.bannerArweaveTx,
    theme: data.theme ?? {},
    sections: data.sections ?? [],
    products: data.products ?? [],
    coupons: data.coupons ?? [],
    socialLinks: data.socialLinks ?? [],
    verified: data.verified ?? false,
    createdAt: data.createdAt ?? edge.node.block?.timestamp ?? 0,
    updatedAt: data.updatedAt ?? edge.node.block?.timestamp ?? 0,
    arweaveTx: edge.node.id,
  };

  await setCache(cacheKey, storefront);
  return storefront;
}

export async function searchStorefronts(params: {
  category?: string;
  verified?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ storefronts: ArweaveStorefront[]; nextCursor?: string }> {
  const tagFilters = [
    `{ name: "App-Name", values: ["${KV_APP_NAME}"] }`,
    `{ name: "Type", values: ["${TAG_TYPES.STOREFRONT}"] }`,
  ];

  if (params.category) {
    tagFilters.push(`{ name: "Category", values: ["${params.category}"] }`);
  }
  if (params.verified !== undefined) {
    tagFilters.push(`{ name: "Verified", values: ["${params.verified}"] }`);
  }

  const pagination = params.cursor
    ? `after: "${params.cursor}", first: ${params.limit ?? 20}`
    : `first: ${params.limit ?? 20}`;

  const query = `
    query {
      transactions(
        tags: [${tagFilters.join(', ')}],
        ${pagination},
        sort: HEIGHT_DESC
      ) {
        edges {
          cursor
          node {
            id
            tags { name value }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges = result?.data?.transactions?.edges ?? [];
  const storefronts: ArweaveStorefront[] = [];

  for (const edge of edges) {
    const data = await fetchTransactionData<any>(edge.node.id);
    if (data) {
      storefronts.push({
        ownerPubkey: getTagValue(edge.node.tags, 'Owner-Pubkey') ?? '',
        aptNumber: data.aptNumber ?? '',
        brandName: data.brandName ?? '',
        tagline: data.tagline,
        description: data.description,
        logoArweaveTx: data.logoArweaveTx,
        bannerArweaveTx: data.bannerArweaveTx,
        theme: data.theme ?? {},
        sections: data.sections ?? [],
        products: data.products ?? [],
        coupons: data.coupons ?? [],
        socialLinks: data.socialLinks ?? [],
        verified: data.verified ?? false,
        createdAt: data.createdAt ?? 0,
        updatedAt: data.updatedAt ?? 0,
        arweaveTx: edge.node.id,
      });
    }
  }

  const lastEdge = edges[edges.length - 1];
  const hasNext = result?.data?.transactions?.pageInfo?.hasNextPage;

  return {
    storefronts,
    nextCursor: hasNext ? lastEdge?.cursor : undefined,
  };
}

// ============================================================================
// FROST EVENT QUERIES
// ============================================================================

export async function queryFrostEvents(
  pubkey: string,
  limit = 50
): Promise<ArweaveFrostEvent[]> {
  const cacheKey = `ar_frost_${pubkey.slice(0, 16)}`;
  const cached = await getCached<ArweaveFrostEvent[]>(cacheKey, CACHE_TTL.FROST);
  if (cached) return cached;

  const pubkeyHash = hashPubkey(pubkey);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.FROST_EVENT}"] },
          { name: "Participant-Hash", values: ["${pubkeyHash}"] }
        ],
        first: ${limit},
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges = result?.data?.transactions?.edges ?? [];
  const events: ArweaveFrostEvent[] = [];

  for (const edge of edges) {
    const tags = edge.node.tags;
    events.push({
      agreementId: getTagValue(tags, 'Agreement-ID') ?? '',
      eventType: (getTagValue(tags, 'Event-Type') ?? 'created') as ArweaveFrostEvent['eventType'],
      buyerPubkey: getTagValue(tags, 'Buyer-Pubkey') ?? '',
      sellerPubkey: getTagValue(tags, 'Seller-Pubkey') ?? '',
      amountSompi: parseInt(getTagValue(tags, 'Amount-Sompi') ?? '0', 10),
      timestampMs: (edge.node.block?.timestamp ?? 0) * 1000,
      daaScore: parseInt(getTagValue(tags, 'DAA-Score') ?? '0', 10),
      l1TxId: getTagValue(tags, 'L1-TX-ID'),
      deadlockReason: getTagValue(tags, 'Deadlock-Reason'),
      arweaveTx: edge.node.id,
    });
  }

  await setCache(cacheKey, events);
  return events;
}

export async function queryAgreementEvents(
  agreementId: string
): Promise<ArweaveFrostEvent[]> {
  const agreementHash = hashAgreement(agreementId);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.FROST_EVENT}"] },
          { name: "Agreement-Hash", values: ["${agreementHash}"] }
        ],
        first: 10,
        sort: HEIGHT_ASC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edges = result?.data?.transactions?.edges ?? [];

  return edges.map(edge => ({
    agreementId,
    eventType: (getTagValue(edge.node.tags, 'Event-Type') ?? 'created') as ArweaveFrostEvent['eventType'],
    buyerPubkey: getTagValue(edge.node.tags, 'Buyer-Pubkey') ?? '',
    sellerPubkey: getTagValue(edge.node.tags, 'Seller-Pubkey') ?? '',
    amountSompi: parseInt(getTagValue(edge.node.tags, 'Amount-Sompi') ?? '0', 10),
    timestampMs: (edge.node.block?.timestamp ?? 0) * 1000,
    daaScore: parseInt(getTagValue(edge.node.tags, 'DAA-Score') ?? '0', 10),
    l1TxId: getTagValue(edge.node.tags, 'L1-TX-ID'),
    deadlockReason: getTagValue(edge.node.tags, 'Deadlock-Reason'),
    arweaveTx: edge.node.id,
  }));
}

// ============================================================================
// IDENTITY QUERIES
// ============================================================================

export async function queryIdentityByPubkey(
  pubkey: string
): Promise<ArweaveIdentity | null> {
  const cacheKey = `ar_id_${pubkey.slice(0, 16)}`;
  const cached = await getCached<ArweaveIdentity>(cacheKey, CACHE_TTL.IDENTITY);
  if (cached) return cached;

  const pubkeyHash = hashPubkey(pubkey);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.IDENTITY}"] },
          { name: "Pubkey-Hash", values: ["${pubkeyHash}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];
  if (!edge) return null;

  const tags = edge.node.tags;
  const identity: ArweaveIdentity = {
    pubkey,
    aptAlias: getTagValue(tags, 'APT-Alias') ?? '',
    avatarHash: getTagValue(tags, 'Avatar-Hash') ?? '',
    deviceAttestationHash: getTagValue(tags, 'Device-Attestation-Hash') ?? '',
    createdAt: edge.node.block?.timestamp ?? 0,
    l1InscriptionTx: getTagValue(tags, 'L1-Inscription-TX'),
    arweaveTx: edge.node.id,
  };

  await setCache(cacheKey, identity);
  return identity;
}

export async function queryIdentityByApt(
  aptAlias: string
): Promise<ArweaveIdentity | null> {
  const aptHash = hashApt(aptAlias);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.IDENTITY}"] },
          { name: "APT-Hash", values: ["${aptHash}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];
  if (!edge) return null;

  const tags = edge.node.tags;
  return {
    pubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
    aptAlias,
    avatarHash: getTagValue(tags, 'Avatar-Hash') ?? '',
    deviceAttestationHash: getTagValue(tags, 'Device-Attestation-Hash') ?? '',
    createdAt: edge.node.block?.timestamp ?? 0,
    l1InscriptionTx: getTagValue(tags, 'L1-Inscription-TX'),
    arweaveTx: edge.node.id,
  };
}

export async function isAptAliasTaken(aptAlias: string): Promise<boolean> {
  const identity = await queryIdentityByApt(aptAlias);
  return identity !== null;
}

export async function queryIdentityByAddress(
  kaspaAddress: string
): Promise<ArweaveIdentity | null> {
  const addressHash = hashAddress(kaspaAddress);

  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${TAG_TYPES.IDENTITY}"] },
          { name: "Address-Hash", values: ["${addressHash}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];
  if (!edge) return null;

  const tags = edge.node.tags;
  return {
    pubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',
    aptAlias: getTagValue(tags, 'APT-Alias') ?? '',
    avatarHash: getTagValue(tags, 'Avatar-Hash') ?? '',
    deviceAttestationHash: getTagValue(tags, 'Device-Attestation-Hash') ?? '',
    createdAt: edge.node.block?.timestamp ?? 0,
    l1InscriptionTx: getTagValue(tags, 'L1-Inscription-TX'),
    arweaveTx: edge.node.id,
  };
}

// ============================================================================
// VERIFICATION QUERIES
// ============================================================================

export async function queryVerificationProof(
  contentHash: string,
  ownerPubkey?: string
): Promise<{ exists: boolean; txId?: string; timestamp?: number }> {
  const contentHashIndex = hashContent(contentHash);

  const tagFilters = [
    `{ name: "App-Name", values: ["${KV_APP_NAME}"] }`,
    `{ name: "Type", values: ["${TAG_TYPES.PROOF}"] }`,
    `{ name: "Content-Hash", values: ["${contentHashIndex}"] }`,
  ];

  if (ownerPubkey) {
    const pubkeyHash = hashPubkey(ownerPubkey);
    tagFilters.push(`{ name: "Pubkey-Hash", values: ["${pubkeyHash}"] }`);
  }

  const query = `
    query {
      transactions(
        tags: [${tagFilters.join(', ')}],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            block { timestamp }
          }
        }
      }
    }
  `;

  const result = await queryArweave(query);
  const edge = result?.data?.transactions?.edges?.[0];

  if (!edge) return { exists: false };

  return {
    exists: true,
    txId: edge.node.id,
    timestamp: edge.node.block?.timestamp,
  };
}

// ============================================================================
// AGGREGATE STATS
// ============================================================================

export async function aggregateUserStatsFromArweave(
  pubkey: string
): Promise<ArweaveUserStats | null> {
  const events = await queryFrostEvents(pubkey, 100);
  if (events.length === 0) return null;

  let successes = 0;
  let deadlocks = 0;
  let totalVolumeSompi = 0;
  let totalAgreements = 0;
  const agreementsSeen = new Set<string>();

  for (const event of events) {
    const isParticipant = event.buyerPubkey === pubkey || event.sellerPubkey === pubkey;
    if (!isParticipant) continue;

    if (!agreementsSeen.has(event.agreementId)) {
      agreementsSeen.add(event.agreementId);
      totalAgreements++;
      totalVolumeSompi += event.amountSompi;
    }

    switch (event.eventType) {
      case 'completed': successes++; break;
      case 'deadlocked':
      case 'expired': deadlocks++; break;
    }
  }

  const xp = Math.max(0, successes * 10 - deadlocks * 50);
  const pComplete = (1 + successes) / (2 + successes + deadlocks);

  return {
    pubkey,
    successes,
    deadlocks,
    xp,
    pComplete,
    totalAgreements,
    totalVolumeSompi,
    lastUpdatedAt: Date.now(),
    arweaveTx: '',
  };
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

async function getCached<T>(key: string, ttl: number): Promise<T | null> {
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) return null;
    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() - entry.cachedAt > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    await SecureStore.setItemAsync(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[ArweaveQuery] Cache write failed:', error);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTagValue(tags: ArweaveTag[], name: string): string | undefined {
  return tags.find(t => t.name === name)?.value;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// URL HELPERS
// ============================================================================

export function arweaveUrl(txId: string): string {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

export function viewBlockUrl(txId: string): string {
  return `https://viewblock.io/arweave/tx/${txId}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  queryArweave,
  fetchTransactionData,
  hashApt,
  hashPubkey,
  hashAddress,
  hashAgreement,
  hashContent,
  queryUserStats,
  queryUserStatsBatch,
  aggregateUserStatsFromArweave,
  queryStorefront,
  searchStorefronts,
  queryFrostEvents,
  queryAgreementEvents,
  queryIdentityByPubkey,
  queryIdentityByApt,
  queryIdentityByAddress,
  isAptAliasTaken,
  queryVerificationProof,
  arweaveUrl,
  viewBlockUrl,
  ARWEAVE_GATEWAY,
  ARWEAVE_GRAPHQL,
  TAG_TYPES,
};