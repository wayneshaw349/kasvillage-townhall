// ============================================================================
// KASVILLAGE - IOU BALANCE SHEET + NEIGHBOR AGREEMENT (PRODUCTION)
// ============================================================================
// Off-chain IOU ledger integrated with FROST 2-of-2 Neighbor Agreement.
//
// Architecture:
// - FROST 2-of-2 multisig locks collateral from both parties
// - IOUs are off-chain, backed by UTXO batch tags (imaginary KAS)
// - Settlement uses the FROST multisig partial sigs
// - Both parties must cooperate to release funds
// - Deadlock = FUNDS_LOCKED (no arbitration, both lose XP)
//
// Features:
// - Batch-tagged sompi allocation (FIFO)
// - Overspend protection with "Settle first" UX
// - FROST collateral display
// - Settlement via multisig release
// - Arweave archival
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Keyboard,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
  AppState,
  type AppStateStatus,
} from 'react-native';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop, Text as SvgText, RadialGradient } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserStats } from './wallet_registration_v2';
import * as Network from 'expo-network';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// Kaspa client (type only — REST used at runtime)
import { type KaspaNetwork } from './KaspaClient';

// Arweave
import { allocateForIOU, releaseIOU, getSpendableUtxos } from './utxo_ledger';
import { createProposal, decodeProposal, verifyProposal, acceptProposal, shareProposal, shareAcceptance } from './proposal_share';
import { uploadToTurbo, uploadToIrys, type IrysUploadResult } from './arweave_upload';
import { type ArweaveTag } from './arweave_module';

// ============================================================================
// CONSTANTS
// ============================================================================

const KV_IOU_TAG = 'KV_IOU_V2';
const AKASH_RELAY_URL = 'https://townhall.kasvillage.io';
const TAILSCALE_PORT = 8765;
const WIFI_P2P_PORT = 8766;

const KV_BLE_SERVICE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const KV_BLE_IOU_CHAR = 'a1b2c3d4-e5f6-7890-abcd-ef1234567891';

const SOMPI_PER_KAS = 100_000_000n;
const XP_THRESHOLD_IOU_ACCESS = 150;
const XP_THRESHOLD_FULL_ACCESS = 500;
const IOU_LIMITS = { LOW: 50n * SOMPI_PER_KAS, FULL: 10000n * SOMPI_PER_KAS };

const POLL_INTERVAL_MS = 30_000;

// SecureStore keys
const KEYS = {
  LEDGERS: 'kv_iou_ledgers',
  BATCHES: 'kv_sompi_batches',
  USER_STATS: 'kv_user_stats',
  PRIVKEY_ENC: 'kv_l1_privkey_enc',
  ADDRESS: 'kaspa_address',
  PUBKEY: 'kv_l1_pubkey',
  NETWORK: 'kaspa_network',
  TAILSCALE_PEERS: 'kv_tailscale_peers',
  BLUETOOTH_PEERS: 'kv_bluetooth_peers',
  PENDING_IOUS: 'kv_pending_incoming_ious',
  SETTLE_REQUESTS: 'kv_settle_requests',
};

// ============================================================================
// TYPES
// ============================================================================

export interface SompiBatch {
  tag: string;
  txId: string;
  index: number;
  totalSompi: bigint;
  allocatedSompi: bigint;
  freeSompi: bigint;
  receivedAtDaa: bigint;
  allocations: BatchAllocation[];
}

export interface BatchAllocation {
  iouId: string;
  amountSompi: bigint;
  allocatedAt: number;
}

export interface SignedIOU {
  id: string;
  version: number;
  issuerPubkey: string;
  recipientPubkey: string;
  amountSompi: string;
  description: string;
  frostAgreementId: string;
  frostTxId: string;
  createdAtDaa: string;
  issuerSignature: string;
  recipientSignature: string;
  status: 'pending' | 'signed' | 'settled' | 'disputed';
  backedByBatches: { tag: string; amountSompi: string }[];
  arweaveTxId?: string;
}

export interface IOULedger {
  id: string;
  frostAgreementId: string;
  frostTxId: string;
  frostAddress: string;
  partyA: { pubkey: string; address: string; alias?: string; collateralSompi: string };
  partyB: { pubkey: string; address: string; alias?: string; collateralSompi: string };
  ious: SignedIOU[];
  netPositionSompi: string;
  createdAt: number;
  status: 'active' | 'settling' | 'settled' | 'deadlocked';
  settlementTxId?: string;
}

export interface SettleRequest {
  id: string;
  ledgerId: string;
  frostAgreementId: string;
  requesterPubkey: string;
  amountSompi: string;
  timestamp: number;
  signature: string;
}

export interface WalletState {
  batches: SompiBatch[];
  totalBalance: bigint;
  allocatedBalance: bigint;
  freeBalance: bigint;
  userXP: number;
}

export interface FrostCollateral {
  myCollateralSompi: bigint;
  counterpartyCollateralSompi: bigint;
  totalLocked: bigint;
  frostAddress: string;
  frostTxId: string;
}

interface Peer { pubkey: string; endpoint: string; lastSeen: number }
interface IncomingMessage { type: string; payload: any; senderPubkey: string; timestamp: number }

type CoinStatus = 'pending' | 'signed' | 'settled';
type Transport = 'bluetooth' | 'tailscale' | 'wifi' | 'relay' | 'none';

// ============================================================================
// REST API HELPER
// ============================================================================

async function getApiBase(): Promise<string> {
  const networkStr = await SecureStore.getItemAsync(KEYS.NETWORK);
  const isTestnet = networkStr?.includes('testnet');
  return isTestnet ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
}

// ============================================================================
// HELPERS
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const clean = (hex || '').startsWith('0x') ? (hex || '').slice(2) : (hex || '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function sompiToKas(sompi: bigint): number {
  return Number(sompi) / 100_000_000;
}

function kasToSompi(kas: number): bigint {
  return BigInt(Math.round(kas * 100_000_000));
}

function formatKAS(sompi: bigint): string {
  const kas = sompiToKas(sompi);
  if (kas >= 1_000_000) return `${(kas / 1_000_000).toFixed(2)}M KASPA`;
  if (kas >= 1_000) return `${(kas / 1_000).toFixed(2)}K KASPA`;
  return `${kas.toFixed(4)} KASPA`;
}

function mapStatus(s: SignedIOU['status']): CoinStatus {
  return s === 'disputed' ? 'pending' : s;
}

// ============================================================================
// WALLET CREDENTIALS
// ============================================================================

async function getWalletCredentials(): Promise<{ address: string; pubkey: string; privkey: string } | null> {
  try {
    const address = await SecureStore.getItemAsync(KEYS.ADDRESS);
      if (!address) { console.log('[IOU] no address yet'); return null; }
    const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey') || await SecureStore.getItemAsync('public_key') || await SecureStore.getItemAsync('kv_public_key');
      console.log('[IOU] resolved pubkey:', !!pubkey);
      if (!pubkey) { console.log('[IOU] no pubkey in any key'); return null; }
    const privkey = await SecureStore.getItemAsync(KEYS.PRIVKEY_ENC);
    
    if (!address || !pubkey || !privkey) return null;
    return { address, pubkey, privkey };
  } catch {
    return null;
  }
}

async function getUserXP(): Promise<number> {
  try {
    const stats = await getUserStats();
    console.log('[IOU] getUserXP from TownHall:', stats.xp);
    return stats.xp || 0;
  } catch (e) {
    console.warn('[IOU] getUserXP failed:', e);
    return 0;
  }
}

// ============================================================================
// SOMPI BATCH TRACKING
// ============================================================================

