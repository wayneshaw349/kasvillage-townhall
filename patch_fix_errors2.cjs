const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// 1. Fix scan_code missing argument
c = c.replace(
  "scan_code(&body.dapp_code)",
  "scan_code(&body.dapp_code, EntityType::DApp)"
);
console.log('1. Fixed scan_code args');

// 2. Fix string comparison
c = c.replace(
  "body.loaded_hash == verified_hash.as_ref().unwrap()",
  "body.loaded_hash == *verified_hash.as_ref().unwrap()"
);
console.log('2. Fixed string comparison');

// 3. Fix NeighborAgreementStats field names (DAA -> ms equivalents)
c = c.replace("avg_completion_daa:", "avg_completion_time_ms:");
c = c.replace("fastest_completion_daa:", "fastest_completion_ms:");
c = c.replace("agreements_last_30d_daa:", "agreements_last_30d:");
c = c.replace("agreements_last_7d_daa:", "agreements_last_7d:");
console.log('3. Fixed NeighborAgreementStats field names');

fs.writeFileSync('src/townhall_verification_complete.rs', c);
console.log('Done');
