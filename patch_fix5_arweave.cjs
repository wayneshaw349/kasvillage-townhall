// patch_fix5_arweave.cjs — Arweave direct frost query (run AFTER ceremony_final)
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

if (s.includes('Got frostAddress from Arweave')) {
  console.log('FIX 5: already present ✓');
  process.exit();
}

// Change const to let
const old1 = '          const agrFrostAddr = agreement.frostAddress';
if (s.includes(old1)) {
  s = s.replace(old1, '          let agrFrostAddr = agreement.frostAddress');
}

// Find insertion point: after the "let agrFrostAddr = ..." line
const anchor = "let agrFrostAddr = agreement.frostAddress || '';";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('FIX 5: anchor not found'); process.exit(); }

const lineEnd = s.indexOf('\n', idx);
const insertAt = lineEnd + 1;

const block = [
  "          if (!agrFrostAddr || agrFrostAddr.length < 20) {",
  "            try {",
  "              const _fGql = '{ transactions(first: 1, tags: [{ name: \"KV-AgreementId\", values: [\"' + agrId + '\"] }, { name: \"KV-Status\", values: [\"Proposed\"] }]) { edges { node { tags { name value } } } } }';",
  "              const _fResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _fGql }) });",
  "              const _fJson = await _fResp.json();",
  "              const _fTags = _fJson?.data?.transactions?.edges?.[0]?.node?.tags;",
  "              if (_fTags) { const _fm: any = {}; _fTags.forEach((t: any) => { _fm[t.name] = t.value; }); if (_fm['KV-FrostAddress']) { agrFrostAddr = _fm['KV-FrostAddress']; console.log('[Seller-Reuse] Got frostAddress from Arweave proposal:', agrFrostAddr.slice(0, 30)); } }",
  "            } catch (e) { console.warn('[Seller-Reuse] Arweave frost query failed:', e); }",
  "          }",
  "",
].join('\r\n');

s = s.slice(0, insertAt) + block + s.slice(insertAt);
fs.writeFileSync(f, s);

console.log('FIX 5: arweave frost query ✓');
console.log('Verify:', s.includes('Got frostAddress from Arweave') ? '✓' : '✗');
