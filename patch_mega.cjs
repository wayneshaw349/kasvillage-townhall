const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// === FIX 1: processSellerResponse — replace entire function ===
const psrStart = f.indexOf('const processSellerResponse = async ()');
if (psrStart < 0) { console.log('ERROR: processSellerResponse not found'); process.exit(1); }
let depth = 0, psrEnd = -1;
const psrBody = f.indexOf('{', psrStart);
for (let i = psrBody; i < f.length; i++) {
  if (f[i] === '{') depth++;
  if (f[i] === '}') { depth--; if (depth === 0) { psrEnd = i + 1; break; } }
}
while (psrEnd < f.length && ' \t\r\n;'.includes(f[psrEnd])) psrEnd++;

f = f.substring(0, psrStart) + `const processSellerResponse = async () => {
    try {
      let pastedText = '';
      try { const CB = await import('expo-clipboard'); pastedText = await CB.getStringAsync() || ''; } catch { console.warn('[FROST-Template] Clipboard read failed'); }
      if (!pastedText) { Alert.alert('Error', 'Nothing in clipboard'); return; }

      const resp = parseResponse(pastedText);
      if (!resp || !resp.R || !resp.s || !Array.isArray(resp.s)) {
        Alert.alert('Error', 'Invalid seller response — expected base64 with R + partial sigs');
        return;
      }

      console.log('[Ceremony-Buyer] Seller R:', resp.R.slice(0,20), 'partials:', resp.s.length);

      const nonceJson = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
      if (!nonceJson) { Alert.alert('Error', 'Buyer nonce not found — did you build the template first?'); return; }
      const savedNonce = JSON.parse(nonceJson);
      const nonce = { k: BigInt('0x' + savedNonce.k), d_tweaked: BigInt('0x' + savedNonce.d_tweaked), R_hex: savedNonce.R_hex };

      const tmplJson = await SecureStore.getItemAsync('kv_frost_template_' + contract.agreementId);
      if (!tmplJson) { Alert.alert('Error', 'Original template not found — rebuild template first'); return; }
      const template = JSON.parse(tmplJson);

      const aggResult = buyerAggregate({
        nonce,
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        template,
        sellerResponse: resp,
      });

      if ('error' in aggResult) { Alert.alert('Aggregation Failed', aggResult.error); return; }

      console.log('[Ceremony-Buyer] Aggregated', aggResult.signatures.length, 'sigs. Broadcasting...');
      const wallet = await loadMainWallet();
      const submitBase = (wallet?.network || 'testnet-10').includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const submitResp = await fetch(submitBase + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aggResult.txBody) });

      if (submitResp.ok) {
        const txId = (await submitResp.json()).transactionId || '';
        console.log('[Ceremony-Buyer] Release TX:', txId);
        await SecureStore.deleteItemAsync('kv_frost_nonce_' + contract.agreementId).catch(() => {});
        await SecureStore.deleteItemAsync('kv_frost_template_' + contract.agreementId).catch(() => {});
        setContract(prev => ({ ...prev, releaseTxId: txId }));
        setStep(7);
        Alert.alert('Funds Released!', 'TX: ' + txId.slice(0, 16) + '...');
      } else {
        Alert.alert('L1 Failed', (await submitResp.text()).slice(0, 200));
      }
    } catch (e: any) {
      console.error('[Ceremony-Buyer] Error:', e);
      Alert.alert('Error', e.message || String(e));
    }
  };

` + f.substring(psrEnd);
fixes++;
console.log('FIX 1: processSellerResponse replaced cleanly');

// === FIX 2: Save template in buildReleaseTemplate ===
const nonceSaveMarker = "await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId";
const nonceSaveIdx = f.indexOf(nonceSaveMarker);
if (nonceSaveIdx >= 0 && !f.includes("kv_frost_template_")) {
  const lineEnd = f.indexOf('\n', nonceSaveIdx);
  f = f.substring(0, lineEnd) + "\n      await SecureStore.setItemAsync('kv_frost_template_' + contract.agreementId, JSON.stringify(result.template));" + f.substring(lineEnd);
  fixes++;
  console.log('FIX 2: Template saved to SecureStore');
}

