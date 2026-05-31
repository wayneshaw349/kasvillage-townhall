const fs = require('fs');
const lines = fs.readFileSync('NeighborAgreement.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.trim().startsWith("catch (e: any) { console.error('[FROST-Template]"));
if (idx >= 0) {
  console.log('Removing orphaned catch at line', idx + 1, ':', lines[idx].trim().slice(0, 60));
  lines.splice(idx, 1);
  // Also remove trailing }; if it's now orphaned
  if (lines[idx] && lines[idx].trim() === '};') { lines.splice(idx, 1); console.log('Also removed orphaned };'); }
  fs.writeFileSync('NeighborAgreement.tsx', lines.join('\n'));
  console.log('Fixed');
} else { console.log('NOT FOUND'); }
