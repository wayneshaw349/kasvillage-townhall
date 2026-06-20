// counterparty_lookup.ts
// Client for counterparty stats lookup in Neighbor Agreements
// Queries TownHall (stateless, Arweave-backed)

import * as SecureStore from 'expo-secure-store';
import { bytesToHex } from '@noble/hashes/utils';

// CONSTANTS
const TOWNHALL_API = 'https://kasvillage.app.runonflux.io';
const LOOKUP_TIMEOUT_MS = 10000;

// TYPES
export type RiskRating = 'highly_trusted' | 'reliable' | 'medium_risk' | 'high_risk' | 'unknown';
export type CitadelTier = 'guest' | 'resident' | 'passport';
export type AgreementOutcome = 'success' | 'deadlock' | 'refund' | 'pending';

export interface CounterpartyStats {
  pubkey: string;
  aptAlias?: string;
  citadelTier: CitadelTier;
  xp: number;
  successes: number;
  deadlocks: number;
  totalSamples: number;
  pComplete: number;
  confidence: number;
  riskRating: RiskRating;
  isNewUser: boolean;
  inSnailMode: boolean;
  creationDelayMs: number;
  neighborAgreements: NeighborAgreementStats;
  deadlockHistory: DeadlockStats;
  firstSeenMs?: number;
  lastActivityMs?: number;
  arweaveTx?: string;
  lastUpdatedMs: number;
}

export interface NeighborAgreementStats {
  totalAgreements: number;
  asBuyer: number;
  asSeller: number;
  completed: number;
  refunded: number;
  deadlocked: number;
  pending: number;
  totalVolumeSompi: number;
  avgAgreementSompi: number;
  largestAgreementSompi: number;
  avgCompletionTimeMs: number;
  fastestCompletionMs: number;
  agreementsLast30d: number;
  agreementsLast7d: number;
  avgCompletionDaa?: number;
  fastestCompletionDaa?: number;
  currentDaaScore?: number;
}

export interface DeadlockStats {
  totalDeadlocks: number;
  asBuyer: number;
  asSeller: number;
  reasonNoDelivery: number;
  reasonQualityDispute: number;
  reasonTimeout: number;
  reasonOther: number;
  resolvedAfterDeadlock: number;
  lastDeadlockMs?: number;
  daysSinceLastDeadlock?: number;
  lastDeadlockDaa?: number;
  daaSinceLastDeadlock?: number;
  uniqueCounterpartiesDeadlocked: number;
  repeatDeadlockSameCounterparty: number;
}

export interface RecentAgreement {
  agreementId: string;
  timestampMs: number;
  outcome: AgreementOutcome;
  amountKas: number;
  role: 'buyer' | 'seller';
}

export interface StatsProof {
  proofBytes: string;
  publicInputs: StatsPublicInputs;
  proofType: string;
  generatedAt: number;
}

export interface StatsPublicInputs {
  pubkeyHash: string;
  successes: number;
  deadlocks: number;
  xp: number;
  pCompleteFixed: number;
  l1EventsRoot: string;
  arweaveStatsHash: string;
}

export interface CounterpartyLookupResult {
  found: boolean;
  stats: CounterpartyStats;
  proof?: StatsProof;
  recentAgreements?: RecentAgreement[];
  error?: string;
}

// CONSTANTS FOR LOCAL COMPUTATION
const SNAIL_MODE_XP_THRESHOLD = 150;
const SNAIL_MODE_P_COMPLETE_THRESHOLD = 0.5;
const SNAIL_MODE_MIN_SAMPLES = 3;
const SNAIL_MODE_BASE_DELAY_MS = 180_000;
const SNAIL_MODE_DELAY_PER_DEADLOCK = 30_000;
const SNAIL_MODE_MAX_DELAY_MS = 240_000;

const XP_INCUBATOR = 500;
const XP_ELITE = 5000;

// BAYESIAN COMPUTATION
export function computePComplete(successes: number, deadlocks: number): number {
  const alpha = 1.0 + successes;
  const beta = 1.0 + deadlocks;
  return alpha / (alpha + beta);
}

