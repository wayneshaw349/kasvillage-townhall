// ============================================================================
// kv_savings_core.ts — KV_SAVINGS_QR pure logic (no storage, no network, no UI)
// ============================================================================
// Savings QR: a throwaway key receives a deposit from the hot wallet, pre-signs
// one transaction per coin that pays ONLY the hot wallet, the QRs are printed,
// and the key is deleted. Afterwards no key exists: each printed QR is the only
// way to move its coin, and it can only move it to the hot wallet.
//
// QR text (one coin):
//   KVSQ1|<net>|<coinXonly>|<coinTxId>|<coinIndex>|<coinSompi>|<outSompi>|<hotXonly>|<sig>
// Everything in it is public except that it is a finished, signed spend.
// The signature is checked on the phone before anything is broadcast.
// ============================================================================

import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { computeSighash, computeTxId, storageMass } from './kaspa_rest_tx';

export type SqNet = 'mainnet' | 'testnet-10' | 'testnet-11';
export const SQ_PREFIX = 'KVSQ1';
export const SQ_FEE_RATE = 300n;          // sompi/gram = 3x the Toccata floor (100) so QRs still pass years later
export const SQ_MIN_COIN = 100_000_000n;  // 1 KAS per QR minimum (keeps KIP-9 storage mass low)
export const SQ_MAX_QRS = 10;
export const SQ_MAX_MASS = 90_000n;       // stay under the 100k standard limit
const SUBNET = '0000000000000000000000000000000000000000';
const SIG_SCRIPT_LEN = 66;                // push(65) + 64-byte schnorr sig + sighash type

export interface SqCoin { txId: string; index: number; amount: bigint; }
export interface SqQr {
  net: SqNet; coinXonly: string; coinTxId: string; coinIndex: number;
  coinSompi: bigint; outSompi: bigint; hotXonly: string; sig: string;
}

const isHex = (s: string, n: number) => typeof s === 'string' && s.length === n && /^[0-9a-f]+$/.test(s);
export const p2pk = (xonlyHex: string) => '20' + xonlyHex + 'ac';

// --- mass / fee ---------------------------------------------------------------
function txBytes(nIn: number, nOut: number): bigint {
  // version 2 + in count 8 + per input (32+4+8+66+8) + out count 8 + per output (8+2+8+34)
  // + lockTime 8 + subnetwork 20 + gas 8 + payload hash 32 + payload len 8
  return BigInt(94 + nIn * (52 + SIG_SCRIPT_LEN) + nOut * 52);
}
function computeMassP2pk(nIn: number, nOut: number): bigint {
  return txBytes(nIn, nOut) + BigInt(nOut) * 36n * 10n + BigInt(nIn) * 1000n;
}
/** Fee for a P2PK tx with these input/output values (fee taken from the inputs). */
export function sqFee(inValues: bigint[], outValues: bigint[]): { fee: bigint; mass: bigint } {
  const c = computeMassP2pk(inValues.length, outValues.length);
  const s = storageMass(inValues, outValues);
  const t = 2n * txBytes(inValues.length, outValues.length);
  let mass = c; if (s > mass) mass = s; if (t > mass) mass = t;
  return { fee: mass * SQ_FEE_RATE, mass };
}
/** Fee of one exit (1 coin -> hot wallet). Depends only weakly on the amount. */
export function sqExitFee(coin: bigint): bigint {
  // iterate once: storage mass depends on the output value
  let f = sqFee([coin], [coin - 1_000_000n]).fee;
  f = sqFee([coin], [coin - f]).fee;
  return f;
}

