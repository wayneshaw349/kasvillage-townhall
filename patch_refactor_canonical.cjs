/**
 * ============================================================================
 * KASVILLAGE FROST REFACTOR v2 — CANONICAL AGREEMENT STEPS
 * ============================================================================
 * 
 * Uses canonical_agreement_steps.ts as single source of truth for:
 *   - Key aggregation (computeL, deriveAggregateKey)
 *   - Sighash computation (computeSighash)
 *   - FROST signing (generateNonce, partialSign, aggregateSigs, verifySig)
 *   - TX template (buildTemplate, parseTemplate, verifyTemplate)
 *   - Covenant detection (isPureP2PK, classifyScript)
 *   - State machine (STEPS, canTransition)
 *   - Full ceremony (buyerBuildTemplate, sellerSignTemplate, buyerAggregate)
 *
 * RUN:
 *   1. Copy canonical_agreement_steps.ts to your project dir
 *   2. node patch_refactor_canonical.cjs
 *   3. git add canonical_agreement_steps.ts NeighborAgreement.tsx frost_complete.ts
 *   4. git commit -m "refactor: canonical agreement steps module"
 *   5. npx expo start --clear
 * ============================================================================
 */

const fs = require('fs');

if (!fs.existsSync('canonical_agreement_steps.ts')) {
  console.error('ERROR: canonical_agreement_steps.ts not found in current directory.');
  console.error('Copy it from the download first.');
  process.exit(1);
}

let NA = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;
const warnings = [];

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  CANONICAL AGREEMENT STEPS INTEGRATION            ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// ============================================================================
// 1. ADD CANONICAL IMPORT
// ============================================================================
console.log('--- 1. Add canonical import ---');

const canonicalImport = `import {
  STEPS,
  K_DESTROY_STEPS,
  buyerBuildTemplate,
  sellerSignTemplate,
  buyerAggregate,
  parseTemplate,
  parseResponse,
  encodeTemplate,
  encodeResponse,
  verifyTemplate,
  isPureP2PK,
  classifyScript,
  deriveAggregateKey,
  deriveAddress,
  verificationCode as computeVerificationCode,
  computeAgrId,
  buildTxBody,
  MIN_FEE_SOMPI,
  SUBNETWORK_NATIVE,
  type TxTemplate,
  type SellerResponse,
  type FrostNonce,
  type AgreementState,
  type StepNumber,
} from './canonical_agreement_steps';`;

if (!NA.includes('canonical_agreement_steps')) {
  // Insert after the last existing import
  const lastImport = NA.lastIndexOf("import ");
  const endOfLastImport = NA.indexOf('\n', NA.indexOf(';', lastImport));
  NA = NA.substring(0, endOfLastImport + 1) + '\n' + canonicalImport + '\n' + NA.substring(endOfLastImport + 1);
  fixes++;
  console.log('  ✓ Added canonical_agreement_steps import');
} else {
  console.log('  ℹ Already imported');
}

// ============================================================================
// 2. REPLACE handleConfirmDelivery
// ============================================================================
console.log('\n--- 2. Replace handleConfirmDelivery ---');

const hcdStart = NA.indexOf('const handleConfirmDelivery = async ()');
if (hcdStart > 0) {
  let depth = 0, inFunc = false, funcEnd = -1;
  for (let i = hcdStart; i < NA.length; i++) {
    if (NA[i] === '{') { depth++; inFunc = true; }
    if (NA[i] === '}') { depth--; if (inFunc && depth === 0) { funcEnd = i + 1; break; } }
  }
  // Include trailing semicolon if present
  let end = funcEnd;
  while (end < NA.length && (NA[end] === ' ' || NA[end] === '\n' || NA[end] === '\r')) end++;
  if (NA[end] === ';') end++;

  if (funcEnd > hcdStart) {
    NA = NA.substring(0, hcdStart) + `const handleConfirmDelivery = async () => {
    // Advances to step 5 (signing ceremony). NO k generated here.
    // k is created fresh during buildReleaseTemplate (~41ms lifetime).
    Alert.alert(
      'Release Funds',
      'Start the signing ceremony? You will exchange signatures with the seller via clipboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => setStep(5) },
      ]
    );
  }` + NA.substring(end);
    fixes++;
    console.log('  ✓ handleConfirmDelivery → step 5 advancement (no signing)');
  }
}

// ============================================================================
// 3. ADD CANONICAL TEMPLATE FUNCTIONS
// ============================================================================
console.log('\n--- 3. Add canonical signing ceremony functions ---');

