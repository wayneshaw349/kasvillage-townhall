// ============================================================================
// KASVILLAGE - VIRTUAL COMMITMENT LEDGER (v2)
// ============================================================================
// Replaces per-UTXO tagging with amount-based virtual commitments.
//
//   spendable = L1 balance − Σ(collateral rows, unlocked) − Σ(IOU rows)
//
// Coins are never individually reserved. A 6-KAS agreement reserves 6 KAS of
// *value*, not whichever coin happened to cover it. This eliminates the
// whole-UTXO over-commit, the own-agreement self-deadlock, stale coin tags,
// and phantom-outpoint debris — the entire bug class of coin-granular tags.
//
// What is still per-coin (safety, not accounting):
//   - covenant script classification (never spend/accept non-P2PK)
//   - coinbase maturity (network rejects immature spends)
//   - prepared-input reservation (a frozen prepared tx's inputs must not be
//     spent by another send before its broadcast)
//
// Export surface is byte-compatible with v1 so consumers don't change.
// LedgerEntry rows returned by query functions are synthesized
// ("virtual:<id>") — commitHash is now SHA256('v2'+id+role+pubkey), coin-free.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// TYPES (unchanged shapes)
// ============================================================================

export type UtxoStatus = 'free' | 'iou-allocated' | 'collateral-committed' | 'collateral-locked';

export interface LedgerEntry {
  utxoKey: string;
  txId: string;
  index: number;
  amountSompi: string;
  status: UtxoStatus;
  commitReason?: string;
  committedAt?: number;
  role?: 'buyer' | 'seller';
  pubkey?: string;
  commitHash?: string;
  covenantWarning?: boolean;
  allocatedSompi?: string;
  allocations?: { iouId: string; sompi: string }[];
  isCoinbase?: boolean;
  blockDaaScore?: string;
}

export interface SpendableResult {
  totalBalance: bigint;
  committedBalance: bigint;
  iouAllocated: bigint;
  spendableBalance: bigint;
  utxos: LedgerEntry[];      // spendable coins (full amounts; safety-filtered)
  allEntries: LedgerEntry[]; // coins + synthesized commitment rows
}

// ============================================================================
// COVENANT DETECTION (unchanged)
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

// ============================================================================
// STORAGE — one small JSON blob of amount rows. No per-coin state persisted.
// ============================================================================

interface CollateralRow {
  agrId: string;
  sompi: string;              // BigInt as string
  role: 'buyer' | 'seller';
  pubkey: string;
  at: number;
  locked: boolean;            // true after funds actually sent to FROST — value
                              // left the wallet, so row no longer reduces spendable
  commitHash: string;
}

interface IouRow {
  iouId: string;
  sompi: string;
  at: number;
}

interface VStore {
  v: 2;
  collateral: CollateralRow[];
  ious: IouRow[];
  pendingInputs: { id: string; keys: string[]; at: number }[]; // frozen prepared-tx inputs
}

const VSTORE_KEY = 'kv_vcommit_v2';
const LEGACY_LEDGER_KEY = 'kv_utxo_ledger';
const NETWORK_KEY = 'kaspa_network';

function emptyStore(): VStore { return { v: 2, collateral: [], ious: [], pendingInputs: [] }; }

async function loadStore(): Promise<VStore> {
  try {
    const json = await AsyncStorage.getItem(VSTORE_KEY);
    if (!json) return await migrateLegacy();
    const s = JSON.parse(json);
    if (s?.v !== 2) return emptyStore();
    s.collateral = s.collateral || [];
    s.ious = s.ious || [];
    s.pendingInputs = s.pendingInputs || [];
    return s as VStore;
  } catch { return emptyStore(); }
}

async function saveStore(s: VStore): Promise<void> {
  await AsyncStorage.setItem(VSTORE_KEY, JSON.stringify(s));
}