// --- signing ------------------------------------------------------------------
function signP2pkTx(privHex: string, inputs: SqCoin[], outputs: { amount: bigint; xonly: string }[]) {
  const priv = hexToBytes(privHex);
  const xonly = bytesToHex(secp256k1.getPublicKey(priv, true).slice(1));
  const inScript = hexToBytes(p2pk(xonly));
  const ins = inputs.map((u) => ({ txId: hexToBytes(u.txId), index: u.index, sequence: 0n, sigOpCount: 1, scriptVersion: 0, scriptPubKey: inScript, value: u.amount }));
  const outs = outputs.map((o) => ({ value: o.amount, scriptVersion: 0, script: hexToBytes(p2pk(o.xonly)) }));
  const sigs: string[] = [];
  for (let i = 0; i < ins.length; i++) {
    const h = computeSighash(0, ins, outs, i, hexToBytes(SUBNET), 0n, 0n, true, new Uint8Array(0));
    sigs.push(bytesToHex(schnorr.sign(h, priv)));
  }
  priv.fill(0);
  const tx = {
    version: 0,
    inputs: inputs.map((u, i) => ({ previousOutpoint: { transactionId: u.txId, index: u.index }, signatureScript: '41' + sigs[i] + '01', sequence: '0', sigOpCount: 1 })),
    outputs: outputs.map((o) => ({ amount: o.amount.toString(), scriptPublicKey: { version: 0, scriptPublicKey: p2pk(o.xonly) } })),
    lockTime: '0', subnetworkId: SUBNET, gas: '0', payload: '',
  };
  const txId = computeTxId({
    version: 0,
    inputs: inputs.map((u) => ({ prevTxId: u.txId, prevIndex: u.index, sequence: 0n })),
    outputs: outputs.map((o) => ({ amount: o.amount, scriptVersion: 0, scriptHex: p2pk(o.xonly) })),
    lockTime: 0n, subnetworkId: SUBNET, gas: 0n, payloadHex: '',
  });
  return { tx, txId, sigs, xonly };
}

/** Plan the deposit: split the funded coins into n equal coins (or use the single coin as is). */
export function sqPlan(funded: SqCoin[], n: number): { error?: string; split?: { coinValues: bigint[]; fee: bigint }; coins?: bigint[] } {
  if (!Number.isInteger(n) || n < 1 || n > SQ_MAX_QRS) return { error: 'Choose 1 to ' + SQ_MAX_QRS + ' QRs.' };
  if (!funded.length) return { error: 'The deposit has not arrived yet.' };
  const total = funded.reduce((a, c) => a + c.amount, 0n);
  if (n === 1 && funded.length === 1) {
    if (total < SQ_MIN_COIN) return { error: 'Each QR must hold at least 1 KAS.' };
    return { coins: [total] };
  }
  // split: guess fee, size coins, recompute until stable
  let fee = 0n; let vals: bigint[] = [];
  for (let k = 0; k < 4; k++) {
    const each = (total - fee) / BigInt(n);
    vals = Array.from({ length: n }, (_, i) => (i === n - 1 ? total - fee - each * BigInt(n - 1) : each));
    const f = sqFee(funded.map((c) => c.amount), vals);
    if (f.mass > SQ_MAX_MASS) return { error: 'Too many QRs for this amount - use fewer QRs or a larger deposit.' };
    if (f.fee <= fee) break;
    fee = f.fee;
  }
  if (vals.some((v) => v < SQ_MIN_COIN)) return { error: 'Each QR must hold at least 1 KAS - use fewer QRs or a larger deposit.' };
  return { split: { coinValues: vals, fee }, coins: vals };
}

/** KV_SAVINGS_QR pre-check before any coin moves: plan the typed deposit as ONE funded coin
 *  (how the hot wallet pays it) + every exit must clear the same minimum sqSignAll enforces. '' = ok. */
export function sqPrecheck(depositSompi: bigint, n: number): string {
  if (depositSompi <= 0n) return 'Enter an amount.';
  const plan = sqPlan([{ txId: '0'.repeat(64), index: 0, amount: depositSompi }], n);
  if (plan.error || !plan.coins) return plan.error || 'Plan failed';
  for (const c of plan.coins) { if (c < SQ_MIN_COIN) return 'Each QR must hold at least 1 KAS.'; if (c - sqExitFee(c) < SQ_MIN_COIN / 2n) return 'Coin too small after fee.'; }
  return '';
}

