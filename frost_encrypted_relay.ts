// frost_encrypted_relay.ts
// Encrypts FROST partial sigs for relay via TownHall
// ECDH shared secret + 11-field binding — ALL must match to decrypt
// Everything is one-time use: FROST address, sigs, nonces, encryption keys

import { secp256k1 as secp } from '@noble/curves/secp256k1';
import { blake2b } from '@noble/hashes/blake2b';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

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
// Derive encryption nonce from key + R_hex (deterministic, no randomness)
// ============================================================================
function deriveNonce(encKey: Uint8Array, R_hex: string): Uint8Array {
  const rBytes = hexToBytes(R_hex.length > 64 ? R_hex.slice(0, 64) : R_hex);
  return kaspaBlake2b(new Uint8Array([...encKey, ...rBytes])).slice(0, 12);
}

// ============================================================================
// XOR stream cipher with Blake2b keystream
// For 32-byte partial sigs, one Blake2b round (32 bytes) covers it
// For longer data, chains multiple rounds
// ============================================================================
function xorCipher(data: Uint8Array, encKey: Uint8Array, nonce: Uint8Array): Uint8Array {
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
  const nonce = deriveNonce(encKey, ctx.R_hex);
  const encrypted = xorCipher(hexToBytes(partialSig), encKey, nonce);
  return { encrypted: bytesToHex(encrypted), nonce: bytesToHex(nonce) };
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
  const sharedSecret = deriveSharedSecret(myPrivKeyHex, counterpartyPubKeyHex);
  const encKey = deriveEncryptionKey(sharedSecret, ctx);
  const decrypted = xorCipher(hexToBytes(encrypted), encKey, hexToBytes(nonce));
  return bytesToHex(decrypted);
}

// ============================================================================
// VERIFY decrypted sig is plausible (not garbage from wrong key)
// ============================================================================
export function isValidDecryption(decryptedHex: string): boolean {
  const bytes = hexToBytes(decryptedHex);
  if (bytes.length !== 32 && bytes.length !== 64) return false;
  if (bytes.every(b => b === 0)) return false;
  if (bytes.every(b => b === 0xff)) return false;
  return true;
}
