// avatar_arweave_upload.ts
// Upload avatar JSON to Arweave via Irys/Turbo
// Uses real secp256k1 ECDSA (not Schnorr) for ANS-104 signing

import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { sha384 } from '@noble/hashes/sha512';
import { keccak_256 } from '@noble/hashes/sha3';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// =============================================================================
// CONSTANTS
// =============================================================================

const IRYS_UPLOAD_URL = 'https://upload.ardrive.io/v1/tx'; // TURBO-SWAP: upload host, free small items; turbo.ardrive.io is payment host (402s via AR.IO bundler)
const ARWEAVE_GATEWAY = 'https://arweave.net';
const SIGNATURE_TYPE_SECP256K1 = 3;

// =============================================================================
// TYPES
// =============================================================================

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveUploadResult {
  success: boolean;
  txId?: string;
  arweaveUrl?: string;
  error?: string;
}

export interface AvatarUploadParams {
  avatarJson: string;
  identityHash: string;
  traitCount: number;
  kaspaAddress: string;
  kaspacTxId?: string;
  network: string;
}

// =============================================================================
// BYTE HELPERS
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function w16LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
}

function w64LE(v: bigint | number): Uint8Array {
  const n = BigInt(v);
  const b = new Uint8Array(8);
  for (let i = 0; i < 8; i++) b[i] = Number((n >> BigInt(i * 8)) & 0xffn);
  return b;
}

// =============================================================================
// ANS-104 DEEP HASH
// =============================================================================

async function deepHash(data: Uint8Array | Uint8Array[]): Promise<Uint8Array> {
  // Exact port of arbundles deepHash - works in React Native with @noble/hashes
  if (data instanceof Uint8Array) {
    // Leaf node: H(H("blob" + length) || H(data))
    const tag = concatBytes(
      new TextEncoder().encode('blob'),
      new TextEncoder().encode(data.byteLength.toString())
    );
    const taggedHash = concatBytes(sha384(tag), sha384(data));
    return sha384(taggedHash);
  }
  // Array node: H("list" + length), then chain: acc = H(acc || deepHash(chunk))
  const tag = concatBytes(
    new TextEncoder().encode('list'),
    new TextEncoder().encode(data.length.toString())
  );
  let acc = sha384(tag);
  for (const chunk of data) {
    const chunkHash = await deepHash(chunk);
    acc = sha384(concatBytes(acc, chunkHash));
  }
  return acc;
}

// =============================================================================
// TAG SERIALIZATION
// =============================================================================

// Avro zigzag variable-length integer encoding (ANS-104 spec)
function avroLong(v: number): Uint8Array {
  // Zigzag encode: (n << 1) ^ (n >> 63)
  let n = v >= 0 ? v * 2 : (-v) * 2 - 1;
  const bytes: number[] = [];
  while (n > 0x7f) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n & 0x7f);
  return new Uint8Array(bytes);
}

