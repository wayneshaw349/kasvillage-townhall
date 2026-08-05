const fs = require("fs");
const f = "IOUBalanceSheetShare.tsx";
let s = fs.readFileSync(f, "utf8");
const nl = (s.match(/\r\n/g)||[]).length >= (s.match(/(?<!\r)\n/g)||[]).length ? "\r\n" : "\n";
if (s.includes("await releaseOrphanIOUAllocations();")) { console.error("already wired -- ABORT"); process.exit(1); }
const a = "    try {" + nl + "      const ledgers = await loadLedgers();";
const n = s.split(a).length - 1;
if (n !== 1) { console.error("loadData anchor count", n, "-- ABORT"); process.exit(1); }
s = s.replace(a, "    try {" + nl + "      try { const _o = await releaseOrphanIOUAllocations(); if (_o.freedCount > 0) console.log('[IOU] self-heal freed', _o.freedCount, 'orphans'); } catch {}" + nl + "      const ledgers = await loadLedgers();");
fs.writeFileSync(f + ".bak10", fs.readFileSync(f, "utf8"));
fs.writeFileSync(f, s);
console.log("self-heal wired into loadData");
