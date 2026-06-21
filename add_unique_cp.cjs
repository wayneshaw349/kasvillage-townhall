const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add to AggregatedL1Stats after repeat_deadlock_counterparties
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub repeat_deadlock_counterparties: HashSet<String>,')) {
    if (!lines[i+1]?.includes('unique_counterparties_all')) {
      lines.splice(i + 1, 0, '    pub unique_counterparties_all: HashSet<String>,');
      console.log('1. Added to AggregatedL1Stats');
    }
    break;
  }
}

// 2. Insert counterparty in aggregation loop after event_hashes.push
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stats.event_hashes.push(event.tx_id.clone());')) {
    if (!lines[i+1]?.includes('unique_counterparties_all')) {
      lines.splice(i + 1, 0, '        stats.unique_counterparties_all.insert(counterparty.clone());');
      console.log('2. Added insert in aggregation loop');
    }
    break;
  }
}

// 3. Add to CounterpartyStats struct after arweave_tx field
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub last_updated_ms: u64,') && i > 0) {
    // Check we're in CounterpartyStats
    let inStruct = false;
    for (let j = i-1; j > i-30 && j >= 0; j--) {
      if (lines[j].includes('pub struct CounterpartyStats')) { inStruct = true; break; }
    }
    if (inStruct && !lines[i+1]?.includes('unique_counterparties')) {
      lines.splice(i + 1, 0, '    pub unique_counterparties: u64,');
      console.log('3. Added to CounterpartyStats struct');
    }
    break;
  }
}

// 4. Set in from_raw() — find "last_updated_ms: current_timestamp() * 1000," in from_raw
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('last_updated_ms: current_timestamp() * 1000,') && i > 0) {
    // Check we're in from_raw
    let inFn = false;
    for (let j = i-1; j > i-50 && j >= 0; j--) {
      if (lines[j].includes('pub fn from_raw(')) { inFn = true; break; }
    }
    if (inFn && !lines[i+1]?.includes('unique_counterparties')) {
      lines.splice(i + 1, 0, '            unique_counterparties: 0, // Set by caller');
      console.log('4. Set in from_raw()');
    }
    break;
  }
}

// 5. Set in unknown() — find "last_updated_ms: current_timestamp() * 1000," in unknown
let foundFromRaw = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('last_updated_ms: current_timestamp() * 1000,')) {
    if (foundFromRaw) {
      // This is the unknown() one
      if (!lines[i+1]?.includes('unique_counterparties')) {
        lines.splice(i + 1, 0, '            unique_counterparties: 0,');
        console.log('5. Set in unknown()');
      }
      break;
    }
    foundFromRaw = true;
  }
}

// 6. Set the actual value in aggregate_and_prove_stats after from_raw() call
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Ok((stats, proof))') && i > 0) {
    // Check we're in aggregate_and_prove_stats
    let inFn = false;
    for (let j = i-1; j > i-80 && j >= 0; j--) {
      if (lines[j].includes('pub async fn aggregate_and_prove_stats')) { inFn = true; break; }
    }
    if (inFn) {
      // Insert before Ok — set unique_counterparties on stats
      lines.splice(i, 0,
        '    // Set unique counterparties from L1 aggregation',
        '    let stats = CounterpartyStats { unique_counterparties: l1_stats.unique_counterparties_all.len() as u64, ..stats };',
        ''
      );
      console.log('6. Set actual value in aggregate_and_prove_stats');
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
