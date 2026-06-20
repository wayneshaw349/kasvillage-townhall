const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  // Fix the access_level thresholds in verify_user_full
  if (lines[i].includes('traits.count() < 9') && lines[i].includes('GUEST')) {
    lines[i] = lines[i].replace('traits.count() < 9', 'traits.count() < 5');
    fixes++; console.log('L' + (i+1) + ': GUEST threshold 9 -> 5');
  }
  if (lines[i].includes('traits.count() < 13') && lines[i].includes('RESIDENT')) {
    lines[i] = lines[i].replace('traits.count() < 13', 'traits.count() < 6');
    fixes++; console.log('L' + (i+1) + ': RESIDENT threshold 13 -> 6');
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
