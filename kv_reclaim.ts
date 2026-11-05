// KV_RECLAIM: list and reclaim the pledges YOU staked when publishing (stores, services, DApps,
// academics, games). Every pledge address is derived from your own private key, so this can only
// ever see and move your own coins - nobody else's listing can be touched.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export type PledgeKind = 'store' | 'dapp' | 'academic' | 'game' | 'node';
export interface MyPledge { key: string; kind: PledgeKind; label: string; nonces: number[]; sompi: bigint; note: string; }

const NET = require('./kv_net').KV_NET;

async function owner() {
  const { _kvResolvePrivHex } = require('./proposal_share');
  const priv: string | null = await _kvResolvePrivHex();
  const address = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
  if (!priv || !address) throw new Error('wallet keys unavailable');
  return { privateKeyHex: priv, pubkeyHex: bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true)), address, network: NET as any };
}

async function balanceAt(priv: string, nonce: number): Promise<bigint> {
  const { deriveStoreKeys } = require('./payload_publish');
  const { getPledgeSompi } = require('./kaspa_payload');
  try { return BigInt(await getPledgeSompi(deriveStoreKeys(priv, nonce, NET).address, NET)); } catch { return 0n; }
}

// KV_BALANCE_STRICT: a failed lookup must never read as "empty" - that made Reclaim report
// 0.00 on flaky connections while the coins sat untouched. Retries, then throws.
async function balanceAtStrict(priv: string, nonce: number): Promise<bigint> {
  const { deriveStoreKeys } = require('./payload_publish');
  const { getPledgeSompi } = require('./kaspa_payload');
  const addr = deriveStoreKeys(priv, nonce, NET).address;
  let lastErr: any = null;
  for (let t = 0; t < 6; t++) {
    try {
      const v = await getPledgeSompi(addr, NET);
      if (v === null || v === undefined) throw new Error('empty response');
      return BigInt(v);
    } catch (e: any) {
      lastErr = e;
      const rate = /429/.test(String(e && e.message)); // KV_API_429: rate-limited, not broken - back off and it clears
      if (rate) console.log('[Reclaim] API says slow down (429) - waiting before retrying');
      await new Promise((r) => setTimeout(r, rate ? 8000 + t * 7000 : 1500));
    }
  }
  throw new Error(/429/.test(String(lastErr && lastErr.message))
    ? 'the public API is rate-limiting this phone right now. Nothing is wrong with your coins - wait 2-3 minutes with the app idle, then tap Reclaim again.'
    : 'could not read the chain for this address (check your connection): ' + String((lastErr && lastErr.message) || lastErr));
}

// KV_PLEDGE_FAST: check many derived addresses at once - a one-by-one scan took minutes.
async function balancesAt(priv: string, nonces: number[]): Promise<bigint[]> {
  const out: bigint[] = new Array(nonces.length).fill(0n);
  let i = 0;
  const workers = Array.from({ length: Math.min(6, nonces.length) }, async () => {
    for (;;) { const k = i++; if (k >= nonces.length) return; out[k] = await balanceAtStrict(priv, nonces[k]); await new Promise((r) => setTimeout(r, 120)); } // KV_API_GENTLE + strict: a 429 waits or errors, never reads as "no pledge" 
  });
  await Promise.all(workers);
  return out;
}

const NOTE_DELIST = 'Reclaiming takes this listing out of the Mailbox (pledge 0 = delisted).';
const NOTE_GAME = 'The game stays listed and playable, but loses its pledge rank and keepers can no longer refresh it.';

