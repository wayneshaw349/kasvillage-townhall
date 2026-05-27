// ============================================================================
// KASVILLAGE - PROPOSAL CLIPBOARD FORMAT
// ============================================================================
// Format: KV|agrId|buyerAddr|sellerAddr|buyerAmt|sellerAmt|network|buyerR|code|description
// Seller pastes this -> app verifies everything via math. No network needed.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function addressToPubkey(address: string): string | null {
  try {
    if (!address.includes(':')) return null;
    const dataPart = address.split(':')[1];
    const data5bit = Array.from(dataPart).map(c => CHARSET.indexOf(c));
    if (data5bit.some(v => v < 0)) return null;
    const result: number[] = [];
    let buff = 0, bits = 0;
    for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
    if (result[0] === 0x00 && result.length >= 33) {
      const xOnly = result.slice(1, 33);
      return '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  } catch { return null; }
}

export interface KVProposal {
  agrId: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  network: string;
  buyerR: string;
  verificationCode: string;
  description: string;
  utxoTag?: string;           // buyer's committed UTXO key (txId:index)
  buyerPubkey?: string | null;
  sellerPubkey?: string | null;
  valid?: boolean;
  error?: string;
}

export function generateProposal(params: {
  agrId: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  network: string;
  buyerR: string;
  verificationCode: string;
  description: string;
}): string {
  const desc = (params.description || 'Agreement').replace(/[|\n\r]/g, ' ').trim();
  return ['KV', params.agrId, params.buyerAddress, params.sellerAddress,
    params.buyerAmountSompi.toString(), params.sellerAmountSompi.toString(),
    params.network, params.buyerR, params.verificationCode, desc].join('|');
}

export function parseProposal(text: string): KVProposal | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('KV|')) return null;
  const parts = trimmed.split('|');
  if (parts.length < 10) return null;

  const proposal: KVProposal = {
    agrId: parts[1], buyerAddress: parts[2], sellerAddress: parts[3],
    buyerAmountSompi: parseInt(parts[4], 10), sellerAmountSompi: parseInt(parts[5], 10),
    network: parts[6], buyerR: parts[7], verificationCode: parts[8],
    description: parts.slice(9).join('|'),
  };

  proposal.buyerPubkey = addressToPubkey(proposal.buyerAddress);
  proposal.sellerPubkey = addressToPubkey(proposal.sellerAddress);

  if (!proposal.buyerPubkey || !proposal.sellerPubkey) {
    proposal.valid = false;
    proposal.error = 'Invalid Kaspa address';
    return proposal;
  }

  // Verify AGR ID
  const expectedInput = proposal.buyerPubkey + proposal.sellerPubkey
    + proposal.buyerAmountSompi.toString() + proposal.sellerAmountSompi.toString() + proposal.network;
  const expectedHash = sha256(new TextEncoder().encode(expectedInput));
  const expectedAgrId = 'AGR_' + bytesToHex(expectedHash.slice(0, 6));
  if (proposal.agrId !== expectedAgrId) {
    proposal.valid = false;
    proposal.error = 'AGR ID mismatch: expected ' + expectedAgrId;
    return proposal;
  }

  // Verify buyer R is valid EC point
  try {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    secp256k1.ProjectivePoint.fromHex(proposal.buyerR);
  } catch {
    proposal.valid = false;
    proposal.error = 'Invalid buyer R nonce';
    return proposal;
  }

  // Verify code
  const sorted = [proposal.buyerPubkey, proposal.sellerPubkey].sort();
  const codeHash = sha256(new TextEncoder().encode(sorted[0] + sorted[1]));
  const expectedCode = bytesToHex(codeHash.slice(0, 2)).toUpperCase();
  if (proposal.verificationCode !== expectedCode) {
    proposal.valid = false;
    proposal.error = 'Code mismatch: expected ' + expectedCode;
    return proposal;
  }

  proposal.valid = true;
  return proposal;
}

export function verifyProposalForMe(proposal: KVProposal, myAddress: string, myPubkey: string): {
  isForMe: boolean; myRole: 'buyer' | 'seller' | null; error?: string;
} {
  if (!proposal.valid) return { isForMe: false, myRole: null, error: proposal.error };
  if (proposal.sellerAddress === myAddress || proposal.sellerPubkey === myPubkey)
    return { isForMe: true, myRole: 'seller' };
  if (proposal.buyerAddress === myAddress || proposal.buyerPubkey === myPubkey)
    return { isForMe: false, myRole: null, error: 'This is your own proposal' };
  return { isForMe: false, myRole: null, error: 'Not addressed to you' };
}

export function parseReleaseKey(text: string): { agrId: string; buyerR: string; encryptedSig: string } | null {
  const t = text.trim();
  const agrMatch = t.match(/AGR:\s*(\S+)/);
  const rMatch = t.match(/R:\s*([0-9a-fA-F]{60,66})/);
  const sigMatch = t.match(/SIG:\s*(.+)/);
  if (!agrMatch || !sigMatch) return null;
  return { agrId: agrMatch[1], buyerR: rMatch ? rMatch[1] : '', encryptedSig: sigMatch[1].trim() };
}
