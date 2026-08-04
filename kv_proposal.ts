// ============================================================================
// KASVILLAGE - PROPOSAL CLIPBOARD FORMAT
// ============================================================================
// Format: KV|agrId|buyerAddr|sellerAddr|buyerAmt|sellerAmt|network|buyerR|code|description
// Seller pastes this -> app verifies everything via math. No network needed.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { generateVerificationCode } from './frost_complete';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

function kvSigHash(bodyStr: string): Uint8Array { return sha256(new TextEncoder().encode('KV_SIG_V1:' + bodyStr)); }

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
  frostCounter?: number;
  description: string;
  utxoTag?: string;           // buyer's committed UTXO key (txId:index)
  buyerPubkey?: string | null;
  sellerPubkey?: string | null;
  buyerPubkeyRaw?: string;
  timeoutN?: number;          // refund timeout in DAA blocks (buyer sets)
  agreementType?: 'simple' | 'trade'; // simple = collateral (return-both on fulfill); trade = payout to seller
  valid?: boolean;
  error?: string;
}

export function generateProposal(params: {
  buyerPrivKeyHex?: string;
  buyerPubkey?: string;
  agrId: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  network: string;
  buyerR: string;
  verificationCode: string;
  description: string;
  frostCounter?: number;
  sellerPubkey?: string;
  timeoutN?: number;
  agreementType?: 'simple' | 'trade';
}): string {
  const desc = (params.description || 'Agreement').replace(/[|\n\r]/g, ' ').trim();
  
  const _body = ['KV', params.agrId, params.buyerAddress, params.sellerAddress,
    params.buyerAmountSompi.toString(), params.sellerAmountSompi.toString(),
    params.network, params.buyerR, params.verificationCode, desc, (params as any).buyerPubkey || '', String((params as any).frostCounter ?? ''), (params as any).sellerPubkey || '', String((params as any).timeoutN ?? ''), ((params as any).agreementType === 'simple' ? 'simple' : 'trade')].join('|');
  let _sig = '';
  try {
    if ((params as any).buyerPrivKeyHex) {
      const _bodyOnly = _body.split('|').slice(1).join('|');
      _sig = bytesToHex(secp256k1.sign(kvSigHash(_bodyOnly), hexToBytes((params as any).buyerPrivKeyHex)).toCompactRawBytes());
    }
  } catch (e) { console.warn('[KV] proposal sign failed:', e); }
  return _body + '|' + _sig;
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
    description: parts[9] || '',
    buyerPubkeyRaw: parts[10] || '',
    frostCounter: (parts[11] !== undefined && parts[11] !== '') ? parseInt(parts[11], 10) : undefined,
  };
  const sellerPubkeyRaw = parts[12] || '';
  const timeoutNRaw = parts[13] || '';
  /* TYPE-FIELD v2: parts[14] = 'simple'|'trade' (signed), sig moves to parts[15]. Old pastes: parts[14] is the sig (hex/empty). */
  const _p14 = parts[14] || '';
  const _hasType = (_p14 === 'simple' || _p14 === 'trade');
  proposal.agreementType = _hasType ? (_p14 as 'simple' | 'trade') : undefined;
  const _sig = _hasType ? (parts[15] || '') : _p14;
  const _bodyOnly = parts.slice(1, _hasType ? 15 : 14).join('|');

  proposal.buyerPubkey = proposal.buyerPubkeyRaw || addressToPubkey(proposal.buyerAddress);
  proposal.sellerPubkey = sellerPubkeyRaw || addressToPubkey(proposal.sellerAddress);
  proposal.timeoutN = (timeoutNRaw !== '') ? parseInt(timeoutNRaw, 10) : undefined;

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
    console.log('[KV] agrId recompute differs (pasted id used, non-blocking):', expectedAgrId, 'vs', proposal.agrId);
  }

  // Verify buyer R is valid EC point
  try {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    if (proposal.buyerR && proposal.buyerR.length > 0) secp256k1.ProjectivePoint.fromHex(proposal.buyerR); // R is a ceremony value (step 5), empty at proposal time (step 3)
  } catch {
    proposal.valid = false;
    proposal.error = 'Invalid buyer R nonce';
    return proposal;
  }

  // Verify code
  // [MITM-GATE] one function, shared with the displayed code.

  const expectedCode = generateVerificationCode(proposal.buyerPubkey as string, proposal.sellerPubkey as string);
  if (proposal.verificationCode && proposal.verificationCode !== expectedCode) {
    proposal.valid = false;
    proposal.error = 'Verification code mismatch — pubkeys may have been swapped in transit. Do not proceed.';
    console.warn('[KV] CODE MISMATCH (blocking):', expectedCode, 'vs', proposal.verificationCode);
    return proposal;
  }

  // === SIGNATURE GATE ===
  if (!_sig) {
    proposal.valid = false;
    proposal.error = 'Unsigned proposal (old format) - reject';
    return proposal;
  }
  try {
    const _okSig = secp256k1.verify(hexToBytes(_sig), kvSigHash(_bodyOnly), hexToBytes(proposal.buyerPubkey as string));
    if (!_okSig) {
      proposal.valid = false;
      proposal.error = 'Bad signature - proposal was tampered';
      return proposal;
    }
  } catch (e: any) {
    proposal.valid = false;
    proposal.error = 'Signature verify failed: ' + (e?.message || e);
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
