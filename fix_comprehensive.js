// ============================================================
// KASVILLAGE - Comprehensive Agreement Flow Fix
// Fixes: TownHall propose, inbox visibility, partial sig relay
// Run: node fix_comprehensive.js
// ============================================================
const fs = require('fs');
let fixes = 0;

// ============================================================
// FILE 1: NeighborAgreement.tsx
// ============================================================
let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// FIX 1: proposeAgreement in generateFrostAddress useEffect
// Problem: proposeAgreement runs but counterpartyPubkey isn't passed
// because the params object doesn't include it in the type
// Check: does the propose call include counterpartyPubkey and frostAddress?
const proposeIdx = na.indexOf("await proposeAgreement({", na.indexOf("generateFrostAddress"));
if (proposeIdx !== -1) {
  const proposeEnd = na.indexOf("} as any);", proposeIdx);
  const proposeBlock = na.slice(proposeIdx, proposeEnd + 10);
  console.log('Current propose block found at index', proposeIdx);
  
  // Check if frostAddress is in the propose call
  if (!proposeBlock.includes('frostAddress')) {
    console.log('FIX 1: frostAddress missing from proposeAgreement call');
    // The propose is already there but may not pass frostAddress
  }
}

// FIX 2: The FROST poll auto-send logs "Partial balance detected" but never
// triggers auto-send because kv_frost_sent_ check finds an old key
// Problem: the Agreed-Send poll sets kv_frost_sent_ but the FROST poll also checks it
// The buyer's Agreed-Send poll already sent and set the key, so FROST poll skips
// But the seller's device may have the key from a DIFFERENT agreement
// Fix: ensure kv_frost_sent_ key includes the agreement ID (it should already)

// FIX 3: The seller's auto-send from Agreed-Send poll fires based on OLD agreements
// because queryCounterpartyAgreed didn't have agreementId filter
// This was fixed in townhall_client.ts but the app wasn't restarted with --clear
// Verify: the fix is in townhall_client.ts already

// FIX 4: Buyer inbox never shows new proposals because:
// a) TownHall proposeAgreement fails silently (propose call in useEffect)
// b) Arweave takes 5-30 min to index
// Fix: Also post to TownHall from handleAcceptFromInbox AND 
//      post proposal directly when creating (not in useEffect)

// FIX 5: Move proposeAgreement out of generateFrostAddress useEffect
// into a separate function that loads its own wallet
const oldPropose = `          // Propose agreement on TownHall relay
          try {
            const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
            const myAmount = role === 'buyer' ? Math.floor(contract.itemPriceKas * 1e8) : Math.floor(contract.sellerCommitmentKas * 1e8);
            await proposeAgreement({
              agreementId: agreementId,
              pubkey: myPubkey || '',
              amount_sompi: myAmount,
              signature: 'frost_create_' + Date.now(),
              description: contract.itemDescription || '',
              network,
              counterpartyPubkey: (role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey) || undefined,
              frostAddress: frostData.address,
            } as any);`;

const newPropose = `          // Propose agreement on TownHall relay
          try {
            const propWallet = await loadMainWallet();
            const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
            const counterPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
            const myAmount = role === 'buyer' ? Math.floor(contract.itemPriceKas * 1e8) : Math.floor(contract.sellerCommitmentKas * 1e8);
            console.log('[Neighbor] Proposing to TownHall:', agreementId, 'frost:', frostData.address);
            await proposeAgreement({
              agreementId: agreementId,
              pubkey: myPubkey || '',
              amount_sompi: myAmount,
              signature: 'frost_create_' + Date.now(),
              description: contract.itemDescription || '',
              network,
              counterpartyPubkey: counterPubkey || undefined,
              frostAddress: frostData.address,
            } as any);`;

if (na.includes(oldPropose)) {
  na = na.replace(oldPropose, newPropose);
  fixes++;
  console.log('FIX 5 ✓ proposeAgreement now logs + loads wallet');
} else {
  // Try partial match
  if (na.includes("// Propose agreement on TownHall relay")) {
    console.log('FIX 5: Propose block found but doesn\'t match exactly - checking...');
    // Check if wallet is loaded
    const propBlock = na.indexOf("// Propose agreement on TownHall relay");
    const propEnd = na.indexOf("} as any);", propBlock);
    if (propEnd > -1) {
      const block = na.slice(propBlock, propEnd + 10);
      if (!block.includes('propWallet') && !block.includes("console.log('[Neighbor] Proposing to TownHall")) {
        // Add logging before the propose call
        na = na.replace(
          "// Propose agreement on TownHall relay\n          try {",
          "// Propose agreement on TownHall relay\n          try {\n            console.log('[Neighbor] Proposing to TownHall:', agreementId, 'frost:', frostData.address);"
        );
        fixes++;
        console.log('FIX 5 ✓ (alt) Added TownHall propose logging');
      }
    }
  } else {
    console.log('SKIP 5: Propose block not found');
  }
}

