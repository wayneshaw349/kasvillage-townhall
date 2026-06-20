const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');

// Fix method: GET ? POST
c = c.replace("method: 'GET',", "method: 'POST',");
console.log('1. Method:', c.includes("method: 'POST'") ? 'POST' : 'STILL GET');

// Add body and Content-Type header
c = c.replace(
  "headers: { 'Accept': 'application/json' },",
  "headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ pubkey }),"
);
console.log('2. Body:', c.includes('body: JSON.stringify') ? 'added' : 'SKIP');

// Fix response parser: data.found ? hasStats check
c = c.replace("found: data.found,", "found: !!(data.successes !== undefined || data.xp !== undefined),");
console.log('3. Found:', c.includes('data.successes !== undefined') ? 'fixed' : 'SKIP');

// Fix stats: convertStats(data.stats) ? computeStats
c = c.replace(
  "stats: convertStats(data.stats),",
  "stats: (data.successes !== undefined) ? computeStats(pubkey, data.xp || 0, data.successes || 0, data.deadlocks || 0) : unknownStats(pubkey),"
);
console.log('4. Stats:', c.includes('computeStats(pubkey') ? 'fixed' : 'SKIP');

fs.writeFileSync('counterparty_lookup.ts', c);
console.log('Done');
