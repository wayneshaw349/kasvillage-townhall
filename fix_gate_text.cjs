const fs = require('fs');
const f = 'Workspace.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  // "Complete all 12 Lore traits"
  if (lines[i].includes('Complete all 12 Lore traits')) {
    lines[i] = lines[i].replace('Complete all 12 Lore traits', 'Complete 6 identity traits');
    fixes++; console.log('L' + (i+1) + ': 12 -> 6 traits text');
  }
  // {filledTraits}/12
  if (lines[i].includes('{filledTraits}/12')) {
    lines[i] = lines[i].replace('{filledTraits}/12', '{filledTraits}/6');
    fixes++; console.log('L' + (i+1) + ': progress count /12 -> /6');
  }
  // Resident (8)
  if (lines[i].includes('Resident (8)')) {
    lines[i] = lines[i].replace('Resident (8)', 'Resident (5)');
    fixes++; console.log('L' + (i+1) + ': Resident (8) -> (5)');
  }
  // Passport (12)
  if (lines[i].includes('Passport (12)')) {
    lines[i] = lines[i].replace('Passport (12)', 'Passport (6)');
    fixes++; console.log('L' + (i+1) + ': Passport (12) -> (6)');
  }
  // filledTraits >= 5 thresholds for progress color
  if (lines[i].includes('filledTraits >= 5') && lines[i].includes('green600')) {
    // Already correct for Resident at 5
  }
  if (lines[i].includes('filledTraits >= 6') && lines[i].includes('green600')) {
    // Already correct for Passport at 6
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
