// counterpriority.cjs
// Makes the buyer's counter the HIGHEST priority in the seller's FROST derive.
// If the counter is known (from the proposal), derive directly at that counter
// and skip both the Arweave-reuse scan and the L1 balance scan (which mis-skip
// funded addresses and cause address divergence).
const fs = require('fs');

let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

const old =
`          // Use buyer's counter if provided in proposal (avoids counter divergence)
          const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;
          if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan â€” already have FROST from Arweave');
          } else if (buyerCounter !== undefined && buyerCounter !== null) {`;

const nw =
`          // Use buyer's counter if provided in proposal (avoids counter divergence) — HIGHEST PRIORITY
          const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter ?? (agreement as any)?.['KV-FrostCounter'];
          console.log('[Seller-Counter-DEBUG] buyerCounter=', buyerCounter, 'frostDataAlreadySet=', !!frostData);
          if (buyerCounter !== undefined && buyerCounter !== null) {
            const directFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter });
            frostData = directFrost;
            console.log('[Seller-Counter] Using buyer counter (priority):', buyerCounter, directFrost.address.slice(0,30));
          } else if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan');
          } else if (false) {`;

if (n.indexOf(old) < 0) {
  // Fallback: try a CRLF-normalized match
  const oldCRLF = old.replace(/\n/g, '\r\n');
  if (n.indexOf(oldCRLF) >= 0) {
    n = n.replace(oldCRLF, nw.replace(/\n/g, '\r\n'));
    fs.writeFileSync('NeighborAgreement.tsx', n);
    console.log('OK (CRLF match)');
  } else {
    console.log('ANCHOR FAIL — the exact block was not found. Paste lines 2576-2582 so the anchor can be adjusted.');
    process.exit(1);
  }
} else {
  n = n.replace(old, nw);
  fs.writeFileSync('NeighborAgreement.tsx', n);
  console.log('OK');
}
