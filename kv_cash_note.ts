// ============================================================================
// kv_cash_note.ts — KV_CASH_NOTE: transferable bearer notes (like cash)
// ============================================================================
// A one-time key is funded from the hot wallet; the printed QR holds that key.
// Whoever scans it picks ANY address and the app signs a fresh sweep there.
// Unlike Savings QR (pre-signed, pays only your hot wallet), a cash note is spendable by
// anyone who sees the QR. Until the maker removes it, the key also stays on the maker's
// phone so a lost or unused note can be reclaimed.
// QR text:  KVCN1|<net>|<64-hex private key>|<printed sompi>|<8-hex checksum>
//   (older 4-field notes without the printed amount still redeem)
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sqSignSweepBack, sqXonlyFromAddress, SqNet } from './kv_savings_core';
import { fetchUtxos, broadcast, txLanded, sqHotAddress, sqActiveNet, sqTutorial, kvArchivePush, kvArchiveSweep, kvArchiveList, SQ_API } from './kv_savings_qr';
import { kvAddressValid } from './kaspa_rest_tx';

const SESSION_KEY = 'kv_cn_session';
const LIST_KEY = 'kv_cn_list';
const ARCHIVE_KEY = 'kv_cn_archive';
const NO_PASSCODE = 'Could not save the note key securely on this phone. Set a device passcode (Settings → Face ID & Passcode), then try again. No coins moved.';
const SECRET_OPTS = { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY } as any;
export const CN_MIN_SOMPI = 10_000_000n; // 0.1 KAS

export interface CnSession { v: 1; net: SqNet; priv: string; addr: string; sompi: string; stage: 'created' | 'funded' | 'returning'; qr: string; createdAt: number;
  hot?: string; hotXonly?: string; returnTxId?: string; returnAt?: number; } // KV_CASH_NOTE: hot wallet fixed at create
export interface CnRow { addr: string; net: SqNet; sompi: string; createdAt: number; status?: 'unredeemed' | 'redeemed' | 'unknown'; }

const hrp = (net: string) => (net.startsWith('testnet') ? 'kaspatest' : 'kaspa');
const addrOf = (priv: string, net: string) => require('./wallet_registration_v2').kaspaAddressFromXOnly(secp256k1.getPublicKey(hexToBytes(priv), true).slice(1), hrp(net)) as string;
const chk = (s: string) => bytesToHex(sha256(new TextEncoder().encode(s))).slice(0, 8);
export const cnQr = (net: string, priv: string, sompi?: bigint) => { const b = 'KVCN1|' + net + '|' + priv + (sompi !== undefined ? '|' + sompi.toString() : ''); return b + '|' + chk(b); };

export function cnParse(raw: string): { error: string } | { net: SqNet; priv: string; addr: string; printedSompi?: bigint } {
  const p = String(raw || '').trim().split('|');
  if ((p.length !== 4 && p.length !== 5) || p[0] !== 'KVCN1') return { error: 'Not a KasVillage cash note.' };
  if (!['mainnet', 'testnet-10', 'testnet-11'].includes(p[1])) return { error: 'Unknown network on the note.' };
  if (!/^[0-9a-f]{64}$/.test(p[2]) || chk(p.slice(0, -1).join('|')) !== p[p.length - 1]) return { error: 'Damaged note (checksum).' };
  if (p.length === 5 && !/^\d{1,19}$/.test(p[3])) return { error: 'Damaged note (amount).' };
  try { return { net: p[1] as SqNet, priv: p[2], addr: addrOf(p[2], p[1]), printedSompi: p.length === 5 ? BigInt(p[3]) : undefined }; } catch { return { error: 'Invalid key on the note.' }; }
}

