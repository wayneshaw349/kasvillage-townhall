const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find the orphaned ") -> HttpResponse {" after the new handler
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === ') -> HttpResponse {') {
    // Find the end of this orphaned block
    let depth = 0, end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0 && j > i) { end = j; break; }
    }
    console.log('Removing orphaned lines ' + (i+1) + ' to ' + (end+1));
    lines.splice(i, end - i + 1);
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
