const fs = require('fs');
let c = fs.readFileSync('AppNaviagator.tsx', 'utf8');
const anchor = "console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');";
const idx = c.indexOf(anchor);
if (idx === -1) { console.log('ERROR: anchor not found'); process.exit(1); }
const insertAt = idx + anchor.length;
const block = "\n          setBalanceSompi(sompi); // Show balance immediately";
// Remove the late setBalanceSompi(sompi) call
c = c.replace(/\n\s+setBalanceSompi\(sompi\);\n/, '\n');
// Insert early
c = c.slice(0, insertAt) + block + c.slice(insertAt);
fs.writeFileSync('AppNaviagator.tsx', c);
console.log('OK: balance now shows immediately after L1 response');
