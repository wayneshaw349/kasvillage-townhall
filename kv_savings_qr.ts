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
import { sqSignAll, sqParse, sqSignSweepBack, sqXonlyFromAddress, SqCoin, SqNet } from './kv_savings_core';

const SESSION_KEY = 'kv_sq_session';
const LIST_KEY = 'kv_sq_list';
const SECRET_OPTS = { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY } as any;
const API: Record<string, string> = { 'mainnet': 'https://api.kaspa.org', 'testnet-10': 'https://api-tn10.kaspa.org', 'testnet-11': 'https://api-tn11.kaspa.org' };

export interface SqSession {
  v: 1; net: SqNet; priv: string; xonly: string; addr: string; n: number;
  depositSompi: string; stage: 'created' | 'funded' | 'signed';
  fundTxId?: string; splitTxId?: string | null; qrs?: string[];
  exits?: { txId: string; outSompi: string; coin: { txId: string; index: number; amount: string } }[];
  createdAt: number;
}
export interface SqRow {
  id: string; net: SqNet; addr: string; coinTxId: string; coinIndex: number; outSompi: string;
  hotLast6: string; label: string; createdAt: number; status?: 'unspent' | 'spent' | 'unknown';
}

export function sqActiveNet(): SqNet { return require('./kv_vault_active').kvActiveNet(); }
export function sqTutorial(): boolean { try { return !!require('./kv_tutorial').kvIsTutorial(); } catch { return false; } }

export async function sqHotAddress(): Promise<string> {
  const h = (await SecureStore.getItemAsync('kv_kaspa_address')) || '';
  return sqActiveNet() === 'mainnet' ? ((await SecureStore.getItemAsync('kaspa_address_real')) || h) : h;
}

