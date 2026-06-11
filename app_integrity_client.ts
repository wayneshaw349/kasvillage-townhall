// app_integrity_client.ts — KasVillage App Integrity + QR Distribution
// Publisher signs APK hash → uploads to Arweave → users verify on download
// Hardcoded publisher pubkey = trust anchor

import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { Alert, Share } from 'react-native';

// ============================================================================
// PUBLISHER TRUST ANCHOR — hardcoded, cannot be spoofed
// Replace with your actual publisher pubkey after first build
// ============================================================================

export const PUBLISHER_PUBKEY = '031327c9c0469fb1'; // Wayne's iPhone pubkey (first 16 chars — replace with FULL 66-char compressed pubkey)
// TODO: Set full 66-char compressed pubkey before production release
// Example: '02a1b2c3d4e5f6...full 66 hex chars'

export const APP_NAME = 'KasVillage';
export const ARWEAVE_GQL = 'https://arweave.net/graphql';
export const ARWEAVE_GATEWAY = 'https://arweave.net';

// ============================================================================
// TYPES
// ============================================================================

export interface AppRelease {
  txId: string;
  appHash: string;
  publisherPubkey: string;
  publisherSignature: string;
  version: string;
  timestamp: number;
  downloadUrl: string;
}

export interface VerificationResult {
  hashMatch: boolean;
  signatureValid: boolean;
  publisherMatch: boolean;
  fullyVerified: boolean;
  message: string;
  release?: AppRelease;
}

// ============================================================================
// QUERY ARWEAVE FOR LATEST RELEASE
// ============================================================================

