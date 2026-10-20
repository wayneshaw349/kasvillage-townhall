// frost_encrypted_relay.ts
// Encrypts FROST partial sigs for relay via TownHall
// ECDH shared secret + 11-field binding — ALL must match to decrypt
// Everything is one-time use: FROST address, sigs, nonces, encryption keys

import { secp256k1 as secp } from '@noble/curves/secp256k1';
import { blake2b } from '@noble/hashes/blake2b';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';

const KASPA_HASH_KEY = new TextEncoder().encode('TransactionSigningHash');
function kaspaBlake2b(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32, key: KASPA_HASH_KEY } as any);
}

export interface EncryptionContext {
  agreementId: string;
  buyerPubkey: string;       // full compressed pubkey
  sellerPubkey: string;      // full compressed pubkey
  multisigAddress: string;   // FROST address (kaspatest:q...)
  aggregatedPubkey: string;  // 33-byte compressed aggregate pubkey
  network: string;           // testnet-10 | mainnet
  itemPriceKas: number;
  sellerCommitmentKas: number;
  lamportHash?: string;      // Lamport attestation hash from Arweave
  R_hex: string;             // nonce point from Agreed-Send
}

// ============================================================================
// ECDH: shared secret from my private key * counterparty public key
// Symmetric: A(privA, pubB) === B(privB, pubA)
// ============================================================================
function deriveSharedSecret(myPrivKeyHex: string, counterpartyPubKeyHex: string): Uint8Array {
  const myPrivScalar = BigInt('0x' + myPrivKeyHex);
  const theirPub = secp.ProjectivePoint.fromHex(counterpartyPubKeyHex);
  const sharedPoint = theirPub.multiply(myPrivScalar);
  return kaspaBlake2b(sharedPoint.toRawBytes(true));
}

// ============================================================================
// Derive encryption key from ECDH secret + all 11 context fields
// Any field mismatch = different key = garbage output
// ============================================================================
function deriveEncryptionKey(sharedSecret: Uint8Array, ctx: EncryptionContext): Uint8Array {
  const contextData = new TextEncoder().encode([
    ctx.agreementId,
    ctx.buyerPubkey,
    ctx.sellerPubkey,
    ctx.multisigAddress,
    ctx.aggregatedPubkey,
    ctx.network,
    ctx.itemPriceKas.toString(),
    ctx.sellerCommitmentKas.toString(),
    ctx.lamportHash || '',
    ctx.R_hex,
  ].join('|'));
  return kaspaBlake2b(new Uint8Array([...sharedSecret, ...contextData]));
}

// ============================================================================
// KV_RELAY_AEAD: random 16-byte nonce per message + encrypt-then-MAC.
// The old nonce was derived from key + R_hex; callers pass R_hex '' so every message
// under one agreement reused the same keystream, and there was no authentication.
// Wire format of `encrypted` (hex): nonce(16) || ciphertext || HMAC-SHA256 tag(32).
// Separate stream / MAC keys are derived from the context-bound key with labels.
// ============================================================================
const RELAY_NONCE_LEN = 16;
const RELAY_TAG_LEN = 32;
const RELAY_VERSION_LABEL = new TextEncoder().encode('KV-RELAY-v2');
function labelKey(encKey: Uint8Array, label: string): Uint8Array {
  return sha256(new Uint8Array([...new TextEncoder().encode(label), ...encKey]));
}
function relayTag(macKey: Uint8Array, nonce: Uint8Array, ct: Uint8Array): Uint8Array {
  return hmac(sha256 as any, macKey, new Uint8Array([...RELAY_VERSION_LABEL, ...nonce, ...ct]));
}
function constEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ============================================================================
// XOR stream cipher with Blake2b keystream
// For 32-byte partial sigs, one Blake2b round (32 bytes) covers it
// For longer data, chains multiple rounds
// ============================================================================
function xorCipher(data: Uint8Array, encKey: Uint8Array, nonce: Uint8Array): Uint8Array {
  if (data.length > 255 * 32) throw new Error('relay payload too long for keystream'); // round counter is one byte
  const result = new Uint8Array(data.length);
  let offset = 0;
  let round = 0;
  let keystream = kaspaBlake2b(new Uint8Array([...encKey, ...nonce, round]));

  for (let i = 0; i < data.length; i++) {
    if (offset >= keystream.length) {
      round++;
      keystream = kaspaBlake2b(new Uint8Array([...encKey, ...nonce, round]));
      offset = 0;
    }
    result[i] = data[i] ^ keystream[offset++];
  }
  return result;
}

