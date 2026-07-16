// patch_kill_b2.cjs — kill tx: paste 4 + buyer enforcement.
//  - 2d: seller aggregates BOTH, stores refund, funds, then puts the signed kill tx on the clipboard
//  - paste 4 UI: buyer stores the kill tx
//  - FROST-Poll + crash-recovery: buyer broadcasts the kill BEFORE funding, and REFUSES to fund without it
// Run: node patch_kill_b2.cjs
const fs = require('fs');

const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }
function requireCount(name, needle, expect){
  const n = occurrences(s, needle);
  if (n !== expect) { console.error('ABORT ['+name+'] found '+n+', expected '+expect); process.exit(1); }
  console.log('OK ['+name+'] count='+n);
}
function sub(name, a, r){
  if (typeof r !== 'string') { console.error('ABORT ['+name+'] replacement not a string'); process.exit(1); }
  const n = occurrences(s, a);
  if (n !== 1) { console.error('ABORT ['+name+'] anchor count='+n+', expected 1'); process.exit(1); }
  const before = s;
  s = s.split(a).join(r);
  if (s === before) { console.error('ABORT ['+name+'] NO-OP'); process.exit(1); }
  console.log('APPLIED ['+name+'] ' + (s.length - before.length >= 0 ? '+' : '') + (s.length - before.length) + ' bytes');
}

requireCount('B1 applied', "_refund.templateB64 + '|' + _kill.templateB64", 1);
requireCount('B2 absent', 'Kill-Gate', 0);

// ============ 2d: parse both responses ============
sub('2d parse',
"                              const _resp = parseResponse(v);\r\n                              if (!_resp) { Alert.alert('Error', 'Invalid signature format'); setIsLoading(false); return; }",
"                              const _rp = v.split('|');\r\n" +
"                              if (_rp.length !== 2) { Alert.alert('Error', 'Expected two signatures (refund|kill). Ask the buyer to re-copy.'); setIsLoading(false); return; }\r\n" +
"                              const _resp = parseResponse(_rp[0]);\r\n" +
"                              const _killResp = parseResponse(_rp[1]);\r\n" +
"                              if (!_resp || !_killResp) { Alert.alert('Error', 'Invalid signature format'); setIsLoading(false); return; }");

// ============ 2d: aggregate the kill tx too ============
sub('2d aggregate',
"                              const _lockTime = String(BigInt(_p.currentDAA) + BigInt(_p.N));",
"                              // Aggregate the kill tx BEFORE funding: if the buyer's kill partial is\r\n" +
"                              // bad, the seller must not fund at all — a live refund with no kill is\r\n" +
"                              // exactly the setup that lets a seller strand the buyer's payment.\r\n" +
"                              const _killNonce = { k: BigInt('0x' + _p.killNonce.k), d_tweaked: BigInt('0x' + _p.killNonce.d_tweaked), R_hex: _p.killNonce.R_hex };\r\n" +
"                              const _killAgg = buyerAggregate({\r\n" +
"                                nonce: _killNonce,\r\n" +
"                                buyerPubkey: _p.sellerPubkey,\r\n" +
"                                sellerPubkey: _p.buyerPubkey,\r\n" +
"                                counter: _p.counter,\r\n" +
"                                template: _p.killTemplate,\r\n" +
"                                sellerResponse: _killResp,\r\n" +
"                              });\r\n" +
"                              if ('error' in _killAgg) {\r\n" +
"                                console.warn('[Kill-Agg] FAILED:', _killAgg.error);\r\n" +
"                                Alert.alert('Kill Aggregation Failed', _killAgg.error + '\\n\\nNothing was sent.');\r\n" +
"                                setIsLoading(false); return;\r\n" +
"                              }\r\n" +
"                              const _lockTime = String(BigInt(_p.currentDAA) + BigInt(_p.N));");

