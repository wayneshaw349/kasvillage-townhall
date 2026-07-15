// patch_p2b.cjs — Phase 2b: seller accept = freeze -> predict -> refund template -> NO broadcast
// Run: node patch_p2b.cjs
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

// ---- anchors ----
const A1 = "import { sendKaspaViaRest } from './kaspa_rest_tx';";
const A2 = "  buildTxBody,\n  buildReleaseTemplate as buildReleaseTemplateFn,";
const A3 = "          if (immediateSendAmount > 0 && wallet.privKeyHex && !_skipSend) {";
const A4 = "        } else try {\n              console.log('[Neighbor] Seller auto-sending', immediateSendAmount / 1e8, 'KASPA to FROST');";
const A5 = "                network: wallet.network || 'testnet-10',\n                payload: await (async () => { try { const nonce = generateFrostNonce({";
const A6 = "              console.log('[Neighbor] Seller collateral TX:', txResult.txId);\n              // DISABLED: await AsyncStorage.setItem('kv_frost_sent_' + agrId, String(Date.now())); // L1 is source of truth\n            } catch (e) { console.warn('[Neighbor] Seller auto-send failed (poll will retry):', e); }";

guard('A1 rest import', A1, 1);
guard('A2 steps import', A2, 1);
guard('A3 send gate', A3, 1);
guard('A4 else-try bug', A4, 1);
guard('A5 send params', A5, 1);
guard('A6 send tail', A6, 1);

// ---- 1: imports ----
sub('1', A1, "import { sendKaspaViaRest, broadcastPreparedTx } from './kaspa_rest_tx';");
sub('2', A2, "  buildTxBody,\r\n  buildSellerRefund,\r\n  cosignRefundTemplate,\r\n  verifyRefundTemplate,\r\n  p2pkScript,\r\n  buildReleaseTemplate as buildReleaseTemplateFn,");

// ---- 3: N=0 gate — never fund without a reclaim path ----
sub('3', A3,
"          // 2b GATE: refund is mandatory — never fund without a co-signed reclaim path\r\n" +
"          if (immediateSendAmount > 0 && !(Number(canon.timeoutN) > 0)) {\r\n" +
"            console.warn('[Refund] BLOCKED — proposal carries no timeout N. Not funding.');\r\n" +
"            Alert.alert('Cannot Accept', 'This proposal has no refund timeout, so your collateral would have no reclaim path. Ask the buyer for a fresh proposal.');\r\n" +
"            setIsLoading(false); setAcceptingId(null); return;\r\n" +
"          }\r\n" +
A3);

// ---- 4: kill the `else` — send was skipped whenever contract state was stale ----
sub('4', A4,
"        }\r\n" +
"        try {\r\n" +
"              console.log('[Neighbor] Seller preparing (freeze, no broadcast)', immediateSendAmount / 1e8, 'KASPA to FROST');");

// ---- 5: prepareOnly ----
sub('5', A5,
"                network: wallet.network || 'testnet-10',\r\n" +
"                prepareOnly: true,\r\n" +
"                payload: await (async () => { try { const nonce = generateFrostNonce({");

// ---- 6: freeze -> predict -> refund template -> persist -> clipboard. NO broadcast. ----
sub('6', A6,
"              if (!txResult.success || !txResult.predictedTxId || !txResult.preparedTx) {\r\n" +
"                console.warn('[Refund] Prepare failed:', txResult.error);\r\n" +
"                Alert.alert('Prepare Failed', txResult.error || 'Could not freeze the funding transaction. Nothing was sent.');\r\n" +
"                setIsLoading(false); setAcceptingId(null); return;\r\n" +
"              }\r\n" +
"              console.log('[Refund] Funding tx FROZEN. predicted txid:', txResult.predictedTxId, '| escrow =', txResult.predictedTxId + ':0');\r\n" +
"              // lockTime = now + N. The funding tx is not broadcast yet, so no fundDAA exists.\r\n" +
"              const _rDag = await fetch(_sApi + '/info/blockdag');\r\n" +
"              const _rNow = BigInt((_rDag.ok ? await _rDag.json() : {})?.virtualDaaScore || 0);\r\n" +
"              if (_rNow === 0n) { Alert.alert('Error', 'Could not read the current DAA score. Nothing was sent.'); setIsLoading(false); setAcceptingId(null); return; }\r\n" +
"              const _escrowScript = p2pkScript((frostData.aggregatedPubkey || '').slice(2));\r\n" +
"              const _refund = buildSellerRefund({\r\n" +
"                sellerPrivKeyHex: wallet.privKeyHex,\r\n" +
"                sellerPubkey: myPubkey,\r\n" +
"                buyerPubkey: proposerPubkey,\r\n" +
"                counter: frostData.frostCounter || 0,\r\n" +
"                predictedEscrowUtxo: { txId: txResult.predictedTxId, index: 0, amount: String(immediateSendAmount), scriptPubKey: _escrowScript },\r\n" +
"                fundDAA: _rNow,\r\n" +
"                N: BigInt(canon.timeoutN || 0),\r\n" +
"                agrId,\r\n" +
"              });\r\n" +
"              // DURABLE FIRST — this must survive app death; never React state.\r\n" +
"              await SecureStore.setItemAsync('kv_refund_pending_' + agrId, JSON.stringify({\r\n" +
"                preparedTx: txResult.preparedTx,\r\n" +
"                predictedTxId: txResult.predictedTxId,\r\n" +
"                template: _refund.template,\r\n" +
"                nonce: { k: _refund.nonce.k.toString(16), d_tweaked: _refund.nonce.d_tweaked.toString(16), R_hex: _refund.nonce.R_hex },\r\n" +
"                currentDAA: _rNow.toString(),\r\n" +
"                N: String(canon.timeoutN || 0),\r\n" +
"                amountSompi: String(immediateSendAmount),\r\n" +
"                escrowScript: _escrowScript,\r\n" +
"                counter: frostData.frostCounter || 0,\r\n" +
"                buyerPubkey: proposerPubkey,\r\n" +
"                sellerPubkey: myPubkey,\r\n" +
"                frostAddr: frostData.address,\r\n" +
"                network: wallet.network || 'testnet-10',\r\n" +
"                createdAt: Date.now(),\r\n" +
"              }));\r\n" +
"              try { await Clipboard.setStringAsync(_refund.templateB64); } catch {}\r\n" +
"              console.log('[Refund] Template built + persisted. lockTime =', String(_rNow + BigInt(canon.timeoutN || 0)), '— awaiting buyer co-signature.');\r\n" +
"              Alert.alert('Refund Template Copied', 'Send this to the buyer to co-sign.\\n\\nYour ' + (immediateSendAmount / 1e8) + ' KAS has NOT been sent. It goes out only after the buyer returns their signature.');\r\n" +
"            } catch (e) { console.warn('[Refund] Prepare/build failed — nothing sent:', e); Alert.alert('Error', 'Refund prepare failed. Nothing was sent.'); }");

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
