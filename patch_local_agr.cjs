const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('local_agreements')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_localagr',s);
let n=0;
function rep(A,B,tag){const c=s.split(A).length-1;if(c!==1){console.error('abort: anchor "'+tag+'" count='+c);process.exit(1);}s=s.replace(A,B);n++;console.log('ok:',tag);}

// import (anchor: AsyncStorage import line)
rep("import AsyncStorage from '@react-native-async-storage/async-storage';",
"import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx } from './local_agreements';",
'import');

// 1 buyer proposal created
rep("console.log('[Neighbor] Agreement proposed on TownHall:', agreementId);",
"console.log('[Neighbor] Agreement proposed on TownHall:', agreementId);\n      laUpsert({ agrId: agreementId, role: 'buyer', origin: 'mine' }).catch(() => {});",
'1-proposal-created');

// 2a seller paste parsed (meta from parsed)
rep('console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);',
'console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);\n      laUpsert({ agrId: parsed.agrId, role: \'seller\', origin: \'given\', buyerPubkey: parsed.buyerPubkey, sellerPubkey: parsed.sellerPubkey, buyerAmountSompi: String(parsed.buyerAmountSompi ?? \'\'), sellerAmountSompi: String(parsed.sellerAmountSompi ?? \'\'), frostCounter: parsed.frostCounter, timeoutN: parsed.timeoutN, network: parsed.network, description: parsed.description, verificationCode: parsed.verificationCode, buyerR: parsed.buyerR }).catch(() => {});',
'2a-paste-parsed');

// 2b agree tapped
rep("console.log('[Neighbor] Agree tapped:', _agrId);",
"console.log('[Neighbor] Agree tapped:', _agrId);\n      laStep(_agrId, 'agreed').catch(() => {});",
'2b-agree');

// 3 templates built
rep("console.log('[Refund] Template built + persisted. lockTime =', String(_rNow + BigInt(canon.timeoutN || 0)), '— awaiting buyer co-signature.');",
"console.log('[Refund] Template built + persisted. lockTime =', String(_rNow + BigInt(canon.timeoutN || 0)), '— awaiting buyer co-signature.');\n      laUpsert({ agrId, predictedFundingTxId: txResult.predictedTxId }).then(() => laStep(agrId, 'templates_built')).catch(() => {});",
'3-templates');

// 4a seller funding broadcast
rep("console.log('[Refund] Funding broadcast:', _br.txId, '| predicted:', _p.predictedTxId, _match ? 'MATCH \u2713' : 'MISMATCH \u2717');",
"console.log('[Refund] Funding broadcast:', _br.txId, '| predicted:', _p.predictedTxId, _match ? 'MATCH \u2713' : 'MISMATCH \u2717');\n      laUpsert({ agrId: _agrId, escrowTxId: _br.txId }).then(() => laStep(_agrId, 'seller_funded')).catch(() => {});",
'4a-funded');

// 4b buyer kill broadcast
rep("console.log('[Kill-Gate] Kill broadcast:', _kres.transactionId, '\u2014 refund is now dead. Funding on the next poll.');",
"console.log('[Kill-Gate] Kill broadcast:', _kres.transactionId, '\u2014 refund is now dead. Funding on the next poll.');\n      laUpsert({ agrId: contract.agreementId, killTxId: _kres.transactionId }).then(() => laStep(contract.agreementId, 'kill_broadcast')).catch(() => {});",
'4b-kill');

// 5a cancel
rep("try { await releaseCommitment(contract.agreementId || ''); console.log('[Cancel] Released UTXO tags for', contract.agreementId);} catch(e) { console.warn('[Cancel] Release failed:', e); }",
"try { await releaseCommitment(contract.agreementId || ''); console.log('[Cancel] Released UTXO tags for', contract.agreementId);} catch(e) { console.warn('[Cancel] Release failed:', e); }\n      laAbort(contract.agreementId || '', 'cancel').catch(() => {});",
'5a-cancel');

// 5b abort
rep("try { await releaseCommitment(_agrId); console.log('[Abort] Released UTXO tags for', _agrId); } catch (e) { console.warn('[Abort] releaseCommitment failed:', e); }",
"try { await releaseCommitment(_agrId); console.log('[Abort] Released UTXO tags for', _agrId); } catch (e) { console.warn('[Abort] releaseCommitment failed:', e); }\n      laAbort(_agrId, 'abort').catch(() => {});",
'5b-abort');

fs.writeFileSync(F,s);console.log('patched ok -',n,'edits');
