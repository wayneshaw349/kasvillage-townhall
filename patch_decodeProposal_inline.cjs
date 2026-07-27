// patch_decodeProposal_inline.cjs — replace undefined decodeProposal() with inline literal (display-only toast)
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
fs.writeFileSync(F + '.bak2', s);

function rep(oldStr, newStr, label) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { console.error('ABORT ' + label + ' — count=' + n + ' (need 1)'); process.exit(1); }
  s = s.replace(oldStr, newStr);
  console.log('ok: ' + label);
}

const OLD = `{ const _dp = decodeProposal({ agrId: contract.agreementId || '', description: contract.itemDescription || '', buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8), sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8), timeoutN: Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN), verificationCode: contract.verificationCode || '', network: contract.frostData?.network || 'testnet-10' }, 'buyer'); Alert.alert('Copied — ' + _dp.title, _dp.rows.map(r => r.label + ': ' + r.value + (r.detail ? '\\n  ' + r.detail : '')).join('\\n\\n')); }`;

const NEW = `{ const _dp = { title: (contract.itemDescription || contract.agreementId || 'Agreement'), rows: [
  { label: 'Agreement', value: contract.agreementId || '', detail: '' },
  { label: 'Buyer locks', value: contract.itemPriceKas + ' KAS', detail: 'Pays the seller on release' },
  { label: 'Seller locks', value: contract.sellerCommitmentKas + ' KAS', detail: 'Good-faith deposit, returned on completion' },
  { label: 'Refund timeout', value: (contract.timeoutMinutes ?? 5) + ' min', detail: 'Seller reclaim window if buyer never funds' },
  { label: 'Code', value: contract.verificationCode || '', detail: 'Confirm this matches on both phones' },
  { label: 'Network', value: contract.frostData?.network || 'testnet-10', detail: '' },
] }; Alert.alert('Copied — ' + _dp.title, _dp.rows.filter(r => r.value).map(r => r.label + ': ' + r.value + (r.detail ? '\\n  ' + r.detail : '')).join('\\n\\n')); }`;

rep(OLD, NEW, 'decodeProposal-inline');
fs.writeFileSync(F, s);
console.log('patched ok - 1 edit');
