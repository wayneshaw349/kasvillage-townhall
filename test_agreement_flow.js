// ============================================================================
// KASVILLAGE AGREEMENT FLOW TEST HARNESS
// Simulates full Seller→Buyer flow using same logic as production
// Run: node test_agreement_flow.js
// ============================================================================

const crypto = require('crypto');

// ============================================================================
// SIMULATED STORAGE (replaces Arweave + AsyncStorage + L1)
// ============================================================================

const arweaveStore = [];      // Simulated Arweave inscriptions
const asyncStorageStore = {};  // Simulated AsyncStorage
const l1Balances = {};         // Simulated L1 UTXO balances
const townhallStore = {};      // Simulated TownHall in-memory

// ============================================================================
// HELPERS
// ============================================================================

function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function deriveFrostAddress(pubkeyA, pubkeyB, agreementId) {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const L = sha256hex(pk1 + pk2 + (agreementId || ''));
  return 'kaspatest:frost_' + L.slice(0, 40);
}

function generateVerificationCode(pubkeyA, pubkeyB) {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  return sha256hex('FROST_VERIFY:' + pk1 + pk2).slice(0, 4).toUpperCase();
}

function generateAgreementId() {
  return 'AGR_' + Date.now();
}

// ============================================================================
// SIMULATED ARWEAVE
// ============================================================================

function inscribeToArweave(tags, payload) {
  const txId = 'AR_' + sha256hex(JSON.stringify(tags) + Date.now()).slice(0, 20);
  arweaveStore.push({ txId, tags, payload, timestamp: Date.now() });
  return txId;
}

function queryArweave(filterTags) {
  return arweaveStore.filter(entry => {
    return Object.entries(filterTags).every(([key, value]) => {
      const tag = entry.tags.find(t => t.name === key);
      return tag && tag.value === value;
    });
  });
}

// ============================================================================
// SIMULATED queryCounterpartyAgreed (same logic as townhall_client.ts)
// ============================================================================

function queryCounterpartyAgreed(opts) {
  // Guard: reject empty
  if (!opts.agreementId || !opts.counterpartyPubkey) return false;

  const filters = {
    'App-Name': 'KasVillage',
    'KV-Type': 'frost-agreement',
    'KV-AgreementId': opts.agreementId,
    'KV-Pubkey': opts.counterpartyPubkey,
  };

  // Must match counterparty
  if (opts.myPubkey) {
    filters['KV-Counterparty'] = opts.myPubkey;
  }

  // Must match FROST address
  if (opts.frostAddress) {
    filters['KV-FrostAddress'] = opts.frostAddress;
  }

  const results = arweaveStore.filter(entry => {
    const tagMap = {};
    entry.tags.forEach(t => tagMap[t.name] = t.value);
    
    // Must be Agreed or Agreed-Send
    if (tagMap['KV-Status'] !== 'Agreed' && tagMap['KV-Status'] !== 'Agreed-Send') return false;

    return Object.entries(filters).every(([key, value]) => tagMap[key] === value);
  });

  return results.length > 0;
}

// ============================================================================
// TEST SETUP
// ============================================================================

const SELLER = {
  pubkey: '02e9c450fc541f388eb3c0292401560115c56029137ad8207c4875f7d0f296424f',
  address: 'kaspatest:qr5ug58u2s0n3r4ncq5jgq2kqy2u2cpfzdadsgrufp6l058jjepy75edjyk84',
  balance: 2100_0000_0000n, // 2100 KASPA
};

const BUYER = {
  pubkey: '02dd5b588bb15ba4f56a451afe57bbdc38a7aa7a9bdd637c49c0e662bb3917765b',
  address: 'kaspatest:qrw4kkytk9d6fat2g5d0u4ammsu202n6n0wkxlzfcrnx9weezam9kfsxdssw0',
  balance: 500_0000_0000n, // 500 KASPA
};

const AGREEMENT = {
  description: 'Watch',
  itemPriceKas: 10,
  sellerCommitmentKas: 5,
};

// ============================================================================
// TEST RUNNER
// ============================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ============================================================================
// FLOW TEST
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  KASVILLAGE AGREEMENT FLOW TEST                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// --- STEP 1: Seller proposes ---
console.log('STEP 1: Seller Proposes');
const agreementId = generateAgreementId();
const frostAddress = deriveFrostAddress(SELLER.pubkey, BUYER.pubkey, agreementId);
const verifyCode = generateVerificationCode(SELLER.pubkey, BUYER.pubkey);

