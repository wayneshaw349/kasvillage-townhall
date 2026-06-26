const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find "Ok(events)" inside query_arweave_frost_events and add dedup before it
let fnStart = -1;
let okLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async fn query_arweave_frost_events')) fnStart = i;
  if (fnStart > 0 && lines[i].trim() === 'Ok(events)' && i > fnStart) {
    okLine = i;
    break;
  }
}

if (okLine > 0) {
  const dedup = [
    '    // Dedup: keep only latest status per agreement ID',
    '    // Arweave has Agreed→Accepted→Signed→Released as separate records',
    '    let mut seen: std::collections::HashMap<String, usize> = std::collections::HashMap::new();',
    '    let mut deduped: Vec<FrostEvent> = Vec::new();',
    '    // Status priority: Released > Deadlocked > Refunded > Expired > Signed > Accepted > Agreed',
    '    let status_priority = |e: &FrostEvent| -> u8 {',
    '        match e.event_type {',
    '            FrostEventType::AgreementCompleted => 6,',
    '            FrostEventType::AgreementDeadlocked => 5,',
    '            FrostEventType::AgreementRefunded => 4,',
    '            FrostEventType::AgreementExpired => 3,',
    '            FrostEventType::AgreementCreated => 1,',
    '        }',
    '    };',
    '    for (idx, event) in events.iter().enumerate() {',
    '        if event.agreement_id.is_empty() { deduped.push(event.clone()); continue; }',
    '        if let Some(&prev_idx) = seen.get(&event.agreement_id) {',
    '            if status_priority(event) > status_priority(&deduped[prev_idx]) {',
    '                deduped[prev_idx] = event.clone();',
    '            }',
    '        } else {',
    '            seen.insert(event.agreement_id.clone(), deduped.len());',
    '            deduped.push(event.clone());',
    '        }',
    '    }',
    '    let events = deduped;',
  ];
  lines.splice(okLine, 0, ...dedup);
  console.log('Added dedup before Ok(events) at line ' + okLine);
} else {
  console.log('ERROR: Could not find Ok(events) in query_arweave_frost_events');
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
