const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let text = fs.readFileSync(f, 'utf8');
let fixes = 0;

function replace(old, neu, label) {
  if (text.includes(old)) {
    text = text.replace(old, neu);
    fixes++;
    console.log('[' + fixes + '] ' + label);
  }
}

// 1. Remove duplicate agreements_last_7d line (the bad one with wrong field name)
replace(
  '        agreements_last_7d: l1_stats.agreements_last_7d_daa,\n        agreements_last_7d: l1_stats.agreements_last_7d,',
  '        agreements_last_7d: l1_stats.agreements_last_7d_daa,',
  'Removed duplicate agreements_last_7d'
);
// Also try CRLF variant
replace(
  '        agreements_last_7d: l1_stats.agreements_last_7d_daa,\r\n        agreements_last_7d: l1_stats.agreements_last_7d,',
  '        agreements_last_7d: l1_stats.agreements_last_7d_daa,',
  'Removed duplicate agreements_last_7d (CRLF)'
);

// 2. Fix last_deadlock_timestamp -> last_deadlock_daa
replace(
  'l1_stats.last_deadlock_timestamp',
  'l1_stats.last_deadlock_daa',
  'last_deadlock_timestamp -> last_deadlock_daa (1st)'
);
// Get second occurrence too
replace(
  'l1_stats.last_deadlock_timestamp',
  'l1_stats.last_deadlock_daa',
  'last_deadlock_timestamp -> last_deadlock_daa (2nd)'
);

// 3. Fix fastest_completion_ms on AggregatedL1Stats refs -> fastest_completion_daa
// (in StatsWitness init and generate_stats_proof)
replace(
  'fastest_completion_ms: l1_stats.fastest_completion_ms',
  'fastest_completion_daa: l1_stats.fastest_completion_daa',
  'fastest_completion_ms -> fastest_completion_daa (witness)'
);

// 4. Fix agreements_last_30d/7d on AggregatedL1Stats refs
replace(
  'l1_stats.agreements_last_30d,',
  'l1_stats.agreements_last_30d_daa,',
  'agreements_last_30d -> agreements_last_30d_daa'
);
replace(
  'l1_stats.agreements_last_7d,',
  'l1_stats.agreements_last_7d_daa,',
  'agreements_last_7d -> agreements_last_7d_daa'
);

// 5. Fix last_deadlock_ms on AggregatedL1Stats -> last_deadlock_daa
replace(
  'witness.last_deadlock_ms',
  'witness.last_deadlock_daa',
  'witness.last_deadlock_ms -> last_deadlock_daa'
);

fs.writeFileSync(f, text);
console.log('Applied ' + fixes + ' fixes');