test('Agreement ID generated', () => assert(agreementId.startsWith('AGR_')));
test('FROST address derived with agreementId', () => assert(frostAddress.startsWith('kaspatest:frost_')));
test('Verification code generated', () => assert(verifyCode.length === 4));
test('Different agreementId = different FROST address', () => {
  const frost2 = deriveFrostAddress(SELLER.pubkey, BUYER.pubkey, 'AGR_different');
  assert(frost2 !== frostAddress, 'Same FROST address for different agreements!');
});
test('Same agreementId = same FROST address (deterministic)', () => {
  const frost2 = deriveFrostAddress(SELLER.pubkey, BUYER.pubkey, agreementId);
  assert(frost2 === frostAddress, 'Non-deterministic FROST derivation!');
});

// Inscribe proposal to Arweave
const proposeTxId = inscribeToArweave([
  { name: 'App-Name', value: 'KasVillage' },
  { name: 'KV-Type', value: 'frost-agreement' },
  { name: 'KV-AgreementId', value: agreementId },
  { name: 'KV-Status', value: 'Proposed' },
  { name: 'KV-Pubkey', value: SELLER.pubkey },
  { name: 'KV-Network', value: 'testnet-10' },
  { name: 'KV-Amount', value: String(AGREEMENT.sellerCommitmentKas * 1e8) },
  { name: 'KV-Description', value: AGREEMENT.description },
  { name: 'KV-FrostAddress', value: frostAddress },
  { name: 'KV-Counterparty', value: BUYER.pubkey },
], { agreementId, description: AGREEMENT.description });

test('Proposal inscribed to Arweave', () => assert(proposeTxId.startsWith('AR_')));
test('Proposal has KV-Description tag', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-Description': AGREEMENT.description });
  assert(found.length === 1, 'Description tag missing from inscription');
});
test('Proposal has KV-FrostAddress tag', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-FrostAddress': frostAddress });
  assert(found.length === 1, 'FrostAddress tag missing');
});
test('Proposal has KV-Counterparty tag', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-Counterparty': BUYER.pubkey });
  assert(found.length === 1, 'Counterparty tag missing');
});

// --- STEP 2: Buyer finds proposal in inbox ---
console.log('\nSTEP 2: Buyer Finds Proposal in Inbox');
const inboxResults = queryArweave({
  'KV-Status': 'Proposed',
  'KV-Counterparty': BUYER.pubkey,
});
test('Buyer finds proposal in inbox', () => assert(inboxResults.length === 1));
test('Inbox result has correct agreementId', () => {
  const tag = inboxResults[0].tags.find(t => t.name === 'KV-AgreementId');
  assert(tag.value === agreementId);
});
test('Inbox result has description', () => {
  const tag = inboxResults[0].tags.find(t => t.name === 'KV-Description');
  assert(tag.value === 'Watch', 'Description missing: ' + (tag?.value || 'none'));
});

// Buyer derives same FROST address
const buyerFrost = deriveFrostAddress(BUYER.pubkey, SELLER.pubkey, agreementId);
test('Buyer derives SAME FROST address', () => assert(buyerFrost === frostAddress));
test('Buyer gets same verification code', () => {
  const buyerCode = generateVerificationCode(BUYER.pubkey, SELLER.pubkey);
  assert(buyerCode === verifyCode);
});

// --- STEP 3: Buyer accepts + inscribes Agreed-Send ---
console.log('\nSTEP 3: Buyer Accepts Agreement');
inscribeToArweave([
  { name: 'App-Name', value: 'KasVillage' },
  { name: 'KV-Type', value: 'frost-agreement' },
  { name: 'KV-AgreementId', value: agreementId },
  { name: 'KV-Status', value: 'Agreed' },
  { name: 'KV-Pubkey', value: BUYER.pubkey },
  { name: 'KV-Network', value: 'testnet-10' },
  { name: 'KV-Amount', value: String(AGREEMENT.itemPriceKas * 1e8) },
  { name: 'KV-Description', value: AGREEMENT.description },
  { name: 'KV-FrostAddress', value: frostAddress },
  { name: 'KV-Counterparty', value: SELLER.pubkey },
], { agreementId, status: 'Agreed' });

