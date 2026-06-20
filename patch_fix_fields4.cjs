const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');

// Fix l1_stats field refs
c = c.replaceAll("l1_stats.last_deadlock_daa", "l1_stats.last_deadlock_ms");
c = c.replaceAll("l1_stats.unique_counterparties_deadlocked", "l1_stats.unique_counterparties_deadlocked.len() as u64");

// Fix broken struct - the regex removed too much, leaving dangling .and_then
// Find and fix the broken CounterpartyStats construction around line 3682
const broken = ".and_then(|v| v.as_u64()),";
const brokenIdx = c.indexOf(broken, c.indexOf("Some(CounterpartyStats {"));
if (brokenIdx > -1) {
  // This was part of last_activity_daa or arweave_stats_tx - need to see context
  // Replace the orphaned line
  const lineStart = c.lastIndexOf("\n", brokenIdx);
  const lineEnd = c.indexOf("\n", brokenIdx);
  c = c.substring(0, lineStart) + c.substring(lineEnd);
  console.log('Fixed dangling .and_then');
}

console.log('Fixed remaining field refs');
fs.writeFileSync('src/townhall_verification_complete.rs', c);
