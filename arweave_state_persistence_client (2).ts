// ============================================================================
// ARWEAVE STATE PERSISTENCE CLIENT v2
// Replaces mock Bundlr/Irys stubs with real ANS-104 Turbo uploads.
// Signs with the user's secp256k1 wallet key (same as identity_inscription.ts).
// Uses AsyncStorage offline queue (RN-compatible, no localStorage).
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';

// ── SecureStore keys ─────────────────────────────────────────────────────────
const SK = {
  L1_PRIVKEY_ENC:  'kv_l1_privkey_enc',
  DEVICE_ENC_KEY:  'device_encryption_key',
  PUBKEY_COMPRESSED: 'public_key',
} as const;

// ── Constants ─────────────────────────────────────────────────────────────────
const ARWEAVE_GATEWAY   = 'https://arweave.net';
const TURBO_URL         = 'https://upload.ardrive.io/v1/tx';
const TOWN_HALL_URL     = process.env.EXPO_PUBLIC_TOWN_HALL_URL ?? 'http://localhost:8080';
const OFFLINE_QUEUE_KEY = 'kv_arweave_queue';

// ── Types ────────────────────────────────────────────────────────────────────
export interface UserCompletionStats {
  pubkey:                string;
  xp:                    number;
  agreements_succeeded:  number;
  agreements_deadlocked: number;
  reviews_posted:        number;
  stores_created:        number;
  dapps_created:         number;
  last_updated_ms:       number;
  citadel_tier:          'Guest' | 'Resident' | 'Passport';
}

export interface VerifiedIdentityRecord {
  pubkey:             string;
  identity_hash:      string;
  traits_count:       number;
  tier:               'Guest' | 'Resident' | 'Passport';
  verified_at_block:  number;
  verified_at_timestamp: number;
  proof_tx_id:        string;
  signature:          string;
}

export interface XPLedgerEntry {
  pubkey:      string;
  event_type:  'NeighborSuccess' | 'NeighborDeadlock' | 'StoreCreated' | 'DAppCreated' | 'ReviewPosted' | 'AdminSlash';
  xp_delta:    number;
  xp_after:    number;
  reason:      string;
  timestamp_ms: number;
  arweave_block: number;
  signature:   string;
}

interface ArweaveTag { name: string; value: string; }

export interface QueuedArweavePost {
  type:      'stats' | 'identity' | 'xp_ledger';
  data:      UserCompletionStats | VerifiedIdentityRecord | XPLedgerEntry;
  timestamp: number;
  attempts:  number;
}

// ── Private key loader (no biometric — background ops) ───────────────────────
// For background state posts we skip biometric and require the device key only.
// The private key is still protected by Secure Enclave / Keystore at rest.
async function loadPrivKeyHexBackground(): Promise<string | null> {
  try {
    const storedRaw = await SecureStore.getItemAsync(SK.L1_PRIVKEY_ENC);
    if (!storedRaw) return null;
    const stored = JSON.parse(storedRaw) as { privateKeyEnc: string };

    const deviceKey = await SecureStore.getItemAsync(SK.DEVICE_ENC_KEY);
    if (!deviceKey) return null;

    const encHex = stored.privateKeyEnc;
    const combined = deviceKey + encHex;
    const ks = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combined);

    const result: string[] = [];
    for (let i = 0; i < 64; i += 2) {
      const encByte = parseInt(encHex.slice(i, i + 2), 16);
      const ksByte  = parseInt(ks.slice(i % ks.length, (i % ks.length) + 2), 16);
      result.push((encByte ^ ksByte).toString(16).padStart(2, '0'));
    }
    return result.join('');
  } catch { return null; }
}

// ── ANS-104 builder (secp256k1 ECDSA, Turbo free tier) ───────────────────────
function w16LE(n: number): Uint8Array { return new Uint8Array([n & 0xff, (n >> 8) & 0xff]); }
function le8(n: number): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 0; i < 8; i++) b[i] = (n >>> (i * 8)) & 0xff;
  return b;
}

