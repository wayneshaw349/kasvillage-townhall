// ============================================================================
// KASVILLAGE CANONICAL AVATAR SCHEMA - TypeScript (Expo)
// ============================================================================
// Version: 3
// Fields: 15 (alphabetically sorted for deterministic hashing)
// Thresholds: 9 traits = Buyer (Resident), 13 traits = Seller (Passport)
// ============================================================================

import * as Crypto from 'expo-crypto';

// ============================================================================
// SCHEMA VERSION
// ============================================================================
export const AVATAR_SCHEMA_VERSION = 3;

// ============================================================================
// CANONICAL FIELD ORDER (ALPHABETICAL)
// ============================================================================
// This order MUST match Rust. Both sides serialize in this exact order.
export const CANONICAL_AVATAR_FIELDS = [
  'animal',
  'class',
  'combatStyle',
  'definingMoment',
  'formativeMemory',
  'lifePhilosophy',
  'loreOrigin',
  'mutant',
  'mutate',
  'name',
  'occupation',
  'originStory',
  'personality',
  'powerSpike',
  'race',
  'signatureMove',
  'voiceLine',
  'weakness',
] as const;

// ============================================================================
// CITADEL THRESHOLDS
// ============================================================================
export const CITADEL_BUYER_THRESHOLD = 5;
export const CITADEL_SELLER_THRESHOLD = 6;

// Traits counted for buyer (first 9)
export const BUYER_TRAITS = [
  'class', 'race', 'occupation', 'mutant', 'animal', 
  'mutate', 'personality', 'combatStyle', 'signatureMove'
];

// Additional traits for seller (next 4)
export const SELLER_EXTRA_TRAITS = [
  'weakness', 'powerSpike', 'voiceLine', 'loreOrigin'
];

// Backstory traits (optional additional verification)
export const BACKSTORY_TRAITS = [
  'originStory', 'formativeMemory', 'lifePhilosophy', 'definingMoment'
];

// ============================================================================
// AVATAR INTERFACE
// ============================================================================
export interface CanonicalAvatar {
  animal: string;
  class: string;
  combatStyle: string;
  definingMoment: string;
  formativeMemory: string;
  lifePhilosophy: string;
  loreOrigin: string;
  mutant: string;
  mutate: string;
  name: string;
  occupation: string;
  originStory: string;
  personality: string;
  powerSpike: string;
  race: string;
  signatureMove: string;
  voiceLine: string;
  weakness: string;
}

// ============================================================================
// DEFAULT EMPTY AVATAR
// ============================================================================
export const createEmptyAvatar = (): CanonicalAvatar => ({
  animal: '',
  class: '',
  combatStyle: '',
  definingMoment: '',
  formativeMemory: '',
  lifePhilosophy: '',
  loreOrigin: '',
  mutant: '',
  mutate: '',
  name: '',
  occupation: '',
  originStory: '',
  personality: '',
  powerSpike: '',
  race: '',
  signatureMove: '',
  voiceLine: '',
  weakness: '',
});

// ============================================================================
// CANONICAL SERIALIZATION (Deterministic)
// ============================================================================
export const serializeAvatarCanonical = (avatar: Partial<CanonicalAvatar>): string => {
  // Always serialize in alphabetical field order
  const canonical: Record<string, string> = {};
  for (const field of CANONICAL_AVATAR_FIELDS) {
    canonical[field] = (avatar[field] || '').trim().toLowerCase();
  }
  // JSON.stringify with sorted keys
  return JSON.stringify(canonical, CANONICAL_AVATAR_FIELDS as unknown as string[]);
};

// ============================================================================
// IDENTITY HASH (SHA-256)
// ============================================================================
export const generateIdentityHash = async (
  avatar: Partial<CanonicalAvatar>,
  schemaVersion: number = AVATAR_SCHEMA_VERSION
): Promise<string> => {
  const serialized = serializeAvatarCanonical(avatar);
  const versionedData = `KV_AVATAR_V${schemaVersion}:${serialized}`;
  
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    versionedData
  );
  
  return hash;
};

