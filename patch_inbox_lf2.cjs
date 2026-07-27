const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const ORIG=s;
if(s.includes('LOCAL-FIRST-INBOX')){console.log('already patched');process.exit(0);}
const A="        return [...enrichedPending, ...kept];";
const B="        return [...enrichedPending, ...kept];\n"+
"      }); /* original merge - superseded below by LOCAL-FIRST-INBOX */\n"+
"      let _localItems = [];\n"+
"      try {\n"+
"        const _local = await listActiveAgreements();\n"+
"        _localItems = _local.filter((l) => l.step === 'proposed' && (l.buyerPubkey || l.sellerPubkey)).map((l) => {\n"+
"          const _b = Number(l.buyerAmountSompi || 0); const _se = Number(l.sellerAmountSompi || 0);\n"+
"          return { agreementId: l.agrId, agreement_id: l.agrId, pubkey: l.buyerPubkey || '', counterpartyPubkey: l.sellerPubkey || '', amount_sompi: _b + _se, buyerAmountSompi: _b, sellerAmountSompi: _se, description: l.description || '', network: l.network || 'testnet-10', status: 'Proposed', frostCounter: l.frostCounter, timeoutN: Number(l.timeoutN || 0), frostAddress: l.frostAddress || '', partyA: { pubkey: l.buyerPubkey || '', amount_sompi: _b + _se }, _score: l.updatedAt || l.createdAt || 0, _local: true };\n"+
"        });\n"+
"      } catch (e) { console.warn('[LocalAgr] inbox map failed:', e); }\n"+
"      const _localIds = new Set(_localItems.map(i => i.agreementId));\n"+
"      const _remoteOnly = enrichedPending.filter(p => !_localIds.has(p.agreementId || p.agreement_id));\n"+
"      console.log('[Neighbor] Inbox local-first:', _localItems.length, 'local +', _remoteOnly.length, 'remote-only');\n"+
"      setInboxAgreements(prev => {\n"+
"        const ids = new Set([..._localIds, ..._remoteOnly.map(p => p.agreementId || p.agreement_id)]);\n"+
"        const kept = prev.filter(p => !ids.has(p.agreementId || p.agreement_id));\n"+
"        return [..._localItems, ..._remoteOnly, ...kept];";
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count='+c+' - abort');process.exit(1);}
s=s.replace(A,B);
const IA="import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx } from './local_agreements';";
const IB="import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements } from './local_agreements';";
const ic=s.split(IA).length-1;
if(ic!==1){console.error('import count='+ic+' - abort');process.exit(1);}
s=s.replace(IA,IB);
fs.writeFileSync(F+'.bak_inboxlf',ORIG);fs.writeFileSync(F,s);console.log('patched ok');
