const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// === FIX 1: Add seller step 5 UI (paste buyer template → sellerSignTemplate → copy response) ===
// Find the step 5 section and add seller-specific buttons
const step5Marker = "{'Build TX Template (generates k + R)'}";
const step5Idx = f.indexOf(step5Marker);
if (step5Idx < 0) { console.log('Step 5 marker not found'); process.exit(1); }

// Find the <View> containing the buyer buttons
const viewStart = f.lastIndexOf('<View style={{ marginBottom: 16, gap: 8 }}>', step5Idx);
const viewEnd = f.indexOf('</View>', step5Idx + step5Marker.length);
if (viewStart < 0 || viewEnd < 0) { console.log('Step 5 View not found'); process.exit(1); }

const oldStep5Buttons = f.substring(viewStart, viewEnd + '</View>'.length);
console.log('Found step 5 buttons:', oldStep5Buttons.length, 'chars');

const newStep5Buttons = `<View style={{ marginBottom: 16, gap: 8 }}>
                  {role === 'buyer' ? (
                    <>
                      <TouchableOpacity onPress={buildReleaseTemplate} style={{ backgroundColor: '#059669', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Build TX Template (generates k + R)'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={processSellerResponse} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Paste Seller Response'}</Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center' }}>{'k lives only during this signing ceremony (~seconds)'}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>Paste Buyer Template</Text>
                      <Text style={{ fontSize: 11, color: '#4338ca', marginBottom: 8 }}>The buyer sends a TX template. Paste it below to co-sign.</Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', minHeight: 60, marginBottom: 8 }}
                        placeholder="Paste buyer template here (base64)..."
                        placeholderTextColor="#a8a29e"
                        multiline
                        onChangeText={async (txt) => {
                          const v = txt.trim();
                          if (v.length < 20) return;
                          try {
                            setIsLoading(true);
                            const wallet = await loadMainWallet();
                            if (!wallet) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }
                            
                            // Parse and sign
                            const tmpl = parseTemplate(v);
                            if (!tmpl) { Alert.alert('Error', 'Invalid template format'); setIsLoading(false); return; }
                            
                            const result = sellerSignTemplate({
                              privateKeyHex: wallet.privKeyHex,
                              sellerPubkey: contract.sellerPubkey || '',
                              buyerPubkey: contract.buyerPubkey || '',
                              counter: contract.frostData?.frostCounter || 0,
                              template: tmpl,
                            });
                            
                            if ('error' in result) {
                              Alert.alert('Verification Failed', result.error);
                              setIsLoading(false);
                              return;
                            }
                            
                            // Copy response to clipboard
                            try { await Clipboard.setStringAsync(result.responseB64); } catch {}
                            
                            console.log('[Ceremony-Seller] Signed! Response:', result.responseB64.length, 'chars');
                            console.log('[Ceremony-Seller] My amount:', Number(result.verification.myAmount) / 1e8, 'KAS');
                            Alert.alert(
                              'Signed! Response Copied',
                              'Your co-signature is on the clipboard.\\nSend it back to the buyer.\\n\\nYour share: ' + (Number(result.verification.myAmount) / 1e8).toFixed(4) + ' KAS',
                              [{ text: 'OK' }]
                            );
                          } catch (e) {
                            console.error('[Ceremony-Seller] Error:', e);
                            Alert.alert('Error', e instanceof Error ? e.message : 'Sign failed');
                          } finally { setIsLoading(false); }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {isLoading && <ActivityIndicator color="#4f46e5" />}
                      <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center' }}>{'Seller k is born and destroyed within the sign call (~ms)'}</Text>
                    </>
                  )}
                </View>`;

f = f.substring(0, viewStart) + newStep5Buttons + f.substring(viewEnd + '</View>'.length);
fixes++;
console.log('FIX 1: Added seller step 5 UI (paste template → sellerSignTemplate → clipboard)');