// ============================================================================
// TRAIT COUNTING
// ============================================================================
export const countTraits = (avatar: Partial<CanonicalAvatar>): number => {
  let count = 0;
  for (const field of CANONICAL_AVATAR_FIELDS) {
    const value = avatar[field];
    if (value && value.trim().length >= 2) {
      count++;
    }
  }
  return count;
};

export const countBuyerTraits = (avatar: Partial<CanonicalAvatar>): number => {
  let count = 0;
  for (const field of BUYER_TRAITS) {
    const value = avatar[field as keyof CanonicalAvatar];
    if (value && value.trim().length >= 2) {
      count++;
    }
  }
  return count;
};

export const countSellerTraits = (avatar: Partial<CanonicalAvatar>): number => {
  return countBuyerTraits(avatar) + SELLER_EXTRA_TRAITS.filter(field => {
    const value = avatar[field as keyof CanonicalAvatar];
    return value && value.trim().length >= 2;
  }).length;
};

// ============================================================================
// CITADEL TIER
// ============================================================================
export type CitadelTier = 'Guest' | 'Resident' | 'Passport';

export const getCitadelTier = (avatar: Partial<CanonicalAvatar>): CitadelTier => {
  const traits = countSellerTraits(avatar);
  if (traits >= CITADEL_SELLER_THRESHOLD) return 'Passport';
  if (traits >= CITADEL_BUYER_THRESHOLD) return 'Resident';
  return 'Guest';
};

export const canBuy = (avatar: Partial<CanonicalAvatar>): boolean => {
  return countSellerTraits(avatar) >= CITADEL_BUYER_THRESHOLD;
};

export const canSell = (avatar: Partial<CanonicalAvatar>): boolean => {
  return countSellerTraits(avatar) >= CITADEL_SELLER_THRESHOLD;
};

// ============================================================================
// USER COMPLETION STATS (Bayesian)
// ============================================================================
export interface UserCompletionStats {
  successes: number;
  deadlocks: number;
  xp: number;
  totalSamples: number;
}

export const SNAIL_MODE_XP_THRESHOLD = 150;
export const SNAIL_MODE_P_COMPLETE_THRESHOLD = 0.5;
export const SNAIL_MODE_MIN_SAMPLES = 3;
export const SNAIL_MODE_BASE_DELAY_MS = 60000;
export const SNAIL_MODE_MAX_DELAY_MS = 600000;
export const SNAIL_MODE_DELAY_PER_DEADLOCK = 60000;
export const DEFAULT_STARTING_XP = 150;

export const createNewUserStats = (): UserCompletionStats => ({
  successes: 0,
  deadlocks: 0,
  xp: DEFAULT_STARTING_XP,
  totalSamples: 0,
});

// Bayesian: p_complete = (1 + S) / (2 + S + F)
export const pComplete = (stats: UserCompletionStats): number => {
  const alpha = 1 + stats.successes;
  const beta = 1 + stats.deadlocks;
  return alpha / (alpha + beta);
};

export const confidence = (stats: UserCompletionStats): number => {
  return Math.min(stats.totalSamples / 10, 1.0);
};

export const isNewUser = (stats: UserCompletionStats): boolean => {
  return stats.totalSamples < SNAIL_MODE_MIN_SAMPLES;
};

export const shouldSnailMode = (stats: UserCompletionStats): boolean => {
  if (isNewUser(stats)) return false;
  if (stats.xp < SNAIL_MODE_XP_THRESHOLD) return true;
  if (pComplete(stats) < SNAIL_MODE_P_COMPLETE_THRESHOLD) return true;
  return false;
};

export const creationDelayMs = (stats: UserCompletionStats): number => {
  if (!shouldSnailMode(stats)) return 0;
  const delay = SNAIL_MODE_BASE_DELAY_MS + (stats.deadlocks * SNAIL_MODE_DELAY_PER_DEADLOCK);
  return Math.min(delay, SNAIL_MODE_MAX_DELAY_MS);
};

