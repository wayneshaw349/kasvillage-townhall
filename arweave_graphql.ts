// ============================================================================
// KASVILLAGE EXPO - ARWEAVE GRAPHQL MODULE
// ============================================================================
// Direct Arweave queries from phone for:
// - Verification proofs
// - DApp listings
// - Academic abstracts
// - Store verifications
// - User content
// ============================================================================

import * as Crypto from 'expo-crypto';

// ============================================================================
// CONSTANTS
// ============================================================================
export const ARWEAVE_GATEWAY = 'https://arweave.net';
export const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';
export const GOLDSKY_GRAPHQL = 'https://arweave-search.goldsky.com/graphql'; // Backup

// KasVillage content tags
export const KV_APP_NAME = 'KasVillage';
export const KV_PROOF_TAG = 'KV_PROOF_V1';
export const KV_DAPP_TAG = 'KV_DAPP_V1';
export const KV_STORE_TAG = 'KV_STORE_V1';
export const KV_ACADEMIC_TAG = 'KV_ACADEMIC_V1';
export const KV_PROFILE_TAG = 'KV_PROFILE_V1';

// ============================================================================
// TYPES
// ============================================================================
export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveEdge {
  cursor: string;
  node: {
    id: string;
    tags: ArweaveTag[];
    owner: {
      address: string;
    };
    block?: {
      height: number;
      timestamp: number;
    };
    data?: {
      size: string;
      type: string;
    };
  };
}

export interface ArweaveQueryResult {
  data: {
    transactions: {
      pageInfo: {
        hasNextPage: boolean;
      };
      edges: ArweaveEdge[];
    };
  };
}

export interface VerificationProof {
  txId: string;
  contentHash: string;
  contentType: 'store' | 'profile' | 'academic' | 'service' | 'dapp';
  ownerPubkey: string;
  timestamp: number;
  status: 'verified' | 'pending' | 'rejected';
}

export interface DAppListing {
  txId: string;
  dappId: string;
  name: string;
  category: string;
  board: 'incubator' | 'main' | 'elite';
  ownerPubkey: string;
  arweaveUrl: string;
  xpCommitment: number;
  timestamp: number;
  verified: boolean;
}

export interface AcademicAbstract {
  txId: string;
  abstractId: string;
  title: string;
  field: string;
  ownerPubkey: string;
  institution?: string;
  attestations: number;
  timestamp: number;
}

export interface StoreListing {
  txId: string;
  storeHash: string;
  brandName: string;
  ownerPubkey: string;
  timestamp: number;
  verified: boolean;
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

/**
 * Base GraphQL query executor
 */
async function executeQuery<T>(
  query: string,
  variables: Record<string, any> = {},
  useGoldsky = false,
): Promise<T | null> {
  const endpoint = useGoldsky ? GOLDSKY_GRAPHQL : ARWEAVE_GRAPHQL;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      console.error(`Arweave GraphQL error: ${response.status}`);
      // Try backup if primary fails
      if (!useGoldsky) {
        return executeQuery(query, variables, true);
      }
      return null;
    }
    
    const result = await response.json();
    return result as T;
  } catch (error) {
    console.error('Arweave GraphQL query failed:', error);
    // Try backup on network error
    if (!useGoldsky) {
      return executeQuery(query, variables, true);
    }
    return null;
  }
}

// ============================================================================
// VERIFICATION PROOFS
// ============================================================================

/**
 * Query verification proof by content hash
 */