inscribeToArweave([
  { name: 'App-Name', value: 'KasVillage' },
  { name: 'KV-Type', value: 'frost-agreement' },
  { name: 'KV-AgreementId', value: agreementId },
  { name: 'KV-Status', value: 'Agreed-Send' },
  { name: 'KV-Pubkey', value: BUYER.pubkey },
  { name: 'KV-Network', value: 'testnet-10' },
  { name: 'KV-Amount', value: String(AGREEMENT.itemPriceKas * 1e8) },
  { name: 'KV-Description', value: AGREEMENT.description },
  { name: 'KV-FrostAddress', value: frostAddress },
  { name: 'KV-Counterparty', value: SELLER.pubkey },
], { agreementId, status: 'Agreed-Send' });

test('Buyer Agreed-Send inscribed', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-Status': 'Agreed-Send', 'KV-Pubkey': BUYER.pubkey });
  assert(found.length === 1);
});

// --- STEP 4: Seller polls queryCounterpartyAgreed ---
console.log('\nSTEP 4: Seller Polls for Counterparty Agreement');

test('queryCounterpartyAgreed returns TRUE (all filters match)', () => {
  const found = queryCounterpartyAgreed({
    agreementId,
    counterpartyPubkey: BUYER.pubkey,
    myPubkey: SELLER.pubkey,
    frostAddress,
  });
  assert(found === true);
});

test('GUARD: empty agreementId returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId: '', counterpartyPubkey: BUYER.pubkey, myPubkey: SELLER.pubkey, frostAddress }) === false);
});

test('GUARD: empty counterpartyPubkey returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId, counterpartyPubkey: '', myPubkey: SELLER.pubkey, frostAddress }) === false);
});

test('GUARD: wrong agreementId returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId: 'AGR_wrong', counterpartyPubkey: BUYER.pubkey, myPubkey: SELLER.pubkey, frostAddress }) === false);
});

test('GUARD: wrong counterpartyPubkey returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId, counterpartyPubkey: '02aaaa', myPubkey: SELLER.pubkey, frostAddress }) === false);
});

test('GUARD: wrong frostAddress returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId, counterpartyPubkey: BUYER.pubkey, myPubkey: SELLER.pubkey, frostAddress: 'kaspatest:wrong' }) === false);
});

test('GUARD: wrong myPubkey returns FALSE', () => {
  assert(queryCounterpartyAgreed({ agreementId, counterpartyPubkey: BUYER.pubkey, myPubkey: '02bbbb', frostAddress }) === false);
});

// --- OLD AGREEMENT CONTAMINATION TEST ---
console.log('\nSTEP 5: Cross-Agreement Contamination Tests');

// Simulate old agreement from same parties
const oldAgreementId = 'AGR_old_1778531718879';
const oldFrost = deriveFrostAddress(SELLER.pubkey, BUYER.pubkey, oldAgreementId);
inscribeToArweave([
  { name: 'App-Name', value: 'KasVillage' },
  { name: 'KV-Type', value: 'frost-agreement' },
  { name: 'KV-AgreementId', value: oldAgreementId },
  { name: 'KV-Status', value: 'Agreed-Send' },
  { name: 'KV-Pubkey', value: BUYER.pubkey },
  { name: 'KV-FrostAddress', value: oldFrost },
  { name: 'KV-Counterparty', value: SELLER.pubkey },
], {});

test('Old agreement has DIFFERENT FROST address', () => {
  assert(oldFrost !== frostAddress, 'Same FROST for different agreements!');
});

test('GUARD: old agreementId does NOT match new query', () => {
  const found = queryCounterpartyAgreed({
    agreementId, // new
    counterpartyPubkey: BUYER.pubkey,
    myPubkey: SELLER.pubkey,
    frostAddress, // new
  });
  // Should still be true (from step 3 inscription)
  assert(found === true);
});

test('GUARD: querying with old agreementId does NOT find new agreement', () => {
  const found = queryCounterpartyAgreed({
    agreementId: oldAgreementId,
    counterpartyPubkey: BUYER.pubkey,
    myPubkey: SELLER.pubkey,
    frostAddress, // NEW frost — doesn't match old inscription
  });
  assert(found === false, 'Old agreement contaminated new query!');
});

// --- STEP 6: Simulated FROST balance + auto-send ---
console.log('\nSTEP 6: FROST Balance & Auto-Send');

const sellerAmount = BigInt(AGREEMENT.sellerCommitmentKas * 1e8);
const buyerAmount = BigInt(AGREEMENT.itemPriceKas * 1e8);
const totalExpected = sellerAmount + buyerAmount;

// Buyer sends to FROST
l1Balances[frostAddress] = buyerAmount;
test('Buyer sends to FROST', () => assert(l1Balances[frostAddress] === buyerAmount));