// One-time migration: fold legacy per-coin tags into amount rows, then retire the key.
async function migrateLegacy(): Promise<VStore> {
  const s = emptyStore();
  try {
    const json = await AsyncStorage.getItem(LEGACY_LEDGER_KEY);
    if (!json) return s;
    const arr: LedgerEntry[] = JSON.parse(json);
    const byAgr = new Map<string, { sompi: bigint; role: 'buyer' | 'seller'; pubkey: string; locked: boolean }>();
    const byIou = new Map<string, bigint>();
    for (const e of arr) {
      if ((e.status === 'collateral-committed' || e.status === 'collateral-locked') && e.commitReason) {
        const cur = byAgr.get(e.commitReason) || { sompi: 0n, role: (e.role || 'buyer') as 'buyer' | 'seller', pubkey: e.pubkey || '', locked: true };
        cur.sompi += BigInt(e.amountSompi || '0');
        if (e.status === 'collateral-committed') cur.locked = false; // any unlocked coin => row still reduces spendable
        byAgr.set(e.commitReason, cur);
      }
      for (const a of (e.allocations || [])) {
        byIou.set(a.iouId, (byIou.get(a.iouId) || 0n) + BigInt(a.sompi || '0'));
      }
    }
    for (const [agrId, v] of byAgr) {
      s.collateral.push({ agrId, sompi: v.sompi.toString(), role: v.role, pubkey: v.pubkey, at: Date.now(), locked: v.locked, commitHash: await computeCommitHash(agrId, v.role, v.pubkey) });
    }
    for (const [iouId, sompi] of byIou) {
      s.ious.push({ iouId, sompi: sompi.toString(), at: Date.now() });
    }
    await AsyncStorage.setItem(VSTORE_KEY, JSON.stringify(s));
    await AsyncStorage.removeItem(LEGACY_LEDGER_KEY);
    console.log('[VLedger] Migrated legacy tags:', s.collateral.length, 'agreements,', s.ious.length, 'IOU allocations');
  } catch (e) { console.warn('[VLedger] legacy migration skipped:', e); }
  return s;
}

async function computeCommitHash(id: string, role: string, pubkey: string): Promise<string> {
  try {
    const { sha256 } = await import('@noble/hashes/sha256');
    const bytes = sha256(new TextEncoder().encode('v2' + id + role + pubkey));
    return Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

function sumCollateralUnlocked(s: VStore): bigint {
  return s.collateral.filter(r => !r.locked).reduce((a, r) => a + BigInt(r.sompi), 0n);
}
function sumIous(s: VStore): bigint {
  return s.ious.reduce((a, r) => a + BigInt(r.sompi), 0n);
}

// ============================================================================
// API HELPER (unchanged)
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
// SYNC: fetch L1 coins, apply safety filters, subtract virtual commitments
// ============================================================================

export async function syncLedger(address: string): Promise<SpendableResult> {
  const apiBase = await getApiBase();
  const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);
  if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);
  const rawUtxos: any[] = await resp.json();

  // PRIMARY-GUARD: only the primary (hot) wallet reads/writes persisted rows.
  // Other addresses (vault, counterparty) compute against zero commitments.
  let isPrimary = true;
  try {
    const primary = (await SecureStore.getItemAsync('kv_kaspa_address'))
      || (await SecureStore.getItemAsync('kaspa_address')) || '';
    if (primary && address !== primary) isPrimary = false;
  } catch {}

  const store = isPrimary ? await loadStore() : emptyStore();
  const vdaa = await getVirtualDaaScore(apiBase);
  const COINBASE_MATURITY = 100n;
  const pending = new Set(store.pendingInputs.flatMap(p => p.keys));

  let totalBalance = 0n;
  const coins: LedgerEntry[] = [];
  const spendCoins: LedgerEntry[] = [];

  for (const u of rawUtxos) {
    const txId = u.outpoint?.transactionId || u.transactionId || '';
    const index = u.outpoint?.index ?? u.index ?? 0;
    const key = `${txId}:${index}`;
    const amount = String(u.utxoEntry?.amount || u.amount || '0');
    const spk = u.utxoEntry?.scriptPublicKey?.scriptPublicKey || u.utxoEntry?.scriptPublicKey || '';
    const pure = isPureP2PK(spk);
    if (!pure) { console.warn('[UTXO-Safety] ⚠️ Non-standard script detected:', key, 'script:', String(spk).slice(0, 20) + '...', 'len:', String(spk).length); }
    const isCoinbase = (u.utxoEntry?.isCoinbase ?? u.isCoinbase) || false;
    const daa = String(u.utxoEntry?.blockDaaScore ?? u.blockDaaScore ?? '0');

    const entry: LedgerEntry = {
      utxoKey: key, txId, index, amountSompi: amount, status: 'free',
      covenantWarning: !pure, isCoinbase, blockDaaScore: daa,
    };
    totalBalance += BigInt(amount);
    coins.push(entry);

    // spendability safety filters (per-coin, kept from v1)
    if (isCoinbase && vdaa != null) {
      const age = vdaa - BigInt(daa);
      if (age < COINBASE_MATURITY) continue;
    }
    if (pending.has(key)) continue; // reserved by a frozen prepared tx
    spendCoins.push(entry);
  }

  const committedBalance = sumCollateralUnlocked(store);
  const iouAllocated = sumIous(store);
  let spendableBalance = totalBalance - committedBalance - iouAllocated;
  if (spendableBalance < 0n) spendableBalance = 0n;

  // allEntries: real coins + synthesized commitment rows (for display consumers)
  const allEntries = [...coins, ...synthRows(store)];

  return { totalBalance, committedBalance, iouAllocated, spendableBalance, utxos: spendCoins, allEntries };
}

