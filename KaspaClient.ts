// KaspaClient.ts
// Native Kaspa RPC client using @kcoin/kaspa-web3.js
// No WebView required - runs directly in React Native/Node.js
//
// Install: npm install @kcoin/kaspa-web3.js --legacy-peer-deps

import {
  RpcClient,
  NetworkId,
  Resolver,
  Generator,
  SendKasParams,
  Fees,
  kaspaToSompi,
  sompiToKaspa,
} from '@kcoin/kaspa-web3.js';

// =============================================================================
// TYPES
// =============================================================================

export type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

export interface ServerInfo {
  serverVersion: string;
  isSynced: boolean;
  virtualDaaScore: bigint;
  networkId: string;
}

export interface UtxoEntry {
  txId: string;
  index: number;
  amount: bigint;
  scriptPublicKey: string;
  blockDaaScore: bigint;
  isCoinbase: boolean;
}

export interface TransactionResult {
  txId: string;
  explorerUrl: string;
}

export interface ConnectionState {
  connected: boolean;
  network: KaspaNetwork | null;
  serverVersion: string | null;
  isSynced: boolean;
}

// Fee estimation types
export interface FeerateBucket {
  feeRate: number;       // sompi/gram
  estimatedSeconds: number;
}

export interface FeeEstimate {
  priorityBucket: FeerateBucket;
  normalBuckets: FeerateBucket[];
  lowBuckets: FeerateBucket[];
}

export interface FeeCalculation {
  feeSompi: bigint;
  feeKAS: number;
  mass: number;          // grams
  feeRate: number;       // sompi/gram
  priority: 'low' | 'normal' | 'priority';
  estimatedSeconds: number;
}

// =============================================================================
// MASS CALCULATION CONSTANTS
// =============================================================================

// Mass constants from Kaspa consensus
const MASS_PER_TX_BYTE = 1;                    // 1 gram per byte
const MASS_PER_SCRIPT_PUB_KEY_BYTE = 10;       // 10 grams per script byte  
const MASS_PER_SIG_OP = 1000;                  // 1000 grams per signature operation

// Typical component sizes (bytes)
const TX_HEADER_SIZE = 35;                     // version, locktime, subnetwork, etc.
const INPUT_BASE_SIZE = 41;                    // outpoint (36) + sequence (4) + varint (1)
const SCHNORR_SIG_SIZE = 64;                   // BIP340 Schnorr signature
const P2PK_SCRIPT_SIZE = 34;                   // Schnorr P2PK output script
const OUTPUT_BASE_SIZE = 9;                    // value (8) + varint (1)

// =============================================================================
// FEE ESTIMATION HELPERS
// =============================================================================

/**
 * Calculate transaction mass in grams
 * Mass = compute_mass + storage_mass
 * For most transactions, compute_mass dominates
 */
function calculateTransactionMass(
  inputCount: number,
  outputCount: number,
  payloadBytes: number = 0
): number {
  // Base transaction size
  let txSize = TX_HEADER_SIZE;
  
  // Inputs: base + signature script (Schnorr sig + pubkey)
  const sigScriptSize = SCHNORR_SIG_SIZE + 1; // sig + push opcode
  txSize += inputCount * (INPUT_BASE_SIZE + sigScriptSize);
  
  // Outputs: base + script pubkey
  txSize += outputCount * (OUTPUT_BASE_SIZE + P2PK_SCRIPT_SIZE);
  
  // Payload
  txSize += payloadBytes;
  
  // Compute mass = tx_size * MASS_PER_TX_BYTE + script_pubkey_mass + sig_op_mass
  const baseMass = txSize * MASS_PER_TX_BYTE;
  const scriptMass = outputCount * P2PK_SCRIPT_SIZE * MASS_PER_SCRIPT_PUB_KEY_BYTE;
  const sigOpMass = inputCount * MASS_PER_SIG_OP; // 1 sig op per input
  
  return baseMass + scriptMass + sigOpMass;
}

/**
 * Parse raw fee estimate from RPC
 */
