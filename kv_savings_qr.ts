// ============================================================================
// kv_savings_qr.ts — KV_SAVINGS_QR: deposit / print / verify-forget / spend
// ============================================================================
// Lifecycle of one deposit (one "session"):
//   created  -> throwaway key saved on this phone (so a crash never strands funds)
//   funded   -> the hot wallet paid the throwaway address (address is never shown)
//   signed   -> split (if any) broadcast, one exit per coin signed -> QRs ready to print
//   verified -> a printed QR scanned back + every coin confirmed on chain
//               -> the throwaway key is DELETED; only public tracker rows remain
// Before "verified" the deposit can always be returned to the hot wallet.
// The two-phone FROST vault is not touched by any of this.
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { bytesToHex } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sqSignAll, sqParse, sqSignSweepBack, sqXonlyFromAddress, sqPrecheck, sqScanProgress, sqCoverage, SqCoin, SqNet } from './kv_savings_core';

const SESSION_KEY = 'kv_sq_session';
const LIST_KEY = 'kv_sq_list';
const ARCHIVE_KEY = 'kv_sq_archive';
const SECRET_OPTS = { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY } as any;
export const SQ_API: Record<string, string> = { 'mainnet': 'https://api.kaspa.org', 'testnet-10': 'https://api-tn10.kaspa.org', 'testnet-11': 'https://api-tn11.kaspa.org' };
const API = SQ_API;
const NO_PASSCODE = 'Could not save the key securely on this phone. Set a device passcode (Settings → Face ID & Passcode), then try again. No coins moved.';

export interface SqSession {
  v: 1; net: SqNet; priv: string; xonly: string; addr: string; n: number;
  depositSompi: string; stage: 'created' | 'funded' | 'signed' | 'returning';
  hot?: string; hotXonly?: string;               // KV_SAVINGS_QR: fixed at start, never re-read
  fundTxId?: string; splitTxId?: string | null; qrs?: string[];
  exits?: { txId: string; outSompi: string; coin: { txId: string; index: number; amount: string } }[];
  scanned?: number[];                            // indexes of qrs scanned back from paper
  returnTxId?: string; returnAt?: number; prevStage?: string;
  createdAt: number;
}
export interface SqRow {
  id: string; net: SqNet; addr: string; coinTxId: string; coinIndex: number; outSompi: string;
  hotLast6: string; label: string; createdAt: number; status?: 'unspent' | 'spent' | 'unknown';
}
/** Archived throwaway key: kept (never hard-deleted) so coins that arrive late can still be swept home. */
export interface SqArchived { addr: string; net: SqNet; priv: string; hotXonly?: string; reason: string; time: number; lastSweepTxId?: string; lastSweepAt?: number; }

export function sqActiveNet(): SqNet { return require('./kv_vault_active').kvActiveNet(); }
export function sqTutorial(): boolean { try { return !!require('./kv_tutorial').kvIsTutorial(); } catch { return false; } }

export async function sqHotAddress(): Promise<string> {
  const h = (await SecureStore.getItemAsync('kv_kaspa_address')) || '';
  return sqActiveNet() === 'mainnet' ? ((await SecureStore.getItemAsync('kaspa_address_real')) || h) : h;
}

// KV_SAVINGS_QR: one money operation at a time (module level, survives re-renders / double taps)
let opLock = false;
async function withOp<T>(busyResult: T, fn: () => Promise<T>): Promise<T> {
  if (opLock) return busyResult; opLock = true;
  try { return await fn(); } finally { opLock = false; }
}
// KV_SAVINGS_QR: serialize tracker read-modify-write (re-read right before writing, never drop rows)
let listChain: Promise<any> = Promise.resolve();
function withList<T>(fn: () => Promise<T>): Promise<T> { const r = listChain.then(fn, fn); listChain = r.catch(() => {}); return r; }

