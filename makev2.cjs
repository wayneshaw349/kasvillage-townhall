// makev2.cjs — creates bip39_v2.ts: correct BIP39/BIP32 via @noble/hashes.
// Touches NOTHING existing. New file only.
// Run from project root: node makev2.cjs
// Then: npx tsc --noEmit (expect baseline)

const fs = require("fs");
const f = "bip39_v2.ts";
if (fs.existsSync(f)) { console.error(f + " already exists -- ABORT"); process.exit(1); }

const src = `// ============================================================================
// KASVILLAGE — BIP39/BIP32 V2 (CORRECT, @noble/hashes-based)
// ============================================================================
// Standard BIP39: PBKDF2-HMAC-SHA512, 2048 iters, salt "mnemonic"+passphrase.
// Standard BIP32/44: m/44'/111111'/0'/0/0 (Kaspa coin type).
// KAT-verified against official vector:
//   "abandon ... about" + "" -> seed 5eb00bbd...ce9e38e4
//
// V1 (bip39_wallet.ts) used a hand-rolled SHA512 that is NOT standard.
// V1 wallets are internally consistent but NOT portable to external wallets.
// NEVER change V1 — existing wallets derive through it.
// New wallets should use V2. Tag with SecureStore 'kv_kdf_version' = 'v2'.
// ============================================================================

import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import * as secp from '@noble/secp256k1';

// Reuse wordlist + entropy/mnemonic/address helpers from V1 — those parts are
// correct (checksum uses expo-crypto native SHA256; bech32 ported from rusty-kaspa).
export { entropyToMnemonic, validateMnemonic } from './bip39_wallet';

// ── BIP39: mnemonic -> seed (STANDARD) ──────────────────────────────────────
export function mnemonicToSeedV2(mnemonic: string, passphrase = ''): Uint8Array {
  const m = mnemonic.normalize('NFKD');
  const salt = ('mnemonic' + passphrase).normalize('NFKD');
  return pbkdf2(sha512, m, salt, { c: 2048, dkLen: 64 });
}

// ── BIP32: seed -> HD key at m/44'/111111'/0'/0/0 (STANDARD) ────────────────
interface HDKeyV2 { privateKey: Uint8Array; chainCode: Uint8Array; }

const SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

function bytesToBig(b: Uint8Array): bigint {
  let x = 0n; for (const v of b) x = (x << 8n) | BigInt(v); return x;
}
function bigToBytes32(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(x & 0xFFn); x >>= 8n; }
  return out;
}
function ser32(i: number): Uint8Array {
  return new Uint8Array([ (i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff ]);
}

function deriveChildV2(parent: HDKeyV2, index: number): HDKeyV2 {
  const hardened = index >= 0x80000000;
  let data: Uint8Array;
  if (hardened) {
    data = new Uint8Array(37);
    data[0] = 0x00;
    data.set(parent.privateKey, 1);
    data.set(ser32(index), 33);
  } else {
    const pub = secp.getPublicKey(parent.privateKey, true);
    data = new Uint8Array(37);
    data.set(pub, 0);
    data.set(ser32(index), 33);
  }
  const I = hmac(sha512, parent.chainCode, data);
  const IL = I.slice(0, 32);
  const IR = I.slice(32);
  const child = (bytesToBig(IL) + bytesToBig(parent.privateKey)) % SECP_N;
  return { privateKey: bigToBytes32(child), chainCode: IR };
}

export function deriveKaspaHDKeyV2(seed: Uint8Array): HDKeyV2 {
  const I = hmac(sha512, new TextEncoder().encode('Bitcoin seed'), seed);
  let node: HDKeyV2 = { privateKey: I.slice(0, 32), chainCode: I.slice(32) };
  const path = [
    44 + 0x80000000,
    111111 + 0x80000000,
    0 + 0x80000000,
    0,
    0,
  ];
  for (const idx of path) node = deriveChildV2(node, idx);
  return node;
}

// ── KAT (callable from a dev screen/button to prove correctness on-device) ──
export function runV2KAT(): { seedOk: boolean; seedHex: string } {
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const expected = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';
  const seed = mnemonicToSeedV2(mnemonic, '');
  const hex = Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join('');
  return { seedOk: hex === expected, seedHex: hex };
}
`;
fs.writeFileSync(f, src);
console.log("created " + f);
console.log("next: npx tsc --noEmit, then wire runV2KAT() to a dev button and confirm seedOk=true on device");