function parseFeeEstimate(raw: any): FeeEstimate {
  // Handle different response formats from SDK
  const priority = raw.priorityBucket || raw.priority_bucket || { feerate: 1, estimated_seconds: 1 };
  const normal = raw.normalBuckets || raw.normal_buckets || [];
  const low = raw.lowBuckets || raw.low_buckets || [];
  
  const parseBucket = (b: any): FeerateBucket => ({
    feeRate: Number(b.feerate ?? b.feeRate ?? 1),
    estimatedSeconds: Number(b.estimated_seconds ?? b.estimatedSeconds ?? 60),
  });
  
  return {
    priorityBucket: parseBucket(priority),
    normalBuckets: Array.isArray(normal) ? normal.map(parseBucket) : [],
    lowBuckets: Array.isArray(low) ? low.map(parseBucket) : [],
  };
}

/**
 * Get fee rate for a given priority level
 */
function getFeeRateForPriority(
  estimate: FeeEstimate,
  priority: 'low' | 'normal' | 'priority'
): number {
  switch (priority) {
    case 'priority':
      return estimate.priorityBucket.feeRate;
    case 'normal':
      // Use first normal bucket, or interpolate between priority and low
      if (estimate.normalBuckets.length > 0) {
        return estimate.normalBuckets[0].feeRate;
      }
      // Fallback: average of priority and low
      const lowRate = estimate.lowBuckets[0]?.feeRate ?? 1;
      return (estimate.priorityBucket.feeRate + lowRate) / 2;
    case 'low':
      if (estimate.lowBuckets.length > 0) {
        return estimate.lowBuckets[0].feeRate;
      }
      return 100; // Toccata minimum: 100 sompi/gram
    default:
      return 1;
  }
}

/**
 * Get estimated confirmation time for a priority level
 */
function getEstimatedSeconds(
  estimate: FeeEstimate,
  priority: 'low' | 'normal' | 'priority'
): number {
  switch (priority) {
    case 'priority':
      return estimate.priorityBucket.estimatedSeconds;
    case 'normal':
      return estimate.normalBuckets[0]?.estimatedSeconds ?? 60;
    case 'low':
      return estimate.lowBuckets[0]?.estimatedSeconds ?? 3600;
    default:
      return 60;
  }
}

// =============================================================================
// NETWORK CONFIG
// =============================================================================

const NETWORK_IDS: Record<KaspaNetwork, NetworkId> = {
  'mainnet': NetworkId.Mainnet,
  'testnet-10': NetworkId.Testnet10,
  'testnet-11': NetworkId.Testnet11,
};

const EXPLORER_URLS: Record<KaspaNetwork, string> = {
  'mainnet': 'https://explorer.kaspa.org/txs/',
  'testnet-10': 'https://explorer-tn10.kaspa.org/txs/',
  'testnet-11': 'https://explorer-tn11.kaspa.org/txs/',
};

const FAUCET_URLS: Record<KaspaNetwork, string | null> = {
  'mainnet': null,
  'testnet-10': 'https://faucet-testnet.kas.fyi/',
  'testnet-11': 'https://faucet-testnet.kas.fyi/',
};

// Coinbase maturity - UTXOs from coinbase need 100 confirmations
const COINBASE_MATURITY = 100n;

// =============================================================================
// KASPA CLIENT
// =============================================================================

export class KaspaClient {
  private client: RpcClient | null = null;
  private network: KaspaNetwork;
  private state: ConnectionState = {
    connected: false,
    network: null,
    serverVersion: null,
    isSynced: false,
  };

