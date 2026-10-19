// fix_manifest_lag.cjs - "ROUND-TRIP FAILED: manifest: incomplete: 2/5 chunks" right after a publish.
// The explorer index lags a few seconds behind the chain, so reading the manifest back immediately
// found only the chunks it had indexed so far. Now:
//  - an incomplete manifest is re-read up to 4 more times, 5 s apart, before giving up
//  - if the index is still short, the chunks are read straight off the chain (walk with the game's coords)
//  - game installs pass their coordinates so that chain read is always possible
const fs = require('fs');
const jobs = [
  { f: 'config_chunks.ts', marker: 'KV_MANIFEST_LAG', edits: [
    ["    if (bySeq.size < tot) return { config: null, error: 'incomplete: ' + bySeq.size + '/' + tot + ' chunks' };",
     "    if (bySeq.size < tot) { // KV_MANIFEST_LAG: index behind the chain - read the chunks off the chain instead\n      const w2 = await fetchStoreConfigViaWalk(expectedHash, coords || {});\n      if (w2.config) { await cfgCachePut(expectedHash, w2.config); return w2; }\n      return { config: null, error: 'incomplete: ' + bySeq.size + '/' + tot + ' chunks' };\n    }"],
    ["export async function fetchStoreConfig(\n",
     "export async function fetchStoreConfig(storeAddress: string, expectedHash: string, network = 'testnet-10', coords?: { anchor_hash?: string; daa_to?: number }): Promise<{ config: any | null; error?: string }> {\n  let r = await _fetchStoreConfigOnce(storeAddress, expectedHash, network, coords);\n  for (let i = 0; i < 4 && !r.config && /incomplete|missing chunk/.test(String(r.error || '')); i++) {\n    await new Promise((res) => setTimeout(res, 5000));\n    r = await _fetchStoreConfigOnce(storeAddress, expectedHash, network, coords);\n  }\n  return r;\n}\nasync function _fetchStoreConfigOnce(\n"],
  ]},
  { f: 'game_chunks.ts', marker: 'KV_MANIFEST_LAG', edits: [
    ["    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network);",
     "    const { config, error } = await fetchStoreConfig(manifestAddress, manifestHash, network, coords as any); // KV_MANIFEST_LAG"],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - manifest reads wait for the index, then fall back to reading the chain.');
