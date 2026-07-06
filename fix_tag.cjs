const fs=require('fs');let s=fs.readFileSync('counterparty_lookup.ts','utf8');s=s.replace("'KV-Apt'","'KV-APT'");fs.writeFileSync('counterparty_lookup.ts',s);console.log('done');
