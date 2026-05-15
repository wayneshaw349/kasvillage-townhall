// ============================================================================
// KASVILLAGE - UNIFIED UTXO LEDGER
// ============================================================================
// Single source of truth for what's spendable in the wallet.
// Every send path must check this ledger before spending.
//
// UTXO States:
//   free              — available to spend or commit
//   iou-allocated     — backing an IOU, can't spend until settled
//   collateral-committed — pledged to agreement, auto-send pending
//   collateral-locked — sent to FROST address (consumed on L1)
//
// Flow:
//   User agrees to collateral → commitUtxos() marks as 'collateral-committed'
//   Auto-send fires → markLocked() changes to 'collateral-locked'
//   L1 confirms → UTXO disappears from REST (consumed), ledger auto-cleans
//   IOU issued → allocateForIOU() marks as 'iou-allocated'
//   IOU settled → releaseIOU() marks as 'free'
//
// ALL send functions call getSpendableUtxos() which filters out non-free UTXOs
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// TYPES
// ============================================================================

export type UtxoStatus = 'free' | 'iou-allocated' | 'collateral-committed' | 'collateral-locked';

export interface LedgerEntry {
  utxoKey: string;           // "txId:index"
  txId: string;
  index: number;
  amountSompi: string;       // BigInt as string for storage
  status: UtxoStatus;
  commitReason?: string;     // agreementId or iouId
  committedAt?: number;      // timestamp
}

export interface SpendableResult {
  totalBalance: bigint;      // all UTXOs on L1
  committedBalance: bigint;  // collateral-committed + collateral-locked
  iouAllocated: bigint;      // iou-allocated
  spendableBalance: bigint;  // free only
  utxos: LedgerEntry[];      // free UTXOs only
  allEntries: LedgerEntry[]; // everything
}

// ============================================================================
// STORAGE
// ============================================================================

const LEDGER_KEY = 'kv_utxo_ledger';
const NETWORK_KEY = 'kaspa_network';

async function loadLedger(): Promise<Map<string, LedgerEntry>> {
  try {
    const json = await AsyncStorage.getItem(LEDGER_KEY);
    if (!json) return new Map();
    const arr: LedgerEntry[] = JSON.parse(json);
    return new Map(arr.map(e => [e.utxoKey, e]));
  } catch {
    return new Map();
  }
}

async function saveLedger(ledger: Map<string, LedgerEntry>): Promise<void> {
  const arr = Array.from(ledger.values());
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(arr));
}

// ============================================================================
// API HELPER
// ============================================================================

async function getApiBase(): Promise<string> {
  const networkStr = await SecureStore.getItemAsync(NETWORK_KEY);
  const isTestnet = networkStr?.includes('testnet');
  return isTestnet ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
}

// ============================================================================
// SYNC WITH L1
// ============================================================================

/**
 * Sync ledger with L1 UTXOs.
 * - New UTXOs from L1 → added as 'free'
 * - UTXOs consumed on L1 (no longer in REST response) → removed from ledger
 * - Existing ledger entries keep their status (committed/allocated stays)
 */
export async function syncLedger(address: string): Promise<SpendableResult> {
  const apiBase = await getApiBase();
  const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);
  if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);
  const rawUtxos: any[] = await resp.json();

  const ledger = await loadLedger();

  // Build set of L1 UTXOs
  const l1Keys = new Set<string>();
  for (const u of rawUtxos) {
    const txId = u.outpoint?.transactionId || u.transactionId || '';
    const index = u.outpoint?.index ?? u.index ?? 0;
    const key = `${txId}:${index}`;
    const amount = u.utxoEntry?.amount || u.amount || '0';
    l1Keys.add(key);

    if (!ledger.has(key)) {
      // New UTXO from L1 — mark as free
      ledger.set(key, {
        utxoKey: key,
        txId,
        index,
        amountSompi: String(amount),
        status: 'free',
      });
    }
  }

  // Remove entries consumed on L1 (collateral-locked UTXOs that are now spent)
  for (const [key, entry] of ledger) {
    if (!l1Keys.has(key)) {
      // UTXO no longer on L1 — consumed
      ledger.delete(key);
    }
  }

  await saveLedger(ledger);
  return computeBalances(ledger);
}

// ============================================================================
// BALANCE COMPUTATION
// ============================================================================

