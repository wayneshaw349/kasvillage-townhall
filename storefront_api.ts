// ============================================================================
// KASVILLAGE - STOREFRONT API CLIENT
// ============================================================================
// Endpoints:
// - GET  /api/storefront/{pubkey}           - Fetch storefront data
// - POST /api/storefront/{pubkey}/visit     - Record visit
// - GET  /api/storefront/{pubkey}/stats     - Get storefront stats
// - POST /api/storefront                    - Create/update storefront
// - GET  /api/storefront/{pubkey}/products  - List products
// - GET  /api/storefront/search             - Search storefronts
// ============================================================================

import * as SecureStore from 'expo-secure-store';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOWNHALL_URL = 'https://kasvillage.app.runonflux.io';
const ARWEAVE_GATEWAY = 'https://arweave.net';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// TYPES
// ============================================================================

export interface StorefrontTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  cardBg: string;
}

export interface SocialLink {
  platform: 'twitter' | 'telegram' | 'discord' | 'website' | 'email' | 'github';
  url: string;
  label?: string;
}

export interface StorefrontSection {
  id: string;
  type: 'hero' | 'brand_bar' | 'products' | 'social' | 'coupons' | 'stash' | 'about';
  title?: string;
  visible: boolean;
  order: number;
  config?: Record<string, any>;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'freeShipping' | 'bundleDeal';
  value: number;
  description: string;
  minPurchaseSompi?: number;
  maxUses?: number;
  usedCount: number;
  expiresAt?: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceSompi: number;
  imageArweaveTx?: string;
  category: string;
  inStock: boolean;
  quantity?: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StashItem {
  id: string;
  name: string;
  description: string;
  priceSompi: number;
  imageArweaveTx?: string;
  downloadArweaveTx?: string;
  type: 'digital' | 'physical' | 'service';
  available: boolean;
}

export interface Storefront {
  // Identity
  ownerPubkey: string;
  aptNumber: string;
  brandName: string;
  tagline?: string;
  description?: string;
  
  // Branding
  logoArweaveTx?: string;
  logoShape: 'circle' | 'square';
  bannerArweaveTx?: string;
  theme: StorefrontTheme;
  
  // Layout
  sections: StorefrontSection[];
  
  // Content
  products: Product[];
  coupons: Coupon[];
  stashItems: StashItem[];
  socialLinks: SocialLink[];
  
  // Stats (from backend)
  totalVisits: number;
  uniqueVisitors: number;
  agreementsCompleted: number;
  totalVolumeSompi: number;
  rating?: number;
  reviewCount: number;
  
  // Verification
  verified: boolean;
  verificationTx?: string;
  verifiedAt?: number;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastVisitAt?: number;
  
