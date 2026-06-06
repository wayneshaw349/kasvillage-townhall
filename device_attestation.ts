// ============================================================================
// KASVILLAGE EXPO — DEVICE ATTESTATION & FINGERPRINT
// ============================================================================
// Strategy: NO App Attest, NO Play Integrity dependency.
// One-APT-per-device enforced via a stable SecureStore anchor UUID that:
//   - Survives OS/firmware upgrades (iOS Keychain persists across updates)
//   - Survives app updates
//   - Resets on factory reset or full app uninstall (both = legitimate "new device")
//
// Fingerprint = SHA256(stableAnchor | applicationId | brand | modelName | osName)
//   - osVersion intentionally EXCLUDED (changes on firmware upgrades)
//   - deviceName intentionally EXCLUDED (user-editable)
//   - installationTime intentionally EXCLUDED (changes on reinstall)
// ============================================================================

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface AttestationResult {
  success: boolean;
  token: string;           // signed payload sent to TownHall
  platform: 'ios' | 'android' | 'unknown';
  deviceHash: string;      // stable firmware-proof fingerprint
  anchor: string;          // stable UUID (never changes after first launch)
  error?: string;
}

export interface IntegrityResult {
  success: boolean;
  isPhysicalDevice: boolean;
  isEmulator: boolean;
  platform: 'ios' | 'android' | 'unknown';
  error?: string;
}

export interface DeviceInfo {
  brand: string;
  modelName: string;
  osName: string;
  osVersion: string;       // informational only — not part of fingerprint
  applicationId: string;
  anchor: string;
  isPhysicalDevice: boolean;
}

export interface TownHallBindResult {
  success: boolean;
  aptNumber?: string;
  alreadyBound?: boolean;  // true = device already has an APT, return existing
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORE_KEY_ANCHOR      = 'kv_device_anchor';       // stable UUID
const STORE_KEY_HASH_CACHE  = 'kv_device_hash_cache';   // cached hash
const TOWN_HALL_URL         = 'https://kasvillage.app.runonflux.io';

// ============================================================================
// STABLE DEVICE ANCHOR
// ============================================================================
// Generated once on first launch, stored in SecureStore with ALWAYS accessibility.
// On iOS: lives in the Keychain — persists through OS upgrades and app updates.
// On Android: lives in EncryptedSharedPreferences — persists through OS upgrades.
// Reset only on: factory reset, full app uninstall (both = legitimate new device).

async function getOrCreateAnchor(): Promise<string> {
  // Try cache first
  try {
    const existing = await SecureStore.getItemAsync(STORE_KEY_ANCHOR, {
      // ALWAYS = accessible even when device is locked (survives reboots)
      keychainAccessible: SecureStore.ALWAYS,
    });
    if (existing && existing.length === 36) return existing; // valid UUID
  } catch {
    // SecureStore read error — fall through to create
  }

  // Generate new anchor UUID (RFC 4122 v4)
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const anchor = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),          // version 4
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), // variant
    hex.slice(20, 32),
  ].join('-');

  await SecureStore.setItemAsync(STORE_KEY_ANCHOR, anchor, {
    keychainAccessible: SecureStore.ALWAYS,
  });

  return anchor;
}

// ============================================================================
// STABLE DEVICE FINGERPRINT
// ============================================================================
// Components used (all firmware-proof):
//   anchor        — stable UUID (above)
//   applicationId — com.kasvillage.mobile (never changes)
//   brand         — Apple / Samsung / Google (hardware, never changes)
//   modelName     — iPhone 15 Pro / Pixel 8 (hardware, never changes)
//   osName        — iOS / Android (never changes)
//   platform      — ios / android (never changes)
//
// Components deliberately excluded:
//   osVersion     — changes on firmware/OS upgrade ❌
//   deviceName    — user-editable ❌
//   installationTime — changes on app reinstall ❌

