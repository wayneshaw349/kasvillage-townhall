// ============================================================================
// ATTESTATION BRIDGE - Maps RitualAttestation → TownHall DeviceAttestation
// ============================================================================
// No Apple/Google store dependency. Stack:
//   Jitter ZK Commitment + Device Fingerprint + Biometric + Timing + Quiz
// ============================================================================

import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import type { RitualAttestation, JitterMetrics, TimingMetrics } from './ritual_attestation';

// ============================================================================
// TOWNHALL-FACING PAYLOAD (matches Rust DeviceAttestation)
// ============================================================================

export interface TownHallDeviceAttestation {
  platform: string;
  device_hash: string;
  jitter_commitment: string;
  jitter_salt: string | null;
  biometric_passed: boolean;
  timing_hash: string;
  is_real_device: boolean;
  is_rooted: boolean;
  nonce: string;
  timestamp: number;
  quiz_score: number;
  question_hashes: string[];
}

// ============================================================================
// DEVICE FINGERPRINT (no store APIs needed)
// ============================================================================

export async function getDeviceHash(): Promise<string> {
  const brand = Device.brand || 'unknown';
  const model = Device.modelName || 'unknown';
  const os = Device.osName || 'unknown';
  const osVer = Device.osVersion || 'unknown';
  const appId = Application.applicationId || 'com.kasvillage.app';

  const raw = `${brand}:${model}:${os}:${osVer}:${appId}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw
  );
  return hash.slice(0, 16); // truncate for privacy
}

// ============================================================================
// BIOMETRIC GATE
// ============================================================================

export async function checkBiometric(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
}

// ============================================================================
// ROOT / EMULATOR DETECTION (heuristic, no store API)
// ============================================================================

export function checkIsRealDevice(): boolean {
  return Device.isDevice === true;
}

export async function checkIsRooted(): Promise<boolean> {
  try {
    // Basic heuristics — not foolproof, but catches obvious cases
    if (typeof process !== 'undefined' && process.env) {
      const suspicious = ['ANDROID_ROOT', 'MAGISK'];
      for (const v of suspicious) {
        if (process.env[v]) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// TIMING HASH
// ============================================================================

async function hashTimingMetrics(metrics: TimingMetrics): Promise<string> {
  const data = JSON.stringify({
    total: metrics.totalDurationMs,
    p1: metrics.phase1DurationMs,
    p2: metrics.phase2DurationMs,
    p3: metrics.phase3DurationMs,
    p4: metrics.phase4DurationMs,
    p5: metrics.phase5DurationMs,
    p6: metrics.phase6DurationMs,
    p7: metrics.phase7DurationMs,
    keys: metrics.keystrokeCount,
    taps: metrics.tapCount,
    colors: metrics.colorChangeCount,
  });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

// ============================================================================
// JITTER COMMITMENT (Poseidon on-device, send blind commitment)
// ============================================================================
// In production this uses Poseidon hash: C = Poseidon(pass_flag, salt)
// For now we use SHA256 placeholder until Halo2 WASM is wired
// ============================================================================

async function generateJitterCommitment(
  passed: boolean
): Promise<{ commitment: string; salt: string }> {
  // Generate random salt
  const saltBytes = await Crypto.getRandomBytesAsync(32);
  const salt = Array.from(saltBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const passFlag = passed ? '1' : '0';

  // TODO: Replace with real Poseidon hash when Halo2 WASM is ready
  const commitment = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `JITT:${passFlag}:${salt}`
  );

  return { commitment, salt };
}

// ============================================================================
// MAIN: Convert RitualAttestation → TownHall payload
// ============================================================================

export async function buildTownHallAttestation(
  ritual: RitualAttestation,
  serverNonce: string
): Promise<TownHallDeviceAttestation> {
  const deviceHash = await getDeviceHash();
  const timingHash = await hashTimingMetrics(ritual.timing.metrics);
  const { commitment, salt } = await generateJitterCommitment(ritual.jitter.passed);
  const isRooted = await checkIsRooted();

  const quizRatio = ritual.quiz.total > 0
    ? ritual.quiz.score / ritual.quiz.total
    : 0;

  return {
    platform: ritual.device.platform,
    device_hash: deviceHash,
    jitter_commitment: commitment,
    jitter_salt: salt,     // sent once for ZK proof gen, server discards after
    biometric_passed: ritual.device.passed && !ritual.device.isEmulator,
    timing_hash: timingHash,
    is_real_device: !ritual.device.isEmulator,
    is_rooted: isRooted,
    nonce: serverNonce,
    timestamp: Date.now(),
    quiz_score: quizRatio,
    question_hashes: ritual.quiz.questionHashes,
  };
}

// ============================================================================
// STANDALONE FLOW (no RitualAttestation yet, e.g. device registration)
// ============================================================================

export async function buildStandaloneAttestation(
  serverNonce: string
): Promise<TownHallDeviceAttestation> {
  const deviceHash = await getDeviceHash();
  const bioPassed = await checkBiometric();
  const isRooted = await checkIsRooted();
  const isReal = checkIsRealDevice();

  // No ritual data — minimal attestation for device binding
  return {
    platform: `${Device.osName || 'unknown'} ${Device.osVersion || ''}`.trim(),
    device_hash: deviceHash,
    jitter_commitment: '',   // empty = no ritual yet
    jitter_salt: null,
    biometric_passed: bioPassed,
    timing_hash: '',         // empty = no ritual yet
    is_real_device: isReal,
    is_rooted: isRooted,
    nonce: serverNonce,
    timestamp: Date.now(),
    quiz_score: 0,
    question_hashes: [],
  };
}
