// ============================================================================
// KASVILLAGE — BACKABLE WALLET GENERATOR  (+ identity-bound Shamir QR cards)
// ============================================================================
// Mints a NEW single-key wallet whose recovery is portable across platforms:
//
//   RNG entropy -> mnemonic -> mnemonicToSeed(_, '') -> deriveKaspaHDKey -> key
//
// The mnemonic is the root, so the QR cards ALWAYS reconstruct the exact wallet
// (unlike iCloud/Google auto-restore, which only works within one vendor).
//
// IDENTITY BINDING: the split secret is  [8-byte pubkey tag] || utf8(mnemonic).
// On recovery we reconstruct, peel the tag, derive the wallet, and assert the
// derived pubkey's hash equals the embedded tag. A card set therefore proves
// which wallet it restores, and a mismatched/garbled reconstruction is rejected
// instead of silently yielding a wrong address.
//
// Pure logic + expo-crypto RNG. Splitting reuses the proven shamir_wire core.
// This mints a NEW address; it does NOT retrofit a mnemonic onto an existing
// key (mathematically impossible - derivation only runs mnemonic -> key).
// ============================================================================

import * as Crypto from 'expo-crypto';
import { sha256 } from '@noble/hashes/sha256';
import { getPublicKey } from '@noble/secp256k1';
import { entropyToMnemonic, mnemonicToSeed, deriveKaspaHDKey } from './bip39_wallet';
import { splitWithVerify, recoverFromWires } from './shamir_wire';

const ENTROPY_LEN = 16;      // 128-bit -> 12 words
const TAG_LEN = 8;           // pubkey binding tag length (bytes)

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(h: string): Uint8Array {
  const u = new Uint8Array(h.length / 2);
  for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16);
  return u;
}
function secureRandom(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

// ---- Kaspa x-only -> bech32 address (self-contained, exported for reuse) ----
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values: number[]): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
    if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
    if (c0 & 0x02n) c ^= 0x79b76d99e2n;
    if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
    if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
    if (c0 & 0x10n) c ^= 0x1e4f43e470n;
  }
  return c ^ 1n;
}
function conv8to5(payload: number[]): number[] {
  const r: number[] = [];
  let buf = 0, bits = 0;
  for (const b of payload) {
    buf = (buf << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; r.push((buf >> bits) & 31); buf &= (1 << bits) - 1; }
  }
  if (bits > 0) r.push((buf << (5 - bits)) & 31);
  return r;
}
export function xOnlyToKaspaAddress(
  xOnlyHex: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11',
): string {
  const hrp = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const payload = conv8to5([0, ...Array.from(hexToBytes(xOnlyHex))]);
  const pre = Array.from(hrp).map((c) => c.charCodeAt(0) & 0x1f);
  const cs = polymod([...pre, 0, ...payload, 0, 0, 0, 0, 0, 0, 0, 0]);
  const csB: number[] = [];
  for (let i = 4; i >= 0; i--) csB.push(Number((cs >> BigInt(i * 8)) & 0xffn));
  let addr = hrp + ':';
  for (const d of [...payload, ...conv8to5(csB)]) addr += BECH32[d];
  return addr;
}

// ---- derive the full wallet from a mnemonic (matches createWallet's path) ---
export async function deriveWallet(
  mnemonic: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10',
): Promise<{ privateKeyHex: string; publicKeyHex: string; kaspaAddress: string }> {
  const seed = await mnemonicToSeed(mnemonic, '');   // EMPTY passphrase (matches createWallet)
  const hd = deriveKaspaHDKey(seed);
  const pub = getPublicKey(hd.privateKey, true);
  return {
    privateKeyHex: bytesToHex(hd.privateKey),
    publicKeyHex: bytesToHex(pub),
    kaspaAddress: xOnlyToKaspaAddress(bytesToHex(pub.slice(1)), network),
  };
}

export interface BackableWallet {
  mnemonic: string;        // the root - shown once / only inside the QR cards
  privateKeyHex: string;
  publicKeyHex: string;
  kaspaAddress: string;
}

/**
 * Generate a fresh backable wallet from CSPRNG entropy.
 * The key is derived FROM the mnemonic, so the cards always restore this wallet.
 */
export async function generateBackableWallet(
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10',
): Promise<BackableWallet> {
  const entropy = secureRandom(ENTROPY_LEN);
  const mnemonic = await entropyToMnemonic(entropy);
  const w = await deriveWallet(mnemonic, network);
  return { mnemonic, ...w };
}

// ---- identity-bound Shamir backup ------------------------------------------

function pubkeyTag(publicKeyHex: string): Uint8Array {
  return sha256(hexToBytes(publicKeyHex)).slice(0, TAG_LEN);
}

export interface BackupResult {
  wires: string[];
  generation: number;
  threshold: number;
  total: number;
  bindingHex: string;   // 8-byte pubkey tag, hex - shown as the card-set label
}

/**
 * Split  [pubkeyTag || mnemonic]  into N identity-bound QR cards (2-of-N default).
 * Self-verifies the split before returning (a bad split never reaches the user).
 */
export function createIdentityBoundBackup(
  mnemonic: string,
  publicKeyHex: string,
  total: number,
  generation = 1,
  threshold = 2,
): BackupResult {
  const norm = mnemonic.normalize('NFKD').trim();
  if (norm.split(/\s+/).length < 12) throw new Error('refusing to back up: mnemonic < 12 words');
  const tag = pubkeyTag(publicKeyHex);
  const secret = new Uint8Array([...tag, ...new TextEncoder().encode(norm)]);
  const { wires } = splitWithVerify(secret, threshold, total, generation, secureRandom);
  return { wires, generation, threshold, total, bindingHex: bytesToHex(tag) };
}

/**
 * Reconstruct from scanned cards, peel the identity tag, and (optionally) verify
 * it against the wallet the recovered mnemonic derives to.
 * @returns the mnemonic + the embedded binding tag.
 */
export function recoverIdentityBoundMnemonic(
  scannedWires: string[],
): { mnemonic: string; bindingHex: string } {
  const secret = recoverFromWires(scannedWires);
  if (secret.length <= TAG_LEN) throw new Error('recovered data too short to contain a mnemonic');
  const tag = secret.slice(0, TAG_LEN);
  const mnemonic = new TextDecoder().decode(secret.slice(TAG_LEN));
  if (mnemonic.trim().split(/\s+/).length < 12) {
    throw new Error('recovered data is not a valid mnemonic (< 12 words)');
  }
  return { mnemonic, bindingHex: bytesToHex(tag) };
}

/**
 * Full verified recovery: reconstruct, derive, and ASSERT the derived pubkey
 * matches the embedded binding. Throws if the cards don't restore the wallet
 * they claim to. Returns the restored wallet.
 */
export async function recoverAndVerify(
  scannedWires: string[],
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10',
): Promise<BackableWallet> {
  const { mnemonic, bindingHex } = recoverIdentityBoundMnemonic(scannedWires);
  const w = await deriveWallet(mnemonic, network);
  const derivedTag = bytesToHex(pubkeyTag(w.publicKeyHex));
  if (derivedTag !== bindingHex) {
    throw new Error(
      '[BINDING-MISMATCH] recovered mnemonic derives pubkey tag ' + derivedTag +
      ' but cards are bound to ' + bindingHex + '. These cards do not restore this wallet.'
    );
  }
  return { mnemonic, ...w };
}
