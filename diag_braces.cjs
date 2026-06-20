const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs','utf8').split(/\r?\n/);
let depth = 0;
for (let i = 1525; i < Math.min(1680, lines.length); i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (depth <= 0) console.log('DEPTH ' + depth + ' at line ' + (i+1) + ': ' + lines[i].trim().substring(0,80));
}
console.log('Total lines:', lines.length);