export async function getVerificationProof(
  contentHash: string,
): Promise<VerificationProof | null> {
  const query = `
    query GetProof($hash: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_PROOF_TAG}"] },
          { name: "Content-Hash", values: [$hash] }
        ],
        first: 1
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, { hash: contentHash });
  
  if (!result?.data?.transactions?.edges?.length) {
    return null;
  }
  
  const edge = result.data.transactions.edges[0];
  const tags = tagsToMap(edge.node.tags);
  
  return {
    txId: edge.node.id,
    contentHash: tags['Content-Hash'] || contentHash,
    contentType: (tags['Content-Type'] || 'store') as VerificationProof['contentType'],
    ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
    timestamp: edge.node.block?.timestamp || Date.now() / 1000,
    status: (tags['Status'] || 'verified') as VerificationProof['status'],
  };
}

/**
 * Check if content hash is verified
 */
export async function isContentVerified(contentHash: string): Promise<boolean> {
  const proof = await getVerificationProof(contentHash);
  return proof?.status === 'verified';
}

// ============================================================================
// DAPP LISTINGS
// ============================================================================

/**
 * Query DApps by board
 */
export async function getDAppsByBoard(
  board: 'incubator' | 'main' | 'elite' | 'all' = 'all',
  limit = 20,
  cursor?: string,
): Promise<{ dapps: DAppListing[]; hasMore: boolean; nextCursor?: string }> {
  const boardFilter = board === 'all' 
    ? '' 
    : `{ name: "Board", values: ["${board}"] },`;
  
  const query = `
    query GetDApps($first: Int!, $after: String) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_DAPP_TAG}"] }
          ${boardFilter}
        ],
        first: $first,
        after: $after,
        sort: HEIGHT_DESC
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, {
    first: limit,
    after: cursor,
  });
  
  if (!result?.data?.transactions?.edges) {
    return { dapps: [], hasMore: false };
  }
  
  const dapps = result.data.transactions.edges.map(edge => {
    const tags = tagsToMap(edge.node.tags);
    return {
      txId: edge.node.id,
      dappId: tags['DApp-Id'] || '',
      name: tags['DApp-Name'] || 'Untitled',
      category: tags['Category'] || 'other',
      board: (tags['Board'] || 'incubator') as DAppListing['board'],
      ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
      arweaveUrl: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
      xpCommitment: parseInt(tags['XP-Commitment'] || '0'),
      timestamp: edge.node.block?.timestamp || Date.now() / 1000,
      verified: tags['Verified'] === 'true',
    };
  });
  
  const lastEdge = result.data.transactions.edges[result.data.transactions.edges.length - 1];
  
  return {
    dapps,
    hasMore: result.data.transactions.pageInfo.hasNextPage,
    nextCursor: lastEdge?.cursor,
  };
}

/**
 * Get DApp by ID
 */
export async function getDAppById(dappId: string): Promise<DAppListing | null> {
  const query = `
    query GetDApp($id: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_DAPP_TAG}"] },
          { name: "DApp-Id", values: [$id] }
        ],
        first: 1
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, { id: dappId });
  
  if (!result?.data?.transactions?.edges?.length) {
    return null;
  }
  
  const edge = result.data.transactions.edges[0];
  const tags = tagsToMap(edge.node.tags);
  
  return {
    txId: edge.node.id,
    dappId: tags['DApp-Id'] || dappId,
    name: tags['DApp-Name'] || 'Untitled',
    category: tags['Category'] || 'other',
    board: (tags['Board'] || 'incubator') as DAppListing['board'],
    ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
    arweaveUrl: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
    xpCommitment: parseInt(tags['XP-Commitment'] || '0'),
    timestamp: edge.node.block?.timestamp || Date.now() / 1000,
    verified: tags['Verified'] === 'true',
  };
}

// ============================================================================
// ACADEMIC ABSTRACTS
// ============================================================================

/**
 * Search academic abstracts
 */
export async function searchAcademicAbstracts(
  searchTerm?: string,
  field?: string,
  limit = 20,
  cursor?: string,
): Promise<{ abstracts: AcademicAbstract[]; hasMore: boolean; nextCursor?: string }> {
  const fieldFilter = field 
    ? `{ name: "Field", values: ["${field}"] },` 
    : '';
  
  const query = `
    query GetAbstracts($first: Int!, $after: String) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_ACADEMIC_TAG}"] }
          ${fieldFilter}
        ],
        first: $first,
        after: $after,
        sort: HEIGHT_DESC
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, {
    first: limit,
    after: cursor,
  });
  
  if (!result?.data?.transactions?.edges) {
    return { abstracts: [], hasMore: false };
  }
  
  let abstracts = result.data.transactions.edges.map(edge => {
    const tags = tagsToMap(edge.node.tags);
    return {
      txId: edge.node.id,
      abstractId: tags['Abstract-Id'] || '',
      title: tags['Title'] || 'Untitled',
      field: tags['Field'] || 'other',
      ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
      institution: tags['Institution'],
      attestations: parseInt(tags['Attestations'] || '0'),
      timestamp: edge.node.block?.timestamp || Date.now() / 1000,
    };
  });
  
  // Client-side search filter if searchTerm provided
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    abstracts = abstracts.filter(a => 
      a.title.toLowerCase().includes(searchLower) ||
      a.field.toLowerCase().includes(searchLower) ||
      a.institution?.toLowerCase().includes(searchLower)
    );
  }
  
  const lastEdge = result.data.transactions.edges[result.data.transactions.edges.length - 1];
  
  return {
    abstracts,
    hasMore: result.data.transactions.pageInfo.hasNextPage,
    nextCursor: lastEdge?.cursor,
  };
}