const RECENCY_ACTIVE_BONUS = 0.1;
const RECENCY_STALE_PENALTY = 0.8;
const REPEAT_DEADLOCK_PENALTY = 0.7;
const RESOLUTION_BONUS_MAX = 0.2;
const SPEED_BONUS = 1.1;
const SPEED_PENALTY = 0.95;
const ROLE_BALANCE_MIN = 0.9;

const DAA_PER_HOUR = 3600;
const DAA_PER_DAY = 86400;
const SPEED_FAST_DAA = DAA_PER_HOUR;
const SPEED_SLOW_DAA = DAA_PER_DAY;

export interface EnhancedPCompleteFactors {
  baseP: number;
  recencyFactor: number;
  volumeConfidence: number;
  patternPenalty: number;
  resolutionBonus: number;
  speedFactor: number;
  roleBalance: number;
  adjustedP: number;
  finalP: number;
}

export function computeEnhancedPComplete(stats: CounterpartyStats): EnhancedPCompleteFactors {
  const s = stats.successes;
  const f = stats.deadlocks;
  const n = s + f;
  
  if (n === 0) {
    return {
      baseP: 0.5,
      recencyFactor: 1.0,
      volumeConfidence: 0,
      patternPenalty: 1.0,
      resolutionBonus: 1.0,
      speedFactor: 1.0,
      roleBalance: 1.0,
      adjustedP: 0.5,
      finalP: 0.5,
    };
  }
  
  const baseP = (1 + s) / (2 + n);
  
  let recencyFactor = 1.0;
  if (stats.neighborAgreements.agreementsLast7d > 0) {
    recencyFactor = 1.0 + Math.min(stats.neighborAgreements.agreementsLast7d, 5) * RECENCY_ACTIVE_BONUS;
  } else if (stats.neighborAgreements.agreementsLast30d > 0) {
    recencyFactor = 1.0;
  } else {
    recencyFactor = RECENCY_STALE_PENALTY;
  }
  
  const volumeConfidence = Math.min(n / 20, 1.0);
  
  let patternPenalty = 1.0;
  if (stats.deadlockHistory.repeatDeadlockSameCounterparty > 0) {
    patternPenalty *= Math.pow(REPEAT_DEADLOCK_PENALTY, 
      Math.min(stats.deadlockHistory.repeatDeadlockSameCounterparty, 5));
  }
  
  let resolutionBonus = 1.0;
  if (stats.deadlockHistory.resolvedAfterDeadlock > 0 && f > 0) {
    const resolutionRate = stats.deadlockHistory.resolvedAfterDeadlock / f;
    resolutionBonus = 1.0 + resolutionRate * RESOLUTION_BONUS_MAX;
  }
  
  let speedFactor = 1.0;
  if (s > 0 && stats.neighborAgreements.fastestCompletionDaa) {
    const avgDaa = stats.neighborAgreements.avgCompletionDaa || 
                   (stats.neighborAgreements.avgCompletionTimeMs / 1000);
    if (avgDaa < SPEED_FAST_DAA) { speedFactor = SPEED_BONUS; }
    else if (avgDaa >= SPEED_SLOW_DAA) { speedFactor = SPEED_PENALTY; }
  } else if (s > 0 && stats.neighborAgreements.fastestCompletionMs > 0) {
    const avgMs = stats.neighborAgreements.avgCompletionTimeMs;
    if (avgMs < 3600_000) { speedFactor = SPEED_BONUS; }
    else if (avgMs >= 86400_000) { speedFactor = SPEED_PENALTY; }
  }
  
  let roleBalance = 1.0;
  if (stats.neighborAgreements.totalAgreements > 5) {
    const buyerRatio = stats.neighborAgreements.asBuyer / stats.neighborAgreements.totalAgreements;
    const balance = 1.0 - Math.abs(buyerRatio - 0.5) * 2;
    roleBalance = ROLE_BALANCE_MIN + (1.0 - ROLE_BALANCE_MIN) * balance;
  }
  
  const adjustedP = baseP * recencyFactor * patternPenalty * resolutionBonus * speedFactor * roleBalance;
  
  const prior = 0.5;
  const finalP = Math.max(0.01, Math.min(0.99, 
    volumeConfidence * adjustedP + (1 - volumeConfidence) * prior));
  
  return {
    baseP,
    recencyFactor,
    volumeConfidence,
    patternPenalty,
    resolutionBonus,
    speedFactor,
    roleBalance,
    adjustedP,
    finalP,
  };
}

