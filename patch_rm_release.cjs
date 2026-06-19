const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
const idx = c.indexOf('Paste Release Key</Text>');
if (idx > -1) {
  let start = c.lastIndexOf('<View', idx);
  let depth = 0, i = start;
  while (i < c.length) {
    if (c.substring(i, i + 5) === '<View') depth++;
    if (c.substring(i, i + 7) === '</View>') { depth--; if (depth === 0) { let end = i + 7; while (end < c.length && '\n\r '.includes(c[end])) end++; c = c.substring(0, start) + c.substring(end); console.log('Removed'); break; } }
    i++;
  }
} else { console.log('SKIP'); }
fs.writeFileSync('NeighborAgreement.tsx', c);
