const fs = require('fs');
const f = 'mailbox_arweave_api.ts';
let s = fs.readFileSync(f, 'utf8');
s = s.replaceAll(
  "getTagValue(tags, 'KV-Description') || getTagValue(tags, 'Description') ?? ''",
  "(getTagValue(tags, 'KV-Description') || getTagValue(tags, 'Description')) ?? ''"
);
fs.writeFileSync(f, s);
console.log('Fixed: wrapped || ?? in parens');
