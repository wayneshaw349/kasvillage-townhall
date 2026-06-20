const fs = require('fs');

// === 1. Fix Cargo.toml: add rand_core ===
const cargo = 'Cargo.toml';
let cargoText = fs.readFileSync(cargo, 'utf8');
if (!cargoText.includes('rand_core')) {
  cargoText = cargoText.replace('rand = "0.8"', 'rand = "0.8"\nrand_core = "0.6"');
  fs.writeFileSync(cargo, cargoText);
  console.log('[1] Added rand_core to Cargo.toml');
} else {
  console.log('[1] rand_core already in Cargo.toml');
}

// === 2. Fix townhall_verification_complete.rs ===
const rsFile = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let lines = fs.readFileSync(rsFile, 'utf8').split(/\r?\n/);

// 2a. Fix orphaned agreements_last_7d: move it before the };
//     Find: };  followed by  agreements_last_7d: ...
let fixed2a = false;
for (let i = 0; i < lines.length - 1; i++) {
  if (lines[i].trim() === '};' && lines[i+1].trim().startsWith('agreements_last_7d:')) {
    // Swap: move agreements_last_7d before };
    const field = lines[i+1];
    lines.splice(i+1, 1);  // remove the orphan
    lines.splice(i, 0, field); // insert before };
    console.log('[2a] Moved agreements_last_7d back into struct at line ' + (i+1));
    fixed2a = true;
    break;
  }
}
if (!fixed2a) console.log('[2a] agreements_last_7d not orphaned (skipped)');

// 2b. Add ArweaveStatsRecord struct if missing
if (!lines.some(l => l.includes('struct ArweaveStatsRecord'))) {
  // Insert before query_arweave_stats function
  const idx = lines.findIndex(l => l.includes('pub async fn query_arweave_stats'));
  if (idx > 0) {
    const insert = [
      '',
      '/// Arweave stats record',
      '#[derive(Debug, Clone, Serialize, Deserialize)]',
      'pub struct ArweaveStatsRecord {',
      '    pub arweave_tx: String,',
      '    pub pubkey: String,',
      '    pub xp: u64,',
      '    pub successes: u64,',
      '    pub deadlocks: u64,',
      '    pub timestamp: u64,',
      '}',
      '',
    ];
    lines.splice(idx, 0, ...insert);
    console.log('[2b] Added ArweaveStatsRecord struct before line ' + (idx+1));
  } else {
    console.log('[2b] Could not find query_arweave_stats to insert before');
  }
} else {
  console.log('[2b] ArweaveStatsRecord already exists');
}

fs.writeFileSync(rsFile, lines.join('\r\n'));
console.log('Done. Total lines:', lines.length);
