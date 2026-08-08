// make_forgery_test.cjs — build the negative control for the derivation check.
//
// Writes two files from seller.json:
//   honest.json  = the real record + its real frostCounter        -> expect DERIVED
//   forged.json  = same record, frostAddr swapped for a DIFFERENT real escrow
//                  that genuinely was spent on L1                 -> expect FORGED
//
// forged.json is precisely the borrowed-anchor attack: every signature verifies,
// the L1 anchor is real, the chain is intact. Only the derivation catches it.
// If forged.json passes, the check is decorative and must not ship.
const fs = require('fs');

const REAL_COUNTER = 2141252532;
// A different address from the scan - real, funded by two parties, really spent.
const BORROWED = 'kaspatest:qq69yuzc7svp95nvyguwfvv54em7tgzjtszwevew97sawm8uc3rgx443dn6nl';

const raw = String(fs.readFileSync('seller.json')).replace(/^\uFEFF/, '');
const b = JSON.parse(raw);
if (!b.records || !b.records.length) { console.error('seller.json has no records'); process.exit(1); }

const honest = JSON.parse(raw);
honest.records[0].frostCounter = REAL_COUNTER;
fs.writeFileSync('honest.json', JSON.stringify(honest));

const forged = JSON.parse(raw);
forged.records[0].frostCounter = REAL_COUNTER;
forged.records[0].frostAddr = BORROWED;
fs.writeFileSync('forged.json', JSON.stringify(forged));

console.log('wrote honest.json  (real frostAddr + real counter)');
console.log('wrote forged.json  (borrowed frostAddr + real counter)');
console.log('');
console.log('NOTE: changing frostAddr changes the SIGNED bytes, so forged.json will');
console.log('also show cpSig/mySig INVALID - that is a second, independent defence.');
console.log('To isolate the derivation check, look at the frostAddr line specifically.');