export function computeEnhancedRiskRating(stats: CounterpartyStats): RiskRating {
  const factors = computeEnhancedPComplete(stats);
  const p = factors.finalP;
  const conf = factors.volumeConfidence;
  
  if (hasConcerningDeadlockPattern(stats.deadlockHistory)) {
    return 'high_risk';
  }
  
  if (p > 0.85 && conf > 0.5) return 'highly_trusted';
  if (p > 0.7) return 'reliable';
  if (p < 0.35) return 'high_risk';
  return 'medium_risk';
}

export function formatEnhancedPComplete(factors: EnhancedPCompleteFactors): string {
  const pct = (factors.finalP * 100).toFixed(1);
  const parts: string[] = [`${pct}%`];
  
  if (factors.recencyFactor !== 1.0) {
    parts.push(factors.recencyFactor > 1 ? '📈 active' : '📉 stale');
  }
  if (factors.patternPenalty < 1.0) {
    parts.push('⚠️ pattern');
  }
  if (factors.resolutionBonus > 1.0) {
    parts.push('🔄 recovered');
  }
  if (factors.speedFactor !== 1.0) {
    parts.push(factors.speedFactor > 1 ? '⚡ fast' : '🐢 slow');
  }
  
  return parts.join(' ');
}

export function computeConfidence(totalSamples: number): number {
  return Math.min(totalSamples / 10.0, 1.0);
}

export function computeRiskRating(pComplete: number, confidence: number): RiskRating {
  if (pComplete > 0.9 && confidence > 0.5) return 'highly_trusted';
  if (pComplete > 0.75) return 'reliable';
  if (pComplete < 0.4) return 'high_risk';
  return 'medium_risk';
}

export function computeCitadelTier(xp: number): CitadelTier {
  if (xp >= XP_ELITE) return 'passport';
  if (xp >= XP_INCUBATOR) return 'resident';
  return 'guest';
}

export function shouldSnailMode(
  xp: number,
  pComplete: number,
  totalSamples: number
): boolean {
  if (totalSamples < SNAIL_MODE_MIN_SAMPLES) return false;
  if (xp < SNAIL_MODE_XP_THRESHOLD) return true;
  if (pComplete < SNAIL_MODE_P_COMPLETE_THRESHOLD) return true;
  return false;
}

export function computeSnailDelay(deadlocks: number, inSnailMode: boolean): number {
  if (!inSnailMode) return 0;
  return Math.min(
    SNAIL_MODE_BASE_DELAY_MS + deadlocks * SNAIL_MODE_DELAY_PER_DEADLOCK,
    SNAIL_MODE_MAX_DELAY_MS
  );
}

// DEFAULT FACTORIES
export function defaultNeighborAgreementStats(): NeighborAgreementStats {
  return {
    totalAgreements: 0,
    asBuyer: 0,
    asSeller: 0,
    completed: 0,
    refunded: 0,
    deadlocked: 0,
    pending: 0,
    totalVolumeSompi: 0,
    avgAgreementSompi: 0,
    largestAgreementSompi: 0,
    avgCompletionTimeMs: 0,
    fastestCompletionMs: 0,
    agreementsLast30d: 0,
    agreementsLast7d: 0,
  };
}

export function defaultDeadlockStats(): DeadlockStats {
  return {
    totalDeadlocks: 0,
    asBuyer: 0,
    asSeller: 0,
    reasonNoDelivery: 0,
    reasonQualityDispute: 0,
    reasonTimeout: 0,
    reasonOther: 0,
    resolvedAfterDeadlock: 0,
    uniqueCounterpartiesDeadlocked: 0,
    repeatDeadlockSameCounterparty: 0,
  };
}

