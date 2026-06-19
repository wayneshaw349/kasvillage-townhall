const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// 1. Increase poll count from 24 to 48 (4 minutes)
c = c.replace('for (let i = 0; i < 24; i++)', 'for (let i = 0; i < 48; i++)');
// 2. Handle undefined status (404 from wrong container) — just keep polling
c = c.replace(
  "if (pollData.status === 'failed') break;",
  "if (pollData.status === 'failed') break;\n                if (!pollData.status && pollData.error) continue; // Wrong container, retry"
);
fs.writeFileSync('townhallscreen.tsx', c);
console.log('OK: extended polling to 4 min + handle 404');
