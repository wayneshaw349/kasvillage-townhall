// patch_l1_truth.cjs — the buyer's auto-send was gated on a sticky AsyncStorage flag:
//
//     const alreadySent = await AsyncStorage.getItem(sentKey);
//     if (!alreadySent && !cancelled) { ...send... }
//
// with no else branch. Once kv_frost_poll_sent_<agrId> was set — by any earlier attempt,
// or by the crash-recovery path, which writes the SAME key namespace — the send was
// skipped forever, silently, with no log. Same class as the `} else try {` bug: a guard
// whose failure is invisible.
//
// L1 already is the truth. _okOne immediately above proves the escrow holds exactly ONE
// utxo (the seller's). If the buyer had funded there would be two and we'd never reach
// here. The flag adds nothing but a way to wedge.
//
// In-flight protection (the 10s poll must not fire twice) becomes a module-scope Set:
// it survives re-renders but not a restart — and after a restart L1 shows the truth.
//
// Run: node patch_l1_truth.cjs
const fs = require('fs');

const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }
function sub(name, a, r, expect){
  const n = occurrences(s, a);
  if (n !== (expect === undefined ? 1 : expect)) { console.error('ABORT ['+name+'] found '+n+', expected '+(expect === undefined ? 1 : expect)); process.exit(1); }
  const before = s;
  s = s.split(a).join(r);
  if (s === before) { console.error('ABORT ['+name+'] NO-OP'); process.exit(1); }
  console.log('APPLIED ['+name+']');
}

if (occurrences(s, '_sendInFlight') !== 0) { console.error('ABORT: already applied'); process.exit(1); }

// ---- module-scope in-flight set (no component anchor needed) ----
sub('declare',
"const DAA_PER_MIN = 600;",
"const DAA_PER_MIN = 600;\r\n" +
"// In-flight guard for the buyer's auto-send. Module scope on purpose: it must survive\r\n" +
"// the 10s poll re-firing, but NOT an app restart — after a restart the escrow's utxo\r\n" +
"// count is the honest answer, and a durable flag could only lie.\r\n" +
"const _sendInFlight = { current: new Set() };");

// ---- stop reading the sticky flag; use the in-flight set instead ----
// (only the code is replaced, so the file's existing indentation is preserved)
sub('gate',
"if (!alreadySent && !cancelled) {",
"if (!_sendInFlight.current.has(contract.agreementId || '') && !cancelled) {");

sub('mark',
"console.log('[FROST-Poll] Counterparty sent! Auto-sending', myExpected / 1e8, 'KASPA');",
"_sendInFlight.current.add(contract.agreementId || ''); console.log('[FROST-Poll] Counterparty sent! Auto-sending', myExpected / 1e8, 'KASPA');");

// ---- release on failure so the next poll retries ----
sub('release on fail',
"console.warn('[FROST-Poll] Auto-send failed:', sendResult.error);",
"_sendInFlight.current.delete(contract.agreementId || ''); console.warn('[FROST-Poll] Auto-send failed:', sendResult.error);");

sub('release on error',
"} catch (e) { console.warn('[FROST-Poll] Auto-send error:', e); }",
"} catch (e) { _sendInFlight.current.delete(contract.agreementId || ''); console.warn('[FROST-Poll] Auto-send error:', e); }");

// ---- post-conditions ----
if (occurrences(s, 'if (!alreadySent && !cancelled)') !== 0) { console.error('ABORT: old gate still present'); process.exit(1); }
if (occurrences(s, '_sendInFlight.current.add') !== 1) { console.error('ABORT: mark missing'); process.exit(1); }
if (occurrences(s, '_sendInFlight.current.delete') !== 2) { console.error('ABORT: expected 2 releases, saw ' + occurrences(s, '_sendInFlight.current.delete')); process.exit(1); }
if (occurrences(s, '[Kill-Gate] Kill broadcast:') !== 1) { console.error('ABORT: kill gate damaged'); process.exit(1); }
if (occurrences(s, '[5e-Guard] FROST-Poll BLOCKED') !== 1) { console.error('ABORT: 5e guard damaged'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('\nNOTE: the crash-recovery path (entry.agrId) still reads the same flag. It fails');
console.log('by skipping one entry rather than wedging the UI, so it is left alone for now.');
console.log('Your stuck agreement should now fund on the next poll — the stale flag is simply');
console.log('no longer consulted.');
