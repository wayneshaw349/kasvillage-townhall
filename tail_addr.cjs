const s = require('fs').readFileSync('counterparty_lookup.ts','utf8').split(/\r?\n/);
for (let j=849; j<872; j++) console.log((j+1)+': '+JSON.stringify(s[j]?.slice(0,160)));