export async function cnLoadSession(): Promise<CnSession | null> { try { const r = await SecureStore.getItemAsync(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
/** Never overwrite a session holding a DIFFERENT key. Throws a user-readable error. */
async function saveSession(s: CnSession) {
  let cur: CnSession | null = null; try { const r = await SecureStore.getItemAsync(SESSION_KEY); cur = r ? JSON.parse(r) : null; } catch { throw new Error('Could not read the note in progress - try again.'); }
  if (cur && cur.addr !== s.addr) throw new Error('Another note is already in progress - finish or reclaim it first.');
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); } catch { throw new Error(NO_PASSCODE); }
}
export async function cnList(): Promise<CnRow[]> { try { const r = await SecureStore.getItemAsync(LIST_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; } }
async function saveList(rows: CnRow[]) { await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(rows.slice(-200))); }
// KV_CASH_NOTE: one money op at a time; tracker writes serialized
let opLock = false;
async function withOp<T>(busyResult: T, fn: () => Promise<T>): Promise<T> { if (opLock) return busyResult; opLock = true; try { return await fn(); } finally { opLock = false; } }
let listChain: Promise<any> = Promise.resolve();
function withList<T>(fn: () => Promise<T>): Promise<T> { const r = listChain.then(fn, fn); listChain = r.catch(() => {}); return r; }
async function archiveSession(s: CnSession, reason: string) {
  await kvArchivePush(ARCHIVE_KEY, { addr: s.addr, net: s.net, priv: s.priv, hotXonly: s.hotXonly, reason, time: Date.now() });
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
export function cnArchiveList() { return kvArchiveList(ARCHIVE_KEY); }
/** Sweep any coins sitting on archived (reclaimed / never funded) note keys back to the hot wallet. */
export function sweepArchive() { return withOp({ checked: 0, swept: 0, pending: 0, skipped: 0, errors: ['Busy - try again in a moment.'] }, () => kvArchiveSweep(ARCHIVE_KEY)); }

/** Make a note: key saved first, then the hot wallet pays it (Face ID + preview). */
export function cnCreate(sompi: bigint): Promise<{ error?: string }> {
  return withOp({ error: 'A note is already being made - wait a moment.' }, () => createOnce(sompi));
}
async function createOnce(sompi: bigint): Promise<{ error?: string }> {
  if (sqTutorial()) return { error: 'Cash notes need Real mode.' };
  if (sompi < CN_MIN_SOMPI) return { error: 'A cash note must hold at least 0.1 KAS.' };
  if (await cnLoadSession()) return { error: 'Finish (or reclaim) the note already in progress first.' };
  const net = sqActiveNet();
  const hot = await sqHotAddress(); const hotXonly = sqXonlyFromAddress(hot);
  if (!hotXonly) return { error: 'Your hot wallet address is not a standard address - a note could not be reclaimed to it.' };
  const b = (secp256k1 as any).utils.randomPrivateKey() as Uint8Array; const priv = bytesToHex(b); b.fill(0);
  const addr = addrOf(priv, net);
  try { await saveSession({ v: 1, net, priv, addr, sompi: sompi.toString(), stage: 'created', qr: cnQr(net, priv, sompi), createdAt: Date.now(), hot, hotXonly }); }
  catch (e: any) { return { error: String(e?.message || e) }; }
  const chk = await cnLoadSession(); if (!chk || chk.priv !== priv) return { error: 'Could not save the note key - nothing was sent. Try again.' };
  const r = await require('./kasvillage_cold_wallet').sendKASWithHybridSig(addr, sompi, 'Cash note');
  if (!r?.success) return { error: (r?.error || 'Funding failed.') + ' If it was cancelled, tap "Reclaim" to clear it.' };
  const s = await cnLoadSession(); if (s && s.addr === addr && s.stage === 'created') { s.stage = 'funded'; try { await saveSession(s); } catch {} }
  return {};
}

/** Funded coins visible on chain for the note in progress. */
export async function cnFundedSompi(): Promise<bigint> {
  const s = await cnLoadSession(); if (!s || s.stage === 'returning') return 0n;
  return (await fetchUtxos(s.net, s.addr)).reduce((a, c) => a + c.amount, 0n);
}

/** Note printed + scanned back: forget the key on this phone, keep a public tracker row. (Intentional delete: that is the product.) */
export function cnFinish(scanned: string): Promise<{ error?: string }> { return withOp({ error: 'Busy - try again in a moment.' }, () => finishOnce(scanned)); }
async function finishOnce(scanned: string): Promise<{ error?: string }> {
  const s = await cnLoadSession(); if (!s) return { error: 'No note in progress.' };
  if (s.stage === 'returning') return { error: 'This note is being reclaimed to your hot wallet.' };
  if (String(scanned || '').trim() !== s.qr) return { error: 'That is not the note you just made. Scan the printed note.' };
  const funded = await cnFundedSompi();
  if (funded <= 0n) return { error: 'The note is not funded on chain yet. Try again in a minute.' };
  await withList(async () => { const rows = await cnList(); if (!rows.some((r) => r.addr === s.addr)) rows.push({ addr: s.addr, net: s.net, sompi: funded.toString(), createdAt: Date.now() }); await saveList(rows); });
  s.priv = ''; s.qr = ''; try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); } catch {} await SecureStore.deleteItemAsync(SESSION_KEY);
  return {};
}

