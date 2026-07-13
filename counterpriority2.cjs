// counterpriority2.cjs — anchors on clean lines (avoids mangled em-dash)
const fs = require('fs');
let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Anchor 1: the buyerCounter declaration line (unique, clean ASCII)
const decl = "const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;";
if (n.indexOf(decl) < 0) { console.log('DECL ANCHOR FAIL'); process.exit(1); }

// Replace declaration to also read the raw tag key + add debug
n = n.replace(decl,
  "const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter ?? (agreement as any)?.['KV-FrostCounter'];\n          console.log('[Seller-Counter-DEBUG] buyerCounter=', buyerCounter, 'frostDataAlreadySet=', !!frostData);");

// Anchor 2: the branch order. Swap so counter is checked FIRST.
// Original order after declaration:
//   if (frostData) { ...reuse log... }
//   else if (buyerCounter !== undefined && buyerCounter !== null) { ...directFrost... }
//   else { ...scan... }
// New order: counter first, then frostData, then scan.
const branchOld =
`          if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan` ;
// We can't rely on the mangled em-dash after this point, so replace only the condition head:
const idx = n.indexOf("          if (frostData) {\n            console.log('[Seller-Reuse]");
if (idx < 0) { console.log('BRANCH ANCHOR FAIL'); process.exit(1); }

// Find the "} else if (buyerCounter" that follows and hoist it.
// Simplest safe transform: change "if (frostData) {" -> "if (buyerCounter !== undefined && buyerCounter !== null) {
//   const directFrost = ...; frostData = directFrost; ... } else if (frostData) {"
const hoist =
`          if (buyerCounter !== undefined && buyerCounter !== null) {
            const directFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter });
            frostData = directFrost;
            console.log('[Seller-Counter] Using buyer counter (priority):', buyerCounter, directFrost.address.slice(0,30));
          } else if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan`;

n = n.replace("          if (frostData) {\n            console.log('[Seller-Reuse] Skipping L1 scan", hoist);

// Now neutralize the OLD "else if (buyerCounter...)" block so it doesn't double-derive.
// It becomes unreachable-but-valid: change its condition to "else if (false && ...)"
n = n.replace(
  "          } else if (buyerCounter !== undefined && buyerCounter !== null) {\n            const directFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter });\n            frostData = directFrost;\n            console.log('[Seller-Counter] Using buyer counter:', buyerCounter, directFrost.address.slice(0,30));\n          } else {",
  "          } else if (false) {\n          } else {"
);

fs.writeFileSync('NeighborAgreement.tsx', n);
console.log('OK — counter is now top priority');
