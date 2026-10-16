// fix_stores_lane_filter.cjs — the Stores lane filtered on townhall.verified,
// but KV_HONEST_BADGE deliberately sets stores verified:false (they are
// pledge-anchored, not TownHall-verified) - so the lane was permanently
// empty. Drop the filter: the directory already enforces real trust
// (signature, pledge>0, delists, content scan) and the badge tells the rest.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_HONEST_LANE')) { console.log('already patched'); process.exit(0); }

const A = `        case 'storefronts':
          result = await fetchStorefronts(cursor);
          result.items = result.items.filter((s: StorefrontEntry) => s.townhall.verified);`;
const B = `        case 'storefronts':
          result = await fetchStorefronts(cursor);
          // KV_HONEST_LANE: stores are pledge-anchored (verified:false by design) -
          // the old verified filter blanked the whole lane. Directory rules
          // (sig, live pledge, delists, content scan) already gate entry.`;

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Stores lane shows pledge-anchored stores');
