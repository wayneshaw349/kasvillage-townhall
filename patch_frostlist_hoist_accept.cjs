const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
let ok = 0, total = 0;

function sub(tag, needle, repl) {
  total++;
  const n = s.split(needle).length - 1;
  if (n !== 1) { console.log(`SKIP [${tag}] count = ${n}, expected 1`); return; }
  s = s.replace(needle, repl);
  console.log(`APPLIED [${tag}]`);
  ok++;
}

// C: persist BEFORE the Arweave inscription - an inscribe throw must not leave the
// agreement out of the frost list (loop B never polls it, so it never funds).
const anchorC = `// Inscribe acceptance to Arweave`;
sub('accept-hoist', anchorC,
`// [FROSTLIST-HOIST-ACCEPT] persist before Arweave, not after.
          await addToFrostList({
            agrId: agrId, frostAddr: frostData.address,
            role: canon?.role as any || 'seller', step: 3,
            buyerAmount: buyerKas, sellerAmount: sellerKas,
            buyerPubkey: iAmProposer ? myPubkey : proposerPubkey,
            sellerPubkey: iAmProposer ? proposerPubkey : myPubkey,
            description: agreement.description || '', createdAt: Date.now(),
            timeoutN: Number(canon?.timeoutN || 0),
          });
          ` + anchorC);

// D: addToFrostList full-replaces the entry, so the post-inscribe upsert must carry
// timeoutN or it silently wipes it back to undefined and the 5e guard defaults.
sub('accept-timeoutN',
`              role: canon?.role as any || 'seller',
              step: 3,`,
`              role: canon?.role as any || 'seller',
              timeoutN: Number(canon?.timeoutN || 0),
              step: 3,`);

// post-conditions
const checks = [
  [`[FROSTLIST-HOIST-ACCEPT]`, 1],
  [`timeoutN: Number(canon?.timeoutN || 0),`, 2],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
