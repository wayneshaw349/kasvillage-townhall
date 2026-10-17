// ============================================================================
// PAYLOAD PUBLISH — write side of the Kaspa payload rail
// ============================================================================
// Ties kaspa_payload.ts (records) to the proven sender (sendKaspaViaRest,
// which already carries `payload` through mass/sighash/txid/submit — same
// path inscribeIdentityViaRest uses in production).
//
// MODEL RECAP:
//   pledge  = the amount sent to the store address; while unspent it IS the
//             trust anchor. Spending it (withdraw) = delisting.
//   store   = deterministic child keypair of the owner:
//             storePriv = sha256(ownerPriv || 'KV-STORE-V1' || nonce)
//             -> owner always controls the pledge, recoverable from seed.
//   registry= address from sha256(tag) used as x-only pubkey; no one holds
//             its key, so announce dust is burned — that's the listing cost.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { sendKaspaViaRest } from './kaspa_rest_tx';
import { deriveAddress } from './canonical_agreement_steps';
import {
  KvKind, KvRecord, signRecord, buildPayloadHex,
  makeContentRecord, makeRegistryAnnounce, makeDelist,
  registryXOnly, getPledgeSompi,
} from './kaspa_payload';

// Announce dust: 1 KAS. Small enough to be cheap, large enough to dodge the
// storage-mass blowup tiny outputs cause (C/amount term).
export const ANNOUNCE_SOMPI = 100_000_000n;
// Keeper replays: probed on TN10 (accepted down to 0.05 KAS); 0.1 = 2x margin.
export const REPOST_SOMPI = 10_000_000n;

export interface OwnerKeys {
  privateKeyHex: string;  // owner wallet key (signs txs AND records)
  pubkeyHex: string;      // 33-byte compressed hex
  address: string;        // owner's kaspa address
  network: any;           // KaspaNetwork ('testnet-10' | 'mainnet')
}

// ---------------------------------------------------------------------------
// STORE KEY DERIVATION (deterministic child of owner key)
// ---------------------------------------------------------------------------

export function deriveStoreKeys(ownerPrivHex: string, nonce: number, network: string) {
  const priv = sha256(utf8ToBytes(ownerPrivHex + 'KV-STORE-V1' + String(nonce)));
  const privHex = bytesToHex(priv);
  const xonly = bytesToHex(schnorr.getPublicKey(priv)); // 32-byte x-only
  const address = deriveAddress(xonly, network as any);
  return { privateKeyHex: privHex, xonlyPubkeyHex: xonly, address };
}

export function registryAddress(category: string, network: string): string {
  return deriveAddress(registryXOnly(category), network as any);
}

// ---------------------------------------------------------------------------
// PUBLISH: content -> store address, amount = pledge
// ---------------------------------------------------------------------------

/**
 * Publish/update a store, dapp, game board, academic, or service record.
 * First publish: pledgeSompi = your stake (the anchor). Updates: pledge adds
 * to the live total (sum of unspent at the store address).
 */
export async function publishContent(
  owner: OwnerKeys,
  kind: KvKind,
  data: any,
  storeNonce: number,
  pledgeSompi: bigint,
) {
  const store = deriveStoreKeys(owner.privateKeyHex, storeNonce, owner.network);
  const rec = signRecord(makeContentRecord(kind, owner.pubkeyHex, data), owner.privateKeyHex);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: store.address,
    amountSompi: pledgeSompi,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Publish]', kind, '-> store', store.address.slice(0, 24), 'pledge', Number(pledgeSompi) / 1e8, 'KAS');
  return { ...res, storeAddress: store.address };
}

/** Identity rides the owner's own address: self-send, no pledge needed. */
export async function publishIdentity(owner: OwnerKeys, data: any) {
  const rec = signRecord(makeContentRecord('identity', owner.pubkeyHex, data), owner.privateKeyHex);
  return sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: owner.address,
    amountSompi: 0n, // self-send; inscription is in payload (same as inscribeIdentityViaRest)
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
}

/** KV_REPOST: replay someone else's ORIGINAL signed record to its registry.
 *  The record is untouched - its signature stays valid and its original t
 *  is preserved, so the author's newer updates and delists still win.
 *  Attribution is the tx itself: readers see the announce sender != the
 *  author's wallet and credit the keeper; tips go to that sender address. */
export async function repostRecord(keeper: OwnerKeys, record: KvRecord, kind: string = 'store') {
  const regAddr = registryAddress(String(kind), keeper.network);
  const res = await sendKaspaViaRest({
    senderAddress: keeper.address,
    recipientAddress: regAddr,
    amountSompi: REPOST_SOMPI,
    privateKeyHex: keeper.privateKeyHex,
    network: keeper.network,
    payload: buildPayloadHex(record),
  });
  console.log('[Repost]', String(((record as any).d && (record as any).d.name) || '').slice(0, 24), '-> registry', regAddr.slice(0, 24), 'by', keeper.address.slice(0, 24));
  return res;
}

/** KV_REPOST_STRIP: replay a listing's CONTENT records (store/dapp record +
 *  cfg chunks) back to its store address, signatures untouched. The 1-KAS
 *  dust per record lands at an address the AUTHOR controls - it adds to the
 *  listing's live pledge and the author can sweep it later. */
export async function repostStrip(keeper: OwnerKeys, storeAddress: string, records: KvRecord[]) {
  const out: string[] = [];
  for (const rec of records) {
    try {
      const res: any = await sendKaspaViaRest({
        senderAddress: keeper.address,
        recipientAddress: storeAddress,
        amountSompi: REPOST_SOMPI,
        privateKeyHex: keeper.privateKeyHex,
        network: keeper.network,
        payload: buildPayloadHex(rec),
      });
      if (res && res.success === false) throw new Error(String(res.error || 'send failed'));
      const _t = String((res && (res.txid || res.transactionId || res.txId)) || '');
      out.push(_t);
      console.log('[RepostStrip]', String((rec as any).k), '->', storeAddress.slice(0, 24), _t.slice(0, 16));
    } catch (e) { console.warn('[RepostStrip] record failed:', (rec as any).k, e); }
  }
  return out;
}