function computeBalances(ledger: Map<string, LedgerEntry>): SpendableResult {
  let totalBalance = 0n;
  let committedBalance = 0n;
  let iouAllocated = 0n;
  let spendableBalance = 0n;
  const freeUtxos: LedgerEntry[] = [];
  const allEntries: LedgerEntry[] = [];

  for (const entry of ledger.values()) {
    const amt = BigInt(entry.amountSompi);
    totalBalance += amt;
    allEntries.push(entry);

    switch (entry.status) {
      case 'free':
        spendableBalance += amt;
        freeUtxos.push(entry);
        break;
      case 'iou-allocated':
        iouAllocated += amt;
        break;
      case 'collateral-committed':
      case 'collateral-locked':
        committedBalance += amt;
        break;
    }
  }

  return {
    totalBalance,
    committedBalance,
    iouAllocated,
    spendableBalance,
    utxos: freeUtxos,
    allEntries,
  };
}

// ============================================================================
// COMMIT / RESERVE OPERATIONS
// ============================================================================

/**
 * Check if wallet has enough spendable balance for an amount.
 * Call BEFORE agreeing to any collateral or IOU.
 */
export async function canSpend(address: string, amountSompi: bigint): Promise<{
  ok: boolean;
  spendable: bigint;
  total: bigint;
  committed: bigint;
  iouAllocated: bigint;
  shortage?: bigint;
}> {
  const result = await syncLedger(address);
  if (result.spendableBalance >= amountSompi) {
    return {
      ok: true,
      spendable: result.spendableBalance,
      total: result.totalBalance,
      committed: result.committedBalance,
      iouAllocated: result.iouAllocated,
    };
  }
  return {
    ok: false,
    spendable: result.spendableBalance,
    total: result.totalBalance,
    committed: result.committedBalance,
    iouAllocated: result.iouAllocated,
    shortage: amountSompi - result.spendableBalance,
  };
}

/**
 * Commit UTXOs for collateral. Called when user agrees to an agreement.
 * Marks enough free UTXOs as 'collateral-committed' to cover the amount.
 * Returns the committed UTXO keys (for tracking).
 */
export async function commitForCollateral(
  address: string,
  amountSompi: bigint,
  agreementId: string
): Promise<{ success: boolean; committedKeys: string[]; error?: string }> {
  const result = await syncLedger(address);

  if (result.spendableBalance < amountSompi) {
    return {
      success: false,
      committedKeys: [],
      error: `Insufficient spendable balance. Have ${Number(result.spendableBalance) / 1e8} KASPA free, need ${Number(amountSompi) / 1e8} KASPA. ${result.committedBalance > 0n ? `${Number(result.committedBalance) / 1e8} KASPA already committed to other agreements.` : ''} ${result.iouAllocated > 0n ? `${Number(result.iouAllocated) / 1e8} KASPA allocated to IOUs.` : ''}`.trim(),
    };
  }

  const ledger = await loadLedger();
  let remaining = amountSompi;
  const committedKeys: string[] = [];

  // Sort free UTXOs by amount ascending (use smallest first)
  const freeEntries = Array.from(ledger.values())
    .filter(e => e.status === 'free')
    .sort((a, b) => Number(BigInt(a.amountSompi) - BigInt(b.amountSompi)));

  for (const entry of freeEntries) {
    if (remaining <= 0n) break;
    entry.status = 'collateral-committed';
    entry.commitReason = agreementId;
    entry.committedAt = Date.now();
    committedKeys.push(entry.utxoKey);
    remaining -= BigInt(entry.amountSompi);
  }

  await saveLedger(ledger);
  console.log(`[UTXO-Ledger] Committed ${committedKeys.length} UTXOs for ${agreementId}, remaining free: ${Number(result.spendableBalance - amountSompi) / 1e8} KASPA`);
  return { success: true, committedKeys };
}

/**
 * Mark committed UTXOs as locked (sent to FROST).
 * Called after sendKaspaViaRest succeeds for collateral.
 */
export async function markLocked(agreementId: string): Promise<void> {
  const ledger = await loadLedger();
  for (const entry of ledger.values()) {
    if (entry.status === 'collateral-committed' && entry.commitReason === agreementId) {
      entry.status = 'collateral-locked';
    }
  }
  await saveLedger(ledger);
  console.log(`[UTXO-Ledger] Marked ${agreementId} UTXOs as locked`);
}