export async function sqLoadSession(): Promise<SqSession | null> {
  try { const r = await SecureStore.getItemAsync(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
/** Never overwrite a session that holds a DIFFERENT throwaway key. Throws a user-readable error. */
async function saveSession(s: SqSession) {
  let cur: SqSession | null = null; try { const r = await SecureStore.getItemAsync(SESSION_KEY); cur = r ? JSON.parse(r) : null; } catch { throw new Error('Could not read the deposit in progress - try again.'); }
  if (cur && cur.addr !== s.addr) throw new Error('Another deposit is already in progress - finish or return it first.');
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); } catch { throw new Error(NO_PASSCODE); }
}

// --- archive (kv_sq_archive / kv_cn_archive): keys kept instead of hard-deleted -----------------
const ARCHIVE_CAP = 50;
export async function kvArchiveList(key: string): Promise<SqArchived[]> {
  try { const r = await SecureStore.getItemAsync(key); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
/** Add a key to the archive. Throws if it cannot be saved (caller must then KEEP the session). */
export async function kvArchivePush(key: string, e: SqArchived): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(e.priv)) return;
  const a = (await kvArchiveList(key)).filter((x) => x.priv !== e.priv); a.push(e);
  while (a.length > ARCHIVE_CAP) { const i = a.findIndex((x) => /returned|reclaimed/.test(x.reason)); a.splice(i >= 0 ? i : 0, 1); } // drop confirmed-empty first
  try { await SecureStore.setItemAsync(key, JSON.stringify(a), SECRET_OPTS); } catch { throw new Error(NO_PASSCODE); }
}
/** For every archived key whose address holds coins, sweep them to the hot wallet it was made for. */
export async function kvArchiveSweep(key: string): Promise<{ checked: number; swept: number; pending: number; skipped: number; errors: string[] }> {
  const out = { checked: 0, swept: 0, pending: 0, skipped: 0, errors: [] as string[] };
  const a = await kvArchiveList(key); const net = sqActiveNet(); let dirty = false;
  for (const e of a) {
    if (e.net !== net) { out.skipped++; continue; }
    out.checked++;
    let on: SqCoin[]; try { on = await fetchUtxos(e.net, e.addr); } catch (x: any) { out.errors.push('…' + e.addr.slice(-6) + ': ' + (x?.message || 'network error')); continue; }
    if (!on.length) continue;
    if (e.lastSweepTxId && e.lastSweepAt && Date.now() - e.lastSweepAt < 120000 && !(await txLanded(e.net, e.lastSweepTxId))) { out.pending++; continue; }
    const hx = e.hotXonly || sqXonlyFromAddress(await sqHotAddress());
    const r = sqSignSweepBack(e.priv, on, hx); if ('error' in r) { out.errors.push('…' + e.addr.slice(-6) + ': ' + r.error); continue; }
    const b = await broadcast(e.net, r.tx, r.txId);
    if (b.ok || b.maybe) { e.lastSweepTxId = r.txId; e.lastSweepAt = Date.now(); dirty = true; if (b.ok) out.swept++; else out.pending++; }
    else out.errors.push('…' + e.addr.slice(-6) + ': ' + (b.error || 'failed'));
  }
  if (dirty) { try { const cur = await kvArchiveList(key); for (const c of cur) { const m = a.find((x) => x.priv === c.priv); if (m?.lastSweepTxId) { c.lastSweepTxId = m.lastSweepTxId; c.lastSweepAt = m.lastSweepAt; } } await SecureStore.setItemAsync(key, JSON.stringify(cur), SECRET_OPTS); } catch {} }
  return out;
}
export function sweepArchive() { return withOp({ checked: 0, swept: 0, pending: 0, skipped: 0, errors: ['Busy - try again in a moment.'] }, () => kvArchiveSweep(ARCHIVE_KEY)); }
/** Move the session's key into the archive, then clear the session. If archiving fails the session stays. */
async function archiveSession(s: SqSession, reason: string) {
  await kvArchivePush(ARCHIVE_KEY, { addr: s.addr, net: s.net, priv: s.priv, hotXonly: s.hotXonly, reason, time: Date.now() });
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function sqList(): Promise<SqRow[]> {
  try { const r = await SecureStore.getItemAsync(LIST_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
async function saveList(rows: SqRow[]) { await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(rows.slice(-200))); }

export async function fetchUtxos(net: string, addr: string): Promise<SqCoin[]> {
  const r = await fetch(API[net] + '/addresses/' + addr + '/utxos');
  if (!r.ok) throw new Error('UTXO lookup failed (' + r.status + ')');
  const j: any[] = await r.json();
  return (Array.isArray(j) ? j : []).map((u: any) => ({ txId: String(u.outpoint?.transactionId || ''), index: Number(u.outpoint?.index ?? 0), amount: BigInt(u.utxoEntry?.amount || '0') }))
    .filter((c) => /^[0-9a-f]{64}$/.test(c.txId) && c.amount > 0n);
}
export async function txLanded(net: string, txId: string): Promise<boolean> {
  try { const r = await fetch(API[net] + '/transactions/' + txId + '?inputs=false&outputs=false'); return r.ok; } catch { return false; }
}
/** Broadcast a signed tx; an ambiguous failure is resolved by looking the txid up. */
export async function broadcast(net: SqNet, tx: any, txId: string): Promise<{ ok: boolean; maybe?: boolean; error?: string }> {
  try {
    const r = await fetch(API[net] + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: tx, allowOrphan: false }) });
    if (r.ok) return { ok: true };
    const body = await r.text();
    for (let i = 0; i < 3; i++) { await new Promise((s) => setTimeout(s, 2500)); if (await txLanded(net, txId)) return { ok: true }; }
    return { ok: false, error: 'Submit failed (' + r.status + '): ' + body.slice(0, 200) };
  } catch (e: any) {
    for (let i = 0; i < 3; i++) { await new Promise((s) => setTimeout(s, 2500)); if (await txLanded(net, txId)) return { ok: true }; }
    return { ok: false, maybe: true, error: 'No answer from the network - it may still land. Check again before retrying.' };
  }
}

/** Every Savings QR pays the hot wallet, so the hot wallet's backup cards must restore THAT wallet.
 *  '' = ok: a seed exists on this phone and it derives exactly the hot wallet address. */
export async function sqHotBackupCheck(): Promise<string> {
  const m = await SecureStore.getItemAsync('kv_mnemonic');
  if (!m) return 'Your hot wallet has no backup seed on this phone, so backup cards cannot be made for it. Savings QR pays only the hot wallet, so it is off for this wallet.';
  const hot = await sqHotAddress();
  const { previewAddressFromMnemonic } = require('./wallet_registration_v2');
  const pv = await previewAddressFromMnemonic(m, sqActiveNet());
  if (!pv?.address || !hot || pv.address.split(':')[1] !== hot.split(':')[1]) return 'Your backup seed does not restore this hot wallet (' + hot.slice(-6) + '). Do not use Savings QR until this is fixed.';
  return '';
}

/** Why the backup check fails - address ENDINGS only, never keys or words. */
export async function sqHotBackupDiag(): Promise<string> {
  const net = sqActiveNet(); const hrp = net.startsWith('testnet') ? 'kaspatest' : 'kaspa';
  const tail = (a: string) => (a ? '…' + a.slice(-6) : '(none)');
  const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
  const { hexToBytes } = require('@noble/hashes/utils');
  const fromPriv = (h: string) => { try { return kaspaAddressFromXOnly(secp256k1.getPublicKey(hexToBytes(h), true).slice(1), hrp) as string; } catch { return ''; } };
  const lines: string[] = [];
  const hot = await sqHotAddress();
  lines.push('Hot wallet (Savings pays): ' + tail(hot));
  lines.push('Saved address: ' + tail((await SecureStore.getItemAsync('kv_kaspa_address')) || '') + ' / mainnet: ' + tail((await SecureStore.getItemAsync('kaspa_address_real')) || ''));
  const pk = (await SecureStore.getItemAsync('kv_private_key')) || '';
  lines.push('From this phone\'s key: ' + tail(pk ? fromPriv(pk) : ''));
  const m = (await SecureStore.getItemAsync('kv_mnemonic')) || '';
  lines.push('Seed words on phone: ' + (m ? m.trim().split(/\s+/).length + ' words' : 'none'));
  if (m) {
    try { const { previewAddressFromMnemonic } = require('./wallet_registration_v2'); const pv = await previewAddressFromMnemonic(m, net); lines.push('Cards/seed restore to: ' + tail(pv?.address || '')); } catch { lines.push('Cards/seed restore to: (error)'); }
    for (const pass of ['', 'kasvillage']) {
      try { const W = require('./bip39_wallet'); const hd = W.deriveKaspaHDKey(await W.mnemonicToSeed(m, pass)); lines.push('Older app recipe' + (pass ? ' (kasvillage)' : '') + ': ' + tail(fromPriv(require('@noble/hashes/utils').bytesToHex(hd.privateKey)))); } catch { lines.push('Older app recipe' + (pass ? ' (kasvillage)' : '') + ': (error)'); }
    }
  }
  return lines.join('\n');
}

// --- 1. start: make the throwaway key and pay it from the hot wallet --------------------------
export function sqStartDeposit(depositSompi: bigint, n: number): Promise<{ error?: string }> {
  return withOp({ error: 'A deposit is already starting - wait a moment.' }, () => startDeposit(depositSompi, n)); // KV_SAVINGS_QR: in-flight mutex
}
async function startDeposit(depositSompi: bigint, n: number): Promise<{ error?: string }> {
  if (sqTutorial()) return { error: 'Savings QR needs Real mode.' };
  const pre = sqPrecheck(depositSompi, n); if (pre) return { error: pre }; // exact error before any coin moves
  const bk = await sqHotBackupCheck(); if (bk) return { error: bk };
  if (await sqLoadSession()) return { error: 'Finish (or return) the deposit already in progress first.' };
  const hot = await sqHotAddress(); const hotXonly = sqXonlyFromAddress(hot);
  if (!hotXonly) return { error: 'Your hot wallet address is not a standard address - Savings QR cannot pay it.' };
  const net = sqActiveNet();
  const privB = (secp256k1 as any).utils.randomPrivateKey() as Uint8Array;
  const priv = bytesToHex(privB); privB.fill(0);
  const xonly = bytesToHex(secp256k1.getPublicKey(require('@noble/hashes/utils').hexToBytes(priv), true).slice(1));
  const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
  const addr = kaspaAddressFromXOnly(require('@noble/hashes/utils').hexToBytes(xonly), net.startsWith('testnet') ? 'kaspatest' : 'kaspa');
  if (String(addr).split(':')[0] !== String(hot).split(':')[0]) return { error: 'Network mismatch between hot wallet and vault.' };
  // Save the key BEFORE any coin moves: a crash after funding must never strand the deposit.
  try { await saveSession({ v: 1, net, priv, xonly, addr, n, depositSompi: depositSompi.toString(), stage: 'created', hot, hotXonly, createdAt: Date.now() }); }
  catch (e: any) { return { error: String(e?.message || e) }; }
  const chk = await sqLoadSession(); if (!chk || chk.priv !== priv) return { error: 'Could not save the deposit key - nothing was sent. Try again.' };
  const { sendKASWithHybridSig } = require('./kasvillage_cold_wallet');
  const r = await sendKASWithHybridSig(addr, depositSompi, 'Savings QR deposit'); // Face ID + simulation
  if (!r?.success) {
    // Keep the key: a send that "failed" may still land. "Return deposit" clears it safely later.
    return { error: (r?.error || 'Deposit failed.') + ' If the deposit was cancelled, tap "Return deposit" to clear it.' };
  }
  const s = await sqLoadSession(); if (s && s.addr === addr && s.stage === 'created') { s.stage = 'funded'; s.fundTxId = r.kaspaTxId || ''; try { await saveSession(s); } catch {} }
  return {};
}

/** '' = ok. The session pays the hot wallet fixed at start, on the network it was made on. */
function sessionGuard(s: { net: SqNet; hotXonly?: string }): string {
  if (sqActiveNet() !== s.net) return 'This deposit was made on ' + (s.net === 'mainnet' ? 'Real (mainnet)' : s.net) + '. Switch the app back to that network to continue.';
  if (s.hotXonly !== undefined && !/^[0-9a-f]{64}$/.test(s.hotXonly)) return 'The hot wallet saved with this deposit is not standard.';
  return '';
}
async function sessionHotXonly(s: SqSession): Promise<string> { return s.hotXonly || sqXonlyFromAddress(await sqHotAddress()); } // older sessions: fall back once

// --- 2. sign: once the deposit is on chain, split + sign one exit per coin --------------------
let signInFlight: Promise<{ error?: string; waiting?: boolean }> | null = null;
export function sqSign(): Promise<{ error?: string; waiting?: boolean }> {
  if (signInFlight) return signInFlight; // KV_SAVINGS_QR: Leave -> Continue never signs twice
  signInFlight = signOnce().finally(() => { signInFlight = null; });
  return signInFlight;
}
async function signOnce(): Promise<{ error?: string; waiting?: boolean }> {
  const s = await sqLoadSession(); if (!s) return { error: 'No deposit in progress.' };
  if (s.stage === 'returning') return { error: 'This deposit is being returned to your hot wallet.' };
  if (s.stage === 'signed' || (s.qrs && s.qrs.length)) return {}; // QRs exist: never replace them
  const g = sessionGuard(s); if (g) return { error: g };
  const funded = await fetchUtxos(s.net, s.addr);
  if (!funded.length) return { waiting: true };
  const hotXonly = await sessionHotXonly(s);
  const r = sqSignAll({ privHex: s.priv, net: s.net, funded, n: s.n, hotXonly });
  if ('error' in r) return { error: r.error };
  // self-check every QR before anything is broadcast
  for (const q of r.qrs) { const p = sqParse(q); if ('error' in p) return { error: 'Self-check failed: ' + p.error }; }
  if (r.splitTx && r.splitTxId) {
    const b = await broadcast(s.net, r.splitTx, r.splitTxId);
    if (!b.ok) return { error: b.error };
  }
  const cur = await sqLoadSession(); if (!cur || cur.addr !== s.addr) return { error: 'The deposit changed while signing - open it again.' };
  if (cur.qrs && cur.qrs.length) return {};
  cur.stage = 'signed'; cur.splitTxId = r.splitTxId; cur.qrs = r.qrs; cur.scanned = []; if (!cur.hotXonly) cur.hotXonly = hotXonly;
  cur.exits = r.exits.map((e) => ({ txId: e.txId, outSompi: e.outSompi.toString(), coin: { txId: e.coin.txId, index: e.coin.index, amount: e.coin.amount.toString() } }));
  try { await saveSession(cur); } catch (e: any) { return { error: String(e?.message || e) }; }
  return {};
}

// --- 3. verify: EVERY printed QR scanned back + every coin on chain -> forget the key ----------
export function sqVerifyAndForget(scanned: string): Promise<{ error?: string; done?: boolean; have?: number; total?: number }> {
  return withOp({ error: 'Busy - try again in a moment.' }, () => verifyOnce(scanned));
}
async function verifyOnce(scanned: string): Promise<{ error?: string; done?: boolean; have?: number; total?: number }> {
  const s = await sqLoadSession(); if (!s || s.stage !== 'signed' || !s.qrs || !s.exits) return { error: 'Nothing to verify.' };
  const g = sessionGuard(s); if (g) return { error: g };
  const sp = sqScanProgress(s.qrs, s.scanned, scanned);
  if (sp.error) return { error: sp.error, have: sp.have, total: sp.total };
  if (sp.added) { s.scanned = sp.scanned; try { await saveSession(s); } catch (e: any) { return { error: String(e?.message || e) }; } }
  if (sp.have < sp.total) return { have: sp.have, total: sp.total }; // progress: 'scanned 2 of 5'
  const on = await fetchUtxos(s.net, s.addr);
  const cov = sqCoverage(on, s.exits.map((e) => e.coin));
  if (cov.missing) return { error: 'Waiting for the network to confirm the coins (' + cov.missing + ' left). Try again in a minute.', have: sp.have, total: sp.total };
  if (cov.extra.length) return { error: 'Extra coins arrived at this deposit that your QRs do not cover. The key was NOT deleted. Return the deposit to your hot wallet and start again.', have: sp.have, total: sp.total };
  const hot = s.hot || (await sqHotAddress());
  await withList(async () => {
    const rows = await sqList();
    s.exits!.forEach((e, i) => { if (!rows.some((r) => r.id === e.txId)) rows.push({ id: e.txId, net: s.net, addr: s.addr, coinTxId: e.coin.txId, coinIndex: e.coin.index, outSompi: e.outSompi, hotLast6: hot.slice(-6), label: (i + 1) + ' of ' + s.exits!.length, createdAt: Date.now() }); });
    await saveList(rows);
  });
  // Intentional: after a verified print the key is deleted (that is the product). Overwrite first, then delete.
  s.priv = ''; try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); } catch {}
  await SecureStore.deleteItemAsync(SESSION_KEY);
  return { done: true, have: sp.have, total: sp.total };
}

