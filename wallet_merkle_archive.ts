// wallet_merkle_archive.ts
// Personal State Proof Engine for KasVillage — v2 Dual Commitment
// Every UTXO refresh → fetch block header utxoCommitment (MuHash) + compute SHA256 merkle root
// Dual commitment: quantum-vulnerable MuHash (native) + quantum-resistant SHA256 (ours)
// Persisted locally (SecureStore) + permanently (Arweave)
// No Node.js built-ins — React Native / Hermes safe

import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface UtxoLeaf {
  transaction_id: string;
  index: number;
  amount: number; // sompi
  script_public_key: string;
  block_daa_score: number;
}

/** Block header fields captured from Kaspa REST API */
export interface CapturedBlockHeader {
  /** Block hash (tip at time of snapshot) */
  block_hash: string;
  /** Kaspa's native MuHash UTXO commitment — compressed global state */
  utxo_commitment: string;
  /** Merkle root of transactions in the block */
  hash_merkle_root: string;
  /** Accepted ID merkle root */
  accepted_id_merkle_root: string;
  /** DAA score of this block */
  daa_score: number;
  /** Blue score */
  blue_score: number;
  /** Block timestamp (ms) */
  timestamp: number;
  /** Pruning point hash at time of block */
  pruning_point: string;
}

export interface DualCommitment {
  /** Kaspa native MuHash — global UTXO set commitment (quantum-vulnerable) */
  kaspa_utxo_commitment: string;
  /** Our SHA256 merkle root of wallet UTXOs (quantum-resistant) */
  sha256_merkle_root: string;
  /** Block hash this commitment is anchored to */
  anchor_block_hash: string;
  /** DAA score at anchor */
  anchor_daa_score: number;
}

export interface StateSnapshot {
  snapshot_id: number;
  /** Dual commitment: MuHash (global) + SHA256 (local) */
  dual_commitment: DualCommitment;
  /** Full captured block header from Kaspa L1 */
  block_header: CapturedBlockHeader;
  /** ISO timestamp when snapshot was taken */
  timestamp: string;
  /** Total balance (sompi) at snapshot time */
  total_balance: number;
  /** Number of UTXOs in this snapshot */
  utxo_count: number;
  /** Arweave TX ID once uploaded (null = local only) */
  arweave_tx_id: string | null;
}

export interface MerkleProofPath {
  siblings: string[];
  directions: number[];
}

