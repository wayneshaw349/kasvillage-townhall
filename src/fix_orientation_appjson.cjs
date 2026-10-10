// fix_orientation_appjson.cjs — unlock app orientation so games can go real landscape.
// "portrait" -> "default" (wallet screens stay portrait via the runtime lock; games lock LANDSCAPE on mount).
const fs = require('fs');
const F = 'app.json';
const j = JSON.parse(fs.readFileSync(F, 'utf8'));
const cur = j.expo && j.expo.orientation;
if (cur === 'default') { console.log('already "default"'); process.exit(0); }
if (cur !== 'portrait') { console.error('expected orientation "portrait", found:', JSON.stringify(cur), '- aborting.'); process.exit(1); }
j.expo.orientation = 'default';
fs.writeFileSync(F, JSON.stringify(j, null, 2) + '\n');
console.log('app.json orientation: portrait -> default');
