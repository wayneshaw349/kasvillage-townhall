const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the AGR hash input
const old = `(contract.buyerPubkey || '') + 
            (contract.sellerPubkey || '') + 
            Math.floor(contract.itemPriceKas * 1e8).toString() +
            Math.floor(contract.sellerCommitmentKas * 1e8).toString() +
            network +
            utxoTag`;

if (!f.includes(old)) {
  console.log('AGR hash pattern not found');
  // Try without extra whitespace
  const alt = f.match(/contract\.buyerPubkey[^)]*\+[\s\S]*?utxoTag/);
  if (alt) console.log('Found alt pattern:', alt[0].substring(0, 60));
  process.exit(1);
}

// Add itemDescription + DAA score for uniqueness
// DAA needs to be fetched before AGR hash — add a quick fetch
const newHash = `(contract.buyerPubkey || '') + 
            (contract.sellerPubkey || '') + 
            Math.floor(contract.itemPriceKas * 1e8).toString() +
            Math.floor(contract.sellerCommitmentKas * 1e8).toString() +
            network +
            utxoTag +
            (contract.itemDescription || '') +
            String(await (async () => { try { const _daaR = await fetch((network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org') + '/info/virtual-chain-blue-score'); const _daaD = await _daaR.json(); return _daaD.blueScore || 0; } catch { return Date.now(); } })())`;

f = f.replace(old, newHash);

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('AGR ID now includes itemDescription + DAA score');
console.log('Same buyer+seller+amount+item = unique AGR per L1 block');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
