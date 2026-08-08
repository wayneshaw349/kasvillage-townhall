// kaspa_inscribe.ts — durable inscription in Kaspa tx payload (replaces paid Arweave)
// Self-send tx, amount 0 (all back to self minus fee), blob in payload. L1 = source of truth.
import { sendKaspaViaRest } from './kaspa_rest_tx';
import { gzipSync, gunzipSync } from 'fflate';

const API_BASES: Record<string, string> = {
  'mainnet': 'https://api.kaspa.org',
  'testnet-10': 'https://api-tn10.kaspa.org',
};

const MARKER = 'KV1|'; // ascii prefix inside payload; retrieval filters on this

function utf8ToHex(s: string): string {
  const b = new TextEncoder().encode(s);
  let h = ''; for (const x of b) h += x.toString(16).padStart(2, '0'); return h;
}
function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  let h = ''; for (const x of b) h += x.toString(16).padStart(2, '0'); return h;
}
function b64FromBytes(b: Uint8Array): string {
  let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s);
}
function bytesFromB64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}

/**
 * Inscribe an arbitrary JSON/string blob into a self-send tx payload.
 * Header (ascii): KV1|<type>|<agrId>|  then gzipped-base64 body.
 * Own money to own address, so callers can fire non-blocking.
 */
export async function inscribeOnKaspa(params: {
  address: string; privateKeyHex: string; network: 'mainnet' | 'testnet-10';
  kvType: string; agrId: string; body: string;
}): Promise<{ success: boolean; txId?: string; error?: string; bytes?: number }> {
  try {
    const gz = gzipSync(new TextEncoder().encode(params.body));
    const header = MARKER + params.kvType + '|' + params.agrId + '|';
    const payloadStr = header + b64FromBytes(gz);
    const payloadHex = utf8ToHex(payloadStr);
    if (payloadHex.length / 2 > 24000) {
      return { success: false, error: 'payload too large (' + (payloadHex.length / 2) + ' bytes)' };
    }
    console.log('[KV-Inscribe]', params.kvType, params.agrId.slice(0, 12), '—', (payloadHex.length / 2), 'bytes (gz)');
    const r = await sendKaspaViaRest({
      senderAddress: params.address,
      recipientAddress: params.address,
      amountSompi: 0n,           // all back to self minus fee
      privateKeyHex: params.privateKeyHex,
      network: params.network,
      payload: payloadHex,
    });
    if (!r.success) { console.warn('[KV-Inscribe] send failed:', r.error); return { success: false, error: r.error }; }
    console.log('[KV-Inscribe] txid:', r.txId);
    return { success: true, txId: r.txId, bytes: payloadHex.length / 2 };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Retrieve all KV1 inscriptions for an address, newest first.
 * Optionally filter by kvType and/or agrId. Decodes gzip body back to string.
 */
export async function fetchInscriptions(params: {
  address: string; network: 'mainnet' | 'testnet-10';
  kvType?: string; agrId?: string; limit?: number;
}): Promise<Array<{ txId: string; kvType: string; agrId: string; body: string; blockDaaScore?: number }>> {
  const base = API_BASES[params.network] || API_BASES['testnet-10'];
  const limit = params.limit || 100;
  const url = base + '/addresses/' + params.address + '/full-transactions?limit=' + limit + '&resolve_previous_outpoints=no';
  const out: Array<{ txId: string; kvType: string; agrId: string; body: string; blockDaaScore?: number }> = [];
  try {
    const resp = await fetch(url);
    if (!resp.ok) { console.warn('[KV-Inscribe] fetch failed:', resp.status); return out; }
    const txs = await resp.json();
    if (!Array.isArray(txs)) return out;
    for (const tx of txs) {
      const pHex: string = tx.payload || '';
      if (!pHex) continue;
      let pStr: string;
      try { pStr = new TextDecoder().decode(hexToBytes(pHex)); } catch { continue; }
      if (!pStr.startsWith(MARKER)) continue;
      const parts = pStr.split('|'); // KV1, type, agrId, b64body
      if (parts.length < 4) continue;
      const kvType = parts[1]; const agrId = parts[2];
      const b64 = parts.slice(3).join('|');
      if (params.kvType && kvType !== params.kvType) continue;
      if (params.agrId && agrId !== params.agrId) continue;
      let body = '';
      try { body = new TextDecoder().decode(gunzipSync(bytesFromB64(b64))); }
      catch { try { body = atob(b64); } catch { continue; } }
      out.push({ txId: tx.transaction_id || tx.transactionId || '', kvType, agrId, body,
                 blockDaaScore: Number(tx.block_daa_score || tx.accepting_block_daa_score || 0) });
    }
  } catch (e) { console.warn('[KV-Inscribe] fetch threw:', e); }
  out.sort((a, b) => (b.blockDaaScore || 0) - (a.blockDaaScore || 0));
  return out;
}