function synthRows(store: VStore): LedgerEntry[] {
  const rows: LedgerEntry[] = [];
  for (const r of store.collateral) {
    rows.push({
      utxoKey: 'virtual:' + r.agrId, txId: 'virtual', index: 0,
      amountSompi: r.sompi,
      status: r.locked ? 'collateral-locked' : 'collateral-committed',
      commitReason: r.agrId, committedAt: r.at, role: r.role, pubkey: r.pubkey, commitHash: r.commitHash,
    });
  }
  for (const r of store.ious) {
    rows.push({
      utxoKey: 'virtual:' + r.iouId, txId: 'virtual', index: 0,
      amountSompi: r.sompi, status: 'iou-allocated', commitReason: r.iouId, committedAt: r.at,
      allocatedSompi: r.sompi, allocations: [{ iouId: r.iouId, sompi: r.sompi }],
    });
  }
  return rows;
}

// ============================================================================
// COMPAT SHIMS (v1 signatures preserved)
// ============================================================================

/** All safe-to-spend coin keys. Amount gating happens via canSpend, not coin exclusion. */
export async function getFreeUtxoKeys(address: string): Promise<Set<string>> {
  const r = await syncLedger(address);
  return new Set(r.utxos.map(e => e.utxoKey));
}

/** v2: IOU locks are value-level, not coin-level. Send-path floor now uses getLockedTotals. */
export async function getLockedSompiByKey(_address: string): Promise<Map<string, bigint>> {
  return new Map();
}

/** v2 no-op: allocations aren't anchored to coins, so nothing to re-anchor after a spend. */
export async function reanchorAllocations(
  _spentKeys: string[], _newTxId: string, _changeIndex: number, _changeAmountSompi: string,
): Promise<void> { /* no-op by design */ }

/** New: total value that must remain in the wallet (unlocked collateral + IOU backing). */
export async function getLockedTotals(): Promise<{ collateral: bigint; iou: bigint; total: bigint }> {
  const s = await loadStore();
  const collateral = sumCollateralUnlocked(s);
  const iou = sumIous(s);
  return { collateral, iou, total: collateral + iou };
}

// ============================================================================
// PREPARED-INPUT RESERVATION (freeze → broadcast protection)
// ============================================================================

export async function reservePreparedInputs(id: string, keys: string[]): Promise<void> {
  const s = await loadStore();
  s.pendingInputs = s.pendingInputs.filter(p => p.id !== id);
  s.pendingInputs.push({ id, keys, at: Date.now() });
  await saveStore(s);
  console.log('[VLedger] Reserved', keys.length, 'prepared input(s) for', id);
}

export async function releasePreparedInputs(id: string): Promise<void> {
  const s = await loadStore();
  const before = s.pendingInputs.length;
  s.pendingInputs = s.pendingInputs.filter(p => p.id !== id);
  if (s.pendingInputs.length !== before) await saveStore(s);
}

// ============================================================================
// COMMIT / RESERVE OPERATIONS
// ============================================================================

export async function canSpend(address: string, amountSompi: bigint): Promise<{
  ok: boolean; spendable: bigint; total: bigint; committed: bigint; iouAllocated: bigint; shortage?: bigint;
}> {
  const result = await syncLedger(address);
  if (result.spendableBalance >= amountSompi) {
    return { ok: true, spendable: result.spendableBalance, total: result.totalBalance, committed: result.committedBalance, iouAllocated: result.iouAllocated };
  }
  return { ok: false, spendable: result.spendableBalance, total: result.totalBalance, committed: result.committedBalance, iouAllocated: result.iouAllocated, shortage: amountSompi - result.spendableBalance };
}

export async function commitForCollateral(
  address: string, amountSompi: bigint, agreementId: string,
): Promise<{ success: boolean; committedKeys: string[]; error?: string }> {
  const r = await canonicalCommit(address, amountSompi, agreementId, 'buyer', '');
  return { success: r.success, committedKeys: r.committedKeys, error: r.error };
}

