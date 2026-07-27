// patch_role_gate3.cjs — titles + role match guards, anchors verified via find_titles_v3
// Run: node patch_role_gate3.cjs
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const O = s;

if (s.includes('ROLE-MATCH-GUARD')) { console.log('already patched'); process.exit(0); }

const fails = [];
let n = 0;
function rep(A, B, t) {
  const c = s.split(A).length - 1;
  if (c !== 1) { fails.push(t + ' (count=' + c + ')'); return; }
  s = s.replace(A, B); n++; console.log('ok:', t);
}

// titles — exact text confirmed by hex
rep(
  ">Co-sign Seller's Refund</Text>",
  ">BUYER STEP 1 \u2014 Co-sign Seller's Refund</Text>",
  'title-amber');
rep(
  ">Paste Kill Tx from Seller</Text>",
  ">BUYER STEP 2 \u2014 Paste Kill Tx from Seller</Text>",
  'title-green');
rep(
  ">Paste Buyer's Refund Signature</Text>",
  ">SELLER STEP 2 \u2014 Paste Buyer's Refund Signature</Text>",
  'title-purple');

// guard at accept flow: chosen role vs derived canon.role
rep(
  "setRole(canon.role as any);",
  "if (role && canon.role && role !== canon.role) { Alert.alert('Role Mismatch', 'You selected ' + String(role).toUpperCase() + ', but this agreement lists your wallet as the ' + String(canon.role).toUpperCase() + '. Check that you opened the right agreement.'); setIsLoading(false); setAcceptingId(null); return; } /* ROLE-MATCH-GUARD */\n      setRole(canon.role as any);",
  'guard-accept');

// guard at third paste
rep(
  "setRole(_role);",
  "if (role && role !== _role) { Alert.alert('Role Mismatch', 'You selected ' + String(role).toUpperCase() + ', but this proposal lists your wallet as the ' + String(_role).toUpperCase() + '. Check that you pasted the right agreement.'); setIsLoading(false); return; }\n                        setRole(_role);",
  'guard-paste3');

if (fails.length) {
  console.error('ABORT - nothing written:');
  fails.forEach(f => console.error('  -', f));
  process.exit(1);
}
fs.writeFileSync(F + '.bak_rolegate3', O);
fs.writeFileSync(F, s);
console.log('patched ok -', n, 'edits');
