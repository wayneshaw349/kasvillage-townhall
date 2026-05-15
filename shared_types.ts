// ============================================================================
// KASVILLAGE SHARED API TYPES - Expo ↔ Town Hall Contract
// ============================================================================
// Version: 1.0.0
// Usage: Copy to both Expo app (TypeScript) and generate .rs via build script
// ============================================================================

// ============================================================================
// CONSTANTS (must match Rust)
// ============================================================================

export const AVATAR_SCHEMA_VERSION = 3;
export const TRAITS_TO_BUY = 8;
export const TRAITS_TO_SELL = 12;
export const SOMPI_PER_KAS = 100_000_000n;

export const CANONICAL_AVATAR_FIELDS = [
  'animal', 'class', 'combatStyle', 'definingMoment', 'formativeMemory',
  'lifePhilosophy', 'loreOrigin', 'mutant', 'mutate', 'name',
  'occupation', 'originStory', 'personality', 'powerSpike', 'race',
  'signatureMove', 'voiceLine', 'weakness',
] as const;

export const BUYER_TRAITS = [
  'class', 'race', 'occupation', 'mutant', 'animal',
  'mutate', 'personality', 'combatStyle', 'signatureMove',
] as const;

export const SELLER_EXTRA_TRAITS = [
  'weakness', 'powerSpike', 'voiceLine', 'loreOrigin',
] as const;

export const BACKSTORY_TRAITS = [
  'originStory', 'formativeMemory', 'lifePhilosophy', 'definingMoment',
] as const;

// ============================================================================
// BASE TYPES
// ============================================================================

export type RiskRating = 'HighlyTrusted' | 'Reliable' | 'MediumRisk' | 'HighRisk';
export type XPTier = 'Base' | 'Verified' | 'Custodian' | 'Sentinel' | 'Archon';
export type EntityType = 'Store' | 'DApp' | 'Service' | 'Academic' | 'Game' | 'User';

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
// USER STATS
// ============================================================================

export interface UserStats {
  xp: number;
  successes: number;
  deadlocks: number;
  totalSamples: number;
}

export interface SnailModeStatus {
  active: boolean;
  reason: string;
  xp: number;
  pComplete: number;
  deadlocks: number;
  creationDelayMs: number;
  isNewUser: boolean;
  riskRating: RiskRating;
  message?: string;
}

// ============================================================================
// APT REGISTRATION
// ============================================================================

export interface AptRegisterRequest {
  publicKey: string;           // Hex-encoded secp256k1 pubkey
  avatarHash: string;          // SHA256 of canonical avatar JSON
  traitCount: number;          // Number of filled traits (9-18)
  deviceAttestation?: string;  // iOS/Android attestation token
  timestamp: number;           // Unix ms
  signature: string;           // Signed: `${timestamp}:${publicKey}:${avatarHash}`
}

export interface AptRegisterResponse {
  success: boolean;
  aptAlias?: string;           // e.g. "APT-042"
  kaspaAddress?: string;       // Derived address
  arweaveTx?: string;          // Proof posted to Arweave
  kaspaTxId?: string;          // L1 inscription tx
  error?: string;
}

export interface AptConflictRequest {
  publicKey: string;
  avatarHash: string;
}

export interface AptConflictResponse {
  conflict: boolean;
  existingApt?: string;
  reason?: string;
}

// ============================================================================
// USER VERIFICATION
// ============================================================================

export interface UserVerifyRequest {
  aptAlias: string;
  includeStats?: boolean;
  includeSnailMode?: boolean;
}

export interface UserVerifyResponse {
  verified: boolean;
  aptAlias: string;
  traitCount: number;
  canBuy: boolean;              // traitCount >= 9
  canSell: boolean;             // traitCount >= 13
  stats?: UserStats;
  snailMode?: SnailModeStatus;
  xpTier?: XPTier;
  arweaveProof?: string;
  kaspaInscription?: string;
  error?: string;
}

// ============================================================================
// IDENTITY ANCHOR (L1 + Arweave dual-write)
// ============================================================================

export interface IdentityAnchorRequest {
  aptAlias: string;
  publicKey: string;
  avatarHash: string;
  traitCount: number;
  backstoryHash?: string;       // SHA256 of backstory fields
  timestamp: number;
  signature: string;
}

export interface IdentityAnchorResponse {
  success: boolean;
  kaspaTxId?: string;           // KV2U inscription
  arweaveTxId?: string;         // Permanent storage
  merkleRoot?: string;          // Current tree root
  error?: string;
}

export interface IdentityVerifyRequest {
  aptAlias: string;
  publicKey?: string;           // Optional: verify pubkey matches
}

export interface IdentityVerifyResponse {
  verified: boolean;
  aptAlias: string;
  publicKeyMatch?: boolean;
  kaspaTxId?: string;
  arweaveTxId?: string;
  timestamp?: number;
  error?: string;
}

// ============================================================================
// DEVICE RECOVERY (13 traits + backstory)
// ============================================================================