export async function canonicalCommit(
  address: string, amountSompi: bigint, agreementId: string,
  role: 'buyer' | 'seller', pubkey: string,
): Promise<{ success: boolean; committedKeys: string[]; commitHashes: string[]; error?: string }> {
  const result = await syncLedger(address);
  const s = await loadStore();
  const existing = s.collateral.find(r => r.agrId === agreementId);

  // Idempotent upsert: re-committing the same agreement replaces its row.
  const already = existing && !existing.locked ? BigInt(existing.sompi) : 0n;
  const effectiveSpendable = result.spendableBalance + already;
  if (effectiveSpendable < amountSompi) {
    return {
      success: false, committedKeys: [], commitHashes: [],
      error: `Insufficient: have ${Number(effectiveSpendable) / 1e8} free, need ${Number(amountSompi) / 1e8} KASPA`,
    };
  }

  const hash = await computeCommitHash(agreementId, role, pubkey);
  s.collateral = s.collateral.filter(r => r.agrId !== agreementId);
  s.collateral.push({ agrId: agreementId, sompi: amountSompi.toString(), role, pubkey, at: Date.now(), locked: false, commitHash: hash });
  await saveStore(s);

  console.log(`[UTXO-Tag] Committed ${Number(amountSompi) / 1e8} KAS (virtual) to ${agreementId} as ${role.toUpperCase()}`);
  console.log(`[UTXO-Tag] Hashes: ${hash}`);
  return { success: true, committedKeys: ['virtual:' + agreementId], commitHashes: [hash] };
}

/** Funds actually sent to FROST — value left the wallet; row stops reducing spendable. */
export async function markLocked(agreementId: string): Promise<void> {
  const s = await loadStore();
  let changed = false;
  for (const r of s.collateral) {
    if (r.agrId === agreementId && !r.locked) { r.locked = true; changed = true; }
  }
  if (changed) { await saveStore(s); console.log(`[UTXO-Ledger] Marked ${agreementId} as locked (on-chain)`); }
}

export async function releaseCommitment(agreementId: string): Promise<void> {
  const s = await loadStore();
  const before = s.collateral.length;
  s.collateral = s.collateral.filter(r => r.agrId !== agreementId);
  if (s.collateral.length !== before) {
    await saveStore(s);
    console.log(`[UTXO-Ledger] Released commitment for ${agreementId}`);
  }
}

export async function releaseOrphanCollateral(activeAgreementIds: string[]): Promise<number> {
  const s = await loadStore();
  const before = s.collateral.length + s.ious.length;
  s.collateral = s.collateral.filter(r => activeAgreementIds.includes(r.agrId));
  const n = before - (s.collateral.length + s.ious.length);
  if (n > 0) await saveStore(s);
  return n;
}

// ============================================================================
// IOU (value-level, same external shape)
// ============================================================================

export async function allocateForIOU(
  address: string, amountSompi: bigint, iouId: string,
): Promise<{ success: boolean; allocations: { tag: string; amountSompi: string }[]; error?: string }> {
  const result = await syncLedger(address);
  if (result.spendableBalance < amountSompi) {
    return {
      success: false, allocations: [],
      error: `Insufficient free balance for IOU. Have ${Number(result.spendableBalance) / 1e8} KASPA free, need ${Number(amountSompi) / 1e8} KASPA. Settle existing IOUs to free up funds.`,
    };
  }
  const s = await loadStore();
  s.ious = s.ious.filter(r => r.iouId !== iouId);
  s.ious.push({ iouId, sompi: amountSompi.toString(), at: Date.now() });
  await saveStore(s);
  console.log(`[UTXO-Ledger] IOU ${iouId}: locked ${Number(amountSompi) / 1e8} KAS (virtual)`);
  return { success: true, allocations: [{ tag: 'virtual:' + iouId, amountSompi: amountSompi.toString() }] };
}

export async function releaseIOU(iouId: string): Promise<void> {
  const s = await loadStore();
  const before = s.ious.length;
  s.ious = s.ious.filter(r => r.iouId !== iouId);
  if (s.ious.length !== before) await saveStore(s);
}

export async function releaseOrphanIOUs(liveIouIds: string[]): Promise<number> {
  const live = new Set(liveIouIds);
  const s = await loadStore();
  const stale = s.ious.filter(r => !live.has(r.iouId));
  if (!stale.length) return 0;
  for (const r of stale) console.log('[UTXO-Ledger] Orphan IOU sweep freed', Number(BigInt(r.sompi)) / 1e8, 'KAS (', r.iouId, ')');
  s.ious = s.ious.filter(r => live.has(r.iouId));
  await saveStore(s);
  return stale.length;
}

// ============================================================================
// SPENDABLE / DISPLAY
// ============================================================================

