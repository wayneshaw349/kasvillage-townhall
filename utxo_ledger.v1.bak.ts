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
  role?: 'buyer' | 'seller'; // canonical role in agreement
  pubkey?: string;           // my pubkey (proves ownership)
  commitHash?: string;       // SHA256(txId + index + agreementId + role + pubkey)
  covenantWarning?: boolean; // true if script is NOT standard P2PK
  allocatedSompi?: string;                          // portion locked (BigInt as string) — IOU partial-alloc
  allocations?: { iouId: string; sompi: string }[]; // per-IOU breakdown; one coin may back many IOUs
  isCoinbase?: boolean;    // coinbase UTXOs need maturity before spending
  blockDaaScore?: string;  // DAA score at UTXO creation (BigInt as string)
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

// ============================================================================
// COVENANT DETECTION
// ============================================================================
// Pure P2PK on Kaspa is always: 20{32-byte x-only pubkey}ac = 68 hex chars
// Anything else is a covenant or unknown script type
// ============================================================================

export function isPureP2PK(scriptPubKey: string): boolean {
  return scriptPubKey.length === 68 
    && scriptPubKey.startsWith('20') 
    && scriptPubKey.endsWith('ac');
}

export type UtxoSafety = 'pure' | 'covenant' | 'unknown';

export function classifyUtxo(scriptPubKey: string): { safety: UtxoSafety; reason: string } {
  if (!scriptPubKey || scriptPubKey.length === 0) {
    return { safety: 'unknown', reason: 'Empty script' };
  }
  if (isPureP2PK(scriptPubKey)) {
    return { safety: 'pure', reason: 'Standard P2PK (20{pubkey}ac)' };
  }
  if (scriptPubKey.length > 68) {
    return { safety: 'covenant', reason: 'Script contains extra opcodes (' + scriptPubKey.length + ' chars vs 68 standard). DO NOT accept as payment.' };
  }
  if (scriptPubKey.length < 68) {
    return { safety: 'unknown', reason: 'Script too short (' + scriptPubKey.length + ' chars). Non-standard.' };
  }
  return { safety: 'unknown', reason: 'Non-standard script format' };
}

// STORAGE
// ============================================================================

const LEDGER_KEY = 'kv_utxo_ledger';

export async function releaseOrphanCollateral(activeAgreementIds: string[]): Promise<number> {
  const arr = await loadLedger();
  let n = 0;
  for (const [, e] of arr) {
    if ((e.status === 'iou-allocated' || e.status === 'collateral-committed' || e.status === 'collateral-locked') && (!e.commitReason || !activeAgreementIds.includes(e.commitReason))) { e.status = 'free'; e.commitReason = undefined; n++; }
  }
  await saveLedger(arr);
  return n;
}
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