/** Sign the split (if any) and one exit per coin. Pure: returns everything to broadcast/print. */
export function sqSignAll(p: { privHex: string; net: SqNet; funded: SqCoin[]; n: number; hotXonly: string }):
  { error: string } | { splitTx: any | null; splitTxId: string | null; qrs: string[]; exits: { txId: string; outSompi: bigint; coin: SqCoin }[]; coinXonly: string } {
  if (!isHex(p.hotXonly, 64)) return { error: 'Hot wallet key is not a standard (Schnorr P2PK) address.' };
  const plan = sqPlan(p.funded, p.n);
  if (plan.error || !plan.coins) return { error: plan.error || 'Plan failed' };
  const coinXonly = bytesToHex(secp256k1.getPublicKey(hexToBytes(p.privHex), true).slice(1));
  let coins: SqCoin[]; let splitTx: any = null; let splitTxId: string | null = null;
  if (plan.split) {
    const s = signP2pkTx(p.privHex, p.funded, plan.split.coinValues.map((v) => ({ amount: v, xonly: coinXonly })));
    splitTx = s.tx; splitTxId = s.txId;
    coins = plan.split.coinValues.map((v, i) => ({ txId: s.txId, index: i, amount: v }));
  } else {
    coins = [p.funded[0]];
  }
  const qrs: string[] = []; const exits: { txId: string; outSompi: bigint; coin: SqCoin }[] = [];
  for (const c of coins) {
    const fee = sqExitFee(c.amount);
    const out = c.amount - fee;
    if (out < SQ_MIN_COIN / 2n) return { error: 'Coin too small after fee.' };
    const e = signP2pkTx(p.privHex, [c], [{ amount: out, xonly: p.hotXonly }]);
    qrs.push([SQ_PREFIX, p.net, coinXonly, c.txId, String(c.index), c.amount.toString(), out.toString(), p.hotXonly, e.sigs[0]].join('|'));
    exits.push({ txId: e.txId, outSompi: out, coin: c });
  }
  return { splitTx, splitTxId, qrs, exits, coinXonly };
}

/** Parse + verify a Savings QR's signature (no network). */
export function sqParse(raw: string): { error: string } | { qr: SqQr; tx: any; txId: string } {
  const parts = String(raw || '').trim().split('|');
  if (parts.length !== 9 || parts[0] !== SQ_PREFIX) return { error: 'Not a KasVillage Savings QR.' };
  const [, net, coinXonly, coinTxId, idxS, coinS, outS, hotXonly, sig] = parts;
  if (!['mainnet', 'testnet-10', 'testnet-11'].includes(net)) return { error: 'Unknown network in QR.' };
  if (!isHex(coinXonly, 64) || !isHex(coinTxId, 64) || !isHex(hotXonly, 64) || !isHex(sig, 128)) return { error: 'Damaged QR (bad field).' };
  if (!/^\d{1,4}$/.test(idxS) || !/^\d{1,19}$/.test(coinS) || !/^\d{1,19}$/.test(outS)) return { error: 'Damaged QR (bad number).' };
  const coinSompi = BigInt(coinS), outSompi = BigInt(outS), coinIndex = Number(idxS);
  if (outSompi <= 0n || outSompi >= coinSompi) return { error: 'Damaged QR (amounts).' };
  const ins = [{ txId: hexToBytes(coinTxId), index: coinIndex, sequence: 0n, sigOpCount: 1, scriptVersion: 0, scriptPubKey: hexToBytes(p2pk(coinXonly)), value: coinSompi }];
  const outs = [{ value: outSompi, scriptVersion: 0, script: hexToBytes(p2pk(hotXonly)) }];
  const h = computeSighash(0, ins, outs, 0, hexToBytes(SUBNET), 0n, 0n, true, new Uint8Array(0));
  let ok = false; try { ok = schnorr.verify(hexToBytes(sig), h, hexToBytes(coinXonly)); } catch { ok = false; }
  if (!ok) return { error: 'This QR\'s signature does not check out - it may be damaged or not genuine.' };
  const tx = {
    version: 0,
    inputs: [{ previousOutpoint: { transactionId: coinTxId, index: coinIndex }, signatureScript: '41' + sig + '01', sequence: '0', sigOpCount: 1 }],
    outputs: [{ amount: outSompi.toString(), scriptPublicKey: { version: 0, scriptPublicKey: p2pk(hotXonly) } }],
    lockTime: '0', subnetworkId: SUBNET, gas: '0', payload: '',
  };
  const txId = computeTxId({ version: 0, inputs: [{ prevTxId: coinTxId, prevIndex: coinIndex, sequence: 0n }], outputs: [{ amount: outSompi, scriptVersion: 0, scriptHex: p2pk(hotXonly) }], lockTime: 0n, subnetworkId: SUBNET, gas: 0n, payloadHex: '' });
  return { qr: { net: net as SqNet, coinXonly, coinTxId, coinIndex, coinSompi, outSompi, hotXonly, sig }, tx, txId };
}

