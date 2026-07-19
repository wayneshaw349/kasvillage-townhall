// ============================================================================
// KASVILLAGE — WALLET ↔ SHAMIR INTEGRATION
// ============================================================================
// The single seam between the wallet and the Shamir backup system.
// createWallet produces `wallet.seed` (32 bytes). This module turns that into
// N QR-ready share strings (2-of-N), and rebuilds the seed from scanned shares.
//
// Uses expo-crypto for the secure RNG — no new dependency.
// Every split is self-verified before shares are returned (see shamir_wire).
// ============================================================================

import * as Crypto from 'expo-crypto';
import { splitWithVerify, recoverFromWires } from './shamir_wire';
import type { ShamirShare } from './shamir';

// Secure RNG adapter: expo-crypto -> (n) => Uint8Array
// getRandomBytes is synchronous on expo-crypto (SDK 54); if unavailable at
// runtime, the async variant should be pre-warmed by the caller.
function secureRandom(n: number): Uint8Array {
  // getRandomBytes is sync and CSPRNG-backed on native.
  return Crypto.getRandomBytes(n);
}

export interface BackupResult {
  wires: string[];          // one QR string per share
  generation: number;       // tag for this share set
  threshold: number;
  total: number;
}

/**
 * Create a Shamir backup of the wallet seed.
 * @param seed        the 32-byte wallet seed from createWallet (wallet.seed)
 * @param total       number of shares to issue (e.g. 4 for the house-key model)
 * @param generation  bump on every re-split; defaults to 1 for first backup
 * @param threshold   shares required to recover (default 2 — "any two cards")
 *
 * Throws if the split fails self-verification. On success, the returned wires
 * are proven to reconstruct the exact seed. Show one QR per wire; never store
 * them together in a cloud-synced location.
 */
export function createSeedBackup(
  seed: Uint8Array,
  total: number,
  generation = 1,
  threshold = 2,
): BackupResult {
  if (seed.length !== 32) {
    throw new Error(`expected 32-byte seed, got ${seed.length}`);
  }
  const { wires } = splitWithVerify(seed, threshold, total, generation, secureRandom);
  return { wires, generation, threshold, total };
}

/**
 * Rebuild the wallet seed from scanned QR share strings.
 * Validates format, checksum, and generation-consistency before combining.
 * @returns the 32-byte seed, ready to feed back into the wallet derivation
 *          (deriveKaspaHDKey path) exactly as createWallet does.
 */
export function recoverSeedFromShares(scannedWires: string[]): Uint8Array {
  const seed = recoverFromWires(scannedWires);
  if (seed.length !== 32) {
    throw new Error(`recovered seed has wrong length: ${seed.length}`);
  }
  return seed;
}

/**
 * Re-split: issue a fresh generation of shares from the seed, voiding all
 * previous shares. Call after any suspected share compromise or after a
 * recovery event. The new generation will not combine with old shares.
 * @param currentGeneration the generation currently in use; new = +1
 */
export function resplitSeed(
  seed: Uint8Array,
  total: number,
  currentGeneration: number,
  threshold = 2,
): BackupResult {
  return createSeedBackup(seed, total, currentGeneration + 1, threshold);
}

// ---- integration note (not code) -------------------------------------------
// In createWallet (wallet_registration_v2.ts), AFTER the wallet object is built
// and BEFORE returning, the Vault-mode path would call:
//
//   const backup = createSeedBackup(wallet.seed, 4);   // 2-of-4
//   // hand backup.wires to the QR display screen, one per card/device
//
// Standard (non-vault) wallets skip this and rely on the mnemonic.
// The seed used MUST be the same 32 bytes that deriveKaspaHDKey consumes, so
// recovery reproduces the identical address.
