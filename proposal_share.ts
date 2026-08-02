// proposal_share.ts — KasVillage Signed Proposal via Text/DM
// Ephemeral signature on proposal → share via any channel → verify on receive
// Two exchanges = complete agreement

import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { Share, Alert } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { canSpend, allocateForIOU, releaseIOU, getBalanceBreakdown, isAlreadyCommitted } from './utxo_ledger';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface TradeProposal {
  v: 1;                          // version
  type: 'pay' | 'trade' | 'iou'; // proposal type
  from: string;                   // sender pubkey (hex, first 32 chars)
  fromAddr: string;               // sender kaspa address
  fromName: string;               // sender avatar name
  fromAPT: string;                // sender APT number
  to?: string;                    // recipient pubkey if known
  amount: string;                 // amount in sompi (string for bigint compat)
  desc: string;                   // description
  net: string;                    // network (testnet-10, mainnet)
  ts: number;                     // timestamp
  nonce: string;                  // random nonce (prevents replay)
  sig: string;                    // secp256k1 signature over all fields above
}

export interface CounterSignedProposal {
  proposal: TradeProposal;
  counterSig: string;             // recipient's signature over the proposal
  counterPubkey: string;          // recipient's pubkey
  counterAddr: string;            // recipient's address
  counterName: string;            // recipient's name
  counterAPT: string;             // recipient's APT
  acceptedAt: number;             // timestamp of acceptance
}

export interface StoredAgreement {
  id: string;
  proposal: TradeProposal;
  counterSig?: string;
  counterPubkey?: string;
  counterAddr?: string;
  status: 'proposed' | 'accepted' | 'settled' | 'expired';
  createdAt: number;
  settledTxId?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateNonce(): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToHex(bytes);
}

function deriveAPT(pubkey: string): string {
  if (!pubkey || pubkey.length < 10) return 'APT-000';
  return `APT-${parseInt(pubkey.slice(2, 9), 16) % 10000000}`;
}

// Canonical hash of proposal (excludes sig field)
function hashProposal(p: Omit<TradeProposal, 'sig'> | TradeProposal): Uint8Array {
  const canonical = JSON.stringify({
    v: p.v, type: p.type, from: p.from, fromAddr: p.fromAddr,
    fromName: p.fromName, fromAPT: p.fromAPT, to: p.to || '',
    amount: p.amount, desc: p.desc, net: p.net, ts: p.ts, nonce: p.nonce,
  });
  return sha256(new TextEncoder().encode('KV_PROPOSAL_V1:' + canonical));
}

// Hash for counter-signature (signs over the entire proposal including original sig)
function hashCounterSign(proposal: TradeProposal): Uint8Array {
  const canonical = JSON.stringify({
    proposalSig: proposal.sig,
    amount: proposal.amount,
    from: proposal.from,
    ts: proposal.ts,
    nonce: proposal.nonce,
  });
  return sha256(new TextEncoder().encode('KV_COUNTERSIGN_V1:' + canonical));
}

// ============================================================================
// WALLET ACCESS
// ============================================================================

async function _kvResolvePrivHex(): Promise<string | null> {
  const isHex = (v: string | null): v is string => !!v && /^[0-9a-fA-F]{64}$/.test(v.trim());
  // 1) plain-hex candidates
  for (const k of ['kv_private_key', 'kasvillage_private_key', 'kv_l1_privkey']) {
    const v = await SecureStore.getItemAsync(k);
    if (isHex(v)) { console.log('[KVKey] using plain key:', k); return v.trim(); }
  }
  // 2) encrypted envelope (JSON { privateKeyEnc }) XOR scheme from avatar_arweave_upload
  try {
    const env = await SecureStore.getItemAsync('kv_l1_privkey_enc');
    const deviceKey = await SecureStore.getItemAsync('device_encryption_key');
    if (env && deviceKey) {
      const stored = JSON.parse(env) as { privateKeyEnc: string };
      const encHex = stored.privateKeyEnc;
      const Crypto = require('expo-crypto');
      const keyStream = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, deviceKey + encHex);
      const out: string[] = [];
      for (let i = 0; i < 64; i += 2) {
        const eb = parseInt(encHex.slice(i, i + 2), 16);
        const kb = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
        out.push((eb ^ kb).toString(16).padStart(2, '0'));
      }
      const hex = out.join('');
      if (isHex(hex)) { console.log('[KVKey] using decrypted envelope'); return hex; }
    }
  } catch (e) { console.warn('[KVKey] envelope decrypt failed:', e); }
  console.warn('[KVKey] no valid private key found');
  return null;
}
async function getMyCredentials(): Promise<{
  pubkey: string; address: string; privkey: string; name: string; apt: string; network: string;
} | null> {
  const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey') ||
                 await SecureStore.getItemAsync('kaspa_pubkey') ||
                 await SecureStore.getItemAsync('kv_public_key') || '';
  const address = await SecureStore.getItemAsync('kaspa_address') || '';
  const privkey = (await _kvResolvePrivHex()) || '';
  const network = await SecureStore.getItemAsync('kv_network') || 'testnet-10';

  if (!pubkey || !address || !privkey) return null;

  let name = 'Villager';
  try {
    const recipe = await SecureStore.getItemAsync('kv_avatar_recipe');
    if (recipe) name = JSON.parse(recipe).name || 'Villager';
  } catch {}

  return { pubkey, address, privkey, name, apt: deriveAPT(pubkey), network };
}

