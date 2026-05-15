// ============================================================================
// KASVILLAGE - DEVICE VERIFICATION
// ============================================================================
// Verifies current device matches L1 inscription or Arweave record
// Dual fallback: if L1 down, check Arweave; if Arweave down, check L1
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDeviceInfo } from './device_attestation';

// =============================================================================
// TYPES
// =============================================================================

export interface DeviceVerifyResult {
  verified: boolean;
  source: 'l1' | 'arweave' | 'none';
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const KASPA_API_MAINNET = 'https://api.kaspa.org';
const KASPA_API_TESTNET = 'https://api-tn10.kaspa.org';
const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';

// KV1 format: "KV1"(3) + pubkey(32) + aptHash(8) + avatarHash(8) + deviceAnchorHash(8) = 59 bytes
const KV1_DEVICE_OFFSET = 51;
const KV1_DEVICE_LENGTH = 8;

// =============================================================================
// HELPERS
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getKaspaApi(): Promise<string> {
  const network = await SecureStore.getItemAsync('kv_network');
  return network === 'mainnet' ? KASPA_API_MAINNET : KASPA_API_TESTNET;
}

// =============================================================================
// GET CURRENT DEVICE ANCHOR HASH
// =============================================================================

async function getCurrentDeviceAnchorHash(): Promise<string> {
  const deviceInfo = await getDeviceInfo();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceInfo.anchor
  );
  return hash.slice(0, 16); // 8 bytes = 16 hex chars
}

// =============================================================================
// L1 VERIFICATION
// =============================================================================

async function verifyDeviceL1(): Promise<{ verified: boolean; error?: string }> {
  const l1TxId = await SecureStore.getItemAsync('kv_l1_txid');
  
  if (!l1TxId) {
    return { verified: false, error: 'No L1 inscription' };
  }
  
  try {
    const api = await getKaspaApi();
    const response = await fetch(`${api}/transactions/${l1TxId}`, {
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    
    if (!response.ok) {
      return { verified: false, error: 'L1 fetch failed' };
    }
    
    const tx = await response.json();
    const outputs = tx.outputs || [];
    
    for (const output of outputs) {
      const script = output.script_public_key?.script_public_key || 
                     output.scriptPublicKey?.script || '';
      
      if (script.startsWith('6a')) {
        const payload = hexToBytes(script.slice(2));
        
        if (payload.length >= 59) {
          const marker = String.fromCharCode(...payload.slice(0, 3));
          if (marker === 'KV1') {
            const inscribedDeviceHash = bytesToHex(
              payload.slice(KV1_DEVICE_OFFSET, KV1_DEVICE_OFFSET + KV1_DEVICE_LENGTH)
            );
            
            const currentHash = await getCurrentDeviceAnchorHash();
            
            if (inscribedDeviceHash.toLowerCase() === currentHash.toLowerCase()) {
              return { verified: true };
            } else {
              return { verified: false, error: 'Device mismatch' };
            }
          }
        }
      }
    }
    
    return { verified: false, error: 'No KV1 inscription found' };
  } catch (e) {
    return { verified: false, error: `L1 error: ${e}` };
  }
}

// =============================================================================
// ARWEAVE VERIFICATION
// =============================================================================

async function verifyDeviceArweave(): Promise<{ verified: boolean; error?: string }> {
  const identityHash = await SecureStore.getItemAsync('kv_identity_hash');
  
  if (!identityHash) {
    return { verified: false, error: 'No identity hash' };
  }
  
  const query = `{
    transactions(
      tags: [
        { name: "App-Name", values: ["KasVillage"] },
        { name: "KV-Type", values: ["avatar"] },
        { name: "KV-Identity", values: ["${identityHash}"] }
      ],
      first: 1
    ) {
      edges {
        node {
          tags { name value }
        }
      }
    }
  }`;
  
  try {
    const response = await fetch(ARWEAVE_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    
    if (!response.ok) {
      return { verified: false, error: 'Arweave fetch failed' };
    }
    
    const json = await response.json();
    const edges = json.data?.transactions?.edges || [];
    
    if (edges.length === 0) {
      return { verified: false, error: 'No Arweave record' };
    }
    
    const tags = edges[0].node.tags || [];
    const deviceAnchorTag = tags.find((t: any) => t.name === 'KV-DeviceAnchor');
    
    if (!deviceAnchorTag) {
      return { verified: false, error: 'No device anchor in Arweave' };
    }
    
    const currentHash = await getCurrentDeviceAnchorHash();
    
    if (deviceAnchorTag.value.toLowerCase() === currentHash.toLowerCase()) {
      return { verified: true };
    } else {
      return { verified: false, error: 'Device mismatch' };
    }
  } catch (e) {
    return { verified: false, error: `Arweave error: ${e}` };
  }
}

// =============================================================================
// MAIN VERIFICATION (DUAL FALLBACK)
// =============================================================================

/**
 * Verify current device matches registered device
 * Tries L1 first, falls back to Arweave if L1 unavailable
 */
export async function verifyDevice(): Promise<DeviceVerifyResult> {
  // Try L1 first
  const l1Result = await verifyDeviceL1();
  if (l1Result.verified) {
    return { verified: true, source: 'l1' };
  }
  
  // If L1 failed due to network (not mismatch), try Arweave
  if (l1Result.error !== 'Device mismatch') {
    const arResult = await verifyDeviceArweave();
    if (arResult.verified) {
      return { verified: true, source: 'arweave' };
    }
    
    // If Arweave also failed due to mismatch, device is different
    if (arResult.error === 'Device mismatch') {
      return { verified: false, source: 'none', error: 'Device mismatch' };
    }
    
    // Both unavailable
    return { verified: false, source: 'none', error: 'Both L1 and Arweave unavailable' };
  }
  
  // L1 explicitly said device mismatch
  return { verified: false, source: 'none', error: 'Device mismatch' };
}

/**
 * Quick check - returns boolean only
 */
export async function isDeviceVerified(): Promise<boolean> {
  const result = await verifyDevice();
  return result.verified;
}

/**
 * Check if device was ever registered (has stored anchor hash)
 */
export async function hasRegisteredDevice(): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync('kv_device_anchor_hash');
  return !!storedHash;
}
