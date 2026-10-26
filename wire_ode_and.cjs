// wire_ode_and.cjs - TradeFi page, Wayne Shaw quote: "a ballot, or a bond" -> "a ballot and a bond" (Kiswahili + English)
//   node wire_ode_and.cjs   (project folder; safe to run twice; backup TradeFiScreen.tsx.bak_ode_and)
const fs = require('fs');
const F = 'TradeFiScreen.tsx';
const HUNKS = [
  ['"Kura, au hati fungani kati ya nchi na raia wake."', '"Kura na hati fungani kati ya nchi na raia wake."'],
  ['"A ballot, or a bond between a country and its citizens."', '"A ballot and a bond between a country and its citizens."'],
];
const raw = fs.readFileSync(F, 'utf8'); let t = raw;
if (HUNKS.every(([a, b]) => t.includes(b) && !t.includes(a))) { console.log('  done  ' + F + ' (already changed)'); process.exit(0); }
for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { console.log('  FAIL  ' + F + ' - text not found, left untouched: ' + a); process.exit(1); } t = t.replace(a, () => b); }
fs.writeFileSync(F + '.bak_ode_and', raw); fs.writeFileSync(F, t);
console.log('  ok    ' + F + ' (2 changes) - reload the app to see it');