// --- cancel: before the key is forgotten, everything can go back to the hot wallet ------------
// Stage 'returning' holds the sweep txid. The key is archived (never deleted) only once that tx has
// landed AND the address is empty. Repeated taps re-check; re-sign only if coins remain and the tx did not land.
export function sqReturnToHot(): Promise<{ error?: string; done?: boolean; pending?: boolean }> {
  return withOp({ error: 'Busy - try again in a moment.' }, returnOnce);
}
async function returnOnce(): Promise<{ error?: string; done?: boolean; pending?: boolean }> {
  const s = await sqLoadSession(); if (!s) return { error: 'No deposit in progress.' };
  const g = sessionGuard(s); if (g) return { error: g };
  let funded: SqCoin[]; try { funded = await fetchUtxos(s.net, s.addr); } catch (e: any) { return { error: e?.message || 'Network error' }; }
  const hotXonly = await sessionHotXonly(s);
  if (s.stage === 'returning' && s.returnTxId) {
    const landed = await txLanded(s.net, s.returnTxId);
    if (landed && !funded.length) { try { await archiveSession(s, 'returned'); } catch (e: any) { return { error: String(e?.message || e) }; } return { done: true }; }
    if (!funded.length || (!landed && Date.now() - (s.returnAt || 0) < 60000)) return { pending: true }; // still settling: check again
    // coins still here and the previous return did not land (or landed and MORE coins arrived) -> sign a fresh return below
  }
  if (!funded.length) {
    if (s.stage !== 'returning' && s.stage === 'created' && Date.now() - s.createdAt > 120000) {
      // never funded: check twice, 10 s apart, then ARCHIVE the key (late coins can still be swept)
      await new Promise((ok) => setTimeout(ok, 10000));
      if ((await fetchUtxos(s.net, s.addr)).length === 0) { try { await archiveSession(s, 'never funded'); } catch (e: any) { return { error: String(e?.message || e) }; } return { done: true }; }
      return { error: 'Coins just arrived - tap Continue instead.' };
    }
    return { error: 'The deposit is not visible on chain yet. Wait a couple of minutes and try again.' };
  }
  const r = sqSignSweepBack(s.priv, funded, hotXonly);
  if ('error' in r) return { error: r.error };
  // persist the txid BEFORE broadcasting, so a crash mid-submit still re-checks instead of forgetting
  if (s.stage !== 'returning') s.prevStage = s.stage;
  s.stage = 'returning'; s.returnTxId = r.txId; s.returnAt = Date.now();
  try { await saveSession(s); } catch (e: any) { return { error: String(e?.message || e) }; }
  const b = await broadcast(s.net, r.tx, r.txId);
  if (!b.ok && !b.maybe) { s.returnAt = 0; try { await saveSession(s); } catch {} return { error: (b.error || 'Return failed.') + ' Tap Return again to retry.' }; }
  return { pending: true };
}

