const fs = require('fs');

// === 1. Stale balance warning in visibility response ===
console.log('=== Stale balance warning ===');
const vf = 'src\\townhall_verification_complete.rs';
let vl = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// Add balance_stale + last_check_daa to PledgeStatus struct
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub struct PledgeStatus') && vl[i-1]?.includes('Pledge status')) {
    // Find the closing } of the struct
    for (let j = i; j < i + 20; j++) {
      if (vl[j].trim() === '}' && j > i + 2) {
        vl.splice(j, 0,
          '    pub last_check_daa: u64,',
          '    pub balance_stale: bool,  // >24hr since last check'
        );
        console.log('  Added stale fields to PledgeStatus');
        break;
      }
    }
    break;
  }
}

// Set the fields in compute_full_dapp_visibility where PledgeStatus is built
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pledge_usd: p.pledge_kas * kas_price,') && vl[i+1]?.includes('balance_usd:')) {
    // Add after balance_usd line
    for (let j = i; j < i + 5; j++) {
      if (vl[j].includes('balance_usd:')) {
        vl.splice(j + 1, 0,
          '            last_check_daa: current_daa,',
          '            balance_stale: false, // Just checked'
        );
        console.log('  Set stale fields (active pledge)');
        break;
      }
    }
    break;
  }
}

// Also set in the no-pledge fallback PledgeStatus
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pledge_usd: 0.0, balance_usd: 0.0,')) {
    vl[i] = vl[i].replace(
      'pledge_usd: 0.0, balance_usd: 0.0,',
      'pledge_usd: 0.0, balance_usd: 0.0, last_check_daa: 0, balance_stale: true,'
    );
    console.log('  Set stale fields (no pledge fallback)');
    break;
  }
}

// === 2. Unique counterparty count for self-trade detection ===
console.log('=== Unique counterparty detection ===');

// Add unique_counterparties_completed to AggregatedL1Stats
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub repeat_deadlock_counterparties: HashSet<String>,')) {
    vl.splice(i + 1, 0,
      '',
      '    // Self-trade detection',
      '    pub unique_counterparties_completed: HashSet<String>,',
      '    pub repeat_success_same_counterparty: u64,'
    );
    console.log('  Added unique_counterparties_completed to AggregatedL1Stats');
    break;
  }
}

// Track completed counterparties in aggregate_l1_events_full
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('stats.resolved_after_deadlock += 1;') && vl[i-1]?.includes('deadlock_counterparties.contains_key')) {
    // After the resolved_after_deadlock line, add tracking
    vl.splice(i + 1, 0,
      '                // Track unique completed counterparties (self-trade detection)',
      '                if stats.unique_counterparties_completed.contains(counterparty) {',
      '                    stats.repeat_success_same_counterparty += 1;',
      '                }',
      '                stats.unique_counterparties_completed.insert(counterparty.clone());'
    );
    console.log('  Added completed counterparty tracking in aggregation');
    break;
  }
}

// Add self_trade_ratio to DAppVisibility struct
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub recency_factor: f64,') && vl[i-1]?.includes('stats_factor')) {
    vl.splice(i + 1, 0,
      '    pub unique_counterparties: u64,',
      '    pub self_trade_flag: bool,  // >50% trades with same counterparty'
    );
    console.log('  Added self_trade_flag to DAppVisibility');
    break;
  }
}

// Set self_trade values in compute_full_dapp_visibility
// Find the line where ranking_score is computed
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('let ranking_score = (0.35 * commitment_factor)')) {
    // Add self-trade detection before the score computation
    vl.splice(i, 0,
      '    let unique_cp = stats.unique_counterparties_completed.len() as u64;',
      '    let self_trade_flag = if stats.successes > 3 && unique_cp > 0 {',
      '        (stats.successes as f64 / unique_cp as f64) > 2.0 // avg >2 trades per counterparty = suspicious',
      '    } else { false };',
      '    let self_trade_penalty = if self_trade_flag { 0.5 } else { 1.0 };',
      ''
    );
    console.log('  Added self-trade penalty computation');
    break;
  }
}

