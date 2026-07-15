// patch_p5d.cjs — 5d: seller reclaims collateral after N
// Run: node patch_p5d.cjs
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
guard('PRE 2d present', "{/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}", 1);
guard('PRE 5d absent', "{/* 5d: RECLAIM COLLATERAL */}", 0);

const BLOCK =
"                    {/* 5d: RECLAIM COLLATERAL */}\r\n" +
"                    {role === 'seller' && contract.agreementId && (\r\n" +
"                      <TouchableOpacity\r\n" +
"                        onPress={async () => {\r\n" +
"                          const _agrId = contract.agreementId || '';\r\n" +
"                          try {\r\n" +
"                            const _rj = await SecureStore.getItemAsync('kv_refund_' + _agrId);\r\n" +
"                            if (!_rj) { Alert.alert('No Reclaim Stored', 'There is no co-signed refund for this agreement. Your collateral can only be released by mutual signature.'); return; }\r\n" +
"                            const _r = JSON.parse(_rj);\r\n" +
"                            const _api = String(_r.network || 'testnet-10').includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';\r\n" +
"                            const _dag = await fetch(_api + '/info/blockdag');\r\n" +
"                            const _now = BigInt((_dag.ok ? await _dag.json() : {})?.virtualDaaScore || 0);\r\n" +
"                            if (_now === 0n) { Alert.alert('Error', 'Could not read the current DAA score.'); return; }\r\n" +
"                            const _lt = BigInt(_r.lockTime || '0');\r\n" +
"                            if (_lt === 0n) { Alert.alert('Error', 'Stored refund has no lockTime.'); return; }\r\n" +
"                            if (_now < _lt) {\r\n" +
"                              const _rem = Number(_lt - _now);\r\n" +
"                              Alert.alert('Not Yet', 'The reclaim window opens in about ' + Math.ceil(_rem / 60) + ' min (' + _rem + ' DAA).\\n\\nBroadcasting early is rejected by consensus — the lockTime is inside the signature and cannot be altered.');\r\n" +
"                              return;\r\n" +
"                            }\r\n" +
"                            // Do not strand the buyer: if they funded too, this is a normal trade.\r\n" +
"                            const _uResp = await fetch(_api + '/addresses/' + _r.frostAddr + '/utxos');\r\n" +
"                            const _u = _uResp.ok ? await _uResp.json() : [];\r\n" +
"                            if (Array.isArray(_u) && _u.length > 1) {\r\n" +
"                              Alert.alert('Buyer Has Funded', 'The buyer also funded the escrow, so this is a live trade. Reclaiming now would strand their deposit. Use release or mutual cancel instead.');\r\n" +
"                              return;\r\n" +
"                            }\r\n" +
"                            if (Array.isArray(_u) && _u.length === 0) {\r\n" +
"                              Alert.alert('Nothing to Reclaim', 'The escrow is empty — the collateral has already moved.');\r\n" +
"                              return;\r\n" +
"                            }\r\n" +
"                            Alert.alert('Reclaim Collateral?', 'Broadcast the timelocked refund for ' + (Number(_r.amountSompi) / 1e8) + ' KAS back to your wallet?', [\r\n" +
"                              { text: 'Cancel', style: 'cancel' },\r\n" +
"                              { text: 'Reclaim', onPress: async () => {\r\n" +
"                                try {\r\n" +
"                                  setIsLoading(true);\r\n" +
"                                  const _resp = await fetch(_api + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_r.txBody) });\r\n" +
"                                  if (!_resp.ok) {\r\n" +
"                                    const _t = await _resp.text();\r\n" +
"                                    console.warn('[Reclaim] L1 rejected:', _t.slice(0, 400));\r\n" +
"                                    Alert.alert('Rejected by L1', _t.slice(0, 300));\r\n" +
"                                    setIsLoading(false); return;\r\n" +
"                                  }\r\n" +
"                                  const _j = await _resp.json();\r\n" +
"                                  const _txId = _j.transactionId || '';\r\n" +
"                                  console.log('[Reclaim] Refund broadcast:', _txId);\r\n" +
"                                  await SecureStore.deleteItemAsync('kv_refund_' + _agrId).catch(() => {});\r\n" +
"                                  try { await releaseCommitment(_agrId); } catch {}\r\n" +
"                                  Alert.alert('Collateral Reclaimed', 'TX: ' + _txId.slice(0, 16) + '...\\n\\nYour deposit is on its way back.');\r\n" +
"                                } catch (e) {\r\n" +
"                                  console.error('[Reclaim] Error:', e);\r\n" +
"                                  Alert.alert('Error', e instanceof Error ? e.message : 'Reclaim failed');\r\n" +
"                                } finally { setIsLoading(false); }\r\n" +
"                              }},\r\n" +
"                            ]);\r\n" +
"                          } catch (e) {\r\n" +
"                            console.error('[Reclaim] Check failed:', e);\r\n" +
"                            Alert.alert('Error', e instanceof Error ? e.message : 'Reclaim check failed');\r\n" +
"                          }\r\n" +
"                        }}\r\n" +
"                        style={{ backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#d97706', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 }}\r\n" +
"                      >\r\n" +
"                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400e' }}>Reclaim Collateral</Text>\r\n" +
"                        <Text style={{ fontSize: rs.font(9), color: '#b45309', marginTop: 2 }}>Only if the buyer never funds, after {contract.timeoutMinutes ?? 5} min</Text>\r\n" +
"                      </TouchableOpacity>\r\n" +
"                    )}\r\n" +
"\r\n";

sub('1', A1, BLOCK + A1, "{/* 5d: RECLAIM COLLATERAL */}");

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
