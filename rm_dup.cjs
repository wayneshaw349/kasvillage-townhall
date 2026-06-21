const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find FIRST api_counterparty_by_apt and remove it (keep second)
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub async fn api_counterparty_by_apt(') && !found) {
    found = true;
    // Also remove doc comment above if present
    let start = i;
    if (i > 0 && lines[i-1].trim().startsWith('///')) start = i - 1;
    // Find end of function
    let depth = 0, end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0 && j > i) { end = j; break; }
    }
    console.log('Removing old api_counterparty_by_apt: lines ' + (start+1) + '-' + (end+1));
    lines.splice(start, end - start + 1);
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