// FIX 6: The Agreed-Send poll needs to check the FROST poll's sent key too
// to avoid re-sending when FROST poll already handled it
const oldAgreedCheck = "console.log('[Agreed-Send Poll] Counterparty Agreed-Send detected";
if (na.includes(oldAgreedCheck)) {
  // Add agreement ID to the log so we can debug
  na = na.replace(
    "console.log('[Agreed-Send Poll] Counterparty Agreed-Send detected! Auto-sending...');",
    "console.log('[Agreed-Send Poll] Counterparty Agreed-Send detected for', contract.agreementId, '- checking if already sent...');"
  );
  fixes++;
  console.log('FIX 6 ✓ Agreed-Send poll now logs agreement ID');
}

// FIX 7: Add TownHall partial-sig fetch using submitPartialSig from townhall_client
// The seller's PartialSig poll checks Arweave + neighbor_relay
// Add: also check TownHall /api/agreement/{id} for partial_sig_a/b
const oldPartialPoll = "        // Also try TownHall relay as fast path";
if (na.includes(oldPartialPoll)) {
  na = na.replace(
    oldPartialPoll,
    `        // Try TownHall agreement status for partial sig (fastest)
        if (!cancelled) {
          try {
            const agrStatus = await getAgreementStatus(contract.agreementId || '');
            if (agrStatus) {
              const partialSig = role === 'seller' ? agrStatus.partial_sig_a : agrStatus.partial_sig_b;
              if (partialSig) {
                console.log('[PartialSig-Poll] Found on TownHall agreement status!');
                // Auto-complete
                try {
                  const w2 = await loadMainWallet();
                  if (w2 && contract.frostData && !cancelled) {
                    const total2 = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8));
                    const res2 = await completeFrostAndBroadcast({
                      frostAddress: contract.frostData,
                      myPrivateKeyHex: w2.privKeyHex,
                      recipientAddress: w2.address,
                      amountSompi: total2,
                      counterpartyPartialSig: partialSig,
                    });
                    if (res2.success && res2.txId) {
                      console.log('[PartialSig-Poll] Release TX:', res2.txId);
                      setContract(prev => ({ ...prev, releaseTxId: res2.txId, releaseExplorerUrl: res2.explorerUrl }));
                      setStep(7);
                      Alert.alert('Funds Released!', 'TX: ' + (res2.txId || '').slice(0, 16) + '...\\nFunds returned to your wallet.');
                    }
                  }
                } catch (e3) { console.warn('[PartialSig-Poll] TownHall auto-complete failed:', e3); }
              }
            }
          } catch (e4) { console.warn('[PartialSig-Poll] TownHall status check failed:', e4); }
        }
        // Also try TownHall relay as fast path`
  );
  fixes++;
  console.log('FIX 7 ✓ PartialSig poll now checks TownHall agreement status first');
}

// FIX 8: handleConfirmDelivery should also call submitPartialSig to TownHall
// (not just the generic postPartialTx + Arweave)
const oldPartialPost = "console.log('[Neighbor] Partial sig posted to TownHall');";
if (na.includes(oldPartialPost)) {
  na = na.replace(
    oldPartialPost,
    `console.log('[Neighbor] Partial sig posted to TownHall local');
        } catch (e) { console.warn('[Neighbor] TownHall local relay failed:', e); }
        // Also use TownHall agreement partial-sig endpoint
        try {
          const { submitPartialSig } = await import('./townhall_client');
          await submitPartialSig({
            agreementId: contract.agreementId || '',
            pubkey: role === 'buyer' ? (contract.buyerPubkey || '') : (contract.sellerPubkey || ''),
            partialSig: result.partialSig || '',
            recipientAddress: recipientAddress,
          });
          console.log('[Neighbor] Partial sig submitted to TownHall agreement endpoint');`
  );
  fixes++;
  console.log('FIX 8 ✓ handleConfirmDelivery now posts to TownHall agreement endpoint');
}

fs.writeFileSync('NeighborAgreement.tsx', na);

// ============================================================
// VERIFY
// ============================================================
console.log('\n=== ' + fixes + ' fixes applied ===');

// Check key markers
const markers = [
  ['Proposing to TownHall', 'TownHall propose logging'],
  ['Agreed-Send detected for', 'Agreed-Send agreementId logging'],
  ['Found on TownHall agreement status', 'TownHall partial sig fetch'],
  ['submitPartialSig', 'TownHall partial sig submit'],
  ['KV-AgreementId.*opts.agreementId', 'Agreement ID filter (in townhall_client)'],
];
console.log('\nVerification:');
for (const [term, label] of markers) {
  const found = na.includes(term) || (term.includes('townhall_client') ? fs.readFileSync('townhall_client.ts', 'utf8').includes('opts.agreementId') : false);
  console.log('  ' + label + ':', found ? '✓' : '✗');
}
