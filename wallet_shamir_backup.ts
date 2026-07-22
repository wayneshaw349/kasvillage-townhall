// ============================================================================
// KASVILLAGE — WALLET ↔ SHAMIR INTEGRATION  (MNEMONIC-STRING EDITION)
// ============================================================================
// The single seam between the wallet and the Shamir backup system.
//
// WHY THE MNEMONIC STRING (not entropy, not the seed slice):
//   createWallet derives keys as:
//       mnemonic -> mnemonicToSeed(_, '') [64 bytes] -> deriveKaspaHDKey
//   The seed (and therefore the address) is a pure function of the mnemonic
//   STRING via PBKDF2 — it does NOT depend on the BIP39 wordlist at all.
//
//   So we Shamir-split the UTF-8 bytes of the mnemonic string itself.
//   Recovery reconstructs the exact string -> mnemonicToSeed(_, '') ->
//   deriveKaspaHDKey -> IDENTICAL address. This is robust even if the
//   wordlist is wrong/version-skewed (a real bug this codebase had), and it
//   works for any-length phrase.
//
// Uses expo-crypto for the secure RNG — no new dependency.
// Every split is self-verified before shares are returned (see shamir_wire):
// if the bytes don't round-trip through split->combine and wire encode/decode,
// createMnemonicBackup THROWS and no cards are shown.
// ============================================================================

import * as Crypto from 'expo-crypto';
import { splitWithVerify, recoverFromWires } from './shamir_wire';

// Secure RNG adapter: expo-crypto -> (n) => Uint8Array (sync, CSPRNG-backed).
function secureRandom(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

export interface BackupResult {
  wires: string[];          // one QR string per share
  generation: number;       // tag for this share set
  threshold: number;
  total: number;
}

/**
 * Create a Shamir backup of the wallet MNEMONIC (its UTF-8 bytes).
 * @param mnemonic    the mnemonic from createWallet (wallet.mnemonic / kv_mnemonic)
 * @param total       number of shares to issue (e.g. 4 for the house-key model)
 * @param generation  bump on every re-split; defaults to 1 for first backup
 * @param threshold   shares required to recover (default 2 — "any two cards")
 *
 * Self-verifies the split end-to-end before returning. A silently-bad backup
 * can never reach the user.
 */
export function createMnemonicBackup(
  mnemonic: string,
  total: number,
  generation = 1,
  threshold = 2,
): BackupResult {
  const norm = mnemonic.normalize('NFKD').trim();
  if (norm.split(/\s+/).length < 12) {
    throw new Error('refusing to back up: mnemonic has fewer than 12 words');
  }
  const bytes = new TextEncoder().encode(norm);
  const { wires } = splitWithVerify(bytes, threshold, total, generation, secureRandom);
  return { wires, generation, threshold, total };
}

/**
 * Rebuild the wallet MNEMONIC from scanned QR share strings.
 * Validates format, checksum, and generation-consistency before combining.
 *
 * Returns the mnemonic STRING. The CALLER then re-derives the wallet with the
 * EXACT same path createWallet's random branch uses:
 *     mnemonicToSeed(mnemonic, '')   // EMPTY passphrase — matches createWallet
 *     deriveKaspaHDKey(seed)
 * and writes the identical SecureStore keys. createWallet passes '' (NOT the
 * bip39 default 'kasvillage'); using any other passphrase here derives a
 * DIFFERENT address. Always pass '' in the recovery path.
 */
export function recoverMnemonicFromShares(scannedWires: string[]): string {
  const bytes = recoverFromWires(scannedWires);
  const mnemonic = new TextDecoder().decode(bytes);
  if (mnemonic.trim().split(/\s+/).length < 12) {
    throw new Error('recovered data is not a valid mnemonic (fewer than 12 words)');
  }
  return mnemonic;
}

/**
 * Re-split: issue a fresh generation of shares, voiding all previous shares.
 * @param currentGeneration the generation currently in use; new = +1
 */
export function resplitMnemonic(
  mnemonic: string,
  total: number,
  currentGeneration: number,
  threshold = 2,
): BackupResult {
  return createMnemonicBackup(mnemonic, total, currentGeneration + 1, threshold);
}

// ---- integration note (not code) -------------------------------------------
// BACKUP  (Vault-mode; wallet.mnemonic / kv_mnemonic in hand):
//   const backup = createMnemonicBackup(mnemonic, 4); // 2-of-4
//   // hand backup.wires to VaultBackupScreen, one QR per card/device
//
// RECOVERY (VaultRecoveryScreen.onRecovered(mnemonic)):
//   -> restoreWalletFromMnemonic(mnemonic)  // in wallet_registration_v2
//      which does mnemonicToSeed(mnemonic,'') -> deriveKaspaHDKey  (EMPTY passphrase)
//      -> writes the SAME SecureStore keys createWallet writes.
//
// Wordlist-independent: works even if bip39_wallet.ts's WORDLIST is wrong,
// because the seed derives from the mnemonic STRING, not from word indices.