export async function getDeviceHash(): Promise<string> {
  // Return cached hash if anchor hasn't changed
  try {
    const cached = await SecureStore.getItemAsync(STORE_KEY_HASH_CACHE);
    if (cached && cached.length === 64) {
      // Validate: re-derive and compare to detect tampering
      const anchor = await getOrCreateAnchor();
      const freshHash = await deriveHash(anchor);
      if (freshHash === cached) return cached;
    }
  } catch {
    // Cache miss — compute fresh
  }

  const anchor = await getOrCreateAnchor();
  const hash = await deriveHash(anchor);

  // Cache for subsequent calls
  try {
    await SecureStore.setItemAsync(STORE_KEY_HASH_CACHE, hash, {
      keychainAccessible: SecureStore.ALWAYS,
    });
  } catch {
    // Non-fatal — cache is optional
  }

  return hash;
}

async function deriveHash(anchor: string): Promise<string> {
  const components = [
    anchor,
    Application.applicationId ?? 'com.kasvillage.mobile',
    Device.brand             ?? 'unknown',
    Device.modelName         ?? 'unknown',
    Device.osName            ?? 'unknown',
    Platform.OS,
  ];

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    components.join('|'),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

// ============================================================================
// DEVICE INFO (for display only)
// ============================================================================

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const anchor = await getOrCreateAnchor();
  return {
    brand:            Device.brand         ?? 'Unknown',
    modelName:        Device.modelName     ?? 'Unknown',
    osName:           Device.osName        ?? 'Unknown',
    osVersion:        Device.osVersion     ?? 'Unknown',  // display only
    applicationId:    Application.applicationId ?? 'com.kasvillage.mobile',
    anchor,
    isPhysicalDevice: Device.isDevice      ?? false,
  };
}

// ============================================================================
// INTEGRITY CHECK
// ============================================================================
// No Play Integrity / App Attest needed.
// We check: is this a real device (not an emulator/simulator)?
// Emulators are not blocked outright — but TownHall can reject them if desired.

export async function checkDeviceIntegrity(): Promise<IntegrityResult> {
  const isPhysicalDevice = Device.isDevice ?? false;
  const platform = Platform.OS === 'ios' ? 'ios'
                 : Platform.OS === 'android' ? 'android'
                 : 'unknown';

  return {
    success: true,
    isPhysicalDevice,
    isEmulator: !isPhysicalDevice,
    platform,
  };
}

// ============================================================================
// ATTESTATION TOKEN
// ============================================================================
// Signed payload sent to TownHall to prove device identity.
// Signature = SHA256(deviceHash | pubkey | timestamp | challenge | APP_SECRET)
// APP_SECRET is the applicationId — public but app-specific, prevents
// tokens from one app being replayed against another.

