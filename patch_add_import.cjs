const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

if (f.includes('canonical_agreement_steps')) {
  console.log('Already imported');
  process.exit(0);
}

const imp = [
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

// Insert after last import line
const lastImport = f.lastIndexOf("import ");
const semicolon = f.indexOf(';', lastImport);
const newline = f.indexOf('\n', semicolon);

f = f.slice(0, newline + 1) + '\n' + imp + '\n' + f.slice(newline + 1);

fs.writeFileSync('NeighborAgreement.tsx', f);

// Verify
const hits = (f.match(/buyerBuildTemplate/g) || []).length;
const emojis = (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length;
console.log('Import added');
console.log('buyerBuildTemplate:', hits, 'hits');
console.log('Emojis:', emojis);
console.log('canonical_agreement_steps:', f.includes('canonical_agreement_steps'));