// LOCAL STATS COMPUTATION
export function computeStats(
  pubkey: string,
  xp: number,
  successes: number,
  deadlocks: number,
  aptAlias?: string,
  firstSeenMs?: number,
  lastActivityMs?: number,
  arweaveTx?: string,
  neighborAgreements?: NeighborAgreementStats,
  deadlockHistory?: DeadlockStats,
): CounterpartyStats {
  const totalSamples = successes + deadlocks;
  const pComplete = computePComplete(successes, deadlocks);
  const confidence = computeConfidence(totalSamples);
  const riskRating = computeRiskRating(pComplete, confidence);
  const citadelTier = computeCitadelTier(xp);
  const isNewUser = totalSamples < SNAIL_MODE_MIN_SAMPLES;
  const inSnailMode = shouldSnailMode(xp, pComplete, totalSamples);
  const creationDelayMs = computeSnailDelay(deadlocks, inSnailMode);
  
  return {
    pubkey,
    aptAlias,
    citadelTier,
    xp,
    successes,
    deadlocks,
    totalSamples,
    pComplete,
    confidence,
    riskRating,
    isNewUser,
    inSnailMode,
    creationDelayMs,
    neighborAgreements: neighborAgreements ?? defaultNeighborAgreementStats(),
    deadlockHistory: deadlockHistory ?? defaultDeadlockStats(),
    firstSeenMs,
    lastActivityMs,
    arweaveTx,
    lastUpdatedMs: Date.now(),
  };
}

export function unknownStats(pubkey: string): CounterpartyStats {
  return {
    pubkey,
    citadelTier: 'guest',
    xp: 150,
    successes: 0,
    deadlocks: 0,
    totalSamples: 0,
    pComplete: 0.5,
    confidence: 0,
    riskRating: 'unknown',
    isNewUser: true,
    inSnailMode: false,
    creationDelayMs: 0,
    neighborAgreements: defaultNeighborAgreementStats(),
    deadlockHistory: defaultDeadlockStats(),
    lastUpdatedMs: Date.now(),
  };
}

// TOWNHALL API CLIENT
export async function lookupCounterparty(
  pubkey: string,
  options: {
    includeHistory?: boolean;
    includeProof?: boolean;
  } = {},
): Promise<CounterpartyLookupResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    
    const endpoint = options.includeProof ? 'proof' : '';
    const params = new URLSearchParams();
    if (options.includeHistory) params.set('include_history', 'true');
    if (options.includeProof) params.set('include_proof', 'true');
    
    const url = `${TOWNHALL_API}/user-stats`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      found: !!(data.successes !== undefined || data.xp !== undefined),
      stats: (data.successes !== undefined) ? computeStats(pubkey, data.xp || 0, data.successes || 0, data.deadlocks || 0) : unknownStats(pubkey),
      proof: data.proof ? convertProof(data.proof) : undefined,
      recentAgreements: data.recent_agreements?.map(convertAgreement),
      error: data.error,
    };
  } catch (e) {
    console.warn('[Counterparty] Lookup failed, using unknown stats:', e);
    return {
      found: false,
      stats: unknownStats(pubkey),
      error: e instanceof Error ? e.message : 'Lookup failed',
    };
  }
}

export async function lookupCounterpartyWithProof(
  pubkey: string,
): Promise<CounterpartyLookupResult> {
  return lookupCounterparty(pubkey, { includeProof: true });
}

