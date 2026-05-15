// ============================================================================
// KASVILLAGE EXPO - CENTRAL API HUB
// ============================================================================
// Wires all TypeScript modules together for unified API access
// ============================================================================

// ============================================================================
// RE-EXPORTS: Shared Types
// ============================================================================

export {
  AVATAR_SCHEMA_VERSION,
  TRAITS_TO_BUY,
  TRAITS_TO_SELL,
  SOMPI_PER_KAS,
  CANONICAL_AVATAR_FIELDS,
  BUYER_TRAITS,
  SELLER_EXTRA_TRAITS,
  BACKSTORY_TRAITS,
  TOWN_HALL_ENDPOINTS,
  type RiskRating,
  type XPTier,
  type EntityType,
  type CanonicalAvatar,
  type UserStats,
  type SnailModeStatus,
  type AptRegisterRequest,
  type AptRegisterResponse,
  type AptConflictRequest,
  type AptConflictResponse,
  type UserVerifyRequest,
  type UserVerifyResponse,
  type IdentityAnchorRequest,
  type IdentityAnchorResponse,
  type IdentityVerifyRequest,
  type IdentityVerifyResponse,
  type DeviceRecoveryRequest,
  type DeviceRecoveryResponse,
  type StoreVerifyRequest,
  type StoreVerifyResponse,
  type CodeScanResult,
  type DAppVerifyRequest,
  type DAppVerifyResponse,
  type GameVerifyRequest,
  type GameVerifyResponse,
  type ReviewVerifyRequest,
  type ReviewVerifyResponse,
  type SentimentResult,
  type AuthenticityCheck,
  type CodeSignatureRegisterRequest,
  type CodeSignatureRegisterResponse,
  type CodeSignatureVerifyRequest,
  type CodeSignatureVerifyResponse,
  type ProofsQueryRequest,
  type ProofsQueryResponse,
  type ProofRecord,
  type GlobalStats,
  type CirculationStats,
  type HealthResponse,
  serializeCanonicalAvatar,
  hashCanonicalAvatar,
  countTraits,
  canBuy,
  canSell,
  getXPTier,
  getXPTierColor,
} from './shared_types';

// ============================================================================
// RE-EXPORTS: Town Hall Client
// ============================================================================

export {
  TownHallClient,
  townHall,
} from './townhall_client';

// ============================================================================
// RE-EXPORTS: Kaspa Unified Client
// ============================================================================

export {
  connect,
  disconnect,
  isConnected,
  setNetwork,
  getNetwork,
  getBalance,
  getBalanceKAS,
  getUtxos,
  getSpendableUtxos,
  getSpendableBalance,
  getFeeEstimate,
  calculateFee,
  getRecommendedFee,
  estimateSendFee,
  sendKAS,
  sendSompi,
  broadcastTransaction,
  sendWithInscription,
  sendWithOpReturn,
  inscribeIdentity,
  inscribeFrostEvent,
  getTransaction,
  getVirtualDaaScore,
  getBlockDagInfo,
  getServerInfo,
  subscribeUtxosChanged,
  unsubscribeUtxosChanged,
  getExplorerUrl,
  getFaucetUrl,
  kasToSompi,
  sompiToKas,
  formatKAS,
  isValidAddress,
  type TransactionResult,
  type FeeEstimate,
  type UtxoEntry,
  type ServerInfo,
  KaspaClient,
} from './kaspa_unified';

// ============================================================================
// RE-EXPORTS: Arweave Upload
// ============================================================================

export {
  IRYS_NODE_MAINNET,
  IRYS_NODE_DEVNET,
  IRYS_CURRENCY_ETH,
  IRYS_CURRENCY_MATIC,
  IRYS_CURRENCY_SOL,
  TURBO_UPLOAD_URL,
  ARWEAVE_GATEWAY,
  type IrysUploadResult,
  type IrysBalance,
  type DataItem,
  type SignedDataItem,
  uploadVerificationProof,
  uploadStoreListing,
  uploadProfileUpdate,
  uploadAcademicAbstract,
  uploadWithDualRedundancy,
  getIrysBalance,
  getUploadPrice,
  prepareKVTags,
} from './arweave_upload';