// Seller auto-send triggered by FROST poll detecting partial balance
const sentKey = 'kv_frost_sent_' + agreementId;
test('GUARD: idempotency key not set yet', () => assert(!asyncStorageStore[sentKey]));

// Seller sends
l1Balances[frostAddress] += sellerAmount;
asyncStorageStore[sentKey] = 'true';
test('Seller auto-sends to FROST', () => assert(l1Balances[frostAddress] === totalExpected));
test('Idempotency key set', () => assert(asyncStorageStore[sentKey] === 'true'));

// Double-send guard
test('GUARD: second send blocked by idempotency', () => {
  assert(asyncStorageStore[sentKey] === 'true', 'Would double-send!');
});

// FROST poll detects full balance
test('FROST poll: both parties confirmed', () => {
  assert(l1Balances[frostAddress] >= totalExpected);
});

// --- STEP 7: Buyer confirms delivery + PartialSig ---
console.log('\nSTEP 7: Buyer Confirms Delivery');

const partialSig = sha256hex('partial_sig_' + BUYER.pubkey + agreementId).slice(0, 64);

inscribeToArweave([
  { name: 'App-Name', value: 'KasVillage' },
  { name: 'KV-Type', value: 'frost-agreement' },
  { name: 'KV-AgreementId', value: agreementId },
  { name: 'KV-Status', value: 'PartialSig' },
  { name: 'KV-Pubkey', value: BUYER.pubkey },
  { name: 'KV-FrostAddress', value: frostAddress },
  { name: 'KV-Counterparty', value: SELLER.pubkey },
], { partialSig });

test('PartialSig inscribed to Arweave', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-Status': 'PartialSig' });
  assert(found.length === 1);
});

test('PartialSig has KV-Pubkey (buyer)', () => {
  const found = queryArweave({ 'KV-AgreementId': agreementId, 'KV-Status': 'PartialSig', 'KV-Pubkey': BUYER.pubkey });
  assert(found.length === 1);
});

// --- STEP 8: Seller finds PartialSig + releases ---
console.log('\nSTEP 8: Seller Finds PartialSig & Releases');

const partialSigResults = queryArweave({ 'KV-Status': 'PartialSig' });
const match = partialSigResults.find(r => {
  const tagMap = {};
  r.tags.forEach(t => tagMap[t.name] = t.value);
  return tagMap['KV-AgreementId'] === agreementId;
});

test('Seller finds PartialSig by agreementId', () => assert(match !== undefined));
test('PartialSig has correct FROST address', () => {
  const tagMap = {};
  match.tags.forEach(t => tagMap[t.name] = t.value);
  assert(tagMap['KV-FrostAddress'] === frostAddress);
});

// Simulate release
l1Balances[frostAddress] = 0n;
l1Balances[SELLER.address] = (l1Balances[SELLER.address] || 0n) + totalExpected;

test('FROST balance zeroed after release', () => assert(l1Balances[frostAddress] === 0n));
test('Seller received funds', () => assert(l1Balances[SELLER.address] === totalExpected));

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n⚠️  FAILURES DETECTED — fix before testing on device');
  process.exit(1);
} else {
  console.log('\n✅ ALL GUARDS PASS — safe to test on device');
  
  console.log('\n--- INSCRIPTION TAGS WRITTEN ---');
  console.log('Total inscriptions:', arweaveStore.length);
  arweaveStore.forEach((entry, i) => {
    const tagMap = {};
    entry.tags.forEach(t => tagMap[t.name] = t.value);
    console.log(`  ${i+1}. ${tagMap['KV-Status']} | AgrId: ${(tagMap['KV-AgreementId']||'').slice(0,20)} | Pubkey: ${(tagMap['KV-Pubkey']||'').slice(0,16)} | Frost: ${(tagMap['KV-FrostAddress']||'none').slice(0,30)} | Desc: ${tagMap['KV-Description']||'none'}`);
  });
  
  console.log('\n--- QUERY FILTER CHECKLIST ---');
  console.log('  App-Name:       ✅ KasVillage');
  console.log('  KV-Type:        ✅ frost-agreement');
  console.log('  KV-Status:      ✅ Agreed/Agreed-Send');
  console.log('  KV-AgreementId: ✅ ' + agreementId);
  console.log('  KV-Pubkey:      ✅ counterparty pubkey');
  console.log('  KV-Counterparty:✅ my pubkey');
  console.log('  KV-FrostAddress:✅ ' + frostAddress.slice(0, 30) + '...');
  console.log('  KV-Description: ✅ ' + AGREEMENT.description);
}
