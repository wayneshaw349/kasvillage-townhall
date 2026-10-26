// wire_no_redq.cjs - TradeFi page: remove the red question-mark emoji from "Can You Sell Treasury Bonds?"
//   node wire_no_redq.cjs   (project folder; safe to run twice; backup TradeFiScreen.tsx.bak_no_redq)
const fs = require('fs');
const F = 'TradeFiScreen.tsx';
const A = '<Text style={styles.sellInfoTitle}>❓ Can You Sell Treasury Bonds?</Text>';
const B = '<Text style={styles.sellInfoTitle}>Can You Sell Treasury Bonds?</Text>';
const raw = fs.readFileSync(F, 'utf8');
if (raw.includes(B) && !raw.includes(A)) { console.log('  done  ' + F + ' (already changed)'); process.exit(0); }
if (raw.split(A).length !== 2) { console.log('  FAIL  ' + F + ' - heading not found, left untouched'); process.exit(1); }
fs.writeFileSync(F + '.bak_no_redq', raw); fs.writeFileSync(F, raw.replace(A, () => B));
console.log('  ok    ' + F + ' - reload the app to see it');
