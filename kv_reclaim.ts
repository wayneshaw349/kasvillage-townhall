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
  const nonces: number[] = []; let s = 0n;
  for (let i = 0; i < 90; i++) { const n = base + i; const b = await balanceAt(priv, n); if (b > 0n) { s += b; nonces.push(n); } }
  if (s === 0n) return null;
  return { key: 'game:' + clean, kind: 'game', label: 'Game: ' + clean + ' (recovered)', nonces, sompi: s, note: NOTE_GAME };
}

export async function listMyPledges(): Promise<MyPledge[]> {
  const o = await owner(); const priv = o.privateKeyHex;
  const out: MyPledge[] = [];
  const add = async (key: string, kind: PledgeKind, label: string, nonces: number[], note: string) => {
    let s = 0n; for (const n of nonces) s += await balanceAt(priv, n);
    if (s > 0n) out.push({ key, kind, label, nonces, sompi: s, note });
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
  return out;
}

// Sweeps every coin at the pledge address(es) back to your wallet. Returns KAS reclaimed (before fees).
// KV_SWEEP_BATCH: a game pledge sits in hundreds of chunk coins, so each sweep tx is capped by mass
// and we loop until the address is empty, waiting between batches for the mempool to settle.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function reclaimPledge(p: MyPledge): Promise<number> {
  const o = await owner();
  const { withdrawPledge } = require('./payload_publish');
  let moved = 0n;
  for (const n of p.nonces) {
    let retries = 0;
    for (let batch = 0; batch < 25; batch++) {
      const b = await balanceAt(o.privateKeyHex, n); if (b === 0n) break;
      const r: any = await withdrawPledge(o, n);
      if (r === null) break; // already 0
      if (r && r.success === false) {
        const e = String(r.error || 'sweep failed');
        if (/already spent|mempool|orphan|no utxos/i.test(e) && retries < 8) { retries++; await sleep(6000); continue; } // KV_SWEEP_LAG: UTXO view trails mid-confirmation
        throw new Error(e + ' (after ' + (Number(moved) / 1e8) + ' KAS)');
      }
      const after = await (async () => { await sleep(4000); return balanceAt(o.privateKeyHex, n); })();
      moved += b - after;
      if (after === 0n) break;
    }
  }
  return Number(moved) / 1e8;
}