// --- spend: scan a printed QR -> checks -> broadcast to the hot wallet -----------------------
export async function sqCheckQr(raw: string): Promise<{ error?: string; info?: { outSompi: bigint; paysHot: boolean; hotLast6: string; net: SqNet; txId: string; tx: any } }> {
  const p = sqParse(raw); if ('error' in p) return { error: p.error };
  const net = sqActiveNet();
  if (p.qr.net !== net) return { error: 'This QR is for ' + p.qr.net + ' but the app is on ' + net + '.' };
  const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
  const addr = kaspaAddressFromXOnly(require('@noble/hashes/utils').hexToBytes(p.qr.coinXonly), net.startsWith('testnet') ? 'kaspatest' : 'kaspa');
  let on: SqCoin[]; try { on = await fetchUtxos(net, addr); } catch (e: any) { return { error: e?.message || 'Network error' }; }
  const coin = on.find((u) => u.txId === p.qr.coinTxId && u.index === p.qr.coinIndex);
  if (!coin) return { error: (await txLanded(net, p.txId)) ? 'This QR was already used - its coins are in your hot wallet.' : 'This QR\'s coin is not on chain (already spent, or not confirmed yet).' };
  if (coin.amount !== p.qr.coinSompi) return { error: 'Coin amount does not match the QR.' };
  const hot = await sqHotAddress();
  const { kaspaAddressFromXOnly: k2 } = require('./wallet_registration_v2');
  const pays = k2(require('@noble/hashes/utils').hexToBytes(p.qr.hotXonly), net.startsWith('testnet') ? 'kaspatest' : 'kaspa') as string;
  return { info: { outSompi: p.qr.outSompi, paysHot: pays === hot, hotLast6: pays.slice(-6), net, txId: p.txId, tx: p.tx } };
}
export async function sqSpend(info: { net: SqNet; txId: string; tx: any }): Promise<{ error?: string; maybe?: boolean; txId?: string }> {
  const b = await broadcast(info.net, info.tx, info.txId);
  if (!b.ok) return { error: b.error, maybe: b.maybe };
  await withList(async () => { const rows = await sqList(); const row = rows.find((r) => r.id === info.txId); if (row) { row.status = 'spent'; await saveList(rows); } });
  return { txId: info.txId };
}

