// prune_games.cjs - take make_chain builds off the bookshelf (games_to_publish.js).
//   node prune_games.cjs                 -> lists the books
//   node prune_games.cjs id1 id2 ...     -> removes those entries (chain files stay on disk)
const fs = require('fs');
const f = 'games_to_publish.js';
let s = fs.readFileSync(f, 'utf8');
const ids = [...s.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]);
const drop = process.argv.slice(2);
if (!drop.length) { console.log('books on the shelf (from make_chain):\n  ' + ids.join('\n  ')); process.exit(0); }
const missing = drop.filter((d) => !ids.includes(d));
if (missing.length) { console.error('not found: ' + missing.join(', ') + ' - nothing changed'); process.exit(1); }
for (const d of drop) s = s.replace(new RegExp("^\\s*'" + d.replace(/[-]/g, '\\-') + "':\\s*\\{.*\\},?\\r?\\n", 'm'), '');
fs.writeFileSync(f, s);
console.log('removed: ' + drop.join(', ') + '\nleft: ' + [...s.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]).join(', '));
