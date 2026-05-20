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
  description: string,
  network: string,
  daaScore: string,
): string {
  const input = buyerPubkey + sellerPubkey + buyerAmountSompi.toString() + sellerAmountSompi.toString() + description + network + daaScore;
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
export function canonicalVerify(tags: any, myPubkey: string): CanonicalAgreement {
  // Step 0: Extract tag values (handles Arweave, TownHall, and direct formats)
  const kvPubkey = tags.pubkey || tags['KV-Pubkey'] || tags.partyA?.pubkey || tags.party_a?.pubkey || '';
  const kvCounterparty = tags.counterpartyPubkey || tags['KV-Counterparty'] || '';
  const kvBuyerAmt = parseInt(tags.buyerAmountSompi || tags['KV-BuyerAmount'] || '0', 10);
  const kvAmount = parseInt(tags.amount_sompi || tags['KV-Amount'] || '0', 10);
  const kvDesc = tags.description || '';
  const kvNetwork = tags.network || 'testnet-10';
  const kvDaa = String(tags.daaScore || '0');
  const kvAgrId = tags.agreementId || tags.agreement_id || tags['KV-AgreementId'] || '';

  // Step 1: Derive seller amount (CANONICAL MATH — no network needed)
  // sellerAmount = totalAmount - buyerAmount
  const sellerAmtComputed = kvAmount - kvBuyerAmt;

  // Step 2: Verify AGR ID (tamper detection)
  const expectedId = computeAgreementId(kvPubkey, kvCounterparty, kvBuyerAmt, sellerAmtComputed, kvDesc, kvNetwork, kvDaa);
  const idValid = expectedId === kvAgrId;
  if (!idValid) {
    console.warn('[Canonical] AGR ID mismatch: expected', expectedId, 'got', kvAgrId);
  }

  // Step 3: Determine role
  // CANONICAL: proposer pubkey (KV-Pubkey) = BUYER, always
  let role: 'buyer' | 'seller' | 'unknown' = 'unknown';
  if (myPubkey === kvPubkey) role = 'buyer';
  else if (myPubkey === kvCounterparty) role = 'seller';

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
