// patch_resume.cjs — Resume from the signed proposal, not a bare AGR ID.
// Role, FROST address, step and N are all derived. Replaces the two Load-as buttons.
// Run: node patch_resume.cjs
const fs = require('fs');

const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }
function requireOnce(name, needle){
  const n = occurrences(s, needle);
  if (n !== 1) { console.error('ABORT ['+name+'] found '+n+' occurrences, expected 1'); process.exit(1); }
  console.log('OK ['+name+'] unique');
  return s.indexOf(needle);
}

const START = '{/* RESUME AGREEMENT';
const END   = "                <Text style={{ fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.indigo900, marginBottom: 12, textAlign: 'center' }}>What type of agreement?</Text>";

if (s.indexOf('Resume from Proposal') >= 0) { console.error('ABORT: already applied'); process.exit(1); }
const i1 = requireOnce('START marker', START);
const i2 = requireOnce('END marker', END);
if (i1 >= i2) { console.error('ABORT: START is not before END'); process.exit(1); }
console.log('Replacing ' + (i2 - i1) + ' bytes of resume block');

const BLOCK =
"{/* RESUME AGREEMENT — paste the signed proposal; role, FROST address and step are derived */}\r\n" +
"                <View style={{ marginBottom: 12, backgroundColor: '#f0f9ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#93c5fd' }}>\r\n" +
"                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>Resume Agreement</Text>\r\n" +
"                  <Text style={{ fontSize: 10, color: '#4338ca', marginBottom: 8 }}>Paste the original proposal. Your role, the FROST address, the timeout and the current step all come from it — nothing to choose.</Text>\r\n" +
"                  <TextInput\r\n" +
"                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', marginBottom: 10, minHeight: 60 }}\r\n" +
"                    placeholder=\"Paste KV|AGR_...|... proposal here\"\r\n" +
"                    placeholderTextColor=\"#a8a29e\"\r\n" +
"                    value={manualAgrId}\r\n" +
"                    onChangeText={setManualAgrId}\r\n" +
"                    multiline\r\n" +
"                    autoCapitalize=\"none\"\r\n" +
"                    autoCorrect={false}\r\n" +
"                  />\r\n" +
"                  <TouchableOpacity onPress={() => { collateralRef.current = !collateralRef.current; setResumeAsCollateral(!resumeAsCollateral); }} style={{ marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: resumeAsCollateral ? '#ecfdf5' : '#f3f4f6', borderWidth: 2, borderColor: resumeAsCollateral ? '#059669' : '#d1d5db' }}>\r\n" +
"                    <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: 'bold', color: resumeAsCollateral ? '#059669' : '#888' }}>{resumeAsCollateral ? '\\u2705 Collateral Agreement' : 'Tap for Collateral Mode'}</Text>\r\n" +
"                  </TouchableOpacity>\r\n" +
"                  <TouchableOpacity\r\n" +
"                    style={{ backgroundColor: (isLoading || !manualAgrId || manualAgrId.indexOf('KV|') < 0) ? '#9ca3af' : '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' }}\r\n" +
"                    disabled={isLoading || !manualAgrId || manualAgrId.indexOf('KV|') < 0}\r\n" +
"                    onPress={async () => {\r\n" +
"                      const _raw = (manualAgrId || '').trim();\r\n" +
"                      const _kvStart = _raw.indexOf('KV|');\r\n" +
"                      if (_kvStart < 0) { Alert.alert('Invalid', 'Paste the full KV proposal, not just the AGR ID.'); return; }\r\n" +
"                      setIsLoading(true);\r\n" +
"                      try {\r\n" +
"                        const _wallet = await loadMainWallet();\r\n" +
"                        if (!_wallet?.privKeyHex) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }\r\n" +
"                        const _myPk = (await SecureStore.getItemAsync('kv_public_key')) || b2h(secpPub(_wallet.privKeyHex));\r\n" +
"                        const _kvClean = _raw.substring(_kvStart).split('\\n')[0].replace(/\\s*Sent from my iPhone.*$/i, '').trim();\r\n" +
"                        const _p = parseProposal(_kvClean);\r\n" +
"                        if (!_p) { Alert.alert('Invalid', 'Could not parse that proposal.'); setIsLoading(false); return; }\r\n" +
"                        // Same gate as accept: the buyer's signature over the body is the only integrity check.\r\n" +
"                        if (_p.valid === false) { Alert.alert('Proposal Rejected', _p.error || 'Signature invalid — do not proceed.'); setIsLoading(false); return; }\r\n" +
"                        const _bPk = _p.buyerPubkey || '';\r\n" +
"                        const _sPk = _p.sellerPubkey || '';\r\n" +
"                        // Role is DERIVED from the paste — never chosen.\r\n" +
"                        let _role: 'buyer' | 'seller';\r\n" +
"                        if (_myPk === _bPk) _role = 'buyer';\r\n" +
"                        else if (_myPk === _sPk) _role = 'seller';\r\n" +
"                        else { Alert.alert('Not Your Agreement', 'Neither party in this proposal matches your wallet.'); setIsLoading(false); return; }\r\n" +
"                        const _net = _p.network || 'testnet-10';\r\n" +
"                        // Counter comes from the paste — no 0..25 scan, no Arweave lookup.\r\n" +
"                        const _fd = deriveFrostAddressLocal({ pubkeyA: _bPk, pubkeyB: _sPk, network: _net as any, agreementId: _p.agrId, frostCounter: _p.frostCounter });\r\n" +
"                        const _api = _net.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';\r\n" +
"                        const _bAmt = Number(_p.buyerAmountSompi || 0);\r\n" +
"                        const _sAmt = Number(_p.sellerAmountSompi || 0);\r\n" +
"                        // Step is DERIVED from the escrow UTXO set.\r\n" +
"                        let _step = 3;\r\n" +
"                        try {\r\n" +
"                          const _ur = await fetch(_api + '/addresses/' + _fd.address + '/utxos');\r\n" +
"                          const _u = _ur.ok ? await _ur.json() : [];\r\n" +
"                          const _amts: number[] = Array.isArray(_u) ? _u.map((x: any) => Number(x.utxoEntry?.amount || '0')) : [];\r\n" +
"                          const _near = (a: number, b: number) => b > 0 && Math.abs(a - b) <= b * 0.05;\r\n" +
"                          if (_amts.length === 0) { _step = 3; console.log('[Resume] Escrow empty — step 3'); }\r\n" +
"                          else if (_amts.length === 1 && _near(_amts[0], _sAmt)) { _step = 3; console.log('[Resume] Seller funded, buyer has not — step 3'); }\r\n" +
"                          else if (_amts.length === 2) {\r\n" +
"                            const _sorted = [..._amts].sort((a, b) => a - b);\r\n" +
"                            const _exp = [_bAmt, _sAmt].sort((a, b) => a - b);\r\n" +
"                            if (_near(_sorted[0], _exp[0]) && _near(_sorted[1], _exp[1])) { _step = 4; console.log('[Resume] Both funded — step 4'); }\r\n" +
"                            else { console.warn('[Resume] 2 UTXOs but amounts do not match:', _amts, 'expected', _exp); }\r\n" +
"                          } else { console.warn('[Resume] Unexpected escrow UTXO set:', _amts); }\r\n" +
"                        } catch (e) { console.warn('[Resume] UTXO query failed — assuming step 3:', e); }\r\n" +
"                        setRole(_role);\r\n" +
"                        setAgreementType(collateralRef.current ? 'simple' : 'trade');\r\n" +
"                        if (collateralRef.current) { setReleaseMode('cancel'); console.log('[Resume] Collateral mode: cancel (2 outputs)'); }\r\n" +
"                        collateralRef.current = false;\r\n" +
"                        setResumeAsCollateral(false);\r\n" +
"                        setContract({\r\n" +
"                          agreementId: _p.agrId,\r\n" +
"                          multisigAddress: _fd.address,\r\n" +
"                          frostData: _fd,\r\n" +
"                          itemPriceKas: _bAmt / 1e8,\r\n" +
"                          sellerCommitmentKas: _sAmt / 1e8,\r\n" +
"                          buyerPubkey: _bPk,\r\n" +
"                          sellerPubkey: _sPk,\r\n" +
"                          counterpartyPubkey: _role === 'buyer' ? _sPk : _bPk,\r\n" +
"                          itemDescription: _p.description || _p.agrId,\r\n" +
"                          stipulations: '',\r\n" +
"                          expiryHours: 24,\r\n" +
"                          verificationCode: _p.verificationCode || '',\r\n" +
"                          // N from the paste — without this the 5e guard would silently default to 5.\r\n" +
"                          timeoutMinutes: Math.max(1, Math.round(Number(_p.timeoutN || 300) / 60)),\r\n" +
"                          timeoutN: Number(_p.timeoutN || 0),\r\n" +
"                        });\r\n" +
"                        if (_step >= 4) { setBuyerLocked(true); setSellerLocked(true); }\r\n" +
"                        setStep(_step);\r\n" +
"                        console.log('[Resume] role:', _role, 'step:', _step, 'frost:', _fd.address.slice(0, 25), 'counter:', _fd.frostCounter, 'N:', _p.timeoutN);\r\n" +
"                        addToFrostList({\r\n" +
"                          agrId: _p.agrId, frostAddr: _fd.address, role: _role, step: _step,\r\n" +
"                          buyerAmount: _bAmt / 1e8, sellerAmount: _sAmt / 1e8,\r\n" +
"                          buyerPubkey: _bPk, sellerPubkey: _sPk,\r\n" +
"                          description: _p.description || '', createdAt: Date.now(),\r\n" +
"                          timeoutN: Number(_p.timeoutN || 0),\r\n" +
"                        });\r\n" +
"                      } catch (e) {\r\n" +
"                        console.error('[Resume] Failed:', e);\r\n" +
"                        Alert.alert('Error', e instanceof Error ? e.message : String(e));\r\n" +
"                      } finally { setIsLoading(false); }\r\n" +
"                    }}\r\n" +
"                  >\r\n" +
"                    {isLoading ? <ActivityIndicator color=\"#fff\" size=\"small\" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Resume from Proposal</Text>}\r\n" +
"                  </TouchableOpacity>\r\n" +
"                </View>\r\n";

s = s.slice(0, i1) + BLOCK + s.slice(i2);

if (s.indexOf('Resume from Proposal') < 0) { console.error('ABORT: marker missing after splice'); process.exit(1); }
if (s.indexOf('Load as Buyer') >= 0 || s.indexOf('Load as Seller') >= 0) { console.error('ABORT: old buttons still present'); process.exit(1); }
if (s.indexOf('[Resume-FrostFix]') >= 0) { console.error('ABORT: old resume path still present'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