// ============================================================================
// ENCRYPT partial sig for relay via TownHall
// Only the counterparty can decrypt (ECDH)
// Bound to all 11 agreement fields (context)
// ============================================================================
export function encryptPartialSig(params: {
  partialSig: string;            // s_hex (32 bytes) or full sig (64 bytes)
  myPrivKeyHex: string;          // NEVER leaves device
  counterpartyPubKeyHex: string;
  ctx: EncryptionContext;
}): { encrypted: string; nonce: string } {
  const { partialSig, myPrivKeyHex, counterpartyPubKeyHex, ctx } = params;
  const sharedSecret = deriveSharedSecret(myPrivKeyHex, counterpartyPubKeyHex);
  const encKey = deriveEncryptionKey(sharedSecret, ctx);
  const nonce = ((secp as any).utils.randomPrivateKey() as Uint8Array).slice(0, RELAY_NONCE_LEN); // KV_RELAY_AEAD: fresh CSPRNG bytes per message
  const ct = xorCipher(hexToBytes(partialSig), labelKey(encKey, 'KV-RELAY-ENC'), nonce);
  const tag = relayTag(labelKey(encKey, 'KV-RELAY-MAC'), nonce, ct);
  return { encrypted: bytesToHex(new Uint8Array([...nonce, ...ct, ...tag])), nonce: bytesToHex(nonce) };
}

/** KV_RELAY_AEAD: verify the tag and return the plaintext bytes, or null if not authentic. */
function openRelay(encryptedHex: string, myPrivKeyHex: string, counterpartyPubKeyHex: string, ctx: EncryptionContext, nonceHex?: string): Uint8Array | null {
  let blob: Uint8Array;
  try { blob = hexToBytes(encryptedHex); } catch { return null; }
  if (blob.length <= RELAY_NONCE_LEN + RELAY_TAG_LEN) return null;
  const nonce = blob.slice(0, RELAY_NONCE_LEN);
  const ct = blob.slice(RELAY_NONCE_LEN, blob.length - RELAY_TAG_LEN);
  const tag = blob.slice(blob.length - RELAY_TAG_LEN);
  if (nonceHex && nonceHex.toLowerCase() !== bytesToHex(nonce)) return null; // separate nonce must agree with the prepended one
  const encKey = deriveEncryptionKey(deriveSharedSecret(myPrivKeyHex, counterpartyPubKeyHex), ctx);
  if (!constEq(tag, relayTag(labelKey(encKey, 'KV-RELAY-MAC'), nonce, ct))) return null;
  return xorCipher(ct, labelKey(encKey, 'KV-RELAY-ENC'), nonce);
}

// ============================================================================
// DECRYPT partial sig received from counterparty
// ECDH is symmetric: deriveShared(myPriv, theirPub) === deriveShared(theirPriv, myPub)
// ============================================================================
export function decryptPartialSig(params: {
  encrypted: string;
  myPrivKeyHex: string;          // NEVER leaves device
  counterpartyPubKeyHex: string;
  ctx: EncryptionContext;
  nonce: string;
}): string {
  const { encrypted, myPrivKeyHex, counterpartyPubKeyHex, ctx, nonce } = params;
  // KV_RELAY_AEAD: never return unauthenticated plaintext.
  const pt = openRelay(encrypted, myPrivKeyHex, counterpartyPubKeyHex, ctx, nonce || undefined);
  if (!pt) throw new Error('Relay message failed authentication (wrong key/context or tampered)');
  return bytesToHex(pt);
}

// ============================================================================
// VERIFY decrypted sig is plausible (not garbage from wrong key)
// ============================================================================
export function isValidDecryption(
  decryptedHex: string,
  // KV_RELAY_AEAD: pass the received ciphertext + keys to also check the HMAC tag and
  // that it decrypts to exactly decryptedHex. (decryptPartialSig already refuses bad tags.)
  auth?: { encrypted: string; myPrivKeyHex: string; counterpartyPubKeyHex: string; ctx: EncryptionContext; nonce?: string },
): boolean {
  if (auth) {
    const pt = openRelay(auth.encrypted, auth.myPrivKeyHex, auth.counterpartyPubKeyHex, auth.ctx, auth.nonce);
    if (!pt || bytesToHex(pt) !== String(decryptedHex || '').toLowerCase()) return false;
  }
  let bytes: Uint8Array;
  try { bytes = hexToBytes(decryptedHex); } catch { return false; }
  if (bytes.length !== 32 && bytes.length !== 64) return false;
  if (bytes.every(b => b === 0)) return false;
  if (bytes.every(b => b === 0xff)) return false;
  return true;
}