export async function getSpendableUtxos(address: string): Promise<{
  utxos: any[]; spendableBalance: bigint; totalBalance: bigint;
}> {
  const result = await syncLedger(address);
  const utxos = result.utxos.map(e => ({
    outpoint: { transactionId: e.txId, index: e.index },
    utxoEntry: { amount: e.amountSompi, scriptPublicKey: '', blockDaaScore: e.blockDaaScore || '0' },
  }));
  return { utxos, spendableBalance: result.spendableBalance, totalBalance: result.totalBalance };
}

export async function getBalanceBreakdown(address: string): Promise<{
  total: number; spendable: number; committed: number; iouBacked: number; frozen: number;
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

export async function getAgreementCommitments(agreementId: string): Promise<LedgerEntry[]> {
  const s = await loadStore();
  return synthRows(s).filter(e => e.commitReason === agreementId);
}

export async function getTaggedUtxos(): Promise<{
  free: LedgerEntry[];
  committed: { entry: LedgerEntry; agreementId: string; role: string }[];
  locked: { entry: LedgerEntry; agreementId: string; role: string }[];
  iou: { entry: LedgerEntry; iouId: string }[];
}> {
  const s = await loadStore();
  const committed: any[] = [];
  const locked: any[] = [];
  const iou: any[] = [];
  for (const e of synthRows(s)) {
    if (e.status === 'collateral-committed') committed.push({ entry: e, agreementId: e.commitReason || '', role: e.role || 'unknown' });
    else if (e.status === 'collateral-locked') locked.push({ entry: e, agreementId: e.commitReason || '', role: e.role || 'unknown' });
    else if (e.status === 'iou-allocated') iou.push({ entry: e, iouId: e.commitReason || '' });
  }
  return { free: [], committed, locked, iou };
}

// ============================================================================
// EXPIRY + GUARDS
// ============================================================================

const COMMIT_EXPIRY_MS = 20 * 60 * 1000;   // unlocked commitments (never funded)
const PENDING_EXPIRY_MS = 30 * 60 * 1000;  // frozen prepared-tx input reservations

export async function releaseExpiredCommitments(): Promise<number> {
  const s = await loadStore();
  const now = Date.now();
  let released = 0;
  const keep: CollateralRow[] = [];
  for (const r of s.collateral) {
    if (!r.locked && now - r.at > COMMIT_EXPIRY_MS) {
      console.log('[UTXO-Expiry] Releasing stale commitment:', r.agrId, 'age:', Math.floor((now - r.at) / 60000), 'min');
      released++;
    } else keep.push(r);
  }
  s.collateral = keep;
  const pBefore = s.pendingInputs.length;
  s.pendingInputs = s.pendingInputs.filter(p => now - p.at <= PENDING_EXPIRY_MS);
  if (released > 0 || s.pendingInputs.length !== pBefore) {
    await saveStore(s);
    if (released > 0) console.log('[UTXO-Expiry] Released', released, 'stale commitments');
  }
  return released;
}

export async function verifyCommitment(agreementId: string, role: 'buyer' | 'seller', pubkey: string): Promise<{
  valid: boolean; utxoCount: number; totalSompi: bigint;
}> {
  const s = await loadStore();
  const row = s.collateral.find(r => r.agrId === agreementId && r.role === role);
  if (!row) return { valid: false, utxoCount: 0, totalSompi: 0n };
  const expected = await computeCommitHash(agreementId, role, pubkey);
  const valid = !!row.commitHash && row.commitHash === expected;
  console.log(`[UTXO-Tag] Verified ${agreementId}: ${Number(BigInt(row.sompi)) / 1e8} KAS, valid: ${valid}`);
  return { valid, utxoCount: 1, totalSompi: BigInt(row.sompi) };
}

export async function isAlreadyCommitted(agreementId: string): Promise<{
  committed: boolean; utxoCount: number; totalSompi: bigint; status: UtxoStatus | null;
}> {
  const s = await loadStore();
  const row = s.collateral.find(r => r.agrId === agreementId);
  if (!row) return { committed: false, utxoCount: 0, totalSompi: 0n, status: null };
  const status: UtxoStatus = row.locked ? 'collateral-locked' : 'collateral-committed';
  console.log('[UTXO-Guard] AGR', agreementId, 'already committed:', Number(BigInt(row.sompi)) / 1e8, 'KAS, status:', status);
  return { committed: true, utxoCount: 1, totalSompi: BigInt(row.sompi), status };
}

export async function clearLedger(): Promise<void> {
  await AsyncStorage.removeItem(VSTORE_KEY);
  await AsyncStorage.removeItem(LEGACY_LEDGER_KEY);
}
