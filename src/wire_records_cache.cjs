// wire_records_cache.cjs — device-persistent record cache inside fetchRecords.
// Every lane (stores, dapps, coupons, academics, services, games' record rung)
// inherits it: a successful fetch is saved per-address; when REST and the
// relays both come back empty, the cache serves. Guarded require, so PC-side
// use of kaspa_payload (no AsyncStorage) is unaffected.
const fs = require('fs');
const F = 'kaspa_payload.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('kv_rec_cache_')) { console.log('already patched'); process.exit(0); }

const A = "  out.sort((a, b) => b.blockTime - a.blockTime);\n  return out;\n}";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = `  // KV_RECORDS_CACHE: per-address device cache — survives relay recycles and
  // the dead REST index. Saved on success, served when both rails are empty.
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const ck = 'kv_rec_cache_' + address.slice(-24);
    if (out.length > 0) { AS.setItem(ck, JSON.stringify(out.slice(0, 300))).catch(() => {});
    } else { const raw = await AS.getItem(ck); if (raw) { for (const r of JSON.parse(raw)) out.push(r); } }
  } catch {}
  out.sort((a, b) => b.blockTime - a.blockTime);
  return out;
}`;

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: fetchRecords caches per-address on device');