// ============================================================================
// BALANCE CHECK
// ============================================================================

async function checkBalance(address: string, amountSompi: bigint, network: string): Promise<{ ok: boolean; balance: bigint; error?: string }> {
  try {
    // Use UTXO ledger for accurate spendable balance (prevents double-spend)
    const check = await canSpend(address, amountSompi);
    if (check.ok) {
      return { ok: true, balance: check.spendable };
    }
    const kas = Number(amountSompi) / 1e8;
    const have = Number(check.spendable) / 1e8;
    let reason = `Insufficient: need ${kas.toFixed(2)} KAS, have ${have.toFixed(2)} KAS spendable`;
    if (check.committed > 0n) reason += `. ${Number(check.committed) / 1e8} KAS committed to collateral`;
    if (check.iouAllocated > 0n) reason += `. ${Number(check.iouAllocated) / 1e8} KAS allocated to IOUs`;
    return { ok: false, balance: check.spendable, error: reason };
  } catch (e: any) {
    // Fallback to REST if ledger fails
    try {
      const api = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const resp = await fetch(`${api}/addresses/${address}/balance`);
      if (!resp.ok) return { ok: false, balance: 0n, error: 'Balance check failed' };
      const data = await resp.json();
      const balance = BigInt(data.balance || 0);
      if (balance < amountSompi) {
        return { ok: false, balance, error: `Insufficient: need ${Number(amountSompi) / 1e8} KAS, have ${Number(balance) / 1e8} KAS` };
      }
      return { ok: true, balance };
    } catch {
      return { ok: false, balance: 0n, error: 'Cannot verify balance' };
    }
  }
}

// ============================================================================
// CREATE PROPOSAL
// ============================================================================

export async function createProposal(
  type: 'pay' | 'trade' | 'iou',
  amountKAS: number,
  description: string,
  recipientPubkey?: string,
): Promise<{ proposal: TradeProposal; encoded: string } | { error: string }> {
  const creds = await getMyCredentials();
  if (!creds) return { error: 'Wallet not initialized' };

  const amountSompi = BigInt(String(Math.floor(amountKAS * 1e8)));

  // Balance check
  const balCheck = await checkBalance(creds.address, amountSompi, creds.network);
  if (!balCheck.ok) return { error: balCheck.error || 'Insufficient balance' };

  const proposal: Omit<TradeProposal, 'sig'> = {
    v: 1,
    type,
    from: creds.pubkey.slice(0, 32),
    fromAddr: creds.address,
    fromName: creds.name,
    fromAPT: creds.apt,
    to: recipientPubkey?.slice(0, 32) || undefined,
    amount: amountSompi.toString(),
    desc: description,
    net: creds.network,
    ts: Date.now(),
    nonce: generateNonce(),
  };

  // Sign
  const hash = hashProposal(proposal);
  const sig = secp256k1.sign(hash, hexToBytes(creds.privkey));
  const signedProposal: TradeProposal = {
    ...proposal,
    sig: bytesToHex(sig.toCompactRawBytes()),
  };

  // Encode as compact base64 for sharing
  const json = JSON.stringify(signedProposal);
  const encoded = `kv1:${btoa(json)}`;

  // Store locally
  await storeProposal(signedProposal, 'proposed');

  return { proposal: signedProposal, encoded };
}

// ============================================================================
// VERIFY & DECODE PROPOSAL
// ============================================================================

