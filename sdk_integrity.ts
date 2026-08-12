// ============================================================================
// KASVILLAGE SDK INTEGRITY VERIFICATION
// Publish SDK hash → Register DApps → Verify chain → Detect tampering
// Used by: wallet (client-side verify), TownHall (server-side verify)
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import * as SecureStore from 'expo-secure-store';
import { uploadToIrys, type ArweaveTag, type IrysUploadResult } from './arweave_upload';
import { ARWEAVE_GRAPHQL, GOLDSKY_GRAPHQL } from './arweave_queries';

// ============================================================================
// TYPES
// ============================================================================

export interface SDKRelease {
  sdkMasterHash: string;
  constraintsHash: string;
  fileHashes: Record<string, string>;
  version: string;
  publisherPubkey: string;
  arweaveTxId?: string;
}

export interface DAppRegistration {
  dappId: string;
  codeHash: string;
  sdkHash: string;
  constraintsHash: string;
  developerPubkey: string;
  description: string;
  registeredAt: number;
  arweaveTxId?: string;
}

export interface VerifyResult {
  verified: boolean;
  sdkValid: boolean;
  codeValid: boolean;
  constraintsValid: boolean;
  error?: string;
  xpSlashed?: number;
  arweaveTx?: string;
}

export interface SDKFileEntry {
  name: string;
  content: string;
}

// ============================================================================
// HASHING
// ============================================================================

/** SHA256 hash of a string */
export function hashString(data: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(data)));
}

/** Hash a single SDK file */
export function hashFile(content: string): string {
  return hashString(content);
}

/** Hash the constraints code separately */
export function hashConstraints(constraintsCode: string): string {
  return hashString(constraintsCode);
}

/** Hash all SDK files + constraints into a master hash */
export function hashSDK(files: SDKFileEntry[], constraintsCode: string): SDKRelease {
  const fileHashes: Record<string, string> = {};
  let allContent = '';

  for (const file of files) {
    fileHashes[file.name] = hashFile(file.content);
    allContent += file.content;
  }

  allContent += constraintsCode;
  const sdkMasterHash = hashString(allContent);
  const constraintsHash = hashConstraints(constraintsCode);

  return {
    sdkMasterHash,
    constraintsHash,
    fileHashes,
    version: '',
    publisherPubkey: '',
  };
}

/** Hash a DApp's code for registration */
export function hashDAppCode(code: string): string {
  return hashString(code);
}

// ============================================================================
// PUBLISH SDK TO ARWEAVE (KasVillage team only)
// ============================================================================

export async function publishSDKToArweave(params: {
  files: SDKFileEntry[];
  constraintsCode: string;
  version: string;
}): Promise<SDKRelease & { arweaveTxId: string }> {
  const { files, constraintsCode, version } = params;

  const privKeyHex = await SecureStore.getItemAsync('kv_private_key');
  const pubkey = await SecureStore.getItemAsync('kaspa_pubkey') || '';

  if (!privKeyHex) throw new Error('No private key found');

  const release = hashSDK(files, constraintsCode);
  release.version = version;
  release.publisherPubkey = pubkey;

  const payload = JSON.stringify({
    fileHashes: release.fileHashes,
    constraintsHash: release.constraintsHash,
    sdkMasterHash: release.sdkMasterHash,
    version,
    fileCount: files.length,
  });

  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'sdk-release' },
    { name: 'KV-SDKHash', value: release.sdkMasterHash },
    { name: 'KV-ConstraintsHash', value: release.constraintsHash },
    { name: 'KV-Publisher', value: pubkey },
    { name: 'KV-FileCount', value: String(files.length) },
    { name: 'KV-Version', value: version },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  console.log('[SDK] Publishing SDK v' + version + ' | Hash:', release.sdkMasterHash.slice(0, 16));
  const result = await uploadToIrys(payload, tags);

  if (!result.success) throw new Error('SDK publish failed: ' + result.error);

  console.log('[SDK] Published to Arweave:', result.txId);
  return { ...release, arweaveTxId: result.txId! };
}

// ============================================================================
// REGISTER DAPP ON TOWNHALL + ARWEAVE
// ============================================================================

const TOWNHALL_BASE = __DEV__
  ? 'https://kasvillage.app.runonflux.io'
  : 'https://townhall.kasvillage.dev';