  // Arweave
  arweaveTx?: string;
}

export interface StorefrontStats {
  totalVisits: number;
  uniqueVisitors: number;
  visitsLast7d: number;
  visitsLast30d: number;
  agreementsStarted: number;
  agreementsCompleted: number;
  agreementsDeadlocked: number;
  totalVolumeSompi: number;
  avgAgreementSompi: number;
  repeatCustomers: number;
  conversionRate: number; // visitors who started agreement
  completionRate: number; // started agreements that completed
}

export interface VisitRecord {
  visitorPubkey: string;
  storefrontPubkey: string;
  timestampMs: number;
  daaScore: number;
  source?: 'search' | 'direct' | 'referral' | 'qr';
  referrer?: string;
}

export interface StorefrontSearchResult {
  pubkey: string;
  brandName: string;
  tagline?: string;
  logoArweaveTx?: string;
  verified: boolean;
  rating?: number;
  reviewCount: number;
  productCount: number;
  category?: string;
}

export interface StorefrontSearchParams {
  query?: string;
  category?: string;
  verified?: boolean;
  minRating?: number;
  sortBy?: 'rating' | 'visits' | 'recent' | 'volume';
  limit?: number;
  offset?: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Fetch storefront data by owner pubkey
 */
export async function fetchStorefront(pubkey: string): Promise<Storefront | null> {
  // Check cache first
  const cacheKey = `storefront_${pubkey}`;
  const cached = await getCachedStorefront(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(`${TOWNHALL_URL}/api/storefront/${pubkey}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Storefront fetch failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache it
    await cacheStorefront(cacheKey, data.storefront);
    
    return data.storefront;
  } catch (error) {
    console.error('[StorefrontAPI] Fetch error:', error);
    
    // Try Arweave fallback
    return fetchStorefrontFromArweave(pubkey);
  }
}

/**
 * Fetch storefront directly from Arweave (fallback)
 */
async function fetchStorefrontFromArweave(pubkey: string): Promise<Storefront | null> {
  try {
    // GraphQL query for latest storefront
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["KasVillage"] },
            { name: "Type", values: ["Storefront"] },
            { name: "Owner-Pubkey", values: ["${pubkey}"] }
          ],
          first: 1,
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    
    const response = await fetch(`${ARWEAVE_GATEWAY}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    
    const result = await response.json();
    const txId = result?.data?.transactions?.edges?.[0]?.node?.id;
    
    if (!txId) return null;
    
    // Fetch full data
    const dataResponse = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!dataResponse.ok) return null;
    
    return await dataResponse.json();
  } catch (error) {
    console.error('[StorefrontAPI] Arweave fallback failed:', error);
    return null;
  }
}

/**
 * Record a visit to a storefront
 */
export async function recordVisit(
  storefrontPubkey: string,
  visitorPubkey: string,
  source?: 'search' | 'direct' | 'referral' | 'qr',
  referrer?: string
): Promise<boolean> {
  try {
    // Sign the visit record
    const timestamp = Date.now();
    const message = `VISIT:${storefrontPubkey}:${visitorPubkey}:${timestamp}`;
    const signature = await signMessage(message);
    
    const response = await fetch(`${TOWNHALL_URL}/api/storefront/${storefrontPubkey}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorPubkey,
        timestamp,
        source,
        referrer,
        signature,
      }),
    });
    
    if (!response.ok) {
      console.warn('[StorefrontAPI] Visit record failed:', response.status);
      return false;
    }
    
    // Track locally
    await trackLocalVisit(storefrontPubkey);
    
    return true;
  } catch (error) {
    console.error('[StorefrontAPI] Visit record error:', error);
    return false;
  }
}

/**
 * Get storefront statistics
 */
export async function fetchStorefrontStats(pubkey: string): Promise<StorefrontStats | null> {
  try {
    const response = await fetch(`${TOWNHALL_URL}/api/storefront/${pubkey}/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('[StorefrontAPI] Stats fetch error:', error);
    return null;
  }
}

/**
 * Create or update storefront
 */
export async function saveStorefront(
  storefront: Partial<Storefront>,
  signature: string
): Promise<{ success: boolean; arweaveTx?: string; error?: string }> {
  try {
    const response = await fetch(`${TOWNHALL_URL}/api/storefront`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storefront,
        signature,
        timestamp: Date.now(),
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Save failed' };
    }
    
    // Invalidate cache
    await SecureStore.deleteItemAsync(`storefront_${storefront.ownerPubkey}`);
    
    return { success: true, arweaveTx: data.arweaveTx };
  } catch (error) {
    console.error('[StorefrontAPI] Save error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Search storefronts
 */
export async function searchStorefronts(
  params: StorefrontSearchParams
): Promise<StorefrontSearchResult[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('q', params.query);
    if (params.category) queryParams.set('category', params.category);
    if (params.verified !== undefined) queryParams.set('verified', String(params.verified));
    if (params.minRating) queryParams.set('minRating', String(params.minRating));
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.offset) queryParams.set('offset', String(params.offset));
    
    const response = await fetch(
      `${TOWNHALL_URL}/api/storefront/search?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[StorefrontAPI] Search error:', error);
    return [];
  }
}

/**
 * Fetch products for a storefront
 */
export async function fetchProducts(
  pubkey: string,
  category?: string
): Promise<Product[]> {
  try {
    const url = category
      ? `${TOWNHALL_URL}/api/storefront/${pubkey}/products?category=${encodeURIComponent(category)}`
      : `${TOWNHALL_URL}/api/storefront/${pubkey}/products`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error('[StorefrontAPI] Products fetch error:', error);
    return [];
  }
}

/**
 * Get visit history for current user
 */
export async function getVisitHistory(): Promise<{ pubkey: string; lastVisit: number }[]> {
  try {
    const historyJson = await SecureStore.getItemAsync('kv_storefront_visits');
    if (!historyJson) return [];
    return JSON.parse(historyJson);
  } catch {
    return [];
  }
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

interface CachedStorefront {
  data: Storefront;
  cachedAt: number;
}

async function getCachedStorefront(key: string): Promise<Storefront | null> {
  try {
    const cached = await SecureStore.getItemAsync(key);
    if (!cached) return null;
    
    const parsed: CachedStorefront = JSON.parse(cached);
    const age = Date.now() - parsed.cachedAt;
    
    if (age > CACHE_TTL_MS) {
      // Expired, but return stale data for now
      // Caller should refresh in background
      return parsed.data;
    }
    
    return parsed.data;
  } catch {
    return null;
  }
}

async function cacheStorefront(key: string, data: Storefront): Promise<void> {
  try {
    const cached: CachedStorefront = {
      data,
      cachedAt: Date.now(),
    };
    await SecureStore.setItemAsync(key, JSON.stringify(cached));
  } catch (error) {
    console.warn('[StorefrontAPI] Cache write failed:', error);
  }
}

async function trackLocalVisit(pubkey: string): Promise<void> {
  try {
    const historyJson = await SecureStore.getItemAsync('kv_storefront_visits');
    let history: { pubkey: string; lastVisit: number }[] = historyJson 
      ? JSON.parse(historyJson) 
      : [];
    
    // Update or add
    const existing = history.find(h => h.pubkey === pubkey);
    if (existing) {
      existing.lastVisit = Date.now();
    } else {
      history.unshift({ pubkey, lastVisit: Date.now() });
    }
    
    // Keep last 50
    history = history.slice(0, 50);
    
    await SecureStore.setItemAsync('kv_storefront_visits', JSON.stringify(history));
  } catch (error) {
    console.warn('[StorefrontAPI] Visit tracking failed:', error);
  }
}

// ============================================================================
// SIGNATURE HELPER
// ============================================================================
async function signMessage(message: string): Promise<string> {
  try {
    const privKeyHex = await SecureStore.getItemAsync('kv_l1_privkey_enc');
    if (!privKeyHex) throw new Error('No private key');

    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const { sha256 } = await import('@noble/hashes/sha256');

    // Buffer.from(hex) → manual hex decode
    const privKey = Uint8Array.from(
      privKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
    );
    const msgHash = sha256(new TextEncoder().encode(message));
    const sig = secp256k1.sign(msgHash, privKey);

    // Buffer.from(...).toString('hex') → manual hex encode
    return Array.from(sig.toCompactRawBytes())
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('[StorefrontAPI] Sign error:', error);
    return '';
  }
}

// ============================================================================
// IMAGE URL HELPERS
// ============================================================================

/**
 * Convert Arweave TX to gateway URL
 */
export function arweaveUrl(txId?: string): string | undefined {
  if (!txId) return undefined;
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * Whitelist check for image URLs
 */
const WHITELISTED_DOMAINS = [
  'arweave.net',
  'kasvillage.dev',
  'node2.irys.xyz',
];

export function isWhitelistedImageUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return WHITELISTED_DOMAINS.some(d => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_THEME: StorefrontTheme = {
  primary: '#f59e0b',    // amber-500
  secondary: '#78716c',  // stone-500
  accent: '#a855f7',     // purple-500
  background: '#FFFFFF',
  text: '#1c1917',       // stone-900
  cardBg: '#FFF8F0',
};

export const DEFAULT_SECTIONS: StorefrontSection[] = [
  { id: 'hero', type: 'hero', visible: true, order: 0 },
  { id: 'brand', type: 'brand_bar', visible: true, order: 1 },
  { id: 'products', type: 'products', title: 'Products', visible: true, order: 2 },
  { id: 'coupons', type: 'coupons', title: 'Coupons', visible: true, order: 3 },
  { id: 'stash', type: 'stash', title: 'Stash', visible: true, order: 4 },
  { id: 'social', type: 'social', title: 'Connect', visible: true, order: 5 },
];

export function createEmptyStorefront(ownerPubkey: string, aptNumber: string): Storefront {
  return {
    ownerPubkey,
    aptNumber,
    brandName: `APT ${aptNumber}`,
    logoShape: 'circle',
    theme: DEFAULT_THEME,
    sections: DEFAULT_SECTIONS,
    products: [],
    coupons: [],
    stashItems: [],
    socialLinks: [],
    totalVisits: 0,
    uniqueVisitors: 0,
    agreementsCompleted: 0,
    totalVolumeSompi: 0,
    reviewCount: 0,
    verified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
