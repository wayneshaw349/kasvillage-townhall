// device_attestation.ts — KasVillage Expo
// iOS App Attest / Android Play Integrity with mock fallbacks
// One APT per device enforced via attestation

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

// ============================================================================
// CRYPTO HELPERS (works without expo-crypto)
// ============================================================================

/**
 * SHA256 hash using Web Crypto API (available in React Native)
 */
async function sha256(message: string): Promise<string> {
  // Use subtle crypto if available (React Native Hermes)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback: Simple hash simulation for development
  // In production, install expo-crypto: npx expo install expo-crypto
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
  // Extend to 64 chars (256 bits)
  return (hashStr + hashStr + hashStr + hashStr + hashStr + hashStr + hashStr + hashStr).slice(0, 64);
}

/**
 * Generate random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  
  // Fallback for development
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// TYPES
// ============================================================================

export interface AttestationResult {
  success: boolean;
  token: string | null;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceHash: string;
  error?: string;
  isMock: boolean;
}

export interface IntegrityResult {
  success: boolean;
  isGenuine: boolean;
  isEmulator: boolean;
  hasPlayServices: boolean;
  error?: string;
}

export interface DeviceInfo {
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceId: string;
  isDevice: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TOWN_HALL_URL = 'https://townhall.kasvillage.com';
const ATTESTATION_TIMEOUT_MS = 10000;

// Apple App Attest (requires Apple Developer account)
const APP_ATTEST_SUPPORTED = Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 14;

// Android Play Integrity (requires Google Play Console setup)
const PLAY_INTEGRITY_SUPPORTED = Platform.OS === 'android';

// ============================================================================
// DEVICE FINGERPRINT
// ============================================================================

/**
 * Generate a unique device hash for APT binding
 * Combines hardware identifiers into SHA256 hash
 */
export async function getDeviceHash(): Promise<string> {
  const components = [
    Device.brand || 'unknown',
    Device.modelName || 'unknown',
    Device.osName || 'unknown',
    Device.osVersion || 'unknown',
    Device.deviceName || 'unknown',
    Platform.OS,
    // Add installation ID for uniqueness
    await Application.getInstallationTimeAsync().then(t => t?.toString() || '0'),
  ];
  
  const fingerprint = components.join('|');
  const hash = await sha256(fingerprint);
  
  return hash;
}

/**
 * Get device information for display
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    brand: Device.brand,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    deviceId: Device.modelId || 'unknown',
    isDevice: Device.isDevice,
  };
}

// ============================================================================
// iOS APP ATTEST
// ============================================================================

/**
 * Generate iOS App Attest attestation
 * Requires Apple Developer account with App Attest capability
 */
async function attestiOS(challenge: string): Promise<AttestationResult> {
  const deviceHash = await getDeviceHash();
  
  if (!APP_ATTEST_SUPPORTED) {
    return {
      success: false,
      token: null,
      platform: 'ios',
      deviceHash,
      error: 'App Attest not supported (iOS 14+ required)',
      isMock: true,
    };
  }
  
  try {
    // In production, this would use:
    // 1. DCAppAttestService.shared.generateKey()
    // 2. DCAppAttestService.shared.attestKey(keyId, clientDataHash)
    // 3. Send attestation to Town Hall for verification
    
    // For now, return mock attestation
    // TODO: Implement real App Attest when Apple Developer account is ready
    
    const mockToken = await generateMockToken('ios', deviceHash, challenge);
    
    return {
      success: true,
      token: mockToken,
      platform: 'ios',
      deviceHash,
      isMock: true,
    };
  } catch (error) {
    return {
      success: false,
      token: null,
      platform: 'ios',
      deviceHash,
      error: error instanceof Error ? error.message : 'Unknown error',
      isMock: true,
    };
  }
}

// ============================================================================
// ANDROID PLAY INTEGRITY
// ============================================================================

/**
 * Generate Android Play Integrity token
 * Requires Google Play Console setup
 */
async function attestAndroid(challenge: string): Promise<AttestationResult> {
  const deviceHash = await getDeviceHash();
  
  if (!PLAY_INTEGRITY_SUPPORTED) {
    return {
      success: false,
      token: null,
      platform: 'android',
      deviceHash,
      error: 'Play Integrity not supported',
      isMock: true,
    };
  }
  
  try {
    // In production, this would use:
    // 1. IntegrityManagerFactory.create(context)
    // 2. integrityManager.requestIntegrityToken(request)
    // 3. Send token to Town Hall for verification
    
    // For now, return mock attestation
    // TODO: Implement real Play Integrity when Google Play Console is ready
    
    const mockToken = await generateMockToken('android', deviceHash, challenge);
    
    return {
      success: true,
      token: mockToken,
      platform: 'android',
      deviceHash,
      isMock: true,
    };
  } catch (error) {
    return {
      success: false,
      token: null,
      platform: 'android',
      deviceHash,
      error: error instanceof Error ? error.message : 'Unknown error',
      isMock: true,
    };
  }
}