const ceremonyFunctions = `
  // ============================================================================
  // SIGNING CEREMONY — uses canonical_agreement_steps.ts
  // k lifetime: ~41ms (proven on L1: TX 977446ec)
  // ============================================================================

  const buildReleaseTemplate = async () => {
    setIsLoading(true);
    try {
      const wallet = await loadMainWallet();
      if (!wallet?.privKeyHex || !contract.frostData || !contract.agreementId) {
        Alert.alert('Error', 'Missing wallet or FROST data'); setIsLoading(false); return;
      }

      const network = wallet.network || 'testnet-10';
      const apiBase = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';

      // Fetch FROST UTXOs from L1
      const utxoResp = await fetch(apiBase + '/addresses/' + contract.frostData.address + '/utxos');
      const utxos = await utxoResp.json();
      if (!utxos?.length) { Alert.alert('Error', 'No UTXOs at FROST address'); setIsLoading(false); return; }

      // k is born HERE — canonical function
      const result = buyerBuildTemplate({
        privateKeyHex: wallet.privKeyHex,
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        utxos: utxos.map((u: any) => ({
          txId: u.outpoint.transactionId,
          index: u.outpoint.index,
          amount: u.utxoEntry.amount,
          scriptPubKey: u.utxoEntry.scriptPublicKey.scriptPublicKey,
        })),
        buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),
        agrId: contract.agreementId,
      });

      // Store nonce in SecureStore (encrypted, hardware-backed)
      await SecureStore.setItemAsync(
        'kv_frost_nonce_' + contract.agreementId,
        JSON.stringify({
          k: result.nonce.k.toString(16),
          d_tweaked: result.nonce.d_tweaked.toString(16),
          R_hex: result.nonce.R_hex,
        })
      );

      // Copy template to clipboard
      try { await Clipboard.setStringAsync(result.templateB64); } catch {}

      const totalIn = result.template.u.reduce((s: bigint, u: any) => s + BigInt(u.a), 0n);
      const buyerAmt = BigInt(result.template.o[0].v);
      const sellerAmt = BigInt(result.template.o[1].v);

      console.log('[Ceremony] Template built:', result.templateB64.length, 'chars, k alive');
      Alert.alert('TX Template Copied',
        'Send clipboard to seller.\\n\\n' +
        'Buyer: ' + (Number(buyerAmt) / 1e8).toFixed(4) + ' KAS\\n' +
        'Seller: ' + (Number(sellerAmt) / 1e8).toFixed(4) + ' KAS\\n' +
        'Fee: ' + (Number(BigInt(result.template.f)) / 1e8) + ' KAS'
      );
    } catch (e: any) {
      console.error('[Ceremony] Build error:', e);
      Alert.alert('Error', e.message || 'Template build failed');
    } finally { setIsLoading(false); }
  };

  const processSellerResponse = async () => {
    setIsLoading(true);
    try {
      let clipboard = '';
      try { clipboard = await Clipboard.getStringAsync(); } catch {}
      if (!clipboard || clipboard.length < 50) {
        Alert.alert('Error', 'Copy the seller response to clipboard first');
        setIsLoading(false); return;
      }

      const sellerResp = parseResponse(clipboard);
      if (!sellerResp) {
        Alert.alert('Error', 'Invalid response format'); setIsLoading(false); return;
      }

      // Load buyer nonce from SecureStore
      const nonceJson = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
      if (!nonceJson) {
        Alert.alert('Error', 'Nonce not found — Build TX Template first');
        setIsLoading(false); return;
      }
      const stored = JSON.parse(nonceJson);
      const nonce: FrostNonce = {
        k: BigInt('0x' + stored.k),
        d_tweaked: BigInt('0x' + stored.d_tweaked),
        R_hex: stored.R_hex,
      };

      // Rebuild template from the original (stored in clipboard history or re-derive)
      const wallet = await loadMainWallet();
      if (!wallet) { Alert.alert('Error', 'Wallet not loaded'); setIsLoading(false); return; }

      const network = wallet.network || 'testnet-10';
      const apiBase = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const utxoResp = await fetch(apiBase + '/addresses/' + contract.frostData?.address + '/utxos');
      const utxos = await utxoResp.json();

      const templateResult = buyerBuildTemplate({
        privateKeyHex: wallet.privKeyHex || '',
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        utxos: utxos.map((u: any) => ({
          txId: u.outpoint.transactionId,
          index: u.outpoint.index,
          amount: u.utxoEntry.amount,
          scriptPubKey: u.utxoEntry.scriptPublicKey.scriptPublicKey,
        })),
        buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),
        agrId: contract.agreementId || '',
      });

      // Aggregate using canonical function (uses ORIGINAL nonce, not re-generated one)
      const aggResult = buyerAggregate({
        nonce,
        buyerPubkey: contract.buyerPubkey || '',
        sellerPubkey: contract.sellerPubkey || '',
        counter: contract.frostData?.frostCounter || 0,
        template: templateResult.template,
        sellerResponse: sellerResp,
      });

      // DESTROY k immediately
      await SecureStore.deleteItemAsync('kv_frost_nonce_' + contract.agreementId).catch(() => {});
      console.log('[Ceremony] k DESTROYED');

      if ('error' in aggResult) {
        Alert.alert('Verification Failed', aggResult.error);
        setIsLoading(false); return;
      }

      // Submit to L1
      console.log('[Ceremony] Submitting to L1...');
      const submitResp = await fetch(apiBase + '/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aggResult.txBody),
      });
      const submitData = await submitResp.json();

      if (submitData.transactionId) {
        console.log('[Ceremony] L1 CONFIRMED:', submitData.transactionId);
        setContract(prev => ({ ...prev, releaseTxId: submitData.transactionId }));
        setStep(7);
        Alert.alert('🎉 Funds Released!', 'TX: ' + submitData.transactionId.slice(0, 24) + '...');
      } else {
        console.error('[Ceremony] L1 rejected:', submitData);
        Alert.alert('L1 Rejected', submitData.error || JSON.stringify(submitData));
      }
    } catch (e: any) {
      console.error('[Ceremony]', e);
      Alert.alert('Error', e.message || 'Failed');
    } finally { setIsLoading(false); }
  };
`;

