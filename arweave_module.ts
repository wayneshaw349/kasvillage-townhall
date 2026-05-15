// ============================================================================
// KASVILLAGE ARWEAVE MODULE - Core Types & Helpers
// ============================================================================
// Base module for Arweave integration, used by arweave_upload.ts
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

export const ARWEAVE_GATEWAY = 'https://arweave.net';
export const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';

// KasVillage-specific tags
export const KV_APP_NAME = 'KasVillage';
export const KV_APP_VERSION = '1.0.0';

// Tag prefixes
export const KV_PROOF_TAG = 'KV_PROOF_V1';
export const KV_STORE_TAG = 'KV_STORE_V1';
export const KV_PROFILE_TAG = 'KV_PROFILE_V1';
export const KV_ACADEMIC_TAG = 'KV_ACADEMIC_V1';
export const KV_SERVICE_TAG = 'KV_SERVICE_V1';
export const KV_DAPP_TAG = 'KV_DAPP_V1';
export const KV_IDENTITY_TAG = 'KV_IDENTITY_V1';

// ============================================================================
// TYPES
// ============================================================================

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveTransactionInfo {
  id: string;
  owner: string;
  tags: ArweaveTag[];
  data?: string;
  timestamp?: number;
  block?: {
    height: number;
    timestamp: number;
  };
}

export interface GraphQLQueryResult {
  data: {
    transactions: {
      edges: Array<{
        cursor: string;
        node: ArweaveTransactionInfo;
      }>;
      pageInfo?: {
        hasNextPage: boolean;
      };
    };
  };
}

// ============================================================================
// TAG HELPERS
// ============================================================================

/**
 * Prepare standard KasVillage tags for an Arweave upload
 */
export function prepareKVTags(
  type: 'proof' | 'store' | 'profile' | 'academic' | 'service' | 'dapp' | 'identity',
  ownerPubkey: string,
  additionalTags: ArweaveTag[] = []
): ArweaveTag[] {
  const typeTag = {
    proof: KV_PROOF_TAG,
    store: KV_STORE_TAG,
    profile: KV_PROFILE_TAG,
    academic: KV_ACADEMIC_TAG,
    service: KV_SERVICE_TAG,
    dapp: KV_DAPP_TAG,
    identity: KV_IDENTITY_TAG,
  }[type];

  return [
    { name: 'App-Name', value: KV_APP_NAME },
    { name: 'App-Version', value: KV_APP_VERSION },
    { name: 'Type', value: typeTag },
    { name: 'Owner-Pubkey', value: ownerPubkey },
    { name: 'Unix-Time', value: Date.now().toString() },
    { name: 'Content-Type', value: 'application/json' },
    ...additionalTags,
  ];
}

/**
 * Create verification proof tags
 */
export function createVerificationTags(
  ownerPubkey: string,
  contentHash: string,
  contentType: string
): ArweaveTag[] {
  return prepareKVTags('proof', ownerPubkey, [
    { name: 'Content-Hash', value: contentHash },
    { name: 'Verification-Type', value: contentType },
  ]);
}

/**
 * Create identity anchor tags
 */
export function createIdentityTags(
  ownerPubkey: string,
  avatarHash: string,
  aptAlias?: string
): ArweaveTag[] {
  const tags = prepareKVTags('identity', ownerPubkey, [
    { name: 'Avatar-Hash', value: avatarHash },
  ]);
  
  if (aptAlias) {
    tags.push({ name: 'APT-Alias', value: aptAlias });
  }
  
  return tags;
}

// ============================================================================
// GRAPHQL QUERY HELPERS
// ============================================================================

/**
 * Build a GraphQL query to find KasVillage transactions
 */
export function buildKVQuery(filters: {
  type?: string;
  ownerPubkey?: string;
  contentHash?: string;
  aptAlias?: string;
  after?: string;
  first?: number;
}): string {
  const tagFilters: string[] = [
    `{ name: "App-Name", values: ["${KV_APP_NAME}"] }`,
  ];

  if (filters.type) {
    tagFilters.push(`{ name: "Type", values: ["${filters.type}"] }`);
  }
  if (filters.ownerPubkey) {
    tagFilters.push(`{ name: "Owner-Pubkey", values: ["${filters.ownerPubkey}"] }`);
  }
  if (filters.contentHash) {
    tagFilters.push(`{ name: "Content-Hash", values: ["${filters.contentHash}"] }`);
  }
  if (filters.aptAlias) {
    tagFilters.push(`{ name: "APT-Alias", values: ["${filters.aptAlias}"] }`);
  }

  const pagination = filters.after 
    ? `after: "${filters.after}", first: ${filters.first ?? 10}`
    : `first: ${filters.first ?? 10}`;

  return `
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
            owner { address }
            tags { name value }
            block { height timestamp }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;
}

/**
 * Execute GraphQL query against Arweave
 */
export async function queryArweave(query: string): Promise<GraphQLQueryResult | null> {
  try {
    const response = await fetch(ARWEAVE_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('Arweave GraphQL error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Arweave query failed:', error);
    return null;
  }
}

/**
 * Find verification proof for a content hash
 */
export async function findVerificationProof(
  contentHash: string
): Promise<ArweaveTransactionInfo | null> {
  const query = buildKVQuery({
    type: KV_PROOF_TAG,
    contentHash,
    first: 1,
  });

  const result = await queryArweave(query);
  
  if (result?.data?.transactions?.edges?.length) {
    return result.data.transactions.edges[0].node;
  }

  return null;
}

/**
 * Find identity anchor for an APT alias
 */
export async function findIdentityAnchor(
  aptAlias: string
): Promise<ArweaveTransactionInfo | null> {
  const query = buildKVQuery({
    type: KV_IDENTITY_TAG,
    aptAlias,
    first: 1,
  });

  const result = await queryArweave(query);
  
  if (result?.data?.transactions?.edges?.length) {
    return result.data.transactions.edges[0].node;
  }

  return null;
}

/**
 * Get full transaction data
 */
export async function getTransactionData(txId: string): Promise<string | null> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Verify a proof exists and matches
 */
export async function verifyProofExists(
  contentHash: string,
  ownerPubkey: string
): Promise<{
  exists: boolean;
  txId?: string;
  timestamp?: number;
}> {
  const query = buildKVQuery({
    type: KV_PROOF_TAG,
    contentHash,
    ownerPubkey,
    first: 1,
  });

  const result = await queryArweave(query);
  
  if (result?.data?.transactions?.edges?.length) {
    const node = result.data.transactions.edges[0].node;
    return {
      exists: true,
      txId: node.id,
      timestamp: node.block?.timestamp,
    };
  }

  return { exists: false };
}

// ============================================================================
// URL HELPERS
// ============================================================================

/**
 * Get Arweave gateway URL for a transaction
 */
export function getArweaveUrl(txId: string): string {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * Get ViewBlock explorer URL
 */
export function getViewBlockUrl(txId: string): string {
  return `https://viewblock.io/arweave/tx/${txId}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ARWEAVE_GATEWAY,
  ARWEAVE_GRAPHQL,
  KV_APP_NAME,
  KV_APP_VERSION,
  KV_PROOF_TAG,
  KV_STORE_TAG,
  KV_PROFILE_TAG,
  prepareKVTags,
  createVerificationTags,
  createIdentityTags,
  buildKVQuery,
  queryArweave,
  findVerificationProof,
  findIdentityAnchor,
  getTransactionData,
  verifyProofExists,
  getArweaveUrl,
  getViewBlockUrl,
};