/** Vault tally from the phone's tracker (no network): unspent = what you have, spent = what is used. */
export async function sqTally(): Promise<{ haveSompi: bigint; haveCount: number; spentSompi: bigint; spentCount: number }> {
  const rows = await sqList(); let haveSompi = 0n, spentSompi = 0n, haveCount = 0, spentCount = 0;
  for (const r of rows) { if (r.status === 'spent') { spentSompi += BigInt(r.outSompi); spentCount++; } else { haveSompi += BigInt(r.outSompi); haveCount++; } }
  return { haveSompi, haveCount, spentSompi, spentCount };
}

/** Refresh tracker status from the chain (public data only). */
export async function sqRefresh(): Promise<SqRow[]> {
  const rows = await sqList(); const byAddr: Record<string, SqCoin[] | null> = {}; const st: Record<string, SqRow['status']> = {};
  for (const r of rows) {
    if (r.status === 'spent') continue;
    if (!(r.addr in byAddr)) { try { byAddr[r.addr] = await fetchUtxos(r.net, r.addr); } catch { byAddr[r.addr] = null; } }
    const on = byAddr[r.addr];
    st[r.id] = on === null ? 'unknown' : on.some((u) => u.txId === r.coinTxId && u.index === r.coinIndex) ? 'unspent' : 'spent';
  }
  // KV_SAVINGS_QR: re-read right before writing, merge by id, keep rows added meanwhile, never un-spend
  return withList(async () => {
    const cur = await sqList();
    for (const r of cur) { if (r.status !== 'spent' && st[r.id]) r.status = st[r.id]; }
    await saveList(cur); return cur;
  });
}

