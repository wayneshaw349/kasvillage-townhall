// ============================================================================
// KASVILLAGE HYDRA ROUTING - Cryptographic Reentry with Cliff
// ============================================================================
//
// Architecture:
//   Phone → Cloudflare (primary) → Town Hall
//   Phone → Ingress Chain A (fallback) → Town Hall
//   Phone → Ingress Chain B (fallback) → Town Hall
//
// Flow:
//   1. Try Cloudflare first
//   2. If CF fails, generate reentry code from failed attempt
//   3. Hop through Chain A with reentry code
//   4. If Chain A exhausted, hop through Chain B
//   5. Ingress validates crypto signature before forwarding
//
// ============================================================================

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// ENDPOINT CONFIGURATION
// ============================================================================

// Cloudflare (public, in DNS)
const CLOUDFLARE_ENDPOINT = 'https://api.kasvillage.io';

// Ingress Chain A - NOT in DNS, hardcoded
// Rotate these IPs weekly
const CHAIN_A: string[] = [
  'https://45.139.122.10:8443',
  'https://45.139.122.11:8443',
  'https://45.139.122.12:8443',
  'https://45.139.122.13:8443',
  'https://45.139.122.14:8443',
  'https://45.139.122.15:8443',
];

// Ingress Chain B - NOT in DNS, hardcoded
// Different provider/region than Chain A
const CHAIN_B: string[] = [
  'https://185.212.44.20:8443',
  'https://185.212.44.21:8443',
  'https://185.212.44.22:8443',
  'https://185.212.44.23:8443',
  'https://185.212.44.24:8443',
  'https://185.212.44.25:8443',
];

// ============================================================================
// CRYPTO REENTRY CODE
// ============================================================================

interface ReentryCode {
  timestamp: number;
  nonce: string;
  cfAttemptHash: string;  // Proves we tried Cloudflare
  deviceHash: string;     // Ties to this device
  signature: string;      // HMAC signature
}

// Shared secret - in production, derive from device attestation
const REENTRY_SECRET = 'kv_hydra_reentry_v1';

async function generateReentryCode(cfRequestId: string): Promise<ReentryCode> {
  const timestamp = Date.now();
  const nonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${timestamp}-${Math.random()}`
  );
  
  // Get device identifier
  const deviceId = await SecureStore.getItemAsync('device_id') || 'unknown';
  const deviceHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceId
  );
  
  // Hash the failed CF request to prove we tried
  const cfAttemptHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `cf_attempt:${cfRequestId}:${timestamp}`
  );
  
  // Create signature
  const message = `${timestamp}:${nonce}:${cfAttemptHash}:${deviceHash}`;
  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${REENTRY_SECRET}:${message}`
  );
  
  return {
    timestamp,
    nonce: nonce.substring(0, 16),
    cfAttemptHash: cfAttemptHash.substring(0, 32),
    deviceHash: deviceHash.substring(0, 16),
    signature: signature.substring(0, 32),
  };
}

function encodeReentryCode(code: ReentryCode): string {
  const jsonStr = JSON.stringify(code);
  // React Native compatible base64
  return btoa(unescape(encodeURIComponent(jsonStr)));
}


// ============================================================================
// HYDRA STATE
// ============================================================================

interface HydraState {
  currentTier: 'cloudflare' | 'chain_a' | 'chain_b';
  chainIndex: number;
  consecutiveFailures: number;
  reentryCode: ReentryCode | null;
  lastCfRequestId: string;
}

let hydraState: HydraState = {
  currentTier: 'cloudflare',
  chainIndex: 0,
  consecutiveFailures: 0,
  reentryCode: null,
  lastCfRequestId: '',
};

const MAX_FAILURES_PER_NODE = 2;
const REQUEST_TIMEOUT_MS = 5000;
const CF_TIMEOUT_MS = 3000; // Shorter timeout for CF to fail fast

// ============================================================================
// HYDRA FETCH
// ============================================================================

export async function hydraFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Generate unique request ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Step 1: Always try Cloudflare first
  if (hydraState.currentTier === 'cloudflare') {
    try {
      const response = await fetchWithTimeout(
        `${CLOUDFLARE_ENDPOINT}${path}`,
        options,
        CF_TIMEOUT_MS
      );
      
      if (response.ok) {
        resetHydraState();
        return response;
      }
      
      // CF returned error (might be rate limited or overloaded)
      if (response.status >= 500) {
        await fallToIngress(requestId);
      }
    } catch (error) {
      // CF unreachable - DDoS cliff activated
      console.log('[HYDRA] Cloudflare cliff hit, falling to ingress');
      await fallToIngress(requestId);
    }
  }
  
  // Step 2: Try ingress chains with reentry code
  return await tryIngressChains(path, options);
}

