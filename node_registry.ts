// node_registry.ts — KasVillage operator registry (app side), on the pledge rail.
//
// registerNode():
//   1. publishContent: 10 KAS bond -> your own derived pledge address (nonce NODE_NONCE)
//      carrying a signed KVP1 'node' record. Reclaimable in My Pledges.
//   2. 1 KAS signed announce -> registryAddress('node', net) with svc/api/payout.
//   Active operator = pledge address holds >= 10 KAS funded from your own wallet.
//   Deregister = reclaim the pledge (My Pledges). No main-wallet coin is ever "the bond".
//
// fetchRegistry()/fetchAudit(): TownHall rebuilds both from chain every call/sweep
//   (?network=), so an ephemeral relay loses nothing.
// tipOperators(): one plain send per passing operator.

import * as SecureStore from 'expo-secure-store';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sendKaspaViaRest, KaspaNetwork } from './kaspa_rest_tx';
import { publishContent, registryAddress, OwnerKeys } from './payload_publish';
import { signRecord, buildPayloadHex } from './kaspa_payload';

const TOWNHALL_BASE = 'https://kasvillage.app.runonflux.io';
export const NODE_NONCE = 5;                   // pledge slot (store 0, dapp 1, academics 7000+, games 2M+)
export const NODE_BOND_SOMPI = 1_000_000_000n; // 10 KAS
export const ANNOUNCE_SOMPI = 100_000_000n;    // 1 KAS
const MIN_TIP_SOMPI = 20_000_000n;             // 0.2 KAS floor (KIP-9 storage mass)

const NET = (): KaspaNetwork => require('./kv_net').KV_NET as KaspaNetwork;
export const nodeRegistryAddress = (net: string = NET()) => registryAddress('node', net);

export interface NodeRegistryEntry {
  txid: string;
  svc: 'index' | 'archive';
  api: string;
  payout: string;
  net: string;
  bond_address: string;
  bond_amount: number;
  bond_unspent: boolean;
}

export interface NodeAuditEntry {
  payout: string;
  svc?: string;
  api?: string;
  challenge_txid?: string;
  audited: boolean;
  pass?: boolean;
  bond_unspent?: boolean;
  reason?: string;
}

async function ownerKeys(): Promise<OwnerKeys> {
  const { _kvResolvePrivHex } = require('./proposal_share');
  const priv: string | null = await _kvResolvePrivHex();
  const address = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
  if (!priv || !address) throw new Error('wallet keys unavailable');
  return { privateKeyHex: priv, pubkeyHex: bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true)), address, network: NET() as any };
}

