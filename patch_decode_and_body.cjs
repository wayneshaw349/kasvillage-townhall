// patch_decode_and_body.cjs — wire proposal_decode + persist raw proposalBody
// Run: node patch_decode_and_body.cjs
// Single-line anchors, CRLF-safe, per-anchor count guard, collects all fails.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const ORIG = s;

if (s.includes('proposal_decode')) { console.log('already patched'); process.exit(0); }

const fails = [];
let n = 0;
function rep(A, B, tag) {
  const c = s.split(A).length - 1;
  if (c !== 1) { fails.push(tag + ' (count=' + c + ')'); return; }
  s = s.replace(A, B); n++; console.log('ok:', tag);
}

// --- import (after the local_agreements import line) ---
rep(
  "import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements } from './local_agreements';",
  "import { upsertAgreement as laUpsert, advanceStep as laStep, abortAgreement as laAbort, recordArweaveTx as laArTx, listActiveAgreements } from './local_agreements';\nimport { decodeProposal } from './proposal_decode';",
  'import');

// --- body persistence: SELLER paste (3559 upsert already exists — add proposalBody + decode popup) ---
// The existing seller upsert lacks proposalBody. Add it via the kvClean var in scope.
rep(
  "laUpsert({ agrId: parsed.agrId, role: 'seller', origin: 'given', buyerPubkey: parsed.buyerPubkey, sellerPubkey: parsed.sellerPubkey, buyerAmountSompi: String(parsed.buyerAmountSompi ?? ''), sellerAmountSompi: String(parsed.sellerAmountSompi ?? ''), frostCounter: parsed.frostCounter, timeoutN: parsed.timeoutN, network: parsed.network, description: parsed.description, verificationCode: parsed.verificationCode, buyerR: parsed.buyerR }).catch(() => {});",
  "laUpsert({ agrId: parsed.agrId, role: 'seller', origin: 'given', proposalBody: kvClean, buyerPubkey: parsed.buyerPubkey, sellerPubkey: parsed.sellerPubkey, buyerAmountSompi: String(parsed.buyerAmountSompi ?? ''), sellerAmountSompi: String(parsed.sellerAmountSompi ?? ''), frostCounter: parsed.frostCounter, timeoutN: parsed.timeoutN, network: parsed.network, description: parsed.description, verificationCode: parsed.verificationCode, buyerR: parsed.buyerR }).catch(() => {});",
  '2a-seller-body');

// --- seller decode popup: swap the raw Item/Amount/Code Alert message for decoded rows ---
rep(
  "Alert.alert(\"Proposal Found\", \"Item: \" + (parsed.description || \"N/A\") + \"\\nAmount: \" + (Number(parsed.buyerAmountSompi || 0)/1e8) + \" KAS\\nCode: \" + (parsed.verificationCode || \"\"), [",
  "Alert.alert(decodeProposal(parsed, 'seller').title, decodeProposal(parsed, 'seller').rows.map(r => r.label + ': ' + r.value + (r.detail ? '\\n  ' + r.detail : '')).join('\\n\\n'), [",
  '2b-seller-popup');

// --- body persistence: BUYER create (2003 upsert — add proposalBody; but shareText is at 3940, not here) ---
// At the create site (2003) the signed body isn't generated yet. Persist role/origin now;
// the buyer body is stored at the copy site below where generateProposal() produces it.
// (no change to 2003 beyond what's there — leaving as-is)

// --- body persistence: BUYER copy (3940 shareText) + decode popup replacing 'Copied!' ---
rep(
  "Clipboard.setStringAsync(shareText);\n                          Alert.alert('Copied!', 'Agreement details copied to clipboard');",
  "Clipboard.setStringAsync(shareText);\n                          laUpsert({ agrId: contract.agreementId || '', role: 'buyer', origin: 'mine', proposalBody: shareText, buyerPubkey: contract.buyerPubkey || '', sellerPubkey: contract.sellerPubkey || '', buyerAmountSompi: String(Math.floor(contract.itemPriceKas * 1e8)), sellerAmountSompi: String(Math.floor(contract.sellerCommitmentKas * 1e8)), timeoutN: Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN), network: contract.frostData?.network || 'testnet-10', description: (contract.itemDescription || ''), verificationCode: contract.verificationCode || '', buyerR: buyerR_saved }).catch(() => {});\n                          { const _dp = decodeProposal({ agrId: contract.agreementId || '', description: contract.itemDescription || '', buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8), sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8), timeoutN: Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN), verificationCode: contract.verificationCode || '', network: contract.frostData?.network || 'testnet-10' }, 'buyer'); Alert.alert('Copied — ' + _dp.title, _dp.rows.map(r => r.label + ': ' + r.value + (r.detail ? '\\n  ' + r.detail : '')).join('\\n\\n')); }",
  '3-buyer-body+popup');

// --- body persistence: THIRD paste path (after _role derived at 3312-3314) ---
rep(
  "        else { Alert.alert('Not Your Agreement', 'Neither party in this proposal matches your wallet.'); setIsLoading(false); return; }",
  "        else { Alert.alert('Not Your Agreement', 'Neither party in this proposal matches your wallet.'); setIsLoading(false); return; }\n                        laUpsert({ agrId: _p.agrId, role: _role, origin: _role === 'buyer' ? 'mine' : 'given', proposalBody: _kvClean, buyerPubkey: _p.buyerPubkey, sellerPubkey: _p.sellerPubkey, buyerAmountSompi: String(_p.buyerAmountSompi ?? ''), sellerAmountSompi: String(_p.sellerAmountSompi ?? ''), frostCounter: _p.frostCounter, timeoutN: _p.timeoutN, network: _p.network, description: _p.description, verificationCode: _p.verificationCode, buyerR: _p.buyerR }).catch(() => {});",
  '4-thirdpaste-body');

if (fails.length) {
  console.error('\nABORT — no changes written:');
  fails.forEach(f => console.error('  -', f));
  process.exit(1);
}

fs.writeFileSync(F + '.bak_decodebody', ORIG);
fs.writeFileSync(F, s);
console.log('\npatched ok -', n, 'edits');