export async function lookupCounterpartyBatch(
  pubkeys: string[],
): Promise<{ stats: CounterpartyStats[]; notFound: string[] }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS * 2);
    
    const response = await fetch(`${TOWNHALL_API}/api/counterparty/batch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ pubkeys }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      stats: data.stats.map(convertStats),
      notFound: data.not_found || [],
    };
  } catch (e) {
    console.warn('[Counterparty] Batch lookup failed:', e);
    return {
      stats: pubkeys.map(unknownStats),
      notFound: pubkeys,
    };
  }
}

// LOCAL CACHE (SecureStore)
const CACHE_PREFIX = 'kv_counterparty_';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedStats {
  stats: CounterpartyStats;
  cachedAt: number;
}

export async function getCachedStats(pubkey: string): Promise<CounterpartyStats | null> {
  try {
    const cached = await SecureStore.getItemAsync(CACHE_PREFIX + pubkey.slice(0, 16));
    if (!cached) return null;
    
    const parsed: CachedStats = JSON.parse(cached);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    
    return parsed.stats;
  } catch {
    return null;
  }
}

export async function cacheStats(stats: CounterpartyStats): Promise<void> {
  try {
    const cached: CachedStats = { stats, cachedAt: Date.now() };
    await SecureStore.setItemAsync(
      CACHE_PREFIX + stats.pubkey.slice(0, 16),
      JSON.stringify(cached)
    );
  } catch {
    // Ignore cache errors
  }
}

export async function lookupCounterpartyCached(
  pubkey: string,
  options: { includeHistory?: boolean } = {},
): Promise<CounterpartyLookupResult> {
  const cached = await getCachedStats(pubkey);
  if (cached && !options.includeHistory) {
    return { found: true, stats: cached };
  }
  
  const result = await lookupCounterparty(pubkey, options);
  
  if (result.found) {
    await cacheStats(result.stats);
  }
  
  return result;
}

// HELPERS
function convertStats(raw: any): CounterpartyStats {
  return {
    pubkey: raw.pubkey,
    aptAlias: raw.apt_alias,
    citadelTier: raw.citadel_tier,
    xp: raw.xp,
    successes: raw.successes,
    deadlocks: raw.deadlocks,
    totalSamples: raw.total_samples,
    pComplete: raw.p_complete,
    confidence: raw.confidence,
    riskRating: raw.risk_rating,
    isNewUser: raw.is_new_user,
    inSnailMode: raw.in_snail_mode,
    creationDelayMs: raw.creation_delay_ms,
    neighborAgreements: convertNeighborAgreementStats(raw.neighbor_agreements),
    deadlockHistory: convertDeadlockStats(raw.deadlock_history),
    firstSeenMs: raw.first_seen_ms,
    lastActivityMs: raw.last_activity_ms,
    arweaveTx: raw.arweave_tx,
    lastUpdatedMs: raw.last_updated_ms,
  };
}

function convertNeighborAgreementStats(raw: any): NeighborAgreementStats {
  if (!raw) return defaultNeighborAgreementStats();
  return {
    totalAgreements: raw.total_agreements ?? 0,
    asBuyer: raw.as_buyer ?? 0,
    asSeller: raw.as_seller ?? 0,
    completed: raw.completed ?? 0,
    refunded: raw.refunded ?? 0,
    deadlocked: raw.deadlocked ?? 0,
    pending: raw.pending ?? 0,
    totalVolumeSompi: raw.total_volume_sompi ?? 0,
    avgAgreementSompi: raw.avg_agreement_sompi ?? 0,
    largestAgreementSompi: raw.largest_agreement_sompi ?? 0,
    avgCompletionTimeMs: raw.avg_completion_time_ms ?? 0,
    fastestCompletionMs: raw.fastest_completion_ms ?? 0,
    agreementsLast30d: raw.agreements_last_30d ?? 0,
    agreementsLast7d: raw.agreements_last_7d ?? 0,
  };
}

function convertDeadlockStats(raw: any): DeadlockStats {
  if (!raw) return defaultDeadlockStats();
  return {
    totalDeadlocks: raw.total_deadlocks ?? 0,
    asBuyer: raw.as_buyer ?? 0,
    asSeller: raw.as_seller ?? 0,
    reasonNoDelivery: raw.reason_no_delivery ?? 0,
    reasonQualityDispute: raw.reason_quality_dispute ?? 0,
    reasonTimeout: raw.reason_timeout ?? 0,
    reasonOther: raw.reason_other ?? 0,
    resolvedAfterDeadlock: raw.resolved_after_deadlock ?? 0,
    lastDeadlockMs: raw.last_deadlock_ms,
    daysSinceLastDeadlock: raw.days_since_last_deadlock,
    uniqueCounterpartiesDeadlocked: raw.unique_counterparties_deadlocked ?? 0,
    repeatDeadlockSameCounterparty: raw.repeat_deadlock_same_counterparty ?? 0,
  };
}

function convertProof(raw: any): StatsProof {
  let proofBytes = '';
  if (raw.proof_bytes) {
    if (typeof raw.proof_bytes === 'string') {
      proofBytes = raw.proof_bytes;
    } else if (Array.isArray(raw.proof_bytes)) {
      proofBytes = bytesToHex(new Uint8Array(raw.proof_bytes));
    }
  }
  
  return {
    proofBytes,
    publicInputs: {
      pubkeyHash: raw.public_inputs?.pubkey_hash ?? '',
      successes: raw.public_inputs?.successes ?? 0,
      deadlocks: raw.public_inputs?.deadlocks ?? 0,
      xp: raw.public_inputs?.xp ?? 0,
      pCompleteFixed: raw.public_inputs?.p_complete_fixed ?? 500000,
      l1EventsRoot: raw.public_inputs?.l1_events_root ?? '',
      arweaveStatsHash: raw.public_inputs?.arweave_stats_hash ?? '',
    },
    proofType: raw.proof_type ?? 'unknown',
    generatedAt: raw.generated_at ?? Date.now(),
  };
}

function convertAgreement(raw: any): RecentAgreement {
  return {
    agreementId: raw.agreement_id,
    timestampMs: raw.timestamp_ms,
    outcome: raw.outcome,
    amountKas: raw.amount_kas,
    role: raw.role,
  };
}

// PROOF VERIFICATION (Client-side)
export function verifyStatsProofLocally(proof: StatsProof, stats: CounterpartyStats): boolean {
  if (proof.publicInputs.successes !== stats.successes) return false;
  if (proof.publicInputs.deadlocks !== stats.deadlocks) return false;
  if (proof.publicInputs.xp !== stats.xp) return false;
  
  const XP_PER_SUCCESS = 10_000000;
  const XP_PENALTY = 50_000000;
  const expectedXp = stats.successes * XP_PER_SUCCESS - stats.deadlocks * XP_PENALTY;
  if (stats.xp !== Math.max(0, expectedXp)) return false;
  
  const SCALE = 1_000000;
  const expectedP = stats.totalSamples === 0 
    ? SCALE / 2 
    : Math.floor((1 + stats.successes) * SCALE / (2 + stats.successes + stats.deadlocks));
  const tolerance = SCALE / 100;
  if (Math.abs(proof.publicInputs.pCompleteFixed - expectedP) > tolerance) return false;
  
  return true;
}

export function isProofFresh(proof: StatsProof): boolean {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return Date.now() - proof.generatedAt * 1000 < ONE_HOUR_MS;
}

export function getProofStatusLabel(proof: StatsProof | undefined): string {
  if (!proof) return '❓ Unverified';
  if (!isProofFresh(proof)) return '⏰ Stale Proof';
  if (proof.proofType.includes('Mock')) return '🧪 Mock Proof';
  return '✓ ZK Verified';
}

export function getProofStatusColor(proof: StatsProof | undefined): string {
  if (!proof) return '#95a5a6';
  if (!isProofFresh(proof)) return '#f39c12';
  if (proof.proofType.includes('Mock')) return '#3498db';
  return '#2ecc71';
}

// DISPLAY HELPERS
export function getRiskLabel(rating: RiskRating): string {
  const labels: Record<RiskRating, string> = {
    highly_trusted: '⭐ Highly Trusted',
    reliable: '✓ Reliable',
    medium_risk: '⚠ Medium Risk',
    high_risk: '🚨 High Risk',
    unknown: '? Unknown',
  };
  return labels[rating];
}

export function getRiskColor(rating: RiskRating): string {
  const colors: Record<RiskRating, string> = {
    highly_trusted: '#2ecc71',
    reliable: '#27ae60',
    medium_risk: '#f39c12',
    high_risk: '#e74c3c',
    unknown: '#95a5a6',
  };
  return colors[rating];
}

export function getTierLabel(tier: CitadelTier): string {
  const labels: Record<CitadelTier, string> = {
    guest: '🏠 Guest',
    resident: '🏛️ Resident',
    passport: '👑 Passport',
  };
  return labels[tier];
}

export function formatPComplete(pComplete: number): string {
  return `${(pComplete * 100).toFixed(1)}%`;
}

export function formatDelay(delayMs: number): string {
  if (delayMs === 0) return 'None';
  const seconds = Math.floor(delayMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatKas(sompi: number): string {
  const kas = sompi / 100_000_000;
  if (kas >= 1000) return `${(kas / 1000).toFixed(1)}K KAS`;
  if (kas >= 1) return `${kas.toFixed(2)} KAS`;
  return `${sompi.toLocaleString()} sompi`;
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86400_000) return `${(ms / 3600_000).toFixed(1)}h`;
  return `${Math.floor(ms / 86400_000)}d`;
}

export function getDeadlockReasonLabel(reason: keyof Pick<DeadlockStats, 
  'reasonNoDelivery' | 'reasonQualityDispute' | 'reasonTimeout' | 'reasonOther'>): string {
  const labels = {
    reasonNoDelivery: '📦 No Delivery',
    reasonQualityDispute: '⚠️ Quality Dispute',
    reasonTimeout: '⏱️ Timeout',
    reasonOther: '❓ Other',
  };
  return labels[reason];
}

export function getAgreementSummary(stats: NeighborAgreementStats): string {
  if (stats.totalAgreements === 0) return 'No agreements yet';
  const rate = ((stats.completed / stats.totalAgreements) * 100).toFixed(0);
  return `${stats.completed}/${stats.totalAgreements} completed (${rate}%)`;
}

export function getDeadlockSummary(stats: DeadlockStats): string {
  if (stats.totalDeadlocks === 0) return 'No deadlocks';
  const parts: string[] = [`${stats.totalDeadlocks} total`];
  if (stats.daysSinceLastDeadlock !== undefined) {
    parts.push(`last ${stats.daysSinceLastDeadlock}d ago`);
  }
  return parts.join(', ');
}

export function hasConcerningDeadlockPattern(stats: DeadlockStats): boolean {
  if (stats.repeatDeadlockSameCounterparty >= 2) return true;
  return false;
}

// EXPORTS


// ============================================================================
// RESOLVE: Address/Apt → Pubkey via Arweave tags
// ============================================================================

const ARWEAVE_GQL = 'https://arweave.net/graphql';

async function resolvePubkeyFromArweave(
  tagName: string,
  tagValue: string
): Promise<string | null> {
  try {
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "${tagName}", values: ["${tagValue}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges {
          node {
            tags { name value }
          }
        }
      }
    }`;
    const res = await fetch(ARWEAVE_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const edges = data?.data?.transactions?.edges;
    if (!edges?.length) return null;
    const tags = edges[0].node.tags as { name: string; value: string }[];
    const pubkeyTag = tags.find((t: { name: string }) => t.name === 'KV-Pubkey');
    return pubkeyTag?.value || null;
  } catch (e) {
    console.error('[Resolve] Arweave query failed:', e);
    return null;
  }
}

