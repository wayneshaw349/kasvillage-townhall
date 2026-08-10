// node_registry.ts — KasVillage Archival/Indexer Registry (app side)
//
// registerNode(): operator sends bonded KVP1 node record
//   output 0 = bond (to operator's own address; unspent = active)
//   output 1 = 1 KAS announce to NODE_REGISTRY_ADDRESS (discovery)
//   payload  = KVP1{"k":"node","svc","api","payout","net":"tn10"}
//
// fetchRegistry()/fetchAudit(): query TownHall's scan + proof-of-storage audit
// tipOperators(): one tx, one output per passing operator — user-funded tips
//   (e.g. offered after a store publish/update).
//
// Rides the proven payload rail: sendKaspaViaRest -> payload sighash -> relay.

import * as SecureStore from 'expo-secure-store';
import { sendKaspaViaRest, KaspaNetwork } from './kaspa_rest_tx';

// Derived, not chosen: sha256("KV-REGISTRY-V1-node") as x-only -> bech32m.
// Nobody holds the key; announce dust burns here. Must equal payload_publish's
// registryAddress('node', net) � asserted at import below.
export const NODE_REGISTRY_ADDRESS = 'kaspatest:qp35q2e5maacw03gyuh5pdr389y92nxp4dttxlr728pf0xcxytxd7nspt3z2k';
try {
  const { registryAddress } = require('./payload_publish');
  const _derived = registryAddress('node', 'testnet-10');
  if (_derived !== NODE_REGISTRY_ADDRESS) {
    console.error('[NodeRegistry] ADDRESS MISMATCH � const:', NODE_REGISTRY_ADDRESS, 'derived:', _derived);
    throw new Error('NODE_REGISTRY_ADDRESS does not match registryAddress("node")');
  }
  console.log('[NodeRegistry] address verified:', NODE_REGISTRY_ADDRESS);
} catch (e) { console.error('[NodeRegistry] address assertion failed:', e); throw e; }
const TOWNHALL_BASE = 'https://kasvillage.app.runonflux.io';
export const NODE_BOND_SOMPI = 1_000_000_000n; // 10 KAS
export const ANNOUNCE_SOMPI = 100_000_000n;    // 1 KAS
const MIN_TIP_SOMPI = 10_000_000n;             // 0.1 KAS floor per operator

export interface NodeRegistryEntry {
  txid: string;
  svc: 'index' | 'relay' | 'archive';
  api: string;
  payout: string;
  net: string;
  bond_outpoint: string;
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

// ---------------------------------------------------------------------------
// Operator: register this device's node
// ---------------------------------------------------------------------------
export async function registerNode(params: {
  svc: 'index' | 'relay' | 'archive';
  apiBaseUrl: string;
  network?: KaspaNetwork;
}): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    const network = params.network || 'testnet-10';
    const address = (await SecureStore.getItemAsync('kv_kaspa_address'))
      || (await SecureStore.getItemAsync('kaspa_address')) || '';
    const privateKeyHex = (await SecureStore.getItemAsync('kv_private_key')) || '';
    if (!address || !privateKeyHex) return { success: false, error: 'wallet keys unavailable' };

    const record = {
      k: 'node',
      svc: params.svc,
      api: params.apiBaseUrl.replace(/\/+$/, ''),
      payout: address,
      net: 'tn10',
      v: 1,
    };
    const payloadHex = Array.from(new TextEncoder().encode('KVP1' + JSON.stringify(record)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    console.log('[NodeReg] registering', record.svc, record.api);
    const res = await sendKaspaViaRest({
      fromAddress: address,
      privateKeyHex,
      network,
      payloadHex,
      outputs: [
        { address, amountSompi: NODE_BOND_SOMPI },                       // 0: bond to self
        { address: NODE_REGISTRY_ADDRESS, amountSompi: ANNOUNCE_SOMPI }, // 1: announce
      ],
    } as any);
    if (!res.success) return { success: false, error: res.error };
    console.log('[NodeReg] registered — bond outpoint', res.transactionId + ':0');
    return { success: true, txid: res.transactionId };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

// Deregister = spend the bond back to yourself (plain send consuming txid:0).
// The wallet's normal send flow covers this; no special tx needed.

// ---------------------------------------------------------------------------
// Anyone: query registry + audits via TownHall
// ---------------------------------------------------------------------------
export async function fetchRegistry(): Promise<NodeRegistryEntry[]> {
  const r = await fetch(TOWNHALL_BASE + '/api/nodes/registry');
  if (!r.ok) throw new Error('registry fetch ' + r.status);
  const j = await r.json();
  return (j.nodes || []) as NodeRegistryEntry[];
}

export async function fetchAudit(): Promise<NodeAuditEntry[]> {
  const r = await fetch(TOWNHALL_BASE + '/api/nodes/audit');
  if (!r.ok) throw new Error('audit fetch ' + r.status);
  const j = await r.json();
  return (j.nodes || []) as NodeAuditEntry[];
}

// ---------------------------------------------------------------------------
// User: tip passing operators (one tx, one output per operator)
// ---------------------------------------------------------------------------
export async function tipOperators(params: {
  totalSompi: bigint;
  network?: KaspaNetwork;
}): Promise<{ success: boolean; txid?: string; paid?: number; error?: string }> {
  try {
    const network = params.network || 'testnet-10';
    const address = (await SecureStore.getItemAsync('kv_kaspa_address'))
      || (await SecureStore.getItemAsync('kaspa_address')) || '';
    const privateKeyHex = (await SecureStore.getItemAsync('kv_private_key')) || '';
    if (!address || !privateKeyHex) return { success: false, error: 'wallet keys unavailable' };

    const audit = await fetchAudit();
    const passing = audit.filter((n) => n.audited && n.pass && n.payout && n.payout !== address);
    if (passing.length === 0) return { success: false, error: 'no passing operators to tip' };

    const per = params.totalSompi / BigInt(passing.length);
    if (per < MIN_TIP_SOMPI) {
      return { success: false, error: 'tip too small: < 0.1 KAS per operator across ' + passing.length + ' operators' };
    }

    console.log('[NodeTip] tipping', passing.length, 'operators,', per.toString(), 'sompi each');
    const res = await sendKaspaViaRest({
      fromAddress: address,
      privateKeyHex,
      network,
      outputs: passing.map((n) => ({ address: n.payout, amountSompi: per })),
    } as any);
    if (!res.success) return { success: false, error: res.error };
    return { success: true, txid: res.transactionId, paid: passing.length };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}
