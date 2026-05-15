// ============================================================================
// TEST: Two-Output Release TX + Session Persistence
// Run: node test_two_output_and_session.js
// ============================================================================

const crypto = require('crypto');

// ============================================================================
// SIMULATED STORAGE
// ============================================================================
const asyncStorage = {};
const l1Balances = {};

// ============================================================================
// HELPERS
// ============================================================================
function sha256hex(d) { return crypto.createHash('sha256').update(d).digest('hex'); }

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// ============================================================================
// PART 1: TWO-OUTPUT RELEASE TX FOR SIMPLE COLLATERAL
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  PART 1: TWO-OUTPUT RELEASE TX (Simple Collateral)     ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Current: completeFrostAndBroadcast takes ONE recipientAddress
// Needed:  support TWO outputs (Party A gets theirs, Party B gets theirs)

// Simulated current function signature
function completeFrostAndBroadcastCurrent(params) {
  // Single output — ALL funds go to one address
  const { recipientAddress, amountSompi } = params;
  return {
    outputs: [{ address: recipientAddress, amount: amountSompi }],
    outputCount: 1,
  };
}

// NEW function signature with multi-output support
function completeFrostAndBroadcastV2(params) {
  const { frostAddress, myPrivateKeyHex, amountSompi, counterpartyPartialSig } = params;

  // If recipients array provided → multi-output (simple collateral)
  // If single recipientAddress → single output (trade, backward compatible)
  if (params.recipients && params.recipients.length > 0) {
    // Validate total doesn't exceed FROST balance
    const totalOut = params.recipients.reduce((sum, r) => sum + r.amount, 0n);
    if (totalOut > amountSompi) {
      return { success: false, error: 'Output total exceeds FROST balance' };
    }

    return {
      success: true,
      outputs: params.recipients.map(r => ({ address: r.address, amount: r.amount })),
      outputCount: params.recipients.length,
    };
  }

  // Backward compatible single output
  return {
    success: true,
    outputs: [{ address: params.recipientAddress, amount: amountSompi }],
    outputCount: 1,
  };
}

const PARTY_A = {
  address: 'kaspatest:qr5ug58u2s0n3r4ncq5jgq2kqy2u2cpfzdadsgrufp6l058jjepy75edjyk84',
  collateral: 10n * 100000000n, // 10 KAS
};

const PARTY_B = {
  address: 'kaspatest:qrw4kkytk9d6fat2g5d0u4ammsu202n6n0wkxlzfcrnx9weezam9kfsxdssw0',
  collateral: 5n * 100000000n, // 5 KAS
};

const FROST_TOTAL = PARTY_A.collateral + PARTY_B.collateral; // 15 KAS

console.log('Setup: Party A locked 10 KAS, Party B locked 5 KAS, FROST total: 15 KAS\n');

// Test current (broken for simple collateral)
test('Current: single output sends ALL to one address', () => {
  const result = completeFrostAndBroadcastCurrent({
    recipientAddress: PARTY_A.address,
    amountSompi: FROST_TOTAL,
  });
  assert(result.outputCount === 1);
  assert(result.outputs[0].amount === FROST_TOTAL, 'All 15 KAS goes to one person');
});

// Test new: two-output for simple collateral
test('NEW: two outputs — each party gets their collateral back', () => {
  const result = completeFrostAndBroadcastV2({
    frostAddress: {},
    myPrivateKeyHex: 'abc',
    amountSompi: FROST_TOTAL,
    recipients: [
      { address: PARTY_A.address, amount: PARTY_A.collateral },
      { address: PARTY_B.address, amount: PARTY_B.collateral },
    ],
  });
  assert(result.success);
  assert(result.outputCount === 2, 'Expected 2 outputs');
  assert(result.outputs[0].address === PARTY_A.address);
  assert(result.outputs[0].amount === PARTY_A.collateral, 'Party A should get 10 KAS');
  assert(result.outputs[1].address === PARTY_B.address);
  assert(result.outputs[1].amount === PARTY_B.collateral, 'Party B should get 5 KAS');
});

test('NEW: backward compatible — single recipient still works', () => {
  const result = completeFrostAndBroadcastV2({
    frostAddress: {},
    myPrivateKeyHex: 'abc',
    recipientAddress: PARTY_A.address,
    amountSompi: FROST_TOTAL,
  });
  assert(result.success);
  assert(result.outputCount === 1);
  assert(result.outputs[0].amount === FROST_TOTAL);
});

test('GUARD: output total exceeding FROST balance rejected', () => {
  const result = completeFrostAndBroadcastV2({
    frostAddress: {},
    myPrivateKeyHex: 'abc',
    amountSompi: FROST_TOTAL,
    recipients: [
      { address: PARTY_A.address, amount: 20n * 100000000n }, // 20 KAS > 15 KAS
      { address: PARTY_B.address, amount: 5n * 100000000n },
    ],
  });
  assert(result.success === false);
  assert(result.error.includes('exceeds'));
});

