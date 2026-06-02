const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Fixed guard — check for releaseMode state, not the import
if (s.includes('const [releaseMode')) { console.log('Already patched'); process.exit(0); }

// 1. Add imports from canonical_agreement_steps
const importAnchor = "  buildTxBody,";
if (!s.includes(importAnchor)) { console.log('Import anchor not found'); process.exit(1); }
s = s.replace(importAnchor, "  buildTxBody,\n  buildReleaseTemplate as buildReleaseTemplateFn,\n  computeReleaseOutputs,\n  ReleaseMode,");

// Also import generateNonce if not there
if (!s.includes("generateNonce,")) {
  s = s.replace("  encodeTemplate,", "  encodeTemplate,\n  generateNonce,");
}

// 2. Add releaseMode state after templateBuilt
const stateAnchor = "const [templateBuilt, setTemplateBuilt] = useState(false);";
if (!s.includes(stateAnchor)) { console.log('State anchor not found'); process.exit(1); }
s = s.replace(stateAnchor, stateAnchor + "\n  const [releaseMode, setReleaseMode] = useState<ReleaseMode>('release');");

// 3. Replace handleRequestRelease to route to signing ceremony with cancel mode
const oldHandleStart = "const handleRequestRelease = async () => {";
const oldHandleIdx = s.indexOf(oldHandleStart);
if (oldHandleIdx < 0) { console.log('handleRequestRelease not found'); process.exit(1); }
const nextConst = s.indexOf("\n  const handleEnterDispute", oldHandleIdx);
if (nextConst < 0) { console.log('handleEnterDispute not found'); process.exit(1); }

s = s.slice(0, oldHandleIdx) + `const handleRequestRelease = async () => {
    Alert.alert(
      'Cancel Agreement',
      'Both parties must sign to cancel.\\nEach receives their original collateral back (minus proportional fee).\\n\\nParty A gets: ~' + contract.itemPriceKas + ' KAS\\nParty B gets: ~' + contract.sellerCommitmentKas + ' KAS',
      [
        { text: 'Keep Agreement', style: 'cancel' },
        { text: 'Start Cancellation', onPress: () => {
          setReleaseMode('cancel');
          setTemplateBuilt(false);
          setStep(5);
        }},
      ]
    );
  };

` + s.slice(nextConst);

// 4. Add mode indicator + cancel-aware template building in step 5
// Find the Build button
const buildBtn = "onPress={buildReleaseTemplate} disabled={templateBuilt}";
if (!s.includes(buildBtn)) { console.log('Build button not found'); process.exit(1); }

// Add mode banner above the button's parent TouchableOpacity
const btnParent = "<TouchableOpacity onPress={buildReleaseTemplate} disabled={templateBuilt}";
s = s.replace(btnParent,
  `{/* Release mode banner */}
                      <View style={{ backgroundColor: releaseMode === 'cancel' ? '#fef3c7' : releaseMode === 'split' ? '#fef2f2' : '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: releaseMode === 'cancel' ? '#f59e0b' : releaseMode === 'split' ? '#fca5a5' : '#86efac' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: releaseMode === 'cancel' ? '#92400e' : releaseMode === 'split' ? '#991b1b' : '#166534' }}>
                          {releaseMode === 'cancel' ? '↩ Cancellation — each party receives their collateral back' : releaseMode === 'split' ? '⚖ Settlement — custom split' : '✓ Release — payment transfers to seller'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={buildReleaseTemplate} disabled={templateBuilt}`);

// 5. In the buildReleaseTemplate handler, add cancel/split mode template building
// before the existing buyerBuildTemplate call
const buyerBuildCall = "const result = buyerBuildTemplate({";
if (!s.includes(buyerBuildCall)) { console.log('buyerBuildTemplate call not found'); process.exit(1); }

const cancelBlock = `// Cancel/Split mode: use buildReleaseTemplateFn with multiple outputs
      if (releaseMode === 'cancel' || releaseMode === 'split') {
        const _bx = (contract.buyerPubkey || '').length === 66 ? (contract.buyerPubkey || '').slice(2) : (contract.buyerPubkey || '');
        const _sx = (contract.sellerPubkey || '').length === 66 ? (contract.sellerPubkey || '').slice(2) : (contract.sellerPubkey || '');
        const _nonce = generateNonce(wallet.privKeyHex, contract.buyerPubkey || '', contract.sellerPubkey || '', contract.frostData?.frostCounter || 0);
        const { template: _cTmpl, description: _cDesc } = buildReleaseTemplateFn({
          utxos: utxos.map((u) => ({ txId: u.outpoint.transactionId, index: u.outpoint.index, amount: u.utxoEntry.amount, scriptPubKey: u.utxoEntry.scriptPublicKey.scriptPublicKey })),
          partyA_xOnly: _bx, partyB_xOnly: _sx,
          partyA_depositSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),
          partyB_depositSompi: BigInt(Math.floor(contract.sellerCommitmentKas * 1e8)),
          mode: releaseMode,
          R_hex: _nonce.R_hex, agrId: contract.agreementId || '',
        });
        await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ k: _nonce.k.toString(16), d_tweaked: _nonce.d_tweaked.toString(16), R_hex: _nonce.R_hex }));
        await SecureStore.setItemAsync('kv_frost_template_' + contract.agreementId, JSON.stringify(_cTmpl));
        const _b64 = encodeTemplate(_cTmpl);
        try { await Clipboard.setStringAsync(_b64); } catch {}
        setTemplateBuilt(true);
        console.log('[Ceremony] ' + releaseMode + ' template built:', _b64.length, 'chars,', _cDesc);
        Alert.alert('Template Copied (' + releaseMode + ')', _cDesc + '\\nOutputs: ' + _cTmpl.o.length + '\\n\\nSend to counterparty.');
        setIsLoading(false);
        return;
      }
      `;

s = s.replace(buyerBuildCall, cancelBlock + buyerBuildCall);

// 6. Also reset releaseMode on Reset button
s = s.replace('setTemplateBuilt(false);', 'setTemplateBuilt(false); setReleaseMode(\'release\');');

fs.writeFileSync(f, s);
console.log('Done: Cancel ceremony wired');
console.log('Verify releaseMode state:', s.includes("const [releaseMode, setReleaseMode]"));
console.log('Verify cancel route:', s.includes("Start Cancellation"));
console.log('Verify mode banner:', s.includes("Cancellation — each party receives"));
console.log('Verify cancel template:', s.includes("cancel template built"));
