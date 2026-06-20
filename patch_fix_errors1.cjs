const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// 1. Fix rand_core - use rand::rngs::OsRng instead
c = c.replace("use rand_core::OsRng;", "use rand::rngs::OsRng;");
console.log('1. Fixed rand_core -> rand::rngs');

// 2. Add missing imports from crate root
const firstUse = c.indexOf('use actix_web');
c = c.substring(0, firstUse) + 'use crate::{XPTier, SnailModeStatus};\n' + c.substring(firstUse);
console.log('2. Added crate imports');

// 3. Add ArweaveStatsRecord stub
const helpersSection = c.indexOf('// ============================================================================\n// HELPERS');
if (helpersSection > -1) {
  c = c.substring(0, helpersSection) + '#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ArweaveStatsRecord {\n    pub arweave_tx: String,\n    pub pubkey: String,\n    pub stats_hash: String,\n}\n\n' + c.substring(helpersSection);
  console.log('3. Added ArweaveStatsRecord stub');
} else {
  // Add before first fn
  const beforeHelpers = c.lastIndexOf('// HELPERS');
  c = c.replace('// HELPERS', '#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ArweaveStatsRecord {\n    pub arweave_tx: String,\n    pub pubkey: String,\n    pub stats_hash: String,\n}\n\n// HELPERS');
  console.log('3. Added ArweaveStatsRecord (alt)');
}

fs.writeFileSync('src/townhall_verification_complete.rs', c);
console.log('Done - run cargo check again');
