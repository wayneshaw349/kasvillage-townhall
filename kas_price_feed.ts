// ============================================================================
// KASVILLAGE EXPO — KAS PRICE FEED
// ============================================================================
// Sources (in order of priority):
//   1. api.kaspa.org/info/price     — native Kaspa REST API (no key needed)
//   2. CoinGecko simple price API   — free, no key needed
//   3. Stale cache                  — last known price, never shows $0
//
// Refreshes every 60 seconds while app is foregrounded.
// Cached to memory — no persistence needed (acceptable to show stale on cold start).
// ============================================================================

const KASPA_REST   = 'https://api.kaspa.org';
const COINGECKO    = 'https://api.coingecko.com/api/v3';
const SOMPI_PER_KAS = 100_000_000;
const REFRESH_MS    = 60_000;   // 60 seconds
const TIMEOUT_MS    = 8_000;    // 8 second fetch timeout
const STALE_LIMIT_MS = 5 * 60_000; // treat as stale after 5 min

// ============================================================================
// TYPES
// ============================================================================

export interface KasPriceData {
  usdPerKas: number;       // e.g. 0.0421
  usdPerSompi: number;     // usdPerKas / 1e8
  source: 'kaspa_api' | 'coingecko' | 'cache';
  fetchedAt: number;       // unix ms
  isStale: boolean;
}

type PriceListener = (price: KasPriceData) => void;

// ============================================================================
// INTERNAL STATE
// ============================================================================

let _cache: KasPriceData | null = null;
let _listeners: Set<PriceListener> = new Set();
let _refreshTimer: ReturnType<typeof setInterval> | null = null;
let _fetching = false;

// ============================================================================
// FETCH HELPERS
// ============================================================================

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Source 1: api.kaspa.org — try multiple known path variants
// v1 path: /info/price  → { price: number }
// v1.1 path: /info/price → same, or possibly /info/kas-price
async function fetchFromKaspaApi(): Promise<number | null> {
  const paths = ['/info/price', '/info/kas-price', '/api/v1/info/price'];
  for (const path of paths) {
    try {
      const res = await fetchWithTimeout(`${KASPA_REST}${path}`);
      if (!res.ok) continue;
      const data = await res.json();
      // Handle multiple possible response shapes
      const price = data?.price
        ?? data?.priceInUsd
        ?? data?.usd
        ?? data?.data?.price
        ?? data?.kaspa?.usd;
      if (typeof price === 'number' && price > 0) return price;
    } catch {
      continue;
    }
  }
  return null;
}

// Source 2: CoinGecko simple price
// Response: { kaspa: { usd: number } }
async function fetchFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `${COINGECKO}/simple/price?ids=kaspa&vs_currencies=usd`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.kaspa?.usd;
    if (typeof price === 'number' && price > 0) return price;
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// CORE FETCH
// ============================================================================

async function fetchPrice(): Promise<void> {
  if (_fetching) return;
  _fetching = true;

  try {
    // Try sources in priority order
    let usdPerKas: number | null = await fetchFromKaspaApi();

    if (!usdPerKas) {
      usdPerKas = await fetchFromCoinGecko();
    }

    if (usdPerKas && usdPerKas > 0) {
      _cache = {
        usdPerKas,
        usdPerSompi: usdPerKas / SOMPI_PER_KAS,
        source: usdPerKas === _cache?.usdPerKas ? 'cache' : 'kaspa_api',
        fetchedAt: Date.now(),
        isStale: false,
      };
      _notify();
    }
  } catch {
    // Non-fatal — keep showing cached value
  } finally {
    _fetching = false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the current KAS price synchronously.
 * Returns null if no price has been fetched yet.
 */
export function getKasPrice(): KasPriceData | null {
  if (!_cache) return null;
  const age = Date.now() - _cache.fetchedAt;
  return { ..._cache, isStale: age > STALE_LIMIT_MS };
}

/**
 * Convert sompi to USD string.
 * e.g. sompiToUsd(100_000_000n) → "0.04"
 */
export function sompiToUsd(sompi: bigint, decimals = 2): string {
  if (!_cache) return '—';
  const kas = Number(sompi) / SOMPI_PER_KAS;
  const usd = kas * _cache.usdPerKas;
  return usd.toFixed(decimals);
}

/**
 * Convert KAS amount to USD string.
 */
export function kasToUsd(kas: number, decimals = 2): string {
  if (!_cache) return '—';
  return (kas * _cache.usdPerKas).toFixed(decimals);
}

/**
 * Convert USD to KAS amount.
 */
export function usdToKas(usd: number): number {
  if (!_cache || _cache.usdPerKas === 0) return 0;
  return usd / _cache.usdPerKas;
}

/**
 * Subscribe to price updates.
 * Returns unsubscribe function.
 */
export function subscribeToPriceUpdates(listener: PriceListener): () => void {
  _listeners.add(listener);
  // Immediately emit cached value if available
  if (_cache) {
    const age = Date.now() - _cache.fetchedAt;
    listener({ ..._cache, isStale: age > STALE_LIMIT_MS });
  }
  return () => _listeners.delete(listener);
}

/**
 * Start the price feed. Call once from AppNavigator on mount.
 * Fetches immediately, then every 60 seconds.
 */
export function startPriceFeed(): () => void {
  // Fetch immediately
  fetchPrice();

  // Schedule periodic refresh
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(fetchPrice, REFRESH_MS);

  // Return cleanup function
  return () => {
    if (_refreshTimer) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
    _listeners.clear();
  };
}

/**
 * Manual one-shot fetch. Useful for pull-to-refresh.
 */
export function refreshPrice(): Promise<void> {
  return fetchPrice();
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect } from 'react';

export function useKasPrice(): KasPriceData | null {
  const [price, setPrice] = useState<KasPriceData | null>(getKasPrice());

  useEffect(() => {
    // Subscribe to updates
    const unsub = subscribeToPriceUpdates(setPrice);
    // Trigger a fresh fetch if cache is stale or missing
    const cache = getKasPrice();
    if (!cache || cache.isStale) fetchPrice();
    return unsub;
  }, []);

  return price;
}

// ============================================================================
// INTERNAL
// ============================================================================

function _notify(): void {
  if (!_cache) return;
  const data = getKasPrice()!;
  _listeners.forEach(fn => {
    try { fn(data); } catch { /* ignore listener errors */ }
  });
}
