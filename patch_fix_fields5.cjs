const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// 1. Replace CitadelTier::from_xp with inline match
c = c.replaceAll(
  "CitadelTier::from_xp(xp)",
  "if xp >= 5000 { CitadelTier::Passport } else if xp >= 500 { CitadelTier::Resident } else { CitadelTier::Guest }"
);
console.log('1. Fixed CitadelTier::from_xp');

// 2. Fix last_deadlock_ms: wrap in Some()
c = c.replaceAll(
  "last_deadlock_ms: l1_stats.last_deadlock_ms,",
  "last_deadlock_ms: if l1_stats.last_deadlock_ms > 0 { Some(l1_stats.last_deadlock_ms) } else { None },"
);
console.log('2. Fixed Option wrapping');

// 3. Fix avg_completion_time_ms on AggregatedL1Stats - compute from total/completed
c = c.replaceAll(
  "l1_stats.avg_completion_time_ms",
  "if l1_stats.completed > 0 { l1_stats.total_completion_daa * 1000 / l1_stats.completed } else { 0 }"
);
console.log('3. Fixed avg_completion_time_ms');

// 4. Replace broken CounterpartyStats construction with from_raw
// Find the "Some(CounterpartyStats {" block in query_arweave_user_stats and aggregate_stats_from_frost_events
// Replace with from_raw calls

// For aggregate_stats_from_frost_events - replace the direct struct
const agrBlock = "Some(CounterpartyStats {\n        pubkey: pubkey.to_string(),\n        xp,";
const agrIdx = c.lastIndexOf(agrBlock);
if (agrIdx > -1) {
  // Find the closing }); 
  let depth = 0, i = agrIdx;
  while (i < c.length) {
    if (c[i] === '{') depth++;
    if (c[i] === '}') { depth--; if (depth === 0) { break; } }
    i++;
  }
  const endBrace = c.indexOf(')', i) + 1;
  const replacement = `Some(CounterpartyStats::from_raw(
        pubkey.to_string(),
        None,
        xp,
        l1_stats.successes,
        l1_stats.deadlocks,
        None,
        Some(current_daa * 1000),
        None,
        Some(neighbor_agreements),
        Some(deadlock_history),
    ))`;
  c = c.substring(0, agrIdx) + replacement + c.substring(endBrace);
  console.log('4. Replaced aggregate CounterpartyStats with from_raw');
}

fs.writeFileSync('src/townhall_verification_complete.rs', c);
console.log('Done');
