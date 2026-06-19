const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the Background-FROST polling loop where it updates frostActiveList
const marker = "setFrostActiveList(updatedList);";
const markerIdx = c.indexOf(marker);
if (markerIdx === -1) { console.log('Marker not found'); process.exit(1); }

// Insert auto-send recovery BEFORE setFrostActiveList
const recoverCode = `
        // === CRASH RECOVERY: auto-send if seller funded but buyer hasn't ===
        for (const entry of updatedList) {
          if (entry.step >= 4) continue; // already fully funded
          if (entry.role !== 'buyer') continue; // only buyer auto-sends from recovery
          const expectedBuyer = Math.floor(entry.buyerAmount * 1e8);
          const expectedSeller = Math.floor(entry.sellerAmount * 1e8);
          if (expectedBuyer <= 0 || expectedSeller <= 0) continue;
          try {
            const eUtxoResp = await fetch(apiBase + '/addresses/' + entry.frostAddr + '/utxos');
            if (!eUtxoResp.ok) continue;
            const eUtxos = await eUtxoResp.json();
            if (!Array.isArray(eUtxos) || eUtxos.length !== 1) continue; // exactly 1 UTXO = seller sent, buyer hasn't
            const sellerBal = Number(eUtxos[0]?.utxoEntry?.amount || '0');
            if (sellerBal < expectedSeller * 0.95) continue; // seller's amount ±5%
            // Check we haven't already sent (idempotent guard)
            const sentKey = 'kv_frost_poll_sent_' + entry.agrId;
            const alreadySent = await AsyncStorage.getItem(sentKey);
            if (alreadySent) { console.log('[Crash-Recovery] Already sent for', entry.agrId.slice(0,12)); continue; }
            // Auto-send buyer collateral
            const rWallet = await loadMainWallet();
            if (!rWallet?.privKeyHex) continue;
            console.log('[Crash-Recovery] Seller funded', entry.agrId.slice(0,12), '- auto-sending', expectedBuyer / 1e8, 'KAS');
            const { sendKaspaViaRest: sendRecover } = require('./kaspa_rest_tx');
            const rResult = await sendRecover({
              senderAddress: rWallet.address,
              recipientAddress: entry.frostAddr,
              amountSompi: BigInt(expectedBuyer),
              privateKeyHex: rWallet.privKeyHex,
              network: rWallet.network || 'testnet-10',
            });
            if (rResult.success) {
              await AsyncStorage.setItem(sentKey, rResult.txId || String(Date.now()));
              console.log('[Crash-Recovery] Buyer collateral TX:', rResult.txId);
              entry.step = 4; // mark as fully funded
            } else {
              console.warn('[Crash-Recovery] Send failed:', rResult.error);
            }
          } catch (e) { console.warn('[Crash-Recovery] Error for', entry.agrId.slice(0,12), ':', e); }
        }
`;

c = c.substring(0, markerIdx) + recoverCode + '\n        ' + c.substring(markerIdx);
console.log('Added crash recovery auto-send for buyer');
fs.writeFileSync('NeighborAgreement.tsx', c);