function serializeTags(tags: ArweaveTag[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [w16LE(tags.length)];
  for (const t of tags) {
    const n = enc.encode(t.name), v = enc.encode(t.value);
    parts.push(w16LE(n.length), n, w16LE(v.length), v);
  }
  return concatBytes(...parts);
}

async function deepHash(items: Uint8Array[]): Promise<Uint8Array> {
  let h = sha256(concatBytes(
    sha256(new TextEncoder().encode('list')),
    sha256(new TextEncoder().encode(items.length.toString())),
  ));
  for (const item of items) h = sha256(concatBytes(h, sha256(item)));
  return h;
}

async function buildAndUpload(
  jsonData: string,
  tags: ArweaveTag[],
  privKeyHex: string,
): Promise<{ txId: string; url: string } | null> {
  const data         = new TextEncoder().encode(jsonData);
  const privKeyBytes = hexToBytes(privKeyHex);
  const compPub      = secp256k1.ProjectivePoint.fromPrivateKey(privKeyBytes).toRawBytes(true);
  const SIG_TYPE     = new Uint8Array([3, 0]);
  const serialTags   = serializeTags(tags);

  const toSign = await deepHash([
    new TextEncoder().encode('dataitem'),
    new TextEncoder().encode('1'),
    SIG_TYPE,
    compPub,
    new Uint8Array(0),
    new Uint8Array(0),
    serialTags,
    data,
  ]);

  const sig     = secp256k1.sign(toSign, privKeyBytes);
  const sigBytes = sig.toCompactRawBytes();

  const item = concatBytes(
    sigBytes,
    compPub,
    new Uint8Array([0]),
    new Uint8Array([0]),
    w16LE(tags.length),
    serialTags,
    le8(data.length),
    data,
  );

  try {
    const r = await fetch(TURBO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([new Uint8Array(item)]),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 30000); return c.signal; })(),
    });
    if (!r.ok) {
      console.error(`[Turbo] ${r.status}: ${await r.text().catch(() => '')}`);
      return null;
    }
    const json = await r.json();
    const txId = json.id as string;
    return { txId, url: `${ARWEAVE_GATEWAY}/${txId}` };
  } catch (e) {
    console.error('[Turbo] upload error:', e);
    return null;
  }
}

