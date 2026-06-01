const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Find and replace the entire Active Agreements block
const startMarker = "{frostActiveList.length > 0 && (";
const endMarker = `<Text style={{ fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.indigo900, marginBottom: 12, textAlign: 'center' }}>What type of agreement?</Text>`;

const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(endMarker);

if (startIdx < 0) { console.log('Start marker not found'); process.exit(1); }
if (endIdx < 0) { console.log('End marker not found'); process.exit(1); }

// New Resume Agreement UI
const newBlock = `{/* RESUME AGREEMENT — pick role + paste AGR ID */}
                <View style={{ marginBottom: 12, backgroundColor: '#f0f9ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#93c5fd' }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 }}>Resume Agreement</Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, fontFamily: 'monospace', color: '#1c1917', marginBottom: 10 }}
                    placeholder="Paste AGR_ID here..."
                    placeholderTextColor="#a8a29e"
                    value={manualAgrId}
                    onChangeText={setManualAgrId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#059669', borderRadius: 8, padding: 12, alignItems: 'center' }}
                      disabled={!manualAgrId || manualAgrId.length < 6}
                      onPress={async () => {
                        if (!manualAgrId || manualAgrId.length < 6) return;
                        setIsLoading(true);
                        try {
                          const wallet = await loadMainWallet();
                          if (!wallet) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }
                          const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
                          const dp = wallet.address.split(':')[1];
                          const d5 = Array.from(dp).map((c) => CHARSET.indexOf(c));
                          const rb = []; let bf = 0, bi = 0;
                          for (const d of d5) { bf = (bf << 5) | d; bi += 5; while (bi >= 8) { bi -= 8; rb.push((bf >> bi) & 0xff); } }
                          const myPk = rb[0] === 0x00 && rb.length >= 33 ? '02' + rb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('') : '';
                          // Look up from Arweave
                          const all = await queryAgreementsFromArweave({ network: 'testnet-10' });
                          const match = all.find((a) => (a.agreementId || a.agreement_id) === manualAgrId);
                          if (!match) { Alert.alert('Not Found', 'AGR ID not found on Arweave'); setIsLoading(false); return; }
                          const frostAddr = match.frostAddress || '';
                          const buyerAmt = (match.buyerAmountSompi || 0) / 1e8;
                          const sellerAmt = (match.sellerAmountSompi || 0) / 1e8;
                          const proposerPk = match.pubkey || match.partyA?.pubkey || '';
                          const counterPk = match.counterpartyPubkey || '';
                          const iAmProposer = proposerPk.startsWith(myPk.slice(0, 16));
                          // Check L1 balance for step
                          let derivedStep = 3;
                          if (frostAddr && frostAddr.length > 20) {
                            try {
                              const api = wallet.network?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
                              const br = await fetch(api + '/addresses/' + frostAddr + '/balance');
                              if (br.ok) { const bd = await br.json(); if (Number(bd.balance || '0') / 1e8 >= buyerAmt + sellerAmt && buyerAmt + sellerAmt > 0) derivedStep = 4; }
                            } catch {}
                          }
                          // ROLE = BUYER
                          setRole('buyer');
                          setAgreementType('trade');
                          setContract({ agreementId: manualAgrId, multisigAddress: frostAddr, itemPriceKas: buyerAmt, sellerCommitmentKas: sellerAmt, buyerPubkey: iAmProposer ? myPk : proposerPk, sellerPubkey: iAmProposer ? counterPk : myPk, itemDescription: match.description || manualAgrId.slice(0,12), stipulations: '', expiryHours: 24, frostData: frostAddr ? { address: frostAddr, network: 'testnet-10' } : undefined });
                          if (derivedStep >= 4) { setBuyerLocked(true); setSellerLocked(true); }
                          setStep(derivedStep);
                          console.log('[Resume] Loaded as BUYER, step:', derivedStep, 'frost:', frostAddr?.slice(0,25));
                        } catch (e) { Alert.alert('Error', String(e)); }
                        finally { setIsLoading(false); }
                      }}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{'\\u{1F6D2} Load as Buyer'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                      disabled={!manualAgrId || manualAgrId.length < 6}
                      onPress={async () => {
                        if (!manualAgrId || manualAgrId.length < 6) return;
                        setIsLoading(true);
                        try {
                          const wallet = await loadMainWallet();
                          if (!wallet) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }
                          const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
                          const dp = wallet.address.split(':')[1];
                          const d5 = Array.from(dp).map((c) => CHARSET.indexOf(c));
                          const rb = []; let bf = 0, bi = 0;
                          for (const d of d5) { bf = (bf << 5) | d; bi += 5; while (bi >= 8) { bi -= 8; rb.push((bf >> bi) & 0xff); } }
                          const myPk = rb[0] === 0x00 && rb.length >= 33 ? '02' + rb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('') : '';
                          const all = await queryAgreementsFromArweave({ network: 'testnet-10' });
                          const match = all.find((a) => (a.agreementId || a.agreement_id) === manualAgrId);
                          if (!match) { Alert.alert('Not Found', 'AGR ID not found on Arweave'); setIsLoading(false); return; }
                          const frostAddr = match.frostAddress || '';
                          const buyerAmt = (match.buyerAmountSompi || 0) / 1e8;
                          const sellerAmt = (match.sellerAmountSompi || 0) / 1e8;
                          const proposerPk = match.pubkey || match.partyA?.pubkey || '';
                          const counterPk = match.counterpartyPubkey || '';
                          const iAmProposer = proposerPk.startsWith(myPk.slice(0, 16));
                          let derivedStep = 3;
                          if (frostAddr && frostAddr.length > 20) {
                            try {
                              const api = wallet.network?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
                              const br = await fetch(api + '/addresses/' + frostAddr + '/balance');
                              if (br.ok) { const bd = await br.json(); if (Number(bd.balance || '0') / 1e8 >= buyerAmt + sellerAmt && buyerAmt + sellerAmt > 0) derivedStep = 4; }
                            } catch {}
                          }
                          // ROLE = SELLER
                          setRole('seller');
                          setAgreementType('trade');
                          setContract({ agreementId: manualAgrId, multisigAddress: frostAddr, itemPriceKas: buyerAmt, sellerCommitmentKas: sellerAmt, buyerPubkey: iAmProposer ? myPk : proposerPk, sellerPubkey: iAmProposer ? counterPk : myPk, itemDescription: match.description || manualAgrId.slice(0,12), stipulations: '', expiryHours: 24, frostData: frostAddr ? { address: frostAddr, network: 'testnet-10' } : undefined });
                          if (derivedStep >= 4) { setBuyerLocked(true); setSellerLocked(true); }
                          setStep(derivedStep);
                          console.log('[Resume] Loaded as SELLER, step:', derivedStep, 'frost:', frostAddr?.slice(0,25));
                        } catch (e) { Alert.alert('Error', String(e)); }
                        finally { setIsLoading(false); }
                      }}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{'\\u{1F3EA} Load as Seller'}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
                `;

s = s.slice(0, startIdx) + newBlock + s.slice(endIdx);

fs.writeFileSync(f, s);
console.log('Done: Resume Agreement UI replaces Active Agreements list');
console.log('Verify Resume:', s.includes('Resume Agreement'));
console.log('Verify Load as Buyer:', s.includes('Load as Buyer'));
console.log('Verify Load as Seller:', s.includes('Load as Seller'));
console.log('Lines:', s.split('\n').length);
