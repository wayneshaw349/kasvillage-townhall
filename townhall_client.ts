// ============================================================================
// KASVILLAGE EXPO - TOWN HALL CLIENT
// ============================================================================
// Replaces stub TownHallVerifier with real HTTP calls
// ============================================================================

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  TOWN_HALL_ENDPOINTS,
  AptRegisterRequest,
  AptRegisterResponse,
  AptConflictRequest,
  AptConflictResponse,
  UserVerifyRequest,
  UserVerifyResponse,
  IdentityAnchorRequest,
  IdentityAnchorResponse,
  IdentityVerifyRequest,
  IdentityVerifyResponse,
  DeviceRecoveryRequest,
  DeviceRecoveryResponse,
  StoreVerifyRequest,
  StoreVerifyResponse,
  DAppVerifyRequest,
  DAppVerifyResponse,
  GameVerifyRequest,
  GameVerifyResponse,
  ReviewVerifyRequest,
  ReviewVerifyResponse,
  ProofsQueryRequest,
  ProofsQueryResponse,
  GlobalStats,
  CirculationStats,
  HealthResponse,
  CanonicalAvatar,
  AcademicVerifyResponse,
  ServiceVerifyResponse,
  hashCanonicalAvatar,
  countTraits,
} from './shared_types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOWN_HALL_BASE_URL = __DEV__ 
  ? 'https://kasvillage.app.runonflux.io'
  : 'https://townhall.kasvillage.dev';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface RequestOptions {
  method: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

async function request<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const url = `${TOWN_HALL_BASE_URL}${endpoint}`;
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const maxRetries = options.retries ?? MAX_RETRIES;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'X-KV-Client': 'expo-mobile',
          'X-KV-Version': '1.0.0',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort or client errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        if (error.message.includes('HTTP 4')) {
          throw error; // Client error, don't retry
        }
      }
      
      // Wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  
  throw lastError ?? new Error('Request failed');
}

// ============================================================================
// SIGNING HELPERS
// ============================================================================

async function getStoredPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync('kaspa_private_key');
}

async function getStoredPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync('kaspa_public_key');
}

