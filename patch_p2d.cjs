// patch_p2d.cjs — Phase 2d: seller aggregates -> stores refund -> THEN funds
// Run: node patch_p2d.cjs
const fs = require('fs');

function esc(x){ return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function rx(a){ return new RegExp(esc(a).replace(/\n/g, '\\r?\\n'), 'g'); }

const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
function guard(name, a, expect){
  const c = (s.match(rx(a)) || []).length;
  if (c !== expect) { console.error('ABORT ['+name+'] count='+c+' expected='+expect); process.exit(1); }
  console.log('OK ['+name+'] count='+c);
}
function sub(name, a, r, marker){
  if (typeof r !== 'string') { console.error('ABORT ['+name+'] replacement is not a string'); process.exit(1); }
  const before = s;
  s = before.replace(rx(a), () => r);
  if (s === before) { console.error('ABORT ['+name+'] replace was a NO-OP'); process.exit(1); }
  if (marker && s.indexOf(marker) < 0) { console.error('ABORT ['+name+'] marker missing after replace'); process.exit(1); }
  console.log('APPLIED ['+name+'] +' + (s.length - before.length) + ' bytes');
}

const A1 = "                    <CollateralBreakdown\n                      buyerAmount={contract.itemPriceKas}\n                      sellerAmount={contract.sellerCommitmentKas}\n                      role={role}\n                    />";
guard('A1 CollateralBreakdown', A1, 1);
guard('PRE 2c present', "{/* 2c: BUYER CO-SIGNS SELLER REFUND */}", 1);
guard('PRE 2d absent', "{/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}", 0);

const BLOCK =
"                    {/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}\r\n" +
"                    {role === 'seller' && contract.multisigAddress && (\r\n" +
"                      <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 2, borderColor: '#22c55e', padding: 14, marginBottom: 16 }}>\r\n" +
"                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>Paste Buyer's Refund Signature</Text>\r\n" +
"                        <Text style={{ fontSize: rs.font(10), color: '#15803d', marginBottom: 8 }}>Your collateral is frozen but NOT sent. Paste the buyer's co-signature — your reclaim is stored first, then the collateral goes out.</Text>\r\n" +
"                        <TextInput\r\n" +
"                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: rs.font(11), fontFamily: 'monospace', color: '#1c1917', minHeight: 60 }}\r\n" +
"                          placeholder=\"Paste buyer's co-signature (base64)...\"\r\n" +
"                          placeholderTextColor=\"#a8a29e\"\r\n" +
"                          multiline\r\n" +
"                          autoCapitalize=\"none\"\r\n" +
"                          autoCorrect={false}\r\n" +
"                          onChangeText={async (txt) => {\r\n" +
"                            const v = txt.trim();\r\n" +
"                            if (v.length < 20) return;\r\n" +
"                            const _agrId = contract.agreementId || '';\r\n" +
"                            try {\r\n" +
"                              setIsLoading(true);\r\n" +
"                              const _pj = await SecureStore.getItemAsync('kv_refund_pending_' + _agrId);\r\n" +
"                              if (!_pj) { Alert.alert('No Pending Refund', 'Nothing is frozen for this agreement. Re-accept it to start over.'); setIsLoading(false); return; }\r\n" +
"                              const _p = JSON.parse(_pj);\r\n" +
"                              const _resp = parseResponse(v);\r\n" +
"                              if (!_resp) { Alert.alert('Error', 'Invalid signature format'); setIsLoading(false); return; }\r\n" +
"                              const _nonce = { k: BigInt('0x' + _p.nonce.k), d_tweaked: BigInt('0x' + _p.nonce.d_tweaked), R_hex: _p.nonce.R_hex };\r\n" +
"                              // Party mapping mirrors buildSellerRefund: funder (me) in the buyerPubkey slot.\r\n" +
"                              const _agg = buyerAggregate({\r\n" +
"                                nonce: _nonce,\r\n" +
"                                buyerPubkey: _p.sellerPubkey,\r\n" +
"                                sellerPubkey: _p.buyerPubkey,\r\n" +
"                                counter: _p.counter,\r\n" +
"                                template: _p.template,\r\n" +
"                                sellerResponse: _resp,\r\n" +
"                              });\r\n" +
"                              if ('error' in _agg) {\r\n" +
"                                console.warn('[Refund-Agg] FAILED:', _agg.error);\r\n" +
"                                Alert.alert('Aggregation Failed', _agg.error + '\\n\\nNothing was sent.');\r\n" +
"                                setIsLoading(false); return;\r\n" +
"                              }\r\n" +
"                              const _lockTime = String(BigInt(_p.currentDAA) + BigInt(_p.N));\r\n" +
"                              // 5c: the signed refund MUST be durable BEFORE the collateral moves.\r\n" +
"                              await SecureStore.setItemAsync('kv_refund_' + _agrId, JSON.stringify({\r\n" +
"                                txBody: _agg.txBody,\r\n" +
"                                lockTime: _lockTime,\r\n" +
"                                predictedTxId: _p.predictedTxId,\r\n" +
"                                amountSompi: _p.amountSompi,\r\n" +
"                                frostAddr: _p.frostAddr,\r\n" +
"                                network: _p.network,\r\n" +
"                                agrId: _agrId,\r\n" +
"                                createdAt: Date.now(),\r\n" +
"                              }));\r\n" +
"                              // Read back — never fund on the strength of a write we did not confirm.\r\n" +
"                              const _verify = await SecureStore.getItemAsync('kv_refund_' + _agrId);\r\n" +
"                              if (!_verify) { Alert.alert('Storage Failed', 'Could not save the signed refund. Nothing was sent.'); setIsLoading(false); return; }\r\n" +
"                              console.log('[Refund] Signed refund STORED. lockTime =', _lockTime, '— now funding.');\r\n" +
"                              const _br = await broadcastPreparedTx(_p.preparedTx, _p.network);\r\n" +
"                              if (!_br.success) {\r\n" +
"                                console.warn('[Refund] Funding broadcast failed:', _br.error);\r\n" +
"                                Alert.alert('Funding Failed', (_br.error || 'Broadcast failed') + '\\n\\nYour collateral was NOT sent.');\r\n" +
"                                setIsLoading(false); return;\r\n" +
"                              }\r\n" +
"                              const _match = _br.txId === _p.predictedTxId;\r\n" +
"                              console.log('[Refund] Funding broadcast:', _br.txId, '| predicted:', _p.predictedTxId, _match ? 'MATCH ✓' : 'MISMATCH ✗');\r\n" +
"                              if (!_match) {\r\n" +
"                                Alert.alert('WARNING — txid mismatch', 'Collateral was sent, but the broadcast txid differs from the prediction, so the stored refund will not spend it. Do not rely on the reclaim for this agreement.');\r\n" +
"                              }\r\n" +
"                              await SecureStore.deleteItemAsync('kv_refund_pending_' + _agrId).catch(() => {});\r\n" +
"                              setSellerLocked(true);\r\n" +
"                              setContract(prev => ({ ...prev, sellerLockTxId: _br.txId }));\r\n" +
"                              updateFrostEntry(_agrId, { timeoutN: Number(_p.N) });\r\n" +
"                              Alert.alert('Collateral Sent', 'Reclaim secured, then funded.\\nTX: ' + (_br.txId || '').slice(0, 16) + '...\\n\\nIf the buyer never funds, you can reclaim after ' + (Number(_p.N) / 60) + ' min.');\r\n" +
"                            } catch (e) {\r\n" +
"                              console.error('[Refund-Agg] Error:', e);\r\n" +
"                              Alert.alert('Error', e instanceof Error ? e.message : 'Aggregate failed');\r\n" +
"                            } finally { setIsLoading(false); }\r\n" +
"                          }}\r\n" +
"                        />\r\n" +
"                      </View>\r\n" +
"                    )}\r\n" +
"\r\n";

sub('1', A1, BLOCK + A1, "{/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}");

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