/**
 * Get abstract by ID
 */
export async function getAbstractById(abstractId: string): Promise<AcademicAbstract | null> {
  const query = `
    query GetAbstract($id: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_ACADEMIC_TAG}"] },
          { name: "Abstract-Id", values: [$id] }
        ],
        first: 1
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, { id: abstractId });
  
  if (!result?.data?.transactions?.edges?.length) {
    return null;
  }
  
  const edge = result.data.transactions.edges[0];
  const tags = tagsToMap(edge.node.tags);
  
  return {
    txId: edge.node.id,
    abstractId: tags['Abstract-Id'] || abstractId,
    title: tags['Title'] || 'Untitled',
    field: tags['Field'] || 'other',
    ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
    institution: tags['Institution'],
    attestations: parseInt(tags['Attestations'] || '0'),
    timestamp: edge.node.block?.timestamp || Date.now() / 1000,
  };
}

// ============================================================================
// STORE LISTINGS
// ============================================================================

/**
 * Get verified stores
 */
export async function getVerifiedStores(
  limit = 20,
  cursor?: string,
): Promise<{ stores: StoreListing[]; hasMore: boolean; nextCursor?: string }> {
  const query = `
    query GetStores($first: Int!, $after: String) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_STORE_TAG}"] },
          { name: "Verified", values: ["true"] }
        ],
        first: $first,
        after: $after,
        sort: HEIGHT_DESC
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, {
    first: limit,
    after: cursor,
  });
  
  if (!result?.data?.transactions?.edges) {
    return { stores: [], hasMore: false };
  }
  
  const stores = result.data.transactions.edges.map(edge => {
    const tags = tagsToMap(edge.node.tags);
    return {
      txId: edge.node.id,
      storeHash: tags['Store-Hash'] || '',
      brandName: tags['Brand-Name'] || 'Unnamed Store',
      ownerPubkey: tags['Owner-Pubkey'] || edge.node.owner.address,
      timestamp: edge.node.block?.timestamp || Date.now() / 1000,
      verified: tags['Verified'] === 'true',
    };
  });
  
  const lastEdge = result.data.transactions.edges[result.data.transactions.edges.length - 1];
  
  return {
    stores,
    hasMore: result.data.transactions.pageInfo.hasNextPage,
    nextCursor: lastEdge?.cursor,
  };
}

/**
 * Get store by owner pubkey
 */
