const fs = require('fs');
let c = fs.readFileSync('Dashboard.tsx', 'utf8');
c = c.replace(
  "{(Number(ds.committedSompi) / 1e8).toFixed(4)} KASPA",
  "{(Number(ds.totalBalanceSompi - ds.spendableBalanceSompi) / 1e8).toFixed(4)} KASPA"
);
console.log('1. FROST = total - spendable');
c = c.replace(
  "{(Number(ds.spendableBalanceSompi) / 1e8).toFixed(4)} KASPA</Text>\n        </View>\n        <View style={{ height: 1",
  "{(Number(ds.spendableBalanceSompi - ds.iousOwedSompi) / 1e8).toFixed(4)} KASPA</Text>\n        </View>\n        <View style={{ height: 1"
);
console.log('2. Spendable = free - IOUs');
fs.writeFileSync('Dashboard.tsx', c);
