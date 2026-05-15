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
const TOWN_HALL_URL         = 'https://townhall.kasvillage.com';

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

// ============================================================================
// TOWN HALL BINDING
// ============================================================================
// Sends device_hash + pubkey to TownHall.
// TownHall enforces: one APT per device_hash.
// If device_hash is already bound → returns existing APT (not an error).

export async function bindDeviceToTownHall(
  attestation: AttestationResult,
  pubkey: string
): Promise<TownHallBindResult> {
  try {
    const response = await fetch(`${TOWN_HALL_URL}/api/device/bind`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token:       attestation.token,
        device_hash: attestation.deviceHash,
        platform:    attestation.platform,
        pubkey,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: text };
    }

    const data = await response.json();
    return {
      success:       true,
      aptNumber:     data.apt_number,
      alreadyBound:  data.already_bound ?? false,
    };
  } catch (error) {
    return {
      success: false,
      error:   error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// CHECK EXISTING BINDING
// ============================================================================

export async function checkExistingBinding(
  deviceHash: string
): Promise<{ bound: boolean; aptNumber?: string }> {
  try {
    const response = await fetch(`${TOWN_HALL_URL}/api/device/check`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_hash: deviceHash }),
    });

    if (!response.ok) return { bound: false };

    const data = await response.json();
    return { bound: data.bound ?? false, aptNumber: data.apt_number };
  } catch {
    return { bound: false };
  }
}

// ============================================================================
// FULL REGISTRATION FLOW
// ============================================================================
// Called once during onboarding after wallet key generation.
// 1. Integrity check
// 2. Generate stable fingerprint
// 3. Check if already bound (recovery case)
// 4. Get attestation token
// 5. Bind to TownHall

export async function registerDevice(
  pubkey: string
): Promise<TownHallBindResult> {
  // 1. Integrity
  const integrity = await checkDeviceIntegrity();
  if (!integrity.success) {
    return { success: false, error: 'Device integrity check failed' };
  }

  // 2. Fingerprint
  let deviceHash: string;
  try {
    deviceHash = await getDeviceHash();
  } catch (e) {
    return { success: false, error: 'Could not generate device fingerprint' };
  }

  // 3. Already bound? (handles recovery: user reinstalled, same device)
  const existing = await checkExistingBinding(deviceHash);
  if (existing.bound) {
    return { success: true, aptNumber: existing.aptNumber, alreadyBound: true };
  }

  // 4. Attestation token
  const attestation = await getAttestationToken(pubkey);
  if (!attestation.success) {
    return { success: false, error: attestation.error };
  }

  // 5. Bind
  return bindDeviceToTownHall(attestation, pubkey);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getDeviceHash,
  getDeviceInfo,
  checkDeviceIntegrity,
  getAttestationToken,
  bindDeviceToTownHall,
  checkExistingBinding,
  registerDevice,
};
