// kv_archive.ts — read records that pruned off the public API from archive operators.
// Every answer is self-verifying: the returned transaction must hash to the txid we
// asked for (computeTxId), so an operator can't fake or alter a payload.
// Only operators that passed TownHall's audit are asked; verified answers are cached
// on the phone forever (a txid's content never changes).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeTxId } from './kaspa_rest_tx';

const n = (x: any): number => Number(typeof x === 'string' ? x : x ?? NaN);

/** kaspa-rest-server tx JSON -> txid (v0, lock 0, gas 0, sequence 0 — KasVillage txs). */
export function restTxId(j: any): string | null {
  try {
    const ins = [...(j.inputs || [])].sort((a: any, b: any) => n(a.index) - n(b.index));
    const outs = [...(j.outputs || [])].sort((a: any, b: any) => n(a.index) - n(b.index));
    return computeTxId({
      version: 0,
      inputs: ins.map((i: any) => ({ prevTxId: String(i.previous_outpoint_hash), prevIndex: n(i.previous_outpoint_index), sequence: 0n })),
      outputs: outs.map((o: any) => ({ amount: BigInt(String(o.amount)), scriptVersion: 0, scriptHex: String(o.script_public_key) })),
      lockTime: 0n,
      subnetworkId: String(j.subnetwork_id || '0'.repeat(40)),
      gas: 0n,
      payloadHex: String(j.payload || ''),
    });
  } catch { return null; }
}

/** fetch with an abort that covers the BODY too (a trickling body can't stall us). */
async function getJsonT(url: string, ms: number): Promise<any> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return await r.json(); } finally { clearTimeout(t); }
}

/** Fetch txid from one base URL; returns the tx JSON only if it hashes to txid. */
export async function fetchVerifiedTx(base: string, txid: string): Promise<any | null> {
  if (!/^[0-9a-f]{64}$/.test(txid) || !/^https:\/\//.test(base)) return null;
  try {
    const j: any = await getJsonT(base.replace(/\/+$/, '') + '/transactions/' + txid + '?inputs=true&outputs=true&resolve_previous_outpoints=no', 6000);
    return j && restTxId(j) === txid ? j : null;
  } catch { return null; }
}

let _ops: { net: string; at: number; apis: string[] } | null = null;
async function passingOperators(net: string): Promise<string[]> {
  if (_ops && _ops.net === net && Date.now() - _ops.at < 600000) return _ops.apis;
  let apis: string[] = [];
  try { apis = (await Promise.race([require('./node_registry').fetchAudit(net), new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 5000))]) as any[]).filter((x: any) => x.audited && x.pass && x.api).map((x: any) => String(x.api)); } catch {}
  _ops = { net, at: Date.now(), apis };
  return apis;
}

// Misses persist (retry hourly) so a cold start doesn't re-pay for records nobody holds.
const MISS_KEY = 'kv_arch_miss_v1';
let _miss: Map<string, number> | null = null;
async function misses(): Promise<Map<string, number>> {
  if (_miss) return _miss;
  try { _miss = new Map(JSON.parse((await AsyncStorage.getItem(MISS_KEY)) || '[]')); } catch { _miss = new Map(); }
  return _miss!;
}
const saveMisses = () => { try { const m = Array.from((_miss || new Map()).entries()).filter(([, t]) => Date.now() - t < 3600000).slice(-2000); AsyncStorage.setItem(MISS_KEY, JSON.stringify(m)); } catch {} };

/** Verified tx from cache, else from audited operators (raced in parallel). The
 *  operator's block_time is NOT hashed, so it is never used: `blockTime` comes from the
 *  public UTXO's DAA score (caller-supplied). Only decodable KVP1 payloads are cached. */
export async function archiveTx(txid: string, net: string, blockTime = 0): Promise<any | null> {
  const ck = 'kv_arch_tx_' + txid;
  try { const c = await AsyncStorage.getItem(ck); if (c) return JSON.parse(c); } catch {}
  const mm = await misses();
  if (Date.now() - (mm.get(txid) || 0) < 3600000) return null;
  const ops = await passingOperators(net);
  let j: any = null;
  if (ops.length) {
    try { j = await (Promise as any).any(ops.slice(0, 5).map((api) => fetchVerifiedTx(api, txid).then((x) => x || Promise.reject(new Error('no'))))); } catch { j = null; }
  }
  if (j && typeof j.payload === 'string' && /^4b565031/i.test(j.payload)) { // 'KVP1'
    const keep = { transaction_id: txid, payload: j.payload, block_time: blockTime };
    try { await AsyncStorage.setItem(ck, JSON.stringify(keep)); } catch {}
    return keep;
  }
  mm.set(txid, Date.now()); saveMisses();
  return null;
}

/** Records at `address` the public API no longer returns: walk the surviving UTXOs
 *  (pledges, registry dust), skip txids we already have, fetch the rest from archives.
 *  One overall deadline so a slow operator can never stall the Mailbox. */
export async function archiveRecordsAt(address: string, net: string, haveTxids: Set<string>, max = 12, deadlineMs = 6000): Promise<Array<{ txid: string; payload: string; block_time: number }>> {
  const t0 = Date.now();
  if (!(await passingOperators(net)).length) return [];
  const base = require('./kaspa_payload').apiBase(net);
  let utxos: any[] = []; let vdaa = 0;
  try {
    const [u, d] = await Promise.all([getJsonT(base + '/addresses/' + encodeURIComponent(address) + '/utxos', 5000), getJsonT(base + '/info/blockdag', 5000).catch(() => ({}))]);
    utxos = Array.isArray(u) ? u : []; vdaa = n(d && d.virtualDaaScore) || 0;
  } catch { return []; }
  // Public, consensus-derived time: now minus (virtual DAA - coin DAA) at 10 BPS.
  const daaTime = (daa: number) => (vdaa && daa ? Date.now() - Math.max(0, vdaa - daa) * 100 : 0);
  const byId = new Map<string, number>();
  for (const u of utxos) { const id = String(u?.outpoint?.transactionId || ''); const d = n(u?.utxoEntry?.blockDaaScore) || 0; if (/^[0-9a-f]{64}$/.test(id) && !haveTxids.has(id)) byId.set(id, Math.max(byId.get(id) || 0, d)); }
  const ids = Array.from(byId.keys()).sort((a, b) => (byId.get(b) || 0) - (byId.get(a) || 0)).slice(0, 600);
  // Cached records are free and always included (delists/flags must never age out of
  // view); only `max` uncached ids per call go to the network, until the deadline.
  const out: Array<{ txid: string; payload: string; block_time: number }> = [];
  const todo: string[] = [];
  for (const id of ids) {
    let t: any = null;
    try { const c = await AsyncStorage.getItem('kv_arch_tx_' + id); if (c) t = JSON.parse(c); } catch {}
    if (t && t.payload) out.push({ txid: id, payload: t.payload, block_time: daaTime(byId.get(id) || 0) });
    else if (todo.length < max) todo.push(id);
  }
  const mm = await misses();
  const fresh = todo.filter((id) => Date.now() - (mm.get(id) || 0) >= 3600000);
  for (let i = 0; i < fresh.length && Date.now() - t0 < deadlineMs; i += 4) {
    const got = await Promise.all(fresh.slice(i, i + 4).map((id) => archiveTx(id, net, daaTime(byId.get(id) || 0))));
    got.forEach((t, k) => { if (t && t.payload) out.push({ txid: fresh[i + k], payload: t.payload, block_time: daaTime(byId.get(fresh[i + k]) || 0) }); });
  }
  return out;
}
