// patch_agreement_flow.js
// Patches NeighborAgreement.tsx with the Agreed-Send mutual polling flow
const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let changes = 0;

// ============================================================================
// PATCH 1: Replace counterparty gate with Agreed-Send + FROST derive (no auto-send)
// ============================================================================
const oldGate = `      // Step 2: Check if counterparty also agreed
      const counterpartyAgreed = await queryCounterpartyAgreed({
        agreementId: agrId,
        counterpartyPubkey: sellerPubkey,
        myPubkey: myPubkey,
      });
      console.log('[Neighbor] Counterparty agreed?', counterpartyAgreed);

      if (!counterpartyAgreed) {
        Alert.alert('Agreed!', 'Waiting for counterparty to agree.\\nRefresh inbox to check.');
        setIsLoading(false);
        return;
      }

      // Step 3: Both agreed`;

const newGate = `      // Step 2: Buyer accepted — derive FROST + wait for mutual Agreed-Send poll to trigger auto-send
      console.log('[Neighbor] Buyer accepted — deriving FROST, auto-send via poll');
      setInboxAgreements(prev => prev.filter(a => (a.agreementId || a.agreement_id) !== agrId));

      // Proceed to FROST derivation`;

if (c.includes('Step 2: Check if counterparty also agreed')) {
  c = c.replace(oldGate, newGate);
  changes++;
  console.log('PATCH 1: Counterparty gate replaced with Agreed-Send flow');
} else {
  console.log('PATCH 1: SKIP — target not found');
}

// ============================================================================
// PATCH 2: Replace auto-send block with "set state + let poll handle send"
// After FROST derivation, instead of immediately sending, set contract state
// and let the polling useEffect trigger the actual send
// ============================================================================
const oldAutoSend = `          // Auto-send collateral to FROST
          const myLockAmount = BigInt(Math.floor(sellerAmount * 1e8));`;

const newAutoSend = `          // Mark agreement ready — poll will trigger auto-send when counterparty's Agreed-Send detected
          const myLockAmount = BigInt(Math.floor(sellerAmount * 1e8));
          // Reduce spendable via ledger (input cap)
          try {
            const { commitForCollateral } = await import('./utxo_ledger');
            await commitForCollateral(wallet.address, myLockAmount > 0n ? myLockAmount : 0n, agrId);
            console.log('[Neighbor] Spendable reduced for', agrId);
          } catch (e) { console.warn('[Neighbor] Ledger commit skipped:', e); }`;

if (c.includes('// Auto-send collateral to FROST\n          const myLockAmount')) {
  // Only replace the first occurrence (in handleAcceptFromInbox)
  const idx = c.indexOf(oldAutoSend);
  if (idx !== -1) {
    c = c.slice(0, idx) + newAutoSend + c.slice(idx + oldAutoSend.length);
    changes++;
    console.log('PATCH 2: Auto-send replaced with ledger commit + poll trigger');
  }
} else {
  console.log('PATCH 2: SKIP — target not found');
}

// ============================================================================
// PATCH 3: Add Agreed-Send polling useEffect
// Polls Arweave for counterparty's "Agreed-Send" inscription
// When found, triggers auto-send to FROST
// ============================================================================
const pollInsertPoint = `  // Poll FROST address balance`;