export async function registerNode(params: {
  svc: 'index' | 'archive';
  apiBaseUrl: string;
}): Promise<{ success: boolean; txid?: string; bondAddress?: string; error?: string }> {
  try {
    const o = await ownerKeys();
    const net = o.network;
    const d = { svc: params.svc, api: params.apiBaseUrl.replace(/\/+$/, ''), payout: o.address, net };
    console.log('[NodeReg] bond', d.svc, d.api, net);
    const bond: any = await publishContent(o, 'service', { node: d }, NODE_NONCE, NODE_BOND_SOMPI);
    if (!bond || !bond.success) return { success: false, error: 'bond: ' + (bond?.error || 'send failed') };
    const rec = signRecord({ k: 'registry', v: 1, o: o.pubkeyHex, t: Date.now(),
      d: { storeAddress: bond.storeAddress, name: 'operator', category: 'node', ...d } }, o.privateKeyHex);
    const ann: any = await sendKaspaViaRest({
      senderAddress: o.address, recipientAddress: nodeRegistryAddress(net), amountSompi: ANNOUNCE_SOMPI,
      privateKeyHex: o.privateKeyHex, network: net as any, payload: buildPayloadHex(rec),
    });
    if (!ann || !ann.success) return { success: false, bondAddress: bond.storeAddress, error: 'announce: ' + (ann?.error || 'send failed') + ' (bond is safe in My Pledges)' };
    try { await SecureStore.setItemAsync('kv_node_registered', JSON.stringify({ net, svc: d.svc, api: d.api, at: Date.now() })); } catch {}
    return { success: true, txid: ann.txId, bondAddress: bond.storeAddress };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function fetchRegistry(net: string = NET()): Promise<NodeRegistryEntry[]> {
  const r = await fetch(TOWNHALL_BASE + '/api/nodes/registry?network=' + net);
  if (!r.ok) throw new Error('registry fetch ' + r.status);
  const j = await r.json();
  return (j.nodes || []) as NodeRegistryEntry[];
}

export async function fetchAudit(net: string = NET()): Promise<NodeAuditEntry[]> {
  const r = await fetch(TOWNHALL_BASE + '/api/nodes/audit?network=' + net);
  if (!r.ok) throw new Error('audit fetch ' + r.status);
  const j = await r.json();
  return (j.nodes || []) as NodeAuditEntry[];
}

// Phone re-checks everything the relay claims, from public data only:
//  - api + payout must come from a SIGNED node announce on the registry (not the relay);
//  - the challenge must be a registry coin older than ~30h (only an archive holds it);
//  - the operator's tx for it must hash to that txid and carry a payload.
interface TipCtx { signed: Set<string>; aged: Set<string>; }
async function tipContext(net: string): Promise<TipCtx> {
  const { fetchRecords, verifyRecord, apiBase } = require('./kaspa_payload');
  const signed = new Set<string>();
  try {
    for (const r of await fetchRecords(nodeRegistryAddress(net), net, 100, 3)) {
      const rec: any = r.record;
      if (rec && rec.k === 'registry' && rec.d && rec.d.category === 'node' && verifyRecord(rec)) signed.add(String(rec.d.payout) + '|' + String(rec.d.api).replace(/\/+$/, ''));
    }
  } catch {}
  const aged = new Set<string>();
  try {
    const base = apiBase(net);
    const vdaa = Number((await (await fetch(base + '/info/blockdag')).json()).virtualDaaScore || 0);
    for (const kind of ['store', 'dapp', 'game', 'node']) {
      const u: any[] = (await (await fetch(base + '/addresses/' + encodeURIComponent(registryAddress(kind, net)) + '/utxos')).json()) || [];
      for (const c of u) if (vdaa && vdaa - Number(c?.utxoEntry?.blockDaaScore || vdaa) >= 1_100_000) aged.add(String(c?.outpoint?.transactionId || ''));
    }
  } catch {}
  return { signed, aged };
}
async function phoneRecheck(ctx: TipCtx, n: NodeAuditEntry): Promise<boolean> {
  const api = String(n.api || '').replace(/\/+$/, ''); const id = String(n.challenge_txid || '');
  if (!ctx.signed.has(String(n.payout) + '|' + api) || !ctx.aged.has(id)) return false;
  const j = await require('./kv_archive').fetchVerifiedTx(api, id);
  return !!(j && j.payload);
}

export async function tipOperators(params: {
  totalSompi: bigint;
}): Promise<{ success: boolean; txid?: string; paid?: number; error?: string }> {
  try {
    const o = await ownerKeys();
    const audit = await fetchAudit(o.network);
    const passing = audit.filter((n) => n.audited && n.pass && n.payout && n.payout !== o.address);
    if (passing.length === 0) return { success: false, error: 'no passing operators to tip' };
    const per = params.totalSompi / BigInt(passing.length);
    if (per < MIN_TIP_SOMPI) return { success: false, error: 'tip too small: < 0.2 KAS per operator across ' + passing.length + ' operators' };
    let paid = 0; let last = ''; const errs: string[] = [];
    const ctx = await tipContext(o.network);
    for (const n of passing) {
      if (!(await phoneRecheck(ctx, n))) { errs.push('skipped ' + n.payout.slice(0, 18) + '… (failed phone re-check)'); continue; }
      const r: any = await sendKaspaViaRest({ senderAddress: o.address, recipientAddress: n.payout, amountSompi: per, privateKeyHex: o.privateKeyHex, network: o.network as any });
      if (r && r.success) { paid++; last = r.txId; } else errs.push(String(r?.error || 'failed'));
      await new Promise((res) => setTimeout(res, 1500)); // let change settle between sends
    }
    if (!paid) return { success: false, error: errs[0] || 'tip failed' };
    return { success: true, txid: last, paid, error: errs.length ? errs.length + ' tip(s) failed' : undefined };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}
