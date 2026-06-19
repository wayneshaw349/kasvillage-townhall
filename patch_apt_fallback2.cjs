const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');
const old = "  const pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);\n  if (!pubkey) {\n    console.warn('[Resolve] No pubkey found for apt:', apt);\n    return { pubkey: null, stats: null };\n  }";
const rep = "  let pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);\n  if (!pubkey) {\n    // Fallback: try TownHall device/check endpoint\n    try {\n      const r = await fetch(TOWNHALL_API + '/api/device/check?apt=APT-' + apt, { signal: AbortSignal.timeout(8000) });\n      if (r.ok) { const d = await r.json(); if (d.found && d.pubkey) { pubkey = d.pubkey; if (d.stats) return { pubkey, stats: d.stats }; } }\n    } catch {} \n  }\n  if (!pubkey) {\n    console.warn('[Resolve] No pubkey found for apt:', apt);\n    return { pubkey: null, stats: null };\n  }";
if (c.includes(old)) { c = c.replace(old, rep); console.log('Added TownHall fallback'); } else { console.log('SKIP'); }
fs.writeFileSync('counterparty_lookup.ts', c);