const agreedSendPoll = `  // Poll for counterparty's Agreed-Send on Arweave — triggers auto-send
  useEffect(() => {
    if (step < 3 || !contract.agreementId || !contract.multisigAddress) return;
    if (!contract.buyerPubkey || !contract.sellerPubkey) return;
    // Don't poll if already on step 4+ (both confirmed)
    if (step >= 4) return;

    let cancelled = false;
    const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
    const counterpartyPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;

    const pollAgreedSend = async () => {
      if (cancelled) return;
      try {
        // Check Arweave for counterparty's Agreed-Send
        const found = await queryCounterpartyAgreed({
          agreementId: contract.agreementId || '',
          counterpartyPubkey: counterpartyPubkey || '',
          myPubkey: myPubkey || '',
        });
        if (!found || cancelled) return;

        console.log('[Agreed-Send Poll] Counterparty Agreed-Send detected! Auto-sending...');

        // Inscribe our own Agreed-Send if not already done
        const ownAgreedKey = 'kv_agreed_send_' + contract.agreementId;
        const alreadySent = await AsyncStorage.getItem(ownAgreedKey);
        if (!alreadySent) {
          try {
            await inscribeAgreementToArweave({
              agreementId: contract.agreementId || '',
              pubkey: myPubkey || '',
              amount_sompi: Math.floor((role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas) * 1e8),
              description: contract.itemDescription || '',
              network: 'testnet-10',
              status: 'Agreed-Send',
              signature: 'agreed_send_' + Date.now(),
              counterpartyPubkey: counterpartyPubkey,
            });
            await AsyncStorage.setItem(ownAgreedKey, String(Date.now()));
            console.log('[Agreed-Send Poll] Own Agreed-Send inscribed');
          } catch (e) { console.warn('[Agreed-Send Poll] Inscription failed:', e); }
        }

        // Auto-send to FROST
        try {
          const wallet = await loadMainWallet();
          if (!wallet || cancelled) return;
          const myAmount = role === 'buyer'
            ? BigInt(Math.floor(contract.itemPriceKas * 1e8))
            : BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
          if (myAmount <= 0n) return;

          // Check if we already sent (idempotent)
          const sentKey = 'kv_frost_sent_' + contract.agreementId;
          const alreadyFrostSent = await AsyncStorage.getItem(sentKey);
          if (alreadyFrostSent) {
            console.log('[Agreed-Send Poll] Already sent to FROST, skipping');
            return;
          }

          console.log('[Agreed-Send Poll] Sending', Number(myAmount) / 1e8, 'KASPA to FROST:', contract.multisigAddress);
          const sendResult = await sendKaspaViaRest({
            senderAddress: wallet.address,
            recipientAddress: contract.multisigAddress || '',
            amountSompi: myAmount,
            privateKeyHex: wallet.privKeyHex,
            network: wallet.network,
          });

          if (sendResult.success) {
            await AsyncStorage.setItem(sentKey, sendResult.txId || String(Date.now()));
            console.log('[Agreed-Send Poll] FROST TX confirmed:', sendResult.txId);
            try { const { markLocked } = await import('./utxo_ledger'); await markLocked(contract.agreementId || ''); } catch {}
            // Merkle proof (fire-and-forget)
            uploadPerTxProof({
              txId: sendResult.txId || '', txIndex: 0, amountSompi: myAmount,
              scriptPubKey: '', daaScore: 0, txType: 'collateral', balanceAfter: 0,
              agreementId: contract.agreementId,
              uploadFn: async (data, tags) => { const r = await uploadToIrys(data, tags); return r.txId || ''; },
              network: 'testnet',
            }).catch(() => {});
            recordCollateral({ agreementId: contract.agreementId || '', pubkey: wallet.address, txId: sendResult.txId || '', frostAddress: contract.multisigAddress || '' }).catch(() => {});
            if (role === 'buyer') { setBuyerLocked(true); setContract(prev => ({ ...prev, buyerLockTxId: sendResult.txId })); }
            else { setSellerLocked(true); setContract(prev => ({ ...prev, sellerLockTxId: sendResult.txId })); }
            Alert.alert('Collateral Sent!', Number(myAmount) / 1e8 + ' KASPA locked to FROST.\\nTX: ' + (sendResult.txId || '').slice(0, 16) + '...');
          } else {
            console.warn('[Agreed-Send Poll] Send failed:', sendResult.error);
            Alert.alert('Auto-Send Failed', sendResult.error || 'Will retry on next poll.');
          }
        } catch (e) { console.warn('[Agreed-Send Poll] Auto-send error:', e); }
      } catch (e) { console.warn('[Agreed-Send Poll] Error:', e); }
    };

    // Poll every 30 seconds (Arweave indexing takes 5-30 min)
    pollAgreedSend(); // immediate first check
    const interval = setInterval(pollAgreedSend, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, contract.agreementId, contract.multisigAddress, contract.buyerPubkey, contract.sellerPubkey, role]);

  // Poll FROST address balance`;

if (c.includes(pollInsertPoint)) {
  c = c.replace(pollInsertPoint, agreedSendPoll);
  changes++;
  console.log('PATCH 3: Agreed-Send polling useEffect added');
} else {
  console.log('PATCH 3: SKIP — insert point not found');
}

// ============================================================================
// PATCH 4: Seller's propose flow — inscribe with FROST address
// Add FROST address to the proposal inscription tags
// ============================================================================
const oldPropose = `              description: contract.itemDescription || '',
              network,
              counterpartyPubkey: (role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey) || undefined,
            } as any);`;

