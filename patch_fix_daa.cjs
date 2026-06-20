const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// Replace ALL occurrences of DAA field names
c = c.replaceAll("fastest_completion_daa:", "fastest_completion_ms:");
c = c.replaceAll("agreements_last_7d_daa:", "agreements_last_7d:");
c = c.replaceAll("agreements_last_30d_daa:", "agreements_last_30d:");
c = c.replaceAll("avg_completion_daa:", "avg_completion_time_ms:");

// Also fix the right-hand side references to l1_stats fields
c = c.replaceAll("l1_stats.fastest_completion_daa", "l1_stats.fastest_completion_daa");
c = c.replaceAll("l1_stats.agreements_last_7d_daa", "l1_stats.agreements_last_7d_daa");
c = c.replaceAll("l1_stats.agreements_last_30d_daa", "l1_stats.agreements_last_30d_daa");

console.log('Fixed all DAA field names');
fs.writeFileSync('src/townhall_verification_complete.rs', c);
