// patch_baseline_types.cjs — clear pre-existing TS errors around 1716/1724/1736
// Run: node patch_baseline_types.cjs
// Three independent single-occurrence anchors; each count-guarded.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const ORIG = s;

if (s.includes('BASELINE-TYPES')) { console.log('already patched'); process.exit(0); }

const fails = [];
let n = 0;
function rep(A, B, tag) {
  const c = s.split(A).length - 1;
  if (c !== 1) { fails.push(tag + ' (count=' + c + ')'); return; }
  s = s.replace(A, B); n++; console.log('ok:', tag);
}

// 1716: type the tag-map accumulator and forEach param
rep(
  "const t2 = edge2?.node?.tags || []; const m2 = {}; t2.forEach(t => { m2[t.name] = t.value; });",
  "const t2 = edge2?.node?.tags || []; const m2: Record<string, string> = {}; /* BASELINE-TYPES */ t2.forEach((t: any) => { m2[t.name] = t.value; });",
  '1716-tagmap');

// 1724: type the disabled result literal so downstream reads (txId/explorerUrl/error) are valid
rep(
  "const result = { success: false, txId: null }; // DISABLED: completeFrost2Round",
  "const result: { success: boolean; txId: string | null; explorerUrl?: string; error?: string } = { success: false, txId: null }; // DISABLED: completeFrost2Round",
  '1724-result');

if (fails.length) {
  console.error('\nABORT — no changes written:');
  fails.forEach(f => console.error('  -', f));
  process.exit(1);
}

fs.writeFileSync(F + '.bak_baselinetypes', ORIG);
fs.writeFileSync(F, s);
console.log('\npatched ok -', n, 'edits');