export async function registerDApp(params: {
  dappId: string;
  codeHash: string;
  sdkHash: string;
  constraintsHash: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  const pubkey = await SecureStore.getItemAsync('kaspa_pubkey') || '';
  if (!pubkey) return { success: false, error: 'No pubkey' };

  const { dappId, codeHash, sdkHash, constraintsHash, description } = params;

  // 1. Register on TownHall
  try {
    const resp = await fetch(TOWNHALL_BASE + '/api/dapp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dapp_id: dappId,
        code_hash: codeHash,
        sdk_hash: sdkHash,
        constraints_hash: constraintsHash,
        pubkey,
        description,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const result = await resp.json();
    if (!result.success) return { success: false, error: result.error || 'TownHall rejected' };
  } catch (e) {
    console.warn('[SDK] TownHall registration failed (non-fatal):', e);
  }

  // 2. Inscribe to Arweave (permanent record)
  try {
    const tags: ArweaveTag[] = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'KV-Type', value: 'dapp-registration' },
      { name: 'KV-DAppId', value: dappId },
      { name: 'KV-CodeHash', value: codeHash },
      { name: 'KV-SDKHash', value: sdkHash },
      { name: 'KV-ConstraintsHash', value: constraintsHash },
      { name: 'KV-Pubkey', value: pubkey },
      { name: 'KV-Description', value: description.slice(0, 100) },
      { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
    ];

    const payload = JSON.stringify({ dappId, codeHash, sdkHash, constraintsHash, description });
    await uploadToIrys(payload, tags);
    console.log('[SDK] DApp registered on Arweave:', dappId);
  } catch (e) {
    console.warn('[SDK] Arweave inscription failed (non-fatal):', e);
  }

  return { success: true };
}

// ============================================================================
// VERIFY SDK ON ARWEAVE (called by wallet + TownHall)
// ============================================================================

export async function verifySDKOnArweave(sdkHash: string, constraintsHash: string): Promise<{
  valid: boolean;
  version?: string;
  publisher?: string;
  arweaveTx?: string;
  error?: string;
}> {
  const query = `{
    transactions(
      tags: [
        { name: "App-Name", values: ["KasVillage"] },
        { name: "KV-Type", values: ["sdk-release"] },
        { name: "KV-SDKHash", values: ["${sdkHash}"] }
      ],
      first: 1,
      sort: HEIGHT_DESC
    ) {
      edges { node { id, tags { name value } } }
    }
  }`;

  const endpoints = [GOLDSKY_GRAPHQL, ARWEAVE_GRAPHQL];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) continue;
      const data = await resp.json();
      const edges = data?.data?.transactions?.edges || [];

      if (edges.length === 0) continue;

      const node = edges[0].node;
      const tagMap: Record<string, string> = {};
      for (const t of node.tags) tagMap[t.name] = t.value;

      // Verify constraints hash matches
      if (tagMap['KV-ConstraintsHash'] !== constraintsHash) {
        return { valid: false, error: 'Constraints hash mismatch — SDK constraints tampered' };
      }

      return {
        valid: true,
        version: tagMap['KV-Version'],
        publisher: tagMap['KV-Publisher'],
        arweaveTx: node.id,
      };
    } catch { continue; }
  }

  return { valid: false, error: 'SDK hash not found on Arweave' };
}

// ============================================================================
// VERIFY DAPP ON-CHAIN (trustless - no TownHall dependency)
// The wallet hashes the code it is about to run and compares against the
// codeHash inside the dapp's on-chain attest (Halo2-IPA-DApp-V1 proof chunks
// at the dapp address). Mismatch = the served code differs from the scanned
// code = REFUSE. This closes the scan-clean-serve-malicious gap.
export async function verifyDAppOnChain(
  dappAddress: string,
  currentCodeHash: string,
  network = 'testnet-10',
): Promise<{ verified: boolean; reason: string; attestedHash?: string; proofType?: string }> {
  try {
    const { fetchRecords } = await import('./kaspa_payload');
    const { fetchStoreConfig } = await import('./config_chunks');
    const _wrapped: any[] = await fetchRecords(dappAddress, network, 100);
    const recs: any[] = _wrapped.map((w: any) => (w && w.record) ? w.record : w);
    const cfgRecs = recs.filter(r => (r as any).k === 'cfg' && r.d && typeof r.d.h === 'string');
    if (!cfgRecs.length) return { verified: false, reason: 'no on-chain attest found' };
    const byHash = new Map<string, any[]>();
    for (const r of cfgRecs) { const a = byHash.get(r.d.h) || []; a.push(r); byHash.set(r.d.h, a); }
    let best: any = null;
    for (const [h, arr] of byHash) {
      const tot = arr[0].d.tot;
      if (new Set(arr.map(r => r.d.seq)).size < tot) continue;
      const newest = Math.max(...arr.map(r => r.t));
      if (!best || newest > best.newest) best = { h, newest };
    }
    if (!best) return { verified: false, reason: 'attest incomplete on chain' };
    const { config } = await fetchStoreConfig(dappAddress, best.h, network);
    if (!config || config.kind !== 'dapp_verify') return { verified: false, reason: 'no dapp_verify attest' };
    if (!config.codeHash) return { verified: false, reason: 'attest missing codeHash' };
    if (config.codeHash !== currentCodeHash) {
      return {
        verified: false,
        reason: 'CODE MISMATCH - served code differs from scanned code. Do not run.',
        attestedHash: config.codeHash,
        proofType: config.proofType,
      };
    }
    return { verified: true, reason: 'code hash matches on-chain attest', attestedHash: config.codeHash, proofType: config.proofType };
  } catch (e: any) {
    return { verified: false, reason: 'attest fetch failed: ' + String(e?.message || e) };
  }
}

