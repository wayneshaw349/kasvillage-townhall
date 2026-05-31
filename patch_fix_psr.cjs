const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the entire processSellerResponse function
const funcStart = f.indexOf('const processSellerResponse = async ()');
if (funcStart < 0) { console.log('processSellerResponse not found'); process.exit(1); }

// Find the end: next "const handle" or "const build" at same indent level
let depth = 0, funcEnd = -1;
const bodyStart = f.indexOf('{', funcStart);
for (let i = bodyStart; i < f.length; i++) {
  if (f[i] === '{') depth++;
  if (f[i] === '}') { depth--; if (depth === 0) { funcEnd = i + 1; break; } }
}
// Include trailing semicolons/newlines
while (funcEnd < f.length && ' \t\r\n;'.includes(f[funcEnd])) funcEnd++;

const oldFunc = f.substring(funcStart, funcEnd);
console.log('Old processSellerResponse:', oldFunc.length, 'chars, lines:', oldFunc.split('\n').length);

const newFunc = `const processSellerResponse = async () => {
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
      
      // Load buyer nonce from SecureStore
      const nonceJson = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
      if (!nonceJson) { Alert.alert('Error', 'Buyer nonce not found — did you build the template first?'); return; }
      const savedNonce = JSON.parse(nonceJson);
      const nonce = { k: BigInt('0x' + savedNonce.k), d_tweaked: BigInt('0x' + savedNonce.d_tweaked), R_hex: savedNonce.R_hex };
      
      // Load saved template
      const tmplJson = await SecureStore.getItemAsync('kv_frost_template_' + contract.agreementId);
      if (!tmplJson) { Alert.alert('Error', 'Original template not found — rebuild template first'); return; }
      const template = JSON.parse(tmplJson);
      
      // Aggregate buyer + seller partial sigs
      const aggResult = buyerAggregate({
        nonce,
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        template,
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
        await SecureStore.deleteItemAsync('kv_frost_template_' + contract.agreementId).catch(() => {});
        console.log('[FROST-R] Destroyed nonce for', contract.agreementId);
        
        setContract(prev => ({ ...prev, releaseTxId: txId }));
        setStep(7);
        Alert.alert('Funds Released!', 'TX: ' + txId.slice(0, 16) + '...');
      } else {
        const errText = await submitResp.text();
        console.error('[Ceremony-Buyer] L1 submit failed:', errText);
        Alert.alert('L1 Submit Failed', errText.slice(0, 200));
      }
    } catch (e: any) {
      console.error('[Ceremony-Buyer] Error:', e);
      Alert.alert('Error', e.message || String(e));
    }
  };

`;

f = f.substring(0, funcStart) + newFunc + f.substring(funcEnd);

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('processSellerResponse replaced cleanly');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
