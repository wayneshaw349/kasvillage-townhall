const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find the invisible DAppVisibility return (visible: false + recency_factor: 0.0)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('visible: false') && lines[i+1]?.includes('pledge: pledge_status')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('recency_factor: 0.0,')) {
        // Check if unique_counterparties already there
        if (!lines[j+1]?.includes('unique_counterparties')) {
          lines.splice(j + 1, 0,
            '            unique_counterparties: 0,',
            '            self_trade_flag: false,'
          );
          console.log('Added missing fields at L' + (j+2));
        }
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
