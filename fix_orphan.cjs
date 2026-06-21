const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find the orphan: ") -> HttpResponse {" that is NOT part of a function signature
// It appears right after api_counterparty_by_apt's closing }
let orphanStart = -1;
let orphanEnd = -1;

for (let i = 0; i < lines.length; i++) {
  // The orphan line is exactly ") -> HttpResponse {" with no "fn" or "pub" before it
  if (lines[i].trim() === ') -> HttpResponse {' && i > 0 && !lines[i-1].includes('fn ')) {
    orphanStart = i;
    // Find the end: scan for closing } at depth 0
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0 && j > i) {
        orphanEnd = j;
        break;
      }
    }
    break;
  }
}

if (orphanStart >= 0 && orphanEnd >= 0) {
  console.log('Orphan found: lines ' + (orphanStart+1) + ' to ' + (orphanEnd+1));
  console.log('  First: ' + lines[orphanStart].trim().substring(0, 60));
  console.log('  Last:  ' + lines[orphanEnd].trim().substring(0, 60));
  lines.splice(orphanStart, orphanEnd - orphanStart + 1);
  console.log('Removed ' + (orphanEnd - orphanStart + 1) + ' lines');
} else {
  console.log('No orphan found');
}

fs.writeFileSync(f, lines.join('\r\n'));