async function fallToIngress(cfRequestId: string): Promise<void> {
  hydraState.currentTier = 'chain_a';
  hydraState.chainIndex = 0;
  hydraState.consecutiveFailures = 0;
  hydraState.lastCfRequestId = cfRequestId;
  hydraState.reentryCode = await generateReentryCode(cfRequestId);
}

async function tryIngressChains(
  path: string,
  options: RequestInit
): Promise<Response> {
  const chains = {
    chain_a: CHAIN_A,
    chain_b: CHAIN_B,
  };
  
  while (hydraState.currentTier !== 'cloudflare') {
    const chain = chains[hydraState.currentTier as 'chain_a' | 'chain_b'];
    
    if (hydraState.chainIndex >= chain.length) {
      // Chain exhausted, move to next
      if (hydraState.currentTier === 'chain_a') {
        console.log('[HYDRA] Chain A exhausted, hopping to Chain B');
        hydraState.currentTier = 'chain_b';
        hydraState.chainIndex = 0;
        continue;
      } else {
        // Both chains exhausted
        throw new Error('HYDRA_EXHAUSTED: All ingress nodes unreachable');
      }
    }
    
    const endpoint = chain[hydraState.chainIndex];
    
    try {
      const response = await fetchWithReentry(endpoint, path, options);
      
      if (response.ok) {
        hydraState.consecutiveFailures = 0;
        return response;
      }
      
      if (response.status >= 500) {
        handleNodeFailure();
      }
    } catch (error) {
      handleNodeFailure();
    }
  }
  
  // Shouldn't reach here
  throw new Error('HYDRA_ERROR: Unexpected state');
}

async function fetchWithReentry(
  endpoint: string,
  path: string,
  options: RequestInit
): Promise<Response> {
  if (!hydraState.reentryCode) {
    throw new Error('No reentry code available');
  }
  
  const headers = new Headers(options.headers);
  headers.set('X-KV-Reentry', encodeReentryCode(hydraState.reentryCode));
  headers.set('X-KV-Chain', hydraState.currentTier);
  headers.set('X-KV-Hop', String(hydraState.chainIndex));
  
  return await fetchWithTimeout(
    `${endpoint}${path}`,
    { ...options, headers },
    REQUEST_TIMEOUT_MS
  );
}

function handleNodeFailure(): void {
  hydraState.consecutiveFailures++;
  
  if (hydraState.consecutiveFailures >= MAX_FAILURES_PER_NODE) {
    console.log(`[HYDRA] Node ${hydraState.chainIndex} in ${hydraState.currentTier} failed, hopping`);
    hydraState.chainIndex++;
    hydraState.consecutiveFailures = 0;
  }
}

function resetHydraState(): void {
  hydraState = {
    currentTier: 'cloudflare',
    chainIndex: 0,
    consecutiveFailures: 0,
    reentryCode: null,
    lastCfRequestId: '',
  };
}

// ============================================================================
// TIMEOUT WRAPPER
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================================
// RECOVERY CHECK
// ============================================================================

let lastRecoveryCheck = 0;
const RECOVERY_CHECK_INTERVAL_MS = 30000;

export async function checkCloudflareRecovery(): Promise<boolean> {
  const now = Date.now();
  if (now - lastRecoveryCheck < RECOVERY_CHECK_INTERVAL_MS) {
    return false;
  }
  
  lastRecoveryCheck = now;
  
  if (hydraState.currentTier === 'cloudflare') {
    return true; // Already on CF
  }
  
  try {
    const response = await fetchWithTimeout(
      `${CLOUDFLARE_ENDPOINT}/health`,
      { method: 'GET' },
      2000
    );
    
    if (response.ok) {
      console.log('[HYDRA] Cloudflare recovered, switching back');
      resetHydraState();
      return true;
    }
  } catch (error) {
    // CF still down
  }
  
  return false;
}

// ============================================================================
// STATUS
// ============================================================================

export function getHydraStatus(): {
  tier: string;
  node: number;
  healthy: boolean;
  hasReentryCode: boolean;
} {
  return {
    tier: hydraState.currentTier,
    node: hydraState.chainIndex,
    healthy: hydraState.currentTier === 'cloudflare',
    hasReentryCode: hydraState.reentryCode !== null,
  };
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
import { hydraFetch, getHydraStatus, checkCloudflareRecovery } from './hydra_routing';

// Make API call - automatically handles routing
const response = await hydraFetch('/api/verify/user', {
  method: 'POST',
  body: JSON.stringify({ apt: '303' }),
});

// Check status
const status = getHydraStatus();
console.log(`Currently on: ${status.tier}, node: ${status.node}`);

// Periodically check if CF recovered
setInterval(checkCloudflareRecovery, 30000);
*/
