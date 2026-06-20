const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');

// Fix 1: Change GET to POST with pubkey body
c = c.replace(
  "const response = await fetch(url, {\n      method: 'GET',\n      headers: { 'Accept': 'application/json' },\n      signal: controller.signal,\n    });",
  "const response = await fetch(url, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ pubkey }),\n      signal: controller.signal,\n    });"
);
console.log('1. GET ? POST with pubkey body');

// Fix 2: Parse /user-stats response (stats returned directly, not wrapped)
c = c.replace(
  "return {\n      found: data.found,\n      stats: convertStats(data.stats),\n      proof: data.proof ? convertProof(data.proof) : undefined,\n      recentAgreements: data.recent_agreements?.map(convertAgreement),\n      error: data.error,\n    };",
  "// /user-stats returns stats directly: {successes, deadlocks, xp, pubkey, citadel_tier, ...}\n    const hasStats = data.successes !== undefined || data.xp !== undefined;\n    return {\n      found: hasStats,\n      stats: hasStats ? computeStats(pubkey, data.xp || 0, data.successes || 0, data.deadlocks || 0) : unknownStats(pubkey),\n    };"
);
console.log('2. Response parser canonical for /user-stats');

fs.writeFileSync('counterparty_lookup.ts', c);
console.log('Done');