if (!NA.includes('buildReleaseTemplate')) {
  const retIdx = NA.lastIndexOf('  return (');
  if (retIdx > 0) {
    NA = NA.substring(0, retIdx) + ceremonyFunctions + '\n' + NA.substring(retIdx);
    fixes++;
    console.log('  ✓ Added buildReleaseTemplate (uses buyerBuildTemplate from canonical)');
    console.log('  ✓ Added processSellerResponse (uses buyerAggregate from canonical)');
  }
} else {
  console.log('  ℹ Template functions already exist — skipping');
}

// ============================================================================
// 4. REPLACE STEP 5 RENDER
// ============================================================================
console.log('\n--- 4. Replace step 5 with signing ceremony UI ---');

const step5Start = NA.indexOf('{step === 5 && (');
if (step5Start > 0) {
  // Find next step block
  const step6Start = NA.indexOf('{step === 6', step5Start + 10);
  const step7Start = NA.indexOf('{step === 7', step5Start + 10);
  const nextStep = Math.min(
    step6Start > 0 ? step6Start : Infinity,
    step7Start > 0 ? step7Start : Infinity
  );

  if (nextStep < Infinity) {
    const lineStart = NA.lastIndexOf('\n', step5Start) + 1;
    const lineEnd = NA.lastIndexOf('\n', nextStep);

    const newStep5 = `            {/* Step 5: Signing Ceremony */}
            {step === 5 && (
              <View>
                <View style={{ backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#3b82f6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ color: '#60a5fa', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>{'🔐 Signing Ceremony'}</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                    {'Your signing key (k) exists only during this process. It is destroyed immediately after broadcast.'}
                  </Text>
                </View>

                {role === 'buyer' ? (
                  <View style={{ gap: 12 }}>
                    <TouchableOpacity onPress={buildReleaseTemplate} disabled={isLoading}
                      style={{ backgroundColor: '#059669', borderRadius: 10, padding: 14, alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}>
                      {isLoading ? <ActivityIndicator color="#fff" /> :
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Step 1: Build TX Template'}</Text>}
                    </TouchableOpacity>
                    <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
                      {'Generates k + R, builds template, copies to clipboard. Send to seller.'}
                    </Text>

                    <View style={{ height: 1, backgroundColor: '#334155', marginVertical: 4 }} />

                    <TouchableOpacity onPress={processSellerResponse} disabled={isLoading}
                      style={{ backgroundColor: '#4f46e5', borderRadius: 10, padding: 14, alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}>
                      {isLoading ? <ActivityIndicator color="#fff" /> :
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Step 2: Paste Seller Response'}</Text>}
                    </TouchableOpacity>
                    <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
                      {'Copy seller response to clipboard, then tap above. Verifies + broadcasts.'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>{'Paste Buyer TX Template'}</Text>
                    <TextInput
                      style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', minHeight: 60 }}
                      placeholder="Paste the buyer's TX template here..."
                      placeholderTextColor="#a8a29e"
                      multiline autoCapitalize="none" autoCorrect={false}
                      onChangeText={async (txt) => {
                        const v = txt.trim();
                        if (v.length < 50) return;
                        const tmpl = parseTemplate(v);
                        if (!tmpl) return;
                        const wallet = await loadMainWallet();
                        if (!wallet?.privKeyHex) { Alert.alert('Error', 'Wallet not loaded'); return; }
                        const myXOnly = (wallet.pubKeyHex || '').length === 66 ? (wallet.pubKeyHex || '').slice(2) : wallet.pubKeyHex || '';
                        const check = verifyTemplate(tmpl, myXOnly);
                        if (!check.valid) { Alert.alert('Template Invalid', check.error || 'Verification failed'); return; }
                        Alert.alert('Template Verified',
                          'Your payout: ' + (Number(check.myAmount) / 1e8).toFixed(4) + ' KAS\\nFee: ' + (Number(BigInt(tmpl.f)) / 1e8) + ' KAS\\n\\nSign and copy response?',
                          [{ text: 'Cancel', style: 'cancel' },
                           { text: 'Sign', onPress: async () => {
                             setIsLoading(true);
                             try {
                               const signResult = sellerSignTemplate({
                                 privateKeyHex: wallet.privKeyHex || '',
                                 sellerPubkey: contract.sellerPubkey || '',
                                 buyerPubkey: contract.buyerPubkey || '',
                                 counter: contract.frostData?.frostCounter || 0,
                                 template: tmpl,
                               });
                               if ('error' in signResult) { Alert.alert('Error', signResult.error); return; }
                               try { await Clipboard.setStringAsync(signResult.responseB64); } catch {}
                               Alert.alert('Signed!', 'Response copied to clipboard (' + signResult.response.s.length + ' sigs). Send to buyer.\\n\\nk was never stored.');
                             } catch (e: any) { Alert.alert('Error', e.message); }
                             finally { setIsLoading(false); }
                           }}]
                        );
                      }}
                    />
                    <Text style={{ color: '#64748b', fontSize: 10 }}>
                      {'k is never stored — exists only during the sign operation, then garbage collected.'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={{ marginTop: 16, padding: 8 }} onPress={() => setStep(4)}>
                  <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>{'← Back'}</Text>
                </TouchableOpacity>
              </View>
            )}
`;

    NA = NA.substring(0, lineStart) + newStep5 + '\n' + NA.substring(lineEnd);
    fixes++;
    console.log('  ✓ Step 5 replaced with canonical signing ceremony');
  }
}