// KV_PLEDGE_FIND: recover the parked coins of a game whose book is gone. The addresses are
// derived from your key + the game's exact name, so the name is enough - scans ~90 slots.
export async function findGamePledges(id: string): Promise<MyPledge | null> {
  const o = await owner(); const priv = o.privateKeyHex;
  const clean = String(id || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,48}$/.test(clean)) throw new Error('that is not a game name (a-z, 0-9, dashes)');
  const { nonceBaseFor } = require('./kv_build_chain');
  const base = nonceBaseFor(o.pubkeyHex, clean);
  const all = Array.from({ length: 90 }, (_, i) => base + i);
  const bals = await balancesAt(priv, all);
  const nonces: number[] = []; let s = 0n;
  bals.forEach((b, i) => { if (b > 0n) { s += b; nonces.push(all[i]); } });
  if (s === 0n) return null;
  try { const known: any = JSON.parse((await AsyncStorage.getItem('kv_known_pledges')) || '{}');
    known['game:' + clean] = { kind: 'game', label: 'Game: ' + clean + ' (recovered)', nonces, note: NOTE_GAME, sompi: String(s), at: Date.now() };
    await AsyncStorage.setItem('kv_known_pledges', JSON.stringify(known)); } catch {}
  return { key: 'game:' + clean, kind: 'game', label: 'Game: ' + clean + ' (recovered)', nonces, sompi: s, note: NOTE_GAME };
}

let _plCache: { at: number; out: MyPledge[] } | null = null; // KV_PLEDGE_CACHE: reopening the screen must not re-hammer the API
export function forgetPledgeCache() { _plCache = null; }
// KV_PLEDGE_LEDGER: the remembered stakes, straight from this phone - zero network reads.
export async function listKnownPledges(): Promise<Array<{ key: string; kind: PledgeKind; label: string; nonces: number[]; sompi: bigint; note: string; at: number }>> {
  try {
    const known = JSON.parse((await AsyncStorage.getItem('kv_known_pledges')) || '{}');
    return Object.keys(known).map((key) => { const k = known[key] || {}; return { key, kind: k.kind || 'game', label: k.label || key, nonces: (k.nonces || []).map(Number), sompi: BigInt(k.sompi || 0), note: k.note || '', at: Number(k.at || 0) }; });
  } catch { return []; }
}
export async function listMyPledges(): Promise<MyPledge[]> {
  if (_plCache && Date.now() - _plCache.at < 10 * 60000) return _plCache.out;
  const o = await owner(); const priv = o.privateKeyHex;
  const out: MyPledge[] = [];
  const add = async (key: string, kind: PledgeKind, label: string, nonces: number[], note: string) => {
    const bals = await balancesAt(priv, nonces);
    let s = 0n; const keep: number[] = [];
    bals.forEach((b, i) => { if (b > 0n) { s += b; keep.push(nonces[i]); } });
    if (s > 0n) out.push({ key, kind, label, nonces: keep, sompi: s, note });
  };
  await add('store', 'store', 'Store / Service listing', [0], NOTE_DELIST);
  await add('dapp', 'dapp', 'DApp listing', [1], NOTE_DELIST);
  await add('node', 'node', 'Operator bond (Ledger Service)', [5], 'Reclaiming deregisters you as an operator; audits and tips stop.');
  try {
    const abs: any[] = JSON.parse((await SecureStore.getItemAsync('kv_abstracts')) || '[]');
    for (const a of abs) {
      const n = await AsyncStorage.getItem('kv_abs_nonce_' + a.id);
      if (n) await add('abs:' + a.id, 'academic', 'Academic: ' + (String(a.title || '').trim() || 'untitled'), [parseInt(n, 10)], NOTE_DELIST);
    }
  } catch {}
  try {
    const games: Record<string, any> = {};
    try { Object.assign(games, require('./games_to_publish')); } catch {}
    try { Object.assign(games, JSON.parse((await AsyncStorage.getItem('kv_my_games')) || '{}')); } catch {}
    // KV_PLEDGE_TOMBSTONE: books removed from the shelf still get their coins listed
    try { const tb = JSON.parse((await AsyncStorage.getItem('kv_pledge_tombstones')) || '{}'); for (const id of Object.keys(tb)) if (!games[id]) games[id] = tb[id]; } catch {}
    for (const id of Object.keys(games)) {
      const g = games[id]; const base = Number(g && g.nonceBase); if (!(base >= 0)) continue;
      const frags = (g.bundle && g.bundle.manifest && g.bundle.manifest.frags) || (g.manifest && g.manifest.frags) || [];
      const slots = frags.length ? Math.max(...frags.map((f: any) => Number(f.slot) || 0)) + 1 : 4;
      const nonces = Array.from({ length: slots }, (_, i) => base + i).concat([base + 86]);
      await add('game:' + id, 'game', 'Game: ' + id, nonces, NOTE_GAME);
    }
  } catch {}
  // KV_PLEDGE_KNOWN: persistence instead of rescanning. Any pledge ever seen (listed here or
  // found by name) is remembered on this phone and re-checked by its exact addresses only -
  // a handful of reads, no registry sweep. A reclaim that empties it deletes the memory.
  try {
    const known = JSON.parse((await AsyncStorage.getItem('kv_known_pledges')) || '{}');
    for (const key of Object.keys(known)) {
      if (out.some((q) => q.key === key)) continue;
      const k = known[key] || {};
      if (Array.isArray(k.nonces) && k.nonces.length) await add(key, k.kind || 'game', k.label || key, k.nonces.map(Number), k.note || NOTE_GAME);
    }
  } catch {}
  try { // remember everything currently standing
    const known: any = JSON.parse((await AsyncStorage.getItem('kv_known_pledges')) || '{}');
    for (const q of out) known[q.key] = { kind: q.kind, label: q.label, nonces: q.nonces, note: q.note, sompi: String(q.sompi), at: Date.now() };
    await AsyncStorage.setItem('kv_known_pledges', JSON.stringify(known));
  } catch {}
  _plCache = { at: Date.now(), out };
  return out;
}

