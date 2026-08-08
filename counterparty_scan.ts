/**
 * counterparty_scan.ts v2 — trustless counterparty history from a pubkey alone.
 *
 * No bundle, no export, no cooperation from the party being scanned, and NO untrusted
 * JSON parsed. You derive their address from a pubkey they already gave you in the
 * proposal, and read consensus state. They cannot curate, omit, or fabricate.
 *
 * v2 changes, both validated against live testnet data (scan_test_v2.cjs):
 *  - EXACT 2 funders. ">= 2" false-positived on ordinary personal wallets, which
 *    naturally accumulate from many sources; one such wallet inflated a real scan's
 *    distinctCounterparties from 1 to 11 and masked the sybil signal entirely.
 *  - Transaction-count cap as a second wallet filter. Escrows are short-lived.
 *  - 'deadlocked' split from 'open'. A kill tx destroys the refund path, so funds
 *    stuck in a killed escrow cannot be unilaterally reclaimed. That is materially
 *    different from a trade merely awaiting its second leg.
 *
 * PRESENTATION NOTE: a deadlock is "this trade did not resolve" and nothing more.
 * It could be abandonment, a dead phone, a buyer who inspected and declined, or a
 * genuine dispute where nobody was wrong. The chain records outcomes, not reasons.
 * Show the count and let the person judge; do not attach blame the data cannot support.
 *
 * Honest limits:
 *  - Sybil is NOT defeated. Self-dealing produces genuine escrows with genuine
 *    outcomes. distinctCounterparties is the tell, not a guarantee — a determined
 *    attacker uses twenty addresses instead of one.
 *  - release vs refund is NOT distinguished; both pay a single output to a funder.
 *    Separating them needs the spending tx's lockTime.
 *  - The REST endpoint is a trusted third party. Querying several independent
 *    endpoints and requiring agreement would reduce that; a light client would
 *    remove it.
 *  - Attribution: they could fund from a different address, but then that trade is
 *    not tied to this pubkey either, so it cannot be one of THIS identity's hidden
 *    failures. Identity = pubkey + its address; complete for that identity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveAddress } from './canonical_agreement_steps';

const CACHE_KEY = 'kv_scan_cache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ESCROW_TXS = 12; // escrows are short-lived; wallets are not

export type Resolution = 'settled' | 'deadlocked' | 'open';

export interface EscrowFinding {
  escrowAddr: string;
  counterparty: string;     // the other funder
  fundedTotal: number;      // sompi received
  resolution: Resolution;
  resolutionTxId: string;
  paidTo: string[];
  paidToTarget: boolean;
  killCount: number;
  lastBlockTime: number;
}

export interface ScanResult {
  pubkey: string;
  address: string;
  escrows: EscrowFinding[];
  total: number;
  settled: number;
  deadlocked: number;
  open: number;
  stuckSompi: number;             // value locked in deadlocked escrows
  payoutsReceived: number;
  distinctCounterparties: number; // low count + high volume = possible sybil
  pSettled: number;
  candidatesExamined: number;
  truncated: boolean;             // hit the call budget; counts are a lower bound
}

function apiBase(network: string): string {
  return network === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org';
}

function xonly(pk: string): string {
  const p = (pk || '').trim().toLowerCase();
  return p.length === 66 ? p.slice(2) : p;
}

async function fetchTxs(base: string, addr: string, limit: number): Promise<any[]> {
  // encodeURIComponent: addr is derived, not pasted, but never build a URL from an
  // unvalidated string.
  const url = base + '/addresses/' + encodeURIComponent(addr) +
              '/full-transactions?limit=' + limit + '&resolve_previous_outpoints=light';
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

const spendsFrom = (tx: any, a: string) =>
  Array.isArray(tx.inputs) && tx.inputs.some((i: any) => i && i.previous_outpoint_address === a);

const paysTo = (tx: any, a: string) =>
  !Array.isArray(tx.outputs) ? 0 :
    tx.outputs.filter((o: any) => o && o.script_public_key_address === a)
      .reduce((n: number, o: any) => n + Number(o.amount || 0), 0);

const outAddrs = (tx: any): string[] =>
  !Array.isArray(tx.outputs) ? [] :
    tx.outputs.map((o: any) => o && o.script_public_key_address).filter(Boolean);

/**
 * Scan a counterparty's on-chain escrow history from their pubkey.
 * REST calls: 1 + maxCandidates. Raise for a deep audit, lower for a fast pre-trade check.
 */
