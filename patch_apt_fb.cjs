const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');
c = c.replace(
  "  let pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);\n  if (!pubkey) {\n    console.warn('[Resolve] No pubkey found for apt:', apt);\n    return { pubkey: null, stats: null };\n  }",
  "  let pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);\n  if (!pubkey) {\n    try {\n      const r = await fetch(TOWNHALL_API + '/api/device/check?apt=APT-' + apt, { signal: AbortSignal.timeout(8000) });\n      if (r.ok) { const d = await r.json(); if (d.found && d.pubkey) { pubkey = d.pubkey; if (d.stats) return { pubkey, stats: computeStats(pubkey, d.stats.xp||0, d.stats.successes||0, d.stats.deadlocks||0) }; } }\n    } catch {}\n  }\n  if (!pubkey) {\n    console.warn('[Resolve] No pubkey found for apt:', apt);\n    return { pubkey: null, stats: null };\n  }"
);
console.log('Done');
fs.writeFileSync('counterparty_lookup.ts', c);
