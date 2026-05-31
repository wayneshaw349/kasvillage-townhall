const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the wrongly-replaced FROST-Poll
const marker = `// Poll FROST address balance`;
const idx = f.indexOf(marker);
if (idx < 0) { console.log('FROST-Poll marker not found'); process.exit(1); }

// Find the useEffect containing it
const ueStart = f.lastIndexOf('useEffect(', idx);
// Find closing }, [...]);
let depth = 0, ueEnd = -1;
const body = f.indexOf('{', ueStart);
for (let i = body; i < f.length; i++) {
  if (f[i] === '{') depth++;
  if (f[i] === '}') { depth--; if (depth === 0) { ueEnd = f.indexOf(';', i) + 1; break; } }
}

if (ueEnd < ueStart) { console.log('Could not find end of useEffect'); process.exit(1); }

const oldBlock = f.substring(ueStart, ueEnd);
console.log('Old block:', oldBlock.length, 'chars, starts at line', f.substring(0, ueStart).split('\n').length);

const newFrostPoll = `useEffect(() => {
    // Poll FROST address balance — auto-advance to step 4 when both confirmed
    if (step !== 3 || !contract.multisigAddress || !contract.agreementId) return;
    if (!contract.buyerPubkey || !contract.sellerPubkey) return;

    let cancelled = false;
    const expectedBuyer = Math.floor(contract.itemPriceKas * 1e8);
    const expectedSeller = Math.floor(contract.sellerCommitmentKas * 1e8);
    const expectedTotal = expectedBuyer + expectedSeller;
    console.log('[FROST-Poll] Expected: buyer=', expectedBuyer / 1e8, 'seller=', expectedSeller / 1e8, 'total=', expectedTotal / 1e8);

    const pollBalance = async () => {
      if (cancelled) return;
      try {
        const networkStr = contract.frostData?.network || 'testnet-10';
        const apiBase = networkStr.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        
        // Check FROST address balance
        const balResp = await fetch(apiBase + '/addresses/' + contract.multisigAddress + '/balance');
        if (!balResp.ok || cancelled) return;
        const balData = await balResp.json();
        const balance = Number(balData.balance || '0');

        if (balance >= expectedTotal && expectedTotal > 0) {
          console.log('[FROST-Poll] Balance:', balance / 1e8, 'KASPA, expected:', expectedTotal / 1e8);
          console.log('[FROST-Poll] Both parties confirmed! Advancing to step 4');
          if (!cancelled) {
            setBuyerLocked(true);
            setSellerLocked(true);
            setStep(4);
            // Update FROST active list
            updateFrostEntry(contract.agreementId || '', { step: 4 });
          }
          return;
        }

        // Partial balance: one party sent, auto-send ours if needed
        if (balance > 0 && balance < expectedTotal) {
          console.log('[FROST-Poll] Partial balance:', balance / 1e8, 'KASPA');
          
          // Check if WE need to send
          const myExpected = role === 'buyer' ? expectedBuyer : expectedSeller;
          const otherExpected = role === 'buyer' ? expectedSeller : expectedBuyer;
          
          // If other party sent their part, auto-send ours
          if (balance >= otherExpected && myExpected > 0) {
            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;
            const alreadySent = await AsyncStorage.getItem(sentKey);
            if (!alreadySent && !cancelled) {
              try {
                const wallet = await loadMainWallet();
                if (!wallet || cancelled) return;
                console.log('[FROST-Poll] Counterparty sent! Auto-sending', myExpected / 1e8, 'KASPA');
                const sendResult = await sendKaspaViaRest({
                  senderAddress: wallet.address,
                  recipientAddress: contract.multisigAddress || '',
                  amountSompi: BigInt(myExpected),
                  privateKeyHex: wallet.privKeyHex,
                  network: wallet.network || 'testnet-10',
                });
                if (sendResult.success) {
                  await AsyncStorage.setItem(sentKey, sendResult.txId || String(Date.now()));
                  console.log('[FROST-Poll] Auto-sent! TX:', sendResult.txId);
                  if (role === 'buyer') { setBuyerLocked(true); setContract(prev => ({ ...prev, buyerLockTxId: sendResult.txId })); }
                  else { setSellerLocked(true); setContract(prev => ({ ...prev, sellerLockTxId: sendResult.txId })); }
                  // Record on TownHall
                  recordCollateral({ agreementId: contract.agreementId || '', pubkey: wallet.address, txId: sendResult.txId || '', frostAddress: contract.multisigAddress || '' }).catch(() => {});
                  // Merkle proof
                  uploadPerTxProof({ txId: sendResult.txId || '', txIndex: 0, amountSompi: BigInt(myExpected), scriptPubKey: '', daaScore: 0, txType: 'collateral', balanceAfter: 0, agreementId: contract.agreementId, uploadFn: async (data, tags) => { const r = await uploadToIrys(data, tags); return r.txId || ''; }, network: 'testnet' }).catch(() => {});
                } else {
                  console.warn('[FROST-Poll] Auto-send failed:', sendResult.error);
                }
              } catch (e) { console.warn('[FROST-Poll] Auto-send error:', e); }
            }
          }
        } else {
          console.log('[FROST-Poll] Balance:', balance / 1e8, 'KASPA, expected:', expectedTotal / 1e8);
        }
      } catch (e) { console.warn('[FROST-Poll] Error:', e); }
    };

    pollBalance();
    const interval = setInterval(pollBalance, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, contract.agreementId, contract.multisigAddress, role, contract.buyerPubkey, contract.sellerPubkey, contract.itemPriceKas, contract.sellerCommitmentKas])`;

f = f.substring(0, ueStart) + newFrostPoll + f.substring(ueEnd);

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('FROST-Poll restored');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify
console.log('\n--- Verification ---');
console.log('FROST-Poll present:', f.includes('[FROST-Poll] Expected:'));
console.log('Auto-send in poll:', f.includes('[FROST-Poll] Auto-sent!'));
console.log('Step 4 advance:', f.includes('Advancing to step 4'));
console.log('PartialSig-Poll still disabled:', f.includes('Poll Arweave for counterparty'));
