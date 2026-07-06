const fs = require('fs');
let s = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
s = s.replace("cleanup as cleanupFrost, aggregateToAddress, completeFrost2Round} from '\nimport { validateEscrowDestination } from './frost_complete./frost_complete';", "cleanup as cleanupFrost, aggregateToAddress, completeFrost2Round} from './frost_complete';\nimport { validateEscrowDestination } from './frost_complete';");
fs.writeFileSync('NeighborAgreement.tsx', s);
console.log('fixed');