async function loadBatches(): Promise<Map<string, SompiBatch>> {
  try {
    const json = await AsyncStorage.getItem(KEYS.BATCHES);
    if (!json) return new Map();
    
    const arr = JSON.parse(json) as any[];
    const map = new Map<string, SompiBatch>();
    for (const b of arr) {
      map.set(b.tag, {
        ...b,
        totalSompi: BigInt(b.totalSompi),
        allocatedSompi: BigInt(b.allocatedSompi),
        freeSompi: BigInt(b.freeSompi),
        receivedAtDaa: BigInt(b.receivedAtDaa),
        allocations: b.allocations.map((a: any) => ({ ...a, amountSompi: BigInt(a.amountSompi) })),
      });
    }
    return map;
  } catch (e) {
    console.error('[IOU] loadBatches error:', e);
    return new Map();
  }
}

async function saveBatches(batches: Map<string, SompiBatch>): Promise<void> {
  const arr = Array.from(batches.values()).map(b => ({
    ...b,
    totalSompi: (b.totalSompi || 0n).toString(),
    allocatedSompi: (b.allocatedSompi || 0n).toString(),
    freeSompi: (b.freeSompi || 0n).toString(),
    receivedAtDaa: (b.receivedAtDaa || 0).toString(),
    allocations: b.allocations.map(a => ({ ...a, amountSompi: (a.amountSompi || 0n).toString() })),
  }));
  await AsyncStorage.setItem(KEYS.BATCHES, JSON.stringify(arr));
}

export async function syncBatches(address: string): Promise<Map<string, SompiBatch>> {
  try {
    // REST API instead of wRPC (wRPC not available from React Native/Hermes)
    const apiBase = await getApiBase();
    const resp = await fetch(apiBase + '/addresses/' + address + '/utxos');
    if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);
    const rawUtxos = await resp.json();
    const utxos = rawUtxos.map((u: any) => ({
      txId: u.outpoint?.transactionId || u.transactionId || '',
      index: u.outpoint?.index ?? u.index ?? 0,
      amount: BigInt(u.utxoEntry?.amount || u.amount || '0'),
      blockDaaScore: BigInt(u.utxoEntry?.blockDaaScore || u.blockDaaScore || '0'),
    }));

    const existing = await loadBatches();
    const updated = new Map<string, SompiBatch>();
    
    for (const u of utxos) {
      const tag = `${u.txId}:${u.index}`;
      const old = existing.get(tag);
      
      if (old) {
        updated.set(tag, old);
      } else {
        updated.set(tag, {
          tag,
          txId: u.txId,
          index: u.index,
          totalSompi: u.amount,
          allocatedSompi: 0n,
          freeSompi: u.amount,
          receivedAtDaa: u.blockDaaScore,
          allocations: [],
        });
      }
    }
    
    await saveBatches(updated);
    return updated;
  } catch (e) {
    console.error('[IOU] syncBatches error:', e);
    return await loadBatches();
  }
}

async function allocateBatches(
  address: string,
  iouId: string,
  amountSompi: bigint
): Promise<{ batches: { tag: string; amountSompi: string }[]; error?: string }> {
  const batchMap = await syncBatches(address);
  
  const sorted = Array.from(batchMap.values())
    .filter(b => b.freeSompi > 0n)
    .sort((a, b) => Number(a.receivedAtDaa - b.receivedAtDaa));
  
  const totalFree = sorted.reduce((s, b) => s + b.freeSompi, 0n);
  if (totalFree < amountSompi) {
    return { batches: [], error: `Insufficient balance. Free: ${formatKAS(totalFree)}, need: ${formatKAS(amountSompi)}. Settle existing IOUs first.` };
  }
  
  let remaining = amountSompi;
  const allocated: { tag: string; amountSompi: string }[] = [];
  
  for (const batch of sorted) {
    if (remaining <= 0n) break;
    
    const take = batch.freeSompi >= remaining ? remaining : batch.freeSompi;
    batch.allocations.push({ iouId, amountSompi: take, allocatedAt: Date.now() });
    batch.allocatedSompi += take;
    batch.freeSompi -= take;
    allocated.push({ tag: batch.tag, amountSompi: take.toString() });
    remaining -= take;
  }
  
  await saveBatches(batchMap);
  return { batches: allocated };
}

export async function releaseStaleAllocations(): Promise<number> {
  const [batches, ledgers] = await Promise.all([loadBatches(), loadLedgers()]);
  const liveIds = new Set(ledgers.flatMap(l => l.ious.map(i => i.id)));
  let freed = 0n;
  for (const b of batches.values()) {
    const stale = b.allocations.filter(a => !liveIds.has(a.iouId));
    const amt = stale.reduce((s2,a) => s2 + a.amountSompi, 0n);
    b.allocations = b.allocations.filter(a => liveIds.has(a.iouId));
    b.allocatedSompi -= amt; b.freeSompi += amt; freed += amt;
  }
  await saveBatches(batches);
  return Number(freed);
}

async function releaseBatches(iouId: string): Promise<void> {
  const batches = await loadBatches();
  for (const batch of batches.values()) {
    const toRemove = batch.allocations.filter(a => a.iouId === iouId);
    const freed = toRemove.reduce((s, a) => s + a.amountSompi, 0n);
    batch.allocations = batch.allocations.filter(a => a.iouId !== iouId);
    batch.allocatedSompi -= freed;
    batch.freeSompi += freed;
  }
  await saveBatches(batches);
}

// ============================================================================
// WALLET STATE
// ============================================================================

export async function getWalletState(address: string): Promise<WalletState> {
  try { await releaseStaleAllocations(); } catch {}
  const [batchMap, userXP] = await Promise.all([syncBatches(address), getUserXP()]);
  const batches = Array.from(batchMap.values());
  
  return {
    batches,
    totalBalance: batches.reduce((s, b) => s + b.totalSompi, 0n),
    allocatedBalance: batches.reduce((s, b) => s + b.allocatedSompi, 0n),
    freeBalance: batches.reduce((s, b) => s + b.freeSompi, 0n),
    userXP,
  };
}

// ============================================================================
// IOU SIGNING
// ============================================================================

function computeIOUHash(iou: Partial<SignedIOU>): Uint8Array {
  const canonical = JSON.stringify({
    id: iou.id,
    version: iou.version,
    issuerPubkey: iou.issuerPubkey,
    recipientPubkey: iou.recipientPubkey,
    amountSompi: iou.amountSompi,
    description: iou.description,
    frostAgreementId: iou.frostAgreementId,
    frostTxId: iou.frostTxId,
    createdAtDaa: iou.createdAtDaa,
    backedByBatches: iou.backedByBatches,
  });
  return sha256(new TextEncoder().encode('KV_IOU_V2:' + canonical));
}

function signIOUSync(iou: Partial<SignedIOU>, privateKeyHex: string): string {
  const hash = computeIOUHash(iou);
  const sig = secp256k1.sign(hash, hexToBytes(privateKeyHex));
  return bytesToHex(sig.toCompactRawBytes());
}

function verifyIOUSignature(iou: SignedIOU, signature: string, pubkeyHex: string): boolean {
  try {
    const hash = computeIOUHash(iou);
    return secp256k1.verify(hexToBytes(signature), hash, hexToBytes(pubkeyHex));
  } catch {
    return false;
  }
}

function signSettleRequest(req: Omit<SettleRequest, 'signature'>, privkey: string): string {
  const canonical = JSON.stringify({ id: req.id, ledgerId: req.ledgerId, requesterPubkey: req.requesterPubkey, amountSompi: req.amountSompi, timestamp: req.timestamp });
  const hash = sha256(new TextEncoder().encode('KV_SETTLE_V1:' + canonical));
  const sig = secp256k1.sign(hash, hexToBytes(privkey));
  return bytesToHex(sig.toCompactRawBytes());
}