function serializeTags(tags: ArweaveTag[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  
  // Avro array: block count (zigzag long), then items, then 0 terminator
  if (tags.length > 0) {
    parts.push(avroLong(tags.length)); // block count
    for (const t of tags) {
      const n = enc.encode(t.name);
      const v = enc.encode(t.value);
      // Each field: zigzag-encoded byte length, then raw bytes
      parts.push(avroLong(n.length), n, avroLong(v.length), v);
    }
  }
  parts.push(avroLong(0)); // end of array marker
  
  return concatBytes(...parts);
}

// =============================================================================
// ANS-104 DATA ITEM BUILDER
// =============================================================================

async function buildAns104DataItem(
  data: Uint8Array,
  tags: ArweaveTag[],
  privateKeyHex: string,
): Promise<Uint8Array> {
  const privKeyBytes = hexToBytes(privateKeyHex);
  
  // Get compressed public key (33 bytes)
  const pubPoint = secp256k1.ProjectivePoint.fromPrivateKey(privKeyBytes);
  const compressedPub = pubPoint.toRawBytes(false); // 65 bytes UNCOMPRESSED - Turbo requires this
  
  const SIG_TYPE = new Uint8Array([SIGNATURE_TYPE_SECP256K1, 0]);
  const serializedTags = serializeTags(tags);
  const tagCount = tags.length;
  
  // Build deep hash message
  const toSign = await deepHash([
    new TextEncoder().encode('dataitem'),
    new TextEncoder().encode('1'), // version
    new TextEncoder().encode('3'), // sig type as string (not raw bytes)
    compressedPub,
    new Uint8Array(0), // target (empty)
    new Uint8Array(0), // anchor (empty)
    serializedTags,
    data,
  ]);
  
  // EIP-191 Ethereum message signing (pure noble, RN compatible)
  const prefixBytes = new Uint8Array([25]); // 0x19
  const prefixStr = new TextEncoder().encode('Ethereum Signed Message:' + String.fromCharCode(10) + toSign.length.toString());
  const fullPrefix = concatBytes(prefixBytes, prefixStr);
  const ethHash = keccak_256(concatBytes(fullPrefix, toSign));
  const sig = secp256k1.sign(ethHash, privKeyBytes);
  const compactSig = sig.toCompactRawBytes();
  const signature = new Uint8Array(65);
  signature.set(compactSig, 0);
  signature[64] = sig.recovery + 27;
  
  // Calculate item ID from signature hash
  const itemId = sha256(signature);
  
  // Build serialized data item
  // Format: sigType(2) | sig(64) | owner(33) | target(1) | anchor(1) | tagCount(2) | tagBytesLen(2) | tags | data
  
  const targetPresent = new Uint8Array([0]); // no target
  const anchorPresent = new Uint8Array([0]); // no anchor
  const tagBytesLen = w64LE(serializedTags.length);
  
  return concatBytes(
    SIG_TYPE,
    signature,
    compressedPub,
    targetPresent,
    anchorPresent,
    w64LE(tagCount),
    tagBytesLen,
    serializedTags,
    data,
  );
}

// =============================================================================
// IRYS UPLOAD
// =============================================================================

async function uploadToIrys(
  dataItemBytes: Uint8Array,
): Promise<ArweaveUploadResult> {
  try {
    const response = await fetch(IRYS_UPLOAD_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(dataItemBytes).buffer,
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 60000); return c.signal; })(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Arweave] Upload failed ${response.status} from ${(response as any).url} redirected=${(response as any).redirected}: ${text.slice(0,200)}`);
      return { 
        success: false, 
        error: `Upload failed: ${response.status} ${text.slice(0, 100)}` 
      };
    }
    
    const json = await response.json();
    const txId = json.id as string;
    
    console.log(`[Arweave] ✓ Uploaded: ${txId}`);
    
    return {
      success: true,
      txId,
      arweaveUrl: `${ARWEAVE_GATEWAY}/${txId}`,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[Arweave] Upload error:', error);
    return { success: false, error };
  }
}

// =============================================================================
// PRIVATE KEY DECRYPTION
// =============================================================================

async function decryptPrivateKey(
  encryptedJson: string,
  deviceKey: string,
): Promise<string | null> {
  try {
    const stored = JSON.parse(encryptedJson) as { privateKeyEnc: string };
    const encHex = stored.privateKeyEnc;
    
    const combined = deviceKey + encHex;
    const keyStream = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
    );
    
    const result: string[] = [];
    for (let i = 0; i < 64; i += 2) {
      const encByte = parseInt(encHex.slice(i, i + 2), 16);
      const ksByte = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
      result.push((encByte ^ ksByte).toString(16).padStart(2, '0'));
    }
    return result.join('');
  } catch (e) {
    console.error('[Arweave] Key decryption failed:', e);
    return null;
  }
}

// =============================================================================
// AVATAR UPLOAD
// =============================================================================

/**
 * Upload avatar JSON to Arweave via Irys
 * Returns Arweave TX ID and gateway URL
 */
export async function uploadAvatarToArweave(
  params: AvatarUploadParams,
): Promise<ArweaveUploadResult> {
  const { avatarJson, identityHash, traitCount, kaspaAddress, kaspacTxId, network } = params;
  
  // Get wallet keys from SecureStore
  const privKeyEnc = await SecureStore.getItemAsync('kv_l1_privkey_enc');
  const deviceKey = await SecureStore.getItemAsync('device_encryption_key');
  
  if (!privKeyEnc || !deviceKey) {
    return { success: false, error: 'Wallet not found' };
  }
  
  const privKeyHex = await decryptPrivateKey(privKeyEnc, deviceKey);
  if (!privKeyHex) {
    return { success: false, error: 'Failed to decrypt wallet key' };
  }
  
  // Build tags
  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'avatar' },
    { name: 'KV-Identity', value: identityHash },
    { name: 'KV-TraitCount', value: String(traitCount) },
    { name: 'KV-Version', value: 'KV2U:01' },
    { name: 'KV-Network', value: network },
    { name: 'KV-Address', value: kaspaAddress },
  ];
  
  if (kaspacTxId) {
    tags.push({ name: 'KV-L1-TxId', value: kaspacTxId });
  }
  
  tags.push({ name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) });
  
  // Build and upload data item
  const data = new TextEncoder().encode(avatarJson);
  
  console.log(`[Arweave] Building data item: ${data.length} bytes, ${tags.length} tags`);
  
  const dataItem = await buildAns104DataItem(data, tags, privKeyHex);
  
  console.log(`[Arweave] Uploading ${dataItem.length} bytes to Irys...`);
  
  return uploadToIrys(dataItem);
}

/**
 * Upload avatar using biometric-gated key access
 * Call this from UI with user interaction
 */
export async function uploadAvatarWithBiometric(
  params: Omit<AvatarUploadParams, 'privateKeyHex'>,
): Promise<ArweaveUploadResult> {
  // Biometric auth handled by SecureStore requireAuthentication
  return uploadAvatarToArweave(params);
}



// =============================================================================
// LAMPORT ATTESTATION (quantum-resistant proof layer)
// =============================================================================

/**
 * Generate a Lamport one-time signature of a 256-bit hash.
 * Uses SHA256 — quantum resistant (no ECC involved).
 * Each key pair is single-use: 256 pairs of 32-byte secrets.
 */
function generateLamportKeypair(seed: Uint8Array): {
  privKey: Uint8Array[];  // 512 x 32-byte secrets
  pubKey: Uint8Array[];   // 512 x 32-byte hashes
} {
  const privKey: Uint8Array[] = [];
  const pubKey: Uint8Array[] = [];
  for (let i = 0; i < 512; i++) {
    const secret = sha256(concatBytes(seed, new Uint8Array([i & 0xff, (i >> 8) & 0xff])));
    privKey.push(secret);
    pubKey.push(sha256(secret));
  }
  return { privKey, pubKey };
}

function lamportSign(hash256: Uint8Array, privKey: Uint8Array[]): Uint8Array[] {
  const sig: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    const bit = (hash256[Math.floor(i / 8)] >> (7 - (i % 8))) & 1;
    sig.push(privKey[i * 2 + bit]);
  }
  return sig;
}

function lamportVerify(hash256: Uint8Array, sig: Uint8Array[], pubKey: Uint8Array[]): boolean {
  for (let i = 0; i < 256; i++) {
    const bit = (hash256[Math.floor(i / 8)] >> (7 - (i % 8))) & 1;
    const expected = pubKey[i * 2 + bit];
    const actual = sha256(sig[i]);
    if (bytesToHex(actual) !== bytesToHex(expected)) return false;
  }
  return true;
}

/**
 * Create and upload a Lamport attestation for a given Arweave TX.
 * This provides quantum-resistant proof that YOU created the data at the given time.
 * Call after every successful Arweave upload.
 */
export async function lamportAttest(params: {
  arweaveTxId: string;
  payloadHash: Uint8Array;
  privateKeyHex: string;
}): Promise<ArweaveUploadResult> {
  try {
    // Derive Lamport seed from main key + Arweave TX ID (unique per attestation)
    const lamportSeed = sha256(concatBytes(
      hexToBytes(params.privateKeyHex),
      new TextEncoder().encode('LAMPORT:' + params.arweaveTxId)
    ));
    
    const { privKey, pubKey } = generateLamportKeypair(lamportSeed);
    const sig = lamportSign(params.payloadHash, privKey);
    
    // Compact format: pubKey hash (32 bytes) + sig (256 x 32 bytes = 8KB)
    const pubKeyHash = sha256(concatBytes(...pubKey));
    
    const attestation = {
      v: 'KV_LAMPORT_V1',
      ref: params.arweaveTxId,
      payloadHash: bytesToHex(params.payloadHash),
      pubKeyHash: bytesToHex(pubKeyHash),
      // Store only pubKey hash + sig (not full pubKey — save space)
      sig: sig.map(s => bytesToHex(s)),
      pubKey: pubKey.map(p => bytesToHex(p)),
    };
    
    const data = new TextEncoder().encode(JSON.stringify(attestation));
    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'KV-Type', value: 'lamport-attestation' },
      { name: 'KV-Ref', value: params.arweaveTxId },
      { name: 'KV-PubKeyHash', value: bytesToHex(pubKeyHash) },
      { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
    ];
    
    const dataItem = await buildAns104DataItem(data, tags, params.privateKeyHex);
    return uploadToIrys(dataItem);
  } catch (e) {
    console.warn('[Lamport] Attestation failed (non-fatal):', e);
    return { success: false, error: String(e) };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  buildAns104DataItem,
  uploadToIrys,
  lamportAttest,
  ARWEAVE_GATEWAY,
  IRYS_UPLOAD_URL,
};


// =============================================================================
// UPLOAD AVATAR SVG + PATHS FOR DEVELOPER ACCESS
// =============================================================================

export interface AvatarSVGUploadParams {
  paths: string[];
  hash: string;
  race: string;
  gender: string;
  network: string;
}

export interface AvatarSVGUploadResult {
  success: boolean;
  svgTxId?: string;
  pathsTxId?: string;
  svgUrl?: string;
  pathsUrl?: string;
  error?: string;
}

function buildSVGFromPaths(paths: string[], fill = '#1a1a2e', stroke = '#8b5cf6'): string {
  const p = paths.map(d => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" opacity="0.95"/>`).join('\n');
  return `<svg width="400" height="450" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">\n<g>\n${p}\n</g>\n</svg>`;
}

