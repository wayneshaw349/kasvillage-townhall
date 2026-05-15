// ============================================================================
// PATCH: Add recoverAvatarFromArweave to avatar_arweave_upload.ts
// Run AFTER patch_avatar_profile.js
// Run: node patch_avatar_recovery.js
// ============================================================================

const fs = require('fs');

let au = fs.readFileSync('avatar_arweave_upload.ts', 'utf8');

const recoveryFn = `

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
export async function recoverAvatarFromArweave(pubkey: string): Promise<AvatarRecoveryResult> {
  if (!pubkey) return { success: false, error: 'No pubkey provided' };

  const GOLDSKY = 'https://arweave-search.goldsky.com/graphql';
  const ARWEAVE_GW = 'https://arweave.net';

  try {
    console.log('[AvatarRecovery] Querying Arweave for pubkey:', pubkey.slice(0, 16));

    // 1. Query for avatar-paths (has the raw paths we need)
    const query = \`{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Type", values: ["avatar-paths"] },
          { name: "KV-Pubkey", values: ["\${pubkey}"] }
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
    }\`;

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
`;

if (!au.includes('recoverAvatarFromArweave')) {
  au += recoveryFn;
  fs.writeFileSync('avatar_arweave_upload.ts', au);
  console.log('FIX: recoverAvatarFromArweave added to avatar_arweave_upload.ts');
  console.log('');
  console.log('Recovery flow:');
  console.log('  1. Query Arweave: KV-Type=avatar-paths, KV-Pubkey={pubkey}');
  console.log('  2. Fetch paths JSON from arweave.net/{txId}');
  console.log('  3. SHA256(paths) must match KV-Identity tag (tamper check)');
  console.log('  4. Store to SecureStore (kv_avatar_identity)');
  console.log('  5. ProfileScreen picks it up on next loadProfile()');
  console.log('');
  console.log('Called from: device recovery flow / loadProfile when getStoredAvatar() returns null');
} else {
  console.log('SKIP: recoverAvatarFromArweave already exists');
}
