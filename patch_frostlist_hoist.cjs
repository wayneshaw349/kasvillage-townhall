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

// A: write to frost list BEFORE the TownHall network call, not after it
const anchorA = `console.log('[Neighbor] Proposing to TownHall:', agreementId, 'frost:', frostData.address, 'DAA:', currentDaa);`;
sub('propose-hoist', anchorA,
`// [FROSTLIST-HOIST] persist BEFORE any network call - a TownHall throw or success:false
            // must not leave the agreement invisible to the background poller (loop B).
            await addToFrostList({
              agrId: agreementId, frostAddr: frostData.address, role: role === 'seller' ? 'seller' : 'buyer', step: 3,
              buyerAmount: contract.itemPriceKas, sellerAmount: contract.sellerCommitmentKas,
              buyerPubkey: contract.buyerPubkey || '', sellerPubkey: contract.sellerPubkey || '',
              description: (contract.itemDescription || '') + (contract.shippingCenter ? ' - Ship to: ' + contract.shippingCenter : ''), createdAt: Date.now(),
              timeoutN: Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN),
            });
            ` + anchorA);

// B: the post-success write is now a redundant upsert - stop it hardcoding buyer
sub('propose-role-fix',
`agrId: agreementId, frostAddr: frostData.address, role: 'buyer', step: 3,`,
`agrId: agreementId, frostAddr: frostData.address, role: role === 'seller' ? 'seller' : 'buyer', step: 3,`);

// post-conditions
const checks = [
  [`role: 'buyer', step: 3,`, 0],
  [`[FROSTLIST-HOIST]`, 1],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
