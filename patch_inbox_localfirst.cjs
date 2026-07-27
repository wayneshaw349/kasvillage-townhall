// patch_inbox_localfirst.cjs — device-local ledger becomes authoritative inbox base
// Run: node patch_inbox_localfirst.cjs
// Inserts a local-first merge immediately before the TownHall/Arweave setInboxAgreements.
// Local records (origin 'given', step 'proposed') carry the full pasted proposal
// incl. timeoutN, so they override the lossy TownHall snake_case record and kill
// the "no timeout N" false-block race.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const ORIG = s;

if (s.includes('LOCAL-FIRST-INBOX')) { console.log('already patched'); process.exit(0); }

// Anchor: the exact merge block at ~2220-2225 (TownHall/Arweave inbox commit).
const A =
"      console.log('[Neighbor] Inbox:', enrichedPending.length, 'valid proposals (filtered', pending.length - enrichedPending.length, 'invalid)');\n" +
"      setInboxAgreements(prev => {\n" +
"        const ids = new Set(enrichedPending.map(p => p.agreementId || p.agreement_id));\n" +
"        const kept = prev.filter(p => !ids.has(p.agreementId || p.agreement_id));\n" +
"        return [...enrichedPending, ...kept];\n" +
"      });";

const B =
"      console.log('[Neighbor] Inbox:', enrichedPending.length, 'valid proposals (filtered', pending.length - enrichedPending.length, 'invalid)');\n" +
"      // LOCAL-FIRST-INBOX: device ledger is authoritative — it holds the full pasted\n" +
"      // proposal (incl. timeoutN), so it overrides the lossy TownHall record.\n" +
"      let _localItems: any[] = [];\n" +
"      try {\n" +
"        const _local = await listActiveAgreements();\n" +
"        _localItems = _local\n" +
"          .filter((l: any) => l.step === 'proposed' && (l.buyerPubkey || l.sellerPubkey))\n" +
"          .map((l: any) => {\n" +
"            const _b = Number(l.buyerAmountSompi || 0);\n" +
"            const _se = Number(l.sellerAmountSompi || 0);\n" +
"            return {\n" +
"              agreementId: l.agrId, agreement_id: l.agrId,\n" +
"              pubkey: l.buyerPubkey || '', counterpartyPubkey: l.sellerPubkey || '',\n" +
"              amount_sompi: _b + _se, buyerAmountSompi: _b, sellerAmountSompi: _se,\n" +
"              description: l.description || '', network: l.network || 'testnet-10',\n" +
"              status: 'Proposed', frostCounter: l.frostCounter, timeoutN: Number(l.timeoutN || 0),\n" +
"              frostAddress: l.frostAddress || '',\n" +
"              partyA: { pubkey: l.buyerPubkey || '', amount_sompi: _b + _se },\n" +
"              _score: l.updatedAt || l.createdAt || 0, _local: true,\n" +
"            };\n" +
"          });\n" +
"      } catch (e) { console.warn('[LocalAgr] inbox map failed:', e); }\n" +
"      const _localIds = new Set(_localItems.map(i => i.agreementId));\n" +
"      const _remoteOnly = enrichedPending.filter(p => !_localIds.has(p.agreementId || p.agreement_id));\n" +
"      console.log('[Neighbor] Inbox local-first:', _localItems.length, 'local +', _remoteOnly.length, 'remote-only');\n" +
"      setInboxAgreements(prev => {\n" +
"        const ids = new Set([..._localIds, ..._remoteOnly.map(p => p.agreementId || p.agreement_id)]);\n" +
"        const kept = prev.filter(p => !ids.has(p.agreementId || p.agreement_id));\n" +
"        return [..._localItems, ..._remoteOnly, ...kept];\n" +
"      });";

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error('anchor count=' + c + ' — abort (paste 2220-2225 so I can re-anchor)');
  process.exit(1);
}
s = s.replace(A, B);

// import: reuse existing local_agreements import line, add listActiveAgreements
const IA = "import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx } from './local_agreements';";
const IB = "import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements } from './local_agreements';";
const ic = s.split(IA).length - 1;
if (ic !== 1) { console.error('import anchor count=' + ic + ' — abort'); process.exit(1); }
s = s.replace(IA, IB);

fs.writeFileSync(F + '.bak_inboxlocalfirst', ORIG);
fs.writeFileSync(F, s);
console.log('patched ok — local-first inbox + listActiveAgreements import');
