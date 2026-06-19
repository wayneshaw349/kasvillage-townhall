const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');
c = c.replace(
  "Hardware Bind</Text>",
  "Hardware Bind (bind device to avatar)</Text>"
);
if (c.includes('bind device to avatar')) {
  console.log('Updated label');
} else { console.log('SKIP'); }
fs.writeFileSync('ProfileScreen.tsx', c);
