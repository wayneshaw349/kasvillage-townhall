const fs = require('fs');
let lines = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8').split('\n');
// Find the duplicate: line with "agreements_last_7d: l1_stats.agreements_last_7d," followed by "    };"
// right after a "    };" - this is the orphan
for (let i = 0; i < lines.length - 1; i++) {
  if (lines[i].includes('agreements_last_7d: l1_stats.agreements_last_7d_daa,') &&
      lines[i+1].trim() === '};' &&
      lines[i+2] && lines[i+2].includes('agreements_last_7d: l1_stats.agreements_last_7d,') &&
      lines[i+3] && lines[i+3].trim() === '};') {
    // Remove the two orphan lines (i+2 and i+3)
    lines.splice(i+2, 2);
    console.log('Removed duplicate lines at', i+2);
    break;
  }
}
fs.writeFileSync('src/townhall_verification_complete.rs', lines.join('\n'));
