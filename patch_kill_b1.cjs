// patch_kill_b1.cjs — wire the kill tx into pastes 2 and 3.
// paste 2 (seller->buyer): refundTemplateB64 + '|' + killTemplateB64
// paste 3 (buyer->seller): refundRespB64      + '|' + killRespB64
// Run: node patch_kill_b1.cjs
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

requireCount('kill import absent', 'cosignKillTemplate', 0);

// ---------- imports ----------
sub('imports',
"  buildSellerRefund,\r\n  cosignRefundTemplate,\r\n  verifyRefundTemplate,",
"  buildSellerRefund,\r\n  buildKillTx,\r\n  cosignRefundTemplate,\r\n  verifyRefundTemplate,\r\n  cosignKillTemplate,\r\n  verifyKillTemplate,");

// ---------- 2b: build the kill tx alongside the refund ----------
sub('2b build',
"              // DURABLE FIRST — this must survive app death; never React state.\r\n              await SecureStore.setItemAsync('kv_refund_pending_' + agrId, JSON.stringify({",
"              // The kill tx: spends the SAME predicted UTXO A, pays it back to the escrow.\r\n" +
"              // Handing this to the buyer is what makes the refund safe to hold — the moment\r\n" +
"              // they fund, they broadcast this, A is consumed, and the refund dies. Without\r\n" +
"              // it the refund would stay live even after the buyer paid, letting a seller\r\n" +
"              // ship bricks, wait N, and walk with their collateral.\r\n" +
"              const _kill = buildKillTx({\r\n" +
"                sellerPrivKeyHex: wallet.privKeyHex,\r\n" +
"                sellerPubkey: myPubkey,\r\n" +
"                buyerPubkey: proposerPubkey,\r\n" +
"                counter: frostData.frostCounter || 0,\r\n" +
"                predictedEscrowUtxo: { txId: txResult.predictedTxId, index: 0, amount: String(immediateSendAmount), scriptPubKey: _escrowScript },\r\n" +
"                agrId,\r\n" +
"              });\r\n" +
"              // DURABLE FIRST — this must survive app death; never React state.\r\n" +
"              await SecureStore.setItemAsync('kv_refund_pending_' + agrId, JSON.stringify({");

sub('2b persist',
"                nonce: { k: _refund.nonce.k.toString(16), d_tweaked: _refund.nonce.d_tweaked.toString(16), R_hex: _refund.nonce.R_hex },",
"                nonce: { k: _refund.nonce.k.toString(16), d_tweaked: _refund.nonce.d_tweaked.toString(16), R_hex: _refund.nonce.R_hex },\r\n" +
"                killTemplate: _kill.template,\r\n" +
"                killNonce: { k: _kill.nonce.k.toString(16), d_tweaked: _kill.nonce.d_tweaked.toString(16), R_hex: _kill.nonce.R_hex },");

sub('2b clipboard',
"              try { await Clipboard.setStringAsync(_refund.templateB64); } catch {}",
"              try { await Clipboard.setStringAsync(_refund.templateB64 + '|' + _kill.templateB64); } catch {}");

sub('2b alert',
"              Alert.alert('Refund Template Copied', 'Send this to the buyer to co-sign.\\n\\nYour ' + (immediateSendAmount / 1e8) + ' KAS has NOT been sent. It goes out only after the buyer returns their signature.');",
"              Alert.alert('Templates Copied', 'Send both to the buyer to co-sign.\\n\\nYour ' + (immediateSendAmount / 1e8) + ' KAS has NOT been sent. It goes out only after they return their signatures.');");

// ---------- 2c: buyer co-signs both ----------
sub('2c parse',
"                              const _tmpl = parseTemplate(v);\r\n                              if (!_tmpl) { Alert.alert('Error', 'Invalid template format'); setIsLoading(false); return; }",
"                              const _pp = v.split('|');\r\n" +
"                              if (_pp.length !== 2) { Alert.alert('Error', 'Expected two templates (refund|kill). Ask the seller to re-copy.'); setIsLoading(false); return; }\r\n" +
"                              const _tmpl = parseTemplate(_pp[0]);\r\n" +
"                              const _killT = parseTemplate(_pp[1]);\r\n" +
"                              if (!_tmpl || !_killT) { Alert.alert('Error', 'Invalid template format'); setIsLoading(false); return; }\r\n" +
"                              // Both must spend the SAME utxo, or the kill would not kill this refund.\r\n" +
"                              if (_tmpl.u[0]?.t !== _killT.u[0]?.t) { Alert.alert('Rejected', 'The refund and kill templates spend different UTXOs. Do not proceed.'); setIsLoading(false); return; }");

sub('2c cosign',
"                              try { await Clipboard.setStringAsync(_res.responseB64); } catch {}\r\n                              console.log('[Refund-Cosign] Signed. lockTime =', _tmpl.lt, 'now =', String(_now), 'N =', String(_N));\r\n                              Alert.alert('Refund Co-signed', 'Signature copied. Send it back to the seller — they will fund the escrow once they have it.');",
"                              // The kill tx can only move A from escrow back to escrow, so signing\r\n" +
"                              // it costs the buyer nothing — and without it the refund would outlive\r\n" +
"                              // their payment.\r\n" +
"                              const _killRes = cosignKillTemplate({\r\n" +
"                                privateKeyHex: _w.privKeyHex,\r\n" +
"                                myPubkey: contract.buyerPubkey || '',\r\n" +
"                                funderPubkey: contract.sellerPubkey || '',\r\n" +
"                                counter: contract.frostData?.frostCounter || 0,\r\n" +
"                                template: _killT,\r\n" +
"                                expected: { predictedTxId: _killT.u[0]?.t || '', escrowScript: _esc },\r\n" +
"                              });\r\n" +
"                              if ('error' in _killRes) {\r\n" +
"                                console.warn('[Kill-Cosign] REJECTED:', _killRes.error);\r\n" +
"                                Alert.alert('Kill Tx Rejected', _killRes.error + '\\n\\nDo not proceed with this trade.');\r\n" +
"                                setIsLoading(false); return;\r\n" +
"                              }\r\n" +
"                              try { await Clipboard.setStringAsync(_res.responseB64 + '|' + _killRes.responseB64); } catch {}\r\n" +
"                              console.log('[Refund-Cosign] Signed. lockTime =', _tmpl.lt, 'now =', String(_now), 'N =', String(_N));\r\n" +
"                              console.log('[Kill-Cosign] Signed. kills utxo', (_killT.u[0]?.t || '').slice(0, 16) + ':0');\r\n" +
"                              Alert.alert('Both Co-signed', 'Signatures copied. Send them back to the seller — they will fund the escrow, then send you the kill tx.');");

// ---------- post-conditions ----------
if (occurrences(s, 'buildKillTx({') !== 1) { console.error('ABORT: buildKillTx call missing'); process.exit(1); }
if (occurrences(s, 'cosignKillTemplate({') !== 1) { console.error('ABORT: cosignKillTemplate call missing'); process.exit(1); }
if (occurrences(s, "_refund.templateB64 + '|' + _kill.templateB64") !== 1) { console.error('ABORT: paste 2 not joined'); process.exit(1); }
if (occurrences(s, "_res.responseB64 + '|' + _killRes.responseB64") !== 1) { console.error('ABORT: paste 3 not joined'); process.exit(1); }
if (occurrences(s, '[Refund] Funding tx FROZEN') !== 1) { console.error('ABORT: 2b block damaged'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
