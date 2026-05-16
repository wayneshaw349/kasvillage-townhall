// ============================================================================
// KASVILLAGE EXPO - TOWN HALL VERIFIER MODULE
// ============================================================================
// Drop-in replacement for the TownHallVerifier stub in kasvillage_complete.tsx
// Import this and replace the const TownHallVerifier = { ... } block
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

import {
  TOWN_HALL_ENDPOINTS,
  UserVerifyRequest,
  UserVerifyResponse,
  StoreVerifyRequest,
  StoreVerifyResponse,
  DAppVerifyRequest,
  DAppVerifyResponse,
  GameVerifyRequest,
  GameVerifyResponse,
  ReviewVerifyRequest,
  ReviewVerifyResponse,
  GlobalStats,
  CirculationStats,
  HealthResponse,
  SnailModeStatus,
  CodeScanResult,
  EntityType,
} from './shared_types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOWN_HALL_BASE_URL = __DEV__ 
  ? 'https://kasvillage.app.runonflux.io'
  : 'https://townhall.kasvillage.dev';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// SecureStore keys (must match wallet_registration)
const STORE_KEYS = {
  PUBLIC_KEY: 'kv_public_key',
  PRIVATE_KEY: 'kv_private_key',
  APT_NUMBER: 'kv_apt_number',
};

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface RequestOptions {
  method: 'GET' | 'POST';
  body?: unknown;
  timeout?: number;
  retries?: number;
}

async function request<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const url = `${TOWN_HALL_BASE_URL}${endpoint}`;
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const maxRetries = options.retries ?? MAX_RETRIES;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'X-KV-Client': 'expo-mobile',
          'X-KV-Version': '1.0.0',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        if (error.message.includes('HTTP 4')) {
          throw error;
        }
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  
  throw lastError ?? new Error('Request failed');
}

// ============================================================================
// SIGNING HELPER
// ============================================================================

