// wire_volume.cjs - Mailbox ready for thousands of listings.
//  - list renders in pages of 60 (more load as you scroll), virtualized with tuned window sizes
//  - stable keys for every card (games had none -> React re-rendered the whole grid)
//  - search runs 200 ms after you stop typing, not on every keystroke
//  - dev XP / trust lookups cached 10 min per publisher and de-duplicated (was 1 TownHall call per card)
// Run after wire_search_tags.cjs.
const fs = require('fs');
const f = 'VillageMailbox.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_VOLUME')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [
  ["  const [query, setQuery] = useState('');\n",
   "  const [query, setQuery] = useState('');\n  // KV_VOLUME: debounced search + paged rendering\n  const [dq, setDq] = useState('');\n  useEffect(() => { const h = setTimeout(() => setDq(query), 200); return () => clearTimeout(h); }, [query]);\n  const [shown, setShown] = useState(60);\n  useEffect(() => { setShown(60); }, [dq, section]);\n"],
  ["require('./kv_search').searchItems(getCurrentData() || [], query, section);", "require('./kv_search').searchItems(getCurrentData() || [], dq, section);"],
  ["  }, [section, dapps, storefronts, coupons, academics, services, games, query]);", "  }, [section, dapps, storefronts, coupons, academics, services, games, dq]);"],
  ["            data={filteredData}\n            keyExtractor={(item) => item.id}\n",
   "            data={filteredData.slice(0, shown)}\n            keyExtractor={(item: any, i: number) => String(item.id || (item.quad && item.quad.head) || item.arweaveTx || item.address || i)}\n            initialNumToRender={8}\n            maxToRenderPerBatch={8}\n            windowSize={7}\n            removeClippedSubviews\n"],
  ["            onEndReached={handleLoadMore}\n", "            onEndReached={() => { if (shown < filteredData.length) setShown((n: number) => n + 60); else handleLoadMore(); }}\n"],
  ["        const st = await f(item.o);\n",
   "        const _C: any = (globalThis as any).__kvStatsCache || ((globalThis as any).__kvStatsCache = new Map());\n        const _h = _C.get(item.o);\n        let st: any;\n        if (_h && Date.now() - _h.at < 600000) st = await _h.p;\n        else { const _p = f(item.o).catch(() => null); _C.set(item.o, { at: Date.now(), p: _p }); st = await _p; }\n"],
];
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (run wire_search_tags.cjs first). Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - paged + virtualized list, debounced search, cached publisher stats.');