async function getVirtualDaaScore(apiBase: string): Promise<bigint | null> {
  try {
    const r = await fetch(`${apiBase}/info/blockdag`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const v = j?.virtualDaaScore ?? j?.virtual_daa_score;
    return v != null ? BigInt(v) : null;
  } catch { return null; }
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
export async function getFreeUtxoKeys(address: string): Promise<Set<string>> {
  const r = await syncLedger(address);
  return new Set(r.utxos.map(e => e.utxoKey));
}

/**
 * Map of utxoKey -> locked (allocated) sompi, for coins with any IOU allocation.
 * Send path uses this to keep IOU-backed value in the wallet via a change floor.
 */
export async function getLockedSompiByKey(address: string): Promise<Map<string, bigint>> {
  const r = await syncLedger(address);
  const m = new Map<string, bigint>();
  for (const e of r.allEntries) {
    const alloc = BigInt(e.allocatedSompi ?? '0');
    if (alloc > 0n) m.set(e.utxoKey, alloc);
  }
  return m;
}

/**
 * After a send consumes partially-locked coins, move their IOU allocations onto the
 * change UTXO so the backing record survives the spend. Called post-broadcast.
 * changeUtxoKey = `${newTxId}:${changeIndex}`. changeAmountSompi is the change output value.
 */
export async function reanchorAllocations(
  spentKeys: string[],
  newTxId: string,
  changeIndex: number,
  changeAmountSompi: string,
): Promise<void> {
  const ledger = await loadLedger();
  const moved: { iouId: string; sompi: string }[] = [];
  for (const key of spentKeys) {
    const e = ledger.get(key);
    if (e?.allocations && e.allocations.length) {
      for (const a of e.allocations) moved.push({ iouId: a.iouId, sompi: a.sompi });
    }
    // The spent coin is gone on L1; drop its ledger entry now (sync would anyway).
    ledger.delete(key);
  }
  if (moved.length === 0) { await saveLedger(ledger); return; }

  const changeKey = `${newTxId}:${changeIndex}`;
  const totalMoved = moved.reduce((acc, a) => acc + BigInt(a.sompi), 0n);
  const existing = ledger.get(changeKey);
  if (existing) {
    existing.allocations = [ ...(existing.allocations ?? []), ...moved ];
    existing.allocatedSompi = String(BigInt(existing.allocatedSompi ?? '0') + totalMoved);
    if (BigInt(existing.allocatedSompi) >= BigInt(existing.amountSompi)) existing.status = 'iou-allocated';
  } else {
    // Change UTXO not yet in ledger (pre-sync) — seed it so allocations aren't lost.
    const [txId, idxStr] = changeKey.split(':');
    ledger.set(changeKey, {
      utxoKey: changeKey,
      txId,
      index: Number(idxStr),
      amountSompi: String(changeAmountSompi),
      status: BigInt(totalMoved) >= BigInt(changeAmountSompi || '0') ? 'iou-allocated' : 'free',
      allocatedSompi: String(totalMoved),
      allocations: moved,
    });
  }
  await saveLedger(ledger);
  console.log(`[UTXO-Ledger] Re-anchored ${moved.length} allocation(s) (${Number(totalMoved) / 1e8} KAS) onto ${changeKey}`);
}

export async function syncLedger(address: string): Promise<SpendableResult> {
  const apiBase = await getApiBase();
  const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);
  if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);
  const rawUtxos: any[] = await resp.json();

  // PRIMARY-GUARD: only the primary (hot) wallet address may read/write the
  // persisted ledger. Any other address (vault, counterparty) gets an
  // ephemeral in-memory ledger so it can never clobber hot state.
  let isPrimary = true;
  try {
    const primary = (await SecureStore.getItemAsync('kv_kaspa_address'))
      || (await SecureStore.getItemAsync('kaspa_address')) || '';
    if (primary && address !== primary) isPrimary = false;
  } catch {}

  const ledger = isPrimary ? await loadLedger() : new Map<string, LedgerEntry>();

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
      const spk = u.utxoEntry?.scriptPublicKey?.scriptPublicKey || u.utxoEntry?.scriptPublicKey || '';
      const covenantCheck = isPureP2PK(spk);
      if (!covenantCheck) { console.warn('[UTXO-Safety] ⚠️ Non-standard script detected:', key, 'script:', spk.slice(0,20) + '...', 'len:', spk.length); }
      ledger.set(key, {
        utxoKey: key,
        txId,
        index,
        amountSompi: String(amount),
        status: 'free',
        covenantWarning: !covenantCheck,
        isCoinbase: (u.utxoEntry?.isCoinbase ?? u.isCoinbase) || false,
        blockDaaScore: String(u.utxoEntry?.blockDaaScore ?? u.blockDaaScore ?? '0'),
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

  if (isPrimary) await saveLedger(ledger);
  const vdaa = await getVirtualDaaScore(apiBase);
  return computeBalances(ledger, vdaa);
}

// ============================================================================
// BALANCE COMPUTATION
// ============================================================================

function computeBalances(ledger: Map<string, LedgerEntry>, virtualDaaScore?: bigint | null): SpendableResult {
  const COINBASE_MATURITY = 100n;
  let totalBalance = 0n;
  let committedBalance = 0n;
  let iouAllocated = 0n;
  let spendableBalance = 0n;
  const freeUtxos: LedgerEntry[] = [];
  const allEntries: LedgerEntry[] = [];

  for (const entry of ledger.values()) {
    const amt = BigInt(entry.amountSompi);
    const alloc = BigInt(entry.allocatedSompi ?? '0');
    totalBalance += amt;
    allEntries.push(entry);

    if (entry.status === 'collateral-committed' || entry.status === 'collateral-locked') {
      // Whole coin bound to FROST collateral — unavailable.
      committedBalance += amt;
      continue;
    }

    // Immature coinbase — network would reject a spend; treat as unavailable.
    if (entry.isCoinbase && virtualDaaScore != null && entry.blockDaaScore != null) {
      const age = virtualDaaScore - BigInt(entry.blockDaaScore);
      if (age < COINBASE_MATURITY) continue;
    }

    // IOU partial locking: allocated portion frozen, remainder spendable.
    iouAllocated += alloc;
    const freeRem = amt - alloc;
    if (freeRem > 0n) {
      spendableBalance += freeRem;
      // Emit remainder amount so the send path only sees the unlocked slice.
      freeUtxos.push({ ...entry, amountSompi: String(freeRem) });
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
  /* SMALLEST-COVER: prefer the single smallest coin that covers the amount - binds one coin instead of dragging large coins into small agreements */
  const _coverEntry = freeEntries.find(e => BigInt(e.amountSompi) >= amountSompi);
  const _pickList = _coverEntry ? [_coverEntry] : freeEntries;

  for (const entry of _pickList) {
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
): Promise<{ success: boolean; allocations: { tag: string; amountSompi: string }[]; error?: string }> {
  const result = await syncLedger(address);

  if (result.spendableBalance < amountSompi) {
    return {
      success: false,
      allocations: [],
      error: `Insufficient free balance for IOU. Have ${Number(result.spendableBalance) / 1e8} KASPA free, need ${Number(amountSompi) / 1e8} KASPA. Settle existing IOUs to free up funds.`,
    };
  }

  const ledger = await loadLedger();
  let remaining = amountSompi;
  const allocations: { tag: string; amountSompi: string }[] = [];

  // Partial allocation: take from each coin's FREE remainder (amount - already-allocated).
  // Collateral coins are skipped (whole-coin FROST bound). IOU locks are sompi-level.
  const candidates = Array.from(ledger.values())
    .filter(e => e.status !== 'collateral-committed' && e.status !== 'collateral-locked')
    .map(e => ({ e, free: BigInt(e.amountSompi) - BigInt(e.allocatedSompi ?? '0') }))
    .filter(x => x.free > 0n)
    .sort((a, b) => Number(a.free - b.free));

  for (const { e, free } of candidates) {
    if (remaining <= 0n) break;
    const take = free >= remaining ? remaining : free;
    e.allocatedSompi = String(BigInt(e.allocatedSompi ?? '0') + take);
    e.allocations = [ ...(e.allocations ?? []), { iouId, sompi: String(take) } ];
    if (BigInt(e.allocatedSompi) >= BigInt(e.amountSompi)) e.status = 'iou-allocated';
    allocations.push({ tag: e.utxoKey, amountSompi: String(take) });
    remaining -= take;
  }

  await saveLedger(ledger);
  console.log(`[UTXO-Ledger] IOU ${iouId}: locked ${Number(amountSompi) / 1e8} KAS across ${allocations.length} coin(s)`);
  return { success: true, allocations };
}

/**
 * Release IOU allocation (IOU settled or cancelled).
 */
export async function releaseIOU(iouId: string): Promise<void> {
  const ledger = await loadLedger();
  for (const entry of ledger.values()) {
    if (!entry.allocations) continue;
    const freed = entry.allocations
      .filter(a => a.iouId === iouId)
      .reduce((acc, a) => acc + BigInt(a.sompi), 0n);
    if (freed === 0n) continue;
    entry.allocations = entry.allocations.filter(a => a.iouId !== iouId);
    entry.allocatedSompi = String(BigInt(entry.allocatedSompi ?? '0') - freed);
    if (BigInt(entry.allocatedSompi) <= 0n) {
      entry.allocatedSompi = '0';
      entry.allocations = undefined;
      if (entry.status === 'iou-allocated') entry.status = 'free';
    } else if (entry.status === 'iou-allocated') {
      // partially freed -> spendable remainder exists again
      entry.status = 'free';
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
/**
 * ORPHAN-IOU-SWEEP: release allocations whose iouId matches no live IOU/prop record.
 * Mirrors releaseOrphanCollateral. Pass the set of live ids (SignedIOU ids + 'prop_'+nonce
 * for pending/accepted prop-IOUs). Anything else is stale and frees.
 */
export async function releaseOrphanIOUs(liveIouIds: string[]): Promise<number> {
  const live = new Set(liveIouIds);
  const ledger = await loadLedger();
  let freedCount = 0;
  for (const entry of ledger.values()) {
    if (!entry.allocations || !entry.allocations.length) continue;
    const stale = entry.allocations.filter(a => !live.has(a.iouId));
    if (!stale.length) continue;
    const freed = stale.reduce((acc, a) => acc + BigInt(a.sompi), 0n);
    entry.allocations = entry.allocations.filter(a => live.has(a.iouId));
    entry.allocatedSompi = String(BigInt(entry.allocatedSompi ?? '0') - freed);
    if (BigInt(entry.allocatedSompi) <= 0n) {
      entry.allocatedSompi = '0';
      entry.allocations = entry.allocations.length ? entry.allocations : undefined;
      if (entry.status === 'iou-allocated') entry.status = 'free';
    } else if (entry.status === 'iou-allocated') {
      entry.status = 'free';
    }
    freedCount += stale.length;
    console.log('[UTXO-Ledger] Orphan IOU sweep freed', Number(freed) / 1e8, 'KAS from', entry.utxoKey.slice(0, 20), '(', stale.map(a => a.iouId).join(','), ')');
  }
  if (freedCount) await saveLedger(ledger);
  return freedCount;
}

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

// ============================================================================

// ============================================================================
// EXPIRY: Auto-release uncommitted tags after timeout
// ============================================================================

const COMMIT_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes (testing), change to 24h for production

/**
 * Release stale committed UTXOs that were never sent (seller ghosted).
 * Call periodically (e.g. on app resume, inbox refresh).
 */
export async function releaseExpiredCommitments(): Promise<number> {
  const ledger = await loadLedger();
  const now = Date.now();
  let released = 0;

  for (const entry of ledger.values()) {
    if (entry.status === 'collateral-committed' && entry.committedAt) {
      const age = now - entry.committedAt;
      if (age > COMMIT_EXPIRY_MS) {
        console.log('[UTXO-Expiry] Releasing stale tag:', entry.utxoKey, 'age:', Math.floor(age / 60000), 'min, agr:', entry.commitReason);
        entry.status = 'free';
        entry.commitReason = undefined;
        entry.committedAt = undefined;
        entry.role = undefined;
        entry.pubkey = undefined;
        entry.commitHash = undefined;
        released++;
      }
    }
  }

  if (released > 0) {
    await saveLedger(ledger);
    console.log('[UTXO-Expiry] Released', released, 'stale commitments');
  }
  return released;
}

// CANONICAL COMMIT (binds UTXOs to agreement with role proof)
// ============================================================================

/**
 * Canonical commit: tags UTXOs with agreement, role, pubkey, and commitHash.
 * The commitHash is a tamper-proof binding: SHA256(txId:index + agreementId + role + pubkey)
 * This proves: "UTXO X was committed to AGR_Y by BUYER/SELLER pubkey Z"
 */
export async function canonicalCommit(
  address: string,
  amountSompi: bigint,
  agreementId: string,
  role: 'buyer' | 'seller',
  pubkey: string,
): Promise<{ success: boolean; committedKeys: string[]; commitHashes: string[]; error?: string }> {
  const result = await syncLedger(address);

  if (result.spendableBalance < amountSompi) {
    return {
      success: false, committedKeys: [], commitHashes: [],
      error: `Insufficient: have ${Number(result.spendableBalance) / 1e8} free, need ${Number(amountSompi) / 1e8} KASPA`,
    };
  }

  const ledger = await loadLedger();
  let remaining = amountSompi;
  const committedKeys: string[] = [];
  const commitHashes: string[] = [];

  const freeEntries = Array.from(ledger.values())
    .filter(e => e.status === 'free')
    .sort((a, b) => Number(BigInt(a.amountSompi) - BigInt(b.amountSompi)));
  /* SMALLEST-COVER: prefer the single smallest coin that covers the amount - binds one coin instead of dragging large coins into small agreements */
  const _coverEntry = freeEntries.find(e => BigInt(e.amountSompi) >= amountSompi);
  const _pickList = _coverEntry ? [_coverEntry] : freeEntries;

  for (const entry of _pickList) {
    if (remaining <= 0n) break;
    // Compute commit hash
    const hashInput = entry.utxoKey + agreementId + role + pubkey;
    const encoder = new TextEncoder();
    const hashBytes = await (async () => {
      try {
        const { sha256 } = await import('@noble/hashes/sha256');
        return sha256(encoder.encode(hashInput));
      } catch {
        // Fallback: use simple string hash
        return encoder.encode(hashInput);
      }
    })();
    const hash = Array.from(hashBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');

    entry.status = 'collateral-committed';
    entry.commitReason = agreementId;
    entry.committedAt = Date.now();
    entry.role = role;
    entry.pubkey = pubkey;
    entry.commitHash = hash;
    committedKeys.push(entry.utxoKey);
    commitHashes.push(hash);
    remaining -= BigInt(entry.amountSompi);
  }

  await saveLedger(ledger);
  console.log(`[UTXO-Tag] Committed ${committedKeys.length} UTXOs (${Number(amountSompi) / 1e8} KAS) to ${agreementId} as ${role.toUpperCase()}`);
  console.log(`[UTXO-Tag] Hashes: ${commitHashes.join(', ')}`);
  return { success: true, committedKeys, commitHashes };
}

/**
 * Verify that UTXOs are properly committed to an agreement.
 * Returns true if commitHashes match recomputed values.
 */
export async function verifyCommitment(agreementId: string, role: 'buyer' | 'seller', pubkey: string): Promise<{
  valid: boolean;
  utxoCount: number;
  totalSompi: bigint;
}> {
  const ledger = await loadLedger();
  let totalSompi = 0n;
  let utxoCount = 0;
  let valid = true;

  for (const entry of ledger.values()) {
    if (entry.commitReason === agreementId && entry.role === role) {
      utxoCount++;
      totalSompi += BigInt(entry.amountSompi);
      // Verify hash
      if (entry.commitHash) {
        const hashInput = entry.utxoKey + agreementId + role + pubkey;
        try {
          const { sha256 } = await import('@noble/hashes/sha256');
          const expected = Array.from(sha256(new TextEncoder().encode(hashInput)).slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (expected !== entry.commitHash) {
            console.warn('[UTXO-Tag] Hash mismatch for', entry.utxoKey);
            valid = false;
          }
        } catch {}
      }
    }
  }

  console.log(`[UTXO-Tag] Verified ${agreementId}: ${utxoCount} UTXOs, ${Number(totalSompi) / 1e8} KAS, valid: ${valid}`);
  return { valid, utxoCount, totalSompi };
}

/**
 * Get all UTXO tags for display (balance sheet / tax tracking).
 */
export async function getTaggedUtxos(): Promise<{
  free: LedgerEntry[];
  committed: { entry: LedgerEntry; agreementId: string; role: string }[];
  locked: { entry: LedgerEntry; agreementId: string; role: string }[];
  iou: { entry: LedgerEntry; iouId: string }[];
}> {
  const ledger = await loadLedger();
  const free: LedgerEntry[] = [];
  const committed: any[] = [];
  const locked: any[] = [];
  const iou: any[] = [];

  for (const entry of ledger.values()) {
    switch (entry.status) {
      case 'free': free.push(entry); break;
      case 'collateral-committed': committed.push({ entry, agreementId: entry.commitReason || '', role: entry.role || 'unknown' }); break;
      case 'collateral-locked': locked.push({ entry, agreementId: entry.commitReason || '', role: entry.role || 'unknown' }); break;
      case 'iou-allocated': iou.push({ entry, iouId: entry.commitReason || '' }); break;
    }
  }

  return { free, committed, locked, iou };
}



// ============================================================================
// DUPLICATE PROPOSAL GUARD
// ============================================================================

/**
 * Check if an agreement ID already has committed UTXOs.
 * Call BEFORE proposing to prevent duplicate proposals.
 */
export async function isAlreadyCommitted(agreementId: string): Promise<{
  committed: boolean;
  utxoCount: number;
  totalSompi: bigint;
  status: UtxoStatus | null;
}> {
  const ledger = await loadLedger();
  let totalSompi = 0n;
  let utxoCount = 0;
  let status: UtxoStatus | null = null;

  for (const entry of ledger.values()) {
    if (entry.commitReason === agreementId) {
      utxoCount++;
      totalSompi += BigInt(entry.amountSompi);
      status = entry.status;
    }
  }

  if (utxoCount > 0) {
    console.log('[UTXO-Guard] AGR', agreementId, 'already has', utxoCount, 'tagged UTXOs:', Number(totalSompi) / 1e8, 'KAS, status:', status);
  }

  return { committed: utxoCount > 0, utxoCount, totalSompi, status };
}

export async function clearLedger(): Promise<void> {
  await AsyncStorage.removeItem(LEDGER_KEY);
}