export interface DeviceRecoveryRequest {
  avatar: CanonicalAvatar;      // Full 18-field avatar
  newPublicKey: string;         // New device pubkey
  deviceAttestation?: string;
  timestamp: number;
  // No signature - recovering means lost keys
}

export interface DeviceRecoveryResponse {
  success: boolean;
  aptAlias?: string;
  matched: boolean;
  matchedFields?: string[];     // Which fields matched
  requiredFields?: string[];    // Missing required fields
  newKaspaTxId?: string;
  newArweaveTxId?: string;
  error?: string;
}

// ============================================================================
// STORE VERIFICATION
// ============================================================================

export interface StoreVerifyRequest {
  storeId: string;
  ownerApt: string;
  name: string;
  description?: string;
  imageHashes?: string[];       // SHA256 of images
  pledgeKas: number;            // Collateral in KAS
}

export interface CodeScanResult {
  passed: boolean;
  criticalMatches: string[];
  warningMatches: string[];
  safeUrls: string[];
  blockedUrls: string[];
}

export interface StoreVerifyResponse {
  storeId: string;
  ownerApt: string;
  verified: boolean;
  codeScan?: CodeScanResult;
  visibilityScore: number;
  arweaveTx?: string;
  timestamp: number;
  error?: string;
}

// ============================================================================
// DAPP VERIFICATION
// ============================================================================

export interface DAppVerifyRequest {
  dappId: string;
  ownerApt: string;
  dappType: string;             // 'game' | 'tool' | 'service'
  code: string;                 // Full source code
  pledgeKas: number;
}

export interface DAppVerifyResponse {
  dappId: string;
  ownerApt: string;
  dappType: string;
  codeScan: CodeScanResult;
  contentHash: string;
  pledgeKas: number;
  runwayDays: number;
  visibilityScore: number;
  verified: boolean;
  arweaveTx?: string;
  timestamp: number;
  error?: string;
}

// ============================================================================
// GAME VERIFICATION (stricter than DApp)
// ============================================================================

export interface GameVerifyRequest {
  gameId: string;
  ownerApt: string;
  code: string;
  pledgeKas: number;
}

export interface GameVerifyResponse {
  gameId: string;
  ownerApt: string;
  codeScan: CodeScanResult;
  contentHash: string;
  pledgeKas: number;
  runwayDays: number;
  visibilityScore: number;
  verified: boolean;            // Games default to false (manual review)
  arweaveTx?: string;
  timestamp: number;
  error?: string;
}

// ============================================================================
// ACADEMIC VERIFICATION (DKIM)
// ============================================================================

export interface AcademicVerifyRequest {
  ownerApt: string;
  emailHeaders: string;         // Raw email headers
  dkimSignature: string;        // DKIM-Signature header value
  abstractText?: string;        // Paper abstract for hashing
}

export interface AcademicVerifyResponse {
  profileId: string;
  ownerApt: string;
  domainType: string;           // 'edu' | 'gov' | 'research' | 'corporate'
  dkimVerified: boolean;
  abstractHash?: string;
  credentials: string[];
  verified: boolean;
  arweaveTx?: string;
  timestamp: number;
  error?: string;
}

// ============================================================================
// SERVICE VERIFICATION
// ============================================================================

export interface ServiceVerifyRequest {
  serviceId: string;
  ownerApt: string;
  serviceType: string;
  code: string;
  reviews: string[];
}

export interface ReviewsSummary {
  totalReviews: number;
  positive: number;
  negative: number;
  authenticityScore: number;
}

export interface ServiceVerifyResponse {
  serviceId: string;
  ownerApt: string;
  serviceType: string;
  codeScan: CodeScanResult;
  reviewsSummary: ReviewsSummary;
  verified: boolean;
  arweaveTx?: string;
  timestamp: number;
  error?: string;
}

// ============================================================================
// REVIEW VERIFICATION
// ============================================================================

export interface ReviewVerifyRequest {
  reviewText: string;
  reviewerApt: string;
  targetId: string;
  targetType: EntityType;
}

export interface SentimentResult {
  positive: boolean;
  confidence: number;
  flags: string[];
}

export interface AuthenticityCheck {
  isAuthentic: boolean;
  reasons: string[];
  riskScore: number;
}

export interface ReviewVerifyResponse {
  reviewId: string;
  reviewerApt: string;
  targetId: string;
  targetType: EntityType;
  sentiment: SentimentResult;
  authenticity: AuthenticityCheck;
  verified: boolean;
  timestamp: number;
  error?: string;
}

// ============================================================================
// CODE SIGNATURE VERIFICATION (App/eBook integrity)
// ============================================================================

export interface CodeSignatureRegisterRequest {
  entityId: string;
  entityType: EntityType;
  ownerApt: string;
  contentHash: string;          // SHA256 of content
  signature: string;            // Owner signature
  timestamp: number;
}