// Sweeps every coin at the pledge address(es) back to your wallet. Returns KAS reclaimed (before fees).
// KV_SWEEP_BATCH: a game pledge sits in hundreds of chunk coins, so each sweep tx is capped by mass
// and we loop until the address is empty, waiting between batches for the mempool to settle.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function reclaimPledge(p: MyPledge): Promise<number> {
  const o = await owner();
  const { withdrawPledge } = require('./payload_publish');
  let moved = 0n; let left = 0n;
  for (const n of p.nonces) {
    console.log('[Reclaim] sweeping nonce', n);
    let retries = 0;
    for (let batch = 0; batch < 25; batch++) {
      const b = await balanceAtStrict(o.privateKeyHex, n); if (b === 0n) { console.log('[Reclaim] nonce', n, 'is empty - confirmed by the chain'); break; }
      console.log('[Reclaim] nonce', n, 'holds', (Number(b) / 1e8).toFixed(2), 'KAS - sweeping');
      const r: any = await withdrawPledge(o, n);
      if (r === null) break; // already 0
      if (r && r.success === false) {
        const e = String(r.error || 'sweep failed');
        if (/already spent|mempool|orphan|no utxos/i.test(e) && retries < 8) { retries++; await sleep(6000); continue; } // KV_SWEEP_LAG: UTXO view trails mid-confirmation
        throw new Error(e + ' (after ' + (Number(moved) / 1e8) + ' KAS)');
      }
      // KV_SWEEP_SETTLE: the public indexer can lag well past 4s - poll up to 45s before concluding anything
      let after = b;
      for (let w = 0; w < 9; w++) { await sleep(5000); try { after = await balanceAtStrict(o.privateKeyHex, n); } catch { continue; } if (after < b) break; }
      moved += b - after;
      if (after === 0n) break;
      if (after === b) { console.log('[Reclaim] nonce', n, 'sweep submitted but not visible yet - the indexer is behind; it will show up'); left += after; break; }
      left += after;
    }
  }
  if (left === 0n) { // emptied: the pledge memory deletes itself
    try { const known: any = JSON.parse((await AsyncStorage.getItem('kv_known_pledges')) || '{}');
      if (known[p.key]) { delete known[p.key]; await AsyncStorage.setItem('kv_known_pledges', JSON.stringify(known)); } } catch {}
    try { if (p.key.startsWith('game:')) { const tb: any = JSON.parse((await AsyncStorage.getItem('kv_pledge_tombstones')) || '{}');
      const id = p.key.slice(5); if (tb[id]) { delete tb[id]; await AsyncStorage.setItem('kv_pledge_tombstones', JSON.stringify(tb)); } } } catch {}
  }
  return Number(moved) / 1e8;
}
