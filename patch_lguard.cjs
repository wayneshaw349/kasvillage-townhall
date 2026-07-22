const fs = require('fs');
const p = 'canonical_agreement_steps.ts';
let src = fs.readFileSync(p, 'utf8');
function die(m){ console.error('[L-Guard] ABORT - ' + m + ' (nothing written)'); process.exit(1); }

// 1) helper: insert right after p2pkScript definition (unique anchor)
const helperAnchor = "export function p2pkScript(xOnlyHex: string): string {\r\n  return '20' + xOnlyHex + 'ac';\r\n}";
const helperAnchorLF = helperAnchor.replace(/\r\n/g, '\n');
let anchor = null;
if (src.split(helperAnchor).length - 1 === 1) anchor = helperAnchor;
else if (src.split(helperAnchorLF).length - 1 === 1) anchor = helperAnchorLF;
else die('p2pkScript anchor not found exactly once');

const EOL = anchor === helperAnchor ? '\r\n' : '\n';
const helper = EOL + EOL +
'/**' + EOL +
' * [L-GUARD] Assert the signing-side aggregate key matches the escrow script being spent.' + EOL +
' * If the counter (or pubkey set) used at signing diverges from the one used at address' + EOL +
' * derivation, L differs, the aggregate key differs, and the signature can never satisfy' + EOL +
' * the escrow script - the failure would surface only at broadcast, or worse, in a stored' + EOL +
' * refund that silently cannot fire. This makes the divergence throw loudly BEFORE any k' + EOL +
' * is used or anything is signed.' + EOL +
' */' + EOL +
'export function assertLMatch(' + EOL +
'  agg: { aggXOnly: string },' + EOL +
'  templateInputs: Array<{ s: string; t?: string }>,' + EOL +
'  fnName: string,' + EOL +
'  counter?: number' + EOL +
'): void {' + EOL +
'  const expected = p2pkScript(agg.aggXOnly);' + EOL +
'  for (let gi = 0; gi < templateInputs.length; gi++) {' + EOL +
"    const got = (templateInputs[gi] && templateInputs[gi].s) || '';" + EOL +
'    if (got !== expected) {' + EOL +
'      throw new Error(' + EOL +
"        '[L-MISMATCH] ' + fnName + ': input ' + gi + ' escrow script does not match the aggregate key derived at signing time. ' +" + EOL +
"        'counter=' + String(counter) + ' derived=' + expected.slice(0, 20) + '... input=' + got.slice(0, 20) + '... ' +" + EOL +
"        'The signing counter/pubkeys differ from the ones used to derive the escrow address. NOTHING was signed. ' +" + EOL +
"        'Do not retry with a guessed counter - resume from the original proposal paste.'" + EOL +
'      );' + EOL +
'    }' + EOL +
'  }' + EOL +
'}';
src = src.replace(anchor, anchor + helper);

// 2) insert guard calls after the 4 deriveAggregateKey lines (2 distinct anchor texts, 2 hits each)
const sites = [
  { line: 'const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);', expect: 2,
    call: 'assertLMatch(agg, template.u, arguments.callee && arguments.callee.name || "sign", counter);' },
  { line: 'const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);', expect: 2,
    call: 'assertLMatch(agg, template.u, "cosign", counter);' },
];
// arguments.callee is illegal in strict mode / TS - use static names instead:
sites[0].call = "assertLMatch(agg, template.u, 'sellerSignTemplate/buyerAggregate', counter); // [L-GUARD]";
sites[1].call = "assertLMatch(agg, template.u, 'cosignRefund/cosignKill', counter); // [L-GUARD]";

for (const st of sites) {
  const hits = src.split(st.line).length - 1;
  if (hits !== st.expect) die('"' + st.line.slice(0, 50) + '" expected ' + st.expect + ' hits, found ' + hits);
  src = src.split(st.line).join(st.line + EOL + '  ' + st.call);
}

// post-conditions
const guardCount = src.split('// [L-GUARD]').length - 1;
if (guardCount !== 4) die('expected 4 guard insertions, found ' + guardCount);
if (src.split('export function assertLMatch(').length - 1 !== 1) die('helper not inserted exactly once');
for (const k of ['export function p2pkScript', 'export function deriveAggregateKey', 'export function generateNonce', 'export function partialSign']) {
  if (src.indexOf(k) === -1) die('keeper "' + k + '" lost');
}
fs.writeFileSync(p, src, 'utf8');
console.log('[L-Guard] OK - helper added + 4 guard calls inserted (sellerSignTemplate, buyerAggregate, cosignRefundTemplate, cosignKillTemplate).');