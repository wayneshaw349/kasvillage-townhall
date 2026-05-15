const fs = require('fs');
const FILE = 'NeighborAgreement.tsx';
let c = fs.readFileSync(FILE, 'utf8');
let fixes = 0;

// ============================================================
// FIX: FROST balance poll should run on step 3 WITHOUT requiring
// buyerLocked/sellerLocked. The L1 balance IS the confirmation.
// If FROST has the expected funds, advance regardless of local state.
// ============================================================

const oldPollGuard = `    if (step !== 3 || !contract.multisigAddress) return;
    if (!buyerLocked && !sellerLocked) return; // only poll after own lock
    const expectedTotal = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8));
    if (expectedTotal <= 0n) return;`;

const newPollGuard = `    if (step !== 3 || !contract.multisigAddress) return;
    // L1 failsafe: poll FROST balance regardless of local lock state
    // If FROST has the expected funds, both parties sent — advance to step 4
    const expectedBuyer = BigInt(Math.floor(contract.itemPriceKas * 1e8));
    const expectedSeller = BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
    const expectedTotal = expectedBuyer + expectedSeller;
    if (expectedTotal <= 0n) return;`;

if (c.includes(oldPollGuard)) {
  c = c.replace(oldPollGuard, newPollGuard);
  fixes++;
  console.log('FIX 1 ✓ FROST poll no longer requires buyerLocked/sellerLocked');
} else {
  console.log('SKIP 1: Old poll guard not found');
}

// Also update the FROST poll to check for PARTIAL balance (one party sent)
// and show status, not just wait for full balance
const oldPollAction = `        if (frostBalance >= expectedTotal) {
          console.log('[FROST-Poll] Both parties confirmed! Advancing to step 4');
          setBuyerLocked(true);
          setSellerLocked(true);
          setStep(4);
        }`;

const newPollAction = `        if (frostBalance >= expectedTotal) {
          console.log('[FROST-Poll] Both parties confirmed! Advancing to step 4');
          setBuyerLocked(true);
          setSellerLocked(true);
          setStep(4);
        } else if (frostBalance > 0n && frostBalance >= expectedBuyer) {
          // At least one party sent — check if it's us or counterparty
          console.log('[FROST-Poll] Partial balance detected:', Number(frostBalance) / 1e8, 'KASPA');
          // If we haven't sent yet, the counterparty has — trigger our auto-send
          const mySentKey = 'kv_frost_sent_' + contract.agreementId;
          const mySent = await AsyncStorage.getItem(mySentKey);
          if (!mySent) {
            console.log('[FROST-Poll] Counterparty sent! Triggering our auto-send...');
            try {
              const wallet = await loadMainWallet();
              if (wallet && !cancelled) {
                const myAmount = role === 'buyer' ? expectedBuyer : expectedSeller;
                if (myAmount > 0n) {
                  const sendResult = await sendKaspaViaRest({
                    senderAddress: wallet.address,
                    recipientAddress: contract.multisigAddress || '',
                    amountSompi: myAmount,
                    privateKeyHex: wallet.privKeyHex,
                    network: wallet.network,
                  });
                  if (sendResult.success) {
                    await AsyncStorage.setItem(mySentKey, sendResult.txId || String(Date.now()));
                    console.log('[FROST-Poll] Our collateral sent! TX:', sendResult.txId);
                    try { const { markLocked } = await import('./utxo_ledger'); await markLocked(contract.agreementId || ''); } catch {}
                    if (role === 'buyer') { setBuyerLocked(true); } else { setSellerLocked(true); }
                    Alert.alert('Collateral Sent!', Number(myAmount) / 1e8 + ' KASPA sent to FROST.\\nTX: ' + (sendResult.txId || '').slice(0, 16));
                  } else {
                    console.warn('[FROST-Poll] Auto-send failed:', sendResult.error);
                    setCollateralFailed(true);
                  }
                }
              }
            } catch (e) { console.warn('[FROST-Poll] Auto-send error:', e); }
          }
        }`;

if (c.includes(oldPollAction)) {
  c = c.replace(oldPollAction, newPollAction);
  fixes++;
  console.log('FIX 2 ✓ FROST poll now triggers auto-send when counterparty detected on L1');
} else {
  console.log('SKIP 2: Old poll action not found');
}

// ============================================================
// Also need to import sendKaspaViaRest and loadMainWallet in the
// useEffect scope — they're already top-level imports so this is fine
// ============================================================

fs.writeFileSync(FILE, c);
console.log('\n=== ' + fixes + '/2 fixes applied ===');

// Verify
const hasOldGuard = c.includes('if (!buyerLocked && !sellerLocked) return;');
const hasNewGuard = c.includes('L1 failsafe: poll FROST balance regardless');
const hasAutoSend = c.includes('[FROST-Poll] Counterparty sent! Triggering our auto-send');
console.log('\nVerification:');
console.log('  Old guard removed:', !hasOldGuard ? '✓' : '✗ STILL PRESENT');
console.log('  New guard added:', hasNewGuard ? '✓' : '✗ MISSING');
console.log('  L1 auto-send:', hasAutoSend ? '✓' : '✗ MISSING');