export async function sqLoadSession(): Promise<SqSession | null> {
  try { const r = await SecureStore.getItemAsync(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function saveSession(s: SqSession) { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s), SECRET_OPTS); }

export async function sqList(): Promise<SqRow[]> {
  try { const r = await SecureStore.getItemAsync(LIST_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
async function saveList(rows: SqRow[]) { await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(rows.slice(-200))); }

async function fetchUtxos(net: string, addr: string): Promise<SqCoin[]> {
  const r = await fetch(API[net] + '/addresses/' + addr + '/utxos');
  if (!r.ok) throw new Error('UTXO lookup failed (' + r.status + ')');
  const j: any[] = await r.json();
  return (Array.isArray(j) ? j : []).map((u: any) => ({ txId: String(u.outpoint?.transactionId || ''), index: Number(u.outpoint?.index ?? 0), amount: BigInt(u.utxoEntry?.amount || '0') }))
    .filter((c) => /^[0-9a-f]{64}$/.test(c.txId) && c.amount > 0n);
}
async function txLanded(net: string, txId: string): Promise<boolean> {
  try { const r = await fetch(API[net] + '/transactions/' + txId + '?inputs=false&outputs=false'); return r.ok; } catch { return false; }
}
/** Broadcast a signed tx; an ambiguous failure is resolved by looking the txid up. */
async function broadcast(net: SqNet, tx: any, txId: string): Promise<{ ok: boolean; maybe?: boolean; error?: string }> {
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

// --- 1. start: make the throwaway key and pay it from the hot wallet --------------------------
export async function sqStartDeposit(depositSompi: bigint, n: number): Promise<{ error?: string }> {
  if (sqTutorial()) return { error: 'Savings QR needs Real mode.' };
  const bk = await sqHotBackupCheck(); if (bk) return { error: bk };
  if (await sqLoadSession()) return { error: 'Finish (or return) the deposit already in progress first.' };
  const hot = await sqHotAddress();
  if (!sqXonlyFromAddress(hot)) return { error: 'Your hot wallet address is not a standard address - Savings QR cannot pay it.' };
  const net = sqActiveNet();
  const privB = (secp256k1 as any).utils.randomPrivateKey() as Uint8Array;
  const priv = bytesToHex(privB); privB.fill(0);
  const xonly = bytesToHex(secp256k1.getPublicKey(require('@noble/hashes/utils').hexToBytes(priv), true).slice(1));
  const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
  const addr = kaspaAddressFromXOnly(require('@noble/hashes/utils').hexToBytes(xonly), net.startsWith('testnet') ? 'kaspatest' : 'kaspa');
  if (String(addr).split(':')[0] !== String(hot).split(':')[0]) return { error: 'Network mismatch between hot wallet and vault.' };
  // Save the key BEFORE any coin moves: a crash after funding must never strand the deposit.
  await saveSession({ v: 1, net, priv, xonly, addr, n, depositSompi: depositSompi.toString(), stage: 'created', createdAt: Date.now() });
  const { sendKASWithHybridSig } = require('./kasvillage_cold_wallet');
  const r = await sendKASWithHybridSig(addr, depositSompi, 'Savings QR deposit'); // Face ID + simulation
  if (!r?.success) {
    // Keep the key: a send that "failed" may still land. "Return deposit" clears it safely later.
    return { error: (r?.error || 'Deposit failed.') + ' If the deposit was cancelled, tap "Return deposit" to clear it.' };
  }
  const s = await sqLoadSession(); if (s) { s.stage = 'funded'; s.fundTxId = r.kaspaTxId || ''; await saveSession(s); }
  return {};
}

// --- 2. sign: once the deposit is on chain, split + sign one exit per coin --------------------
export async function sqSign(): Promise<{ error?: string; waiting?: boolean }> {
  const s = await sqLoadSession(); if (!s) return { error: 'No deposit in progress.' };
  if (s.stage === 'signed') return {};
  const funded = await fetchUtxos(s.net, s.addr);
  if (!funded.length) return { waiting: true };
  const hot = await sqHotAddress(); const hotXonly = sqXonlyFromAddress(hot);
  const r = sqSignAll({ privHex: s.priv, net: s.net, funded, n: s.n, hotXonly });
  if ('error' in r) return { error: r.error };
  // self-check every QR before anything is broadcast
  for (const q of r.qrs) { const p = sqParse(q); if ('error' in p) return { error: 'Self-check failed: ' + p.error }; }
  if (r.splitTx && r.splitTxId) {
    const b = await broadcast(s.net, r.splitTx, r.splitTxId);
    if (!b.ok) return { error: b.error };
  }
  s.stage = 'signed'; s.splitTxId = r.splitTxId; s.qrs = r.qrs;
  s.exits = r.exits.map((e) => ({ txId: e.txId, outSompi: e.outSompi.toString(), coin: { txId: e.coin.txId, index: e.coin.index, amount: e.coin.amount.toString() } }));
  await saveSession(s);
  return {};
}

// --- 3. verify: a printed QR scanned back + every coin on chain -> forget the key -------------
export async function sqVerifyAndForget(scanned: string): Promise<{ error?: string; done?: boolean }> {
  const s = await sqLoadSession(); if (!s || s.stage !== 'signed' || !s.qrs || !s.exits) return { error: 'Nothing to verify.' };
  if (!s.qrs.includes(String(scanned || '').trim())) return { error: 'That QR is not from this deposit. Scan one of the sheets you just printed.' };
  const on = await fetchUtxos(s.net, s.addr);
  const missing = s.exits.filter((e) => !on.some((u) => u.txId === e.coin.txId && u.index === e.coin.index && u.amount.toString() === e.coin.amount));
  if (missing.length) return { error: 'Waiting for the network to confirm the coins (' + missing.length + ' left). Try again in a minute.' };
  const hot = await sqHotAddress();
  const rows = await sqList();
  s.exits.forEach((e, i) => rows.push({ id: e.txId, net: s.net, addr: s.addr, coinTxId: e.coin.txId, coinIndex: e.coin.index, outSompi: e.outSompi, hotLast6: hot.slice(-6), label: (i + 1) + ' of ' + s.exits!.length, createdAt: Date.now() }));
  await saveList(rows);
  s.priv = ''; await saveSession(s);           // overwrite first, then delete
  await SecureStore.deleteItemAsync(SESSION_KEY);
  return { done: true };
}

// --- cancel: before the key is forgotten, everything can go back to the hot wallet ------------
export async function sqReturnToHot(): Promise<{ error?: string; done?: boolean }> {
  const s = await sqLoadSession(); if (!s) return { error: 'No deposit in progress.' };
  const funded = await fetchUtxos(s.net, s.addr);
  if (!funded.length) {
    if (s.stage === 'created' && Date.now() - s.createdAt > 120000) {
      // never funded: check twice, 10 s apart, before dropping the key
      await new Promise((ok) => setTimeout(ok, 10000));
      if ((await fetchUtxos(s.net, s.addr)).length === 0) { await SecureStore.deleteItemAsync(SESSION_KEY); return { done: true }; }
      return { error: 'Coins just arrived - tap Continue instead.' };
    }
    return { error: 'The deposit is not visible on chain yet. Wait a couple of minutes and try again.' };
  }
  const hotXonly = sqXonlyFromAddress(await sqHotAddress());
  const r = sqSignSweepBack(s.priv, funded, hotXonly);
  if ('error' in r) return { error: r.error };
  const b = await broadcast(s.net, r.tx, r.txId);
  if (!b.ok) return { error: b.error };
  await SecureStore.deleteItemAsync(SESSION_KEY);
  return { done: true };
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
  const rows = await sqList(); const row = rows.find((r) => r.id === info.txId); if (row) { row.status = 'spent'; await saveList(rows); }
  return { txId: info.txId };
}

/** Refresh tracker status from the chain (public data only). */
export async function sqRefresh(): Promise<SqRow[]> {
  const rows = await sqList(); const byAddr: Record<string, SqCoin[] | null> = {};
  for (const r of rows) {
    if (r.status === 'spent') continue;
    if (!(r.addr in byAddr)) { try { byAddr[r.addr] = await fetchUtxos(r.net, r.addr); } catch { byAddr[r.addr] = null; } }
    const on = byAddr[r.addr];
    r.status = on === null ? 'unknown' : on.some((u) => u.txId === r.coinTxId && u.index === r.coinIndex) ? 'unspent' : 'spent';
  }
  await saveList(rows);
  return rows;
}

/** Printable HTML: one QR per coin, two copies reminder. QR drawn as SVG (pure JS, no network). */
export function sqPrintHtml(qrs: string[], outs: string[], hotLast6: string, net: string, usdPerKas = 0): string {
  const QR = require('qrcode');
  const svg = (t: string) => {
    const q = QR.create(t, { errorCorrectionLevel: 'M' }); const n = q.modules.size; const d = q.modules.data; const m = 4; const sz = n + 2 * m;
    let p = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[y * n + x]) p += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sz + ' ' + sz + '" width="260" height="260" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + p + '" fill="#000"/></svg>';
  };
  const date = new Date().toISOString().slice(0, 10);
  const cards = qrs.map((q, i) => '<div class="c"><h2>KasVillage Savings QR · ' + (i + 1) + ' of ' + qrs.length + '</h2>' + svg(q) +
    '<p class="k"><b>' + (Number(outs[i]) / 1e8).toFixed(4) + ' KAS</b></p>' +
    (usdPerKas > 0 ? '<p class="u">≈ $' + ((Number(outs[i]) / 1e8) * usdPerKas).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' USD on ' + date + ' (1 KAS = $' + usdPerKas.toFixed(4) + ')</p><p class="s">Dollar value changes with the KAS price; the KAS amount does not.</p>' : '') +
    '<p>To hot wallet …' + hotLast6 + '</p><p>' + net + ' · ' + date + '</p>' +
    '<p class="s">Whoever scans this can only move these coins into that wallet. Losing this paper loses these coins: keep two copies in different places.</p></div>').join('');
  return '<html><head><meta name="viewport" content="width=device-width"/><style>body{font-family:sans-serif}.c{page-break-inside:avoid;border:1px solid #000;padding:12px;margin:12px 0;text-align:center}.s{font-size:11px}.k{font-size:22px;margin:6px 0}.u{font-size:16px;margin:2px 0}</style></head><body>' + cards + '</body></html>';
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