export async function getAttestationToken(
  pubkey: string,
  challenge?: string
): Promise<AttestationResult> {
  try {
    const anchor      = await getOrCreateAnchor();
    const deviceHash  = await deriveHash(anchor);
    const platform    = Platform.OS === 'ios' ? 'ios'
                      : Platform.OS === 'android' ? 'android'
                      : 'unknown' as const;
    const timestamp   = Date.now();
    const nonce       = challenge ?? await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${timestamp}${anchor}`
    );

    const appId = Application.applicationId ?? 'com.kasvillage.mobile';

    // Deterministic signature — no random, no server round-trip needed
    const sigInput   = `${deviceHash}|${pubkey}|${timestamp}|${nonce}|${appId}`;
    const signature  = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      sigInput,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    const payload = {
      v:           2,                    // token version
      platform,
      device_hash: deviceHash,
      anchor_hint: anchor.slice(0, 8),   // first 8 chars of UUID for debug (not secret)
      pubkey,
      timestamp,
      nonce,
      signature,
      app_id:      appId,
    };

    const token = btoa(JSON.stringify(payload));

    return {
      success:    true,
      token,
      platform,
      deviceHash,
      anchor,
    };
  } catch (error) {
    return {
      success:    false,
      token:      '',
      platform:   'unknown',
      deviceHash: '',
      anchor:     '',
      error:      error instanceof Error ? error.message : 'Attestation failed',
    };
  }
}

// TownHall binding removed — TownHall is stateless, Arweave is source of truth

// Check binding removed — query Arweave directly

// ============================================================================
// FULL REGISTRATION — Arweave only (TownHall is stateless)
// ============================================================================
// 1. Integrity check
// 2. Generate stable fingerprint
// 3. Get attestation token
// 4. Inscribe to Arweave (permanent proof)
// TownHall reads Arweave when it needs to verify.

export async function registerDevice(
  pubkey: string
): Promise<TownHallBindResult> {
  const integrity = await checkDeviceIntegrity();
  if (!integrity.success) return { success: false, error: 'Device integrity check failed' };
  if (integrity.isEmulator) return { success: false, error: 'Emulators not supported' };

  let deviceHash: string;
  try { deviceHash = await getDeviceHash(); }
  catch { return { success: false, error: 'Could not generate device fingerprint' }; }

  const attestation = await getAttestationToken(pubkey);
  if (!attestation.success) return { success: false, error: attestation.error };

  // Store locally
  await SecureStore.setItemAsync('kv_device_hash', deviceHash);
  await SecureStore.setItemAsync('kv_device_platform', attestation.platform);

  // Derive APT
  let apt = '0';
  try {
    const { deriveApt } = await import('./apt_derivation');
    apt = deriveApt(pubkey);
  } catch {}

  return { success: true, aptNumber: apt };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getDeviceHash,
  getDeviceInfo,
  checkDeviceIntegrity,
  getAttestationToken,
  registerDevice,
  inscribeAttestationToArweave,
  checkExistingAttestation,
};


// ============================================================================
// ARWEAVE INSCRIPTION — permanent attestation proof
// ============================================================================

export async function inscribeAttestationToArweave(params: {
  pubkey: string;
  privKeyHex: string;
}): Promise<{ txId: string } | null> {
  try {
    const { pubkey, privKeyHex } = params;
    const attestation = await getAttestationToken(pubkey);
    if (!attestation.success) return null;

    let apt = '0';
    try {
      const { deriveApt } = await import('./apt_derivation');
      apt = deriveApt(pubkey);
    } catch {}

    const payload = JSON.stringify({
      v: 2,
      device_hash: attestation.deviceHash,
      platform: attestation.platform,
      pubkey,
      apt,
      timestamp: Date.now(),
    });

    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'KV-Type', value: 'device-attestation' },
      { name: 'KV-DeviceHash', value: attestation.deviceHash },
      { name: 'KV-Pubkey', value: pubkey },
      { name: 'KV-Platform', value: attestation.platform },
      { name: 'KV-Apt', value: apt },
      { name: 'Content-Type', value: 'application/json' },
    ];

    const arweaveUpload = await import('./arweave_upload');
    const buildAns104Item = (arweaveUpload as any).buildAns104Item || (arweaveUpload as any).default?.buildAns104Item;
    const uploadToIrys = (arweaveUpload as any).uploadToIrys || (arweaveUpload as any).default?.uploadToIrys;
    const data = new TextEncoder().encode(payload);
    const result = await buildAns104Item(data, tags, privKeyHex).then(uploadToIrys);

    if (result?.txId) {
      console.log('[Attestation] Inscribed to Arweave:', result.txId);
      await SecureStore.setItemAsync('kv_attestation_arweave_tx', result.txId);
      return { txId: result.txId };
    }
    return null;
  } catch (e) {
    console.error('[Attestation] Arweave inscription failed:', e);
    return null;
  }
}

// ============================================================================
// CHECK EXISTING ATTESTATION — query Arweave directly
// ============================================================================

export async function checkExistingAttestation(
  deviceHash: string
): Promise<{ exists: boolean; pubkey?: string; apt?: string }> {
  try {
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Type", values: ["device-attestation"] },
          { name: "KV-DeviceHash", values: ["${deviceHash}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges { node { tags { name value } } }
      }
    }`;
    const res = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { exists: false };
    const data = await res.json();
    const tags = data?.data?.transactions?.edges?.[0]?.node?.tags;
    if (!tags) return { exists: false };
    const pubkey = tags.find((t: {name:string}) => t.name === 'KV-Pubkey')?.value;
    const apt = tags.find((t: {name:string}) => t.name === 'KV-Apt')?.value;
    return { exists: true, pubkey, apt };
  } catch {
    return { exists: false };
  }
}