// ============================================================================
// WEB FALLBACK
// ============================================================================

/**
 * Web attestation fallback (less secure, for development)
 */
async function attestWeb(challenge: string): Promise<AttestationResult> {
  const deviceHash = await getDeviceHash();
  
  const mockToken = await generateMockToken('web', deviceHash, challenge);
  
  return {
    success: true,
    token: mockToken,
    platform: 'web',
    deviceHash,
    isMock: true,
  };
}

// ============================================================================
// MOCK TOKEN GENERATION
// ============================================================================

/**
 * Generate mock attestation token for development
 * In production, this is replaced by real platform attestation
 */
async function generateMockToken(
  platform: string,
  deviceHash: string,
  challenge: string
): Promise<string> {
  const payload = {
    platform,
    deviceHash,
    challenge,
    timestamp: Date.now(),
    isMock: true,
    version: '1.0.0',
  };
  
  const payloadStr = JSON.stringify(payload);
  const signature = await sha256(payloadStr + 'KASVILLAGE_DEV_SECRET');
  
  // Base64 encode the token
  const token = btoa(JSON.stringify({
    payload,
    signature,
  }));
  
  return token;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check device integrity and get attestation token
 * Main entry point for device verification
 */
export async function checkDeviceIntegrity(): Promise<IntegrityResult> {
  const info = getDeviceInfo();
  
  // Check if running on real device
  const isEmulator = !Device.isDevice;
  
  // Check for Play Services (Android only)
  const hasPlayServices = Platform.OS === 'android'; // Would check actual Play Services
  
  return {
    success: true,
    isGenuine: Device.isDevice,
    isEmulator,
    hasPlayServices,
  };
}

/**
 * Get attestation token for Town Hall registration
 * Called during wallet registration flow
 */
export async function getAttestationToken(challenge?: string): Promise<AttestationResult> {
  // Generate challenge if not provided
  const randomBytes = getRandomBytes(32);
  const attestChallenge = challenge || await sha256(
    Date.now().toString() + bytesToHex(randomBytes)
  );
  
  // Route to platform-specific attestation
  switch (Platform.OS) {
    case 'ios':
      return attestiOS(attestChallenge);
    case 'android':
      return attestAndroid(attestChallenge);
    default:
      return attestWeb(attestChallenge);
  }
}

/**
 * Verify attestation with Town Hall
 * Sends token to backend for validation
 */
export async function verifyWithTownHall(
  attestation: AttestationResult,
  pubkey: string
): Promise<{ success: boolean; aptNumber?: string; error?: string }> {
  try {
    const response = await fetch(`${TOWN_HALL_URL}/api/verify/attestation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: attestation.token,
        platform: attestation.platform,
        device_hash: attestation.deviceHash,
        pubkey,
        is_mock: attestation.isMock,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    
    const data = await response.json();
    return {
      success: data.verified,
      aptNumber: data.apt_number,
      error: data.error,
    };
  } catch (error) {
    // Fallback for development (no Town Hall connection)
    if (attestation.isMock) {
      // Generate mock APT number
      const aptNum = Math.floor(100 + Math.random() * 900);
      return {
        success: true,
        aptNumber: `APT-${aptNum}`,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Check if device is already registered (has APT)
 */
export async function checkExistingRegistration(
  deviceHash: string
): Promise<{ registered: boolean; aptNumber?: string }> {
  try {
    const response = await fetch(`${TOWN_HALL_URL}/api/apt/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_hash: deviceHash }),
    });
    
    if (!response.ok) {
      return { registered: false };
    }
    
    const data = await response.json();
    return {
      registered: data.registered,
      aptNumber: data.apt_number,
    };
  } catch {
    // Assume not registered if can't reach server
    return { registered: false };
  }
}

/**
 * Full registration flow
 * 1. Check device integrity
 * 2. Get attestation token
 * 3. Verify with Town Hall
 * 4. Receive APT number
 */
export async function registerDevice(
  pubkey: string
): Promise<{ success: boolean; aptNumber?: string; error?: string }> {
  // Step 1: Check integrity
  const integrity = await checkDeviceIntegrity();
  if (!integrity.success) {
    return { success: false, error: 'Device integrity check failed' };
  }
  
  // Step 2: Get attestation
  const attestation = await getAttestationToken();
  if (!attestation.success) {
    return { success: false, error: attestation.error || 'Attestation failed' };
  }
  
  // Step 3: Check if already registered
  const existing = await checkExistingRegistration(attestation.deviceHash);
  if (existing.registered) {
    return {
      success: true,
      aptNumber: existing.aptNumber,
    };
  }
  
  // Step 4: Register with Town Hall
  return verifyWithTownHall(attestation, pubkey);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  checkDeviceIntegrity,
  getAttestationToken,
  verifyWithTownHall,
  checkExistingRegistration,
  registerDevice,
  getDeviceHash,
  getDeviceInfo,
};