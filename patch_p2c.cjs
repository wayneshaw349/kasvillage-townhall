// patch_p2c.cjs — Phase 2c: buyer co-signs the seller's refund
// Run: node patch_p2c.cjs
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
function sub(name, a, r){ s = s.replace(rx(a), () => r); console.log('APPLIED ['+name+']'); }

const A1 = "                    <CollateralBreakdown\n                      buyerAmount={contract.itemPriceKas}\n                      sellerAmount={contract.sellerCommitmentKas}\n                      role={role}\n                    />";
guard('A1 CollateralBreakdown', A1, 1);

const BLOCK =
"                    {/* 2c: BUYER CO-SIGNS SELLER REFUND */}\r\n" +
"                    {role === 'buyer' && contract.multisigAddress && (\r\n" +
"                      <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 2, borderColor: '#f59e0b', padding: 14, marginBottom: 16 }}>\r\n" +
"                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>Co-sign Seller's Refund</Text>\r\n" +
"                        <Text style={{ fontSize: rs.font(10), color: '#b45309', marginBottom: 8 }}>The seller has frozen their collateral but has NOT sent it yet. Paste their refund template to co-sign. This only lets them reclaim their own deposit if you never fund, after {contract.timeoutMinutes ?? 5} min. It cannot touch your money.</Text>\r\n" +
"                        <TextInput\r\n" +
"                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: rs.font(11), fontFamily: 'monospace', color: '#1c1917', minHeight: 60 }}\r\n" +
"                          placeholder=\"Paste seller's refund template (base64)...\"\r\n" +
"                          placeholderTextColor=\"#a8a29e\"\r\n" +
"                          multiline\r\n" +
"                          autoCapitalize=\"none\"\r\n" +
"                          autoCorrect={false}\r\n" +
"                          onChangeText={async (txt) => {\r\n" +
"                            const v = txt.trim();\r\n" +
"                            if (v.length < 20) return;\r\n" +
"                            try {\r\n" +
"                              setIsLoading(true);\r\n" +
"                              const _w = await loadMainWallet();\r\n" +
"                              if (!_w?.privKeyHex) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }\r\n" +
"                              const _tmpl = parseTemplate(v);\r\n" +
"                              if (!_tmpl) { Alert.alert('Error', 'Invalid template format'); setIsLoading(false); return; }\r\n" +
"                              const _net = contract.frostData?.network || 'testnet-10';\r\n" +
"                              const _api = _net.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';\r\n" +
"                              const _dag = await fetch(_api + '/info/blockdag');\r\n" +
"                              const _now = BigInt((_dag.ok ? await _dag.json() : {})?.virtualDaaScore || 0);\r\n" +
"                              if (_now === 0n) { Alert.alert('Error', 'Could not read the current DAA score — cannot check the timeout.'); setIsLoading(false); return; }\r\n" +
"                              const _esc = p2pkScript((contract.frostData?.aggregatedPubkey || '').slice(2));\r\n" +
"                              const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * 60));\r\n" +
"                              // predictedTxId is the seller's own prediction — the buyer cannot recompute it\r\n" +
"                              // (they don't know the seller's UTXO selection). Lying there only breaks the\r\n" +
"                              // seller's own reclaim. Everything that protects the BUYER is checked below:\r\n" +
"                              // escrow script, sole output to the seller, and lockTime >= now + N.\r\n" +
"                              const _res = cosignRefundTemplate({\r\n" +
"                                privateKeyHex: _w.privKeyHex,\r\n" +
"                                myPubkey: contract.buyerPubkey || '',\r\n" +
"                                funderPubkey: contract.sellerPubkey || '',\r\n" +
"                                counter: contract.frostData?.frostCounter || 0,\r\n" +
"                                template: _tmpl,\r\n" +
"                                expected: { predictedTxId: _tmpl.u[0]?.t || '', escrowScript: _esc, N: _N, currentDAA: _now },\r\n" +
"                              });\r\n" +
"                              if ('error' in _res) {\r\n" +
"                                console.warn('[Refund-Cosign] REJECTED:', _res.error);\r\n" +
"                                Alert.alert('Refund Rejected', _res.error + '\\n\\nDo not proceed with this trade.');\r\n" +
"                                setIsLoading(false); return;\r\n" +
"                              }\r\n" +
"                              try { await Clipboard.setStringAsync(_res.responseB64); } catch {}\r\n" +
"                              console.log('[Refund-Cosign] Signed. lockTime =', _tmpl.lt, 'now =', String(_now), 'N =', String(_N));\r\n" +
"                              Alert.alert('Refund Co-signed', 'Signature copied. Send it back to the seller — they will fund the escrow once they have it.');\r\n" +
"                            } catch (e) {\r\n" +
"                              console.error('[Refund-Cosign] Error:', e);\r\n" +
"                              Alert.alert('Error', e instanceof Error ? e.message : 'Co-sign failed');\r\n" +
"                            } finally { setIsLoading(false); }\r\n" +
"                          }}\r\n" +
"                        />\r\n" +
"                      </View>\r\n" +
"                    )}\r\n" +
"\r\n";

sub('1', A1, BLOCK + A1);

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
