const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// In StatsLookup handleLookup, check if looking up own APT first
const oldLookup = "// APT lookup ? Arweave KV-Apt tag ? pubkey ? stats\n        const aptNum = q.replace(/^APT-/i, '');\n        lookupResult = await lookupByApt(aptNum);";
const newLookup = "// APT lookup: check self first, then Arweave\n        const aptNum = q.replace(/^APT-/i, '');\n        const myAptNum = (myApt || '').replace(/^APT-/i, '');\n        if (aptNum === myAptNum && myPubkey) {\n          // Self-lookup: skip Arweave resolution, use own pubkey\n          const selfResult = await lookupCounterparty(myPubkey);\n          lookupResult = { pubkey: myPubkey, stats: selfResult.stats };\n        } else {\n          lookupResult = await lookupByApt(aptNum);\n        }";
if (c.includes(oldLookup)) {
  c = c.replace(oldLookup, newLookup);
  console.log('1. Added self-lookup shortcut');
} else { console.log('1. SKIP'); }

// Add lookupCounterparty import if missing
if (!c.includes('lookupCounterparty')) {
  c = c.replace(
    "import { lookupByAddress, lookupByApt } from './counterparty_lookup';",
    "import { lookupByAddress, lookupByApt, lookupCounterparty } from './counterparty_lookup';"
  );
  console.log('2. Added lookupCounterparty import');
} else { console.log('2. Already imported'); }

fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done');
