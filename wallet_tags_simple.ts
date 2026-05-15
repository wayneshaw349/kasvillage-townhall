// ============================================================================
// KASVILLAGE L1 WALLET TAGS - SIMPLIFIED TRACKING
// ============================================================================
// 64-byte compact tags for TownHall wallet detection
// No Bayesian - just track wallets, events, stats
// ============================================================================

/**
 * TAG FORMAT (64 bytes):
 * 
 * [KV2T:4][VER:1][TYPE:1][DATA:58]
 * 
 * Types:
 *   0x01 WALLET  - Wallet registration
 *   0x02 FROST   - FROST agreement event
 *   0x03 XP      - XP change
 *   0x04 APT     - Apartment alias
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const KV_TAG = 'KV2T';
export const KV_VER = 0x01;

export const TagType = {
  WALLET: 0x01,
  FROST:  0x02,
  XP:     0x03,
  APT:    0x04,
} as const;

export const FrostEvent = {
  INIT:    0x01,
  JOIN:    0x02,
  LOCK:    0x03,
  SUCCESS: 0x04,
  REFUND:  0x05,
  DISPUTE: 0x06,
} as const;

// ============================================================================
// UTILS
// ============================================================================

const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return b; };
const txt = (s: string) => new TextEncoder().encode(s);
const untxt = (b: Uint8Array) => new TextDecoder().decode(b).replace(/\0/g, '');

// ============================================================================
// TAG ENCODING
// ============================================================================

/**
 * WALLET TAG (64 bytes)
 * [KV2T:4][01:1][01:1][pubkey_hash:20][apt:8][tier:1][xp:4][successes:2][deadlocks:2][reserved:22]
 */
export function encodeWalletTag(
  pubkeyHash: Uint8Array, // 20 bytes
  apt: string,
  tier: number,
  xp: number,
  successes: number,
  deadlocks: number
): string {
  const b = new Uint8Array(64);
  b.set(txt(KV_TAG), 0);
  b[4] = KV_VER;
  b[5] = TagType.WALLET;
  b.set(pubkeyHash.slice(0, 20), 6);
  b.set(txt(apt.slice(0, 8).padEnd(8, '\0')), 26);
  b[34] = tier;
  new DataView(b.buffer).setUint32(35, xp);
  new DataView(b.buffer).setUint16(39, successes);
  new DataView(b.buffer).setUint16(41, deadlocks);
  return hex(b);
}

/**
 * FROST TAG (64 bytes)
 * [KV2T:4][01:1][02:1][event:1][aid_short:12][role:1][amt:8][counterparty_hash:20][reserved:17]
 */
export function encodeFrostTag(
  event: number,
  agreementId: string,
  role: 'buyer' | 'seller',
  amountSompi: bigint,
  counterpartyHash?: Uint8Array
): string {
  const b = new Uint8Array(64);
  b.set(txt(KV_TAG), 0);
  b[4] = KV_VER;
  b[5] = TagType.FROST;
  b[6] = event;
  b.set(txt(agreementId.slice(0, 12).padEnd(12, '\0')), 7);
  b[19] = role === 'buyer' ? 1 : 2;
  new DataView(b.buffer).setBigUint64(20, amountSompi);
  if (counterpartyHash) b.set(counterpartyHash.slice(0, 20), 28);
  return hex(b);
}

/**
 * XP TAG (64 bytes)
 * [KV2T:4][01:1][03:1][delta:4][new_total:4][reason:1][daa:8][pubkey_hash:20][reserved:22]
 */
export const XPReason = {
  ONBOARD:  0x01,
  TRADE_OK: 0x02,
  TRADE_FAIL: 0x03,
  CITADEL_UP: 0x04,
  DECAY:    0x05,
} as const;