// ============================================================================
// RE-EXPORTS: Wallet Registration (using wallet_registration_v2)
// ============================================================================

export {
  ACCESS_LEVELS,
  ACCESS_PERMISSIONS,
  STORE_KEYS,
  type RegistrationStatus,
  type VerificationStatus,
  type AccessLevel,
  type RegistrationData,
  type DeviceAttestationPayload,
  createWallet,
  registerWithTownHall,
  anchorIdentity,
  recoverDevice,
  requestVerification,
  generateDeviceAttestation,
  getRegistrationData,
  getUserStats,
  updateUserStats,
  recordSuccess,
  recordDeadlock,
  isInSnailMode,
  getCreationDelayMs,
  getAccessLevel,
  canPerformAction,
  isVisibleInSearch,
  syncWithTownHall,
  checkListingVisibility,
  filterVerifiedListings,
  calculatePComplete,
  countAvatarTraits,
  getStealthAddress,
  isStealthEnabled,
  regenerateStealthKeys,
} from './wallet_registration_v2';

// ============================================================================
// RE-EXPORTS: Stealth Watcher
// ============================================================================

export {
  type StealthKeys,
  type StealthPayment,
  type StealthPaymentData,
  type StealthWatcherState,
  generateStealthKeys,
  loadStealthKeys,
  getStealthMetaAddress,
  createStealthPayment,
  startStealthWatcher,
  stopStealthWatcher,
  scanForStealthPayments,
  getUnspentStealthPayments,
  getPendingStealthPayments,
  getStealthBalance,
  markStealthPaymentSpent,
  getStealthSpendingKey,
} from './stealth_watcher';

// ============================================================================
// UNIFIED API CLASS
// ============================================================================

import { townHall } from './townhall_client';
import { 
  KaspaClient,
  connect as kaspaConnect,
  setNetwork as kaspaSetNetwork,
  getBalance as kaspaGetBalance,
} from './kaspa_unified';
import { 
  createWallet as createWalletFn,
  registerWithTownHall as registerFn,
  getRegistrationData as getRegDataFn,
  getUserStats as getStatsFn,
  syncWithTownHall as syncFn,
  getAccessLevel as getAccessFn,
  isInSnailMode as isSnailFn,
  recordSuccess as recordSuccessFn,
  recordDeadlock as recordDeadlockFn,
} from './wallet_registration_v2';
import {
  uploadVerificationProof as uploadProofFn,
  uploadStoreListing as uploadStoreFn,
  uploadProfileUpdate as uploadProfileFn,
  uploadWithDualRedundancy as uploadDualFn,
} from './arweave_upload';
import {
  CanonicalAvatar,
  HealthResponse,
  GlobalStats,
  CirculationStats,
} from './shared_types';

type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

/**
 * KasVillageAPI - Unified access to all KasVillage services
 */
export class KasVillageAPI {
  private static instance: KasVillageAPI;
  
  private _townHall = townHall;
  private _kaspaClient: KaspaClient | null = null;
  private _network: KaspaNetwork = 'mainnet';
  private _initialized = false;
  
  private constructor() {}
  
  static getInstance(): KasVillageAPI {
    if (!KasVillageAPI.instance) {
      KasVillageAPI.instance = new KasVillageAPI();
    }
    return KasVillageAPI.instance;
  }
  
  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------
  
  async initialize(options: {
    network?: KaspaNetwork;
  } = {}): Promise<boolean> {
    try {
      this._network = options.network ?? 'mainnet';
      kaspaSetNetwork(this._network);
      await kaspaConnect();
      this._kaspaClient = new KaspaClient();
      this._initialized = true;
      return true;
    } catch (error) {
      console.error('[KasVillageAPI] Initialization failed:', error);
      return false;
    }
  }
  
  get isInitialized(): boolean {
    return this._initialized;
  }
  
  get network(): KaspaNetwork {
    return this._network;
  }
  
  // ---------------------------------------------------------------------------
  // HEALTH & STATUS
  // ---------------------------------------------------------------------------
  
