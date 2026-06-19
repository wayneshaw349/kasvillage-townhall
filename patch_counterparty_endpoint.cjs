const fs = require('fs');
let c = fs.readFileSync('counterparty_lookup.ts', 'utf8');

const old = "const url = `${TOWNHALL_API}/api/counterparty/${pubkey}${endpoint ? '/' + endpoint : ''}?${params}`;";
const rep = "const url = `${TOWNHALL_API}/user-stats`;";
if (c.includes(old)) {
  // Replace the GET call with a POST to /user-stats
  c = c.replace(old, rep);
  c = c.replace(
    "const response = await fetch(url, {\n      method: 'GET',\n      headers: { 'Accept': 'application/json' },\n      signal: controller.signal,\n    });",
    "const response = await fetch(url, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },\n      body: JSON.stringify({ pubkey }),\n      signal: controller.signal,\n    });"
  );
  console.log('Fixed: lookupCounterparty uses /user-stats POST');
} else { console.log('SKIP'); }

fs.writeFileSync('counterparty_lookup.ts', c);