export function encodeXPTag(
  delta: number, // signed
  newTotal: number,
  reason: number,
  daaScore: bigint,
  pubkeyHash: Uint8Array
): string {
  const b = new Uint8Array(64);
  b.set(txt(KV_TAG), 0);
  b[4] = KV_VER;
  b[5] = TagType.XP;
  new DataView(b.buffer).setInt32(6, delta);
  new DataView(b.buffer).setUint32(10, newTotal);
  b[14] = reason;
  new DataView(b.buffer).setBigUint64(15, daaScore);
  b.set(pubkeyHash.slice(0, 20), 23);
  return hex(b);
}

/**
 * APT TAG (64 bytes)
 * [KV2T:4][01:1][04:1][apt:8][pubkey_hash:20][daa:8][reserved:23]
 */
export function encodeAptTag(
  apt: string,
  pubkeyHash: Uint8Array,
  daaScore: bigint
): string {
  const b = new Uint8Array(64);
  b.set(txt(KV_TAG), 0);
  b[4] = KV_VER;
  b[5] = TagType.APT;
  b.set(txt(apt.slice(0, 8).padEnd(8, '\0')), 6);
  b.set(pubkeyHash.slice(0, 20), 14);
  new DataView(b.buffer).setBigUint64(34, daaScore);
  return hex(b);
}

// ============================================================================
// TAG DECODING
// ============================================================================

export interface DecodedTag {
  type: number;
  typeName: string;
  // WALLET
  pubkeyHash?: string;
  apt?: string;
  tier?: number;
  xp?: number;
  successes?: number;
  deadlocks?: number;
  // FROST
  event?: number;
  eventName?: string;
  agreementId?: string;
  role?: 'buyer' | 'seller';
  amount?: bigint;
  counterpartyHash?: string;
  // XP
  delta?: number;
  newTotal?: number;
  reason?: number;
  reasonName?: string;
  daaScore?: bigint;
}

export function decodeTag(payloadHex: string): DecodedTag | null {
  try {
    const b = unhex(payloadHex);
    if (b.length < 6) return null;
    if (untxt(b.slice(0, 4)) !== KV_TAG) return null;
    if (b[4] !== KV_VER) return null;

    const type = b[5];
    const typeNames: Record<number, string> = { 1: 'WALLET', 2: 'FROST', 3: 'XP', 4: 'APT' };
    const result: DecodedTag = { type, typeName: typeNames[type] || 'UNKNOWN' };
    const dv = new DataView(b.buffer, b.byteOffset);

    switch (type) {
      case TagType.WALLET:
        result.pubkeyHash = hex(b.slice(6, 26));
        result.apt = untxt(b.slice(26, 34));
        result.tier = b[34];
        result.xp = dv.getUint32(35);
        result.successes = dv.getUint16(39);
        result.deadlocks = dv.getUint16(41);
        break;

      case TagType.FROST: {
        const eventNames: Record<number, string> = { 1: 'INIT', 2: 'JOIN', 3: 'LOCK', 4: 'SUCCESS', 5: 'REFUND', 6: 'DISPUTE' };
        result.event = b[6];
        result.eventName = eventNames[b[6]] || 'UNKNOWN';
        result.agreementId = untxt(b.slice(7, 19));
        result.role = b[19] === 1 ? 'buyer' : 'seller';
        result.amount = dv.getBigUint64(20);
        result.counterpartyHash = hex(b.slice(28, 48));
        break;
      }

      case TagType.XP: {
        const reasonNames: Record<number, string> = { 1: 'ONBOARD', 2: 'TRADE_OK', 3: 'TRADE_FAIL', 4: 'CITADEL_UP', 5: 'DECAY' };
        result.delta = dv.getInt32(6);
        result.newTotal = dv.getUint32(10);
        result.reason = b[14];
        result.reasonName = reasonNames[b[14]] || 'UNKNOWN';
        result.daaScore = dv.getBigUint64(15);
        result.pubkeyHash = hex(b.slice(23, 43));
        break;
      }

      case TagType.APT:
        result.apt = untxt(b.slice(6, 14));
        result.pubkeyHash = hex(b.slice(14, 34));
        result.daaScore = dv.getBigUint64(34);
        break;
    }

    return result;
  } catch {
    return null;
  }
}

