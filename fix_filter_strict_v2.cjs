// fix_filter_strict_v2.cjs — upgrade the strict layer already committed (7c2bda2) to v2:
// removes the old KV_FILTER_STRICT block from content_filter.ts, then re-runs wire_filter_strict.cjs
// (v2: spaced/dotted letters squashed, 12-words / mnemonic false positives fixed in the base rules).
const fs = require('fs');
const { execSync } = require('child_process');
const F = 'content_filter.ts';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_PHISH_FP')) { console.log('already v2 - nothing to do'); process.exit(0); }
const i = s.indexOf('\n\n// KV_FILTER_STRICT');
if (i < 0) { console.error('old strict block not found'); process.exit(1); }
if (!fs.existsSync('wire_filter_strict.cjs') || !fs.readFileSync('wire_filter_strict.cjs', 'utf8').includes('kvSquash')) { console.error('wire_filter_strict.cjs is the old version - move the new download in first'); process.exit(1); }
s = s.slice(0, i) + '\n';
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('content_filter.ts: old strict block removed');
console.log(execSync('node wire_filter_strict.cjs').toString().trim());