/** Before the key is forgotten: send the note's coins back to the hot wallet. The key is ARCHIVED (never deleted)
 *  only after the sweep has landed and the note address is empty; until then repeated taps re-check. */
export function cnReclaim(): Promise<{ error?: string; done?: boolean; pending?: boolean }> { return withOp({ error: 'Busy - try again in a moment.' }, reclaimOnce); }
async function reclaimOnce(): Promise<{ error?: string; done?: boolean; pending?: boolean }> {
  const s = await cnLoadSession(); if (!s) return { error: 'No note in progress.' };
  if (sqActiveNet() !== s.net) return { error: 'This note was made on ' + (s.net === 'mainnet' ? 'Real (mainnet)' : s.net) + '. Switch the app back to that network to reclaim it.' };
  let funded; try { funded = await fetchUtxos(s.net, s.addr); } catch (e: any) { return { error: e?.message || 'Network error' }; }
  if (s.stage === 'returning' && s.returnTxId) {
    const landed = await txLanded(s.net, s.returnTxId);
    if (landed && !funded.length) { try { await archiveSession(s, 'reclaimed'); } catch (e: any) { return { error: String(e?.message || e) }; } return { done: true }; }
    if (!funded.length || (!landed && Date.now() - (s.returnAt || 0) < 60000)) return { pending: true };
  }
  if (!funded.length) {
    if (Date.now() - s.createdAt < 120000) return { error: 'Not visible on chain yet - wait a couple of minutes.' };
    await new Promise((ok) => setTimeout(ok, 10000));
    if ((await fetchUtxos(s.net, s.addr)).length) return { error: 'Coins just arrived - try Reclaim again.' };
    try { await archiveSession(s, 'never funded'); } catch (e: any) { return { error: String(e?.message || e) }; }
    return { done: true };
  }
  const x = s.hotXonly || sqXonlyFromAddress(await sqHotAddress());
  const r = sqSignSweepBack(s.priv, funded, x); if ('error' in r) return { error: r.error };
  s.stage = 'returning'; s.returnTxId = r.txId; s.returnAt = Date.now();
  try { await saveSession(s); } catch (e: any) { return { error: String(e?.message || e) }; }
  const b = await broadcast(s.net, r.tx, r.txId);
  if (!b.ok && !b.maybe) { s.returnAt = 0; try { await saveSession(s); } catch {} return { error: (b.error || 'Reclaim failed.') + ' Tap Reclaim again to retry.' }; }
  return { pending: true };
}

