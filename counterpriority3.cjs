// counterpriority3.cjs — regex-based, ASCII-only anchors, handles the mangled em-dash line
const fs = require('fs');
let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

if (n.includes('[Seller-Counter] Using buyer counter (priority)')) {
  console.log('already applied'); process.exit(0);
}

// The three-branch block, matched with a regex that treats the mangled em-dash line
// as ".*" so encoding doesn't matter. Captures the scan body to preserve it.
const re = new RegExp(
  "if \\(frostData\\) \\{\\s*\\r?\\n" +
  "\\s*console\\.log\\('\\[Seller-Reuse\\] Skipping L1 scan.*?\\);\\s*\\r?\\n" +
  "\\s*\\} else if \\(buyerCounter !== undefined && buyerCounter !== null\\) \\{\\s*\\r?\\n" +
  "\\s*const directFrost = deriveFrostAddressLocal\\(\\{ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter \\}\\);\\s*\\r?\\n" +
  "\\s*frostData = directFrost;\\s*\\r?\\n" +
  "\\s*console\\.log\\('\\[Seller-Counter\\] Using buyer counter:', buyerCounter, directFrost\\.address\\.slice\\(0,30\\)\\);\\s*\\r?\\n" +
  "\\s*\\} else \\{",
  "s"
);

const replacement =
`if (buyerCounter !== undefined && buyerCounter !== null) {
            const directFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter });
            frostData = directFrost;
            console.log('[Seller-Counter] Using buyer counter (priority):', buyerCounter, directFrost.address.slice(0,30));
          } else if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan (already have FROST)');
          } else {`;

if (!re.test(n)) { console.log('REGEX ANCHOR FAIL'); process.exit(1); }
n = n.replace(re, replacement);
fs.writeFileSync('NeighborAgreement.tsx', n);
console.log('OK — counter now checked first');
