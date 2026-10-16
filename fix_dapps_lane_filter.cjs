// fix_dapps_lane_filter.cjs — same honest-badge treatment for the DApps
// lane: drop the attest-only filter so unattested dapps are VISIBLE with
// their Unverified badge instead of invisible. Directory rules (sig, live
// pledge, delists, content scan) still gate entry; the attest still decides
// the badge and the board, and installs stay hash-pinned.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_HONEST_LANE dapps')) { console.log('already patched'); process.exit(0); }

const A = `        case 'dapps':
          result = await fetchDApps(cursor);
          result.items = result.items.filter((d: DAppEntry) => d.townhall.verified);`;
const B = `        case 'dapps':
          result = await fetchDApps(cursor);
          // KV_HONEST_LANE dapps: unattested dapps show with their Unverified
          // badge instead of being hidden. Attest still sets badge + board;
          // installs stay hash-pinned; directory rules gate entry.`;

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: DApps lane shows unattested dapps with honest badges');