// === FIX 2: Fix double-send in FROST-Poll (only buyer auto-sends, seller already sent from accept) ===
const doubleSendMarker = "// Partial balance: one party sent, auto-send ours if needed";
const dsIdx = f.indexOf(doubleSendMarker);
if (dsIdx >= 0) {
  // Add role check before the auto-send block
  const autoSendLine = f.indexOf("if (balance >= otherExpected && myExpected > 0)", dsIdx);
  if (autoSendLine >= 0) {
    f = f.replace(
      "if (balance >= otherExpected && myExpected > 0)",
      "// Only BUYER auto-sends from poll. Seller already sent from handleAcceptFromInbox.\n          if (role === 'buyer' && balance >= otherExpected && myExpected > 0)"
    );
    fixes++;
    console.log('FIX 2: FROST-Poll auto-send restricted to buyer only (prevents seller double-send)');
  }
} else {
  console.log('FIX 2: double-send marker not found — may need manual fix');
}

// === FIX 3: Wire processSellerResponse to call buyerAggregate → submit to L1 ===
const psrMarker = "// TODO: aggregate and broadcast";
const psrIdx = f.indexOf(psrMarker);
if (psrIdx >= 0) {
  // Find the line and replace the TODO with actual implementation
  const oldTodo = `// TODO: aggregate and broadcast (uses existing completeFrost2Round flow)
    } catch`;
  const newImpl = `// Aggregate buyer + seller partial sigs → broadcast to L1
      const nonceJson = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
      if (!nonceJson) { Alert.alert('Error', 'Buyer nonce not found — did you build the template first?'); return; }
      const savedNonce = JSON.parse(nonceJson);
      const nonce = { k: BigInt('0x' + savedNonce.k), d_tweaked: BigInt('0x' + savedNonce.d_tweaked), R_hex: savedNonce.R_hex };
      
      const aggResult = buyerAggregate({
        nonce,
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        template: (() => { const t = parseTemplate(btoa(JSON.stringify({ u: resp.u || [], o: resp.o || [], f: resp.f || '300000', R: savedNonce.R_hex, agr: contract.agreementId }))); return t; })() || {} as any,
        sellerResponse: resp,
      });
      
      if ('error' in aggResult) {
        Alert.alert('Aggregation Failed', aggResult.error);
        return;
      }
      
      console.log('[Ceremony-Buyer] Aggregated', aggResult.signatures.length, 'signatures. Broadcasting...');
      
      // Submit to L1
      const wallet = await loadMainWallet();
      const networkStr = wallet?.network || 'testnet-10';
      const submitBase = networkStr.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const submitResp = await fetch(submitBase + '/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aggResult.txBody),
      });
      
      if (submitResp.ok) {
        const submitData = await submitResp.json();
        const txId = submitData.transactionId || '';
        console.log('[Ceremony-Buyer] Release TX confirmed:', txId);
        
        // Destroy nonce
        await SecureStore.deleteItemAsync('kv_frost_nonce_' + contract.agreementId).catch(() => {});
        console.log('[FROST-R] Destroyed nonce for', contract.agreementId);
        
        setContract(prev => ({ ...prev, releaseTxId: txId }));
        setStep(7);
        Alert.alert('Funds Released!', 'TX: ' + txId.slice(0, 16) + '...\\nBuyer gets: ' + contract.itemPriceKas + ' KAS\\nSeller gets: ' + contract.sellerCommitmentKas + ' KAS');
      } else {
        const errText = await submitResp.text();
        console.error('[Ceremony-Buyer] L1 submit failed:', errText);
        Alert.alert('L1 Submit Failed', errText.slice(0, 200));
      }
    } catch`;
  
  if (f.includes(oldTodo)) {
    f = f.replace(oldTodo, newImpl);
    fixes++;
    console.log('FIX 3: processSellerResponse wired to buyerAggregate → L1 broadcast');
  } else {
    console.log('FIX 3: Could not find exact TODO pattern — trying alt');
    // Try just replacing the TODO line
    f = f.replace(psrMarker, `// Aggregate buyer + seller partial sigs → broadcast to L1
      try {
        const nonceJson = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
        if (!nonceJson) { Alert.alert('Error', 'Buyer nonce not found'); return; }
        const savedNonce = JSON.parse(nonceJson);
        const nonce = { k: BigInt('0x' + savedNonce.k), d_tweaked: BigInt('0x' + savedNonce.d_tweaked), R_hex: savedNonce.R_hex };
        
        // Need the original template — load from SecureStore
        const tmplJson = await SecureStore.getItemAsync('kv_frost_template_' + contract.agreementId);
        const template = tmplJson ? JSON.parse(tmplJson) : null;
        if (!template) { Alert.alert('Error', 'Original template not found — rebuild template first'); return; }
        
        const aggResult = buyerAggregate({ nonce, buyerPubkey: contract.buyerPubkey || '', sellerPubkey: contract.sellerPubkey || '', counter: contract.frostData?.frostCounter || 0, template, sellerResponse: resp });
        if ('error' in aggResult) { Alert.alert('Aggregation Failed', aggResult.error); return; }
        
        console.log('[Ceremony-Buyer] Aggregated', aggResult.signatures.length, 'sigs. Broadcasting...');
        const wallet = await loadMainWallet();
        const submitBase = (wallet?.network || 'testnet-10').includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const submitResp = await fetch(submitBase + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aggResult.txBody) });
        
        if (submitResp.ok) {
          const txId = (await submitResp.json()).transactionId || '';
          console.log('[Ceremony-Buyer] Release TX:', txId);
          await SecureStore.deleteItemAsync('kv_frost_nonce_' + contract.agreementId).catch(() => {});
          setContract(prev => ({ ...prev, releaseTxId: txId }));
          setStep(7);
          Alert.alert('Funds Released!', 'TX: ' + txId.slice(0, 16) + '...');
        } else { Alert.alert('L1 Failed', (await submitResp.text()).slice(0, 200)); }
      } catch (ae) { console.error('[Ceremony-Buyer] Aggregate error:', ae); Alert.alert('Error', String(ae)); }`);
    fixes++;
    console.log('FIX 3 (alt): processSellerResponse wired to buyerAggregate');
  }
}

