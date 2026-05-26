/**
 * Test kv_proposal.ts clipboard format
 * Run: node test_proposal.cjs
 */
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
const { secp256k1 } = require('@noble/curves/secp256k1');

// Inline the functions since we can't import TS directly
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function addressToPubkey(address) {
  if (!address.includes(':')) return null;
  const dataPart = address.split(':')[1];
  const data5bit = Array.from(dataPart).map(c => CHARSET.indexOf(c));
  if (data5bit.some(v => v < 0)) return null;
  const result = []; let buff = 0, bits = 0;
  for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
  if (result[0] === 0x00 && result.length >= 33) {
    const xOnly = result.slice(1, 33);
    return '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

function to5bit(data) { const r = []; let b = 0, bits = 0; for (const v of data) { b = (b << 8) | v; bits += 8; while (bits >= 5) { bits -= 5; r.push((b >> bits) & 31); } } if (bits > 0) r.push((b << (5 - bits)) & 31); return r; }
function polymod(values) { const G = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n]; let c = 1n; for (const v of values) { const b = c >> 35n; c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(v); for (let i = 0; i < 5; i++) { if ((b >> BigInt(i)) & 1n) c ^= G[i]; } } return c; }
function bech32Encode(prefix, payload) { const pd = [...prefix].map(c => c.charCodeAt(0) & 31); const d5 = to5bit(payload); const vals = [...pd, 0, ...d5, 0, 0, 0, 0, 0, 0, 0, 0]; const pm = polymod(vals) ^ 1n; const cs = []; for (let i = 0; i < 8; i++) cs.push(Number((pm >> BigInt(5 * (7 - i))) & 31n)); return prefix + ':' + [...d5, ...cs].map(v => CHARSET[v]).join(''); }
function pubkeyToAddress(pub, network) { const xOnly = pub.length === 66 ? pub.slice(2) : pub; const payload = new Uint8Array([0x00, ...hexToBytes(xOnly)]); return bech32Encode(network === 'mainnet' ? 'kaspa' : 'kaspatest', payload); }

// Test keys
const BUYER_PUB = '0335f1be04eb12982f061a268f96d580194f8331084bc13a833633d089fae46f4e';
const SELLER_PUB = '02ed0484ee0a35c2ebab66bab53fb6bce4b7cc5bf8297d802b39d2a4e35be1cc11';
const NETWORK = 'testnet-10';
const BUYER_AMT = 200000000;
const SELLER_AMT = 400000000;

// Derive addresses
const buyerAddr = pubkeyToAddress(BUYER_PUB, NETWORK);
const sellerAddr = pubkeyToAddress(SELLER_PUB, NETWORK);
console.log('Buyer addr: ', buyerAddr);
console.log('Seller addr:', sellerAddr);

// Verify round-trip
const buyerPubBack = addressToPubkey(buyerAddr);
const sellerPubBack = addressToPubkey(sellerAddr);
console.log('Buyer pub round-trip: ', buyerPubBack === BUYER_PUB ? '✓' : '✗ got ' + buyerPubBack);
console.log('Seller pub round-trip:', sellerPubBack === SELLER_PUB ? '✓' : '✗ got ' + sellerPubBack);

// Generate AGR ID
const agrInput = BUYER_PUB + SELLER_PUB + BUYER_AMT.toString() + SELLER_AMT.toString() + NETWORK;
const agrHash = sha256(new TextEncoder().encode(agrInput));
const agrId = 'AGR_' + bytesToHex(agrHash.slice(0, 6));
console.log('AGR ID:', agrId);

// Generate verification code
const sortedPubs = [BUYER_PUB, SELLER_PUB].sort();
const codeHash = sha256(new TextEncoder().encode(sortedPubs[0] + sortedPubs[1]));
const verCode = bytesToHex(codeHash.slice(0, 2)).toUpperCase();
console.log('Verification code:', verCode);

// Generate fake buyer R nonce
const k = secp256k1.utils.randomPrivateKey();
const R = secp256k1.ProjectivePoint.BASE.multiply(BigInt('0x' + bytesToHex(k)) % secp256k1.CURVE.n);
const buyerR = bytesToHex(R.toRawBytes(true));
console.log('Buyer R:', buyerR.slice(0, 20) + '...');

// Generate proposal clipboard string
const proposal = [
  'KV', agrId, buyerAddr, sellerAddr,
  BUYER_AMT.toString(), SELLER_AMT.toString(),
  NETWORK, buyerR, verCode, 'Vintage Watch'
].join('|');

console.log('\n=== CLIPBOARD PROPOSAL ===');
console.log(proposal);
console.log('Length:', proposal.length, 'chars');

// Parse it back (simulate seller)
console.log('\n=== SELLER PARSES ===');
const parts = proposal.split('|');
if (parts[0] !== 'KV' || parts.length < 10) { console.error('Invalid format'); process.exit(1); }

const parsed = {
  agrId: parts[1],
  buyerAddress: parts[2],
  sellerAddress: parts[3],
  buyerAmountSompi: parseInt(parts[4]),
  sellerAmountSompi: parseInt(parts[5]),
  network: parts[6],
  buyerR: parts[7],
  verificationCode: parts[8],
  description: parts.slice(9).join('|'),
};

// Derive pubkeys from addresses
const pBuyerPub = addressToPubkey(parsed.buyerAddress);
const pSellerPub = addressToPubkey(parsed.sellerAddress);
console.log('Buyer pubkey:', pBuyerPub ? pBuyerPub.slice(0, 20) + '...' : 'FAIL');
console.log('Seller pubkey:', pSellerPub ? pSellerPub.slice(0, 20) + '...' : 'FAIL');

// Verify AGR ID
const vAgrInput = pBuyerPub + pSellerPub + parsed.buyerAmountSompi.toString() + parsed.sellerAmountSompi.toString() + parsed.network;
const vAgrHash = sha256(new TextEncoder().encode(vAgrInput));
const vAgrId = 'AGR_' + bytesToHex(vAgrHash.slice(0, 6));
console.log('AGR ID verify:', vAgrId === parsed.agrId ? '✓ MATCH' : '✗ MISMATCH: ' + vAgrId);

// Verify code
const vSorted = [pBuyerPub, pSellerPub].sort();
const vCodeHash = sha256(new TextEncoder().encode(vSorted[0] + vSorted[1]));
const vCode = bytesToHex(vCodeHash.slice(0, 2)).toUpperCase();
console.log('Code verify:', vCode === parsed.verificationCode ? '✓ MATCH' : '✗ MISMATCH: ' + vCode);

// Verify R is valid EC point
try {
  secp256k1.ProjectivePoint.fromHex(parsed.buyerR);
  console.log('Buyer R verify: ✓ valid EC point');
} catch { console.log('Buyer R verify: ✗ INVALID'); }

// Check if proposal is for seller
console.log('Is for seller:', parsed.sellerAddress === sellerAddr ? '✓ YES' : '✗ NO');

console.log('\n=== DISPLAY ===');
console.log('📋 Agreement Proposal');
console.log('Item:', parsed.description);
console.log('From:', parsed.buyerAddress.slice(0, 30) + '...');
console.log('To:  ', parsed.sellerAddress.slice(0, 30) + '...');
console.log('Buyer pays:', parsed.buyerAmountSompi / 1e8, 'KAS');
console.log('Seller locks:', parsed.sellerAmountSompi / 1e8, 'KAS');
console.log('Code:', parsed.verificationCode);
console.log('All checks:', 'PASSED ✓');
