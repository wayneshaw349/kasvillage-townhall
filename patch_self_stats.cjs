const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

const oldSelf = "if (aptNum === myAptNum && myPubkey) {\n          // Self-lookup: skip Arweave resolution, use own pubkey\n          const selfResult = await lookupCounterparty(myPubkey);\n          lookupResult = { pubkey: myPubkey, stats: selfResult.stats };";
const newSelf = "if (aptNum === myAptNum && myPubkey) {\n          // Self-lookup: use /user-stats directly\n          console.log('[StatsLookup] Self-lookup: using own pubkey');\n          try {\n            const res = await fetch('https://kasvillage.app.runonflux.io/user-stats', {\n              method: 'POST', headers: { 'Content-Type': 'application/json' },\n              body: JSON.stringify({ pubkey: myPubkey }),\n            });\n            if (res.ok) {\n              const s = await res.json();\n              lookupResult = { pubkey: myPubkey, stats: s };\n            }\n          } catch (e) { console.warn('[StatsLookup] Self-lookup failed:', e); }";
if (c.includes(oldSelf)) {
  c = c.replace(oldSelf, newSelf);
  console.log('Fixed self-lookup to use /user-stats');
} else { console.log('SKIP'); }

fs.writeFileSync('townhallscreen.tsx', c);