// === FIX 3b: Save template in buildReleaseTemplate so processSellerResponse can use it ===
const tmplSaveMarker = "await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId";
const tmplSaveIdx = f.indexOf(tmplSaveMarker);
if (tmplSaveIdx >= 0) {
  // Check if template is already saved
  if (!f.includes("kv_frost_template_' + contract.agreementId")) {
    // Find the nonce save line and add template save after it
    const nonceSaveLine = f.indexOf('\n', tmplSaveIdx);
    const insertPoint = f.indexOf('\n', nonceSaveLine + 1);
    f = f.substring(0, insertPoint) + "\n      await SecureStore.setItemAsync('kv_frost_template_' + contract.agreementId, JSON.stringify(result.template));" + f.substring(insertPoint);
    fixes++;
    console.log('FIX 3b: Template saved to SecureStore for processSellerResponse');
  }
}

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('\nTotal fixes:', fixes);
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify
console.log('\n--- Verification ---');
console.log('Seller template paste UI:', f.includes('Paste Buyer Template'));
console.log('sellerSignTemplate called:', f.includes('sellerSignTemplate({'));
console.log('Buyer-only FROST-Poll send:', f.includes("role === 'buyer' && balance >= otherExpected"));
console.log('buyerAggregate called:', f.includes('buyerAggregate({') || f.includes('buyerAggregate('));
console.log('Template saved to SecureStore:', f.includes("kv_frost_template_"));
console.log('L1 submit:', f.includes("'/transactions'"));
