const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

if (f.includes('canonical_agreement_steps')) {
  console.log('Already imported');
  process.exit(0);
}

const imp = [
  "",
  "import {",
  "  STEPS,",
  "  K_DESTROY_STEPS,",
  "  buyerBuildTemplate,",
  "  sellerSignTemplate,",
  "  buyerAggregate,",
  "  parseTemplate,",
  "  parseResponse,",
  "  encodeTemplate,",
  "  encodeResponse,",
  "  verifyTemplate,",
  "  deriveAggregateKey,",
  "  deriveAddress,",
  "  verificationCode as computeVerificationCode,",
  "  computeAgrId,",
  "  buildTxBody,",
  "  MIN_FEE_SOMPI,",
  "  SUBNETWORK_NATIVE,",
  "} from './canonical_agreement_steps';",
].join('\n');

// Find last TOP-LEVEL import (starts at beginning of line)
const lines = f.split('\n');
let lastImportLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
    // Make sure we're in the top 200 lines (not inside a function)
    if (i < 200) lastImportLine = i;
  }
}

if (lastImportLine < 0) {
  console.log('ERROR: No top-level imports found');
  process.exit(1);
}

// Find end of that import statement (might span multiple lines)
let endLine = lastImportLine;
while (endLine < lines.length && !lines[endLine].includes(';')) endLine++;

console.log('Inserting after line', endLine + 1, ':', lines[endLine].trim().substring(0, 60));

// Insert
lines.splice(endLine + 1, 0, imp);
f = lines.join('\n');

fs.writeFileSync('NeighborAgreement.tsx', f);

const hits = (f.match(/buyerBuildTemplate/g) || []).length;
const emojis = (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length;
console.log('Import added');
console.log('buyerBuildTemplate:', hits, 'hits');
console.log('Emojis:', emojis);