/** Sweep everything at the throwaway address back to the hot wallet (used to cancel before the key is forgotten). */
export function sqSignSweepBack(privHex: string, funded: SqCoin[], hotXonly: string): { error: string } | { tx: any; txId: string } {
  if (!isHex(hotXonly, 64)) return { error: 'Destination is not a standard (Schnorr P2PK) address.' }; // KV_SAVINGS_QR: never sign to a bad script
  if (!funded.length) return { error: 'Nothing to return.' };
  const total = funded.reduce((a, c) => a + c.amount, 0n);
  let f = sqFee(funded.map((c) => c.amount), [total - 1_000_000n]);
  f = sqFee(funded.map((c) => c.amount), [total - f.fee]);
  const fee = f.fee;
  if (f.mass > SQ_MAX_MASS) return { error: 'Too many coins to move in one transaction.' };
  if (total - fee <= 0n) return { error: 'Too small to return.' };
  const s = signP2pkTx(privHex, funded, [{ amount: total - fee, xonly: hotXonly }]);
  return { tx: s.tx, txId: s.txId };
}

/** Kaspa P2PK address payload (x-only key) from an address string, or '' if not P2PK. */
export function sqXonlyFromAddress(address: string): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const i = String(address || '').indexOf(':'); if (i < 0) return '';
  const d: number[] = []; for (const ch of address.slice(i + 1)) { const v = CHARSET.indexOf(ch); if (v < 0) return ''; d.push(v); }
  const p5 = d.slice(0, d.length - 8);
  let bits = 0, acc = 0; const p8: number[] = [];
  for (const v of p5) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; p8.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; } }
  if (p8.length !== 33 || p8[0] !== 0x00) return '';
  return bytesToHex(new Uint8Array(p8.slice(1)));
}

// --- KV_SAVINGS_QR verify helpers (pure) ----------------------------------------
/** Track which printed ORIGINALS were scanned back. Backup copies are the same string, so any copy counts for its QR. */
export function sqScanProgress(qrs: string[], scanned: number[] | undefined, raw: string): { error?: string; scanned: number[]; have: number; total: number; added: boolean } {
  const set = Array.from(new Set((scanned || []).filter((i) => Number.isInteger(i) && i >= 0 && i < qrs.length)));
  const idx = qrs.indexOf(String(raw || '').trim());
  if (idx < 0) return { error: 'That QR is not from this deposit. Scan the sheets you just printed.', scanned: set, have: set.length, total: qrs.length, added: false };
  const added = !set.includes(idx); if (added) set.push(idx);
  set.sort((a, b) => a - b);
  return { scanned: set, have: set.length, total: qrs.length, added };
}
/** Coins on chain at the throwaway address vs the coins the QRs cover: missing = not confirmed yet, extra = not covered. */
export function sqCoverage(on: SqCoin[], covered: { txId: string; index: number; amount: string }[]): { missing: number; extra: SqCoin[] } {
  const hit = (u: SqCoin, c: { txId: string; index: number; amount: string }) => u.txId === c.txId && u.index === c.index && u.amount.toString() === c.amount;
  return { missing: covered.filter((c) => !on.some((u) => hit(u, c))).length, extra: on.filter((u) => !covered.some((c) => hit(u, c))) };
}
