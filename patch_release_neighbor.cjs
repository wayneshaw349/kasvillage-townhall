const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Pass releaseMode + sellerAmountSompi to buyerBuildTemplate
const oldCall = `      buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),
        agrId: contract.agreementId,`;
const newCall = `      buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),
        sellerAmountSompi: BigInt(Math.floor(contract.sellerCommitmentKas * 1e8)),
        releaseMode: releaseMode,
        agrId: contract.agreementId,`;
if (c.includes(oldCall)) {
  c = c.replace(oldCall, newCall);
  console.log('1. Passed releaseMode to buyerBuildTemplate');
} else { console.log('1. SKIP'); }

// 2. Fix Alert for 1 vs 2 outputs
const oldAlert = "Alert.alert('TX Template Copied', 'Send clipboard to seller.\\nBuyer: ' + (Number(BigInt(result.template.o[0].v)) / 1e8).toFixed(4) + ' KAS\\nSeller: ' + (Number(BigInt(result.template.o[1].v)) / 1e8).toFixed(4) + ' KAS');";
const newAlert = "Alert.alert('TX Template Copied', 'Send clipboard to seller.\\n' + (result.template.o.length === 1 ? 'Seller receives: ' + (Number(BigInt(result.template.o[0].v)) / 1e8).toFixed(4) + ' KAS' : 'Buyer: ' + (Number(BigInt(result.template.o[0].v)) / 1e8).toFixed(4) + ' KAS\\nSeller: ' + (Number(BigInt(result.template.o[1].v)) / 1e8).toFixed(4) + ' KAS'));";
if (c.includes(oldAlert)) {
  c = c.replace(oldAlert, newAlert);
  console.log('2. Fixed Alert');
} else { console.log('2. SKIP'); }

// 3. Remove split from releaseMode state init
c = c.replace(
  "const [releaseMode, setReleaseMode] = useState<ReleaseMode>('release');",
  "const [releaseMode, setReleaseMode] = useState<'release' | 'cancel'>('release');"
);
console.log('3. Removed split from state type');

// 4. Remove split UI references
const splitBanner = " releaseMode === 'split' ? '#fef2f2' :";
if (c.includes(splitBanner)) {
  c = c.replace(splitBanner, '');
  console.log('4a. Removed split color');
}
const splitBorder = " releaseMode === 'split' ? '#fca5a5' :";
if (c.includes(splitBorder)) {
  c = c.replace(splitBorder, '');
  console.log('4b. Removed split border');
}
const splitText = " releaseMode === 'split' ? '#991b1b' :";
if (c.includes(splitText)) {
  c = c.replace(splitText, '');
  console.log('4c. Removed split text color');
}
const splitLabel = " releaseMode === 'split' ? '\\u2696 Settlement \\u2014 custom split' :";
if (c.includes(splitLabel)) {
  c = c.replace(splitLabel, '');
  console.log('4d. Removed split label');
}

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
