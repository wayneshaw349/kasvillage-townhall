const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');
c = c.replace("use rand_core::OsRng;", "use rand::rngs::OsRng;");
console.log('1. rand_core fixed:', !c.includes('rand_core'));

// Add ArweaveStatsRecord before first async fn that uses it
if (!c.includes('pub struct ArweaveStatsRecord')) {
  c = c.replace(
    "pub async fn query_arweave_stats",
    "#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]\npub struct ArweaveStatsRecord {\n    pub arweave_tx: String,\n    pub pubkey: String,\n    pub stats_hash: String,\n}\n\npub async fn query_arweave_stats"
  );
  console.log('2. ArweaveStatsRecord added');
}

// Add crate imports if missing
if (!c.includes('use crate::')) {
  c = c.replace("use actix_web::", "use crate::{XPTier, SnailModeStatus};\nuse actix_web::");
  console.log('3. Crate imports added');
}

fs.writeFileSync('src/townhall_verification_complete.rs', c);
