const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('routeForPhase(')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// import derivePhase + routeForPhase from local_agreements
rep(
"import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements } from './local_agreements';",
"import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements, derivePhase, routeForPhase } from './local_agreements';",
"import");

// route by phase instead of always accepting
rep(
"                          if (manualVerCode.length !== 12) { Alert.alert('Verification', 'Enter the 12-character verification code'); return; }\n                          handleAcceptFromInbox({ ...manualLookupResult, _verificationCode: manualVerCode });",
"                          if (manualVerCode.length !== 12) { Alert.alert('Verification', 'Enter the 12-character verification code'); return; }\n                          try {\n                            const _mr: any = manualLookupResult;\n                            const _aid = _mr.agreementId || _mr.agreement_id;\n                            await laUpsert({ agrId: _aid, origin: 'given', buyerPubkey: _mr.buyerPubkey || _mr.pubkey, sellerPubkey: _mr.sellerPubkey || _mr.counterpartyPubkey, buyerAmountSompi: String(_mr.buyerAmountSompi ?? ''), sellerAmountSompi: String(_mr.sellerAmountSompi ?? ''), frostAddress: _mr.frostAddress || _mr.frost_address, frostCounter: _mr.frostCounter, network: _mr.network || 'testnet-10', description: _mr.description });\n                            const _ph = await derivePhase(_aid);\n                            const _route = routeForPhase(_ph.phase);\n                            console.log('[Lookup] phase:', _ph.phase, 'route:', _route, 'bal:', _ph.balanceKas, 'utxo:', _ph.utxoCount);\n                            if (_route === 'release') {\n                              setContract({ agreementId: _aid, multisigAddress: _ph.frostAddress, frostData: { address: _ph.frostAddress, network: _mr.network || 'testnet-10', frostCounter: _mr.frostCounter }, itemPriceKas: _ph.buyerKas, sellerCommitmentKas: _ph.sellerKas } as any);\n                              setStep(5);\n                              Alert.alert('Resumed at Release', 'Escrow holds ' + _ph.balanceKas.toFixed(2) + ' KAS. You are at the release step.');\n                              return;\n                            }\n                            if (_route === 'done') { Alert.alert('Already Complete', 'This agreement is finished (escrow ' + _ph.balanceKas.toFixed(2) + ' KAS).'); return; }\n                            if (_route === 'poll') { Alert.alert('In Progress', 'Escrow at ' + _ph.balanceKas.toFixed(2) + ' KAS. Funding will resume automatically — no action needed right now.'); return; }\n                          } catch (e) { console.warn('[Lookup] derivePhase failed, falling back to accept:', e); }\n                          handleAcceptFromInbox({ ...manualLookupResult, _verificationCode: manualVerCode });",
"route-by-phase");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_routephase',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
