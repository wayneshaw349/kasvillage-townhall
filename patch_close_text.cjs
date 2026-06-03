const fs = require('fs');
const f = 'Workspace.tsx';
const lines = fs.readFileSync(f, 'utf8').split('\n');
let changes = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().includes('item.dollarPrice > 0') && lines[i].trim().includes('Price TBD')) {
    // Check if next non-empty line has </Text>
    let hasClose = false;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      if (lines[j].trim() === '</Text>') { hasClose = true; break; }
      if (lines[j].trim().length > 0) break;
    }
    if (!hasClose) {
      const indent = lines[i].match(/^(\s*)/)[1];
      lines.splice(i + 1, 0, indent.slice(0, -2) + '</Text>');
      changes++;
      console.log('Added </Text> after line', i + 1);
    }
  }
}

fs.writeFileSync(f, lines.join('\n'));
console.log('Total fixes:', changes);