const newPropose = `              description: contract.itemDescription || '',
              network,
              counterpartyPubkey: (role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey) || undefined,
              frostAddress: frostData.address,
            } as any);
            // Reduce spendable for proposer (input cap)
            try {
              const { commitForCollateral } = await import('./utxo_ledger');
              const proposeAmount = role === 'buyer' ? BigInt(Math.floor(contract.itemPriceKas * 1e8)) : BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
              if (proposeAmount > 0n) await commitForCollateral(wallet?.address || '', proposeAmount, agreementId);
            } catch (e) { console.warn('[Neighbor] Proposer ledger commit skipped:', e); }`;

if (c.includes('frostAddress: frostData.address,\n            } as any);')) {
  console.log('PATCH 4: SKIP — already has frostAddress');
} else if (c.includes(oldPropose)) {
  c = c.replace(oldPropose, newPropose);
  changes++;
  console.log('PATCH 4: Proposer flow updated with FROST address + input cap');
} else {
  console.log('PATCH 4: SKIP — target not found');
}

// ============================================================================
// PATCH 5: handleLock — check FROST balance before allowing manual lock
// Proposer waits for counterparty funds before locking
// ============================================================================
const oldLockCheck = `      if (!contract.multisigAddress) { Alert.alert('Error', 'FROST address not ready'); setIsLoading(false); return; }`;

const newLockCheck = `      if (!contract.multisigAddress) { Alert.alert('Error', 'FROST address not ready'); setIsLoading(false); return; }

      // Safety: check if counterparty has sent to FROST before allowing manual lock
      try {
        const nStr = await SecureStore.getItemAsync('kaspa_network');
        const aBase = nStr?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const fResp = await fetch(aBase + '/addresses/' + contract.multisigAddress + '/balance');
        if (fResp.ok) {
          const fBal = await fResp.json();
          if (BigInt(fBal.balance || '0') === 0n) {
            Alert.alert('Waiting for Counterparty', 'Counterparty has not sent collateral yet.\\nPolling every 30 seconds — auto-send will trigger when they do.');
            setIsLoading(false);
            return;
          }
        }
      } catch {}`;

if (c.includes(oldLockCheck) && !c.includes('Safety: check if counterparty has sent')) {
  c = c.replace(oldLockCheck, newLockCheck);
  changes++;
  console.log('PATCH 5: Manual lock now checks FROST balance first');
} else {
  console.log('PATCH 5: SKIP — already applied or target not found');
}

// ============================================================================
// PATCH 6: Disable Accept button during loading (prevent multi-tap spam)
// ============================================================================
const oldAcceptBtn = `                    <TouchableOpacity
                      onPress={() => handleAcceptFromInbox(agr)}
                      style={{ backgroundColor: '#059669', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFF', fontSize: rs.font(12), fontWeight: 'bold' }}>Accept Agreement</Text>
                    </TouchableOpacity>`;

const newAcceptBtn = `                    <TouchableOpacity
                      onPress={() => handleAcceptFromInbox(agr)}
                      disabled={isLoading}
                      style={{ backgroundColor: isLoading ? '#888' : '#059669', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color='#FFF' size='small' />
                      ) : (
                        <Text style={{ color: '#FFF', fontSize: rs.font(12), fontWeight: 'bold' }}>Accept Agreement</Text>
                      )}
                    </TouchableOpacity>`;

if (c.includes("onPress={() => handleAcceptFromInbox(agr)}\n                      style=")) {
  c = c.replace(oldAcceptBtn, newAcceptBtn);
  changes++;
  console.log('PATCH 6: Accept button disabled during loading');
} else {
  console.log('PATCH 6: SKIP — target not found or already applied');
}

// ============================================================================
// PATCH 7: Update Agreed-Send status in Arweave inscription
// Change the buyer's inscription from "Agreed" to "Agreed-Send"
// ============================================================================
const oldAgreedStatus = `          status: 'Agreed',
          signature: 'agree_' + Date.now(),`;

const newAgreedStatus = `          status: 'Agreed-Send',
          signature: 'agreed_send_' + Date.now(),`;

if (c.includes(oldAgreedStatus)) {
  c = c.replace(oldAgreedStatus, newAgreedStatus);
  changes++;
  console.log('PATCH 7: Buyer inscription status changed to Agreed-Send');
} else {
  console.log('PATCH 7: SKIP — target not found');
}

// ============================================================================
// WRITE
// ============================================================================
fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('\n=== DONE: ' + changes + ' patches applied ===');