  async health(): Promise<{
    townHall: HealthResponse | null;
    kaspa: { connected: boolean; network: string } | null;
  }> {
    const result: {
      townHall: HealthResponse | null;
      kaspa: { connected: boolean; network: string } | null;
    } = {
      townHall: null,
      kaspa: null,
    };
    
    try {
      result.townHall = await this._townHall.health();
    } catch { /* ignore */ }
    
    if (this._kaspaClient) {
      result.kaspa = {
        connected: true,
        network: this._network,
      };
    }
    
    return result;
  }
  
  async getGlobalStats(): Promise<GlobalStats | null> {
    try {
      return await this._townHall.getGlobalStats();
    } catch {
      return null;
    }
  }
  
  async getCirculation(): Promise<CirculationStats | null> {
    try {
      return await this._townHall.getCirculation();
    } catch {
      return null;
    }
  }
  
  // ---------------------------------------------------------------------------
  // WALLET OPERATIONS
  // ---------------------------------------------------------------------------
  
  wallet = {
    create: createWalletFn,
    getRegistration: getRegDataFn,
    getStats: getStatsFn,
    getAccessLevel: getAccessFn,
    isInSnailMode: isSnailFn,
    recordSuccess: recordSuccessFn,
    recordDeadlock: recordDeadlockFn,
    sync: syncFn,
  };
  
  // ---------------------------------------------------------------------------
  // REGISTRATION & VERIFICATION
  // ---------------------------------------------------------------------------
  
  async register(avatar: CanonicalAvatar, deviceAttestation?: string) {
    return registerFn(avatar, deviceAttestation);
  }
  
  async verifyUser(aptAlias: string, options?: { includeStats?: boolean; includeSnailMode?: boolean }) {
    return this._townHall.verifyUser(aptAlias, options);
  }
  
  async anchorIdentity(avatar: CanonicalAvatar) {
    return this._townHall.anchorIdentity(avatar);
  }
  
  async recoverDevice(avatar: CanonicalAvatar, newPublicKey: string, deviceAttestation?: string) {
    return this._townHall.recoverDevice(avatar, newPublicKey, deviceAttestation);
  }
  
  // ---------------------------------------------------------------------------
  // KASPA L1 OPERATIONS
  // ---------------------------------------------------------------------------
  
  kaspa = {
    getBalance: kaspaGetBalance,
    setNetwork: kaspaSetNetwork,
    connect: kaspaConnect,
  };
  
  // ---------------------------------------------------------------------------
  // ARWEAVE UPLOADS
  // ---------------------------------------------------------------------------
  
  arweave = {
    uploadProof: uploadProofFn,
    uploadStore: uploadStoreFn,
    uploadProfile: uploadProfileFn,
    uploadDual: uploadDualFn,
  };
  
  // ---------------------------------------------------------------------------
  // VERIFICATION SERVICES
  // ---------------------------------------------------------------------------
  
  verify = {
    store: (storeId: string, name: string, description?: string, imageHashes?: string[], pledgeKas?: number) =>
      this._townHall.verifyStore(storeId, name, description, imageHashes, pledgeKas),
    
    dapp: (dappId: string, dappType: string, code: string, pledgeKas?: number) =>
      this._townHall.verifyDApp(dappId, dappType, code, pledgeKas),
    
    game: (gameId: string, code: string, pledgeKas?: number) =>
      this._townHall.verifyGame(gameId, code, pledgeKas),
    
    review: (reviewText: string, targetId: string, targetType: 'Store' | 'DApp' | 'Service' | 'Academic' | 'Game') =>
      this._townHall.verifyReview(reviewText, targetId, targetType),
    
    identity: (aptAlias: string) =>
      this._townHall.verifyIdentity(aptAlias),
  };
  
  // ---------------------------------------------------------------------------
  // PROOFS & QUERIES
  // ---------------------------------------------------------------------------
  
  async queryProofs(params: {
    aptAlias?: string;
    entityId?: string;
    entityType?: 'Store' | 'DApp' | 'Service' | 'Academic' | 'Game' | 'User';
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
  }) {
    return this._townHall.queryProofs(params);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const api = KasVillageAPI.getInstance();