test('GUARD: empty recipients falls back to single output', () => {
  const result = completeFrostAndBroadcastV2({
    frostAddress: {},
    myPrivateKeyHex: 'abc',
    recipientAddress: PARTY_B.address,
    amountSompi: FROST_TOTAL,
    recipients: [],
  });
  assert(result.success);
  assert(result.outputCount === 1);
});

// Test the full simple collateral release flow
test('Full simple collateral: both tap Complete → two-output release', () => {
  // Both parties tap "Complete Agreement"
  const partyAApproved = true;
  const partyBApproved = true;

  assert(partyAApproved && partyBApproved, 'Both must approve');

  // Build two-output release
  const result = completeFrostAndBroadcastV2({
    frostAddress: { address: 'kaspatest:frost_abc123' },
    myPrivateKeyHex: 'privkey',
    amountSompi: FROST_TOTAL,
    counterpartyPartialSig: 'partial_sig_hex',
    recipients: [
      { address: PARTY_A.address, amount: PARTY_A.collateral },
      { address: PARTY_B.address, amount: PARTY_B.collateral },
    ],
  });

  assert(result.success);
  assert(result.outputCount === 2);

  // Simulate L1 balance changes
  l1Balances['frost'] = 0n;
  l1Balances[PARTY_A.address] = PARTY_A.collateral;
  l1Balances[PARTY_B.address] = PARTY_B.collateral;

  assert(l1Balances['frost'] === 0n, 'FROST emptied');
  assert(l1Balances[PARTY_A.address] === 10n * 100000000n, 'Party A got 10 KAS back');
  assert(l1Balances[PARTY_B.address] === 5n * 100000000n, 'Party B got 5 KAS back');
});

test('Trade agreement still uses single output (seller gets all)', () => {
  const tradeResult = completeFrostAndBroadcastV2({
    frostAddress: {},
    myPrivateKeyHex: 'abc',
    recipientAddress: PARTY_A.address, // seller
    amountSompi: FROST_TOTAL,
    // No recipients array = single output = trade mode
  });
  assert(tradeResult.success);
  assert(tradeResult.outputCount === 1);
  assert(tradeResult.outputs[0].amount === FROST_TOTAL, 'Seller gets everything in trade');
});

// ============================================================================
// PART 2: SESSION PERSISTENCE (survives Back/X)
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  PART 2: SESSION PERSISTENCE (survives Back/X)         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Current problem: onClose() calls clearAgreementSession()
// When user taps Back or X, session is wiped — can't recover

const AGR_SESSION_KEY = 'kv_agreement_session';

function saveAgreementSession(session) {
  asyncStorage[AGR_SESSION_KEY] = JSON.stringify(session);
}

function loadAgreementSession() {
  const json = asyncStorage[AGR_SESSION_KEY];
  return json ? JSON.parse(json) : null;
}

function clearAgreementSession() {
  delete asyncStorage[AGR_SESSION_KEY];
}

// NEW: archive instead of delete — move to completed/cancelled list
function archiveAgreementSession(reason) {
  const session = loadAgreementSession();
  if (!session) return;

  const archiveKey = 'kv_agreement_archive';
  const existing = asyncStorage[archiveKey] ? JSON.parse(asyncStorage[archiveKey]) : [];
  existing.push({ ...session, archivedAt: Date.now(), archiveReason: reason });
  // Keep last 20 archived sessions
  if (existing.length > 20) existing.shift();
  asyncStorage[archiveKey] = JSON.stringify(existing);

  // DON'T clear the active session on Back/X
  // Only clear on explicit "Complete" or "Cancel Agreement"
}

// NEW: clearAgreementSession only called on terminal states
function handleClose(step, reason) {
  if (step === 5 || step === 7) {
    // Terminal: transaction complete or mutual release done
    archiveAgreementSession('completed');
    clearAgreementSession();
    return 'cleared';
  } else if (reason === 'user_cancel_confirmed') {
    // User explicitly cancelled and confirmed
    archiveAgreementSession('cancelled');
    clearAgreementSession();
    return 'cleared';
  } else {
    // Back/X during active agreement — DO NOT clear
    // Session persists, user can resume
    return 'preserved';
  }
}

// Test session creation
const testSession = {
  step: 3,
  role: 'seller',
  agreementType: 'simple',
  contract: {
    agreementId: 'AGR_1778680000000',
    itemPriceKas: 10,
    sellerCommitmentKas: 5,
    multisigAddress: 'kaspatest:frost_abc',
    frostData: { address: 'kaspatest:frost_abc', network: 'testnet-10' },
    buyerPubkey: '02dd5b58...',
    sellerPubkey: '02e9c450...',
  },
  buyerLocked: false,
  sellerLocked: true,
  savedAt: Date.now(),
};

