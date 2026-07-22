// Two-party FROST signing test — no React Native, just crypto
// Stubs for RN imports
(globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
(globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
(globalThis as any).TextEncoder = require('util').TextEncoder;
(globalThis as any).TextDecoder = require('util').TextDecoder;

// Stub React Native + Expo (frost_complete.ts imports them)
jest: undefined;
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request: string, ...args: any[]) {
  const stubs: Record<string, string> = {
    'react-native': '', 'expo-secure-store': '', 'expo-crypto': '',
    'react-native-ble-plx': '', 'react-native-ble-peripheral': '',
    'react-native-http-bridge': '', 'react-native-network-info': '',
    '@react-native-community/netinfo': '',
  };
  if (request in stubs) return require.resolve('./stub_rn.js');
  return origResolve.call(this, request, ...args);
};

// Create stub
require('fs').writeFileSync('stub_rn.js', 'module.exports = new Proxy({}, { get: () => () => {} });');

import {
  deriveFrostAddressLocal,
  createPartialSigLocal,
  aggregatePartialSigs,
  generateVerificationCode,
} from './frost_complete';

async function main() {
  console.log('=== FROST 2-of-2 Two-Party Signing Test ===\n');

  // Use real secp256k1 private keys
  const secp = require('@noble/secp256k1');
  const buyerPriv = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const sellerPriv = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';

  const buyerPub = Buffer.from(secp.getPublicKey(Buffer.from(buyerPriv, 'hex'), true)).toString('hex');
  const sellerPub = Buffer.from(secp.getPublicKey(Buffer.from(sellerPriv, 'hex'), true)).toString('hex');

  console.log('Buyer pubkey: ', buyerPub.slice(0, 20) + '...');
  console.log('Seller pubkey:', sellerPub.slice(0, 20) + '...');

  // Step 1: Both derive FROST address
  const frostBuyer = deriveFrostAddressLocal({
    pubkeyA: buyerPub, pubkeyB: sellerPub, network: 'testnet-10', agreementId: 'AGR_TEST_001',
  });
  const frostSeller = deriveFrostAddressLocal({
    pubkeyA: buyerPub, pubkeyB: sellerPub, network: 'testnet-10', agreementId: 'AGR_TEST_001',
  });

  console.log('\n--- Step 1: FROST Address ---');
  console.log('Buyer  FROST:', frostBuyer.address.slice(0, 40) + '...');
  console.log('Seller FROST:', frostSeller.address.slice(0, 40) + '...');
  console.log('Addresses match:', frostBuyer.address === frostSeller.address ? '✅' : '❌');
  console.log('Verification code:', frostBuyer.verificationCode);

  if (frostBuyer.address !== frostSeller.address) {
    console.error('FATAL: FROST addresses diverge');
    process.exit(1);
  }

  // Step 2: Both create partial sigs
  const recipient = frostSeller.address; // seller receives
  const amount = 1500000000n;

  console.log('\n--- Step 2: Partial Signatures ---');
  const sigBuyer = createPartialSigLocal({
    frostAddress: frostBuyer, recipientAddress: recipient, amountSompi: amount, privateKeyHex: buyerPriv,
  });
  const sigSeller = createPartialSigLocal({
    frostAddress: frostSeller, recipientAddress: recipient, amountSompi: amount, privateKeyHex: sellerPriv,
  });

  console.log('Buyer  partial sig:', sigBuyer.partialSig.slice(0, 24) + '...');
  console.log('Seller partial sig:', sigSeller.partialSig.slice(0, 24) + '...');
  console.log('Message hash match:', sigBuyer.messageHash === sigSeller.messageHash ? '✅' : '❌');

  if (sigBuyer.messageHash !== sigSeller.messageHash) {
    console.error('FATAL: Message hashes diverge — ts removal did not work');
    console.error('Buyer hash: ', sigBuyer.messageHash);
    console.error('Seller hash:', sigSeller.messageHash);
    process.exit(1);
  }

  // Step 3: Aggregate
  console.log('\n--- Step 3: Aggregate Signature ---');
  try {
    const aggSig = aggregatePartialSigs(sigBuyer.partialSig, sigSeller.partialSig);
    console.log('Aggregate sig:', aggSig.slice(0, 24) + '...');
    console.log('Length:', aggSig.length / 2, 'bytes');
    console.log('Result: ✅ SUCCESS — no sqrt invalid');
  } catch (e: any) {
    console.error('Result: ❌ FAILED —', e.message);
    process.exit(1);
  }

  // Cleanup
  require('fs').unlinkSync('stub_rn.js');
  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(e => { console.error('Test error:', e); process.exit(1); });