export async function getStoreByOwner(ownerPubkey: string): Promise<StoreListing | null> {
  const query = `
    query GetStoreByOwner($pubkey: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Type", values: ["${KV_STORE_TAG}"] },
          { name: "Owner-Pubkey", values: [$pubkey] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            owner {
              address
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, { pubkey: ownerPubkey });
  
  if (!result?.data?.transactions?.edges?.length) {
    return null;
  }
  
  const edge = result.data.transactions.edges[0];
  const tags = tagsToMap(edge.node.tags);
  
  return {
    txId: edge.node.id,
    storeHash: tags['Store-Hash'] || '',
    brandName: tags['Brand-Name'] || 'Unnamed Store',
    ownerPubkey: tags['Owner-Pubkey'] || ownerPubkey,
    timestamp: edge.node.block?.timestamp || Date.now() / 1000,
    verified: tags['Verified'] === 'true',
  };
}

// ============================================================================
// USER CONTENT QUERIES
// ============================================================================

/**
 * Get all content by user pubkey
 */
export async function getContentByUser(
  ownerPubkey: string,
  contentType?: 'store' | 'dapp' | 'academic' | 'profile',
): Promise<{
  stores: StoreListing[];
  dapps: DAppListing[];
  abstracts: AcademicAbstract[];
}> {
  const typeFilter = contentType
    ? `{ name: "Type", values: ["KV_${contentType.toUpperCase()}_V1"] },`
    : '';
  
  const query = `
    query GetUserContent($pubkey: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["${KV_APP_NAME}"] },
          { name: "Owner-Pubkey", values: [$pubkey] }
          ${typeFilter}
        ],
        first: 100,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            block {
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const result = await executeQuery<ArweaveQueryResult>(query, { pubkey: ownerPubkey });
  
  const stores: StoreListing[] = [];
  const dapps: DAppListing[] = [];
  const abstracts: AcademicAbstract[] = [];
  
  if (!result?.data?.transactions?.edges) {
    return { stores, dapps, abstracts };
  }
  
  for (const edge of result.data.transactions.edges) {
    const tags = tagsToMap(edge.node.tags);
    const type = tags['Type'];
    
    if (type === KV_STORE_TAG) {
      stores.push({
        txId: edge.node.id,
        storeHash: tags['Store-Hash'] || '',
        brandName: tags['Brand-Name'] || 'Unnamed Store',
        ownerPubkey,
        timestamp: edge.node.block?.timestamp || Date.now() / 1000,
        verified: tags['Verified'] === 'true',
      });
    } else if (type === KV_DAPP_TAG) {
      dapps.push({
        txId: edge.node.id,
        dappId: tags['DApp-Id'] || '',
        name: tags['DApp-Name'] || 'Untitled',
        category: tags['Category'] || 'other',
        board: (tags['Board'] || 'incubator') as DAppListing['board'],
        ownerPubkey,
        arweaveUrl: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
        xpCommitment: parseInt(tags['XP-Commitment'] || '0'),
        timestamp: edge.node.block?.timestamp || Date.now() / 1000,
        verified: tags['Verified'] === 'true',
      });
    } else if (type === KV_ACADEMIC_TAG) {
      abstracts.push({
        txId: edge.node.id,
        abstractId: tags['Abstract-Id'] || '',
        title: tags['Title'] || 'Untitled',
        field: tags['Field'] || 'other',
        ownerPubkey,
        institution: tags['Institution'],
        attestations: parseInt(tags['Attestations'] || '0'),
        timestamp: edge.node.block?.timestamp || Date.now() / 1000,
      });
    }
  }
  
  return { stores, dapps, abstracts };
}

// ============================================================================
// CONTENT FETCHING
// ============================================================================

/**
 * Fetch raw content from Arweave by transaction ID
 */
export async function fetchArweaveContent(txId: string): Promise<string | null> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!response.ok) {
      console.error(`Failed to fetch Arweave content: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error('Failed to fetch Arweave content:', error);
    return null;
  }
}

/**
 * Fetch JSON content from Arweave
 */
export async function fetchArweaveJson<T>(txId: string): Promise<T | null> {
  const content = await fetchArweaveContent(txId);
  if (!content) return null;
  
  try {
    return JSON.parse(content) as T;
  } catch {
    console.error('Failed to parse Arweave JSON content');
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert tags array to map for easy access
 */
function tagsToMap(tags: ArweaveTag[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const tag of tags) {
    map[tag.name] = tag.value;
  }
  return map;
}

/**
 * Generate content hash for verification
 */
export async function generateContentHash(content: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    content
  );
  return hash;
}

/**
 * Build Arweave gateway URL
 */
export function arweaveUrl(txId: string): string {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

// ============================================================================
// UPLOAD HELPERS (for Bundlr integration)
// ============================================================================

export interface BundlrUploadOptions {
  data: string | Uint8Array;
  tags: ArweaveTag[];
  contentType?: string;
}

/**
 * Prepare tags for KasVillage content
 */
export function prepareKVTags(
  type: 'store' | 'dapp' | 'academic' | 'profile' | 'proof',
  ownerPubkey: string,
  extraTags: ArweaveTag[] = [],
): ArweaveTag[] {
  const typeTag = {
    store: KV_STORE_TAG,
    dapp: KV_DAPP_TAG,
    academic: KV_ACADEMIC_TAG,
    profile: KV_PROFILE_TAG,
    proof: KV_PROOF_TAG,
  }[type];
  
  return [
    { name: 'App-Name', value: KV_APP_NAME },
    { name: 'Type', value: typeTag },
    { name: 'Owner-Pubkey', value: ownerPubkey },
    { name: 'Timestamp', value: Date.now().toString() },
    ...extraTags,
  ];
}

/**
 * Estimate upload cost (placeholder - actual cost comes from Bundlr)
 */
export function estimateUploadCost(dataSize: number): number {
  // Rough estimate: ~0.00001 AR per KB
  const kbSize = dataSize / 1024;
  return kbSize * 0.00001;
}