async function signMessage(message: string): Promise<string> {
  const privateKey = await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY);
  if (!privateKey) {
    throw new Error('No private key stored');
  }
  
  const combined = `${privateKey}:${message}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hash;
}

// ============================================================================
// LEGACY RESPONSE TYPES (for backward compatibility)
// ============================================================================

interface LegacyUserVerifyResult {
  verified: boolean;
  stats?: {
    xp: number;
    pComplete: number;
    deadlocks: number;
    snailMode: boolean;
  };
  proof?: string;
  error?: string;
}

interface LegacyStoreVerifyResult {
  verified: boolean;
  ownerStats?: {
    xp: number;
    pComplete: number;
  };
  proof?: string;
  error?: string;
}

interface LegacyDAppVerifyResult {
  verified: boolean;
  qualityChecks?: {
    passed: boolean;
    criticalMatches: string[];
    warningMatches: string[];
  };
  proof?: string;
  error?: string;
}

// ============================================================================
// TOWN HALL VERIFIER (Drop-in replacement)
// ============================================================================

export const TownHallVerifier = {
  /**
   * Verify user stats meet criteria
   */
  verifyUser: async (aptNumber: string): Promise<LegacyUserVerifyResult> => {
    try {
      const req: UserVerifyRequest = {
        aptAlias: aptNumber,
        includeStats: true,
        includeSnailMode: true,
      };
      
      const result = await request<UserVerifyResponse>(
        TOWN_HALL_ENDPOINTS.VERIFY_USER,
        { method: 'POST', body: req }
      );
      
      return {
        verified: result.verified,
        stats: result.stats ? {
          xp: result.stats.xp,
          pComplete: result.stats.successes / Math.max(1, result.stats.successes + result.stats.deadlocks),
          deadlocks: result.stats.deadlocks,
          snailMode: result.snailMode?.active ?? false,
        } : undefined,
        proof: result.arweaveProof,
        error: result.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { verified: false, error: message };
    }
  },
  
  /**
   * Verify store meets verification criteria
   */
  verifyStore: async (storeId: string): Promise<LegacyStoreVerifyResult> => {
    try {
      const aptAlias = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
      
      const req: StoreVerifyRequest = {
        storeId,
        ownerApt: aptAlias || '',
        name: '', // Will be fetched from Arweave by Town Hall
        pledgeKas: 0,
      };
      
      const result = await request<StoreVerifyResponse>(
        TOWN_HALL_ENDPOINTS.VERIFY_STORE,
        { method: 'POST', body: req }
      );
      
      return {
        verified: result.verified,
        ownerStats: {
          xp: 0, // Town Hall returns this in full response
          pComplete: result.visibilityScore / 100,
        },
        proof: result.arweaveTx,
        error: result.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { verified: false, error: message };
    }
  },
  
  /**
   * Verify DApp meets quality gate
   */
  verifyDApp: async (dappId: string): Promise<LegacyDAppVerifyResult> => {
    try {
      const aptAlias = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
      
      const req: DAppVerifyRequest = {
        dappId,
        ownerApt: aptAlias || '',
        dappType: 'tool',
        code: '', // Will be fetched from Arweave by Town Hall
        pledgeKas: 0,
      };
      
      const result = await request<DAppVerifyResponse>(
        TOWN_HALL_ENDPOINTS.VERIFY_DAPP,
        { method: 'POST', body: req }
      );
      
      return {
        verified: result.verified,
        qualityChecks: {
          passed: result.codeScan.passed,
          criticalMatches: result.codeScan.criticalMatches,
          warningMatches: result.codeScan.warningMatches,
        },
        proof: result.arweaveTx,
        error: result.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { verified: false, error: message };
    }
  },
  
  /**
   * Verify game (stricter than DApp)
   */
  verifyGame: async (gameId: string, code: string, pledgeKas: number = 0): Promise<{
    verified: boolean;
    codeScan?: CodeScanResult;
    proof?: string;
    error?: string;
  }> => {
    try {
      const aptAlias = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
      
      const req: GameVerifyRequest = {
        gameId,
        ownerApt: aptAlias || '',
        code,
        pledgeKas,
      };
      
      const result = await request<GameVerifyResponse>(
        TOWN_HALL_ENDPOINTS.VERIFY_GAME,
        { method: 'POST', body: req }
      );
      
      return {
        verified: result.verified,
        codeScan: result.codeScan,
        proof: result.arweaveTx,
        error: result.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { verified: false, error: message };
    }
  },
  
  /**
   * Verify review authenticity
   */
  verifyReview: async (
    reviewText: string,
    targetId: string,
    targetType: EntityType
  ): Promise<{
    verified: boolean;
    isAuthentic: boolean;
    sentiment?: { positive: boolean; confidence: number };
    error?: string;
  }> => {
    try {
      const aptAlias = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
      
      const req: ReviewVerifyRequest = {
        reviewText,
        reviewerApt: aptAlias || '',
        targetId,
        targetType,
      };
      
      const result = await request<ReviewVerifyResponse>(
        TOWN_HALL_ENDPOINTS.VERIFY_REVIEW,
        { method: 'POST', body: req }
      );
      
      return {
        verified: result.verified,
        isAuthentic: result.authenticity.isAuthentic,
        sentiment: {
          positive: result.sentiment.positive,
          confidence: result.sentiment.confidence,
        },
        error: result.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { verified: false, isAuthentic: false, error: message };
    }
  },
  
  /**
   * Get verification status for any ID (legacy method)
   */
  getStatus: async (id: string, type: 'user' | 'store' | 'dapp'): Promise<{
    verified?: boolean;
    error?: string;
  }> => {
    try {
      switch (type) {
        case 'user':
          return await TownHallVerifier.verifyUser(id);
        case 'store':
          return await TownHallVerifier.verifyStore(id);
        case 'dapp':
          return await TownHallVerifier.verifyDApp(id);
        default:
          return { error: `Unknown type: ${type}` };
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { error: message };
    }
  },
  
  /**
   * Get global stats
   */
  getGlobalStats: async (): Promise<GlobalStats | { error: string }> => {
    try {
      return await request<GlobalStats>(
        TOWN_HALL_ENDPOINTS.STATS_GLOBAL,
        { method: 'GET' }
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { error: message } as { error: string };
    }
  },
  
  /**
   * Get circulation stats
   */
  getCirculation: async (): Promise<CirculationStats | { error: string }> => {
    try {
      return await request<CirculationStats>(
        TOWN_HALL_ENDPOINTS.STATS_CIRCULATION,
        { method: 'GET' }
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { error: message } as { error: string };
    }
  },
  
  /**
   * Health check
   */
  health: async (): Promise<HealthResponse | { error: string }> => {
    try {
      return await request<HealthResponse>(
        TOWN_HALL_ENDPOINTS.HEALTH,
        { method: 'GET', timeout: 5000, retries: 1 }
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { error: message } as { error: string };
    }
  },
  
  /**
   * Check if Town Hall is online
   */
  isOnline: async (): Promise<boolean> => {
    try {
      const health = await TownHallVerifier.health();
      return 'status' in health && health.status === 'ok';
    } catch {
      return false;
    }
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TownHallVerifier;
export { TOWN_HALL_BASE_URL };