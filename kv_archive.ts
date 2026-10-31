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

/** Fetch txid from one base URL; returns the tx JSON only if it hashes to txid. */
export async function fetchVerifiedTx(base: string, txid: string): Promise<any | null> {
  if (!/^[0-9a-f]{64}$/.test(txid) || !/^https:\/\//.test(base)) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(base.replace(/\/+$/, '') + '/transactions/' + txid + '?inputs=true&outputs=true&resolve_previous_outpoints=no', { signal: ctl.signal });
    clearTimeout(t);
    const j: any = await r.json();
    return j && restTxId(j) === txid ? j : null;
  } catch { return null; }
}

let _ops: { net: string; at: number; apis: string[] } | null = null;
async function passingOperators(net: string): Promise<string[]> {
  if (_ops && _ops.net === net && Date.now() - _ops.at < 600000) return _ops.apis;
  let apis: string[] = [];
  try { apis = (await require('./node_registry').fetchAudit(net)).filter((x: any) => x.audited && x.pass && x.api).map((x: any) => String(x.api)); } catch {}
  _ops = { net, at: Date.now(), apis };
  return apis;
}

/** Verified tx from cache, else from audited operators. null if nobody holds it. */
const _miss = new Map<string, number>(); // txid -> last miss (retry hourly, keeps lists fast)
export async function archiveTx(txid: string, net: string): Promise<any | null> {
  const ck = 'kv_arch_tx_' + txid;
  try { const c = await AsyncStorage.getItem(ck); if (c) return JSON.parse(c); } catch {}
  if (Date.now() - (_miss.get(txid) || 0) < 3600000) return null;
  for (const api of await passingOperators(net)) {
    const j = await fetchVerifiedTx(api, txid);
    if (j) {
      const keep = { transaction_id: txid, payload: j.payload, block_time: n(j.block_time) || 0 };
      try { await AsyncStorage.setItem(ck, JSON.stringify(keep)); } catch {}
      return keep;
    }
  }
  _miss.set(txid, Date.now());
  return null;
}

/** Records at `address` the public API no longer returns: walk the surviving UTXOs
 *  (pledges, registry dust), skip txids we already have, fetch the rest from archives. */
export async function archiveRecordsAt(address: string, net: string, haveTxids: Set<string>, max = 30): Promise<Array<{ txid: string; payload: string; block_time: number }>> {
  if (!(await passingOperators(net)).length) return [];
  let utxos: any[] = [];
  try { utxos = (await (await fetch(require('./kaspa_payload').apiBase(net) + '/addresses/' + encodeURIComponent(address) + '/utxos')).json()) || []; } catch { return []; }
  const ids = Array.from(new Set(utxos
    .sort((a: any, b: any) => n(b?.utxoEntry?.blockDaaScore) - n(a?.utxoEntry?.blockDaaScore))
    .map((u: any) => String(u?.outpoint?.transactionId || ''))
    .filter((id: string) => /^[0-9a-f]{64}$/.test(id) && !haveTxids.has(id)))).slice(0, max);
  const out: Array<{ txid: string; payload: string; block_time: number }> = [];
  for (const id of ids) { const t = await archiveTx(id, net); if (t && t.payload) out.push({ txid: id, payload: t.payload, block_time: t.block_time }); }
  return out;
}