/** KV_BATCH_ANNOUNCE: one registry tx announces up to 4 listings -
 *  1 KAS per batch instead of per listing. Readers verify the batch
 *  signature once and expand it into one directory entry per item. */
export async function announceBatch(owner: OwnerKeys, kind: string, items: any[]) {
  const out: any[] = [];
  const regAddr = registryAddress(String(kind), owner.network);
  for (let i = 0; i < items.length; i += 4) {
    const rec = signRecord({ k: 'registry', v: 1, o: owner.pubkeyHex, t: Date.now(), d: { batch: items.slice(i, i + 4) } } as any, owner.privateKeyHex);
    const res: any = await sendKaspaViaRest({
      senderAddress: owner.address,
      recipientAddress: regAddr,
      amountSompi: ANNOUNCE_SOMPI,
      privateKeyHex: owner.privateKeyHex,
      network: owner.network,
      payload: buildPayloadHex(rec),
    });
    console.log('[AnnounceBatch]', Math.min(4, items.length - i), 'listing(s) ->', regAddr.slice(0, 24));
    out.push(res);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ANNOUNCE: registry entry (independent search feed)
// ---------------------------------------------------------------------------

export async function announceToRegistry(
  owner: OwnerKeys,
  storeAddress: string,
  name: string,
  category: string,
  kind: string = 'store', // registry is per-KIND; category is payload metadata only
  extra?: { primaryLink?: string; configHash?: string; coords?: any; dkim?: boolean; dkimDomain?: string }, // KV_DKIM_ANNOUNCE
) {
  const rec = signRecord(makeRegistryAnnounce(owner.pubkeyHex, storeAddress, name, category, extra), owner.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Announce]', name, '(', category, ') -> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}

// ---------------------------------------------------------------------------
// DELIST: payload flag now; pledge withdrawal (sweep) is the hard delist.
// ---------------------------------------------------------------------------
// REGISTRY DELIST (games and other announce-based lanes): a signed record on
// the registry naming the head. Readers hide the announce when the delist's
// signer matches the announce's signer. Pledge-independent by design.
// ---------------------------------------------------------------------------

export async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game') {
  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: owner.pubkeyHex, d: { head } } as any, owner.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Delist]', head.slice(0, 10), '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}

// ---------------------------------------------------------------------------

export async function publishDelist(owner: OwnerKeys, kind: KvKind, storeNonce: number) {
  const store = deriveStoreKeys(owner.privateKeyHex, storeNonce, owner.network);
  const rec = signRecord(makeDelist(kind, owner.pubkeyHex), owner.privateKeyHex);
  return sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: store.address,
    amountSompi: 0n,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
}

/**
 * HARD DELIST / withdraw pledge: sweep the store address back to the owner.
 * Directory readers drop the store when getPledgeSompi() hits 0.
 */
export async function withdrawPledge(owner: OwnerKeys, storeNonce: number) {
  const store = deriveStoreKeys(owner.privateKeyHex, storeNonce, owner.network);
  const live = await getPledgeSompi(store.address, owner.network);
  if (live === 0n) { console.log('[Withdraw] pledge already 0'); return null; }
  // Fee comes out of the swept amount: send slightly less than the total.
  const FEE_HEADROOM = 100_000n; // 0.001 KAS; sender's fee loop settles exact
  return sendKaspaViaRest({
    senderAddress: store.address,
    recipientAddress: owner.address,
    amountSompi: live - FEE_HEADROOM,
    privateKeyHex: store.privateKeyHex,
    network: owner.network,
  });
}

// ---------------------------------------------------------------------------
// PROBE: establish the real payload byte budget on testnet-10 (run once)
// ---------------------------------------------------------------------------

export async function probePayloadLimit(owner: OwnerKeys, sizes: number[] = [500, 1000, 2000, 5000]) {
  const results: Array<{ size: number; ok: boolean; txid?: string; error?: string }> = [];
  for (const size of sizes) {
    const filler = 'A'.repeat(size);
    const rec = signRecord(makeContentRecord('store', owner.pubkeyHex, { probe: filler }), owner.privateKeyHex);
    let hex = '';
    try { hex = bytesToHex(utf8ToBytes('KVP1' + JSON.stringify(rec))); } catch (e: any) {
      results.push({ size, ok: false, error: 'encode: ' + e.message }); continue;
    }
    try {
      const r: any = await sendKaspaViaRest({
        senderAddress: owner.address,
        recipientAddress: owner.address,
        amountSompi: 0n,
        privateKeyHex: owner.privateKeyHex,
        network: owner.network,
        payload: hex,
      });
      results.push({ size, ok: !!(r && (r.txId || r.txid || r.success)), txid: r?.txId || r?.txid, error: r?.error ? String(r.error) : undefined });
    } catch (e: any) {
      results.push({ size, ok: false, error: String(e?.message || e) });
    }
    const _last = results[results.length - 1];
    console.log('[Probe]', size, 'B ->', _last.ok ? 'ACCEPTED' : 'REJECTED', _last.error ? '| err: ' + _last.error : '', _last.txid ? '| tx: ' + _last.txid : '');
    await new Promise(r => setTimeout(r, 5000)); // let the UTXO set settle before the next size
  }
  console.log('[Probe] summary:', JSON.stringify(results.map(r => ({ size: r.size, ok: r.ok }))));
  return results;
}