async function signMessage(message: string): Promise<string> {
  // In production: use secp256k1 signing with stored private key
  // For now: SHA256 HMAC with private key as key
  const privateKey = await getStoredPrivateKey();
  if (!privateKey) {
    throw new Error('No private key stored');
  }
  
  // Simplified signature (replace with proper secp256k1 in production)
  const combined = `${privateKey}:${message}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hash;
}

// ============================================================================
// TOWN HALL CLIENT CLASS
// ============================================================================

export class TownHallClient {
  private static instance: TownHallClient;
  
  private constructor() {}
  
  static getInstance(): TownHallClient {
    if (!TownHallClient.instance) {
      TownHallClient.instance = new TownHallClient();
    }
    return TownHallClient.instance;
  }
  
  // ==========================================================================
  // HEALTH
  // ==========================================================================
  
  async health(): Promise<HealthResponse> {
    return request<HealthResponse>(TOWN_HALL_ENDPOINTS.HEALTH, {
      method: 'GET',
      timeout: 5000,
      retries: 1,
    });
  }
  
  async isOnline(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'ok';
    } catch {
      return false;
    }
  }
  
  // ==========================================================================
  // APT REGISTRATION
  // ==========================================================================
  
  async registerApt(
    avatar: CanonicalAvatar,
    deviceAttestation?: string
  ): Promise<AptRegisterResponse> {
    const publicKey = await getStoredPublicKey();
    if (!publicKey) {
      return { success: false, error: 'No public key stored' };
    }
    
    const avatarHash = await hashCanonicalAvatar(avatar);
    const traitCount = countTraits(avatar);
    const timestamp = Date.now();
    
    const message = `${timestamp}:${publicKey}:${avatarHash}`;
    const signature = await signMessage(message);
    
    const req: AptRegisterRequest = {
      publicKey,
      avatarHash,
      traitCount,
      deviceAttestation,
      timestamp,
      signature,
    };
    
    return request<AptRegisterResponse>(TOWN_HALL_ENDPOINTS.APT_REGISTER, {
      method: 'POST',
      body: req,
    });
  }
  
  async checkAptConflict(avatarHash: string): Promise<AptConflictResponse> {
    const publicKey = await getStoredPublicKey();
    if (!publicKey) {
      return { conflict: false, reason: 'No public key' };
    }
    
    const req: AptConflictRequest = {
      publicKey,
      avatarHash,
    };
    
    return request<AptConflictResponse>(TOWN_HALL_ENDPOINTS.APT_CONFLICT, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // USER VERIFICATION
  // ==========================================================================
  
  async verifyUser(
    aptAlias: string,
    options?: { includeStats?: boolean; includeSnailMode?: boolean }
  ): Promise<UserVerifyResponse> {
    const req: UserVerifyRequest = {
      aptAlias,
      includeStats: options?.includeStats ?? true,
      includeSnailMode: options?.includeSnailMode ?? true,
    };
    
    return request<UserVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_USER, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // IDENTITY ANCHOR
  // ==========================================================================
  
  async anchorIdentity(avatar: CanonicalAvatar): Promise<IdentityAnchorResponse> {
    const publicKey = await getStoredPublicKey();
    const aptAlias = await SecureStore.getItemAsync('apt_alias');
    
    if (!publicKey || !aptAlias) {
      return { success: false, error: 'Missing credentials' };
    }
    
    const avatarHash = await hashCanonicalAvatar(avatar);
    const traitCount = countTraits(avatar);
    const timestamp = Date.now();
    
    // Hash backstory fields separately
    const backstoryFields = [
      avatar.originStory,
      avatar.formativeMemory,
      avatar.lifePhilosophy,
      avatar.definingMoment,
    ].join('|');
    const backstoryHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      backstoryFields.toLowerCase()
    );
    
    const message = `anchor:${aptAlias}:${avatarHash}:${timestamp}`;
    const signature = await signMessage(message);
    
    const req: IdentityAnchorRequest = {
      aptAlias,
      publicKey,
      avatarHash,
      traitCount,
      backstoryHash,
      timestamp,
      signature,
    };
    
    return request<IdentityAnchorResponse>(TOWN_HALL_ENDPOINTS.IDENTITY_ANCHOR, {
      method: 'POST',
      body: req,
    });
  }
  
  async verifyIdentity(aptAlias: string): Promise<IdentityVerifyResponse> {
    const publicKey = await getStoredPublicKey();
    
    const req: IdentityVerifyRequest = {
      aptAlias,
      publicKey: publicKey ?? undefined,
    };
    
    return request<IdentityVerifyResponse>(TOWN_HALL_ENDPOINTS.IDENTITY_VERIFY, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // DEVICE RECOVERY
  // ==========================================================================
  
  async recoverDevice(
    avatar: CanonicalAvatar,
    newPublicKey: string,
    deviceAttestation?: string
  ): Promise<DeviceRecoveryResponse> {
    const req: DeviceRecoveryRequest = {
      avatar,
      newPublicKey,
      deviceAttestation,
      timestamp: Date.now(),
    };
    
    return request<DeviceRecoveryResponse>(TOWN_HALL_ENDPOINTS.DEVICE_RECOVER, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // STORE VERIFICATION
  // ==========================================================================
  
  async verifyStore(
    storeId: string,
    name: string,
    description?: string,
    imageHashes?: string[],
    pledgeKas: number = 0
  ): Promise<StoreVerifyResponse> {
    const aptAlias = await SecureStore.getItemAsync('apt_alias');
    if (!aptAlias) {
      return {
        storeId,
        ownerApt: '',
        verified: false,
        visibilityScore: 0,
        timestamp: Date.now(),
        error: 'Not registered',
      };
    }
    
    const req: StoreVerifyRequest = {
      storeId,
      ownerApt: aptAlias,
      name,
      description,
      imageHashes,
      pledgeKas,
    };
    
    return request<StoreVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_STORE, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // DAPP VERIFICATION
  // ==========================================================================
  
  async verifyDApp(
    dappId: string,
    dappType: string,
    code: string,
    pledgeKas: number = 0
  ): Promise<DAppVerifyResponse> {
    const aptAlias = await SecureStore.getItemAsync('apt_alias');
    if (!aptAlias) {
      throw new Error('Not registered');
    }
    
    const req: DAppVerifyRequest = {
      dappId,
      ownerApt: aptAlias,
      dappType,
      code,
      pledgeKas,
    };
    
    return request<DAppVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_DAPP, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // GAME VERIFICATION
  // ==========================================================================
  
  async verifyGame(
    gameId: string,
    code: string,
    pledgeKas: number = 0
  ): Promise<GameVerifyResponse> {
    const aptAlias = await SecureStore.getItemAsync('apt_alias');
    if (!aptAlias) {
      throw new Error('Not registered');
    }
    
    const req: GameVerifyRequest = {
      gameId,
      ownerApt: aptAlias,
      code,
      pledgeKas,
    };
    
    return request<GameVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_GAME, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // REVIEW VERIFICATION
  // ==========================================================================
  
  async verifyReview(
    reviewText: string,
    targetId: string,
    targetType: 'Store' | 'DApp' | 'Service' | 'Academic' | 'Game'
  ): Promise<ReviewVerifyResponse> {
    const aptAlias = await SecureStore.getItemAsync('apt_alias');
    if (!aptAlias) {
      throw new Error('Not registered');
    }
    
    const req: ReviewVerifyRequest = {
      reviewText,
      reviewerApt: aptAlias,
      targetId,
      targetType,
    };
    
    return request<ReviewVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_REVIEW, {
      method: 'POST',
      body: req,
    });
  }
  
  // ==========================================================================
  // PROOFS & STATS
  // ==========================================================================
  
  async queryProofs(params: ProofsQueryRequest): Promise<ProofsQueryResponse> {
    return request<ProofsQueryResponse>(TOWN_HALL_ENDPOINTS.PROOFS_QUERY, {
      method: 'POST',
      body: params,
    });
  }
  
  async getGlobalStats(): Promise<GlobalStats> {
    return request<GlobalStats>(TOWN_HALL_ENDPOINTS.STATS_GLOBAL, {
      method: 'GET',
    });
  }
  
  async getCirculation(): Promise<CirculationStats> {
    return request<CirculationStats>(TOWN_HALL_ENDPOINTS.STATS_CIRCULATION, {
      method: 'GET',
    });
  }
  
  // ============================================================================
  // ACADEMIC VERIFICATION
  // ============================================================================
  
  async verifyAcademic(params: {
    ownerApt: string;
    emailHeaders: string;
    dkimSignature: string;
    abstractText?: string;
  }): Promise<AcademicVerifyResponse> {
    const pubkey = await getStoredPublicKey();
    const sig = await signMessage(JSON.stringify({ apt: params.ownerApt, ts: Date.now() }));
    return request<AcademicVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_ACADEMIC, {
      method: 'POST',
      body: {
        owner_apt: params.ownerApt,
        email_headers: params.emailHeaders,
        dkim_signature: params.dkimSignature,
        abstract_text: params.abstractText || null,
      },
      headers: { 'X-Pubkey': pubkey || '', 'X-Signature': sig },
    });
  }
  
  async verifyService(params: {
    serviceId: string;
    ownerApt: string;
    serviceType: string;
    code: string;
    reviews: string[];
  }): Promise<ServiceVerifyResponse> {
    const pubkey = await getStoredPublicKey();
    const sig = await signMessage(JSON.stringify({ sid: params.serviceId, ts: Date.now() }));
    return request<ServiceVerifyResponse>(TOWN_HALL_ENDPOINTS.VERIFY_SERVICE, {
      method: 'POST',
      body: {
        service_id: params.serviceId,
        owner_apt: params.ownerApt,
        service_type: params.serviceType,
        code: params.code,
        reviews: params.reviews,
      },
      headers: { 'X-Pubkey': pubkey || '', 'X-Signature': sig },
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const townHall = TownHallClient.getInstance();

// ============================================================================
// FROST AGREEMENT RELAY
// ============================================================================

export interface AgreementPartyInfo {
  pubkey: string;
  amount_sompi: number;
  confirmed: boolean;
  collateralTxId: string | null;
}

export interface AgreementStatus {
  agreementId: string;
  status: string;
  description: string;
  network: string;
  frostAddress: string | null;
  partyA: AgreementPartyInfo;
  partyB: AgreementPartyInfo | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgreementListItem {
  agreementId: string;
  status: string;
  description: string;
  frostAddress: string | null;
  myRole: 'A' | 'B';
  myAmount: number;
  createdAt: number;
}

const TOWNHALL_BASE = 'https://kasvillage.app.runonflux.io';

export async function proposeAgreement(params: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  signature: string;
  description: string;
  stipulations?: string;
  network: string;
  buyerAmountSompi?: number;
  sellerAmountSompi?: number;
  counterpartyPubkey?: string;
  frostAddress?: string;
  frostCounter?: number;
  frostR?: string;
  daaScore?: number;
}): Promise<{ success: boolean; agreementId?: string; error?: string; arweaveTxId?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await resp.json();
    // Arweave dual-write for propose
    try {
      const arweaveResult = await inscribeAgreementToArweave({
        agreementId: params.agreementId || '',
        pubkey: params.pubkey,
        amount_sompi: params.amount_sompi,
        description: params.description || '',
        network: params.network || 'testnet-10',
        status: 'Proposed',
        signature: params.signature,
        counterpartyPubkey: (params as any).counterpartyPubkey || undefined,
        daaScore: (params as any).daaScore || 0,
        buyerAmountSompi: (params as any).buyerAmountSompi || 0,
        sellerAmountSompi: (params as any).sellerAmountSompi || 0,
      });
    if (arweaveResult?.txId) { result.arweaveTxId = arweaveResult.txId; console.log('[TownHall] Arweave TX ID:', arweaveResult.txId); }
    } catch (e) { console.warn('[TownHall] Arweave inscription failed (non-fatal):', e); }
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function acceptAgreement(params: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  signature: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function confirmAgreement(params: {
  agreementId: string;
  pubkey: string;
  signature: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAgreementStatus(agreementId: string): Promise<AgreementStatus | null> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/' + agreementId);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function recordCollateral(params: {
  agreementId: string;
  pubkey: string;
  txId: string;
  frostAddress?: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/collateral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function listMyAgreements(pubkey: string): Promise<AgreementListItem[]> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreements?pubkey=' + pubkey);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.agreements || [];
  } catch {
    return [];
  }
}


// ============================================================================
// FROST PARTIAL SIGNATURE RELAY
// ============================================================================

export async function submitPartialSig(params: {
  agreementId: string;
  pubkey: string;
  partialSig: string;
  recipientAddress: string;
}): Promise<{ success: boolean; bothReady?: boolean; partialSigA?: string; partialSigB?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/partial-sig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function recordReleaseTx(params: {
  agreementId: string;
  txId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


// ============================================================================
// FROST PARTIAL SIGNATURE RELAY
// ============================================================================



// ============================================================================
// LIST ALL PROPOSED AGREEMENTS (for Party B inbox)
// ============================================================================
export async function listProposedAgreements(): Promise<AgreementListItem[]> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreements/proposed');
    if (!resp.ok) return [];
    return await resp.json();
  } catch (e) {
    console.warn('[TownHall] listProposed error:', e);
    return [];
  }
}

// ============================================================================
// ARWEAVE PERSISTENCE FOR AGREEMENTS
// ============================================================================
import { uploadToIrys, ArweaveTag, IrysUploadResult } from './arweave_upload';
import { ARWEAVE_GRAPHQL, GOLDSKY_GRAPHQL } from './arweave_queries';

export async function inscribeAgreementToArweave(agreement: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  description: string;
  network: string;
  status: string;
  signature: string;
  counterpartyPubkey?: string;
  frostAddress?: string;
  frostR?: string;
  daaScore?: number;
  buyerAmountSompi?: number;
  sellerAmountSompi?: number;
}): Promise<IrysUploadResult> {
  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'frost-agreement' },
    { name: 'KV-AgreementId', value: agreement.agreementId },
    { name: 'KV-Status', value: agreement.status },
    { name: 'KV-Pubkey', value: agreement.pubkey },
    { name: 'KV-Network', value: agreement.network },
    { name: 'KV-Amount', value: String(agreement.amount_sompi) },
    { name: 'KV-BuyerAmount', value: String(agreement.buyerAmountSompi || (agreement as any).buyerAmountSompi || 0) },
    { name: 'KV-SellerAmount', value: String(agreement.sellerAmountSompi || (agreement as any).sellerAmountSompi || 0) },
    { name: 'KV-Description', value: (agreement.description || '').slice(0, 100) },
    { name: 'KV-DAAScore', value: String(agreement.daaScore || 0) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];
  if (agreement.frostAddress) {
    tags.push({ name: 'KV-FrostAddress', value: agreement.frostAddress });
    if (agreement.frostCounter !== undefined) tags.push({ name: 'KV-FrostCounter', value: String(agreement.frostCounter) });
  }
  if (agreement.frostR) {
    // Store hash(R) on Arweave, not raw R (defense-in-depth)
    const _rHash = require('@noble/hashes/sha256').sha256(new TextEncoder().encode(agreement.frostR));
    tags.push({ name: 'KV-FrostR-Hash', value: require('@noble/hashes/utils').bytesToHex(_rHash).slice(0,32) });
  }
  if (agreement.counterpartyPubkey) {
    tags.push({ name: 'KV-Counterparty', value: agreement.counterpartyPubkey });
  }
  const payload = JSON.stringify(agreement);
  console.log('[Arweave] Inscribing agreement:', agreement.agreementId, '(' + payload.length + ' bytes)');
  return uploadToIrys(payload, tags);
}

export async function queryCounterpartyAgreed(opts: {
  agreementId: string;
  counterpartyPubkey: string;
  myPubkey: string;
  frostAddress?: string;
}): Promise<boolean> {
  if (!opts.agreementId || !opts.counterpartyPubkey) return false;
  const tagFilters = [
    '{ name: "App-Name", values: ["KasVillage"] }',
    '{ name: "KV-Type", values: ["frost-agreement"] }',
    '{ name: "KV-Status", values: ["Agreed", "Agreed-Send"] }',
    '{ name: "KV-AgreementId", values: ["' + opts.agreementId + '"] }',
    '{ name: "KV-Pubkey", values: ["' + opts.counterpartyPubkey + '"] }',
  ];
  // KV-Counterparty filter disabled — some inscriptions don't include it
  // Match by agreementId + counterparty pubkey + status is sufficient
  if (false && opts.myPubkey) {
    tagFilters.push('{ name: "KV-Counterparty", values: ["' + opts.myPubkey + '"] }');
  }
  if (opts.frostAddress) {
    tagFilters.push('{ name: "KV-FrostAddress", values: ["' + opts.frostAddress + '"] }');
  }
  const query = '{ transactions(tags: [' + tagFilters.join(', ') + '], first: 1) { edges { node { id } } } }';
  const endpoints = [GOLDSKY_GRAPHQL, ARWEAVE_GRAPHQL];
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const edges = data?.data?.transactions?.edges || [];
      if (edges.length > 0) {
        console.log('[Arweave] Counterparty agreed! TX:', edges[0].node.id);
        return true;
      }
      return false;
    } catch (e) { continue; }
  }
  return false;
}


// Post FROST R nonce to TownHall
export async function postFrostR(params: { agreementId: string; pubkey: string; frostR: string }): Promise<{ success: boolean }> {
  try {
    const resp = await fetch(TOWNHALL_BASE + '/api/agreement/frost-r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreement_id: params.agreementId, pubkey: params.pubkey, frost_r: params.frostR }),
    });
    return await resp.json();
  } catch (e) { console.warn('[TownHall] postFrostR failed:', e); return { success: false }; }
}

// Get FROST R nonces from TownHall
export async function getFrostR(agreementId: string): Promise<{ frost_r_a?: string; frost_r_b?: string } | null> {
  try {
    const resp = await fetch(TOWNHALL_BASE + '/api/agreement/' + agreementId + '/frost-r');
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function queryAgreementsFromArweave(opts?: {
  status?: string;
  pubkey?: string;
  counterparty?: string;
  network?: string;
}): Promise<any[]> {
  const tagFilters: string[] = [
    '{ name: "App-Name", values: ["KasVillage"] }',
    '{ name: "KV-Type", values: ["frost-agreement"] }',
  ];
  if (opts?.status) {
    tagFilters.push('{ name: "KV-Status", values: ["' + opts.status + '"] }');
  }
  if (opts?.pubkey) {
    tagFilters.push('{ name: "KV-Pubkey", values: ["' + opts.pubkey + '"] }');
  }
  if (opts?.counterparty) {
    tagFilters.push('{ name: "KV-Counterparty", values: ["' + opts.counterparty + '"] }');
  }
  if (opts?.network) {
    tagFilters.push('{ name: "KV-Network", values: ["' + opts.network + '"] }');
  }

  const query = `{
    transactions(
      tags: [${tagFilters.join(', ')}],
      first: 20,
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

  const endpoints = [GOLDSKY_GRAPHQL, ARWEAVE_GRAPHQL];
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const edges = data?.data?.transactions?.edges || [];
      
      // Parse tags into agreement objects
      const agreements = await Promise.all(edges.map(async (edge) => {
        const tags = edge.node.tags.reduce((acc, t) => {
          acc[t.name] = t.value;
          return acc;
        }, {});
        
        // Fetch the full agreement data from Arweave
        let agreementData = {};
        try {
          const dataResp = await fetch('https://arweave.net/' + edge.node.id);
          if (dataResp.ok) {
            agreementData = await dataResp.json();
          }
        } catch (e) {
          // Fall back to tag data only
        }

        return {
          arweave_tx_id: edge.node.id,
          agreement_id: tags['KV-AgreementId'] || '',
          agreementId: tags['KV-AgreementId'] || '',
          status: tags['KV-Status'] || 'Proposed',
          description: agreementData.description || tags['KV-AgreementId'] || '',
          network: tags['KV-Network'] || 'testnet-10',
          party_a: {
            pubkey: tags['KV-Pubkey'] || '',
            amount_sompi: parseInt(tags['KV-Amount'] || '0', 10),
            counterpartyPubkey: tags['KV-Counterparty'] || '',
            buyerAmountSompi: parseInt(tags['KV-BuyerAmount'] || '0', 10),
            sellerAmountSompi: parseInt(tags['KV-SellerAmount'] || '0', 10),
          },
          ...agreementData,
        };
      }));
      
      console.log('[Arweave] Found', agreements.length, 'agreements');
      return agreements;
    } catch (e) {
      console.warn('[Arweave] Query failed on', endpoint, e);
      continue;
    }
  }
  return [];
}