/**
 * Resolve Kaspa address → pubkey → counterparty stats
 */
export async function lookupByAddress(
  address: string,
  options?: { includeProof?: boolean }
): Promise<{ pubkey: string | null; stats: CounterpartyStats | null }> {
  const pubkey = await resolvePubkeyFromArweave('KV-Address', address);
  if (!pubkey) {
    console.warn('[Resolve] No pubkey found for address:', address.slice(0, 16));
    return { pubkey: null, stats: null };
  }
  const result = await lookupCounterparty(pubkey, options);
  return { pubkey, stats: result.stats };
}

/**
 * Resolve apt number → pubkey → counterparty stats
 */
export async function lookupByApt(
  apt: string,
  options?: { includeProof?: boolean }
): Promise<{ pubkey: string | null; stats: CounterpartyStats | null }> {
  let pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);
  if (!pubkey) {
    console.warn('[Resolve] No pubkey found for apt:', apt);
    return { pubkey: null, stats: null };
  }
  const result = await lookupCounterparty(pubkey, options);
  return { pubkey, stats: result.stats };
}

export {
  SNAIL_MODE_XP_THRESHOLD,
  SNAIL_MODE_P_COMPLETE_THRESHOLD,
  SNAIL_MODE_MIN_SAMPLES,
  XP_INCUBATOR,
  XP_ELITE,
};