/**
 * Release committed UTXOs back to free (agreement cancelled before sending).
 */
export async function releaseCommitment(agreementId: string): Promise<void> {
  const ledger = await loadLedger();
  for (const entry of ledger.values()) {
    if (entry.commitReason === agreementId && (entry.status === 'collateral-committed')) {
      entry.status = 'free';
      entry.commitReason = undefined;
      entry.committedAt = undefined;
    }
  }
  await saveLedger(ledger);
  console.log(`[UTXO-Ledger] Released commitment for ${agreementId}`);
}

/**
 * Allocate UTXOs for IOU backing.
 * Similar to commitForCollateral but uses 'iou-allocated' status.
 */
export async function allocateForIOU(
  address: string,
  amountSompi: bigint,
  iouId: string
): Promise<{ success: boolean; allocatedKeys: string[]; error?: string }> {
  const result = await syncLedger(address);

  if (result.spendableBalance < amountSompi) {
    return {
      success: false,
      allocatedKeys: [],
      error: `Insufficient free balance for IOU. Have ${Number(result.spendableBalance) / 1e8} KASPA free, need ${Number(amountSompi) / 1e8} KASPA. Settle existing IOUs to free up funds.`,
    };
  }

  const ledger = await loadLedger();
  let remaining = amountSompi;
  const allocatedKeys: string[] = [];

  const freeEntries = Array.from(ledger.values())
    .filter(e => e.status === 'free')
    .sort((a, b) => Number(BigInt(a.amountSompi) - BigInt(b.amountSompi)));

  for (const entry of freeEntries) {
    if (remaining <= 0n) break;
    entry.status = 'iou-allocated';
    entry.commitReason = iouId;
    entry.committedAt = Date.now();
    allocatedKeys.push(entry.utxoKey);
    remaining -= BigInt(entry.amountSompi);
  }

  await saveLedger(ledger);
  return { success: true, allocatedKeys };
}

/**
 * Release IOU allocation (IOU settled or cancelled).
 */
export async function releaseIOU(iouId: string): Promise<void> {
  const ledger = await loadLedger();
  for (const entry of ledger.values()) {
    if (entry.commitReason === iouId && entry.status === 'iou-allocated') {
      entry.status = 'free';
      entry.commitReason = undefined;
      entry.committedAt = undefined;
    }
  }
  await saveLedger(ledger);
}

// ============================================================================
// SPENDABLE UTXO FILTER (for sendKaspaViaRest)
// ============================================================================

/**
 * Get only free UTXOs formatted for kaspa_rest_tx consumption.
 * Drop-in filter: call this instead of fetching UTXOs directly from REST.
 */
export async function getSpendableUtxos(address: string): Promise<{
  utxos: any[];
  spendableBalance: bigint;
  totalBalance: bigint;
}> {
  const result = await syncLedger(address);

  // Convert free ledger entries back to REST UTXO format
  const utxos = result.utxos.map(e => ({
    outpoint: { transactionId: e.txId, index: e.index },
    utxoEntry: { amount: e.amountSompi, scriptPublicKey: '', blockDaaScore: '0' },
  }));

  return {
    utxos,
    spendableBalance: result.spendableBalance,
    totalBalance: result.totalBalance,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get full balance breakdown for UI display.
 */
export async function getBalanceBreakdown(address: string): Promise<{
  total: number;       // KAS
  spendable: number;   // KAS
  committed: number;   // KAS (collateral)
  iouBacked: number;   // KAS (IOU)
  frozen: number;      // KAS (committed + iou)
}> {
  const result = await syncLedger(address);
  return {
    total: Number(result.totalBalance) / 1e8,
    spendable: Number(result.spendableBalance) / 1e8,
    committed: Number(result.committedBalance) / 1e8,
    iouBacked: Number(result.iouAllocated) / 1e8,
    frozen: Number(result.committedBalance + result.iouAllocated) / 1e8,
  };
}

/**
 * Get commitments for a specific agreement (for UI display).
 */
export async function getAgreementCommitments(agreementId: string): Promise<LedgerEntry[]> {
  const ledger = await loadLedger();
  return Array.from(ledger.values()).filter(e => e.commitReason === agreementId);
}

/**
 * Clear all ledger data (for wallet reset/recovery).
 */
export async function clearLedger(): Promise<void> {
  await AsyncStorage.removeItem(LEDGER_KEY);
}