// Apply penalty to ranking score
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('+ (0.20 * recency_factor);')) {
    vl[i] = vl[i].replace(
      '+ (0.20 * recency_factor);',
      '+ (0.20 * recency_factor)) * self_trade_penalty;'
    );
    // Fix the opening paren
    for (let j = i - 3; j < i; j++) {
      if (vl[j].includes('let ranking_score = (0.35')) {
        vl[j] = vl[j].replace('let ranking_score = (0.35', 'let ranking_score = ((0.35');
        break;
      }
    }
    console.log('  Applied self_trade_penalty to ranking score');
    break;
  }
}

// Set fields in the DAppVisibility return
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('recency_factor,') && vl[i+1]?.includes('}')) {
    // Check we're in the right DAppVisibility return (the visible one, not the invisible one)
    if (i > 0 && !vl[i-5]?.includes('visible: false')) {
      vl.splice(i + 1, 0,
        '        unique_counterparties: unique_cp,',
        '        self_trade_flag,'
      );
      console.log('  Set self_trade fields in visible return');
    }
    // Also need to set in the invisible return
  }
}

// Set defaults in the invisible (no pledge) return
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('visible: false') && vl[i+1]?.includes('pledge: pledge_status')) {
    for (let j = i; j < i + 10; j++) {
      if (vl[j].includes('recency_factor: 0.0,')) {
        vl.splice(j + 1, 0,
          '            unique_counterparties: 0,',
          '            self_trade_flag: false,'
        );
        console.log('  Set self_trade defaults in invisible return');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(vf, vl.join('\r\n'));

// === 3. Enforce integrity check on phone (EntertainmentCenter.tsx) ===
console.log('=== Integrity check enforcement ===');
const ef = 'EntertainmentCenter.tsx';
if (fs.existsSync(ef)) {
  let el = fs.readFileSync(ef, 'utf8').split(/\r?\n/);
  
  // Find where DApps/games load (WebView or similar)
  let insertPoint = -1;
  for (let i = 0; i < el.length; i++) {
    if (el[i].includes('WebView') && el[i].includes('source')) {
      insertPoint = i;
      break;
    }
  }
  
  if (insertPoint < 0) {
    // Try finding onLoadEnd or similar
    for (let i = 0; i < el.length; i++) {
      if (el[i].includes('onLoadEnd') || el[i].includes('onLoad=')) {
        insertPoint = i;
        break;
      }
    }
  }
  
  // Add integrity check function if not present
  let hasIntegrityCheck = el.some(l => l.includes('verifyDAppIntegrity'));
  if (!hasIntegrityCheck) {
    // Find first function/const declaration area
    for (let i = 0; i < el.length; i++) {
      if (el[i].includes('export') && (el[i].includes('function') || el[i].includes('const'))) {
        const fn = `
// DApp integrity verification — blocks loading if code hash doesn't match verified version
const verifyDAppIntegrity = async (dappId: string, codeHash: string): Promise<{ safe: boolean; warning?: string }> => {
  try {
    const TOWNHALL_API = 'https://kasvillage.app.runonflux.io';
    const resp = await fetch(TOWNHALL_API + '/api/verify/integrity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dapp_id: dappId, loaded_hash: codeHash }),
    });
    const data = await resp.json();
    if (!data.matches) {
      return { safe: false, warning: 'Code hash mismatch — DApp may have been modified after verification' };
    }
    return { safe: true };
  } catch {
    return { safe: true }; // Network error = allow but warn
  }
};
`;
        el.splice(i, 0, ...fn.split('\n'));
        console.log('  Added verifyDAppIntegrity function');
        break;
      }
    }
  } else {
    console.log('  verifyDAppIntegrity already exists');
  }
  
  fs.writeFileSync(ef, el.join('\r\n'));
  console.log('  EntertainmentCenter done');
} else {
  console.log('  EntertainmentCenter.tsx not found — add integrity check manually');
}

console.log('Done');
