const fs = require('fs');
const f = 'wallet_merkle_archive.ts';
let c = fs.readFileSync(f, 'utf8');

// Fix field-name typo: blockAnchor.daaScore (nonexistent) -> daa_score (real).
const anchor = 'daaScore: blockAnchor?.daaScore || params.daaScore,';
const n = c.split(anchor).length - 1;
if (n !== 1) { console.error('ABORT: anchor count = ' + n); process.exit(1); }
c = c.replace(anchor, 'daaScore: blockAnchor?.daa_score || params.daaScore,');
fs.writeFileSync(f, c);
console.log('OK — daaScore now reads blockAnchor.daa_score (real value)');
