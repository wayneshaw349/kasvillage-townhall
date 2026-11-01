// ============================================================================
// kv_cash_note.ts — KV_CASH_NOTE: transferable bearer notes (like cash)
// ============================================================================
// A one-time key is funded from the hot wallet; the printed QR holds that key.
// Whoever scans it picks ANY address and the app signs a fresh sweep there.
// Unlike Savings QR (pre-signed, pays only your hot wallet), a cash note is spendable by
// anyone who sees the QR. Until the maker removes it, the key also stays on the maker's
// phone so a lost or unused note can be reclaimed.
// QR text:  KVCN1|<net>|<64-hex private key>|<8-hex checksum>
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sqSignSweepBack, sqXonlyFromAddress, SqNet } from './kv_savings_core';
import { fetchUtxos, broadcast, sqHotAddress, sqActiveNet, sqTutorial } from './kv_savings_qr';
import { kvAddressValid } from './kaspa_rest_tx';

const SESSION_KEY = 'kv_cn_session';
const LIST_KEY = 'kv_cn_list';
const SECRET_OPTS = { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY } as any;
export const CN_MIN_SOMPI = 10_000_000n; // 0.1 KAS

export interface CnSession { v: 1; net: SqNet; priv: string; addr: string; sompi: string; stage: 'created' | 'funded'; qr: string; createdAt: number; }
export interface CnRow { addr: string; net: SqNet; sompi: string; createdAt: number; status?: 'unredeemed' | 'redeemed' | 'unknown'; }

const hrp = (net: string) => (net.startsWith('testnet') ? 'kaspatest' : 'kaspa');
const addrOf = (priv: string, net: string) => require('./wallet_registration_v2').kaspaAddressFromXOnly(secp256k1.getPublicKey(hexToBytes(priv), true).slice(1), hrp(net)) as string;
const chk = (s: string) => bytesToHex(sha256(new TextEncoder().encode(s))).slice(0, 8);
export const cnQr = (net: string, priv: string) => { const b = 'KVCN1|' + net + '|' + priv; return b + '|' + chk(b); };

export function cnParse(raw: string): { error: string } | { net: SqNet; priv: string; addr: string } {
  const p = String(raw || '').trim().split('|');
  if (p.length !== 4 || p[0] !== 'KVCN1') return { error: 'Not a KasVillage cash note.' };
  if (!['mainnet', 'testnet-10', 'testnet-11'].includes(p[1])) return { error: 'Unknown network on the note.' };
  if (!/^[0-9a-f]{64}$/.test(p[2]) || chk(p.slice(0, 3).join('|')) !== p[3]) return { error: 'Damaged note (checksum).' };
  try { return { net: p[1] as SqNet, priv: p[2], addr: addrOf(p[2], p[1]) }; } catch { return { error: 'Invalid key on the note.' }; }
}

export async function cnLoadSession(): Promise<CnSession | null> { try { const r = await SecureStore.getItemAsync(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
async function saveSession(s: CnSession) { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); }
export async function cnList(): Promise<CnRow[]> { try { const r = await SecureStore.getItemAsync(LIST_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; } }
async function saveList(rows: CnRow[]) { await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(rows.slice(-200))); }

/** Make a note: key saved first, then the hot wallet pays it (Face ID + preview). */
export async function cnCreate(sompi: bigint): Promise<{ error?: string }> {
  if (sqTutorial()) return { error: 'Cash notes need Real mode.' };
  if (await cnLoadSession()) return { error: 'Finish (or reclaim) the note already in progress first.' };
  if (sompi < CN_MIN_SOMPI) return { error: 'A cash note must hold at least 0.1 KAS.' };
  const net = sqActiveNet();
  const b = (secp256k1 as any).utils.randomPrivateKey() as Uint8Array; const priv = bytesToHex(b); b.fill(0);
  const addr = addrOf(priv, net);
  await saveSession({ v: 1, net, priv, addr, sompi: sompi.toString(), stage: 'created', qr: cnQr(net, priv), createdAt: Date.now() });
  const r = await require('./kasvillage_cold_wallet').sendKASWithHybridSig(addr, sompi, 'Cash note');
  if (!r?.success) return { error: (r?.error || 'Funding failed.') + ' If it was cancelled, tap "Reclaim" to clear it.' };
  const s = await cnLoadSession(); if (s) { s.stage = 'funded'; await saveSession(s); }
  return {};
}

/** Funded coins visible on chain for the note in progress. */
export async function cnFundedSompi(): Promise<bigint> {
  const s = await cnLoadSession(); if (!s) return 0n;
  return (await fetchUtxos(s.net, s.addr)).reduce((a, c) => a + c.amount, 0n);
}

/** Note printed + scanned back: forget the key on this phone, keep a public tracker row. */
export async function cnFinish(scanned: string): Promise<{ error?: string }> {
  const s = await cnLoadSession(); if (!s) return { error: 'No note in progress.' };
  if (String(scanned || '').trim() !== s.qr) return { error: 'That is not the note you just made. Scan the printed note.' };
  const funded = await cnFundedSompi();
  if (funded <= 0n) return { error: 'The note is not funded on chain yet. Try again in a minute.' };
  const rows = await cnList(); rows.push({ addr: s.addr, net: s.net, sompi: funded.toString(), createdAt: Date.now() }); await saveList(rows);
  s.priv = ''; s.qr = ''; await saveSession(s); await SecureStore.deleteItemAsync(SESSION_KEY);
  return {};
}

/** Before the key is forgotten: send the note's coins back to the hot wallet and drop the key. */
export async function cnReclaim(): Promise<{ error?: string }> {
  const s = await cnLoadSession(); if (!s) return { error: 'No note in progress.' };
  const funded = await fetchUtxos(s.net, s.addr);
  if (!funded.length) {
    if (Date.now() - s.createdAt < 120000) return { error: 'Not visible on chain yet - wait a couple of minutes.' };
    await new Promise((ok) => setTimeout(ok, 10000));
    if ((await fetchUtxos(s.net, s.addr)).length) return { error: 'Coins just arrived - try Reclaim again.' };
    await SecureStore.deleteItemAsync(SESSION_KEY); return {};
  }
  const x = sqXonlyFromAddress(await sqHotAddress());
  const r = sqSignSweepBack(s.priv, funded, x); if ('error' in r) return { error: r.error };
  const b = await broadcast(s.net, r.tx, r.txId); if (!b.ok) return { error: b.error };
  await SecureStore.deleteItemAsync(SESSION_KEY); return {};
}

/** Check a scanned note: value on chain. */
export async function cnInspect(raw: string): Promise<{ error?: string; net?: SqNet; sompi?: bigint }> {
  const p = cnParse(raw); if ('error' in p) return { error: p.error };
  if (p.net !== sqActiveNet()) return { error: 'This note is for ' + p.net + ' but the app is on ' + sqActiveNet() + '.' };
  let coins; try { coins = await fetchUtxos(p.net, p.addr); } catch (e: any) { return { error: e?.message || 'Network error' }; }
  const sompi = coins.reduce((a, c) => a + c.amount, 0n);
  if (sompi <= 0n) return { error: 'This note is empty - it was already redeemed (or not funded yet).' };
  return { net: p.net, sompi };
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
  const rows = await cnList();
  for (const r of rows) { if (r.status === 'redeemed') continue; try { r.status = (await fetchUtxos(r.net, r.addr)).length ? 'unredeemed' : 'redeemed'; } catch { r.status = 'unknown'; } }
  await saveList(rows); return rows;
}
