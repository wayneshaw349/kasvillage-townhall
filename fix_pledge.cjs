const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find "pub balance_usd: f64," inside PledgeStatus and add fields after it
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'pub balance_usd: f64,' && i > 0) {
    // Check we're in PledgeStatus
    let inStruct = false;
    for (let j = i-1; j > i-15 && j >= 0; j--) {
      if (lines[j].includes('struct PledgeStatus')) { inStruct = true; break; }
    }
    if (inStruct) {
      lines.splice(i + 1, 0,
        '    pub last_check_daa: u64,',
        '    pub balance_stale: bool,'
      );
      console.log('Added fields after balance_usd');
      break;
    }
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
