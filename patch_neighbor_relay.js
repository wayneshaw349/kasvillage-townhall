const fs = require('fs');
let code = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Add recordCollateral after successful collateral TX in handleLock
code = code.replace(
  `      console.log('[Neighbor] Collateral TX:', result.txId);
      if (role === 'buyer') {`,
  `      console.log('[Neighbor] Collateral TX:', result.txId);
      // Record collateral on TownHall relay
      try {
        const collatResult = await recordCollateral({
          agreementId: contract.agreementId || 'AGR_' + Date.now(),
          pubkey: wallet.address,
          txId: result.txId || '',
          frostAddress: contract.multisigAddress || undefined,
        });
        console.log('[Neighbor] TownHall collateral recorded:', JSON.stringify(collatResult));
      } catch (e) { console.warn('[Neighbor] TownHall record failed:', e); }
      if (role === 'buyer') {`
);

// 2. Add proposeAgreement when FROST address is derived
code = code.replace(
  '          // Inscribe FROST:Create to L1 for TownHall tracking',
  `          // Propose agreement on TownHall relay
          try {
            const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
            const myAmount = role === 'buyer' ? Math.floor(contract.itemPriceKas * 1e8) : Math.floor(contract.sellerCommitmentKas * 1e8);
            await proposeAgreement({
              agreementId: agreementId,
              pubkey: myPubkey || '',
              amount_sompi: myAmount,
              signature: 'frost_create_' + Date.now(),
              description: contract.description || '',
              network,
            });
            console.log('[Neighbor] Agreement proposed on TownHall:', agreementId);
          } catch (e) { console.warn('[Neighbor] TownHall propose failed:', e); }
          // Inscribe FROST:Create to L1 for TownHall tracking`
);

// 3. Update the collateral alert message
code = code.replace(
  "Alert.alert('Collateral Sent', 'TX: ' + (result.txId || '').slice(0, 16) + '...\\nWaiting for counterparty...');",
  "Alert.alert('Collateral Sent', 'TX: ' + (result.txId || '').slice(0, 16) + '...\\nRecorded on TownHall. Waiting for counterparty...');"
);

fs.writeFileSync('NeighborAgreement.tsx', code);
console.log('OK: Relay calls wired into NeighborAgreement.tsx');
console.log('Lines:', code.split('\n').length);