export interface FullMerkleTree {
  leaves: string[];
  utxos: UtxoLeaf[];
  root: string;
  snapshot: StateSnapshot;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY_SNAPSHOTS = 'kv_merkle_snapshots';
const SECURE_STORE_KEY_LATEST_TREE = 'kv_merkle_latest_tree';
const MAX_STORED_SNAPSHOTS = 100;

// Kaspa REST endpoints (no wRPC)
const REST_MAINNET = [
  'https://api.kaspa.org',
  'https://api-1.kaspa.org',
];
const REST_TESTNET = [
  'https://api-tn10.kaspa.org',
  'https://api-tn10.kaspa.org',
];

// ============================================================================
// KASPA REST — BLOCK HEADER FETCHING
// ============================================================================

/**
 * Fetch current tip block header from Kaspa REST API.
 * Flow: GET /info/blockdag → tip_hashes[0] → GET /blocks/{hash}
 */
export async function fetchTipBlockHeader(
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<CapturedBlockHeader> {
  const endpoints = network === 'mainnet' ? REST_MAINNET : REST_TESTNET;

  for (const base of endpoints) {
    try {
      // Step 1: Get blockdag info for tip hash
      const dagResp = await fetch(`${base}/info/blockdag`);
      if (!dagResp.ok) continue;
      const dagInfo = await dagResp.json();

      const tipHash: string | undefined =
        dagInfo.tipHashes?.[0] || dagInfo.tip_hashes?.[0];
      if (!tipHash) continue;

      // Step 2: Fetch block by tip hash
      const blockResp = await fetch(`${base}/blocks/${tipHash}`);
      if (!blockResp.ok) continue;
      const block = await blockResp.json();
      const h = block.header;
      if (!h?.utxoCommitment) continue;

      return {
        block_hash: tipHash,
        utxo_commitment: h.utxoCommitment,
        hash_merkle_root: h.hashMerkleRoot,
        accepted_id_merkle_root: h.acceptedIdMerkleRoot,
        daa_score: Number(h.daaScore || dagInfo.virtualDaaScore || dagInfo.virtual_daa_score || 0),
        blue_score: Number(h.blueScore || 0),
        timestamp: Number(h.timestamp || 0),
        pruning_point: h.pruningPoint || '',
      };
    } catch (e) {
      console.warn(`[MerkleArchive] REST ${base} failed:`, e);
      continue;
    }
  }

  throw new Error('[MerkleArchive] All REST endpoints failed to fetch tip block header');
}

// ============================================================================
// SHA256 MERKLE TREE (pure, no dependencies beyond @noble/hashes)
// ============================================================================

export function hashUtxoLeaf(utxo: UtxoLeaf): Uint8Array {
  const encoder = new TextEncoder();
  const canonical = `${utxo.transaction_id}:${utxo.index}:${utxo.amount}:${utxo.script_public_key}:${utxo.block_daa_score}`;
  return sha256(encoder.encode(canonical));
}

function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(64);
  combined.set(left, 0);
  combined.set(right, 32);
  return sha256(combined);
}

export function buildMerkleTree(leaves: Uint8Array[]): Uint8Array[][] {
  if (leaves.length === 0) {
    return [[new Uint8Array(32)]];
  }

  const paddedLeaves = [...leaves];
  while (paddedLeaves.length & (paddedLeaves.length - 1)) {
    paddedLeaves.push(new Uint8Array(32));
  }
  if (paddedLeaves.length === 0) paddedLeaves.push(new Uint8Array(32));

  const levels: Uint8Array[][] = [paddedLeaves];
  let current = paddedLeaves;

  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] || new Uint8Array(32);
      next.push(hashPair(left, right));
    }
    levels.push(next);
    current = next;
  }

  return levels;
}

export function getMerkleRoot(levels: Uint8Array[][]): string {
  const topLevel = levels[levels.length - 1];
  return bytesToHex(topLevel[0]);
}

export function generateMerkleProof(levels: Uint8Array[][], leafIndex: number): MerkleProofPath {
  const siblings: string[] = [];
  const directions: number[] = [];
  let idx = leafIndex;

  for (let level = 0; level < levels.length - 1; level++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = levels[level][siblingIdx] || new Uint8Array(32);

    siblings.push(bytesToHex(sibling));
    directions.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { siblings, directions };
}

export function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofPath,
  expectedRoot: string
): boolean {
  let current = hexToBytes(leafHash);

  for (let i = 0; i < proof.siblings.length; i++) {
    const sibling = hexToBytes(proof.siblings[i]);
    if (proof.directions[i] === 1) {
      current = hashPair(sibling, current);
    } else {
      current = hashPair(current, sibling);
    }
  }

  return bytesToHex(current) === expectedRoot;
}

// ============================================================================
// WALLET STATE PROOF ENGINE — DUAL COMMITMENT
// ============================================================================

