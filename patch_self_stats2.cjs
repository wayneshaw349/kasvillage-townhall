const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const old = "          const selfResult = await lookupCounterparty(myPubkey);\n          lookupResult = { pubkey: myPubkey, stats: selfResult.stats };";
const rep = "          console.log('[StatsLookup] Self-lookup via /user-stats');\n          const res = await fetch('https://kasvillage.app.runonflux.io/user-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey: myPubkey }) });\n          if (res.ok) { lookupResult = { pubkey: myPubkey, stats: await res.json() }; }";
if (c.includes(old)) { c = c.replace(old, rep); console.log('Fixed'); } else { console.log('SKIP'); }
fs.writeFileSync('townhallscreen.tsx', c);
