// fix_no_flag_clear.cjs — no arbitration: remove "Mod: clear all flags".
// 3 flags = delisted automatically in every wallet; nobody (mod included) can clear.
// Readers also stop honoring flagclear records. clearFlags() stays exported but unused.
const fs = require('fs');
const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_NO_FLAG_CLEAR', edits: [
    ["    if ((r.t || 0) <= (_kvClearT.get(h) || 0)) continue;   // cleared by mod\n",
     "    // KV_NO_FLAG_CLEAR: flags cannot be cleared - no arbitration\n"],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'KV_NO_FLAG_CLEAR', edits: [
    ["      if (pub === '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133') btns.push({ text: 'Mod: clear all flags', onPress: async () => {",
     "      // KV_NO_FLAG_CLEAR: no clear option - 3 flags delist automatically, nobody arbitrates\n      if (false) btns.push({ text: 'Mod: clear all flags', onPress: async () => {"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - flags cannot be cleared; 3 flags = delisted, no arbitration.');