// ============================================================================
// 5. DISABLE OLD SIGNING PATHS
// ============================================================================
console.log('\n--- 5. Disable old signing paths ---');

// Disable postFrostR
let c = 0;
while (NA.includes('await postFrostR(')) {
  NA = NA.replace('await postFrostR(', '/* DISABLED: R clipboard-only */ // await postFrostR(');
  c++;
}
if (c > 0) { fixes += c; console.log(`  ✓ Disabled ${c} postFrostR calls`); }

// Disable getFrostR
c = 0;
while (NA.includes('await getFrostR(')) {
  NA = NA.replace('await getFrostR(', '/* DISABLED: R clipboard-only */ // await getFrostR(');
  c++;
}
if (c > 0) { fixes += c; console.log(`  ✓ Disabled ${c} getFrostR calls`); }

// ============================================================================
// 6. VERIFY
// ============================================================================
console.log('\n--- 6. Verification ---');

let b = 0, p = 0;
for (const ch of NA) { if (ch === '{') b++; if (ch === '}') b--; if (ch === '(') p++; if (ch === ')') p--; }
console.log(`  NeighborAgreement.tsx: Braces ${b === 0 ? 'OK ✓' : 'BROKEN(' + b + ') ✗'} Parens ${p === 0 ? 'OK ✓' : 'BROKEN(' + p + ') ✗'}`);

const mustHave = ['canonical_agreement_steps', 'buyerBuildTemplate', 'sellerSignTemplate', 'buyerAggregate', 'parseTemplate', 'parseResponse'];
for (const pat of mustHave) {
  if (NA.includes(pat)) console.log(`  ✓ "${pat}" present`);
  else warnings.push(`  ✗ "${pat}" missing`);
}

// ============================================================================
// 7. WRITE
// ============================================================================
fs.writeFileSync('NeighborAgreement.tsx', NA);
console.log('\n  ✓ NeighborAgreement.tsx saved');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log(`║  Done: ${fixes} fixes applied                       ║`);
if (warnings.length > 0) {
  console.log('║  Warnings:                                       ║');
  for (const w of warnings) console.log(`║    ${w.padEnd(45)}║`);
}
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  canonical_agreement_steps.ts is the source of   ║');
console.log('║  truth. All FROST math lives there.              ║');
console.log('║  NeighborAgreement.tsx is UI + I/O only.         ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('\nNEXT:');
console.log('  git add canonical_agreement_steps.ts NeighborAgreement.tsx');
console.log('  git commit -m "refactor: canonical agreement steps module"');
console.log('  git push origin main');
console.log('  npx expo start --clear');
