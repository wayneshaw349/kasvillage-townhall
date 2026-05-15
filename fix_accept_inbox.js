const fs = require('fs');
let code = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

const oldAccept = `      if (acceptResult?.success) {
        Alert.alert('Accepted', 'Agreement accepted! Setting up FROST address...');
        // Set contract state from the accepted agreement
        setContract(prev => ({
          ...prev,
          agreementId: agreement.agreementId || agreement.agreement_id,
          description: agreement.description || '',
          buyerPubkey: agreement.partyA?.pubkey || '',
          sellerPubkey: myPubkey,
          counterpartyPubkey: agreement.partyA?.pubkey || '',
          itemPriceKas: (agreement.partyA?.amount_sompi || 0) / 1e8,
          sellerCommitmentKas: (agreement.partyA?.amount_sompi || 0) / 1e8,
        }));
        setRole('seller');
        setAgreementType('trade');
        setStep(3); // Jump to FROST derivation / lock step`;

const newAccept = `      if (acceptResult?.success) {
        // Party A = seller (proposer), Party B = buyer (acceptor)
        const sellerPubkey = agreement.partyA?.pubkey || agreement.party_a?.pubkey || '';
        const sellerAmount = (agreement.partyA?.amount_sompi || agreement.party_a?.amount_sompi || 0) / 1e8;
        const agrId = agreement.agreementId || agreement.agreement_id || '';
        // Derive FROST address immediately with both pubkeys
        try {
          const frostData = await createFrostAgreement({
            pubkeyA: myPubkey,
            pubkeyB: sellerPubkey,
            network,
            agreementId: agrId,
          });
          console.log('[Neighbor] Inbox FROST address:', frostData.address);
          setContract(prev => ({
            ...prev,
            agreementId: agrId,
            description: agreement.description || '',
            buyerPubkey: myPubkey,
            sellerPubkey: sellerPubkey,
            counterpartyPubkey: sellerPubkey,
            itemPriceKas: sellerAmount,
            sellerCommitmentKas: sellerAmount,
            multisigAddress: frostData.address,
            frostData,
          }));
          Alert.alert('Accepted', 'FROST address ready!\\nTap Collateralize to lock ' + sellerAmount + ' KASPA.');
        } catch (e) {
          console.error('[Neighbor] FROST derivation failed:', e);
          Alert.alert('Error', 'FROST address derivation failed');
          return;
        }
        setRole('buyer');
        setAgreementType('trade');
        setStep(3); // Jump to lock step with FROST address ready`;

if (code.includes(oldAccept)) {
  code = code.replace(oldAccept, newAccept);
  console.log('OK: handleAcceptFromInbox fixed');
} else {
  // Try with snake_case version that might have been applied
  const oldAccept2 = oldAccept.replace(
    "agreement.partyA?.pubkey || ''",
    "agreement.partyA?.pubkey || agreement.party_a?.pubkey || ''"
  ).replace(
    "agreement.partyA?.amount_sompi || 0",
    "agreement.partyA?.amount_sompi || agreement.party_a?.amount_sompi || 0"
  ).replace(
    "agreement.agreementId || agreement.agreement_id",
    "agreement.agreementId || agreement.agreement_id || ''"
  );
  if (code.includes(oldAccept2)) {
    code = code.replace(oldAccept2, newAccept);
    console.log('OK: handleAcceptFromInbox fixed (snake_case version)');
  } else {
    console.log('WARN: Could not find handleAcceptFromInbox block to replace');
    console.log('Searching for partial match...');
    const idx = code.indexOf("Alert.alert('Accepted', 'Agreement accepted! Setting up FROST address...');");
    if (idx > 0) {
      console.log('Found Alert.alert at index', idx);
    } else {
      console.log('Alert not found either — manual fix needed');
    }
  }
}

fs.writeFileSync('NeighborAgreement.tsx', code);
console.log('Lines:', code.split('\n').length);