// ── Town Hall client ──────────────────────────────────────────────────────────
export async function verifyIdentityWithTownHall(
  pubkey: string,
  avatar: object,
  signature: string,
): Promise<{ success: boolean; tier: string; traits: number; can_buy: boolean; can_sell: boolean; error?: string }> {
  try {
    const r = await fetch(`${TOWN_HALL_URL}/verify-identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, avatar, signature }),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15000); return c.signal; })(),
    });
    return r.json();
  } catch (e) {
    return { success: false, tier: 'Guest', traits: 0, can_buy: false, can_sell: false, error: String(e) };
  }
}

export async function getUserStatsFromTownHall(pubkey: string): Promise<UserCompletionStats | null> {
  try {
    const r = await fetch(`${TOWN_HALL_URL}/user-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey }),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export async function getXPLedgerFromTownHall(pubkey: string): Promise<XPLedgerEntry | null> {
  try {
    const r = await fetch(`${TOWN_HALL_URL}/xp-ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey }),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// ── Arweave posting (real uploads) ────────────────────────────────────────────

export async function postUserStatsToArweave(
  stats: UserCompletionStats,
  signature: string,
): Promise<{ success: boolean; tx_id?: string; error?: string }> {
  const privKeyHex = await loadPrivKeyHexBackground();
  if (!privKeyHex) return { success: false, error: 'Key unavailable' };

  const tags: ArweaveTag[] = [
    { name: 'App-Name',      value: 'KasVillage' },
    { name: 'Content-Type',  value: 'application/json' },
    { name: 'KV-Type',       value: 'user-stats' },
    { name: 'KV-UserStats',  value: stats.pubkey },
    { name: 'KV-Tier',       value: stats.citadel_tier },
    { name: 'KV-XP',         value: String(stats.xp) },
    { name: 'Version',       value: '5.0' },
    { name: 'Signature',     value: signature },
  ];

  const result = await buildAndUpload(JSON.stringify(stats), tags, privKeyHex);
  if (!result) return { success: false, error: 'Turbo upload failed' };

  console.log(`[Arweave] Stats posted: ${result.txId}`);
  return { success: true, tx_id: result.txId };
}

export async function postVerifiedIdentityToArweave(
  record: VerifiedIdentityRecord,
): Promise<{ success: boolean; tx_id?: string; error?: string }> {
  const privKeyHex = await loadPrivKeyHexBackground();
  if (!privKeyHex) return { success: false, error: 'Key unavailable' };

  const tags: ArweaveTag[] = [
    { name: 'App-Name',            value: 'KasVillage' },
    { name: 'Content-Type',        value: 'application/json' },
    { name: 'KV-Type',             value: 'verified-identity' },
    { name: 'KV-VerifiedIdentity', value: record.pubkey },
    { name: 'Identity-Hash',       value: record.identity_hash },
    { name: 'Tier',                value: record.tier },
  ];

  const result = await buildAndUpload(JSON.stringify(record), tags, privKeyHex);
  if (!result) return { success: false, error: 'Turbo upload failed' };

  console.log(`[Arweave] Identity posted: ${result.txId}`);
  return { success: true, tx_id: result.txId };
}

export async function postXPLedgerToArweave(
  entry: XPLedgerEntry,
): Promise<{ success: boolean; tx_id?: string; error?: string }> {
  const privKeyHex = await loadPrivKeyHexBackground();
  if (!privKeyHex) return { success: false, error: 'Key unavailable' };

  const tags: ArweaveTag[] = [
    { name: 'App-Name',     value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type',      value: 'xp-ledger' },
    { name: 'KV-XPLedger', value: entry.pubkey },
    { name: 'Event-Type',   value: entry.event_type },
    { name: 'XP-Delta',     value: String(entry.xp_delta) },
    { name: 'XP-After',     value: String(entry.xp_after) },
  ];

  const result = await buildAndUpload(JSON.stringify(entry), tags, privKeyHex);
  if (!result) return { success: false, error: 'Turbo upload failed' };

  console.log(`[Arweave] XP ledger posted: ${result.txId}`);
  return { success: true, tx_id: result.txId };
}

// ── Batch: agreement result ───────────────────────────────────────────────────
export async function postAgreementResultToArweave(
  user_a_stats: UserCompletionStats,
  user_b_stats: UserCompletionStats,
  user_a_sig: string,
  user_b_sig: string,
  xp_entry_a: XPLedgerEntry,
  xp_entry_b: XPLedgerEntry,
): Promise<{ success: boolean; stats_a_tx?: string; stats_b_tx?: string; xp_a_tx?: string; xp_b_tx?: string; error?: string }> {
  const [sa, sb, xa, xb] = await Promise.all([
    postUserStatsToArweave(user_a_stats, user_a_sig),
    postUserStatsToArweave(user_b_stats, user_b_sig),
    postXPLedgerToArweave(xp_entry_a),
    postXPLedgerToArweave(xp_entry_b),
  ]);

  const success = sa.success && sb.success && xa.success && xb.success;
  return {
    success,
    stats_a_tx: sa.tx_id,
    stats_b_tx: sb.tx_id,
    xp_a_tx:    xa.tx_id,
    xp_b_tx:    xb.tx_id,
    error: success ? undefined : 'Partial failure — check individual results',
  };
}

// ── Arweave query (read path) ─────────────────────────────────────────────────
export async function fetchUserStatsFromArweave(pubkey: string): Promise<UserCompletionStats | null> {
  try {
    const gql = {
      query: `query {
        transactions(first:1, tags:[
          {name:"KV-UserStats", values:["${pubkey}"]},
          {name:"Content-Type", values:["application/json"]}
        ], sort:HEIGHT_DESC) { edges { node { id } } }
      }`,
    };
    const gr = await fetch(`${ARWEAVE_GATEWAY}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gql),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    const gj = await gr.json();
    const edges = gj?.data?.transactions?.edges;
    if (!edges?.length) return null;

    const txId = edges[0].node.id;
    const dr = await fetch(`${ARWEAVE_GATEWAY}/${txId}`, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
    return dr.ok ? dr.json() : null;
  } catch (e) {
    console.error('[Arweave] fetch stats error:', e);
    return null;
  }
}

// ── Offline queue (AsyncStorage — RN safe) ────────────────────────────────────
export async function queueArweavePost(post: Omit<QueuedArweavePost, 'attempts'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedArweavePost[] = raw ? JSON.parse(raw) : [];
    queue.push({ ...post, attempts: 0 });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[Queue] enqueue error:', e);
  }
}

export async function drainArweaveQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    const queue: QueuedArweavePost[] = JSON.parse(raw);
    const remaining: QueuedArweavePost[] = [];

    for (const post of queue) {
      let result: { success: boolean; tx_id?: string } | undefined;

      if (post.type === 'stats') {
        result = await postUserStatsToArweave(post.data as UserCompletionStats, '');
      } else if (post.type === 'identity') {
        result = await postVerifiedIdentityToArweave(post.data as VerifiedIdentityRecord);
      } else if (post.type === 'xp_ledger') {
        result = await postXPLedgerToArweave(post.data as XPLedgerEntry);
      }

      if (result?.success) {
        console.log(`[Queue] drained ${post.type}`);
      } else {
        post.attempts += 1;
        if (post.attempts < 4) remaining.push(post);
        else console.warn(`[Queue] dropped ${post.type} after 3 attempts`);
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  } catch (e) {
    console.error('[Queue] drain error:', e);
  }
}

export default {
  verifyIdentityWithTownHall,
  getUserStatsFromTownHall,
  getXPLedgerFromTownHall,
  postUserStatsToArweave,
  postVerifiedIdentityToArweave,
  postXPLedgerToArweave,
  postAgreementResultToArweave,
  fetchUserStatsFromArweave,
  queueArweavePost,
  drainArweaveQueue,
};