// VERIFY DAPP (called by wallet before interacting)
// ============================================================================

export async function verifyDApp(dappId: string, currentCodeHash: string): Promise<VerifyResult> {
  // 1. Check TownHall registry
  try {
    const resp = await fetch(TOWNHALL_BASE + '/api/dapp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dapp_id: dappId, code_hash: currentCodeHash }),
      signal: AbortSignal.timeout(10000),
    });

    const result = await resp.json();

    if (!result.verified) {
      return {
        verified: false,
        sdkValid: false,
        codeValid: false,
        constraintsValid: false,
        error: result.error || 'DApp verification failed on TownHall',
        xpSlashed: result.xp_slashed,
      };
    }

    // 2. Independently verify SDK on Arweave
    const sdkCheck = await verifySDKOnArweave(result.sdk_hash, result.constraints_hash);

    if (!sdkCheck.valid) {
      return {
        verified: false,
        sdkValid: false,
        codeValid: true,
        constraintsValid: false,
        error: sdkCheck.error,
      };
    }

    return {
      verified: true,
      sdkValid: true,
      codeValid: true,
      constraintsValid: true,
      arweaveTx: sdkCheck.arweaveTx,
    };
  } catch (e) {
    // TownHall unreachable — fall back to Arweave only
    console.warn('[SDK] TownHall unreachable, checking Arweave only');

    const arweaveCheck = await verifyDAppOnArweave(dappId, currentCodeHash);
    return arweaveCheck;
  }
}

// ============================================================================
// FALLBACK: VERIFY DAPP ON ARWEAVE ONLY (when TownHall is down)
// ============================================================================

async function verifyDAppOnArweave(dappId: string, currentCodeHash: string): Promise<VerifyResult> {
  const query = `{
    transactions(
      tags: [
        { name: "App-Name", values: ["KasVillage"] },
        { name: "KV-Type", values: ["dapp-registration"] },
        { name: "KV-DAppId", values: ["${dappId}"] }
      ],
      first: 1,
      sort: HEIGHT_DESC
    ) {
      edges { node { id, tags { name value } } }
    }
  }`;

  const endpoints = [GOLDSKY_GRAPHQL, ARWEAVE_GRAPHQL];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) continue;
      const data = await resp.json();
      const edges = data?.data?.transactions?.edges || [];

      if (edges.length === 0) continue;

      const tagMap: Record<string, string> = {};
      for (const t of edges[0].node.tags) tagMap[t.name] = t.value;

      const codeValid = tagMap['KV-CodeHash'] === currentCodeHash;

      if (!codeValid) {
        return {
          verified: false,
          sdkValid: true,
          codeValid: false,
          constraintsValid: true,
          error: 'DApp code changed since registration',
        };
      }

      // Verify SDK chain
      const sdkCheck = await verifySDKOnArweave(tagMap['KV-SDKHash'], tagMap['KV-ConstraintsHash']);

      return {
        verified: sdkCheck.valid && codeValid,
        sdkValid: sdkCheck.valid,
        codeValid,
        constraintsValid: sdkCheck.valid,
        arweaveTx: edges[0].node.id,
        error: sdkCheck.valid ? undefined : sdkCheck.error,
      };
    } catch { continue; }
  }

  return {
    verified: false,
    sdkValid: false,
    codeValid: false,
    constraintsValid: false,
    error: 'DApp not found on Arweave',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  verifyDAppOnArweave,
};
