const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const old = "let pastedText = '';";
const idx = s.indexOf(old, s.indexOf('processSellerResponse'));
if (idx < 0) { console.log('Not found'); process.exit(1); }

// Find the try/catch clipboard block after it
const clipStart = s.indexOf('try { const CB = await import', idx);
const clipEnd = s.indexOf("'[FROST-Template] Clipboard read failed'", clipStart);
const blockEnd = s.indexOf('}', clipEnd) + 1; // end of catch

// Replace: use sellerResponseB64 state first, clipboard as fallback
const oldBlock = s.slice(idx, blockEnd);
const newBlock = `let pastedText = sellerResponseB64 || '';
      if (!pastedText) { try { const CB = await import('expo-clipboard'); pastedText = await CB.getStringAsync() || ''; } catch {} }`;

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(f, s);
console.log('Fixed:', s.includes('sellerResponseB64 ||'));