export type RiskRating = 'Highly Trusted' | 'Reliable' | 'Medium Risk' | 'High Risk';

export const riskRating = (stats: UserCompletionStats): RiskRating => {
  const p = pComplete(stats);
  const conf = confidence(stats);
  if (p > 0.9 && conf > 0.5) return 'Highly Trusted';
  if (p > 0.75) return 'Reliable';
  if (p < 0.4) return 'High Risk';
  return 'Medium Risk';
};

export const trustBadge = (stats: UserCompletionStats): { icon: string; text: string } => {
  const rating = riskRating(stats);
  switch (rating) {
    case 'Highly Trusted': return { icon: '✓✓', text: 'Highly Trusted' };
    case 'Reliable': return { icon: '✓', text: 'Reliable' };
    case 'High Risk': return { icon: '⚠', text: 'High Risk' };
    default: return { icon: '~', text: 'Medium Risk' };
  }
};

// ============================================================================
// SNAIL POISON STATUS
// ============================================================================
export interface SnailModeStatus {
  active: boolean;
  reason: string;
  xp: number;
  pComplete: number;
  deadlocks: number;
  creationDelayMs: number;
  isNewUser: boolean;
  riskRating: RiskRating;
  message: string | null;
}

export const getSnailModeStatus = (stats: UserCompletionStats): SnailModeStatus => {
  const active = shouldSnailMode(stats);
  const p = pComplete(stats);
  
  let reason: string;
  if (!active) {
    reason = 'Good standing';
  } else if (stats.xp < SNAIL_MODE_XP_THRESHOLD) {
    reason = `Low XP (${stats.xp} < ${SNAIL_MODE_XP_THRESHOLD})`;
  } else {
    reason = `Low completion rate (${(p * 100).toFixed(0)}% < 50%)`;
  }
  
  const delay = creationDelayMs(stats);
  const message = active
    ? `⏳ App slow due to low trust score. ~${delay / 1000}s delay on new agreements.`
    : null;
  
  return {
    active,
    reason,
    xp: stats.xp,
    pComplete: p,
    deadlocks: stats.deadlocks,
    creationDelayMs: delay,
    isNewUser: isNewUser(stats),
    riskRating: riskRating(stats),
    message,
  };
};

// ============================================================================
// XP SLASHING
// ============================================================================
export type XpSlashReason =
  | 'NeighborDeadlock'
  | 'TookMoreThanPosted'
  | 'BadDappCreation'
  | 'DiscountNotHonored'
  | 'BadAcademicContent'
  | 'DeceptivePricing'
  | 'AdminAction';

export const XP_SLASH_PENALTIES: Record<XpSlashReason, number> = {
  NeighborDeadlock: 50,
  TookMoreThanPosted: 75,
  BadDappCreation: 100,
  DiscountNotHonored: 50,
  BadAcademicContent: 50,
  DeceptivePricing: 100,
  AdminAction: 0,
};

export const slashXp = (
  stats: UserCompletionStats,
  reason: XpSlashReason,
  customAmount?: number
): UserCompletionStats => {
  const penalty = customAmount ?? XP_SLASH_PENALTIES[reason];
  return {
    ...stats,
    xp: Math.max(0, stats.xp - penalty),
  };
};

// ============================================================================
// REPUTATION TIERS
// ============================================================================
export type XPTier = 'Base' | 'Verified' | 'Custodian' | 'Sentinel' | 'Archon';

export const getXPTier = (xp: number): XPTier => {
  if (xp >= 2000) return 'Archon';
  if (xp >= 1000) return 'Sentinel';
  if (xp >= 500) return 'Custodian';
  if (xp >= 200) return 'Verified';
  return 'Base';
};

export const XP_TIER_COLORS: Record<XPTier, string> = {
  Base: '#9CA3AF',
  Verified: '#60A5FA',
  Custodian: '#34D399',
  Sentinel: '#A78BFA',
  Archon: '#FBBF24',
};