saveAgreementSession(testSession);

test('Session saved to AsyncStorage', () => {
  const loaded = loadAgreementSession();
  assert(loaded !== null);
  assert(loaded.step === 3);
  assert(loaded.contract.agreementId === 'AGR_1778680000000');
});

test('Back/X at step 3 preserves session', () => {
  const result = handleClose(3, 'back_button');
  assert(result === 'preserved');
  const loaded = loadAgreementSession();
  assert(loaded !== null, 'Session should still exist');
  assert(loaded.step === 3);
});

test('Back/X at step 4 preserves session', () => {
  const result = handleClose(4, 'x_button');
  assert(result === 'preserved');
  assert(loadAgreementSession() !== null);
});

test('Back/X at step 1 preserves session', () => {
  const result = handleClose(1, 'back_button');
  assert(result === 'preserved');
  assert(loadAgreementSession() !== null);
});

test('Complete (step 5) clears session', () => {
  const result = handleClose(5, 'complete');
  assert(result === 'cleared');
  assert(loadAgreementSession() === null, 'Session should be cleared after completion');
});

// Reset for next test
saveAgreementSession(testSession);

test('Mutual release (step 7) clears session', () => {
  const result = handleClose(7, 'mutual_release');
  assert(result === 'cleared');
  assert(loadAgreementSession() === null);
});

// Reset
saveAgreementSession(testSession);

test('Explicit cancel clears session', () => {
  const result = handleClose(3, 'user_cancel_confirmed');
  assert(result === 'cleared');
  assert(loadAgreementSession() === null);
});

// Reset
saveAgreementSession(testSession);

test('Archived sessions preserved', () => {
  handleClose(5, 'complete');
  const archive = JSON.parse(asyncStorage['kv_agreement_archive'] || '[]');
  assert(archive.length >= 1);
  assert(archive[archive.length - 1].contract.agreementId === 'AGR_1778680000000');
  assert(archive[archive.length - 1].archiveReason === 'completed');
});

// Test resume flow
saveAgreementSession({ ...testSession, step: 4 });

test('App reopen → session restored at step 4', () => {
  const loaded = loadAgreementSession();
  assert(loaded !== null);
  assert(loaded.step === 4);
  assert(loaded.contract.multisigAddress === 'kaspatest:frost_abc');
});

test('Session includes all needed data for resume', () => {
  const loaded = loadAgreementSession();
  assert(loaded.role === 'seller');
  assert(loaded.contract.frostData.address === 'kaspatest:frost_abc');
  assert(loaded.contract.buyerPubkey);
  assert(loaded.contract.sellerPubkey);
  assert(loaded.contract.agreementId);
});

// Test edge case: session from >24h ago
test('Stale session (>24h) still loads but flagged', () => {
  const staleSession = { ...testSession, savedAt: Date.now() - 25 * 60 * 60 * 1000 };
  saveAgreementSession(staleSession);
  const loaded = loadAgreementSession();
  assert(loaded !== null);
  const ageMs = Date.now() - loaded.savedAt;
  const isStale = ageMs > 24 * 60 * 60 * 1000;
  assert(isStale, 'Should be flagged as stale');
  // App can show "Resume stale agreement?" prompt
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n⚠️  FAILURES');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASS\n');

  console.log('--- TWO-OUTPUT RELEASE (Simple Collateral) ---');
  console.log('  completeFrostAndBroadcastV2 accepts:');
  console.log('    recipients: [{ address, amount }, ...]  → multi-output');
  console.log('    recipientAddress: string                → single output (backward compatible)');
  console.log('  Simple collateral: each party gets their own collateral back');
  console.log('  Trade: seller gets everything (unchanged)');

  console.log('\n--- SESSION PERSISTENCE ---');
  console.log('  Back/X at any step → session PRESERVED');
  console.log('  Step 5 (complete) → session CLEARED + archived');
  console.log('  Step 7 (mutual release) → session CLEARED + archived');
  console.log('  Explicit cancel → session CLEARED + archived');
  console.log('  App reopen → session restored at last step');
  console.log('  Stale sessions (>24h) → loaded but flagged for user prompt');

  console.log('\n--- PATCHES NEEDED ---');
  console.log('  frost_complete.ts:');
  console.log('    - completeFrostAndBroadcast: add recipients?: {address, amount}[] param');
  console.log('    - createPartialSigLocal: sign message with recipients array');
  console.log('  NeighborAgreement.tsx:');
  console.log('    - onClose: NEVER call clearAgreementSession on Back/X');
  console.log('    - Only clear on step 5, 7, or explicit user_cancel_confirmed');
  console.log('    - Add archiveAgreementSession for history');
  console.log('    - handleConfirmDelivery (simple): use recipients array');
}
