const fs = require('fs');
let lines = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8').split('\n');

// Line 1961 (index 1960): remove Some/None wrapping, just use raw u64
lines[1960] = '        last_deadlock_ms: l1_stats.last_deadlock_ms,';
console.log('1. Fixed line 1961');

// Line 3682-3690: Replace CounterpartyStats with from_raw
for (let i = 3681; i <= 3690; i++) {
  lines[i] = '';
}
lines[3681] = `    Some(CounterpartyStats::from_raw(
        pubkey.to_string(),
        None,
        xp,
        neighbor_agreements.completed,
        deadlock_history.total_deadlocks,
        None,
        None,
        None,
        Some(neighbor_agreements),
        Some(deadlock_history),
    ))`;
console.log('2. Fixed CounterpartyStats at 3682');

// Line 3742 (index 3741): last_deadlock_ms Option fix
lines[3741] = '        last_deadlock_ms: if l1_stats.last_deadlock_ms > 0 { Some(l1_stats.last_deadlock_ms) } else { None },';

// Line 3743 (index 3742): days_since fix
lines[3742] = '        days_since_last_deadlock: if l1_stats.last_deadlock_ms > 0 { Some(current_daa.saturating_sub(l1_stats.last_deadlock_ms) / 86400) } else { None },';

// Line 3744 (index 3743): unique_counterparties
lines[3743] = '        unique_counterparties_deadlocked: l1_stats.unique_counterparties_deadlocked.len() as u64,';

// Line 3745 (index 3744): repeat_deadlock
lines[3744] = '        repeat_deadlock_same_counterparty: l1_stats.repeat_deadlock_counterparties.len() as u64,';

console.log('3. Fixed lines 3742-3745');

fs.writeFileSync('src/townhall_verification_complete.rs', lines.join('\n'));
console.log('Done');