export async function scanCounterparty(
  pubkey: string,
  network: string = 'testnet-10',
  maxCandidates: number = 40,
  useCache: boolean = true,
): Promise<ScanResult> {
  const base = apiBase(network);
  const address = deriveAddress(xonly(pubkey), network as any);

  if (useCache) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : {};
      const hit = cache[pubkey];
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
    } catch {}
  }

  const empty: ScanResult = {
    pubkey, address, escrows: [], total: 0, settled: 0, deadlocked: 0, open: 0,
    stuckSompi: 0, payoutsReceived: 0, distinctCounterparties: 0, pSettled: 0,
    candidatesExamined: 0, truncated: false,
  };

  let history: any[];
  try { history = await fetchTxs(base, address, 100); }
  catch (e) { console.warn('[Scan] history fetch failed:', e); return empty; }
  if (!history.length) return empty;

  const candidates: string[] = [];
  for (const tx of history) {
    if (!spendsFrom(tx, address)) continue;
    for (const o of outAddrs(tx)) {
      if (o !== address && candidates.indexOf(o) < 0) candidates.push(o);
    }
  }
  const truncated = candidates.length > maxCandidates;
  const examine = candidates.slice(0, maxCandidates);

  const escrows: EscrowFinding[] = [];
  for (const cand of examine) {
    try {
      const txs = await fetchTxs(base, cand, 50);
      if (!txs.length) continue;
      if (txs.length > MAX_ESCROW_TXS) continue; // busy address: a wallet, not an escrow

      const funders: string[] = [];
      let fundedTotal = 0;
      for (const tx of txs) {
        const amt = paysTo(tx, cand);
        if (!amt) continue;
        fundedTotal += amt;
        for (const i of (tx.inputs || [])) {
          const f = i && i.previous_outpoint_address;
          if (f && f !== cand && funders.indexOf(f) < 0) funders.push(f);
        }
      }

      // EXACT 2: a 2-of-2 escrow is funded by precisely two parties.
      if (funders.length !== 2) continue;
      if (funders.indexOf(address) < 0) continue;

      const spends = txs.filter((t: any) => spendsFrom(t, cand));
      let killCount = 0;
      let settle: any = null;
      for (const sp of spends) {
        const outs = outAddrs(sp);
        if (!outs.some(o => o !== cand)) { killCount++; continue; } // pays itself: kill
        if (!settle || Number(sp.block_time || 0) > Number(settle.block_time || 0)) settle = sp;
      }

      const paidTo = settle ? outAddrs(settle).filter(o => o !== cand) : [];
      escrows.push({
        escrowAddr: cand,
        counterparty: funders.find(f => f !== address) || '',
        fundedTotal,
        resolution: settle ? 'settled' : (killCount > 0 ? 'deadlocked' : 'open'),
        resolutionTxId: settle ? (settle.transaction_id || '') : '',
        paidTo,
        paidToTarget: paidTo.indexOf(address) >= 0,
        killCount,
        lastBlockTime: settle ? Number(settle.block_time || 0) : 0,
      });
    } catch (e) {
      console.warn('[Scan] candidate failed:', cand.slice(0, 20), e);
    }
  }

  const cps: string[] = [];
  for (const e of escrows) if (e.counterparty && cps.indexOf(e.counterparty) < 0) cps.push(e.counterparty);

  const settled = escrows.filter(e => e.resolution === 'settled').length;
  const deadlocked = escrows.filter(e => e.resolution === 'deadlocked');

  const result: ScanResult = {
    pubkey,
    address,
    escrows,
    total: escrows.length,
    settled,
    deadlocked: deadlocked.length,
    open: escrows.filter(e => e.resolution === 'open').length,
    stuckSompi: deadlocked.reduce((n, e) => n + e.fundedTotal, 0),
    payoutsReceived: escrows.filter(e => e.paidToTarget).length,
    distinctCounterparties: cps.length,
    pSettled: escrows.length ? settled / escrows.length : 0,
    candidatesExamined: examine.length,
    truncated,
  };

  console.log('[Scan]', pubkey.slice(0, 16), '-> escrows:', result.total,
              'settled:', result.settled, 'deadlocked:', result.deadlocked,
              'distinct cp:', result.distinctCounterparties,
              truncated ? '(TRUNCATED - lower bound)' : '');

  if (useCache) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : {};
      cache[pubkey] = { at: Date.now(), result };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  return result;
}

/**
 * Optional forensics only — NOT part of the trust path. Counterparty evaluation is
 * lookup-only precisely so that no stranger's JSON is ever parsed. Use this to audit
 * your own exports, or a bundle someone volunteered, against what L1 actually shows.
 */
export function compareToBundle(scan: ScanResult, bundleJson: string): {
  claimed: number; onChain: number; unexplained: string[]; ok: boolean;
} {
  let claimedAddrs: string[] = [];
  try {
    if (bundleJson.length > 2_000_000) throw new Error('bundle too large');
    const b = JSON.parse(bundleJson.replace(/^\uFEFF/, ''));
    claimedAddrs = (b.records || [])
      .map((r: any) => r && typeof r.frostAddr === 'string' ? r.frostAddr : '')
      .filter(Boolean);
  } catch (e) { console.warn('[Scan] bundle parse failed:', e); }

  const unexplained = scan.escrows
    .map(e => e.escrowAddr)
    .filter(a => claimedAddrs.indexOf(a) < 0);

  return { claimed: claimedAddrs.length, onChain: scan.escrows.length, unexplained, ok: unexplained.length === 0 };
}