export class WalletMerkleArchive {
  private snapshots: StateSnapshot[] = [];
  private latestTree: FullMerkleTree | null = null;
  private nextSnapshotId: number = 0;
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
  }

  async initialize(): Promise<void> {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY_SNAPSHOTS);
      if (raw) {
        this.snapshots = JSON.parse(raw);
        this.nextSnapshotId = this.snapshots.length > 0
          ? Math.max(...this.snapshots.map(s => s.snapshot_id)) + 1
          : 0;
      }
    } catch (e) {
      console.warn('[MerkleArchive] Failed to load snapshots:', e);
    }

    try {
      const rawTree = await SecureStore.getItemAsync(SECURE_STORE_KEY_LATEST_TREE);
      if (rawTree) {
        this.latestTree = JSON.parse(rawTree);
      }
    } catch (e) {
      console.warn('[MerkleArchive] Failed to load latest tree:', e);
    }
  }

  /**
   * Take a dual-commitment snapshot:
   * 1. Fetch Kaspa tip block header → capture utxoCommitment (MuHash global state)
   * 2. Compute SHA256 merkle root of wallet UTXOs (quantum-resistant local state)
   * 3. Store both together as a DualCommitment
   */
  async takeSnapshot(utxos: UtxoLeaf[]): Promise<StateSnapshot> {
    // 1. Fetch Kaspa block header with MuHash utxoCommitment
    let blockHeader: CapturedBlockHeader;
    try {
      blockHeader = await fetchTipBlockHeader(this.network);
    } catch (e) {
      // If REST fails, store with empty MuHash — SHA256 root still valid
      console.warn('[MerkleArchive] Block header fetch failed, SHA256-only snapshot:', e);
      blockHeader = {
        block_hash: '',
        utxo_commitment: '',
        hash_merkle_root: '',
        accepted_id_merkle_root: '',
        daa_score: utxos.reduce((max, u) => Math.max(max, u.block_daa_score), 0),
        blue_score: 0,
        timestamp: Date.now(),
        pruning_point: '',
      };
    }

    // 2. Hash each UTXO into a leaf & build SHA256 merkle tree
    const leafHashes = utxos.map(u => hashUtxoLeaf(u));
    const leafHexes = leafHashes.map(h => bytesToHex(h));
    const levels = buildMerkleTree(leafHashes);
    const sha256Root = getMerkleRoot(levels);

    // 3. Build dual commitment
    const dualCommitment: DualCommitment = {
      kaspa_utxo_commitment: blockHeader.utxo_commitment,
      sha256_merkle_root: sha256Root,
      anchor_block_hash: blockHeader.block_hash,
      anchor_daa_score: blockHeader.daa_score,
    };

    const totalBalance = utxos.reduce((sum, u) => sum + u.amount, 0);

    // 4. Create snapshot
    const snapshot: StateSnapshot = {
      snapshot_id: this.nextSnapshotId++,
      dual_commitment: dualCommitment,
      block_header: blockHeader,
      timestamp: new Date().toISOString(),
      total_balance: totalBalance,
      utxo_count: utxos.length,
      arweave_tx_id: null,
    };

    // 5. Store full tree
    this.latestTree = {
      leaves: leafHexes,
      utxos,
      root: sha256Root,
      snapshot,
    };

    // 6. Append & trim
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_STORED_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_STORED_SNAPSHOTS);
    }

    await this.persist();
    return snapshot;
  }

  private async persist(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        SECURE_STORE_KEY_SNAPSHOTS,
        JSON.stringify(this.snapshots)
      );
      if (this.latestTree) {
        await SecureStore.setItemAsync(
          SECURE_STORE_KEY_LATEST_TREE,
          JSON.stringify(this.latestTree)
        );
      }
    } catch (e) {
      console.error('[MerkleArchive] Persist failed:', e);
    }
  }

  /** Generate proof that a specific UTXO exists in the latest snapshot */
  proveUtxoInclusion(transactionId: string, index: number): {
    proof: MerkleProofPath;
    leaf_hash: string;
    dual_commitment: DualCommitment;
    snapshot: StateSnapshot;
  } | null {
    if (!this.latestTree) return null;

    const utxoIdx = this.latestTree.utxos.findIndex(
      u => u.transaction_id === transactionId && u.index === index
    );
    if (utxoIdx === -1) return null;

    const leafHashes = this.latestTree.utxos.map(u => hashUtxoLeaf(u));
    const levels = buildMerkleTree(leafHashes);
    const proof = generateMerkleProof(levels, utxoIdx);

    return {
      proof,
      leaf_hash: this.latestTree.leaves[utxoIdx],
      dual_commitment: this.latestTree.snapshot.dual_commitment,
      snapshot: this.latestTree.snapshot,
    };
  }

  /** Compare local state vs fresh UTXO fetch to detect changes */
  detectChanges(freshUtxos: UtxoLeaf[]): {
    changed: boolean;
    added: UtxoLeaf[];
    removed: UtxoLeaf[];
    balanceDelta: number;
  } {
    if (!this.latestTree) {
      return {
        changed: true,
        added: freshUtxos,
        removed: [],
        balanceDelta: freshUtxos.reduce((s, u) => s + u.amount, 0),
      };
    }

    const oldSet = new Set(this.latestTree.utxos.map(u => `${u.transaction_id}:${u.index}`));
    const newSet = new Set(freshUtxos.map(u => `${u.transaction_id}:${u.index}`));

    const added = freshUtxos.filter(u => !oldSet.has(`${u.transaction_id}:${u.index}`));
    const removed = this.latestTree.utxos.filter(u => !newSet.has(`${u.transaction_id}:${u.index}`));

    const oldBalance = this.latestTree.utxos.reduce((s, u) => s + u.amount, 0);
    const newBalance = freshUtxos.reduce((s, u) => s + u.amount, 0);

    return {
      changed: added.length > 0 || removed.length > 0,
      added,
      removed,
      balanceDelta: newBalance - oldBalance,
    };
  }

  /** Build Arweave upload payload — includes dual commitment + full tree */
  buildArweavePayload(): {
    data: string;
    tags: { name: string; value: string }[];
  } | null {
    if (!this.latestTree) return null;

    const dc = this.latestTree.snapshot.dual_commitment;
    const payload = {
      version: 'KV_MERKLE_ARCHIVE_V2_DUAL',
      dual_commitment: dc,
      tree: this.latestTree,
      history: this.snapshots.slice(-10),
    };

    return {
      data: JSON.stringify(payload),
      tags: [
        { name: 'App-Name', value: 'KasVillage' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Type', value: 'wallet-state-proof-v2' },
        { name: 'SHA256-Merkle-Root', value: dc.sha256_merkle_root },
        { name: 'Kaspa-UTXO-Commitment', value: dc.kaspa_utxo_commitment },
        { name: 'Anchor-Block', value: dc.anchor_block_hash },
        { name: 'DAA-Score', value: String(dc.anchor_daa_score) },
        { name: 'UTXO-Count', value: String(this.latestTree.snapshot.utxo_count) },
        { name: 'Snapshot-ID', value: String(this.latestTree.snapshot.snapshot_id) },
      ],
    };
  }

  async markArweaveUploaded(arweaveTxId: string): Promise<void> {
    if (this.latestTree) {
      this.latestTree.snapshot.arweave_tx_id = arweaveTxId;
    }
    const last = this.snapshots[this.snapshots.length - 1];
    if (last) {
      last.arweave_tx_id = arweaveTxId;
    }
    await this.persist();
  }

  getSnapshots(): StateSnapshot[] { return [...this.snapshots]; }
  getLatestTree(): FullMerkleTree | null { return this.latestTree; }
  getLatestRoot(): string | null { return this.latestTree?.root ?? null; }
  getLatestDualCommitment(): DualCommitment | null {
    return this.latestTree?.snapshot.dual_commitment ?? null;
  }

  /** Export compact proof chain for cross-device transfer */
  exportProofChain(): {
    snapshots: StateSnapshot[];
    latest_dual_commitment: DualCommitment | null;
  } {
    return {
      snapshots: this.snapshots,
      latest_dual_commitment: this.getLatestDualCommitment(),
    };
  }

  async reset(): Promise<void> {
    this.snapshots = [];
    this.latestTree = null;
    this.nextSnapshotId = 0;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_SNAPSHOTS);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_LATEST_TREE);
  }
}

