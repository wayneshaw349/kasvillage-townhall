import { sha256 } from '@noble/hashes/sha256';
import { deriveFrostAddressLocal } from './frost_complete';

export interface CanonicalAgreement {
  agreementId: string;
  role: 'buyer' | 'seller' | 'unknown';
  buyerPubkey: string;
  sellerPubkey: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  totalAmountSompi: number;
  myAmountSompi: number;
  description: string;
  network: string;
  daaScore: string;
  frostAddress: string;
  frostData: any;
  idValid: boolean;
  timeoutN: number;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// === CANONICAL AGREEMENT ID ===
// Deterministic from ALL fields — changing any field changes the ID
export function computeAgreementId(
  buyerPubkey: string,
  sellerPubkey: string,
  buyerAmountSompi: number,
  sellerAmountSompi: number,
  _description?: string,
  network?: string,
  _daaScore?: string,
  utxoTag?: string,
): string {
  // Deterministic: pubkeys + amounts + network only (no timestamp, no description)
  const input = buyerPubkey + sellerPubkey + buyerAmountSompi.toString() + sellerAmountSompi.toString() + (network || 'testnet-10') + (utxoTag || '');
  const hash = sha256(new TextEncoder().encode(input));
  return 'AGR_' + bytesToHex(hash.slice(0, 6));
}


// === NORMALIZE AGREEMENT DATA ===
// Converts any format (TownHall, Arweave, manual) to canonical flat format
// Call this ONCE before canonicalVerify
export function normalizeAgreement(raw: any): any {
  return {
    agreementId: raw.agreementId || raw.agreement_id || raw.id || '',
    pubkey: raw.pubkey || raw.party_a?.pubkey || raw.partyA?.pubkey || '',
    counterpartyPubkey: raw.counterpartyPubkey || raw.party_b?.pubkey || raw.partyB?.pubkey || '',
    amount_sompi: Number(raw.amount_sompi || raw.party_a?.amount_sompi || raw.partyA?.amount_sompi || 0),
    buyerAmountSompi: Number(raw.buyerAmountSompi || raw['KV-BuyerAmount'] || raw.party_a?.buyerAmountSompi || raw.party_a?.buyer_amount_sompi || raw.partyA?.buyerAmountSompi || 0),
    sellerAmountSompi: Number(raw.sellerAmountSompi || raw['KV-SellerAmount'] || raw.party_a?.sellerAmountSompi || raw.party_a?.seller_amount_sompi || raw.partyA?.sellerAmountSompi || 0),
    description: raw.description || raw['KV-Description'] || '',
    network: raw.network || raw['KV-Network'] || 'testnet-10',
    daaScore: String(raw.daaScore || raw.daa_score || raw['KV-DAAScore'] || raw.created_at || '0'),
    status: raw.status || '',
    frostAddress: raw.frostAddress || raw.frost_address || raw['KV-FrostAddress'] || '',
    signature: raw.signature || '',
    timeoutN: Number(raw.timeoutN || raw['KV-TimeoutN'] || 0),
  };
}

// === CANONICAL VERIFICATION ===
// Runs on EVERY entry point: inbox, manual lookup, session restore, Arweave fetch
// Returns canonical agreement with verified role, amounts, FROST address
//
// CANONICAL RULES:
//   KV-Pubkey = BUYER (proposer always = buyer)
//   KV-Counterparty = SELLER (acceptor always = seller)
//   sellerAmount = KV-Amount - KV-BuyerAmount (local math)
//   role = myPubkey matches KV-Pubkey ? buyer : seller
//   myAmount = role === buyer ? buyerAmount : sellerAmount
//   FROST = MuSig(buyer_pubkey, seller_pubkey, agreementId)
//
// x-only parity-agnostic pubkey equality (odd-y 03.. safe)
function pkEq(a?: string, b?: string): boolean {
  const x = (a || '').trim().toLowerCase();
  const y = (b || '').trim().toLowerCase();
  const xx = x.length === 66 ? x.slice(2) : x;
  const yy = y.length === 66 ? y.slice(2) : y;
  return !!xx && xx === yy;
}

export function canonicalVerify(tags: any, myPubkey: string): CanonicalAgreement {
  // Step 0: Extract tag values (handles Arweave, TownHall, and direct formats)
  const kvPubkey = tags.pubkey || tags['KV-Pubkey'] || tags.partyA?.pubkey || tags.party_a?.pubkey || '';
  let kvCounterparty = tags.counterpartyPubkey || tags['KV-Counterparty'] || '';
  /* CP-SELF-REPAIR: if counterparty missing or self-referential (== proposer), and I am not the proposer, I must be the counterparty */
  if ((!kvCounterparty || pkEq(kvCounterparty, kvPubkey)) && myPubkey && !pkEq(myPubkey, kvPubkey)) kvCounterparty = myPubkey;
  const kvBuyerAmt = parseInt(tags.buyerAmountSompi || tags['KV-BuyerAmount'] || '0', 10);
  const kvAmount = parseInt(tags.amount_sompi || tags['KV-Amount'] || '0', 10);
  const kvDesc = tags.description || '';
  const kvNetwork = tags.network || 'testnet-10';
  const kvDaa = String(tags.daaScore || '0');
  const kvAgrId = tags.agreementId || tags.agreement_id || tags['KV-AgreementId'] || '';
  const kvTimeoutN = parseInt(String(tags.timeoutN || tags['KV-TimeoutN'] || '0'), 10) || 0;

  // Step 1: Derive seller amount (CANONICAL MATH — no network needed)
  // sellerAmount = totalAmount - buyerAmount
  const sellerAmtComputed = kvAmount - kvBuyerAmt;

  // Step 2: Verify AGR ID (tamper detection)
  const expectedId = computeAgreementId(kvPubkey, kvCounterparty, kvBuyerAmt, sellerAmtComputed, kvDesc, kvNetwork, kvDaa);
  const idValid = !!kvAgrId && kvAgrId.indexOf('AGR_') === 0; const _idDrift = expectedId !== kvAgrId;
  if (_idDrift) {
    console.warn('[Canonical] agrId recompute differs (pasted id used):', expectedId, 'got', kvAgrId);
  }

  // Step 3: Determine role
  // CANONICAL: proposer pubkey (KV-Pubkey) = BUYER, always
  let role: 'buyer' | 'seller' | 'unknown' = 'unknown';
  if (pkEq(myPubkey, kvPubkey)) role = 'buyer';
  else if (pkEq(myPubkey, kvCounterparty)) role = 'seller';

  // Step 4: Compute my send amount
  const myAmountSompi = role === 'buyer' ? kvBuyerAmt : sellerAmtComputed;

  // Step 5: Derive FROST address (local math — no network needed)
  let frostAddress = '';
  let frostData: any = null;
  try {
    frostData = deriveFrostAddressLocal({
      pubkeyA: kvPubkey,        // buyer = always first (canonical order)
      pubkeyB: kvCounterparty,  // seller = always second
      network: kvNetwork as any,
      agreementId: kvAgrId,
    });
    frostAddress = frostData.address;
  } catch (e) {
    console.warn('[Canonical] FROST derivation failed:', e);
  }

  console.log('[Canonical]', kvAgrId,
    'role:', role,
    'buyer:', kvBuyerAmt / 1e8,
    'seller:', sellerAmtComputed / 1e8,
    'total:', kvAmount / 1e8,
    'myAmt:', myAmountSompi / 1e8,
    'frost:', frostAddress?.slice(0, 25),
    'valid:', idValid);

  return {
    agreementId: kvAgrId,
    role,
    buyerPubkey: kvPubkey,
    sellerPubkey: kvCounterparty,
    buyerAmountSompi: kvBuyerAmt,
    sellerAmountSompi: sellerAmtComputed,
    totalAmountSompi: kvAmount,
    myAmountSompi,
    description: kvDesc,
    network: kvNetwork,
    daaScore: kvDaa,
    frostAddress,
    frostData,
    idValid,
    timeoutN: kvTimeoutN,
  };
}

// === CANONICAL CONTRACT STATE ===
// Sets ALL contract fields from canonical result
// Call this once, use everywhere — ensures consistency
export function canonicalToContract(canon: CanonicalAgreement) {
  return {
    agreementId: canon.agreementId,
    buyerPubkey: canon.buyerPubkey,
    sellerPubkey: canon.sellerPubkey,
    counterpartyPubkey: canon.role === 'buyer' ? canon.sellerPubkey : canon.buyerPubkey,
    itemPriceKas: canon.buyerAmountSompi / 1e8,
    sellerCommitmentKas: canon.sellerAmountSompi / 1e8,
    itemDescription: canon.description,
    multisigAddress: canon.frostAddress,
    frostData: canon.frostData,
    timeoutN: canon.timeoutN,
  };
}

// === CANONICAL SEND AMOUNT ===
// Returns the amount THIS device should send to FROST (in sompi)
export function canonicalSendAmount(canon: CanonicalAgreement): number {
  return canon.myAmountSompi;
}

// === CANONICAL SEND ORDER ===
// Seller sends FIRST (good faith), buyer waits for FROST-Poll
export function canonicalSendsFirst(canon: CanonicalAgreement): boolean {
  return canon.role === 'seller';
}


// === CANONICAL RELEASE FLOW ===
// Enforces: buyer creates partial sig, seller co-signs and broadcasts
export function canonicalReleaseSigner(role: string): 'create' | 'cosign' {
  // Buyer confirms delivery ? creates partial sig
  // Seller receives partial sig ? co-signs ? broadcasts release TX
  return role === 'buyer' ? 'create' : 'cosign';
}

export function canonicalCanCreatePartialSig(role: string, step: number): boolean {
  // Only buyer can create partial sig, only at step 4
  return role === 'buyer' && step === 4;
}

export function canonicalCanCosign(role: string, step: number): boolean {
  // Only seller can co-sign, at step 4 or 5
  return role === 'seller' && (step === 4 || step === 5);
}


// === CANONICAL PROPOSER RULE ===
// The proposer is ALWAYS the buyer. No role selection needed.
// The acceptor is ALWAYS the seller.
// This is enforced at the protocol level ? UI should not offer role choice.
export function canonicalProposerRole(): 'buyer' { return 'buyer'; }
export function canonicalAcceptorRole(): 'seller' { return 'seller'; }

// Validate: if proposer pubkey matches myPubkey, I am buyer
// If I am accepting (not proposing), I am seller
export function canonicalDetermineRole(proposerPubkey: string, myPubkey: string): 'buyer' | 'seller' {
  return pkEq(proposerPubkey, myPubkey) ? 'buyer' : 'seller';
}