// ============ 2d: hand the kill tx to the buyer ============
sub('2d handoff',
"                              Alert.alert('Collateral Sent', 'Reclaim secured, then funded.\\nTX: ' + (_br.txId || '').slice(0, 16) + '...\\n\\nIf the buyer never funds, you can reclaim after ' + (Number(_p.N) / 60) + ' min.');",
"                              // Paste 4: the buyer needs this to fund. Safe to hand over — it can only\r\n" +
"                              // move the collateral from escrow back to escrow, never to a person.\r\n" +
"                              try { await Clipboard.setStringAsync(JSON.stringify(_killAgg.txBody)); } catch {}\r\n" +
"                              Alert.alert('Collateral Sent — Send Kill Tx', 'Reclaim secured, then funded.\\nTX: ' + (_br.txId || '').slice(0, 16) + '...\\n\\nThe KILL TX is now on your clipboard. Send it to the buyer — they cannot fund without it.\\n\\nIf they never fund, reclaim after ' + (Number(_p.N) / 60) + ' min.');");

// ============ paste 4 UI: buyer stores the kill tx ============
sub('paste4 ui',
"                    {/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}",
"                    {/* PASTE 4: BUYER STORES THE KILL TX */}\r\n" +
"                    {role === 'buyer' && contract.multisigAddress && (\r\n" +
"                      <View style={{ backgroundColor: '#eef2ff', borderRadius: 12, borderWidth: 2, borderColor: '#6366f1', padding: 14, marginBottom: 16 }}>\r\n" +
"                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#3730a3', marginBottom: 4 }}>Paste Kill Tx from Seller</Text>\r\n" +
"                        <Text style={{ fontSize: rs.font(10), color: '#4338ca', marginBottom: 8 }}>Required before your payment goes out. This tx cancels the seller's reclaim the moment you fund — without it they could take their collateral back after {contract.timeoutMinutes ?? 5} min and leave you with nothing.</Text>\r\n" +
"                        <TextInput\r\n" +
"                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: rs.font(11), fontFamily: 'monospace', color: '#1c1917', minHeight: 60 }}\r\n" +
"                          placeholder=\"Paste the kill tx (JSON) from the seller...\"\r\n" +
"                          placeholderTextColor=\"#a8a29e\"\r\n" +
"                          multiline\r\n" +
"                          autoCapitalize=\"none\"\r\n" +
"                          autoCorrect={false}\r\n" +
"                          onChangeText={async (txt) => {\r\n" +
"                            const v = txt.trim();\r\n" +
"                            if (v.length < 20 || v.indexOf('transaction') < 0) return;\r\n" +
"                            try {\r\n" +
"                              const _kt = JSON.parse(v);\r\n" +
"                              const _in = _kt?.transaction?.inputs?.[0];\r\n" +
"                              const _out = _kt?.transaction?.outputs?.[0];\r\n" +
"                              const _pred = _in?.previousOutpoint?.transactionId || '';\r\n" +
"                              if (!_pred || _in?.previousOutpoint?.index !== 0) { Alert.alert('Invalid', 'Kill tx does not spend an escrow output at index 0.'); return; }\r\n" +
"                              if ((_kt.transaction.inputs || []).length !== 1 || (_kt.transaction.outputs || []).length !== 1) { Alert.alert('Invalid', 'Kill tx must have exactly 1 input and 1 output.'); return; }\r\n" +
"                              // It must pay back into the escrow, never to a person.\r\n" +
"                              const _esc = p2pkScript((contract.frostData?.aggregatedPubkey || '').slice(2));\r\n" +
"                              const _outScript = _out?.scriptPublicKey?.scriptPublicKey || _out?.scriptPublicKey || '';\r\n" +
"                              if (String(_outScript) !== _esc) { Alert.alert('Rejected', 'The kill tx does not return the collateral to the escrow. Do not fund.'); return; }\r\n" +
"                              if (Number(_kt.transaction.lockTime || 0) !== 0) { Alert.alert('Rejected', 'The kill tx has a lockTime — it must be broadcastable immediately.'); return; }\r\n" +
"                              await SecureStore.setItemAsync('kv_kill_' + (contract.agreementId || ''), JSON.stringify({ txBody: _kt, predictedTxId: _pred, createdAt: Date.now() }));\r\n" +
"                              console.log('[Kill] Stored. Kills utxo', _pred.slice(0, 16) + ':0');\r\n" +
"                              Alert.alert('Kill Tx Stored', 'Your payment can now go out. It will be broadcast automatically just before you fund.');\r\n" +
"                            } catch (e) {\r\n" +
"                              console.warn('[Kill] Store failed:', e);\r\n" +
"                              Alert.alert('Error', 'Could not read that kill tx.');\r\n" +
"                            }\r\n" +
"                          }}\r\n" +
"                        />\r\n" +
"                      </View>\r\n" +
"                    )}\r\n" +
"\r\n" +
"                    {/* 2d: SELLER AGGREGATES REFUND THEN FUNDS */}");