// ============================================================================
// SINGLETON & INTEGRATION HOOKS
// ============================================================================

let _archiveInstance: WalletMerkleArchive | null = null;

export async function getArchive(
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<WalletMerkleArchive> {
  if (!_archiveInstance) {
    _archiveInstance = new WalletMerkleArchive(network);
    await _archiveInstance.initialize();
  }
  return _archiveInstance;
}

/**
 * Call every time UTXOs are fetched/refreshed.
 * Detects changes → takes dual-commitment snapshot if changed.
 * Fetches Kaspa block header (REST) for MuHash utxoCommitment.
 */
export async function onUtxoRefresh(
  utxos: UtxoLeaf[],
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<{
  changed: boolean;
  snapshot: StateSnapshot | null;
  added: UtxoLeaf[];
  removed: UtxoLeaf[];
  balanceDelta: number;
}> {
  const archive = await getArchive(network);
  const delta = archive.detectChanges(utxos);

  if (!delta.changed) {
    return { changed: false, snapshot: null, added: [], removed: [], balanceDelta: 0 };
  }

  const snapshot = await archive.takeSnapshot(utxos);
  return {
    changed: true,
    snapshot,
    added: delta.added,
    removed: delta.removed,
    balanceDelta: delta.balanceDelta,
  };
}

/**
 * Upload current dual-commitment state proof to Arweave.
 */
export async function uploadStateProofToArweave(
  uploadFn: (data: string, tags: { name: string; value: string }[]) => Promise<string>,
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<string | null> {
  const archive = await getArchive(network);
  const payload = archive.buildArweavePayload();
  if (!payload) return null;

  const txId = await uploadFn(payload.data, payload.tags);
  await archive.markArweaveUploaded(txId);
  return txId;
}

// ============================================================================
// PER-TX PROOF UPLOAD (called after every send)
// ============================================================================
export async function uploadPerTxProof(params: {
  txId: string;
  txIndex: number;
  amountSompi: bigint | number;
  scriptPubKey: string;
  daaScore: number;
  txType: string;
  balanceAfter: number;
  agreementId?: string;
  uploadFn?: (data: string, tags: {name: string; value: string}[]) => Promise<string>;
  network?: string;
}): Promise<string | null> {
  try {
    // Fetch global Kaspa state (MuHash + block header) at time of TX
    let blockAnchor: CapturedBlockHeader | null = null;
    try {
      blockAnchor = await fetchTipBlockHeader(params.network === 'mainnet' ? 'mainnet' : 'testnet-10');
    } catch (e) { console.warn('[MerkleArchive] Block header fetch failed:', e); }

    const proof = {
      v: 'KV_UTXO_PROOF_V2',
      txId: params.txId,
      txIndex: params.txIndex,
      amount: params.amountSompi.toString(),
      scriptPubKey: params.scriptPubKey,
      daaScore: blockAnchor?.daaScore || params.daaScore,
      txType: params.txType,
      // Global Kaspa L1 state at time of TX
      kaspa_block_hash: blockAnchor?.block_hash || null,
      kaspa_utxo_commitment: blockAnchor?.utxo_commitment || null,
      kaspa_timestamp: blockAnchor?.timestamp || null,
      kaspa_daa_score: blockAnchor?.daa_score || null,
      balanceAfter: params.balanceAfter,
      agreementId: params.agreementId || null,
      timestamp: Date.now(),
    };
    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'KV-Type', value: 'utxo-proof-v1' },
      { name: 'KV-TxId', value: params.txId },
      { name: 'KV-TxType', value: params.txType },
      { name: 'KV-Network', value: params.network || 'testnet' },
      { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
    ];
    if (params.uploadFn) {
      const arTxId = await params.uploadFn(JSON.stringify(proof), tags);
      if (!arTxId) { console.log('[MerkleArchive] Per-TX proof skipped (uploader returned no id)'); return null; }
      console.log('[MerkleArchive] Per-TX proof uploaded:', arTxId);
      return arTxId;
    }
    return null;
  } catch (e) {
    console.warn('[MerkleArchive] Per-TX proof failed:', e);
    return null;
  }
}