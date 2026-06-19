const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Remove the |TRACK: append from clipboard — keep response pure crypto
const trackAppend = "const _withTrack = sellerTrackingNum.trim() ? result.responseB64 + '|TRACK:' + sellerTrackingNum.trim() : result.responseB64;";
if (c.includes(trackAppend)) {
  c = c.replace(trackAppend + "\n                            try { await Clipboard.setStringAsync(_withTrack); } catch {}", 
    "try { await Clipboard.setStringAsync(result.responseB64); } catch {}");
  console.log('1. Removed |TRACK: from clipboard — pure crypto only');
}

// 2. Also remove the buyer-side tracking extraction (no longer needed)
const trackExtract = "// Extract tracking number if appended";
const trackExtractIdx = c.indexOf(trackExtract);
if (trackExtractIdx > -1) {
  const extractEnd = c.indexOf("const resp = parseResponse(pastedText);", trackExtractIdx);
  if (extractEnd > -1) {
    c = c.substring(0, trackExtractIdx) + c.substring(extractEnd);
    console.log('2. Removed buyer tracking extraction');
  }
}

// 3. Update the tracking field label with clear instructions
const oldLabel = "Tracking Number (optional)</Text>";
if (c.includes(oldLabel)) {
  c = c.replace(oldLabel, 
    'Tracking Number (optional)</Text>\n                        <Text style={{ fontSize: 10, color: \'#15803d\', marginBottom: 4 }}>{"Saved permanently to Arweave as proof of shipment.\\nShare tracking separately in your DM — do NOT paste it with your signed response."}</Text>');
  console.log('3. Added instruction text under tracking label');
}

// 4. Add tracking field for BUYER too (step 5 buyer side) — for receipt/confirmation number
const buyerTemplate = "Build TX Template (generates k + R)";
const buyerTemplateIdx = c.indexOf(buyerTemplate);
if (buyerTemplateIdx > -1) {
  const buyerFieldInsert = c.lastIndexOf("<TouchableOpacity onPress={buildReleaseTemplate}", buyerTemplateIdx);
  if (buyerFieldInsert > -1) {
    const buyerTrackingField = `<View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 2 }}>Confirmation / Receipt # (optional)</Text>
                        <Text style={{ fontSize: 10, color: '#4338ca', marginBottom: 4 }}>{"Saved to Arweave as proof you received the item.\\nShare separately in DM — do NOT mix with signed response."}</Text>
                        <TextInput
                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1c1917' }}
                          placeholder="e.g. delivery confirmed, receipt #, etc."
                          placeholderTextColor="#a8a29e"
                          value={sellerTrackingNum}
                          onChangeText={setSellerTrackingNum}
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                      </View>
                      `;
    // Check if already added
    if (!c.includes("Confirmation / Receipt #")) {
      c = c.substring(0, buyerFieldInsert) + buyerTrackingField + c.substring(buyerFieldInsert);
      console.log('4. Added buyer confirmation field');
    }
  }
}

// 5. Inscribe buyer's confirmation to Arweave on release TX success
const releaseTxSuccess = "console.log('[Ceremony-Buyer] Release TX:', txId);";
const releaseIdx = c.indexOf(releaseTxSuccess);
if (releaseIdx > -1 && !c.includes("buyer_confirmed_")) {
  const buyerInscription = `
        // Inscribe buyer confirmation to Arweave (dispute evidence)
        if (sellerTrackingNum.trim()) {
          try {
            const _bPk = (await SecureStore.getItemAsync('kv_public_key')) || '';
            await inscribeAgreementToArweave({
              agreementId: contract.agreementId || '',
              pubkey: _bPk,
              amount_sompi: Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8),
              description: 'Buyer confirmed: ' + sellerTrackingNum.trim(),
              network: 'testnet-10',
              status: 'Confirmed',
              frostAddress: contract.multisigAddress || '',
              signature: 'buyer_confirmed_' + Date.now(),
              counterpartyPubkey: contract.sellerPubkey || '',
              buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
              sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
              trackingNumber: sellerTrackingNum.trim(),
            });
            console.log('[Ceremony-Buyer] Confirmation inscribed to Arweave:', sellerTrackingNum.trim());
          } catch (e) { console.warn('[Ceremony-Buyer] Arweave inscription failed:', e); }
        }
`;
  c = c.substring(0, releaseIdx + releaseTxSuccess.length) + buyerInscription + c.substring(releaseIdx + releaseTxSuccess.length);
  console.log('5. Added buyer confirmation Arweave inscription');
}

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