// ============ FROST-Poll gate ============
sub('poll gate',
"            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;",
"            // KILL-TX GATE — the buyer never funds while the seller's refund can still fire.\r\n" +
"            // This is the enforcement; the 5d UI check is only a courtesy.\r\n" +
"            try {\r\n" +
"              const _kj = await SecureStore.getItemAsync('kv_kill_' + contract.agreementId);\r\n" +
"              if (!_kj) { console.warn('[Kill-Gate] No kill tx stored — NOT funding. Ask the seller to send it.'); return; }\r\n" +
"              const _k = JSON.parse(_kj);\r\n" +
"              const _escrowTxId = frostUtxos[0]?.outpoint?.transactionId || '';\r\n" +
"              if (_escrowTxId === _k.predictedTxId) {\r\n" +
"                console.log('[Kill-Gate] Escrow still holds the seller-funded UTXO — broadcasting kill tx first');\r\n" +
"                const _kr = await fetch(apiBase + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_k.txBody) });\r\n" +
"                if (!_kr.ok) { const _t = await _kr.text(); console.warn('[Kill-Gate] Kill broadcast failed — NOT funding:', _t.slice(0, 200)); return; }\r\n" +
"                const _kres = await _kr.json();\r\n" +
"                console.log('[Kill-Gate] Kill broadcast:', _kres.transactionId, '— refund is now dead. Funding on the next poll.');\r\n" +
"                return;\r\n" +
"              }\r\n" +
"              console.log('[Kill-Gate] Seller UTXO already consumed — refund dead, safe to fund');\r\n" +
"            } catch (e) { console.warn('[Kill-Gate] Check failed — NOT funding:', e); return; }\r\n" +
"            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;");

// ============ crash-recovery gate ============
sub('recovery gate',
"            } catch (e) { console.warn('[5e-Guard] Crash-recovery check failed — NOT funding:', e); continue; }",
"            } catch (e) { console.warn('[5e-Guard] Crash-recovery check failed — NOT funding:', e); continue; }\r\n" +
"            // KILL-TX GATE (crash-recovery) — same rule: no kill tx, no funding.\r\n" +
"            try {\r\n" +
"              const _kj = await SecureStore.getItemAsync('kv_kill_' + entry.agrId);\r\n" +
"              if (!_kj) { console.warn('[Kill-Gate] Crash-recovery: no kill tx — NOT funding', entry.agrId.slice(0, 12)); continue; }\r\n" +
"              const _k = JSON.parse(_kj);\r\n" +
"              const _eTxId = eUtxos[0]?.outpoint?.transactionId || '';\r\n" +
"              if (_eTxId === _k.predictedTxId) {\r\n" +
"                const _kr = await fetch(apiBase + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_k.txBody) });\r\n" +
"                if (!_kr.ok) { console.warn('[Kill-Gate] Crash-recovery: kill broadcast failed — NOT funding'); continue; }\r\n" +
"                console.log('[Kill-Gate] Crash-recovery: kill broadcast — will fund next cycle');\r\n" +
"                continue;\r\n" +
"              }\r\n" +
"            } catch (e) { console.warn('[Kill-Gate] Crash-recovery check failed — NOT funding:', e); continue; }");

// ============ post-conditions ============
if (occurrences(s, 'Kill-Gate') < 6) { console.error('ABORT: kill gates missing'); process.exit(1); }
if (occurrences(s, 'buyerAggregate({') !== 3) { console.error('ABORT: expected 3 buyerAggregate calls, saw ' + occurrences(s, 'buyerAggregate({')); process.exit(1); }
if (occurrences(s, "kv_kill_' + contract.agreementId") < 2) { console.error('ABORT: kill store/read missing'); process.exit(1); }
if (occurrences(s, '[Refund] Signed refund STORED') !== 1) { console.error('ABORT: 2d block damaged'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
