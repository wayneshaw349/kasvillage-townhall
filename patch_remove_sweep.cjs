const fs = require('fs');
let nav = fs.readFileSync('AppNaviagator.tsx', 'utf8');
const sweepStart = nav.indexOf("// === ORPHANED NONCE SWEEP ===");
if (sweepStart > -1) {
  const sweepEnd = nav.indexOf("}, []);", sweepStart) + 7;
  nav = nav.substring(0, sweepStart) + nav.substring(sweepEnd);
  console.log('Removed orphaned nonce sweep');
} else {
  console.log('Sweep not found (already removed or never added)');
}
fs.writeFileSync('AppNaviagator.tsx', nav);