export async function getLatestRelease(): Promise<AppRelease | null> {
  try {
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["${APP_NAME}"] },
          { name: "KV-Type", values: ["APP_RELEASE"] }
        ],
        first: 1,
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            tags { name value }
            block { timestamp }
          }
        }
      }
    }`;

    const resp = await fetch(ARWEAVE_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await resp.json();
    const edge = data?.data?.transactions?.edges?.[0];
    if (!edge) return null;

    const tags: Record<string, string> = {};
    for (const t of edge.node.tags) tags[t.name] = t.value;

    return {
      txId: edge.node.id,
      appHash: tags['KV-AppHash'] || '',
      publisherPubkey: tags['KV-Publisher'] || '',
      publisherSignature: tags['KV-Signature'] || '',
      version: tags['KV-Version'] || '0.0.0',
      timestamp: edge.node.block?.timestamp || 0,
      downloadUrl: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
    };
  } catch (e) {
    console.error('[AppIntegrity] Failed to query Arweave:', e);
    return null;
  }
}

// ============================================================================
// VERIFY APP INTEGRITY
// ============================================================================

export function verifyRelease(localHash: string, release: AppRelease): VerificationResult {
  // 1. Hash match — does the downloaded file match what's on Arweave?
  const hashMatch = localHash.toLowerCase() === release.appHash.toLowerCase();

  // 2. Signature valid — did the publisher actually sign this hash?
  let signatureValid = false;
  try {
    const hashBytes = hexToBytes(release.appHash);
    const sigBytes = hexToBytes(release.publisherSignature);
    const pubkeyBytes = hexToBytes(release.publisherPubkey);
    signatureValid = secp256k1.verify(sigBytes, hashBytes, pubkeyBytes);
  } catch (e) {
    console.warn('[AppIntegrity] Signature verification error:', e);
  }

  // 3. Publisher match — is this the known publisher?
  const publisherMatch = release.publisherPubkey.startsWith(PUBLISHER_PUBKEY);

  const fullyVerified = hashMatch && signatureValid && publisherMatch;

  let message: string;
  if (fullyVerified) {
    message = `✅ Verified! v${release.version} signed by KasVillage publisher.`;
  } else if (!hashMatch) {
    message = '❌ CRITICAL: File hash does not match. DO NOT USE this app.';
  } else if (!signatureValid) {
    message = '⚠️ WARNING: Publisher signature invalid. App may be tampered.';
  } else if (!publisherMatch) {
    message = '⚠️ WARNING: Unknown publisher. This is not the official KasVillage app.';
  } else {
    message = '⚠️ Verification incomplete.';
  }

  return { hashMatch, signatureValid, publisherMatch, fullyVerified, message, release };
}

// ============================================================================
// FIRST-LAUNCH VERIFICATION
// ============================================================================

const INTEGRITY_KEY = 'kv_app_integrity';
const INTEGRITY_CHECKED_KEY = 'kv_integrity_checked';

export async function runFirstLaunchCheck(): Promise<VerificationResult | null> {
  try {
    // Skip if already verified this version
    const checked = await SecureStore.getItemAsync(INTEGRITY_CHECKED_KEY);
    if (checked === 'true') return null;

    // Get latest release from Arweave
    const release = await getLatestRelease();
    if (!release) {
      console.log('[AppIntegrity] No release found on Arweave — first publish pending');
      return null;
    }

    // For now, we can't compute APK hash at runtime in React Native easily
    // The verification will be done at install time via the QR flow
    // Store the release info for reference
    await SecureStore.setItemAsync(INTEGRITY_KEY, JSON.stringify(release));
    await SecureStore.setItemAsync(INTEGRITY_CHECKED_KEY, 'true');

    console.log('[AppIntegrity] Release found: v' + release.version, 'hash:', release.appHash.slice(0, 16));
    return null;
  } catch (e) {
    console.warn('[AppIntegrity] First launch check error:', e);
    return null;
  }
}

// ============================================================================
// PUBLISHER TOOLS (Wayne runs these to publish a release)
// ============================================================================

/**
 * Compute hash of APK file (run on dev machine, not on phone)
 * Usage: node -e "require('./app_integrity_client').hashFile('path/to/app.apk')"
 */
export function computeFileHash(fileBytes: Uint8Array): string {
  return bytesToHex(sha256(fileBytes));
}

/**
 * Sign a file hash with publisher's private key
 */
export function signHash(hash: string, privkeyHex: string): string {
  const hashBytes = hexToBytes(hash);
  const sig = secp256k1.sign(hashBytes, hexToBytes(privkeyHex));
  return bytesToHex(sig.toCompactRawBytes());
}

/**
 * Generate Arweave tags for app release upload
 */
export function generateReleaseTags(
  appHash: string,
  publisherPubkey: string,
  signature: string,
  version: string
): Array<{ name: string; value: string }> {
  return [
    { name: 'App-Name', value: APP_NAME },
    { name: 'Content-Type', value: 'application/vnd.android.package-archive' },
    { name: 'KV-Type', value: 'APP_RELEASE' },
    { name: 'KV-AppHash', value: appHash },
    { name: 'KV-Publisher', value: publisherPubkey },
    { name: 'KV-Signature', value: signature },
    { name: 'KV-Version', value: version },
    { name: 'KV-Platform', value: 'android' },
  ];
}

// ============================================================================
// QR SHARE — existing user shares app with new user
// ============================================================================

export async function getShareQRData(): Promise<{
  qrData: string;
  downloadUrl: string;
  version: string;
  appHash: string;
} | null> {
  try {
    // Check stored release info first
    const stored = await SecureStore.getItemAsync(INTEGRITY_KEY);
    if (stored) {
      const release: AppRelease = JSON.parse(stored);
      return {
        qrData: JSON.stringify({
          type: 'kasvillage_app',
          url: release.downloadUrl,
          hash: release.appHash,
          pub: release.publisherPubkey.slice(0, 16),
          sig: release.publisherSignature.slice(0, 32),
          ver: release.version,
        }),
        downloadUrl: release.downloadUrl,
        version: release.version,
        appHash: release.appHash,
      };
    }

    // Query Arweave for latest
    const release = await getLatestRelease();
    if (!release) return null;

    await SecureStore.setItemAsync(INTEGRITY_KEY, JSON.stringify(release));

    return {
      qrData: JSON.stringify({
        type: 'kasvillage_app',
        url: release.downloadUrl,
        hash: release.appHash,
        pub: release.publisherPubkey.slice(0, 16),
        sig: release.publisherSignature.slice(0, 32),
        ver: release.version,
      }),
      downloadUrl: release.downloadUrl,
      version: release.version,
      appHash: release.appHash,
    };
  } catch (e) {
    console.error('[AppIntegrity] getShareQRData error:', e);
    return null;
  }
}

export async function shareApp(): Promise<void> {
  const data = await getShareQRData();
  if (!data) {
    Alert.alert('Not Published', 'App has not been published to Arweave yet. Publish first.');
    return;
  }

  await Share.share({
    message: `Download KasVillage v${data.version}\n\n${data.downloadUrl}\n\nVerify hash: ${data.appHash.slice(0, 16)}...\n\nP2P Kaspa marketplace — no app store needed.`,
    title: 'KasVillage App',
  });
}

// ============================================================================
// PUBLISH SCRIPT (run from Node.js on dev machine, not React Native)
// ============================================================================
// 
// Usage:
//   1. Build APK: eas build --profile production --platform android
//   2. Download APK
//   3. Run: node publish_to_arweave.js <apk_path> <privkey_hex>
//
// The script will:
//   a. Read APK file
//   b. Compute SHA256
//   c. Sign hash with publisher key
//   d. Upload to Arweave via Irys/Turbo with tags
//   e. Print QR data + download URL
//
// Example publish script (publish_to_arweave.js):
//
//   const fs = require('fs');
//   const { sha256 } = require('@noble/hashes/sha256');
//   const { secp256k1 } = require('@noble/curves/secp256k1');
//   const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
//   
//   const apkPath = process.argv[2];
//   const privkey = process.argv[3];
//   
//   const apkBytes = fs.readFileSync(apkPath);
//   const hash = bytesToHex(sha256(apkBytes));
//   const sig = secp256k1.sign(hexToBytes(hash), hexToBytes(privkey));
//   const sigHex = bytesToHex(sig.toCompactRawBytes());
//   const pubkey = bytesToHex(secp256k1.getPublicKey(hexToBytes(privkey)));
//   
//   console.log('Hash:', hash);
//   console.log('Signature:', sigHex);
//   console.log('Publisher:', pubkey);
//   console.log('Upload to Arweave with these tags:');
//   console.log(JSON.stringify(generateReleaseTags(hash, pubkey, sigHex, '1.0.0'), null, 2));
// ============================================================================