/** Second source for the precheck: the address balance endpoint (same API, independent lookup). */
async function balanceSompi(net: string, addr: string): Promise<bigint> {
  const r = await fetch(SQ_API[net] + '/addresses/' + addr + '/balance');
  if (!r.ok) throw new Error('balance lookup failed (' + r.status + ')');
  const j: any = await r.json(); return BigInt(j?.balance ?? 0);
}

/** Precheck a scanned note against the chain (nothing is moved).
 *  sompi = real KAS on the note right now; printedSompi = what the slip claims (inside the signed-by-checksum QR). */
export async function cnInspect(raw: string): Promise<{ error?: string; net?: SqNet; sompi?: bigint; printedSompi?: bigint; matches?: boolean; coins?: number; checkedAt?: number }> {
  const p = cnParse(raw); if ('error' in p) return { error: p.error };
  if (p.net !== sqActiveNet()) return { error: 'This note is for ' + p.net + ' but the app is on ' + sqActiveNet() + '.' };
  let coins, bal: bigint;
  try { [coins, bal] = await Promise.all([fetchUtxos(p.net, p.addr), balanceSompi(p.net, p.addr)]); } catch (e: any) { return { error: 'Could not check the note right now (' + (e?.message || 'network error') + '). Do not accept it until it checks out.' }; }
  const sompi = coins.reduce((a, c) => a + c.amount, 0n);
  if (sompi <= 0n) return { error: 'EMPTY NOTE - no KAS on it. It was already redeemed, never funded, or is fake. Do not accept it.' };
  // KV_CASH_NOTE: two lookups must agree, else do not trust either
  if (bal !== sompi) return { error: 'The two balance checks disagree (' + (Number(sompi) / 1e8).toFixed(4) + ' vs ' + (Number(bal) / 1e8).toFixed(4) + ' KAS) - the note may be moving right now. Do not accept it yet; check again in a minute.' };
  return { net: p.net, sompi, printedSompi: p.printedSompi, matches: p.printedSompi === undefined ? undefined : sompi >= p.printedSompi, coins: coins.length, checkedAt: Date.now() };
}

/** Redeem: sweep everything on the note to `toAddress` (standard kaspa: address). */
export async function cnRedeem(raw: string, toAddress: string): Promise<{ error?: string; maybe?: boolean; txId?: string; sompi?: bigint }> {
  const p = cnParse(raw); if ('error' in p) return { error: p.error };
  const to = String(toAddress || '').trim();
  if (!kvAddressValid(to)) return { error: 'That address is not valid - check every character.' };
  if (to.split(':')[0] !== hrp(p.net)) return { error: 'That address is on a different network than the note.' };
  const x = sqXonlyFromAddress(to); if (!x) return { error: 'Only standard kaspa: addresses can receive a note.' };
  const coins = await fetchUtxos(p.net, p.addr);
  if (!coins.length) return { error: 'This note is empty - it was already redeemed.' };
  const r = sqSignSweepBack(p.priv, coins, x); if ('error' in r) return { error: r.error };
  const b = await broadcast(p.net, r.tx, r.txId);
  if (!b.ok) return { error: b.error, maybe: b.maybe };
  return { txId: r.txId, sompi: BigInt(r.tx.outputs[0].amount) };
}

/** Status of the notes this phone made (public data only). */
export async function cnRefresh(): Promise<CnRow[]> {
  const rows = await cnList(); const st: Record<string, CnRow['status']> = {};
  for (const r of rows) { if (r.status === 'redeemed') continue; try { st[r.addr] = (await fetchUtxos(r.net, r.addr)).length ? 'unredeemed' : 'redeemed'; } catch { st[r.addr] = 'unknown'; } }
  // KV_CASH_NOTE: re-read right before writing, merge by addr, keep rows added meanwhile
  return withList(async () => { const cur = await cnList(); for (const r of cur) { if (r.status !== 'redeemed' && st[r.addr]) r.status = st[r.addr]; } await saveList(cur); return cur; });
}
