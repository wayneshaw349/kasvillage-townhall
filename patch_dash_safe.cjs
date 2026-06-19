const fs = require('fs');
let c = fs.readFileSync('Dashboard.tsx', 'utf8');

// Fix: ensure safe BigInt subtraction with fallback
c = c.replace(
  "{(Number(ds.spendableBalanceSompi - ds.iousOwedSompi) / 1e8).toFixed(4)} KASPA",
  "{(Number(ds.spendableBalanceSompi - (ds.iousOwedSompi || 0n)) / 1e8).toFixed(4)} KASPA"
);
console.log('1. Safe iousOwedSompi fallback');

c = c.replace(
  "{(Number(ds.totalBalanceSompi - ds.spendableBalanceSompi) / 1e8).toFixed(4)} KASPA",
  "{(Number((ds.totalBalanceSompi || 0n) - (ds.spendableBalanceSompi || 0n)) / 1e8).toFixed(4)} KASPA"
);
console.log('2. Safe FROST fallback');

fs.writeFileSync('Dashboard.tsx', c);
console.log('Done');