export interface CodeSignatureRegisterResponse {
  success: boolean;
  anchorId?: string;
  kaspaTxId?: string;
  arweaveTxId?: string;
  error?: string;
}

export interface CodeSignatureVerifyRequest {
  entityId: string;
  contentHash: string;
}

export interface CodeSignatureVerifyResponse {
  verified: boolean;
  entityId: string;
  ownerApt?: string;
  registeredHash?: string;
  hashMatch: boolean;
  kaspaTxId?: string;
  arweaveTxId?: string;
  timestamp?: number;
  error?: string;
}

// ============================================================================
// PROOFS QUERY
// ============================================================================

export interface ProofsQueryRequest {
  aptAlias?: string;
  entityId?: string;
  entityType?: EntityType;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
}

export interface ProofRecord {
  proofId: string;
  aptAlias: string;
  entityId?: string;
  entityType?: EntityType;
  proofType: string;
  kaspaTxId?: string;
  arweaveTxId?: string;
  merkleRoot?: string;
  timestamp: number;
}

export interface ProofsQueryResponse {
  proofs: ProofRecord[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// GLOBAL STATS
// ============================================================================

export interface GlobalStats {
  totalUsers: number;
  totalStores: number;
  totalDapps: number;
  totalAcademics: number;
  totalServices: number;
  totalVolume24h: number;
  completedAgreements24h: number;
  deadlocks24h: number;
}

export interface CirculationStats {
  totalVolume24h: number;
  completed24h: number;
  deadlocked24h: number;
  avgAgreementSize: number;
  largestAgreement24h: number;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  halo2K?: number;
  treeDepth?: number;
  uptime?: number;
}

// ============================================================================
// API ENDPOINTS (for reference)
// ============================================================================

export const TOWN_HALL_ENDPOINTS = {
  // Health
  HEALTH: '/health',
  
  // APT Management
  APT_REGISTER: '/api/apt/register',
  APT_CONFLICT: '/api/apt/conflict',
  
  // Identity
  IDENTITY_ANCHOR: '/api/identity/anchor',
  IDENTITY_VERIFY: '/api/identity/verify',
  DEVICE_RECOVER: '/api/device/recover',
  
  // Verification
  VERIFY_USER: '/api/verify/user/full',
  VERIFY_STORE: '/api/verify/store',
  VERIFY_DAPP: '/api/verify/dapp',
  VERIFY_GAME: '/api/verify/game',
  VERIFY_ACADEMIC: '/api/verify/academic',
  VERIFY_SERVICE: '/api/verify/service',
  VERIFY_REVIEW: '/api/verify/review',
  
  // Code/App integrity
  CODE_REGISTER: '/api/code/register',
  CODE_VERIFY: '/api/code/verify',
  APP_ANCHOR: '/api/app/anchor',
  APP_VERIFY: '/api/app/verify',
  
  // Proofs & Stats
  PROOFS_QUERY: '/api/proofs/query',
  STATS_GLOBAL: '/api/stats/global',
  STATS_CIRCULATION: '/api/stats/circulation',
  
  // Code scanning
  SCAN: '/api/scan',
  SCAN_GAME: '/api/scan/game',
} as const;

// ============================================================================
// HELPER: Canonical Avatar Hash
// ============================================================================

export function serializeCanonicalAvatar(avatar: CanonicalAvatar): string {
  const fields = CANONICAL_AVATAR_FIELDS.map(field => {
    const value = avatar[field as keyof CanonicalAvatar] || '';
    return `"${field}":"${value.toLowerCase()}"`;
  });
  return `{${fields.join(',')}}`;
}

export async function hashCanonicalAvatar(avatar: CanonicalAvatar): Promise<string> {
  const canonical = serializeCanonicalAvatar(avatar);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// HELPER: Trait counting
// ============================================================================

export function countTraits(avatar: CanonicalAvatar): number {
  let count = 0;
  for (const field of CANONICAL_AVATAR_FIELDS) {
    const value = avatar[field as keyof CanonicalAvatar];
    if (value && value.trim().length > 0) {
      count++;
    }
  }
  return count;
}

export function canBuy(avatar: CanonicalAvatar): boolean {
  return countTraits(avatar) >= TRAITS_TO_BUY;
}

export function canSell(avatar: CanonicalAvatar): boolean {
  return countTraits(avatar) >= TRAITS_TO_SELL;
}

// ============================================================================
// HELPER: XP Tier calculation
// ============================================================================

export function getXPTier(xp: number): XPTier {
  if (xp >= 2000) return 'Archon';
  if (xp >= 1000) return 'Sentinel';
  if (xp >= 500) return 'Custodian';
  if (xp >= 200) return 'Verified';
  return 'Base';
}

export function getXPTierColor(tier: XPTier): string {
  const colors: Record<XPTier, string> = {
    Base: '#9CA3AF',
    Verified: '#60A5FA',
    Custodian: '#34D399',
    Sentinel: '#A78BFA',
    Archon: '#FBBF24',
  };
  return colors[tier];
}