function verifySettleRequest(req: SettleRequest): boolean {
  try {
    const canonical = JSON.stringify({ id: req.id, ledgerId: req.ledgerId, requesterPubkey: req.requesterPubkey, amountSompi: req.amountSompi, timestamp: req.timestamp });
    const hash = sha256(new TextEncoder().encode('KV_SETTLE_V1:' + canonical));
    return secp256k1.verify(hexToBytes(req.signature), hash, hexToBytes(req.requesterPubkey));
  } catch {
    return false;
  }
}

// ============================================================================
// LEDGER STORAGE
// ============================================================================

async function loadLedgers(): Promise<IOULedger[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.LEDGERS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function saveLedgers(ledgers: IOULedger[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.LEDGERS, JSON.stringify(ledgers));
}

// ============================================================================
// PENDING IOUs & SETTLE REQUESTS
// ============================================================================

async function loadPendingIOUs(): Promise<SignedIOU[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.PENDING_IOUS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function savePendingIOUs(ious: SignedIOU[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.PENDING_IOUS, JSON.stringify(ious));
}

async function addPendingIOU(iou: SignedIOU): Promise<void> {
  const pending = await loadPendingIOUs();
  if (pending.some(p => p.id === iou.id)) return;
  pending.push(iou);
  await savePendingIOUs(pending);
}

async function removePendingIOU(iouId: string): Promise<void> {
  const pending = await loadPendingIOUs();
  await savePendingIOUs(pending.filter(p => p.id !== iouId));
}

async function loadSettleRequests(): Promise<SettleRequest[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.SETTLE_REQUESTS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function saveSettleRequests(reqs: SettleRequest[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTLE_REQUESTS, JSON.stringify(reqs));
}

async function addSettleRequest(req: SettleRequest): Promise<void> {
  const reqs = await loadSettleRequests();
  if (reqs.some(r => r.id === req.id)) return;
  reqs.push(req);
  await saveSettleRequests(reqs);
}

async function removeSettleRequest(reqId: string): Promise<void> {
  const reqs = await loadSettleRequests();
  await saveSettleRequests(reqs.filter(r => r.id !== reqId));
}

// ============================================================================
// IOU OPERATIONS
// ============================================================================

export async function canIssueIOU(address: string, amountSompi: bigint): Promise<{ ok: boolean; reason?: string; needsSettle?: boolean }> {
  const state = await getWalletState(address);
  
  if (state.userXP < XP_THRESHOLD_IOU_ACCESS) {
    return { ok: false, reason: `Need ${XP_THRESHOLD_IOU_ACCESS} XP (have ${state.userXP})` };
  }
  
  const limit = state.userXP >= XP_THRESHOLD_FULL_ACCESS ? IOU_LIMITS.FULL : IOU_LIMITS.LOW;
  if (amountSompi > limit) {
    return { ok: false, reason: `Exceeds limit ${formatKAS(limit)}` };
  }
  
  if (amountSompi > state.freeBalance) {
    const shortage = amountSompi - state.freeBalance;
    return { 
      ok: false, 
      reason: `Insufficient free balance. Need ${formatKAS(shortage)} more. Settle existing IOUs to free up funds.`,
      needsSettle: true,
    };
  }
  
  return { ok: true };
}

export async function createIOU(
  ledgerId: string,
  recipientPubkey: string,
  amountSompi: bigint,
  description: string,
  frostTxId: string
): Promise<SignedIOU | { error: string; needsSettle?: boolean }> {
  const creds = await getWalletCredentials();
  if (!creds) return { error: 'Wallet not initialized' };
  
  const ledgers = await loadLedgers();
  const ledger = ledgers.find(l => l.id === ledgerId);
  if (!ledger) return { error: 'Ledger not found' };
  
  const check = await canIssueIOU(creds.address, amountSompi);
  if (!check.ok) return { error: check.reason!, needsSettle: check.needsSettle };
  
  const iouId = generateId();
  const alloc = await allocateBatches(creds.address, iouId, amountSompi);
  if (alloc.error) return { error: alloc.error, needsSettle: true };
  
  // Get DAA score via REST (wRPC not available from React Native/Hermes)
  let daa: bigint;
  try {
    const apiBase = await getApiBase();
    const daaResp = await fetch(apiBase + '/info/virtual-chain-blue-score');
    const daaJson = await daaResp.json();
    daa = BigInt(daaJson.blueScore || Date.now());
  } catch {
    daa = BigInt(Date.now());
  }
  
  const iou: SignedIOU = {
    id: iouId,
    version: 2,
    issuerPubkey: creds.pubkey,
    recipientPubkey,
    amountSompi: amountSompi.toString(),
    description,
    frostAgreementId: ledger.frostAgreementId,
    frostTxId,
    createdAtDaa: daa.toString(),
    issuerSignature: '',
    recipientSignature: '',
    status: 'pending',
    backedByBatches: alloc.batches,
  };
  
  iou.issuerSignature = signIOUSync(iou, creds.privkey);
  try { await SecureStore.setItemAsync('kv_pending_iou', JSON.stringify({ iouId, amount: formatKAS(amountSompi), created: Date.now(), expiresMs: 86400000 })); } catch {}
  return iou;
}

export async function countersignIOU(iou: SignedIOU, uploadToArweave: boolean = true): Promise<SignedIOU | { error: string }> {
  const creds = await getWalletCredentials();
  if (!creds) return { error: 'Wallet not initialized' };
  
  if (iou.recipientPubkey !== creds.pubkey) return { error: 'Not the recipient' };
  if (!verifyIOUSignature(iou, iou.issuerSignature, iou.issuerPubkey)) return { error: 'Invalid issuer signature' };
  
  const signed: SignedIOU = {
    ...iou,
    recipientSignature: signIOUSync(iou, creds.privkey),
    status: 'signed',
  };
  
  if (uploadToArweave) {
    try {
      const ar = await archiveIOUToArweave(signed);
      if (ar.success && ar.txId) signed.arweaveTxId = ar.txId;
    } catch (e) {
      console.error('[IOU] Arweave upload failed:', e);
    }
  }
  
  const ledgers = await loadLedgers();
  const ledger = ledgers.find(l => l.frostAgreementId === iou.frostAgreementId);
  if (ledger) {
    ledger.ious.push(signed);
    const amt = BigInt(iou.amountSompi);
    const net = BigInt(ledger.netPositionSompi);
    ledger.netPositionSompi = (iou.issuerPubkey === ledger.partyA.pubkey ? net + amt : net - amt).toString();
    await saveLedgers(ledgers);
  }
  
  await removePendingIOU(iou.id);
  return signed;
}

export function calculateNetPosition(ledger: IOULedger, myPubkey: string): { 
  iOwe: bigint; 
  theyOwe: bigint; 
  payerPubkey: string; 
  payerAddress: string; 
  payeeAddress: string;
  iAmPayer: boolean;
} {
  const net = BigInt(ledger.netPositionSompi);
  const amA = ledger.partyA.pubkey === myPubkey;
  
  if (net > 0n) {
    return {
      iOwe: amA ? net : 0n,
      theyOwe: amA ? 0n : net,
      payerPubkey: ledger.partyA.pubkey,
      payerAddress: ledger.partyA.address,
      payeeAddress: ledger.partyB.address,
      iAmPayer: amA,
    };
  }
  if (net < 0n) {
    return {
      iOwe: amA ? 0n : -net,
      theyOwe: amA ? -net : 0n,
      payerPubkey: ledger.partyB.pubkey,
      payerAddress: ledger.partyB.address,
      payeeAddress: ledger.partyA.address,
      iAmPayer: !amA,
    };
  }
  return { iOwe: 0n, theyOwe: 0n, payerPubkey: '', payerAddress: '', payeeAddress: '', iAmPayer: false };
}

export async function createSettleRequest(ledgerId: string): Promise<SettleRequest | { error: string }> {
  const creds = await getWalletCredentials();
  if (!creds) return { error: 'Wallet not initialized' };
  
  const ledgers = await loadLedgers();
  const ledger = ledgers.find(l => l.id === ledgerId);
  if (!ledger) return { error: 'Ledger not found' };
  
  const netPos = calculateNetPosition(ledger, creds.pubkey);
  const amountSompi = netPos.iOwe > 0n ? netPos.iOwe : netPos.theyOwe;
  
  const req: SettleRequest = {
    id: generateId(),
    ledgerId,
    frostAgreementId: ledger.frostAgreementId,
    requesterPubkey: creds.pubkey,
    amountSompi: amountSompi.toString(),
    timestamp: Date.now(),
    signature: '',
  };
  
  req.signature = signSettleRequest(req, creds.privkey);
  return req;
}

export async function markSettled(ledgerId: string, settlementTxId: string): Promise<void> {
  const ledgers = await loadLedgers();
  const ledger = ledgers.find(l => l.id === ledgerId);
  if (!ledger) return;
  
  for (const iou of ledger.ious) {
    if (iou.status === 'signed') {
      await releaseBatches(iou.id);
      iou.status = 'settled';
    }
  }
  ledger.status = 'settled';
  ledger.settlementTxId = settlementTxId;
  await saveLedgers(ledgers);
  
  const reqs = await loadSettleRequests();
  await saveSettleRequests(reqs.filter(r => r.ledgerId !== ledgerId));
}

export async function createLedger(
  frostAgreementId: string,
  frostTxId: string,
  frostAddress: string,
  myPubkey: string,
  myAddress: string,
  myCollateralSompi: bigint,
  counterpartyPubkey: string,
  counterpartyAddress: string,
  counterpartyCollateralSompi: bigint,
  counterpartyAlias?: string
): Promise<IOULedger> {
  const ledger: IOULedger = {
    id: generateId(),
    frostAgreementId,
    frostTxId,
    frostAddress,
    partyA: { pubkey: myPubkey, address: myAddress, collateralSompi: myCollateralSompi.toString() },
    partyB: { pubkey: counterpartyPubkey, address: counterpartyAddress, alias: counterpartyAlias, collateralSompi: counterpartyCollateralSompi.toString() },
    ious: [],
    netPositionSompi: '0',
    createdAt: Date.now(),
    status: 'active',
  };
  
  const ledgers = await loadLedgers();
  ledgers.push(ledger);
  await saveLedgers(ledgers);
  return ledger;
}

// ============================================================================
// ARWEAVE
// ============================================================================

async function archiveIOUToArweave(iou: SignedIOU): Promise<IrysUploadResult> {
  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Type', value: KV_IOU_TAG },
    { name: 'IOU-Id', value: iou.id },
    { name: 'Issuer', value: iou.issuerPubkey },
    { name: 'Recipient', value: iou.recipientPubkey },
    { name: 'Amount', value: iou.amountSompi },
    { name: 'FROST-TxId', value: iou.frostTxId },
    { name: 'Batch-Count', value: iou.backedByBatches.length.toString() },
  ];
  
  const data = JSON.stringify(iou);
  const result = await uploadToTurbo(data, tags);
  if (result.success) return result;
  return uploadToIrys(data, tags);
}

// ============================================================================
// TRANSPORT
// ============================================================================

async function loadPeers(key: string): Promise<Map<string, Peer>> {
  try {
    const json = await AsyncStorage.getItem(key);
    if (!json) return new Map();
    const arr = JSON.parse(json) as Peer[];
    return new Map(arr.map(p => [p.pubkey, p]));
  } catch {
    return new Map();
  }
}

async function savePeers(key: string, peers: Map<string, Peer>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(peers.values())));
}