  constructor(network: KaspaNetwork = 'mainnet') {
    this.network = network;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════

  async connect(): Promise<ServerInfo> {
    const networkId = NETWORK_IDS[this.network];
    
    // Create client with resolver - auto-selects fastest endpoint
    this.client = new RpcClient({
      resolver: new Resolver(),
      networkId,
    });

    await this.client.connect();

    // Get server info
    const info = await this.client.getServerInfo();
    
    this.state = {
      connected: true,
      network: this.network,
      serverVersion: info.serverVersion,
      isSynced: info.isSynced,
    };

    console.log(`[KaspaClient] Connected to ${this.network}`);
    console.log(`[KaspaClient] Server: ${info.serverVersion}, Synced: ${info.isSynced}`);

    return {
      serverVersion: info.serverVersion,
      isSynced: info.isSynced,
      virtualDaaScore: BigInt(info.virtualDaaScore),
      networkId: this.network,
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // RpcClient uses 'close' not 'disconnect'
      if (typeof (this.client as any).close === 'function') {
        await (this.client as any).close();
      }
      this.client = null;
    }
    this.state = {
      connected: false,
      network: null,
      serverVersion: null,
      isSynced: false,
    };
    console.log('[KaspaClient] Disconnected');
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BALANCE & UTXOS
  // ═══════════════════════════════════════════════════════════════════════════

  async getBalance(address: string): Promise<bigint> {
    this.ensureConnected();
    const response = await this.client!.getBalanceByAddress({ address });
    return BigInt(response.balance);
  }

  async getBalanceKAS(address: string): Promise<number> {
    const sompi = await this.getBalance(address);
    return Number(sompiToKaspa(sompi));
  }

  async getUtxos(addresses: string[]): Promise<UtxoEntry[]> {
    this.ensureConnected();
    const response = await this.client!.getUtxosByAddresses({ addresses });
    
    return (response.entries || []).map((e: any) => ({
      txId: e.outpoint.transactionId,
      index: e.outpoint.index,
      amount: BigInt(e.utxoEntry.amount),
      scriptPublicKey: e.utxoEntry.scriptPublicKey,
      blockDaaScore: BigInt(e.utxoEntry.blockDaaScore),
      isCoinbase: e.utxoEntry.isCoinbase || false,
    }));
  }

  async getSpendableUtxos(address: string): Promise<UtxoEntry[]> {
    this.ensureConnected();
    
    // Get current DAA score for coinbase maturity check
    const dagInfo = await this.client!.getBlockDagInfo();
    const currentDaaScore = BigInt(dagInfo.virtualDaaScore);
    
    const utxos = await this.getUtxos([address]);
    
    // Filter out immature coinbase UTXOs and covenant UTXOs
    return utxos.filter(utxo => {
      // Reject covenant/programmed UTXOs (non-standard scriptPublicKey)
      // Standard Kaspa P2PK: 35 bytes (70 hex chars) = OP_DATA_32 <pubkey> OP_CHECKSIG
      // Standard P2SH: 36 bytes (72 hex chars)
      // Anything longer is likely a covenant script — reject for FROST escrow safety
      const spkHex = typeof utxo.scriptPublicKey === 'string' 
        ? utxo.scriptPublicKey 
        : utxo.scriptPublicKey?.scriptPublicKey || '';
      if (spkHex.length > 72) {
        console.warn('[KaspaClient] Rejecting covenant UTXO:', utxo.txId, 'script length:', spkHex.length);
        return false;
      }
      if (!utxo.isCoinbase) return true;
      const age = currentDaaScore - utxo.blockDaaScore;
      return age >= COINBASE_MATURITY;
    });
  }

  async getSpendableBalance(address: string): Promise<bigint> {
    const utxos = await this.getSpendableUtxos(address);
    return utxos.reduce((sum: bigint, u) => sum + u.amount, 0n);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send KAS to an address
   * @param senderAddress - Sender's Kaspa address
   * @param recipientAddress - Recipient's Kaspa address
   * @param amountKAS - Amount in KAS (will be converted to sompi)
   * @param privateKeyHex - Sender's private key (hex string, 64 chars)
   * @param priorityFeeKAS - Optional priority fee in KAS
   */
  async sendKAS(
    senderAddress: string,
    recipientAddress: string,
    amountKAS: number,
    privateKeyHex: string,
    priorityFeeKAS: number = 0
  ): Promise<TransactionResult> {
    this.ensureConnected();

    const amount = BigInt(kaspaToSompi(amountKAS));
    const priorityFees = priorityFeeKAS > 0 
      ? new Fees(BigInt(kaspaToSompi(priorityFeeKAS))) 
      : undefined;

    // Get UTXOs - use getUtxosByAddresses with array, extract .entries
    const utxoResponse = await this.client!.getUtxosByAddresses({ addresses: [senderAddress] });
    const utxos = utxoResponse.entries;

    // Create send params
    const sendParams = new SendKasParams(
      senderAddress,
      amount,
      recipientAddress,
      NETWORK_IDS[this.network],
      priorityFees
    );

    // Generate and submit transactions
    const generator = new Generator(sendParams.toGeneratorSettings(utxos));
    
    let lastTxId: string | null = null;
    
    while (true) {
      const transaction = generator.generateTransaction();
      if (!transaction) break;
      
      transaction.sign([privateKeyHex]);
      
      const response = await this.client!.submitTransaction({
        transaction: transaction.toSubmittableJsonTx(),
        allowOrphan: false,
      });
      
      lastTxId = response.transactionId;
    }

    const finalTxId = generator.summary().finalTransactionId?.toHex() || lastTxId;
    
    if (!finalTxId) {
      throw new Error('Transaction failed - no transaction ID returned');
    }

    console.log(`[KaspaClient] Transaction sent: ${finalTxId}`);

    return {
      txId: finalTxId,
      explorerUrl: this.getExplorerUrl(finalTxId),
    };
  }

  /**
   * Broadcast a pre-signed transaction
   */
  async broadcastTransaction(signedTx: any): Promise<string> {
    this.ensureConnected();
    const response = await this.client!.submitTransaction({
      transaction: signedTx,
      allowOrphan: false,
    });
    return response.transactionId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER INFO
  // ═══════════════════════════════════════════════════════════════════════════

  async getServerInfo(): Promise<ServerInfo> {
    this.ensureConnected();
    const info = await this.client!.getServerInfo();
    return {
      serverVersion: info.serverVersion,
      isSynced: info.isSynced,
      virtualDaaScore: BigInt(info.virtualDaaScore),
      networkId: this.network,
    };
  }

  async getBlockDagInfo(): Promise<{ virtualDaaScore: bigint; networkName: string }> {
    this.ensureConnected();
    const info = await this.client!.getBlockDagInfo();
    return {
      virtualDaaScore: BigInt(info.virtualDaaScore),
      networkName: info.networkName,
    };
  }

  async getVirtualDaaScore(): Promise<bigint> {
    const info = await this.getBlockDagInfo();
    return info.virtualDaaScore;
  }

  async getFeeEstimate(): Promise<FeeEstimate> {
    this.ensureConnected();
    const raw = await this.client!.getFeeEstimate();
    return parseFeeEstimate(raw);
  }

  /**
   * Calculate fee for a transaction based on current network conditions
   * @param inputCount - Number of inputs (UTXOs being spent)
   * @param outputCount - Number of outputs
   * @param payloadBytes - Optional payload size in bytes
   * @param priority - Fee priority: 'low' | 'normal' | 'priority'
   */
  async calculateFee(
    inputCount: number,
    outputCount: number,
    payloadBytes: number = 0,
    priority: 'low' | 'normal' | 'priority' = 'normal'
  ): Promise<FeeCalculation> {
    // Get current fee estimate from network
    const estimate = await this.getFeeEstimate();
    
    // Calculate transaction mass
    const mass = calculateTransactionMass(inputCount, outputCount, payloadBytes);
    
    // Get appropriate fee rate based on priority
    const feeRate = getFeeRateForPriority(estimate, priority);
    
    // Calculate fee: fee = feeRate * mass (both in sompi/gram * grams = sompi)
    const feeSompi = BigInt(Math.ceil(feeRate * mass));
    
    // Ensure minimum relay fee
    const minFeeSompi = BigInt(mass); // 1 sompi/gram minimum
    const finalFeeSompi = feeSompi > minFeeSompi ? feeSompi : minFeeSompi;
    
    return {
      feeSompi: finalFeeSompi,
      feeKAS: Number(finalFeeSompi) / 1e8,
      mass,
      feeRate,
      priority,
      estimatedSeconds: getEstimatedSeconds(estimate, priority),
    };
  }

  /**
   * Get recommended fee for a simple send transaction
   * @param utxoCount - Number of UTXOs to spend (inputs)
   * @param priority - Fee priority
   */
  async getRecommendedFee(
    utxoCount: number = 1,
    priority: 'low' | 'normal' | 'priority' = 'normal'
  ): Promise<FeeCalculation> {
    // Simple send: N inputs, 2 outputs (recipient + change)
    return this.calculateFee(utxoCount, 2, 0, priority);
  }

  /**
   * Estimate fee for sending a specific amount
   * Accounts for UTXO selection and potential compound transactions
   * @param address - Sender address to check UTXOs
   * @param amountSompi - Amount to send in sompi
   * @param priority - Fee priority
   */
  async estimateSendFee(
  address: string,
  amountSompi: bigint,
  priority: 'low' | 'normal' | 'priority' = 'normal'
): Promise<FeeCalculation & { utxoCount: number; sufficientBalance: boolean }> {
  const utxos = await this.getUtxos([address]);
  const currentDaaScore = await this.getVirtualDaaScore();
  const spendable = utxos.filter(u => !u.isCoinbase || u.blockDaaScore < currentDaaScore - COINBASE_MATURITY);
    
    // Sort by amount descending for optimal selection
    spendable.sort((a, b) => Number(b.amount - a.amount));
    
    // Select UTXOs to cover amount + estimated fee
    let selected: typeof spendable = [];
    let total = 0n;
    let estimatedFee = 3000n; // Initial estimate
    
    for (const utxo of spendable) {
      selected.push(utxo);
      total += utxo.amount;
      
      // Recalculate fee with current input count
      const feeCalc = await this.calculateFee(selected.length, 2, 0, priority);
      estimatedFee = feeCalc.feeSompi;
      
      if (total >= amountSompi + estimatedFee) {
        break;
      }
    }
    
    const sufficientBalance = total >= amountSompi + estimatedFee;
    const finalFee = await this.calculateFee(selected.length, 2, 0, priority);
    
    return {
      ...finalFee,
      utxoCount: selected.length,
      sufficientBalance,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async subscribeUtxosChanged(
    addresses: string[],
    _callback: (data: any) => void
  ): Promise<string> {
    this.ensureConnected();
    // subscribeUtxosChanged takes string[] directly
    const uid = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.client!.subscribeUtxosChanged(addresses);
    // Note: callback handling via RpcClient event emitter, not param
    return uid;
  }

  async unsubscribeUtxosChanged(_uid: string): Promise<void> {
    this.ensureConnected();
    // unsubscribeUtxosChanged takes string[] directly
    await this.client!.unsubscribeUtxosChanged([]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  getExplorerUrl(txId: string): string {
    return EXPLORER_URLS[this.network] + txId;
  }

  getFaucetUrl(): string | null {
    return FAUCET_URLS[this.network];
  }

  getNetwork(): KaspaNetwork {
    return this.network;
  }

  setNetwork(network: KaspaNetwork): void {
    if (this.state.connected) {
      throw new Error('Cannot change network while connected. Disconnect first.');
    }
    this.network = network;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INSCRIPTIONS (OP_RETURN payloads)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send KAS with an inscription payload (OP_RETURN data)
   * Used for identity anchoring, FROST events, etc.
   * @param senderAddress - Sender's Kaspa address
   * @param recipientAddress - Recipient's address (can be same as sender for self-inscription)
   * @param amountSompi - Amount in sompi (use 0n for pure inscription)
   * @param payload - Data to inscribe (max 80 bytes recommended)
   * @param privateKeyHex - Sender's private key
   * @param priorityFeeSompi - Optional priority fee in sompi
   */
  async sendWithInscription(
    senderAddress: string,
    recipientAddress: string,
    amountSompi: bigint,
    payload: Uint8Array,
    privateKeyHex: string,
    priorityFeeSompi: bigint = 0n
  ): Promise<TransactionResult> {
    this.ensureConnected();

    if (payload.length > 80) {
      console.warn('[KaspaClient] Payload > 80 bytes may not be relayed by all nodes');
    }

    // Get UTXOs
    const utxoResponse = await this.client!.getUtxosByAddresses({ addresses: [senderAddress] });
    const utxos = utxoResponse.entries;

    // Calculate fee with payload
    const feeCalc = await this.calculateFee(utxos.length, 2, payload.length, 'normal');
    const totalFee = feeCalc.feeSompi + priorityFeeSompi;

    // Build transaction with payload
    // The SDK's Generator doesn't support arbitrary payloads, so we build manually
    const tx = await this.buildInscriptionTx(
      senderAddress,
      recipientAddress,
      amountSompi,
      payload,
      utxos,
      totalFee,
      privateKeyHex
    );

    // Submit
    const response = await this.client!.submitTransaction({
      transaction: tx,
      allowOrphan: false,
    });

    console.log(`[KaspaClient] Inscription TX sent: ${response.transactionId}`);

    return {
      txId: response.transactionId,
      explorerUrl: this.getExplorerUrl(response.transactionId),
    };
  }

  /**
   * Inscribe identity anchor to L1
   * @param pubkey - 32-byte x-only pubkey (hex)
   * @param aptHash - 8-byte APT hash (hex)
   * @param avatarHash - 8-byte avatar hash (hex)
   * @param privateKeyHex - Private key for signing
   */
  async inscribeIdentity(
    pubkey: string,
    aptHash: string,
    avatarHash: string,
    privateKeyHex: string
  ): Promise<TransactionResult> {
    // Build compact identity payload (≤80 bytes)
    // Format: "KV1" (3) + pubkey (32) + aptHash (8) + avatarHash (8) = 51 bytes
    const prefix = new TextEncoder().encode('KV1');
    const pubkeyBytes = hexToBytes(pubkey.slice(0, 64)); // 32 bytes
    const aptBytes = hexToBytes(aptHash.slice(0, 16));   // 8 bytes
    const avatarBytes = hexToBytes(avatarHash.slice(0, 16)); // 8 bytes

    const payload = new Uint8Array(prefix.length + pubkeyBytes.length + aptBytes.length + avatarBytes.length);
    payload.set(prefix, 0);
    payload.set(pubkeyBytes, prefix.length);
    payload.set(aptBytes, prefix.length + pubkeyBytes.length);
    payload.set(avatarBytes, prefix.length + pubkeyBytes.length + aptBytes.length);

    // Derive address from pubkey
    const address = xOnlyToKaspaAddress(pubkeyBytes, this.network === 'mainnet' ? 'kaspa' : 'kaspatest');

    // Self-inscription (send dust to self)
    return this.sendWithInscription(
      address,
      address,
      546n, // Dust amount
      payload,
      privateKeyHex
    );
  }

  /**
   * Inscribe FROST agreement event
   * @param eventType - 'C' (created), 'D' (completed), 'X' (deadlocked), 'R' (refunded)
   * @param agreementHash - 8-byte agreement ID hash
   * @param amountSompi - Agreement amount
   * @param privateKeyHex - Private key for signing
   * @param senderAddress - Sender address
   */
  async inscribeFrostEvent(
    eventType: 'C' | 'D' | 'X' | 'R',
    agreementHash: string,
    amountSompi: bigint,
    privateKeyHex: string,
    senderAddress: string
  ): Promise<TransactionResult> {
    // Build compact FROST event payload
    // Format: "KVF" (3) + eventType (1) + agreementHash (8) + amount (8) = 20 bytes
    const prefix = new TextEncoder().encode('KVF' + eventType);
    const agrBytes = hexToBytes(agreementHash.slice(0, 16));
    const amountBytes = bigintToBytes8(amountSompi);

    const payload = new Uint8Array(prefix.length + agrBytes.length + amountBytes.length);
    payload.set(prefix, 0);
    payload.set(agrBytes, prefix.length);
    payload.set(amountBytes, prefix.length + agrBytes.length);

    return this.sendWithInscription(
      senderAddress,
      senderAddress,
      546n,
      payload,
      privateKeyHex
    );
  }

  /**
   * Query transaction by ID
   */
  async getTransaction(txId: string): Promise<any> {
    this.ensureConnected();
    // Note: Not all nodes support getTransaction - may need to use explorer API
    try {
      return await (this.client as any).getTransaction({ transactionId: txId });
    } catch (e) {
      console.warn('[KaspaClient] getTransaction not supported, use explorer API');
      return null;
    }
  }

  /**
   * Build inscription transaction manually
   * (Internal helper - SDK Generator doesn't support payloads)
   */
  private async buildInscriptionTx(
    fromAddress: string,
    toAddress: string,
    amountSompi: bigint,
    payload: Uint8Array,
    utxos: any[],
    feeSompi: bigint,
    privateKeyHex: string
  ): Promise<any> {
    // Import signing utilities
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const { blake2b } = await import('@noble/hashes/blake2b');

    // Sort UTXOs by amount descending
    const sortedUtxos = [...utxos].sort((a, b) => 
      Number(BigInt(b.utxoEntry.amount) - BigInt(a.utxoEntry.amount))
    );

    // Select UTXOs to cover amount + fee
    const needed = amountSompi + feeSompi + 546n; // +dust for safety
    let total = 0n;
    const selectedUtxos: any[] = [];

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      total += BigInt(utxo.utxoEntry.amount);
      if (total >= needed) break;
    }

    if (total < needed) {
      throw new Error(`Insufficient balance: have ${total}, need ${needed}`);
    }

    const change = total - amountSompi - feeSompi;

    // Build inputs
    const inputs = selectedUtxos.map(u => ({
      previousOutpoint: {
        transactionId: u.outpoint.transactionId,
        index: u.outpoint.index,
      },
      signatureScript: '', // Filled after signing
      sequence: 0,
      sigOpCount: 1,
    }));

    // Build outputs
    const outputs: any[] = [];

    // Output 0: recipient (if amount > 0)
    if (amountSompi > 0n) {
      outputs.push({
        value: amountSompi.toString(),
        scriptPublicKey: addressToScriptPubKey(toAddress),
      });
    }

    // Output 1: change (if > dust)
    if (change > 546n) {
      outputs.push({
        value: change.toString(),
        scriptPublicKey: addressToScriptPubKey(fromAddress),
      });
    }

    // Output 2: OP_RETURN with payload
    if (payload.length > 0) {
      outputs.push({
        value: '0',
        scriptPublicKey: buildOpReturnScript(payload),
      });
    }

    // Build unsigned transaction
    const tx = {
      version: 0,
      inputs,
      outputs,
      lockTime: 0n,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: '',
    };

    // Sign each input
    const privKey = hexToBytes(privateKeyHex);
    
    for (let i = 0; i < inputs.length; i++) {
      const utxo = selectedUtxos[i];
      const sighash = computeSighash(tx, i, utxo.utxoEntry.amount, utxo.utxoEntry.scriptPublicKey);
      
      // BIP340 Schnorr signature
      const sig = secp256k1.sign(sighash, privKey).toCompactRawBytes();
      
      // Signature script: <sig>
      tx.inputs[i].signatureScript = bytesToHex(new Uint8Array([64, ...sig])); // 0x40 = push 64 bytes
    }

    return tx;
  }

  private ensureConnected(): void {
    if (!this.client || !this.state.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// =============================================================================
// INSCRIPTION HELPERS
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bigintToBytes8(val: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[7 - i] = Number((val >> BigInt(i * 8)) & 0xFFn);
  }
  return bytes;
}

function xOnlyToKaspaAddress(xOnly: Uint8Array, prefix: string = 'kaspa'): string {
  // Correct Kaspa bech32 — 40-bit polymod, 8-char checksum
  // Ported from rusty-kaspa/crypto/addresses/src/bech32.rs
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function kaspaPolymod(values: number[]): bigint {
    let c = 1n;
    for (const d of values) {
      const c0 = c >> 35n;
      c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
      if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
      if (c0 & 0x02n) c ^= 0x79b76d99e2n;
      if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
      if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
      if (c0 & 0x10n) c ^= 0x1e4f43e470n;
    }
    return c ^ 1n;
  }

  function conv8to5(payload: number[]): number[] {
    const result: number[] = [];
    let buff = 0, bits = 0;
    for (const c of payload) {
      buff = (buff << 8) | c; bits += 8;
      while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
    }
    if (bits > 0) result.push((buff << (5 - bits)) & 31);
    return result;
  }

  const fullPayload = [0, ...Array.from(xOnly)];
  const fivebitPayload = conv8to5(fullPayload);
  const fivebitPrefix = Array.from(prefix).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = conv8to5(csBytes);
  
  let addr = prefix + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += BECH32_CHARSET[d];
  return addr;
}

function addressToScriptPubKey(address: string): string {
  // Decode bech32m address to get x-only pubkey
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  
  const colonIdx = address.indexOf(':');
  const data = address.slice(colonIdx + 1);
  
  // Decode 5-bit to 8-bit
  const data5bit: number[] = [];
  for (const c of data) {
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx >= 0) data5bit.push(idx);
  }
  
  // Remove checksum (last 8 — Kaspa uses 8-char checksum)
  const payload5bit = data5bit.slice(0, -8);
  
  // Convert to 8-bit
  let acc = 0, bits = 0;
  const payload8bit: number[] = [];
  for (const v of payload5bit) {
    acc = (acc << 5) | v; bits += 5;
    while (bits >= 8) { bits -= 8; payload8bit.push((acc >> bits) & 0xff); }
  }
  
  // Skip version byte, get 32-byte pubkey
  const pubkey = new Uint8Array(payload8bit.slice(1, 33));
  
  // P2PK script: <pubkey> OP_CHECKSIG
  // 0x20 = push 32 bytes, 0xac = OP_CHECKSIG
  const script = new Uint8Array(34);
  script[0] = 0x20;
  script.set(pubkey, 1);
  script[33] = 0xac;
  
  return bytesToHex(script);
}

function buildOpReturnScript(data: Uint8Array): string {
  // OP_RETURN (0x6a) + push opcode + data
  const pushOp = data.length < 76 ? data.length : 76;
  const script = new Uint8Array(2 + data.length);
  script[0] = 0x6a; // OP_RETURN
  script[1] = pushOp;
  script.set(data, 2);
  return bytesToHex(script);
}

function computeSighash(
  tx: any,
  inputIndex: number,
  amount: string | bigint,
  scriptPubKey: string
): Uint8Array {
  // Kaspa sighash uses Blake2b-256
  // This is a simplified version - full impl needs SIGHASH_ALL serialization
  const { blake2b } = require('@noble/hashes/blake2b');
  
  const data = new TextEncoder().encode(JSON.stringify({
    tx,
    inputIndex,
    amount: amount.toString(),
    scriptPubKey,
  }));
  
  return blake2b(data, { dkLen: 32 });
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let defaultClient: KaspaClient | null = null;

export function getKaspaClient(network: KaspaNetwork = 'mainnet'): KaspaClient {
  if (!defaultClient || defaultClient.getNetwork() !== network) {
    defaultClient = new KaspaClient(network);
  }
  return defaultClient;
}

// =============================================================================
// REACT HOOK (for React Native)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export interface UseKaspaClientResult {
  client: KaspaClient;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  serverInfo: ServerInfo | null;
  connect: (network?: KaspaNetwork) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useKaspaClient(initialNetwork: KaspaNetwork = 'mainnet'): UseKaspaClientResult {
  const [client] = useState(() => new KaspaClient(initialNetwork));
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  const connect = useCallback(async (network?: KaspaNetwork) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (network && network !== client.getNetwork()) {
        if (client.isConnected()) {
          await client.disconnect();
        }
        client.setNetwork(network);
      }
      
      const info = await client.connect();
      setServerInfo(info);
      setIsConnected(true);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  const disconnect = useCallback(async () => {
    try {
      await client.disconnect();
      setIsConnected(false);
      setServerInfo(null);
    } catch (e: any) {
      setError(e.message || 'Disconnect failed');
    }
  }, [client]);

  useEffect(() => {
    return () => {
      client.disconnect().catch(() => {});
    };
  }, [client]);

  return {
    client,
    isConnected,
    isConnecting,
    error,
    serverInfo,
    connect,
    disconnect,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { kaspaToSompi, sompiToKaspa } from '@kcoin/kaspa-web3.js';
// ============================================================================
// REST API TRANSACTION SUBMIT (works without wRPC)
// ============================================================================

export async function submitTransactionREST(
  txHex: string,
  network: "mainnet" | "testnet" = "testnet"
): Promise<{ txId: string; success: boolean; error?: string }> {
  const apiBase = network === "mainnet"
    ? "https://api.kaspa.org"
    : "https://api-tn10.kaspa.org";

  try {
    const resp = await fetch(`${apiBase}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: txHex }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { txId: "", success: false, error: err };
    }

    const data = await resp.json();
    return {
      txId: data.transactionId || data.transaction_id || "",
      success: true,
    };
  } catch (e: any) {
    return { txId: "", success: false, error: e.message };
  }
}

export default KaspaClient;