/** Printable HTML: one QR per coin, two copies reminder. QR drawn as SVG (pure JS, no network). */
export function sqPrintHtml(qrs: string[], outs: string[], hotLast6: string, net: string, usdPerKas = 0): string {
  // Banknote-style slips in random earth-tone palettes (kv_savings_note.ts)
  return require('./kv_savings_note').notePrintHtml({ qrs, outs, hotLast6, net, usdPerKas });
}

// --- old card + paper vaults (no longer created): balance, sweep amount, replace guard ---------
/** The existing card + paper vault (if any) with its on-chain balance and an exact sweep amount. */
export async function sqOldCardPaperVault(): Promise<{ vault: any; sompi: bigint; sweepKas: string } | null> {
  const VA = require('./kv_vault_active');
  if ((await VA.kvVaultKind()) !== 'cards_paper') return null;
  const fv = await VA.kvFrostVaultActive(); if (!fv?.address) return null;
  const utxos = await fetchUtxos(fv.network || sqActiveNet(), fv.address);
  const sompi = utxos.reduce((a, u) => a + u.amount, 0n);
  // one output, no change: amount = total - vaultMinFee(inputs, 1) (same rule as vaultBuildSpendTemplate)
  const fee = require('./frost_qr_signer').vaultMinFee(utxos.length, 1) as bigint;
  const amt = sompi > fee ? sompi - fee : 0n;
  const sweepKas = (amt / 100_000_000n).toString() + '.' + (amt % 100_000_000n).toString().padStart(8, '0');
  return { vault: fv, sompi, sweepKas };
}

/** Refuse to replace a vault that still holds coins (or whose balance can't be checked). '' = ok. */
export async function sqVaultReplaceGuard(): Promise<string> {
  const VA = require('./kv_vault_active');
  const addrs: { a: string; n: string }[] = [];
  try { const a = await VA.kvVaultAddrActive(); if (a) addrs.push({ a, n: sqActiveNet() }); } catch {}
  try { const s = await SecureStore.getItemAsync('kv_vault_address'); if (s && !addrs.some((x) => x.a === s)) addrs.push({ a: s, n: s.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet' }); } catch {}
  for (const { a, n } of addrs) {
    let bal: bigint;
    try { bal = (await fetchUtxos(n, a)).reduce((x, u) => x + u.amount, 0n); } catch { return 'Could not check your current vault balance - try again online.'; }
    if (bal > 0n) return 'Your current vault still holds ' + (Number(bal) / 1e8).toFixed(4) + ' KAS. Move it to your hot wallet first, then create a new vault.';
  }
  return '';
}
