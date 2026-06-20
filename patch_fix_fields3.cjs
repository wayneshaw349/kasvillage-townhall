const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// DeadlockStats fields
c = c.replaceAll("last_deadlock_daa:", "last_deadlock_ms:");
c = c.replaceAll("daa_since_last_deadlock:", "days_since_last_deadlock:");

// CounterpartyStats fields - remove fields that don't exist
c = c.replace(/\s*xp_tier: XPTier::from_xp\(xp\),\n/g, "\n");
c = c.replace(/\s*snail_mode: SnailModeStatus::default\(\),\n/g, "\n");
c = c.replace(/\s*last_activity_daa:.*\n/g, "\n");
c = c.replace(/\s*arweave_stats_tx:.*\n/g, "\n");

console.log('Fixed DeadlockStats + CounterpartyStats fields');
fs.writeFileSync('src/townhall_verification_complete.rs', c);
