const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');
const old = "  const pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);";
const rep = "  let pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);";
if (c.includes(old)) { c = c.replace(old, rep); console.log('1. const->let'); } else { console.log('1. SKIP'); }

const old2 = "    console.warn('[Resolve] No pubkey found for apt:', apt);\n    return { pubkey: null, stats: null };\n  }";
const rep2 = "    // Fallback: TownHall /api/device/check\n    try {\n      const r = await fetch(TOWNHALL_API + '/api/device/check?apt=APT-' + apt, { signal: AbortSignal.timeout(8000) });\n      if (r.ok) { const d = await r.json(); if (d.found && d.pubkey) { pubkey = d.pubkey; if (d.stats) return { pubkey, stats: computeStats(pubkey, d.stats.xp||0, d.stats.successes||0, d.stats.deadlocks||0) }; } }\n    } catch {}\n    if (!pubkey) { console.warn('[Resolve] No pubkey found for apt:', apt); return { pubkey: null, stats: null }; }\n  }";
if (c.includes(old2)) { c = c.replace(old2, rep2); console.log('2. Added fallback'); } else { console.log('2. SKIP'); }

fs.writeFileSync('counterparty_lookup.ts', c);
