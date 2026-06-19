const fs = require('fs');
let c = fs.readFileSync('Dashboard.tsx', 'utf8');

c = c.replace(
  "{(Number((ds.totalBalanceSompi || 0n) - (ds.spendableBalanceSompi || 0n)) / 1e8).toFixed(4)} KASPA",
  "{((Number(ds.totalBalanceSompi || 0) - Number(ds.spendableBalanceSompi || 0)) / 1e8).toFixed(4)} KASPA"
);
console.log('1. FROST safe');

c = c.replace(
  "{(Number(ds.spendableBalanceSompi - (ds.iousOwedSompi || 0n)) / 1e8).toFixed(4)} KASPA",
  "{((Number(ds.spendableBalanceSompi || 0) - Number(ds.iousOwedSompi || 0)) / 1e8).toFixed(4)} KASPA"
);
console.log('2. Spendable safe');

fs.writeFileSync('Dashboard.tsx', c);