export function decodeProposal(encoded: string): TradeProposal | null {
  try {
    let json: string;
    /* KV1-EXTRACT: tolerate full share text - pull kv1: token from anywhere in paste */
    const _m = (encoded || '').match(/kv1:[A-Za-z0-9+\/=]+/);
    if (_m) encoded = _m[0];
    if (encoded.startsWith('kv1:')) {
      json = atob(encoded.slice(4));
    } else if (encoded.startsWith('{')) {
      json = encoded;
    } else {
      return null;
    }
    const parsed = JSON.parse(json);
    if (parsed.v !== 1 || !parsed.sig || !parsed.from || !parsed.amount) return null;
    return parsed as TradeProposal;
  } catch {
    return null;
  }
}

export function verifyProposal(proposal: TradeProposal): { valid: boolean; error?: string } {
  // Check timestamp (reject if older than 24 hours)
  const age = Date.now() - proposal.ts;
  if (age > 24 * 60 * 60 * 1000) return { valid: false, error: 'Proposal expired (>24h old)' };
  if (age < -60000) return { valid: false, error: 'Proposal timestamp is in the future' };

  // Verify signature
  try {
    const hash = hashProposal(proposal);
    // Need full pubkey for verification — try to reconstruct from sig + hash
    const recovered = secp256k1.Signature.fromCompact(hexToBytes(proposal.sig))
      .addRecoveryBit(0);
    const pubkey0 = recovered.recoverPublicKey(hash);
    const pubkey1 = secp256k1.Signature.fromCompact(hexToBytes(proposal.sig))
      .addRecoveryBit(1)
      .recoverPublicKey(hash);

    // Check if either recovered key matches the from field (first 32 chars)
    const pk0hex = bytesToHex(pubkey0.toRawBytes(true));
    const pk1hex = bytesToHex(pubkey1.toRawBytes(true));

    if (pk0hex.startsWith(proposal.from) || pk1hex.startsWith(proposal.from)) {
      return { valid: true };
    }
    return { valid: false, error: 'Signature does not match sender pubkey' };
  } catch (e: any) {
    return { valid: false, error: `Signature verification failed: ${e.message}` };
  }
}

// ============================================================================
// COUNTER-SIGN (ACCEPT PROPOSAL)
// ============================================================================

export async function acceptProposal(
  proposal: TradeProposal
): Promise<{ counterSigned: CounterSignedProposal; encoded: string } | { error: string }> {
  const creds = await getMyCredentials();
  if (!creds) return { error: 'Wallet not initialized' };

  // Verify original proposal first
  const verification = verifyProposal(proposal);
  if (!verification.valid) return { error: verification.error || 'Invalid proposal' };

  // Don't accept your own proposal
  if (proposal.from === creds.pubkey.slice(0, 32)) {
    return { error: 'Cannot accept your own proposal' };
  }

  // Network check
  if (proposal.net !== creds.network) {
    return { error: `Network mismatch: proposal is ${proposal.net}, you are on ${creds.network}` };
  }

  // Counter-sign
  const hash = hashCounterSign(proposal);
  const sig = secp256k1.sign(hash, hexToBytes(creds.privkey));

  const counterSigned: CounterSignedProposal = {
    proposal,
    counterSig: bytesToHex(sig.toCompactRawBytes()),
    counterPubkey: creds.pubkey.slice(0, 32),
    counterAddr: creds.address,
    counterName: creds.name,
    counterAPT: creds.apt,
    acceptedAt: Date.now(),
  };

  // Encode for sharing back
  const json = JSON.stringify(counterSigned);
  const encoded = `kv1a:${btoa(json)}`;

  // Allocate UTXOs for this accepted proposal (prevents double-spend)
  try {
    const amountSompi = BigInt(proposal.amount);
    const proposalId = 'prop_' + proposal.nonce;
    const alreadyCommitted = await isAlreadyCommitted(proposalId);
    if (!alreadyCommitted.committed) {
      await allocateForIOU(creds.address, amountSompi, proposalId);
      console.log('[Proposal] UTXOs allocated for', proposalId);
    }
  } catch (e) {
    console.warn('[Proposal] UTXO allocation failed (non-fatal):', e);
  }

  // Store locally
  await storeProposal(proposal, 'accepted');

  return { counterSigned, encoded };
}

// ============================================================================
// SHARE VIA TEXT/DM
// ============================================================================