// ============================================================================
// TOWNHALL SCANNER (for Rust backend)
// ============================================================================

/**
 * Scan TX payload for KasVillage tag
 * Returns null if not a KV tag
 */
export function scanTxPayload(payload: string): DecodedTag | null {
  if (!payload || payload.length < 12) return null;
  // Check for KV2T marker (hex: 4b563254)
  if (!payload.startsWith('4b563254')) return null;
  return decodeTag(payload);
}

/**
 * Build wallet profile from observed tags
 * TownHall aggregates these per pubkey_hash
 */
export interface WalletProfile {
  pubkeyHash: string;
  apt: string;
  tier: number;
  xp: number;
  successes: number;
  deadlocks: number;
  frostInits: number;
  frostJoins: number;
  frostLocks: number;
  frostSuccesses: number;
  frostRefunds: number;
  frostDisputes: number;
  totalFrostAmount: bigint;
  lastDaaScore: bigint;
  firstSeen: bigint;
  lastSeen: bigint;
}

export function emptyProfile(pubkeyHash: string): WalletProfile {
  return {
    pubkeyHash,
    apt: '',
    tier: 0,
    xp: 150,
    successes: 0,
    deadlocks: 0,
    frostInits: 0,
    frostJoins: 0,
    frostLocks: 0,
    frostSuccesses: 0,
    frostRefunds: 0,
    frostDisputes: 0,
    totalFrostAmount: 0n,
    lastDaaScore: 0n,
    firstSeen: 0n,
    lastSeen: 0n,
  };
}

export function updateProfile(profile: WalletProfile, tag: DecodedTag, daaScore: bigint): WalletProfile {
  const p = { ...profile };
  if (p.firstSeen === 0n) p.firstSeen = daaScore;
  p.lastSeen = daaScore;

  switch (tag.type) {
    case TagType.WALLET:
      p.apt = tag.apt || p.apt;
      p.tier = tag.tier ?? p.tier;
      p.xp = tag.xp ?? p.xp;
      p.successes = tag.successes ?? p.successes;
      p.deadlocks = tag.deadlocks ?? p.deadlocks;
      break;

    case TagType.FROST:
      if (tag.event === FrostEvent.INIT) p.frostInits++;
      if (tag.event === FrostEvent.JOIN) p.frostJoins++;
      if (tag.event === FrostEvent.LOCK) { p.frostLocks++; p.totalFrostAmount += tag.amount || 0n; }
      if (tag.event === FrostEvent.SUCCESS) { p.frostSuccesses++; p.successes++; }
      if (tag.event === FrostEvent.REFUND) p.frostRefunds++;
      if (tag.event === FrostEvent.DISPUTE) { p.frostDisputes++; p.deadlocks++; }
      break;

    case TagType.XP:
      p.xp = tag.newTotal ?? p.xp;
      if (tag.daaScore) p.lastDaaScore = tag.daaScore;
      break;

    case TagType.APT:
      p.apt = tag.apt || p.apt;
      if (tag.daaScore) p.lastDaaScore = tag.daaScore;
      break;
  }

  return p;
}

// ============================================================================
// ARWEAVE TAGS (for full data storage)
// ============================================================================

/**
 * Arweave tags match TownHall constants
 */
export const ArweaveTags = {
  USER_STATS: 'KV-UserStats',
  VERIFIED_IDENTITY: 'KV-VerifiedIdentity',
  XP_LEDGER: 'KV-XPLedger',
  AVATAR_SNAPSHOT: 'KV-AvatarSnapshot',
  HOST_NODE: 'KV-HostNode',
  FROST_DKG: 'KV-FrostDKG',
  FROST_SIG: 'KV-FrostSig',
} as const;

// ============================================================================
// EXPORT
// ============================================================================

export { hex as bytesToHex, unhex as hexToBytes };