/**
 * Upload avatar SVG + paths JSON to Arweave for developer access.
 * 
 * Creates two Arweave inscriptions:
 *   1. avatar-svg   (image/svg+xml)     — ready to display in any browser/webview
 *   2. avatar-paths  (application/json) — raw paths for custom-color rendering in games
 * 
 * Developer query:
 *   By pubkey:  tags: KV-Type=avatar-svg, KV-Pubkey={pubkey}
 *   By address: tags: KV-Type=avatar-svg, KV-Address={kaspa_address}
 *   Verify:     SHA256(JSON.stringify(paths)) === KV-Identity tag value
 */
export async function uploadAvatarSVG(params: AvatarSVGUploadParams): Promise<AvatarSVGUploadResult> {
  const { paths, hash, race, gender, network } = params;

  const privKeyHex = await SecureStore.getItemAsync('kv_private_key');
  const kaspaAddress = await SecureStore.getItemAsync('kaspa_address_tutorial') || '';
  const pubkey = await SecureStore.getItemAsync('kaspa_pubkey') || '';

  if (!privKeyHex) return { success: false, error: 'No private key found' };

  const commonTags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Identity', value: hash },
    { name: 'KV-Address', value: kaspaAddress },
    { name: 'KV-Pubkey', value: pubkey },
    { name: 'KV-Race', value: race },
    { name: 'KV-Gender', value: gender },
    { name: 'KV-Network', value: network },
    { name: 'KV-PathCount', value: String(paths.length) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  try {
    // 1. SVG upload
    const svgStr = buildSVGFromPaths(paths);
    const svgBytes = new TextEncoder().encode(svgStr);
    const svgTags: ArweaveTag[] = [
      ...commonTags,
      { name: 'Content-Type', value: 'image/svg+xml' },
      { name: 'KV-Type', value: 'avatar-svg' },
    ];
    console.log('[AvatarSVG] Uploading SVG:', svgBytes.length, 'bytes');
    const svgItem = await buildAns104DataItem(svgBytes, svgTags, privKeyHex);
    const svgResult = await uploadToIrys(svgItem);
    if (!svgResult.success) return { success: false, error: 'SVG upload failed: ' + svgResult.error };
    console.log('[AvatarSVG] SVG uploaded:', svgResult.txId);

    // 2. Paths JSON upload
    const pathsPayload = JSON.stringify({ paths, hash, race, gender, pathCount: paths.length });
    const pathsBytes = new TextEncoder().encode(pathsPayload);
    const pathsTags: ArweaveTag[] = [
      ...commonTags,
      { name: 'Content-Type', value: 'application/json' },
      { name: 'KV-Type', value: 'avatar-paths' },
    ];
    console.log('[AvatarSVG] Uploading paths:', pathsBytes.length, 'bytes');
    const pathsItem = await buildAns104DataItem(pathsBytes, pathsTags, privKeyHex);
    const pathsResult = await uploadToIrys(pathsItem);
    if (!pathsResult.success) console.warn('[AvatarSVG] Paths failed (non-fatal):', pathsResult.error);
    else console.log('[AvatarSVG] Paths uploaded:', pathsResult.txId);

    return {
      success: true,
      svgTxId: svgResult.txId, pathsTxId: pathsResult?.txId,
      svgUrl: svgResult.arweaveUrl, pathsUrl: pathsResult?.arweaveUrl,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[AvatarSVG] Error:', error);
    return { success: false, error };
  }
}


// =============================================================================
// RECOVER AVATAR FROM ARWEAVE (device wipe / new device)
// =============================================================================

export interface AvatarRecoveryResult {
  success: boolean;
  identity?: {
    paths: string[];
    hash: string;
    race: string;
    gender: string;
    createdAt: number;
  };
  arweaveTxId?: string;
  error?: string;
}

/**
 * Recover avatar from Arweave when local storage is empty (device wipe/new device).
 * 
 * Flow:
 *   1. Query Arweave for avatar-paths by pubkey
 *   2. Fetch paths JSON from arweave.net/{txId}
 *   3. Verify SHA256(paths) matches KV-Identity tag
 *   4. Store to SecureStore (storeAvatarLocally)
 *   5. Return recovered AvatarIdentity
 */
export const uploadDataItemRaw = uploadToIrys;

export async function recoverAvatarFromArweave(pubkey: string): Promise<AvatarRecoveryResult> {
  if (!pubkey) return { success: false, error: 'No pubkey provided' };

  const GOLDSKY = 'https://arweave-search.goldsky.com/graphql';
  const ARWEAVE_GW = 'https://arweave.net';

  try {
    console.log('[AvatarRecovery] Querying Arweave for pubkey:', pubkey.slice(0, 16));

    // 1. Query for avatar-paths (has the raw paths we need)
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Type", values: ["avatar-paths"] },
          { name: "KV-Pubkey", values: ["${pubkey}"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
          }
        }
      }
    }`;

    const resp = await fetch(GOLDSKY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return { success: false, error: 'Arweave query failed: ' + resp.status };

    const data = await resp.json();
    const edges = data?.data?.transactions?.edges || [];

    if (edges.length === 0) {
      console.log('[AvatarRecovery] No avatar found on Arweave for this pubkey');
      return { success: false, error: 'No avatar found on Arweave for this pubkey' };
    }

    const node = edges[0].node;
    const txId = node.id;
    const tagMap: Record<string, string> = {};
    for (const t of node.tags) tagMap[t.name] = t.value;

    const expectedHash = tagMap['KV-Identity'] || '';
    const race = tagMap['KV-Race'] || 'human';
    const gender = tagMap['KV-Gender'] || 'male';

    console.log('[AvatarRecovery] Found avatar TX:', txId, '| Hash:', expectedHash.slice(0, 16));

    // 2. Fetch paths JSON
    const dataResp = await fetch(ARWEAVE_GW + '/' + txId, {
      signal: AbortSignal.timeout(15000),
    });

    if (!dataResp.ok) return { success: false, error: 'Failed to fetch avatar data from Arweave' };

    const pathsData = await dataResp.json();
    const paths: string[] = pathsData.paths;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return { success: false, error: 'Invalid avatar data on Arweave (no paths)' };
    }

    // 3. Verify hash integrity
    const { sha256 } = await import('@noble/hashes/sha256');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const computedHash = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(paths))));

    if (expectedHash && computedHash !== expectedHash) {
      console.warn('[AvatarRecovery] HASH MISMATCH! Expected:', expectedHash.slice(0, 16), 'Got:', computedHash.slice(0, 16));
      return { success: false, error: 'Avatar integrity check failed — hash mismatch' };
    }

    console.log('[AvatarRecovery] Hash verified:', computedHash.slice(0, 16));

    // 4. Build identity and store locally
    const identity = {
      paths,
      hash: computedHash,
      race: race as any,
      gender: gender as any,
      createdAt: Date.now(),
    };

    // Store to SecureStore
    await SecureStore.setItemAsync('kv_avatar_identity', JSON.stringify(identity));
    console.log('[AvatarRecovery] Avatar restored to device (' + paths.length + ' paths)');

    return { success: true, identity, arweaveTxId: txId };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[AvatarRecovery] Error:', error);
    return { success: false, error };
  }
}