// === FIX 3: Double-send fix — buyer-only FROST-Poll auto-send ===
const doubleSendOld = "if (balance >= otherExpected && myExpected > 0)";
if (f.includes(doubleSendOld)) {
  f = f.replace(doubleSendOld, "if (role === 'buyer' && balance >= otherExpected && myExpected > 0)");
  fixes++;
  console.log('FIX 3: FROST-Poll auto-send restricted to buyer only');
}

// === FIX 4: Step 5 seller UI — paste buyer template ===
const step5BuyerMarker = "{'Build TX Template (generates k + R)'}";
if (f.includes(step5BuyerMarker)) {
  const viewStart = f.lastIndexOf('<View style={{ marginBottom: 16, gap: 8 }}>', f.indexOf(step5BuyerMarker));
  const viewEnd = f.indexOf('</View>', f.indexOf(step5BuyerMarker) + step5BuyerMarker.length);
  if (viewStart >= 0 && viewEnd >= 0) {
    const oldView = f.substring(viewStart, viewEnd + '</View>'.length);
    const newView = `<View style={{ marginBottom: 16, gap: 8 }}>
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
                            const tmpl = parseTemplate(v);
                            if (!tmpl) { Alert.alert('Error', 'Invalid template format'); setIsLoading(false); return; }
                            const result = sellerSignTemplate({
                              privateKeyHex: wallet.privKeyHex,
                              sellerPubkey: contract.sellerPubkey || '',
                              buyerPubkey: contract.buyerPubkey || '',
                              counter: contract.frostData?.frostCounter || 0,
                              template: tmpl,
                            });
                            if ('error' in result) { Alert.alert('Verification Failed', result.error); setIsLoading(false); return; }
                            try { await Clipboard.setStringAsync(result.responseB64); } catch {}
                            console.log('[Ceremony-Seller] Signed! Response:', result.responseB64.length, 'chars');
                            Alert.alert('Signed! Response Copied', 'Send clipboard back to buyer.\\nYour share: ' + (Number(result.verification.myAmount) / 1e8).toFixed(4) + ' KAS');
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
    f = f.substring(0, viewStart) + newView + f.substring(viewEnd + '</View>'.length);
    fixes++;
    console.log('FIX 4: Step 5 seller UI added');
  }
}

// === FIX 5: Seller "Go to Step 5" button at step 4 ===
// The seller's waitingBox text is unique — insert button right after the waitingNote Text
const waitingNoteMarker = "You'll receive {contract.itemPriceKas} KASPA + your {contract.sellerCommitmentKas} KASPA back";
const wnIdx = f.indexOf(waitingNoteMarker);
if (wnIdx >= 0) {
  // Find the </Text> closing the waitingNote, then </View> closing the waitingBox
  const textClose = f.indexOf("</Text>", wnIdx);
  const viewClose = f.indexOf("</View>", textClose);
  const afterWaitingBox = viewClose + "</View>".length;
  // Insert button as next child inside the parent <View> (seller's section)
  const sellerBtn = `
                    <TouchableOpacity
                      onPress={() => setStep(5)}
                      style={{ backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Go to Signing Ceremony (Step 5)</Text>
                    </TouchableOpacity>`;
  f = f.substring(0, afterWaitingBox) + sellerBtn + f.substring(afterWaitingBox);
  fixes++;
  console.log('FIX 5: Seller step 5 button at step 4');
} else { console.log('FIX 5: waitingNote marker not found'); }

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('\nTotal fixes:', fixes);

// Verify
console.log('\n--- Verification ---');
console.log('processSellerResponse clean:', f.includes('buyerAggregate({') && !f.includes('(uses existing completeFrost2Round flow)'));
console.log('Template saved:', f.includes("kv_frost_template_"));
console.log('Buyer-only poll:', f.includes("role === 'buyer' && balance >= otherExpected"));
console.log('Seller step 5 UI:', f.includes('Paste Buyer Template') && f.includes('sellerSignTemplate({'));
console.log('Seller step 5 btn:', f.includes('Go to Signing Ceremony'));
console.log('No orphaned catch:', !f.includes("catch (e: any) { console.error('[FROST-Template]"));
