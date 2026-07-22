const fs = require('fs');
const path = 'NeighborAgreement.tsx';
let src = fs.readFileSync(path, 'utf8');

// 5 own-line removals: strip leading newline + "  NAME,"
const ownLines = ['createPartialSigLocal','createFrostPartialSig','completeFrostAndBroadcast','computeFrostPartialS','aggregateFrostSig'];
for (const name of ownLines) {
  const re = new RegExp('\\r?\\n  ' + name + ',(?=\\r?\\n)');
  const hits = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (hits !== 1) { console.error('[B1] ABORT - "' + name + '" own-line: expected 1, found ' + hits); process.exit(1); }
  src = src.replace(re, '');
}

// shared-line: strip ", completeFrost2Round" before the closing brace
const shared = ", completeFrost2Round} from './frost_complete';";
const sharedHits = src.split(shared).length - 1;
if (sharedHits !== 1) { console.error('[B1] ABORT - shared line: expected 1, found ' + sharedHits); process.exit(1); }
src = src.replace(shared, "} from './frost_complete';");

// post-conditions: none of the 6 dead names remain as an import entry
for (const name of ['createPartialSigLocal','createFrostPartialSig','completeFrostAndBroadcast','computeFrostPartialS','aggregateFrostSig','completeFrost2Round']) {
  if (new RegExp('^  ' + name + ',?$', 'm').test(src)) { console.error('[B1] ABORT - "' + name + '" still present as import entry'); process.exit(1); }
}
// keepers must survive
for (const keep of ['aggregatePartialSigs','cleanup as cleanupFrost','aggregateToAddress']) {
  if (src.indexOf(keep) === -1) { console.error('[B1] ABORT - keeper "' + keep + '" was lost!'); process.exit(1); }
}

fs.writeFileSync(path, src, 'utf8');
console.log('[B1] OK - removed 6 dead import entries, keepers intact.');