export async function registerTailscalePeer(pubkey: string, ip: string): Promise<void> {
  const peers = await loadPeers(KEYS.TAILSCALE_PEERS);
  peers.set(pubkey, { pubkey, endpoint: ip, lastSeen: Date.now() });
  await savePeers(KEYS.TAILSCALE_PEERS, peers);
}

export async function registerBluetoothPeer(pubkey: string, deviceId: string): Promise<void> {
  const peers = await loadPeers(KEYS.BLUETOOTH_PEERS);
  peers.set(pubkey, { pubkey, endpoint: deviceId, lastSeen: Date.now() });
  await savePeers(KEYS.BLUETOOTH_PEERS, peers);
}

async function sendViaTailscale(pubkey: string, payload: string): Promise<boolean> {
  const peers = await loadPeers(KEYS.TAILSCALE_PEERS);
  const peer = peers.get(pubkey);
  if (!peer || Date.now() - peer.lastSeen > 5 * 60 * 1000) return false;
  
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`http://${peer.endpoint}:${TAILSCALE_PORT}/iou`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      peer.lastSeen = Date.now();
      await savePeers(KEYS.TAILSCALE_PEERS, peers);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function sendViaBluetooth(pubkey: string, payload: string): Promise<boolean> {
  const peers = await loadPeers(KEYS.BLUETOOTH_PEERS);
  const peer = peers.get(pubkey);
  if (!peer) return false;
  
  try {
    const { BleManager } = await import('react-native-ble-plx');
    const manager = new BleManager();
    const device = await manager.connectToDevice(peer.endpoint, { timeout: 5000 });
    await device.discoverAllServicesAndCharacteristics();
    
    const bytes = new TextEncoder().encode(payload);
    const chunkSize = 512;
    const chunks = Math.ceil(bytes.length / chunkSize);
    
    for (let i = 0; i < chunks; i++) {
      const chunk = bytes.slice(i * chunkSize, (i + 1) * chunkSize);
      const header = new Uint8Array([i, chunks]);
      const data = new Uint8Array(header.length + chunk.length);
      data.set(header);
      data.set(chunk, header.length);
      
      const base64 = btoa(String.fromCharCode(...data));
      await device.writeCharacteristicWithResponseForService(KV_BLE_SERVICE, KV_BLE_IOU_CHAR, base64);
    }
    
    await device.cancelConnection();
    peer.lastSeen = Date.now();
    await savePeers(KEYS.BLUETOOTH_PEERS, peers);
    return true;
  } catch (e) {
    console.log('[IOU] BLE send failed:', e);
    return false;
  }
}

async function sendViaWiFi(pubkey: string, payload: string): Promise<boolean> {
  try {
    const localIP = await Network.getIpAddressAsync();
    if (!localIP) return false;
    
    const parts = localIP.split('.');
    if (parts.length !== 4) return false;
    const subnet = parts.slice(0, 3).join('.');
    
    const hosts = [1, 2, 100, 101, 102, 150, 200, 254];
    for (const h of hosts) {
      const ip = `${subnet}.${h}`;
      if (ip === localIP) continue;
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 1000);
        const res = await fetch(`http://${ip}:${WIFI_P2P_PORT}/iou`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Recipient': pubkey },
          body: payload,
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          if (json.accepted && json.pubkey === pubkey) return true;
        }
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

async function sendViaRelay(pubkey: string, payload: string, type: string = 'IOU_V2'): Promise<boolean> {
  try {
    const creds = await getWalletCredentials();
    if (!creds) return false;
    
    const ts = Date.now();
    const msg = `${pubkey}:${payload}:${ts}`;
    const sig = secp256k1.sign(sha256(new TextEncoder().encode(msg)), hexToBytes(creds.privkey));
    
    const res = await fetch(`${AKASH_RELAY_URL}/relay/iou`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        payload,
        recipientPubkey: pubkey,
        senderPubkey: creds.pubkey,
        signature: bytesToHex(sig.toCompactRawBytes()),
        timestamp: ts,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendMessage(recipientPubkey: string, payload: string, type: string = 'IOU_V2'): Promise<{ success: boolean; via: Transport }> {
  const methods: Array<{ name: Transport; fn: () => Promise<boolean> }> = [
    { name: 'bluetooth', fn: () => sendViaBluetooth(recipientPubkey, payload) },
    { name: 'tailscale', fn: () => sendViaTailscale(recipientPubkey, payload) },
    { name: 'wifi', fn: () => sendViaWiFi(recipientPubkey, payload) },
    { name: 'relay', fn: () => sendViaRelay(recipientPubkey, payload, type) },
  ];
  
  for (const { name, fn } of methods) {
    try {
      if (await fn()) return { success: true, via: name };
    } catch {}
  }
  return { success: false, via: 'none' };
}

async function sendIOU(iou: SignedIOU, recipientPubkey: string): Promise<{ success: boolean; via: Transport }> {
  const payload = JSON.stringify({ type: 'IOU_V2', iou, ts: Date.now() });
  return sendMessage(recipientPubkey, payload, 'IOU_V2');
}

async function sendSettleRequestMsg(req: SettleRequest, recipientPubkey: string): Promise<{ success: boolean; via: Transport }> {
  const payload = JSON.stringify({ type: 'SETTLE_REQUEST', request: req, ts: Date.now() });
  return sendMessage(recipientPubkey, payload, 'SETTLE_REQUEST');
}

// ============================================================================
// POLLING
// ============================================================================

async function pollIncomingMessages(): Promise<{ ious: SignedIOU[]; settleRequests: SettleRequest[] }> {
  try {
    const creds = await getWalletCredentials();
    if (!creds) return { ious: [], settleRequests: [] };
    
    const res = await fetch(`${AKASH_RELAY_URL}/relay/inbox/${creds.pubkey}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!res.ok) return { ious: [], settleRequests: [] };
    
    const json = await res.json();
    const messages = json.messages || [];
    
    const ious: SignedIOU[] = [];
    const settleRequests: SettleRequest[] = [];
    
    for (const msg of messages) {
      try {
        const data = JSON.parse(msg.payload);
        
        if (msg.type === 'IOU_V2' && data.iou && data.iou.recipientPubkey === creds.pubkey) {
          ious.push(data.iou);
          await addPendingIOU(data.iou);
        }
        
        if (msg.type === 'SETTLE_REQUEST' && data.request) {
          const req = data.request as SettleRequest;
          if (verifySettleRequest(req)) {
            settleRequests.push(req);
            await addSettleRequest(req);
          }
        }
      } catch {}
    }
    
    return { ious, settleRequests };
  } catch {
    return { ious: [], settleRequests: [] };
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = Math.min(SCREEN_WIDTH / 393, 1.2);
const rs = (n: number) => Math.round(n * scale);

interface CoinProps {
  amountKAS: number;
  alias?: string;
  status: CoinStatus;
  size?: number;
}

function SilverDollarCoin({ amountKAS, alias, status, size = 120 }: CoinProps) {
  const borderColor = { pending: '#f39c12', signed: '#49d6aa', settled: '#3498db' }[status];
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#e8e8e8" />
          <Stop offset="50%" stopColor="#c0c0c0" />
          <Stop offset="100%" stopColor="#a0a0a0" />
        </LinearGradient>
        <RadialGradient id="turquoise" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#5dd9c1" />
          <Stop offset="100%" stopColor="#2ecc71" />
        </RadialGradient>
      </Defs>
      
      <Circle cx="50" cy="50" r="48" fill="url(#silver)" stroke={borderColor} strokeWidth="2" />
      <Circle cx="50" cy="50" r="35" fill="url(#turquoise)" />
      
      <G transform="translate(50, 48)">
        <Path d="M -10 -12 L -10 12 M -10 0 L 8 -12 M -10 0 L 8 12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
      </G>
      
      <SvgText x="50" y="80" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#333">
        {amountKAS.toFixed(2)} KAS
      </SvgText>
      
      {alias && <SvgText x="50" y="15" textAnchor="middle" fontSize="7" fill="#666">{(alias || '').slice(0, 12)}</SvgText>}
    </Svg>
  );
}

interface IOUCardProps {
  iou: SignedIOU;
  myPubkey: string;
  alias?: string;
  onApprove?: () => void;
}

function IOUCard({ iou, myPubkey, alias, onApprove }: IOUCardProps) {
  const isIssuer = iou.issuerPubkey === myPubkey;
  const amt = BigInt(iou.amountSompi);
  
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SilverDollarCoin amountKAS={sompiToKas(amt)} alias={alias} status={mapStatus(iou.status)} size={70} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardAmt, { color: isIssuer ? '#e74c3c' : '#2ecc71' }]}>
            {isIssuer ? '-' : '+'}{formatKAS(amt)}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{iou.description}</Text>
          <Text style={styles.cardMeta}>
            {iou.status.toUpperCase()} • {iou.backedByBatches.length} batches
            {iou.arweaveTxId && ' • 📦'}
          </Text>
        </View>
      </View>
      {iou.status === 'pending' && !isIssuer && onApprove && (
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
          <Text style={styles.approveBtnText}>✓ Approve & Sign</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface SettleRequestCardProps {
  request: SettleRequest;
  counterpartyAlias?: string;
  onAcknowledge: () => void;
}

function SettleRequestCard({ request, counterpartyAlias, onAcknowledge }: SettleRequestCardProps) {
  const amt = BigInt(request.amountSompi);
  const timeAgo = Math.round((Date.now() - request.timestamp) / 60000);
  
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#e74c3c' }]}>
      <Text style={styles.settleTitle}>⚠️ Settlement Requested</Text>
      <Text style={styles.settleText}>
        {counterpartyAlias || (request?.requesterPubkey || '').slice(0, 12) + '...'} wants to settle
      </Text>
      <Text style={styles.settleAmount}>{formatKAS(amt)}</Text>
      <Text style={styles.settleTime}>{timeAgo}m ago</Text>
      <TouchableOpacity style={styles.ackBtn} onPress={onAcknowledge}>
        <Text style={styles.ackBtnText}>Acknowledge</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// FROST COLLATERAL BOX
// ============================================================================

interface FrostCollateralBoxProps {
  frost: FrostCollateral;
  myAlias: string;
  counterpartyAlias?: string;
}

function FrostCollateralBox({ frost, myAlias, counterpartyAlias }: FrostCollateralBoxProps) {
  return (
    <View style={styles.frostBox}>
      <Text style={styles.frostTitle}>🔒 FROST 2-of-2 Multisig</Text>
      <Text style={styles.frostAddress}>{(frost?.frostAddress || '').slice(0, 20)}...</Text>
      
      <View style={styles.frostRow}>
        <View style={styles.frostParty}>
          <Text style={styles.frostLabel}>{myAlias} (You)</Text>
          <Text style={styles.frostValue}>{formatKAS(frost.myCollateralSompi)}</Text>
        </View>
        <View style={styles.frostDivider} />
        <View style={styles.frostParty}>
          <Text style={styles.frostLabel}>{counterpartyAlias || 'Counterparty'}</Text>
          <Text style={styles.frostValue}>{formatKAS(frost.counterpartyCollateralSompi)}</Text>
        </View>
      </View>
      
      <Text style={styles.frostTotal}>Total Locked: {formatKAS(frost.totalLocked)}</Text>
      <Text style={styles.frostNote}>Both parties must sign to release funds</Text>
    </View>
  );
}

// ============================================================================
// MAIN MODAL
// ============================================================================

interface Props {
  visible: boolean;
  frostAgreementId: string;
  frostTxId: string;
  frostAddress: string;
  myPubkey: string;
  myAddress: string;
  myCollateralSompi: bigint;
  counterpartyPubkey: string;
  counterpartyAddress: string;
  counterpartyCollateralSompi: bigint;
  counterpartyAlias?: string;
  onClose: () => void;
  onSettleInitiated?: (ledgerId: string, amountSompi: bigint, payerAddress: string, payeeAddress: string) => void;
}

export function IOUBalanceSheetModal(rawProps: Partial<Props> & { visible: boolean; onClose: () => void }) {
  const props = { frostAgreementId: '', frostTxId: '', frostAddress: '', myPubkey: '', myAddress: '', myCollateralSompi: 0n, counterpartyPubkey: '', counterpartyAddress: '', counterpartyCollateralSompi: 0n, ...rawProps };
  const [pendingIOU, setPendingIOU] = React.useState<any>(null);
  React.useEffect(() => { (async () => { try { const pj = await SecureStore.getItemAsync('kv_pending_iou'); if (pj) { const p = JSON.parse(pj); if (Date.now() - p.created > p.expiresMs) { await releaseIOU(p.iouId); await SecureStore.deleteItemAsync('kv_pending_iou'); setPendingIOU(null); } else { setPendingIOU(p); } } } catch {} })(); }, []);
  const { 
    visible, frostAgreementId, frostTxId, frostAddress, 
    myPubkey, myAddress, myCollateralSompi,
    counterpartyPubkey, counterpartyAddress, counterpartyCollateralSompi, counterpartyAlias, 
    onClose, onSettleInitiated 
  } = props;
  
  const [ledger, setLedger] = useState<IOULedger | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [pendingIOUs, setPendingIOUs] = useState<SignedIOU[]>([]);
  const [settleRequests, setSettleRequests] = useState<SettleRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [frostAddr, setFrostAddr] = useState('');
  const [counterpartyInput, setCounterpartyInput] = useState('');
  const [frostBalance, setFrostBalance] = useState(0n);
  const [showActive, setShowActive] = useState(false);
  const [newIOUMode, setNewIOUMode] = useState<'none'|'send'|'receive'>('none');
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');
  const [proposalSending, setProposalSending] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [incomingProposal, setIncomingProposal] = useState<any>(null);
  const [proposalVerified, setProposalVerified] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  const frost: FrostCollateral = useMemo(() => ({
    myCollateralSompi,
    counterpartyCollateralSompi,
    totalLocked: myCollateralSompi + counterpartyCollateralSompi,
    frostAddress,
    frostTxId,
  }), [myCollateralSompi, counterpartyCollateralSompi, frostAddress, frostTxId]);
  
  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    
    try {
      const ledgers = await loadLedgers();
      let l = ledgers.find(x => x.frostAgreementId === frostAgreementId);
      if (!l) {
        l = await createLedger(
          frostAgreementId, frostTxId, frostAddress,
          myPubkey, myAddress, myCollateralSompi,
          counterpartyPubkey, counterpartyAddress, counterpartyCollateralSompi, counterpartyAlias
        );
      }
      setLedger(l);
      setWallet(await getWalletState(myAddress));
      
      await pollIncomingMessages();
      const allPending = await loadPendingIOUs();
      setPendingIOUs(allPending.filter(p => p.frostAgreementId === frostAgreementId));
      
      const allSettleReqs = await loadSettleRequests();
      setSettleRequests(allSettleReqs.filter(r => r.frostAgreementId === frostAgreementId));
    } catch (e) {
      console.error('[IOU] loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [frostAgreementId, frostTxId, frostAddress, myPubkey, myAddress, myCollateralSompi, counterpartyPubkey, counterpartyAddress, counterpartyCollateralSompi, counterpartyAlias]);
  
  useEffect(() => {
    if (visible && frostAgreementId) { loadData(); } else if (visible) { setLoading(false); }
  }, [visible, loadData]);
  
  useEffect(() => {
    if (!visible) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    
    const poll = async () => {
      const { ious, settleRequests: newReqs } = await pollIncomingMessages();
      if (ious.length > 0 || newReqs.length > 0) {
        const allPending = await loadPendingIOUs();
        setPendingIOUs(allPending.filter(p => p.frostAgreementId === frostAgreementId));
        const allSettleReqs = await loadSettleRequests();
        setSettleRequests(allSettleReqs.filter(r => r.frostAgreementId === frostAgreementId));
      }
    };
    
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && appStateRef.current !== 'active') poll();
      appStateRef.current = state;
    };
    
    const sub = AppState.addEventListener('change', handleAppState);
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, [visible, frostAgreementId]);
  
  const netPos = useMemo(() => ledger ? calculateNetPosition(ledger, myPubkey) : { iOwe: 0n, theyOwe: 0n, payerPubkey: '', payerAddress: '', payeeAddress: '', iAmPayer: false }, [ledger, myPubkey]);
  
  const handleCreate = useCallback(async () => {
    if (!ledger) return;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return Alert.alert('Error', 'Invalid amount');
    
    const result = await createIOU(ledger.id, counterpartyPubkey, kasToSompi(n), desc || `IOU ${n} KAS`, frostTxId);
    
    if ('error' in result) {
      if (result.needsSettle) {
        Alert.alert(
          'Insufficient Balance',
          result.error + '\n\nWould you like to request settlement?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Request Settle', onPress: () => handleRequestSettle() },
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
      return;
    }
    
    const transport = await sendIOU(result, counterpartyPubkey);
    setAmount('');
    setDesc('');
    setShowCreate(false);
    
    await loadData(false);
    Alert.alert('Sent', `IOU sent via ${transport.via}`);
  }, [ledger, amount, desc, counterpartyPubkey, frostTxId, loadData]);
  
  const handleApprove = useCallback(async (iou: SignedIOU) => {
    Alert.alert(
      'Approve IOU?',
      `Accept ${formatKAS(BigInt(iou.amountSompi))} from ${counterpartyAlias || (iou?.issuerPubkey || '').slice(0, 12) + '...'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            const result = await countersignIOU(iou, true);
            if ('error' in result) {
              Alert.alert('Error', result.error);
            } else {
              Alert.alert('Signed!', result.arweaveTxId ? `Archived: ${(result?.arweaveTxId || '').slice(0, 12)}...` : 'IOU accepted');
              await loadData(false);
            }
          },
        },
      ]
    );
  }, [loadData, counterpartyAlias]);
  
  const handleRequestSettle = useCallback(async () => {
    if (!ledger) return;
    
    const result = await createSettleRequest(ledger.id);
    if ('error' in result) return Alert.alert('Error', result.error);
    
    const transport = await sendSettleRequestMsg(result, counterpartyPubkey);
    Alert.alert('Sent', `Settlement request sent via ${transport.via}`);
  }, [ledger, counterpartyPubkey]);
  
  const handleSettle = useCallback(async () => {
    if (!ledger) return;
    
    const amt = netPos.iOwe > 0n ? netPos.iOwe : netPos.theyOwe;
    if (amt === 0n) return Alert.alert('Balanced', 'Nothing to settle');
    
    Alert.alert(
      'Settle via FROST Multisig',
      netPos.iAmPayer 
        ? `You will release ${formatKAS(amt)} to ${counterpartyAlias || 'counterparty'} from the locked collateral.`
        : `${counterpartyAlias || 'Counterparty'} owes you ${formatKAS(amt)}. Request them to initiate settlement.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: netPos.iAmPayer ? 'Initiate Release' : 'Request Payment',
          onPress: async () => {
            if (netPos.iAmPayer && onSettleInitiated) {
              onSettleInitiated(ledger.id, amt, netPos.payerAddress, netPos.payeeAddress);
            } else if (!netPos.iAmPayer) {
              await handleRequestSettle();
            }
          },
        },
      ]
    );
  }, [ledger, netPos, counterpartyAlias, onSettleInitiated, handleRequestSettle]);
  
  const handleAckSettleRequest = useCallback(async (req: SettleRequest) => {
    await removeSettleRequest(req.id);
    setSettleRequests(prev => prev.filter(r => r.id !== req.id));
    handleSettle();
  }, [handleSettle]);
  
  if (!visible) return null;
  
  if (loading) {
    return (
      <Modal visible>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#49d6aa" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </Modal>
    );
  }
  
  if (wallet && wallet.userXP < XP_THRESHOLD_IOU_ACCESS) {
    return (
      <Modal visible animationType="slide">
        <View style={styles.xpGate}>
          <Text style={styles.xpIcon}>🐌</Text>
          <Text style={styles.xpTitle}>IOU Locked</Text>
          <Text style={styles.xpText}>Need {XP_THRESHOLD_IOU_ACCESS} XP (have {wallet.userXP})</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }
  
  const coinStatus: CoinStatus = ledger?.status === 'settled' ? 'settled' : 'signed';
  const hasUnsettled = (netPos.iOwe > 0n || netPos.theyOwe > 0n) && ledger?.status === 'active';
  
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>IOU Balance Sheet</Text>
          <View style={styles.headerRight}>
            {(pendingIOUs.length > 0 || settleRequests.length > 0) && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingIOUs.length + settleRequests.length}</Text>
              </View>
            )}
            {refreshing && <ActivityIndicator size="small" color="#49d6aa" style={{ marginRight: 8 }} />}
            <TouchableOpacity onPress={onClose}><Text style={styles.x}>✕</Text></TouchableOpacity>
          </View>
        </View>
        
        <ScrollView style={styles.content}>
          {/* FROST Collateral */}
          <FrostCollateralBox frost={frost} myAlias="You" counterpartyAlias={counterpartyAlias} />
          
          {/* Net Position */}
          <View style={styles.coinBox}>
            <SilverDollarCoin
              amountKAS={sompiToKas(netPos.iOwe > 0n ? netPos.iOwe : netPos.theyOwe)}
              alias={counterpartyAlias}
              status={coinStatus}
              size={140}
            />
            <Text style={[styles.netText, { color: netPos.iOwe > 0n ? '#e74c3c' : netPos.theyOwe > 0n ? '#2ecc71' : '#888' }]}>
              {netPos.iOwe > 0n ? `You owe ${formatKAS(netPos.iOwe)}` : netPos.theyOwe > 0n ? `They owe ${formatKAS(netPos.theyOwe)}` : 'Balanced'}
            </Text>
            
            {hasUnsettled && (
              <TouchableOpacity style={styles.settleBtn} onPress={handleSettle}>
                <Text style={styles.settleBtnText}>
                  {netPos.iAmPayer ? '💳 Settle Now' : '📨 Request Payment'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Wallet State */}
          {wallet && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Your Sompi Batches</Text>
              <Text style={styles.boxRow}>Total: <Text style={styles.boxVal}>{formatKAS(wallet.totalBalance)}</Text></Text>
              <Text style={styles.boxRow}>Allocated: <Text style={[styles.boxVal, { color: '#f39c12' }]}>{formatKAS(wallet.allocatedBalance)}</Text></Text>
              <Text style={styles.boxRow}>Free: <Text style={[styles.boxVal, { color: '#2ecc71' }]}>{formatKAS(wallet.freeBalance)}</Text></Text>
              <Text style={styles.boxRow}>Batches: <Text style={styles.boxVal}>{wallet.batches.length}</Text></Text>
            </View>
          )}
          
          {/* Settle Requests */}
          {settleRequests.length > 0 && (
            <>
              <Text style={[styles.section, { color: '#e74c3c' }]}>🔔 Settlement Requests ({settleRequests.length})</Text>
              {settleRequests.map(r => (
                <SettleRequestCard key={r.id} request={r} counterpartyAlias={counterpartyAlias} onAcknowledge={() => handleAckSettleRequest(r)} />
              ))}
            </>
          )}
          
          {/* Pending IOUs */}
          {pendingIOUs.length > 0 && (
            <>
              <Text style={[styles.section, { color: '#f39c12' }]}>⏳ Pending Approval ({pendingIOUs.length})</Text>
              {pendingIOUs.map(i => (
                <IOUCard key={i.id} iou={i} myPubkey={myPubkey} alias={counterpartyAlias} onApprove={() => handleApprove(i)} />
              ))}
            </>
          )}
          
          {/* Signed IOUs */}
          <Text style={styles.section}>IOUs ({ledger?.ious.length || 0})</Text>
          {!ledger?.ious.length ? (
            <><Text style={styles.empty}>No IOUs yet</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' }}>Create a FROST 2-of-2 collateral wallet with your counterparty, then issue IOUs backed by locked KAS.</Text>
            {/* FROST Address Input */}
            <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>FROST 2-of-2 Collateral</Text>
              <Text style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Enter your shared FROST escrow address to track collateral and issue IOUs.</Text>
              <TextInput value={frostAddr} onChangeText={setFrostAddr} placeholder="kaspa:... or kaspatest:..." placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#333', fontFamily: 'monospace' }} />
              <Text style={{ color: '#888', fontSize: 11, marginTop: 10, marginBottom: 4 }}>Counterparty Pubkey or APT</Text>
              <TextInput value={counterpartyInput} onChangeText={setCounterpartyInput} placeholder="02... or APT-XXXX" placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#333', fontFamily: 'monospace' }} />
              {frostAddr ? (
                <TouchableOpacity onPress={async () => { try { const { getBalance } = await import('./kaspa_unified'); const bal = await getBalance(frostAddr); setFrostBalance(bal); } catch(e:any) { Alert.alert('Error', e.message); } }} style={{ marginTop: 10, backgroundColor: '#49d6aa20', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }}>
                  <Text style={{ color: '#49d6aa', fontWeight: '600', fontSize: 13 }}>Check Collateral Balance</Text>
                </TouchableOpacity>
              ) : null}
              {frostBalance > 0n && (
                <Text style={{ color: '#49d6aa', fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>Locked: {(Number(frostBalance) / 1e8).toFixed(4)} KAS</Text>
              )}
            </View>

            {pendingIOU && (
              <View style={{ marginTop: 12, backgroundColor: '#3a2a1a', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#D4AF37' }}>
                <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 13 }}>Pending IOU — awaiting signed acceptance</Text>
                <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>{pendingIOU.amount} KAS held</Text>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Auto-releases {new Date(pendingIOU.created + pendingIOU.expiresMs).toLocaleString()}</Text>
                <TouchableOpacity onPress={async () => { try { await releaseIOU(pendingIOU.iouId); await SecureStore.deleteItemAsync('kv_pending_iou'); setPendingIOU(null); Alert.alert('Released', 'IOU hold cancelled, funds freed'); } catch(e:any) { Alert.alert('Error', e.message); } }} style={{ marginTop: 10, backgroundColor: '#e74c3c20', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' }}>
                  <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: 13 }}>Cancel IOU Hold</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Active IOUs */}
            <TouchableOpacity onPress={() => setShowActive(!showActive)} style={{ marginTop: 12, backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 13 }}>Active IOUs</Text>
              <Text style={{ color: '#888', fontSize: 12 }}>{showActive ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showActive && (
              <View style={{ backgroundColor: '#0a0a0a', borderRadius: 8, padding: 10, marginTop: 4 }}>
                <Text style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>No active IOUs — create one below</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setNewIOUMode('send')} style={{ flex: 1, backgroundColor: '#D4AF37', padding: 14, borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>New IOU</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNewIOUMode('receive')} style={{ flex: 1, backgroundColor: '#49d6aa20', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }}>
                <Text style={{ color: '#49d6aa', fontWeight: 'bold', fontSize: 15 }}>Receive IOU</Text>
              </TouchableOpacity>
            </View>
            {newIOUMode === 'send' && (
              <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Amount (KAS)</Text>
                <TextInput value={proposalAmount} onChangeText={setProposalAmount} placeholder="0.00" placeholderTextColor="#555" keyboardType="decimal-pad" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#333' }} />
                <Text style={{ color: '#888', fontSize: 12, marginTop: 10, marginBottom: 8 }}>Description</Text>
                <TextInput value={proposalDesc} onChangeText={setProposalDesc} placeholder="What's this for?" placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#333' }} />
                <TouchableOpacity onPress={async () => { setProposalSending(true); try { const amtSompiNum = Math.floor(parseFloat(proposalAmount) * 1e8);
                  console.log('[IOU] amtSompi:', amtSompiNum);
                  const amtSompi = BigInt(amtSompiNum);
                  const addr = await SecureStore.getItemAsync('kv_kaspa_address') || await SecureStore.getItemAsync('kaspa_address');
                  if (!addr) throw new Error('No address');
                  const spendable = await getSpendableUtxos(addr);
                  if (spendable.spendableBalance < amtSompi) throw new Error('Insufficient free balance: ' + (Number(spendable.spendableBalance)/1e8).toFixed(4) + ' KAS available');
                  const alloc = await allocateForIOU(addr, amtSompi, 'iou-' + Date.now());
                  if (!alloc.success) throw new Error(alloc.error || 'Allocation failed');
                  const p = await createProposal('iou', parseFloat(proposalAmount), proposalDesc);
                  if ('error' in p) throw new Error(p.error);
                  await shareProposal(p.encoded, parseFloat(proposalAmount)||0); } catch(e:any) { Alert.alert('Error', e.message); } setProposalSending(false); }} disabled={proposalSending || !proposalAmount} style={{ marginTop: 12, backgroundColor: '#D4AF37', padding: 12, borderRadius: 8, alignItems: 'center', opacity: proposalSending || !proposalAmount ? 0.5 : 1 }}>
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>{proposalSending ? 'Creating...' : 'Create & Share'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {newIOUMode === 'receive' && (
              <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Paste proposal from sender</Text>
                <TextInput value={pasteInput} onChangeText={setPasteInput} placeholder="Paste proposal here..." placeholderTextColor="#555" multiline style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 12, borderWidth: 1, borderColor: '#333', minHeight: 80 }} />
                <TouchableOpacity onPress={async () => { try { const d = decodeProposal(pasteInput.trim()); if(!d) throw new Error('Invalid proposal'); const v = await verifyProposal(d); setIncomingProposal(d); setProposalVerified(v.valid); } catch(e:any) { Alert.alert('Invalid', e.message); } }} disabled={!pasteInput.trim()} style={{ marginTop: 12, backgroundColor: '#49d6aa', padding: 12, borderRadius: 8, alignItems: 'center', opacity: !pasteInput.trim() ? 0.5 : 1 }}>
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>Verify Proposal</Text>
                </TouchableOpacity>
                {incomingProposal && (
                  <View style={{ marginTop: 12, backgroundColor: '#0a0a0a', padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 14 }}>Amount: {(incomingProposal.amountSompi / 1e8).toFixed(4)} KAS</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>From: {incomingProposal.senderPubkey?.slice(0,16)}...</Text>
                    <Text style={{ color: proposalVerified ? '#27AE60' : '#e74c3c', fontSize: 12, marginTop: 4 }}>{proposalVerified ? 'Verified' : 'INVALID'}</Text>
                    {proposalVerified && (
                      <TouchableOpacity onPress={async () => { try { const a = await acceptProposal(incomingProposal); if('error' in a) throw new Error(a.error); await shareAcceptance(a.encoded, parseFloat(incomingProposal?.amountKAS||incomingProposal?.amount||'0')||0); Alert.alert('Accepted', 'IOU accepted and shared'); } catch(e:any) { Alert.alert('Error', e.message); } }} style={{ marginTop: 8, backgroundColor: '#27AE60', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Accept IOU</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}</>

          ) : (
            ledger.ious.map(i => <IOUCard key={i.id} iou={i} myPubkey={myPubkey} alias={counterpartyAlias} />)
          )}
          
          {/* Actions */}
          
          <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData(false)}>
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Create Modal */}
        <Modal visible={showCreate} transparent animationType="fade">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>New IOU</Text>
              <Text style={styles.label}>Amount (KAS)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#666" />
              <Text style={styles.maxLabel}>
                Free: {formatKAS(wallet?.freeBalance ?? 0n)}
                {wallet && wallet.allocatedBalance > 0n && (
                  <Text style={{ color: '#f39c12' }}> • Allocated: {formatKAS(wallet.allocatedBalance)}</Text>
                )}
              </Text>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 60 }]} value={desc} onChangeText={setDesc} placeholder="What for?" placeholderTextColor="#666" multiline />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
                  <Text style={styles.confirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: rs(16), borderBottomWidth: 1, borderBottomColor: '#222' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: rs(20), fontWeight: 'bold', color: '#fff' },
  x: { fontSize: rs(24), color: '#888' },
  badge: { backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  content: { flex: 1, padding: rs(16) },
  
  xpGate: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 24 },
  xpIcon: { fontSize: 64 },
  xpTitle: { color: '#f39c12', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  xpText: { color: '#888', fontSize: 16, marginTop: 8 },
  closeBtn: { backgroundColor: '#333', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginTop: 24 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  
  frostBox: { backgroundColor: '#1a1a3e', borderRadius: 16, padding: rs(16), marginBottom: 16, borderWidth: 1, borderColor: '#3b82f6' },
  frostTitle: { color: '#60a5fa', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  frostAddress: { color: '#666', fontSize: 11, marginBottom: 12, fontFamily: 'monospace' },
  frostRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  frostParty: { flex: 1, alignItems: 'center' },
  frostDivider: { width: 1, height: 40, backgroundColor: '#333' },
  frostLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  frostValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  frostTotal: { color: '#60a5fa', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  frostNote: { color: '#666', fontSize: 10, textAlign: 'center' },
  
  coinBox: { alignItems: 'center', marginVertical: rs(16) },
  netText: { fontSize: rs(18), fontWeight: 'bold', marginTop: 12 },
  settleBtn: { backgroundColor: '#3498db', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 16 },
  settleBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  box: { backgroundColor: '#1a1a2e', padding: rs(16), borderRadius: 12, marginBottom: 12 },
  boxTitle: { color: '#49d6aa', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  boxRow: { color: '#888', fontSize: 13, marginBottom: 2 },
  boxVal: { color: '#fff', fontWeight: '500' },
  
  section: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  empty: { color: '#666', textAlign: 'center', padding: 24 },
  
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardAmt: { fontSize: 18, fontWeight: 'bold' },
  cardDesc: { color: '#ccc', fontSize: 12, marginTop: 2 },
  cardMeta: { color: '#666', fontSize: 10, marginTop: 2 },
  approveBtn: { backgroundColor: '#2ecc71', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  approveBtnText: { color: '#fff', fontWeight: 'bold' },
  
  settleTitle: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  settleText: { color: '#ccc', fontSize: 14 },
  settleAmount: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  settleTime: { color: '#666', fontSize: 12, marginTop: 4 },
  ackBtn: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  ackBtnText: { color: '#fff', fontWeight: 'bold' },
  
  createBtn: { backgroundColor: '#49d6aa', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  refreshBtn: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, marginBottom: 32 },
  refreshBtnText: { color: '#888', fontWeight: '600' },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, marginBottom: 8 },
  maxLabel: { color: '#666', fontSize: 11, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#333', padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#49d6aa', padding: 14, borderRadius: 8, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: 'bold' },
});

export default IOUBalanceSheetModal;