export async function shareProposal(encoded: string, amountKAS: number, recipientName?: string): Promise<boolean> {
  try {
    const message = recipientName
      ? `KasVillage proposal: ${amountKAS.toFixed(2)} KAS to ${recipientName}\n\nPaste in KasVillage app:\n${encoded}`
      : `KasVillage proposal: ${amountKAS.toFixed(2)} KAS\n\nPaste in KasVillage app:\n${encoded}`;

    const result = await Share.share({ message, title: 'KasVillage Proposal' });
    return result.action === Share.sharedAction;
  } catch {
    // Fallback to clipboard
    await Clipboard.setStringAsync(encoded);
    Alert.alert('Copied!', 'Proposal copied to clipboard. Paste it in a text/DM to the recipient.');
    return true;
  }
}

export async function shareAcceptance(encoded: string, amountKAS: number): Promise<boolean> {
  try {
    const message = `KasVillage accepted: ${amountKAS.toFixed(2)} KAS\n\nPaste in KasVillage app:\n${encoded}`;
    const result = await Share.share({ message, title: 'KasVillage Acceptance' });
    return result.action === Share.sharedAction;
  } catch {
    await Clipboard.setStringAsync(encoded);
    Alert.alert('Copied!', 'Acceptance copied to clipboard. Send it back to the proposer.');
    return true;
  }
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

const PROPOSALS_KEY = 'kv_proposals';

async function storeProposal(proposal: TradeProposal, status: StoredAgreement['status']): Promise<void> {
  try {
    const json = await SecureStore.getItemAsync(PROPOSALS_KEY);
    const proposals: StoredAgreement[] = json ? JSON.parse(json) : [];

    const existing = proposals.findIndex(p => p.proposal.nonce === proposal.nonce);
    if (existing >= 0) {
      proposals[existing].status = status;
    } else {
      proposals.unshift({
        id: `prop_${proposal.nonce}`,
        proposal,
        status,
        createdAt: Date.now(),
      });
    }

    // Keep last 50
    const trimmed = proposals.slice(0, 50);
    await SecureStore.setItemAsync(PROPOSALS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[Proposal] Store error:', e);
  }
}

export async function getStoredProposals(): Promise<StoredAgreement[]> {
  try {
    const json = await SecureStore.getItemAsync(PROPOSALS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function markProposalSettled(nonce: string, txId: string): Promise<void> {
  const json = await SecureStore.getItemAsync(PROPOSALS_KEY);
  const proposals: StoredAgreement[] = json ? JSON.parse(json) : [];
  const p = proposals.find(x => x.proposal.nonce === nonce);
  if (p) {
    p.status = 'settled';
    p.settledTxId = txId;
    await SecureStore.setItemAsync(PROPOSALS_KEY, JSON.stringify(proposals));
    // Release UTXO allocation
    try {
      await releaseIOU('prop_' + nonce);
      console.log('[Proposal] Released UTXO allocation for prop_' + nonce);
    } catch (e) {
      console.warn('[Proposal] Release failed:', e);
    }
  }
}


// ============================================================================
// FINANCIAL SUMMARY (for Dashboard)
// ============================================================================

export async function getFinancialSummary(address: string): Promise<{
  pendingProposals: number;
  acceptedProposals: number;
  totalProposedKAS: number;
  totalAcceptedKAS: number;
  spendableKAS: number;
  committedKAS: number;
  iouAllocatedKAS: number;
  totalKAS: number;
}> {
  const proposals = await getStoredProposals();
  const pending = proposals.filter(p => p.status === 'proposed');
  const accepted = proposals.filter(p => p.status === 'accepted');
  const totalProposed = pending.reduce((s, p) => s + Number(p.proposal.amount), 0) / 1e8;
  const totalAccepted = accepted.reduce((s, p) => s + Number(p.proposal.amount), 0) / 1e8;

  let breakdown = { total: 0, spendable: 0, committed: 0, iouBacked: 0, frozen: 0 };
  try {
    breakdown = await getBalanceBreakdown(address);
  } catch {}

  return {
    pendingProposals: pending.length,
    acceptedProposals: accepted.length,
    totalProposedKAS: totalProposed,
    totalAcceptedKAS: totalAccepted,
    spendableKAS: breakdown.spendable,
    committedKAS: breakdown.committed,
    iouAllocatedKAS: breakdown.iouBacked,
    totalKAS: breakdown.total,
  };
}
